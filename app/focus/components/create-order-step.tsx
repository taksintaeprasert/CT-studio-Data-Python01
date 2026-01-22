'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/user-context'
import type { Customer, Product } from '@/lib/supabase/types'
import Image from 'next/image'

interface CreateOrderStepProps {
  onOrderCreated: (orderId: number) => void
}

interface CustomerForm {
  phone: string
  full_name: string
  nickname: string
  age: string
  contact_channel: string
}

interface SelectedProduct {
  product: Product
  price: number
}

export default function CreateOrderStep({ onOrderCreated }: CreateOrderStepProps) {
  const supabase = createClient()
  const { user } = useUser()

  // Customer state
  const [searchPhone, setSearchPhone] = useState('')
  const [foundCustomer, setFoundCustomer] = useState<Customer | null>(null)
  const [customerForm, setCustomerForm] = useState<CustomerForm>({
    phone: '',
    full_name: '',
    nickname: '',
    age: '',
    contact_channel: 'line',
  })
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string>('')

  // Order state
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([])
  const [deposit, setDeposit] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')

  // Product search & suggestion state
  const [productSearch, setProductSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [suggestedProduct, setSuggestedProduct] = useState<Product | null>(null)
  const [missingFreeProduct, setMissingFreeProduct] = useState<string | null>(null)

  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)

  // Load active products
  useEffect(() => {
    loadProducts()
  }, [])

  const loadProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('product_name')

    if (data) setProducts(data)
  }

  const handlePhoneSearch = async () => {
    if (!searchPhone.trim()) return

    setSearching(true)
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('phone', searchPhone.trim())
      .single()

    setSearching(false)

    if (data) {
      setFoundCustomer(data)
      setCustomerForm({
        phone: data.phone || '',
        full_name: data.full_name,
        nickname: data.nickname || '',
        age: data.age?.toString() || '',
        contact_channel: data.contact_channel || 'line',
      })
    } else {
      setFoundCustomer(null)
      setCustomerForm({
        ...customerForm,
        phone: searchPhone.trim(),
      })
    }
  }

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setPhotoFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  // Extract price code from product code (e.g., "10900" from "LIP10900")
  const extractPriceCode = (productCode: string): string | null => {
    const match = productCode.match(/(\d+)$/)
    return match ? match[1] : null
  }

  // Extract all digits from product code (for FREE products)
  const extractAllDigits = (productCode: string): string | null => {
    const match = productCode.match(/(\d+)/)
    return match ? match[1] : null
  }

  // Extract base code (letters at the start)
  const extractBaseCode = (productCode: string): string => {
    const match = productCode.toUpperCase().match(/^([A-Z]+?)(?:FREE|\d)/)
    return match ? match[1] : productCode.replace(/[\dFREE]+/gi, '')
  }

  // Find related free product by matching base code and price code
  const findRelatedFreeProduct = (product: Product): { found: Product | null; suggestedCode: string | null } => {
    const priceCode = extractPriceCode(product.product_code)
    if (!priceCode) {
      return { found: null, suggestedCode: null }
    }

    const baseCode = extractBaseCode(product.product_code)

    // Look for free product with same base code and price code
    const relatedFree = products.find(p => {
      if (p.id === product.id) return false
      if (!p.is_free && p.list_price !== 0) return false
      if (selectedProducts.some(sp => sp.product.id === p.id)) return false

      const pCode = p.product_code.toUpperCase()
      const freePriceCode = extractAllDigits(p.product_code)
      const freeBaseCode = extractBaseCode(p.product_code)

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

  const addProductById = (productId: number) => {
    const product = products.find(p => p.id === productId)
    if (!product) return

    if (selectedProducts.find(p => p.product.id === product.id)) {
      alert('บริการนี้ถูกเลือกไปแล้ว')
      return
    }

    setSelectedProducts([...selectedProducts, { product, price: product.list_price }])

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
    setShowDropdown(false)
  }

  const addSuggestedProduct = () => {
    if (!suggestedProduct) return
    setSelectedProducts([...selectedProducts, { product: suggestedProduct, price: suggestedProduct.list_price }])
    setSuggestedProduct(null)
  }

  const dismissSuggestion = () => {
    setSuggestedProduct(null)
    setMissingFreeProduct(null)
  }

  const removeProduct = (productId: number) => {
    setSelectedProducts(selectedProducts.filter(p => p.product.id !== productId))
  }

  const updateProductPrice = (productId: number, price: number) => {
    setSelectedProducts(selectedProducts.map(p =>
      p.product.id === productId ? { ...p, price } : p
    ))
  }

  const calculateTotal = () => {
    return selectedProducts.reduce((sum, p) => sum + p.price, 0)
  }

  const handleSubmit = async () => {
    // Validation
    if (!customerForm.full_name.trim()) {
      alert('กรุณากรอกชื่อลูกค้า')
      return
    }

    if (!customerForm.phone.trim()) {
      alert('กรุณากรอกเบอร์โทรศัพท์')
      return
    }

    if (selectedProducts.length === 0) {
      alert('กรุณาเลือกบริการอย่างน้อย 1 รายการ')
      return
    }

    setLoading(true)

    try {
      // 1. Create or update customer
      let customerId = foundCustomer?.id

      if (foundCustomer) {
        // Update existing customer
        await supabase
          .from('customers')
          .update({
            full_name: customerForm.full_name,
            nickname: customerForm.nickname || null,
            age: customerForm.age ? parseInt(customerForm.age) : null,
            contact_channel: customerForm.contact_channel,
          })
          .eq('id', foundCustomer.id)
      } else {
        // Create new customer
        const { data: newCustomer, error: customerError } = await supabase
          .from('customers')
          .insert({
            phone: customerForm.phone,
            full_name: customerForm.full_name,
            nickname: customerForm.nickname || null,
            age: customerForm.age ? parseInt(customerForm.age) : null,
            contact_channel: customerForm.contact_channel,
          })
          .select()
          .single()

        if (customerError) throw customerError
        customerId = newCustomer.id
      }

      // 2. Create order
      const totalIncome = calculateTotal()
      const depositAmount = deposit ? parseFloat(deposit) : 0

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_id: customerId,
          sales_id: user?.id, // Auto-assign to current sales
          total_income: totalIncome,
          deposit: depositAmount,
          payment_method: paymentMethod,
          order_status: 'booking',
        })
        .select()
        .single()

      if (orderError) throw orderError

      // 3. Create order items
      const orderItems = selectedProducts.map(p => ({
        order_id: order.id,
        product_id: p.product.id,
        item_price: p.price,
        item_status: 'pending',
      }))

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems)

      if (itemsError) throw itemsError

      // 4. Record payment if deposit > 0
      if (depositAmount > 0) {
        await supabase
          .from('payments')
          .insert({
            order_id: order.id,
            amount: depositAmount,
            payment_method: paymentMethod,
            note: 'มัดจำ',
          })
      }

      // Success!
      alert(`✅ สร้าง Order #${order.id} สำเร็จ!`)
      onOrderCreated(order.id)
    } catch (error) {
      console.error('Error creating order:', error)
      alert('เกิดข้อผิดพลาด: ' + (error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Customer Section */}
      <div className="card p-6">
        <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4">
          1. ข้อมูลลูกค้า
        </h2>

        {/* Phone Search */}
        <div className="flex gap-2 mb-4">
          <input
            type="tel"
            placeholder="ค้นหาจากเบอร์โทร"
            value={searchPhone}
            onChange={(e) => setSearchPhone(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handlePhoneSearch()}
            className="input flex-1"
          />
          <button
            onClick={handlePhoneSearch}
            disabled={searching}
            className="btn-primary whitespace-nowrap"
          >
            {searching ? 'กำลังค้นหา...' : '🔍 ค้นหา'}
          </button>
        </div>

        {foundCustomer && (
          <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <p className="text-sm text-green-700 dark:text-green-400">
              ✅ พบลูกค้าในระบบ: <strong>{foundCustomer.full_name}</strong>
            </p>
          </div>
        )}

        {/* Customer Form */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">เบอร์โทร *</label>
            <input
              type="tel"
              value={customerForm.phone}
              onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
              className="input"
              required
            />
          </div>

          <div>
            <label className="label">ชื่อ-นามสกุล *</label>
            <input
              type="text"
              value={customerForm.full_name}
              onChange={(e) => setCustomerForm({ ...customerForm, full_name: e.target.value })}
              className="input"
              required
            />
          </div>

          <div>
            <label className="label">ชื่อเล่น</label>
            <input
              type="text"
              value={customerForm.nickname}
              onChange={(e) => setCustomerForm({ ...customerForm, nickname: e.target.value })}
              className="input"
            />
          </div>

          <div>
            <label className="label">อายุ</label>
            <input
              type="number"
              value={customerForm.age}
              onChange={(e) => setCustomerForm({ ...customerForm, age: e.target.value })}
              className="input"
            />
          </div>

          <div className="md:col-span-2">
            <label className="label">ช่องทางการติดต่อ</label>
            <select
              value={customerForm.contact_channel}
              onChange={(e) => setCustomerForm({ ...customerForm, contact_channel: e.target.value })}
              className="input"
            >
              <option value="line">LINE</option>
              <option value="facebook">Facebook</option>
              <option value="instagram">Instagram</option>
              <option value="phone">โทรศัพท์</option>
              <option value="walk-in">Walk-in</option>
            </select>
          </div>

          {/* Photo Upload */}
          <div className="md:col-span-2">
            <label className="label">รูปภาพ (Optional)</label>
            <div className="flex items-center gap-4">
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="input flex-1"
              />
              {photoPreview && (
                <div className="relative w-20 h-20">
                  <Image
                    src={photoPreview}
                    alt="Preview"
                    fill
                    className="object-cover rounded-lg"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Products Section */}
      <div className="card p-6">
        <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4">
          2. เลือกบริการ *
        </h2>

        {/* Searchable Product Input */}
        <div className="relative mb-4">
          <div className="relative">
            <input
              type="text"
              value={productSearch}
              onChange={(e) => {
                setProductSearch(e.target.value)
                setShowDropdown(true)
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder="🔍 พิมพ์ค้นหาบริการ..."
              className="input w-full text-lg"
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

          {/* Dropdown Results */}
          {showDropdown && (() => {
            const availableProducts = products.filter(p => !selectedProducts.some(sp => sp.product.id === p.id))
            const filteredProducts = availableProducts.filter(p => {
              if (!productSearch.trim()) return true
              const search = productSearch.toLowerCase()
              return (
                p.product_name.toLowerCase().includes(search) ||
                p.product_code.toLowerCase().includes(search) ||
                (p.category && p.category.toLowerCase().includes(search))
              )
            })

            return filteredProducts.length > 0 ? (
              <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-2xl max-h-60 overflow-y-auto">
                {filteredProducts.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addProductById(p.id)}
                    className="w-full px-4 py-3 text-left hover:bg-pink-50 dark:hover:bg-gray-700 flex justify-between items-center border-b dark:border-gray-700 last:border-b-0"
                  >
                    <div>
                      <span className="text-xs text-pink-500 font-mono mr-2">[{p.product_code}]</span>
                      <span className="font-medium dark:text-white">{p.product_name}</span>
                      {p.is_free && <span className="ml-2 text-xs text-green-500">ฟรี</span>}
                    </div>
                    <span className="text-pink-500 font-bold">
                      {p.is_free || p.list_price === 0 ? 'ฟรี' : `฿${p.list_price.toLocaleString()}`}
                    </span>
                  </button>
                ))}
              </div>
            ) : productSearch ? (
              <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-lg p-4 text-center text-gray-500">
                ไม่พบบริการที่ค้นหา
              </div>
            ) : null
          })()}

          {/* Click outside to close dropdown */}
          {showDropdown && (
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowDropdown(false)}
            />
          )}
        </div>

        {/* Suggestion Banner - Found Free Product */}
        {suggestedProduct && (
          <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-center justify-between mb-4">
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
                className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 shadow-lg"
              >
                + เพิ่ม
              </button>
              <button
                type="button"
                onClick={dismissSuggestion}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-300"
              >
                ไม่ใช้
              </button>
            </div>
          </div>
        )}

        {/* Suggestion Banner - Missing Free Product */}
        {missingFreeProduct && (
          <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 flex items-center justify-between mb-4">
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
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-300"
            >
              ปิด
            </button>
          </div>
        )}

        {/* Selected Products with Price Edit */}
        {selectedProducts.length > 0 ? (
          <div className="space-y-3">
            <h3 className="font-bold text-gray-800 dark:text-white">บริการที่เลือก:</h3>
            {selectedProducts.map((item) => (
              <div key={item.product.id} className="flex items-center gap-3 p-4 bg-gradient-to-r from-pink-50 to-purple-50 dark:from-gray-800 dark:to-gray-700 rounded-xl border border-pink-200 dark:border-gray-600">
                <div className="flex-1">
                  <p className="text-xs text-pink-500 font-mono mb-1">[{item.product.product_code}]</p>
                  <p className="font-medium text-gray-800 dark:text-white">
                    {item.product.product_name}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">ราคา:</span>
                  <input
                    type="number"
                    value={item.price}
                    onChange={(e) => updateProductPrice(item.product.id, parseFloat(e.target.value) || 0)}
                    className="input w-32 text-right font-bold"
                  />
                  <span className="text-sm text-gray-500">บาท</span>
                </div>
                <button
                  type="button"
                  onClick={() => removeProduct(item.product.id)}
                  className="p-2 text-red-500 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}

            <div className="flex justify-end items-center gap-3 pt-4 border-t-2 border-pink-200 dark:border-gray-600">
              <span className="text-lg font-bold text-gray-800 dark:text-white">รวมทั้งหมด:</span>
              <span className="text-3xl font-bold text-pink-600 dark:text-pink-400">
                ฿{calculateTotal().toLocaleString()}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-500 dark:text-gray-400 py-8 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl">
            <svg className="w-12 h-12 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <p>ยังไม่ได้เลือกบริการ</p>
            <p className="text-sm mt-1">ใช้ช่องค้นหาด้านบนเพื่อเลือกบริการ</p>
          </div>
        )}
      </div>

      {/* Payment Section */}
      <div className="card p-6">
        <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4">
          3. การชำระเงิน
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">มัดจำ (บาท)</label>
            <input
              type="number"
              value={deposit}
              onChange={(e) => setDeposit(e.target.value)}
              placeholder="0"
              className="input"
            />
          </div>

          <div>
            <label className="label">วิธีชำระเงิน</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="input"
            >
              <option value="cash">เงินสด</option>
              <option value="credit card">บัตรเครดิต</option>
              <option value="bank transfer">โอนเงิน</option>
              <option value="promptpay">พร้อมเพย์</option>
            </select>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-3">
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="btn-primary px-8 py-4 text-lg"
        >
          {loading ? 'กำลังสร้าง Order...' : '✅ สร้าง Order และไปขั้นตอนถัดไป'}
        </button>
      </div>
    </div>
  )
}
