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

  const toggleProduct = (product: Product) => {
    const exists = selectedProducts.find(p => p.product.id === product.id)
    if (exists) {
      setSelectedProducts(selectedProducts.filter(p => p.product.id !== product.id))
    } else {
      setSelectedProducts([...selectedProducts, { product, price: product.list_price }])
    }
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
          {products.map((product) => {
            const selected = selectedProducts.find(p => p.product.id === product.id)
            return (
              <button
                key={product.id}
                onClick={() => toggleProduct(product)}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  selected
                    ? 'border-pink-500 bg-pink-50 dark:bg-pink-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-pink-300'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <p className="font-medium text-gray-800 dark:text-white text-sm">
                      {product.product_name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {product.product_code}
                    </p>
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                    selected ? 'border-pink-500 bg-pink-500' : 'border-gray-300'
                  }`}>
                    {selected && (
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>
                <p className="text-lg font-bold text-pink-600 dark:text-pink-400">
                  ฿{product.list_price.toLocaleString()}
                </p>
              </button>
            )
          })}
        </div>

        {/* Selected Products with Price Edit */}
        {selectedProducts.length > 0 && (
          <div className="mt-6 space-y-3">
            <h3 className="font-bold text-gray-800 dark:text-white">บริการที่เลือก:</h3>
            {selectedProducts.map((item) => (
              <div key={item.product.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex-1">
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
                    className="input w-32 text-right"
                  />
                  <span className="text-sm text-gray-500">บาท</span>
                </div>
                <button
                  onClick={() => toggleProduct(item.product)}
                  className="text-red-500 hover:text-red-700"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}

            <div className="flex justify-end items-center gap-3 pt-3 border-t dark:border-gray-700">
              <span className="text-lg font-bold text-gray-800 dark:text-white">รวม:</span>
              <span className="text-2xl font-bold text-pink-600 dark:text-pink-400">
                ฿{calculateTotal().toLocaleString()}
              </span>
            </div>
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
