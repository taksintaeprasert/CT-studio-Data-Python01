'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Customer {
  id: number
  full_name: string
  phone: string | null
  contact_channel: string | null
}

interface OrderItem {
  id: number
  order_id: number
  product_id: number
  is_upsell: boolean
  appointment_date: string | null
  appointment_time: string | null
  item_status: 'pending' | 'scheduled' | 'completed' | 'cancelled'
  product: {
    product_name: string
    product_code: string
    is_free: boolean
  }
}

interface Order {
  id: number
  customer_id: number
  order_date: string
  order_status: 'booking' | 'paid' | 'done' | 'cancelled'
  total_income: number
  deposit: number
  payment_method: string | null
  note: string | null
  sales: { staff_name: string } | null
  artist: { staff_name: string } | null
  order_items: OrderItem[]
}

export default function CustomerServicePage() {
  const [searchPhone, setSearchPhone] = useState('')
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  // Edit states
  const [editingItem, setEditingItem] = useState<OrderItem | null>(null)
  const [editDate, setEditDate] = useState('')
  const [editTime, setEditTime] = useState('')
  const [editStatus, setEditStatus] = useState<OrderItem['item_status']>('pending')

  const supabase = createClient()

  const searchCustomer = async () => {
    if (!searchPhone.trim()) {
      alert('กรุณากรอกเบอร์โทรศัพท์')
      return
    }

    setLoading(true)
    setSearched(true)

    // Search customer by phone
    const { data: customerData } = await supabase
      .from('customers')
      .select('*')
      .ilike('phone', `%${searchPhone.trim()}%`)
      .eq('is_active', true)
      .single()

    if (!customerData) {
      setCustomer(null)
      setOrders([])
      setLoading(false)
      return
    }

    setCustomer(customerData)

    // Fetch orders with items
    const { data: ordersData } = await supabase
      .from('orders')
      .select(`
        *,
        sales:staff!orders_sales_id_fkey(staff_name),
        artist:staff!orders_artist_id_fkey(staff_name),
        order_items(
          *,
          product:products(product_name, product_code, is_free)
        )
      `)
      .eq('customer_id', customerData.id)
      .order('created_at', { ascending: false })

    setOrders(ordersData || [])
    setLoading(false)
  }

  const updateOrderStatus = async (orderId: number, newStatus: Order['order_status']) => {
    const { error } = await supabase
      .from('orders')
      .update({ order_status: newStatus })
      .eq('id', orderId)

    if (error) {
      alert(`เกิดข้อผิดพลาด: ${error.message}`)
      return
    }

    // Refresh data
    setOrders(orders.map(o =>
      o.id === orderId ? { ...o, order_status: newStatus } : o
    ))
  }

  const openItemEdit = (item: OrderItem) => {
    setEditingItem(item)
    setEditDate(item.appointment_date || '')
    setEditTime(item.appointment_time || '')
    setEditStatus(item.item_status)
  }

  const saveItemEdit = async () => {
    if (!editingItem) return

    const { error } = await supabase
      .from('order_items')
      .update({
        appointment_date: editDate || null,
        appointment_time: editTime || null,
        item_status: editStatus,
      })
      .eq('id', editingItem.id)

    if (error) {
      alert(`เกิดข้อผิดพลาด: ${error.message}`)
      return
    }

    // Update local state
    setOrders(orders.map(order => ({
      ...order,
      order_items: order.order_items.map(item =>
        item.id === editingItem.id
          ? { ...item, appointment_date: editDate || null, appointment_time: editTime || null, item_status: editStatus }
          : item
      )
    })))

    setEditingItem(null)
  }

  const getOrderStatusBadge = (status: Order['order_status']) => {
    switch (status) {
      case 'booking':
        return <span className="px-3 py-1.5 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300 rounded-full text-sm font-medium">📅 จอง</span>
      case 'paid':
        return <span className="px-3 py-1.5 bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 rounded-full text-sm font-medium">✅ ชำระแล้ว</span>
      case 'done':
        return <span className="px-3 py-1.5 bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 rounded-full text-sm font-medium">🎉 เสร็จสิ้น</span>
      case 'cancelled':
        return <span className="px-3 py-1.5 bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300 rounded-full text-sm font-medium">❌ ยกเลิก</span>
    }
  }

  const getItemStatusBadge = (status: OrderItem['item_status']) => {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-1 bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded text-xs">⏳ ยังไม่ได้นัดหมาย</span>
      case 'scheduled':
        return <span className="px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 rounded text-xs">📅 นัดหมายแล้ว</span>
      case 'completed':
        return <span className="px-2 py-1 bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 rounded text-xs">✅ เข้ารับบริการแล้ว</span>
      case 'cancelled':
        return <span className="px-2 py-1 bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 rounded text-xs">❌ ยกเลิก</span>
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">บริการของลูกค้า</h1>
        <p className="text-gray-500 dark:text-gray-400">ค้นหาและจัดการบริการของลูกค้า</p>
      </div>

      {/* Search Box */}
      <div className="card">
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              ค้นหาด้วยเบอร์โทรศัพท์
            </label>
            <input
              type="tel"
              value={searchPhone}
              onChange={(e) => setSearchPhone(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchCustomer()}
              placeholder="0xx-xxx-xxxx"
              className="input w-full"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={searchCustomer}
              disabled={loading}
              className="btn btn-primary h-[42px]"
            >
              {loading ? 'กำลังค้นหา...' : '🔍 ค้นหา'}
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      {searched && !loading && (
        <>
          {!customer ? (
            <div className="card text-center py-12">
              <p className="text-gray-500 dark:text-gray-400 text-lg">ไม่พบลูกค้าที่มีเบอร์ "{searchPhone}"</p>
            </div>
          ) : (
            <>
              {/* Customer Info */}
              <div className="card bg-gradient-to-r from-pink-50 to-purple-50 dark:from-pink-900/20 dark:to-purple-900/20 border-pink-200 dark:border-pink-800">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-pink-500 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                    {customer.full_name.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white">{customer.full_name}</h2>
                    <p className="text-gray-500 dark:text-gray-400">📞 {customer.phone || '-'}</p>
                    <p className="text-sm text-gray-400 dark:text-gray-500">ช่องทาง: {customer.contact_channel || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Orders */}
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-gray-800 dark:text-white">
                  ออเดอร์ทั้งหมด ({orders.length} รายการ)
                </h3>

                {orders.length === 0 ? (
                  <div className="card text-center py-8">
                    <p className="text-gray-500 dark:text-gray-400">ยังไม่มีออเดอร์</p>
                  </div>
                ) : (
                  orders.map(order => (
                    <div key={order.id} className="card space-y-4">
                      {/* Order Header */}
                      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b dark:border-gray-700">
                        <div className="flex items-center gap-4">
                          <span className="text-lg font-bold text-gray-800 dark:text-white">
                            Order #{order.id}
                          </span>
                          {getOrderStatusBadge(order.order_status)}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {formatDate(order.order_date)}
                          </span>
                          {order.order_status === 'booking' && (
                            <button
                              onClick={() => updateOrderStatus(order.id, 'paid')}
                              className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600"
                            >
                              ✅ ชำระแล้ว
                            </button>
                          )}
                          {order.order_status === 'paid' && (
                            <button
                              onClick={() => updateOrderStatus(order.id, 'done')}
                              className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600"
                            >
                              🎉 เสร็จสิ้น
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Order Info */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">ยอดรวม</p>
                          <p className="font-bold text-lg text-pink-600">฿{order.total_income.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">มัดจำ</p>
                          <p className="font-medium dark:text-white">฿{order.deposit.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">คงเหลือ</p>
                          <p className="font-medium text-orange-600">฿{(order.total_income - order.deposit).toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">วิธีชำระ</p>
                          <p className="font-medium dark:text-white">{order.payment_method || '-'}</p>
                        </div>
                      </div>

                      {/* Services/Items */}
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">บริการ:</p>
                        {order.order_items.map(item => (
                          <div
                            key={item.id}
                            className="flex flex-wrap items-center justify-between gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              <div>
                                <p className="font-medium dark:text-white">
                                  {item.product?.product_name || 'Unknown'}
                                  {item.product?.is_free && <span className="ml-2 text-xs text-green-500">ฟรี</span>}
                                  {item.is_upsell && <span className="ml-2 text-xs text-purple-500">Upsell</span>}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  {getItemStatusBadge(item.item_status)}
                                  {item.appointment_date && (
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                      📅 {formatDate(item.appointment_date)} {item.appointment_time || ''}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => openItemEdit(item)}
                              className="px-3 py-1.5 bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-300 rounded-lg text-sm font-medium hover:bg-pink-200 dark:hover:bg-pink-900"
                            >
                              จัดการ
                            </button>
                          </div>
                        ))}
                      </div>

                      {order.note && (
                        <div className="text-sm text-gray-500 dark:text-gray-400 pt-2 border-t dark:border-gray-700">
                          📝 {order.note}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* Item Edit Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white">
              จัดการบริการ: {editingItem.product?.product_name}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  สถานะบริการ
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as OrderItem['item_status'])}
                  className="select w-full"
                >
                  <option value="pending">⏳ ยังไม่ได้นัดหมาย</option>
                  <option value="scheduled">📅 นัดหมายแล้ว</option>
                  <option value="completed">✅ เข้ารับบริการแล้ว</option>
                  <option value="cancelled">❌ ยกเลิก</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    วันนัดหมาย
                  </label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    เวลา
                  </label>
                  <input
                    type="time"
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
                    className="input w-full"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setEditingItem(null)}
                className="btn btn-secondary flex-1"
              >
                ยกเลิก
              </button>
              <button
                onClick={saveItemEdit}
                className="btn btn-primary flex-1"
              >
                บันทึก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
