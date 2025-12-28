'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Customer {
  id: number
  full_name: string
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

  const [customerId, setCustomerId] = useState('')
  const [salesId, setSalesId] = useState('')
  const [artistId, setArtistId] = useState('')
  const [appointmentDate, setAppointmentDate] = useState('')
  const [appointmentTime, setAppointmentTime] = useState('')
  const [deposit, setDeposit] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('โอนเงิน')
  const [note, setNote] = useState('')
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([])

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const [customersRes, staffRes, productsRes] = await Promise.all([
      supabase.from('customers').select('id, full_name').eq('is_active', true),
      supabase.from('staff').select('id, staff_name, role').eq('is_active', true),
      supabase.from('products').select('id, product_code, product_name, list_price, category').eq('is_active', true),
    ])

    setCustomers(customersRes.data || [])
    setStaff(staffRes.data || [])
    setProducts(productsRes.data || [])
    setLoading(false)
  }

  const addProduct = (productId: string) => {
    if (!productId) return
    const product = products.find(p => p.id === parseInt(productId))
    if (!product || selectedProducts.find(p => p.product_id === product.id)) return

    setSelectedProducts([...selectedProducts, {
      product_id: product.id,
      product_name: product.product_name,
      price: product.list_price,
      is_upsell: false,
    }])
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
    if (!customerId || selectedProducts.length === 0) {
      alert('กรุณาเลือกลูกค้าและสินค้า/บริการอย่างน้อย 1 รายการ')
      return
    }

    setSaving(true)

    try {
      // Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_id: parseInt(customerId),
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
        <div className="text-gray-500">กำลังโหลด...</div>
      </div>
    )
  }

  const salesStaff = staff.filter(s => s.role === 'sales' || s.role === 'admin')
  const artists = staff.filter(s => s.role === 'artist')

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/orders" className="btn btn-secondary">
          ← กลับ
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">สร้างออเดอร์ใหม่</h1>
          <p className="text-gray-500">กรอกข้อมูลเพื่อสร้างคำสั่งซื้อใหม่</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer & Staff */}
        <div className="card space-y-4">
          <h2 className="font-bold text-gray-800 border-b pb-2">ข้อมูลลูกค้าและพนักงาน</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ลูกค้า <span className="text-red-500">*</span>
              </label>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="select"
                required
              >
                <option value="">เลือกลูกค้า</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.full_name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sales</label>
              <select
                value={salesId}
                onChange={(e) => setSalesId(e.target.value)}
                className="select"
              >
                <option value="">เลือก Sales</option>
                {salesStaff.map(s => (
                  <option key={s.id} value={s.id}>{s.staff_name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Artist</label>
              <select
                value={artistId}
                onChange={(e) => setArtistId(e.target.value)}
                className="select"
              >
                <option value="">เลือก Artist</option>
                {artists.map(a => (
                  <option key={a.id} value={a.id}>{a.staff_name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Products */}
        <div className="card space-y-4">
          <h2 className="font-bold text-gray-800 border-b pb-2">สินค้า/บริการ</h2>

          <div className="flex gap-2">
            <select
              onChange={(e) => {
                addProduct(e.target.value)
                e.target.value = ''
              }}
              className="select flex-1"
            >
              <option value="">+ เพิ่มสินค้า/บริการ</option>
              {products.map(p => (
                <option key={p.id} value={p.id} disabled={selectedProducts.some(sp => sp.product_id === p.id)}>
                  {p.product_name} - ฿{p.list_price.toLocaleString()}
                </option>
              ))}
            </select>
          </div>

          {selectedProducts.length > 0 ? (
            <div className="space-y-2">
              {selectedProducts.map(p => (
                <div key={p.product_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{p.product_name}</span>
                    <span className="text-gray-500">฿{p.price.toLocaleString()}</span>
                    <label className="flex items-center gap-1 text-sm">
                      <input
                        type="checkbox"
                        checked={p.is_upsell}
                        onChange={() => toggleUpsell(p.product_id)}
                        className="rounded"
                      />
                      <span className="text-purple-600">Upsell</span>
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeProduct(p.product_id)}
                    className="text-red-500 hover:text-red-600"
                  >
                    ลบ
                  </button>
                </div>
              ))}
              <div className="text-right text-lg font-bold text-gray-800 pt-2 border-t">
                รวม: ฿{totalIncome.toLocaleString()}
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-500 py-4">
              ยังไม่ได้เลือกสินค้า/บริการ
            </div>
          )}
        </div>

        {/* Appointment & Payment */}
        <div className="card space-y-4">
          <h2 className="font-bold text-gray-800 border-b pb-2">นัดหมายและการชำระเงิน</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">วันนัดหมาย</label>
              <input
                type="date"
                value={appointmentDate}
                onChange={(e) => setAppointmentDate(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">เวลานัดหมาย</label>
              <input
                type="time"
                value={appointmentTime}
                onChange={(e) => setAppointmentTime(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">เงินมัดจำ</label>
              <input
                type="number"
                value={deposit}
                onChange={(e) => setDeposit(e.target.value)}
                className="input"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">วิธีชำระ</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">หมายเหตุ</label>
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
