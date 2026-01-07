'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Customer {
  id: number
  full_name: string
  phone: string | null
  contact_channel?: string | null
  province?: string | null
  source_channel?: string | null
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
  product_code: string
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

  // Customer fields (unified - start with phone)
  const [customerId, setCustomerId] = useState<number | null>(null)
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerFirstName, setCustomerFirstName] = useState('')
  const [customerLastName, setCustomerLastName] = useState('')
  const [customerContactChannel, setCustomerContactChannel] = useState('line')
  const [customerNickname, setCustomerNickname] = useState('')
  const [customerAge, setCustomerAge] = useState('')
  const [isExistingCustomer, setIsExistingCustomer] = useState(false)

  const [salesId, setSalesId] = useState('')
  const [deposit, setDeposit] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('โอนเงิน')
  const [note, setNote] = useState('')
  const [createdAt, setCreatedAt] = useState(new Date().toISOString().split('T')[0]) // วันที่สร้างออเดอร์
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([])
  const [selectedProductId, setSelectedProductId] = useState('')

  // Search & Suggest
  const [productSearch, setProductSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [suggestedProduct, setSuggestedProduct] = useState<Product | null>(null)
  const [missingFreeProduct, setMissingFreeProduct] = useState<string | null>(null) // เก็บ code ที่แนะนำให้สร้าง

  // Customer search states
  const [customerSearch, setCustomerSearch] = useState('')
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [phoneSuggestions, setPhoneSuggestions] = useState<Customer[]>([])
  const [existingCustomerWarning, setExistingCustomerWarning] = useState<Customer | null>(null)

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const [customersRes, staffRes, productsRes] = await Promise.all([
      supabase.from('customers').select('id, full_name, phone, contact_channel, province, source_channel').eq('is_active', true).order('full_name'),
      supabase.from('staff').select('id, staff_name, role').eq('is_active', true).order('staff_name'),
      supabase.from('products').select('id, product_code, product_name, list_price, category, is_free').eq('is_active', true).order('product_name'),
    ])

    console.log('Products loaded:', productsRes.data?.length || 0)
    setCustomers(customersRes.data || [])
    setStaff(staffRes.data || [])
    setProducts(productsRes.data || [])
    setLoading(false)
  }

  // Search by phone and auto-fill customer data
  const searchByPhone = (phone: string) => {
    setCustomerPhone(phone)

    if (phone.length >= 3) {
      const matches = customers.filter(c =>
        c.phone && c.phone.includes(phone)
      )
      setPhoneSuggestions(matches)
    } else {
      setPhoneSuggestions([])
    }

    // Reset customer selection if phone changes
    if (customerId) {
      const existingCustomer = customers.find(c => c.id === customerId)
      if (existingCustomer?.phone !== phone) {
        setCustomerId(null)
        setIsExistingCustomer(false)
      }
    }
  }

  // Select existing customer and auto-fill all fields
  const selectCustomer = (customer: Customer) => {
    setCustomerId(customer.id)
    setCustomerPhone(customer.phone || '')
    setIsExistingCustomer(true)
    setPhoneSuggestions([])

    // Auto-fill customer data
    const nameParts = customer.full_name.split(' ')
    setCustomerFirstName(nameParts[0] || '')
    setCustomerLastName(nameParts.slice(1).join(' ') || '')
    setCustomerContactChannel(customer.contact_channel || 'line')
    // Note: nickname and age might not be in the customer object from the query
  }

  // Clear customer selection
  const clearCustomer = () => {
    setCustomerId(null)
    setCustomerPhone('')
    setCustomerFirstName('')
    setCustomerLastName('')
    setCustomerContactChannel('line')
    setCustomerNickname('')
    setCustomerAge('')
    setIsExistingCustomer(false)
    setPhoneSuggestions([])
  }

  // Extract price code from product code (e.g., "10900" from "LIP10900" or "BROW5900")
  const extractPriceCode = (productCode: string): string | null => {
    // Match digits at the end of the code (e.g., LIP10900 → 10900, BROW5900 → 5900)
    const match = productCode.match(/(\d+)$/)
    return match ? match[1] : null
  }

  // Extract all digits from product code (for FREE products that have digits in middle)
  // e.g., LIP9900FREE → 9900, LIPFREE6900 → 6900
  const extractAllDigits = (productCode: string): string | null => {
    const match = productCode.match(/(\d+)/)
    return match ? match[1] : null
  }

  // Extract base code (letters at the start) from product code
  // e.g., LIP10900 → LIP, LIPFREE6900 → LIP, BROW5900FREE → BROW
  const extractBaseCode = (productCode: string): string => {
    // Get letters at the start, stop at first digit or "FREE"
    const match = productCode.toUpperCase().match(/^([A-Z]+?)(?:FREE|\d)/)
    return match ? match[1] : productCode.replace(/[\dFREE]+/gi, '')
  }

  // Find related free product by matching EXACT base code and EXACT price code
  // e.g., LIP6900 → LIP6900FREE or LIPFREE6900 (must be LIP + 6900)
  const findRelatedFreeProduct = (product: Product): { found: Product | null; suggestedCode: string | null } => {
    const priceCode = extractPriceCode(product.product_code)

    if (!priceCode) {
      return { found: null, suggestedCode: null }
    }

    // Extract base code e.g., "LIP" from "LIP10900"
    const baseCode = extractBaseCode(product.product_code)

    // Look for free product with EXACT same base code AND EXACT same price code
    const relatedFree = products.find(p => {
      if (p.id === product.id) return false
      if (!p.is_free && p.list_price !== 0) return false
      if (selectedProducts.some(sp => sp.product_id === p.id)) return false

      const pCode = p.product_code.toUpperCase()
      const freePriceCode = extractAllDigits(p.product_code)
      const freeBaseCode = extractBaseCode(p.product_code)

      // Must match EXACTLY:
      // 1. Same base code (e.g., LIP = LIP)
      // 2. Same price code (e.g., 6900 = 6900, not 6900 in 16900)
      // 3. Must be a FREE product
      return (
        freeBaseCode === baseCode.toUpperCase() &&
        freePriceCode === priceCode &&
        pCode.includes('FREE')
      )
    })

    if (relatedFree) {
      return { found: relatedFree, suggestedCode: null }
    }

    // No matching free product found - suggest creating one
    const suggestedCode = `${baseCode}${priceCode}FREE`
    return { found: null, suggestedCode }
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
      product_code: product.product_code,
      product_name: product.product_name,
      price: product.list_price,
      is_upsell: false,
    }
    setSelectedProducts(prev => [...prev, newProduct])

    // Clear previous suggestions
    setSuggestedProduct(null)
    setMissingFreeProduct(null)

    // Check for related free product (only for non-free products)
    if (!product.is_free && product.list_price > 0) {
      const { found, suggestedCode } = findRelatedFreeProduct(product)
      if (found) {
        setSuggestedProduct(found)
      } else if (suggestedCode) {
        setMissingFreeProduct(suggestedCode)
      }
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
      product_code: suggestedProduct.product_code,
      product_name: suggestedProduct.product_name,
      price: suggestedProduct.list_price,
      is_upsell: false,
    }
    setSelectedProducts(prev => [...prev, newProduct])
    setSuggestedProduct(null)
  }

  const dismissSuggestion = () => {
    setSuggestedProduct(null)
    setMissingFreeProduct(null)
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
    if (!customerFirstName.trim() || !customerLastName.trim()) {
      alert('กรุณากรอกชื่อและนามสกุลลูกค้า')
      return
    }
    if (!customerPhone.trim()) {
      alert('กรุณากรอกเบอร์โทรลูกค้า')
      return
    }
    if (selectedProducts.length === 0) {
      alert('กรุณาเลือกสินค้า/บริการอย่างน้อย 1 รายการ')
      return
    }

    setSaving(true)

    try {
      let finalCustomerId: number | null = null

      if (isExistingCustomer && customerId) {
        // Use existing customer but update their info if changed
        finalCustomerId = customerId

        // Update customer info
        await supabase
          .from('customers')
          .update({
            full_name: `${customerFirstName.trim()} ${customerLastName.trim()}`,
            phone: customerPhone || null,
            contact_channel: customerContactChannel,
            nickname: customerNickname.trim() || null,
            age: customerAge ? parseInt(customerAge) : null,
          })
          .eq('id', customerId)
      } else {
        // Create new customer
        const { data: newCustomer, error: customerError } = await supabase
          .from('customers')
          .insert({
            full_name: `${customerFirstName.trim()} ${customerLastName.trim()}`,
            phone: customerPhone || null,
            contact_channel: customerContactChannel,
            nickname: customerNickname.trim() || null,
            age: customerAge ? parseInt(customerAge) : null,
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
      }

      console.log('Creating order with customer_id:', finalCustomerId)

      // Create order (no appointment date - appointments are per service item)
      // Artist is assigned per service item in Appointments page, not at order level
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_id: finalCustomerId,
          sales_id: salesId ? parseInt(salesId) : null,
          order_status: 'booking', // Always booking status for new orders
          total_income: totalIncome,
          deposit: parseFloat(deposit) || 0,
          payment_method: paymentMethod,
          note: note || null,
          created_at: `${createdAt}T${new Date().toTimeString().slice(0, 8)}+07:00`, // ใช้วันที่ที่เลือก + เวลาปัจจุบัน (Thailand timezone)
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

      // Send LINE notification (non-blocking)
      try {
        const customerName = `${customerFirstName.trim()} ${customerLastName.trim()}`

        const salesName = salesId
          ? staff.find(s => s.id === parseInt(salesId))?.staff_name || '-'
          : '-'

        await fetch('/api/line-notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'new_order',
            data: {
              orderId: order.id,
              customerName,
              salesName,
              products: selectedProducts.map(p => `[${p.product_code}] ${p.product_name}`),
              totalAmount: totalIncome,
              deposit: parseFloat(deposit) || 0,
              status: 'booking',
            },
          }),
        })
      } catch (notifyError) {
        // Don't fail the order creation if notification fails
        console.error('LINE notification error:', notifyError)
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
        {/* Customer Section - Unified (Phone First) */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between border-b pb-2">
            <h2 className="font-bold text-gray-800 dark:text-white">ข้อมูลลูกค้า</h2>
            {isExistingCustomer && (
              <span className="px-3 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 rounded-full text-sm font-medium">
                ลูกค้าเก่า
              </span>
            )}
            {customerId && (
              <button
                type="button"
                onClick={clearCustomer}
                className="text-sm text-gray-500 hover:text-red-500"
              >
                ล้างข้อมูล
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Phone Number - First Field */}
            <div className="md:col-span-2 relative">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                เบอร์โทร <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => searchByPhone(e.target.value)}
                className={`input w-full text-lg ${isExistingCustomer ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : ''}`}
                placeholder="กรอกเบอร์โทร เพื่อค้นหาลูกค้า..."
              />

              {/* Phone suggestions dropdown */}
              {phoneSuggestions.length > 0 && !isExistingCustomer && (
                <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  <div className="p-2 text-xs text-gray-500 border-b dark:border-gray-700 bg-yellow-50 dark:bg-yellow-900/20">
                    🔍 พบลูกค้าในระบบ - กดเพื่อเลือก:
                  </div>
                  {phoneSuggestions.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selectCustomer(c)}
                      className="w-full px-4 py-3 text-left hover:bg-pink-50 dark:hover:bg-gray-700 border-b dark:border-gray-700 last:border-b-0"
                    >
                      <span className="font-medium dark:text-white">{c.full_name}</span>
                      <span className="text-gray-500 dark:text-gray-400 ml-2">({c.phone})</span>
                      {c.contact_channel && (
                        <span className="text-xs text-gray-400 ml-2">[{c.contact_channel}]</span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {isExistingCustomer && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                  ✓ ลูกค้าเก่า - สามารถแก้ไขข้อมูลได้
                </p>
              )}
            </div>

            {/* First Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                ชื่อ <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={customerFirstName}
                onChange={(e) => setCustomerFirstName(e.target.value)}
                className="input"
                placeholder="ชื่อ"
              />
            </div>

            {/* Last Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                นามสกุล <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={customerLastName}
                onChange={(e) => setCustomerLastName(e.target.value)}
                className="input"
                placeholder="นามสกุล"
              />
            </div>

            {/* Contact Channel */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                ช่องทางการติดต่อ
              </label>
              <select
                value={customerContactChannel}
                onChange={(e) => setCustomerContactChannel(e.target.value)}
                className="select"
              >
                <option value="line">line</option>
                <option value="facebook">facebook</option>
                <option value="instagram">instagram</option>
                <option value="tiktok">tiktok</option>
                <option value="call">call</option>
                <option value="walk-in">walk-in</option>
              </select>
            </div>

            {/* Nickname (optional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                ชื่อเล่น
              </label>
              <input
                type="text"
                value={customerNickname}
                onChange={(e) => setCustomerNickname(e.target.value)}
                className="input"
                placeholder="ชื่อเล่น (ไม่บังคับ)"
              />
            </div>

            {/* Age (optional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                อายุ
              </label>
              <input
                type="number"
                value={customerAge}
                onChange={(e) => setCustomerAge(e.target.value)}
                className="input"
                placeholder="อายุ (ไม่บังคับ)"
                min="1"
                max="120"
              />
            </div>
          </div>
        </div>

        {/* Order Date */}
        <div className="card space-y-4">
          <h2 className="font-bold text-gray-800 dark:text-white border-b pb-2">วันที่สร้างออเดอร์</h2>
          <div>
            <input
              type="date"
              value={createdAt}
              onChange={(e) => setCreatedAt(e.target.value)}
              className="input w-full sm:w-auto"
            />
            <p className="text-xs text-gray-400 mt-1">* ปรับได้กรณีลืมสร้างออเดอร์ย้อนหลัง</p>
          </div>
        </div>

        {/* Staff Assignment */}
        <div className="card space-y-4">
          <h2 className="font-bold text-gray-800 dark:text-white border-b pb-2">พนักงานรับผิดชอบ</h2>
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
            <p className="text-xs text-gray-400 mt-2">* Artist จะเลือกแยกตามบริการในหน้านัดหมาย</p>
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
                      <span className="text-xs text-pink-500 font-mono mr-2">[{p.product_code}]</span>
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

          {/* Suggestion Banner - Found Free Product */}
          {suggestedProduct && (
            <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">💡</span>
                <div>
                  <p className="text-sm text-green-800 dark:text-green-300 font-medium">
                    แนะนำเพิ่ม: [{suggestedProduct.product_code}] {suggestedProduct.product_name}
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

          {/* Suggestion Banner - Missing Free Product (need to create) */}
          {missingFreeProduct && (
            <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">⚠️</span>
                <div>
                  <p className="text-sm text-yellow-800 dark:text-yellow-300 font-medium">
                    ไม่พบบริการฟรีที่ตรงกัน
                  </p>
                  <p className="text-xs text-yellow-600 dark:text-yellow-400">
                    แนะนำให้สร้างสินค้า: <span className="font-mono font-bold">{missingFreeProduct}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={dismissSuggestion}
                className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                ปิด
              </button>
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
                    <span className="text-xs text-pink-500 font-mono">[{p.product_code}]</span>
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
