'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

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
  is_free?: boolean
}

interface OrderItem {
  id: number
  product_id: number
  is_upsell: boolean
  products: { product_code: string; product_name: string; list_price: number } | null
}

export default function EditOrderPage({ params }: { params: { id: string } }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [staff, setStaff] = useState<Staff[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])

  // Order fields
  const [salesId, setSalesId] = useState('')
  const [orderStatus, setOrderStatus] = useState('booking')
  const [note, setNote] = useState('')
  const [customerName, setCustomerName] = useState('')

  // Product selection
  const [productSearch, setProductSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [params.id])

  const fetchData = async () => {
    const [orderRes, itemsRes, staffRes, productsRes] = await Promise.all([
      supabase
        .from('orders')
        .select(`
          *,
          customers (full_name),
          sales:staff!orders_sales_id_fkey (id, staff_name)
        `)
        .eq('id', params.id)
        .single(),
      supabase
        .from('order_items')
        .select(`
          id,
          product_id,
          is_upsell,
          products (product_code, product_name, list_price)
        `)
        .eq('order_id', params.id),
      supabase.from('staff').select('id, staff_name, role').eq('is_active', true).order('staff_name'),
      supabase.from('products').select('id, product_code, product_name, list_price, is_free').eq('is_active', true).order('product_name'),
    ])

    if (orderRes.data) {
      setSalesId(orderRes.data.sales?.id?.toString() || '')
      setOrderStatus(orderRes.data.order_status || 'booking')
      setNote(orderRes.data.note || '')
      setCustomerName(orderRes.data.customers?.full_name || '')
    }

    setOrderItems(itemsRes.data || [])
    setStaff(staffRes.data || [])
    setProducts(productsRes.data || [])
    setLoading(false)
  }

  const addProduct = async (productId: number) => {
    const product = products.find(p => p.id === productId)
    if (!product) return

    // Check if already added
    if (orderItems.find(i => i.product_id === productId)) {
      alert('สินค้านี้ถูกเลือกไปแล้ว')
      return
    }

    // Insert to database
    const { data, error } = await supabase
      .from('order_items')
      .insert({
        order_id: parseInt(params.id),
        product_id: productId,
        is_upsell: false,
      })
      .select(`
        id,
        product_id,
        is_upsell,
        products (product_code, product_name, list_price)
      `)
      .single()

    if (error) {
      alert(`ไม่สามารถเพิ่มสินค้า: ${error.message}`)
      return
    }

    setOrderItems([...orderItems, data])
    setProductSearch('')
    setShowDropdown(false)

    // Update total
    await updateOrderTotal()
  }

  const removeProduct = async (itemId: number) => {
    const { error } = await supabase.from('order_items').delete().eq('id', itemId)

    if (error) {
      alert(`ไม่สามารถลบสินค้า: ${error.message}`)
      return
    }

    setOrderItems(orderItems.filter(i => i.id !== itemId))

    // Update total
    await updateOrderTotal()
  }

  const toggleUpsell = async (itemId: number, currentUpsell: boolean) => {
    const { error } = await supabase
      .from('order_items')
      .update({ is_upsell: !currentUpsell })
      .eq('id', itemId)

    if (error) {
      alert(`ไม่สามารถอัพเดท: ${error.message}`)
      return
    }

    setOrderItems(orderItems.map(i =>
      i.id === itemId ? { ...i, is_upsell: !currentUpsell } : i
    ))
  }

  const updateOrderTotal = async () => {
    // Recalculate total from current items
    const { data: items } = await supabase
      .from('order_items')
      .select('products (list_price)')
      .eq('order_id', params.id)

    const total = items?.reduce((sum, i) => sum + ((i.products as { list_price: number } | null)?.list_price || 0), 0) || 0

    await supabase
      .from('orders')
      .update({ total_income: total })
      .eq('id', params.id)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    const { error } = await supabase
      .from('orders')
      .update({
        sales_id: salesId ? parseInt(salesId) : null,
        order_status: orderStatus,
        note: note || null,
      })
      .eq('id', params.id)

    if (error) {
      alert(`ไม่สามารถบันทึก: ${error.message}`)
      setSaving(false)
      return
    }

    await updateOrderTotal()
    router.push(`/orders/${params.id}`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500 dark:text-gray-400">กำลังโหลด...</div>
      </div>
    )
  }

  const salesStaff = staff.filter(s => s.role === 'sales' || s.role === 'admin')
  const availableProducts = products.filter(p => !orderItems.some(i => i.product_id === p.id))
  const filteredProducts = availableProducts.filter(p => {
    if (!productSearch.trim()) return true
    const search = productSearch.toLowerCase()
    return (
      p.product_name.toLowerCase().includes(search) ||
      p.product_code.toLowerCase().includes(search)
    )
  })

  const totalIncome = orderItems.reduce((sum, i) => sum + (i.products?.list_price || 0), 0)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/orders/${params.id}`} className="btn btn-secondary">
          ← กลับ
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">แก้ไขออเดอร์ #{params.id}</h1>
          <p className="text-gray-500 dark:text-gray-400">ลูกค้า: {customerName}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Status & Staff */}
        <div className="card space-y-4">
          <h2 className="font-bold text-gray-800 dark:text-white border-b pb-2">ข้อมูลออเดอร์</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">สถานะ</label>
              <select
                value={orderStatus}
                onChange={(e) => setOrderStatus(e.target.value)}
                className="select"
              >
                <option value="booking">จอง</option>
                <option value="paid">ชำระแล้ว</option>
                <option value="done">เสร็จสิ้น</option>
                <option value="cancelled">ยกเลิก</option>
              </select>
            </div>
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

        {/* Products */}
        <div className="card space-y-4">
          <h2 className="font-bold text-gray-800 dark:text-white border-b pb-2">สินค้า/บริการ</h2>

          {/* Add Product */}
          <div className="relative">
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

            {showDropdown && filteredProducts.length > 0 && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowDropdown(false)} />
                <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {filteredProducts.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => addProduct(p.id)}
                      className="w-full px-4 py-3 text-left hover:bg-pink-50 dark:hover:bg-gray-700 flex justify-between items-center border-b dark:border-gray-700 last:border-b-0"
                    >
                      <div>
                        <span className="text-xs text-pink-500 font-mono mr-2">[{p.product_code}]</span>
                        <span className="font-medium dark:text-white">{p.product_name}</span>
                      </div>
                      <span className="text-pink-500 font-medium">
                        {p.is_free || p.list_price === 0 ? 'ฟรี' : `฿${p.list_price.toLocaleString()}`}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Current Items */}
          {orderItems.length > 0 ? (
            <div className="space-y-2">
              {orderItems.map(item => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xs text-pink-500 font-mono">[{item.products?.product_code}]</span>
                    <span className="font-medium dark:text-white">{item.products?.product_name}</span>
                    <span className="text-gray-500 dark:text-gray-400">฿{item.products?.list_price?.toLocaleString()}</span>
                    <label className="flex items-center gap-1 text-sm">
                      <input
                        type="checkbox"
                        checked={item.is_upsell}
                        onChange={() => toggleUpsell(item.id, item.is_upsell)}
                        className="rounded"
                      />
                      <span className="text-purple-600 dark:text-purple-400">Upsell</span>
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeProduct(item.id)}
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
              ยังไม่มีสินค้า/บริการ
            </div>
          )}
        </div>

        {/* Submit */}
        <div className="flex gap-4">
          <Link href={`/orders/${params.id}`} className="btn btn-secondary flex-1 text-center">
            ยกเลิก
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary flex-1"
          >
            {saving ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
          </button>
        </div>
      </form>
    </div>
  )
}
