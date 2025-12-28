'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Customer {
  id: number
  full_name: string
  phone: string | null
}

interface Staff {
  id: number
  staff_name: string
  role: string
}

interface Product {
  id: number
  product_code: string
  product_name: string
  list_price: number
  category: string | null
}

interface SelectedProduct {
  product_id: number
  product_name: string
  price: number
  is_upsell: boolean
}

export default function NewOrderPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [staff, setStaff] = useState<Staff[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Customer type: new or existing
  const [isNewCustomer, setIsNewCustomer] = useState(false)
  const [customerId, setCustomerId] = useState('')

  // New customer fields
  const [newFirstName, setNewFirstName] = useState('')
  const [newLastName, setNewLastName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newContactChannel, setNewContactChannel] = useState('LINE')

  const [salesId, setSalesId] = useState('')
  const [artistId, setArtistId] = useState('')
  const [appointmentDate, setAppointmentDate] = useState('')
  const [appointmentTime, setAppointmentTime] = useState('')
  const [deposit, setDeposit] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('โอนเงิน')
  const [note, setNote] = useState('')
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([])
  const [selectedProductId, setSelectedProductId] = useState('')

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const [customersRes, staffRes, productsRes] = await Promise.all([
      supabase.from('customers').select('id, full_name, phone').eq('is_active', true).order('full_name'),
      supabase.from('staff').select('id, staff_name, role').eq('is_active', true).order('staff_name'),
      supabase.from('products').select('id, product_code, product_name, list_price, category').eq('is_active', true).order('product_name'),
    ])

    console.log('Products loaded:', productsRes.data?.length || 0)
    setCustomers(customersRes.data || [])
    setStaff(staffRes.data || [])
    setProducts(productsRes.data || [])
    setLoading(false)
  }

  const addProduct = () => {
    if (!selectedProductId) {
      alert('กรุณาเลือกสินค้า/บริการก่อน')
      return
    }

    // Use string comparison to handle both number and string IDs from Supabase
    const product = products.find(p => String(p.id) === selectedProductId)
    if (!product) {
      console.error('Product not found. selectedProductId:', selectedProductId, 'products:', products.map(p => ({ id: p.id, type: typeof p.id })))
      alert('ไม่พบสินค้าที่เลือก')
      return
    }

    if (selectedProducts.find(p => p.product_id === product.id)) {
      alert('สินค้านี้ถูกเลือกไปแล้ว')
      return
    }

    const newProduct: SelectedProduct = {
      product_id: product.id,
      product_name: product.product_name,
      price: product.list_price,
      is_upsell: false,
    }
    setSelectedProducts(prev => [...prev, newProduct])
    setSelectedProductId('')
  }

  const removeProduct = (productId: number) => {
    setSelectedProducts(selectedProducts.filter(p => p.product_id !== productId))
  }

  const toggleUpsell = (productId: number) => {
    setSelectedProducts(selectedProducts.map(p =>
      p.product_id === productId ? { ...p, is_upsell: !p.is_upsell } : p
    ))
  }

  const totalIncome = selectedProducts.reduce((sum, p) => sum + p.price, 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (!isNewCustomer && !customerId) {
      alert('กรุณาเลือกลูกค้า')
      return
    }
    if (isNewCustomer && (!newFirstName.trim() || !newLastName.trim())) {
      alert('กรุณากรอกชื่อและนามสกุลลูกค้า')
      return
    }
    if (selectedProducts.length === 0) {
      alert('กรุณาเลือกสินค้า/บริการอย่างน้อย 1 รายการ')
      return
    }

    setSaving(true)

    try {
      let finalCustomerId = customerId

      // Create new customer if needed
      if (isNewCustomer) {
        const { data: newCustomer, error: customerError } = await supabase
          .from('customers')
          .insert({
            full_name: `${newFirstName.trim()} ${newLastName.trim()}`,
            phone: newPhone || null,
            contact_channel: newContactChannel,
          })
          .select()
          .single()

        if (customerError) throw customerError
        finalCustomerId = newCustomer.id.toString()
      }

      // Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_id: parseInt(finalCustomerId),
          sales_id: salesId ? parseInt(salesId) : null,
          artist_id: artistId ? parseInt(artistId) : null,
          appointment_date: appointmentDate || null,
          appointment_time: appointmentTime || null,
          order_status: 'booking',
          total_income: totalIncome,
          deposit: parseFloat(deposit) || 0,
          payment_method: paymentMethod,
          note: note || null,
        })
        .select()
        .single()

      if (orderError) throw orderError

      // Create order items
      const orderItems = selectedProducts.map(p => ({
        order_id: order.id,
        product_id: p.product_id,
        is_upsell: p.is_upsell,
      }))

      await supabase.from('order_items').insert(orderItems)

      // Create initial payment if deposit > 0
      if (parseFloat(deposit) > 0) {
        await supabase.from('payments').insert({
          order_id: order.id,
          amount: parseFloat(deposit),
          payment_method: paymentMethod,
          note: 'มัดจำ',
        })
      }

      router.push(`/orders/${order.id}`)
    } catch (error) {
      console.error('Error creating order:', error)
      alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500 dark:text-gray-400">กำลังโหลด...</div>
      </div>
    )
  }

  const salesStaff = staff.filter(s => s.role === 'sales' || s.role === 'admin')
  const artists = staff.filter(s => s.role === 'artist')
  const availableProducts = products.filter(p => !selectedProducts.some(sp => sp.product_id === p.id))

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/orders" className="btn btn-secondary">
          ← กลับ
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">สร้างออเดอร์ใหม่</h1>
          <p className="text-gray-500 dark:text-gray-400">กรอกข้อมูลเพื่อสร้างคำสั่งซื้อใหม่</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer Section */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between border-b pb-2">
            <h2 className="font-bold text-gray-800 dark:text-white">ข้อมูลลูกค้า</h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsNewCustomer(false)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  !isNewCustomer
                    ? 'bg-pink-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
                }`}
              >
                ลูกค้าเก่า
              </button>
              <button
                type="button"
                onClick={() => setIsNewCustomer(true)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  isNewCustomer
                    ? 'bg-pink-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
                }`}
              >
                ลูกค้าใหม่
              </button>
            </div>
          </div>

          {!isNewCustomer ? (
            // Existing Customer
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                เลือกลูกค้า <span className="text-red-500">*</span>
              </label>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="select"
                required={!isNewCustomer}
              >
                <option value="">-- เลือกลูกค้า --</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.full_name} {c.phone ? `(${c.phone})` : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            // New Customer Form
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  ชื่อ <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newFirstName}
                  onChange={(e) => setNewFirstName(e.target.value)}
                  className="input"
                  placeholder="ชื่อ"
                  required={isNewCustomer}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  นามสกุล <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newLastName}
                  onChange={(e) => setNewLastName(e.target.value)}
                  className="input"
                  placeholder="นามสกุล"
                  required={isNewCustomer}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  ช่องทางการติดต่อ <span className="text-red-500">*</span>
                </label>
                <select
                  value={newContactChannel}
                  onChange={(e) => setNewContactChannel(e.target.value)}
                  className="select"
                >
                  <option value="LINE">LINE</option>
                  <option value="Facebook">Facebook</option>
                  <option value="Instagram">Instagram</option>
                  <option value="Call">โทรศัพท์</option>
                  <option value="Walk-in">Walk-in</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  เบอร์โทร <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="input"
                  placeholder="0xx-xxx-xxxx"
                  required={isNewCustomer}
                />
              </div>
            </div>
          )}
        </div>

        {/* Staff Assignment */}
        <div className="card space-y-4">
          <h2 className="font-bold text-gray-800 dark:text-white border-b pb-2">พนักงานรับผิดชอบ</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sales</label>
              <select
                value={salesId}
                onChange={(e) => setSalesId(e.target.value)}
                className="select"
              >
                <option value="">-- เลือก Sales --</option>
                {salesStaff.map(s => (
                  <option key={s.id} value={s.id}>{s.staff_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Artist</label>
              <select
                value={artistId}
                onChange={(e) => setArtistId(e.target.value)}
                className="select"
              >
                <option value="">-- เลือก Artist --</option>
                {artists.map(a => (
                  <option key={a.id} value={a.id}>{a.staff_name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Products */}
        <div className="card space-y-4">
          <h2 className="font-bold text-gray-800 dark:text-white border-b pb-2">
            สินค้า/บริการ <span className="text-red-500">*</span>
          </h2>

          <div className="flex gap-2">
            <select
              value={selectedProductId}
              onChange={(e) => {
                console.log('Selected:', e.target.value)
                setSelectedProductId(e.target.value)
              }}
              className="select flex-1"
            >
              <option value="">-- เลือกสินค้า/บริการ ({availableProducts.length} รายการ) --</option>
              {availableProducts.map(p => (
                <option key={p.id} value={String(p.id)}>
                  [{p.category || 'อื่นๆ'}] {p.product_name} - ฿{p.list_price.toLocaleString()}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={addProduct}
              className="btn btn-primary"
            >
              + เพิ่ม
            </button>
          </div>

          {products.length === 0 && (
            <div className="text-center text-orange-500 py-2">
              ⚠️ ไม่พบสินค้าในระบบ กรุณาเพิ่มสินค้าในเมนู "สินค้า/บริการ" ก่อน
            </div>
          )}

          {selectedProducts.length > 0 ? (
            <div className="space-y-2">
              {selectedProducts.map(p => (
                <div key={p.product_id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-medium dark:text-white">{p.product_name}</span>
                    <span className="text-gray-500 dark:text-gray-400">฿{p.price.toLocaleString()}</span>
                    <label className="flex items-center gap-1 text-sm">
                      <input
                        type="checkbox"
                        checked={p.is_upsell}
                        onChange={() => toggleUpsell(p.product_id)}
                        className="rounded"
                      />
                      <span className="text-purple-600 dark:text-purple-400">Upsell</span>
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeProduct(p.product_id)}
                    className="text-red-500 hover:text-red-600 font-medium"
                  >
                    ลบ
                  </button>
                </div>
              ))}
              <div className="text-right text-lg font-bold text-gray-800 dark:text-white pt-2 border-t">
                รวม: ฿{totalIncome.toLocaleString()}
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-500 dark:text-gray-400 py-4 border-2 border-dashed rounded-lg">
              ยังไม่ได้เลือกสินค้า/บริการ
            </div>
          )}
        </div>

        {/* Appointment & Payment */}
        <div className="card space-y-4">
          <h2 className="font-bold text-gray-800 dark:text-white border-b pb-2">นัดหมายและการชำระเงิน</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">วันนัดหมาย</label>
              <input
                type="date"
                value={appointmentDate}
                onChange={(e) => setAppointmentDate(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">เวลานัดหมาย</label>
              <input
                type="time"
                value={appointmentTime}
                onChange={(e) => setAppointmentTime(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">เงินมัดจำ</label>
              <input
                type="number"
                value={deposit}
                onChange={(e) => setDeposit(e.target.value)}
                className="input"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">วิธีชำระ</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="select"
              >
                <option value="โอนเงิน">โอนเงิน</option>
                <option value="เงินสด">เงินสด</option>
                <option value="บัตรเครดิต">บัตรเครดิต</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">หมายเหตุ</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="input"
              rows={3}
              placeholder="หมายเหตุเพิ่มเติม..."
            />
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-4">
          <Link href="/orders" className="btn btn-secondary flex-1 text-center">
            ยกเลิก
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary flex-1"
          >
            {saving ? 'กำลังบันทึก...' : 'สร้างออเดอร์'}
          </button>
        </div>
      </form>
    </div>
  )
}
