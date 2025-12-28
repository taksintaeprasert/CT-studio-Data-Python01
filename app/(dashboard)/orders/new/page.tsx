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
  is_free?: boolean
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
  const [deposit, setDeposit] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('โอนเงิน')
  const [note, setNote] = useState('')
  const [orderType, setOrderType] = useState<'booking' | 'paid'>('booking') // จอง / ชำระแล้ว
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([])
  const [selectedProductId, setSelectedProductId] = useState('')

  // Search & Suggest
  const [productSearch, setProductSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [suggestedProduct, setSuggestedProduct] = useState<Product | null>(null)

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const [customersRes, staffRes, productsRes] = await Promise.all([
      supabase.from('customers').select('id, full_name, phone').eq('is_active', true).order('full_name'),
      supabase.from('staff').select('id, staff_name, role').eq('is_active', true).order('staff_name'),
      supabase.from('products').select('id, product_code, product_name, list_price, category, is_free').eq('is_active', true).order('product_name'),
    ])

    console.log('Products loaded:', productsRes.data?.length || 0)
    setCustomers(customersRes.data || [])
    setStaff(staffRes.data || [])
    setProducts(productsRes.data || [])
    setLoading(false)
  }

  // Find related free product (e.g., Eyebrow Tattoo → Eyebrow Touch Up)
  const findRelatedFreeProduct = (product: Product): Product | null => {
    if (!product.category) return null

    // Look for free touch-up or free products in same category
    const relatedFree = products.find(p =>
      p.id !== product.id &&
      p.is_free &&
      p.category === product.category &&
      !selectedProducts.some(sp => sp.product_id === p.id)
    )

    // Or look for "Touch Up" / "Free" products matching the main service
    if (!relatedFree) {
      const mainName = product.product_name.toLowerCase()
      return products.find(p =>
        p.id !== product.id &&
        (p.list_price === 0 || p.is_free) &&
        (p.product_name.toLowerCase().includes('touch up') ||
         p.product_name.toLowerCase().includes('free') ||
         p.product_name.toLowerCase().includes('ฟรี')) &&
        p.product_name.toLowerCase().includes(product.category?.toLowerCase() || '') &&
        !selectedProducts.some(sp => sp.product_id === p.id)
      ) || null
    }

    return relatedFree
  }

  const addProductById = (productId: string) => {
    const product = products.find(p => String(p.id) === productId)
    if (!product) return

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

    // Check for related free product
    const relatedFree = findRelatedFreeProduct(product)
    if (relatedFree) {
      setSuggestedProduct(relatedFree)
    }

    // Clear search
    setProductSearch('')
    setSelectedProductId('')
    setShowDropdown(false)
  }

  const addSuggestedProduct = () => {
    if (!suggestedProduct) return

    const newProduct: SelectedProduct = {
      product_id: suggestedProduct.id,
      product_name: suggestedProduct.product_name,
      price: suggestedProduct.list_price,
      is_upsell: false,
    }
    setSelectedProducts(prev => [...prev, newProduct])
    setSuggestedProduct(null)
  }

  const dismissSuggestion = () => {
    setSuggestedProduct(null)
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
      let finalCustomerId: number | null = null

      // Create new customer if needed
      if (isNewCustomer) {
        const { data: newCustomer, error: customerError } = await supabase
          .from('customers')
          .insert({
            full_name: `${newFirstName.trim()} ${newLastName.trim()}`,
            phone: newPhone || null,
            contact_channel: newContactChannel,
          })
          .select('id')
          .single()

        if (customerError || !newCustomer) {
          console.error('Customer creation error:', customerError)
          alert(`ไม่สามารถสร้างลูกค้าใหม่: ${customerError?.message || 'ไม่ได้รับข้อมูลลูกค้า'}`)
          return
        }
        console.log('New customer created:', newCustomer)
        finalCustomerId = newCustomer.id
      } else {
        // Existing customer - parse ID from string
        finalCustomerId = parseInt(customerId)
        if (isNaN(finalCustomerId)) {
          alert('กรุณาเลือกลูกค้า')
          return
        }
      }

      console.log('Creating order with customer_id:', finalCustomerId)

      // Create order (no appointment date - appointments are per service item)
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_id: finalCustomerId,
          sales_id: salesId ? parseInt(salesId) : null,
          artist_id: artistId ? parseInt(artistId) : null,
          order_status: orderType,
          total_income: totalIncome,
          deposit: parseFloat(deposit) || 0,
          payment_method: paymentMethod,
          note: note || null,
        })
        .select()
        .single()

      if (orderError) {
        console.error('Order creation error:', orderError)
        alert(`ไม่สามารถสร้างออเดอร์: ${orderError.message}`)
        return
      }

      // Create order items
      const orderItems = selectedProducts.map(p => ({
        order_id: order.id,
        product_id: p.product_id,
        is_upsell: p.is_upsell,
      }))

      const { error: itemsError } = await supabase.from('order_items').insert(orderItems)
      if (itemsError) {
        console.error('Order items error:', itemsError)
        alert(`ไม่สามารถเพิ่มรายการสินค้า: ${itemsError.message}`)
        return
      }

      // Create initial payment if deposit > 0
      if (parseFloat(deposit) > 0) {
        const { error: paymentError } = await supabase.from('payments').insert({
          order_id: order.id,
          amount: parseFloat(deposit),
          payment_method: paymentMethod,
          note: 'มัดจำ',
        })
        if (paymentError) {
          console.error('Payment error:', paymentError)
        }
      }

      router.push(`/orders/${order.id}`)
    } catch (error: unknown) {
      console.error('Error creating order:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      alert(`เกิดข้อผิดพลาด: ${errorMessage}`)
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

  // Filter products based on search text
  const filteredProducts = availableProducts.filter(p => {
    if (!productSearch.trim()) return true
    const search = productSearch.toLowerCase()
    return (
      p.product_name.toLowerCase().includes(search) ||
      p.product_code.toLowerCase().includes(search) ||
      (p.category && p.category.toLowerCase().includes(search))
    )
  })

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

        {/* Order Type */}
        <div className="card space-y-4">
          <h2 className="font-bold text-gray-800 dark:text-white border-b pb-2">ประเภทออเดอร์</h2>
          <div className="flex gap-4">
            <label className={`flex-1 cursor-pointer rounded-lg border-2 p-4 transition-all ${
              orderType === 'booking'
                ? 'border-pink-500 bg-pink-50 dark:bg-pink-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-pink-300'
            }`}>
              <input
                type="radio"
                name="orderType"
                value="booking"
                checked={orderType === 'booking'}
                onChange={() => setOrderType('booking')}
                className="sr-only"
              />
              <div className="flex items-center gap-3">
                <span className="text-2xl">📅</span>
                <div>
                  <p className="font-bold text-gray-800 dark:text-white">จอง</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">ลูกค้าจองผ่านออนไลน์</p>
                </div>
              </div>
            </label>
            <label className={`flex-1 cursor-pointer rounded-lg border-2 p-4 transition-all ${
              orderType === 'paid'
                ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-green-300'
            }`}>
              <input
                type="radio"
                name="orderType"
                value="paid"
                checked={orderType === 'paid'}
                onChange={() => setOrderType('paid')}
                className="sr-only"
              />
              <div className="flex items-center gap-3">
                <span className="text-2xl">✅</span>
                <div>
                  <p className="font-bold text-gray-800 dark:text-white">ชำระแล้ว</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">ลูกค้าชำระเงินครบแล้ว</p>
                </div>
              </div>
            </label>
          </div>
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

          {/* Searchable Product Input */}
          <div className="relative">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => {
                    setProductSearch(e.target.value)
                    setShowDropdown(true)
                  }}
                  onFocus={() => setShowDropdown(true)}
                  placeholder={`พิมพ์ค้นหาสินค้า/บริการ... (${availableProducts.length} รายการ)`}
                  className="input w-full"
                />
                {productSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setProductSearch('')
                      setShowDropdown(false)
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Dropdown Results */}
            {showDropdown && filteredProducts.length > 0 && (
              <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {filteredProducts.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addProductById(String(p.id))}
                    className="w-full px-4 py-3 text-left hover:bg-pink-50 dark:hover:bg-gray-700 flex justify-between items-center border-b dark:border-gray-700 last:border-b-0"
                  >
                    <div>
                      <span className="text-xs text-gray-400 mr-2">[{p.category || 'อื่นๆ'}]</span>
                      <span className="font-medium dark:text-white">{p.product_name}</span>
                      {p.is_free && <span className="ml-2 text-xs text-green-500">ฟรี</span>}
                    </div>
                    <span className="text-pink-500 font-medium">
                      {p.is_free || p.list_price === 0 ? 'ฟรี' : `฿${p.list_price.toLocaleString()}`}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {showDropdown && productSearch && filteredProducts.length === 0 && (
              <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-lg p-4 text-center text-gray-500">
                ไม่พบสินค้าที่ค้นหา
              </div>
            )}
          </div>

          {/* Click outside to close dropdown */}
          {showDropdown && (
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowDropdown(false)}
            />
          )}

          {/* Suggestion Banner */}
          {suggestedProduct && (
            <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">💡</span>
                <div>
                  <p className="text-sm text-green-800 dark:text-green-300 font-medium">
                    แนะนำเพิ่ม: {suggestedProduct.product_name}
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400">
                    {suggestedProduct.is_free || suggestedProduct.list_price === 0 ? 'บริการฟรี' : `฿${suggestedProduct.list_price.toLocaleString()}`}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={addSuggestedProduct}
                  className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600"
                >
                  + เพิ่ม
                </button>
                <button
                  type="button"
                  onClick={dismissSuggestion}
                  className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  ไม่ใช้
                </button>
              </div>
            </div>
          )}

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

        {/* Payment */}
        <div className="card space-y-4">
          <h2 className="font-bold text-gray-800 dark:text-white border-b pb-2">การชำระเงิน</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
