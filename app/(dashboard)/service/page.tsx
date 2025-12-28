'use client'

import { useState } from 'react'
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
  const [searchQuery, setSearchQuery] = useState('')
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  // Selected order for detail view
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)

  // Payment modal
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('โอนเงิน')

  // Item edit modal
  const [editingItem, setEditingItem] = useState<OrderItem | null>(null)
  const [editDate, setEditDate] = useState('')
  const [editTime, setEditTime] = useState('')
  const [editStatus, setEditStatus] = useState<OrderItem['item_status']>('pending')

  const supabase = createClient()

  const searchCustomer = async () => {
    if (!searchQuery.trim()) {
      alert('กรุณากรอกชื่อหรือเบอร์โทรศัพท์')
      return
    }

    setLoading(true)
    setSearched(true)
    setSelectedOrder(null)

    // Search customer by phone OR name
    const { data: customerData } = await supabase
      .from('customers')
      .select('*')
      .eq('is_active', true)
      .or(`phone.ilike.%${searchQuery.trim()}%,full_name.ilike.%${searchQuery.trim()}%`)
      .limit(1)
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

  const refreshOrders = async () => {
    if (!customer) return

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
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false })

    setOrders(ordersData || [])

    // Update selected order if exists
    if (selectedOrder) {
      const updated = ordersData?.find(o => o.id === selectedOrder.id)
      if (updated) setSelectedOrder(updated)
    }
  }

  const openPaymentModal = () => {
    if (!selectedOrder) return
    const remaining = selectedOrder.total_income - selectedOrder.deposit
    setPaymentAmount(remaining.toString())
    setShowPaymentModal(true)
  }

  const processPayment = async () => {
    if (!selectedOrder) return

    const amount = parseFloat(paymentAmount)
    if (isNaN(amount) || amount <= 0) {
      alert('กรุณากรอกจำนวนเงินที่ถูกต้อง')
      return
    }

    // Add payment record
    await supabase.from('payments').insert({
      order_id: selectedOrder.id,
      amount: amount,
      payment_method: paymentMethod,
      note: 'ชำระเพิ่ม',
    })

    // Update order deposit and status
    const newDeposit = selectedOrder.deposit + amount
    const newStatus = newDeposit >= selectedOrder.total_income ? 'paid' : selectedOrder.order_status

    await supabase
      .from('orders')
      .update({
        deposit: newDeposit,
        order_status: newStatus,
      })
      .eq('id', selectedOrder.id)

    setShowPaymentModal(false)
    await refreshOrders()
  }

  const updateOrderStatus = async (newStatus: Order['order_status']) => {
    if (!selectedOrder) return

    await supabase
      .from('orders')
      .update({ order_status: newStatus })
      .eq('id', selectedOrder.id)

    await refreshOrders()
  }

  const openItemEdit = (item: OrderItem) => {
    setEditingItem(item)
    setEditDate(item.appointment_date || '')
    setEditTime(item.appointment_time || '')
    setEditStatus(item.item_status)
  }

  const saveItemEdit = async () => {
    if (!editingItem) return

    await supabase
      .from('order_items')
      .update({
        appointment_date: editDate || null,
        appointment_time: editTime || null,
        item_status: editStatus,
      })
      .eq('id', editingItem.id)

    setEditingItem(null)
    await refreshOrders()
  }

  const getOrderStatusConfig = (status: Order['order_status']) => {
    switch (status) {
      case 'booking':
        return { label: 'จอง', icon: '📅', bg: 'bg-yellow-500', text: 'text-white' }
      case 'paid':
        return { label: 'ชำระแล้ว', icon: '✅', bg: 'bg-green-500', text: 'text-white' }
      case 'done':
        return { label: 'เสร็จสิ้น', icon: '🎉', bg: 'bg-blue-500', text: 'text-white' }
      case 'cancelled':
        return { label: 'ยกเลิก', icon: '❌', bg: 'bg-red-500', text: 'text-white' }
    }
  }

  const getItemStatusConfig = (status: OrderItem['item_status']) => {
    switch (status) {
      case 'pending':
        return { label: 'ยังไม่ได้นัดหมาย', icon: '⏳', color: 'text-gray-500' }
      case 'scheduled':
        return { label: 'นัดหมายแล้ว', icon: '📅', color: 'text-blue-500' }
      case 'completed':
        return { label: 'เข้ารับบริการแล้ว', icon: '✅', color: 'text-green-500' }
      case 'cancelled':
        return { label: 'ยกเลิก', icon: '❌', color: 'text-red-500' }
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
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">💆 บริการลูกค้า</h1>
        <p className="text-gray-500 dark:text-gray-400">ค้นหาและจัดการบริการของลูกค้า</p>
      </div>

      {/* Search Box */}
      <div className="card">
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              ค้นหาด้วยชื่อ หรือ เบอร์โทรศัพท์
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchCustomer()}
              placeholder="พิมพ์ชื่อลูกค้า หรือ เบอร์โทร..."
              className="input w-full text-lg"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={searchCustomer}
              disabled={loading}
              className="btn btn-primary h-[46px] px-8"
            >
              {loading ? 'กำลังค้นหา...' : '🔍 ค้นหา'}
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      {searched && !loading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Customer & Orders List */}
          <div className="lg:col-span-1 space-y-4">
            {!customer ? (
              <div className="card text-center py-12">
                <p className="text-4xl mb-4">😔</p>
                <p className="text-gray-500 dark:text-gray-400">ไม่พบลูกค้า</p>
                <p className="text-sm text-gray-400">"{searchQuery}"</p>
              </div>
            ) : (
              <>
                {/* Customer Info Card */}
                <div className="card bg-gradient-to-br from-pink-500 to-purple-600 text-white">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-2xl font-bold">
                      {customer.full_name.charAt(0)}
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">{customer.full_name}</h2>
                      <p className="opacity-90">📞 {customer.phone || '-'}</p>
                      <p className="text-sm opacity-75">{customer.contact_channel || '-'}</p>
                    </div>
                  </div>
                </div>

                {/* Orders List */}
                <div className="space-y-2">
                  <h3 className="font-bold text-gray-800 dark:text-white">
                    ออเดอร์ ({orders.length})
                  </h3>

                  {orders.length === 0 ? (
                    <div className="card text-center py-6 text-gray-500">
                      ยังไม่มีออเดอร์
                    </div>
                  ) : (
                    orders.map(order => {
                      const statusConfig = getOrderStatusConfig(order.order_status)
                      const isSelected = selectedOrder?.id === order.id
                      const remaining = order.total_income - order.deposit

                      return (
                        <button
                          key={order.id}
                          onClick={() => setSelectedOrder(order)}
                          className={`w-full text-left card p-4 transition-all ${
                            isSelected
                              ? 'ring-2 ring-pink-500 bg-pink-50 dark:bg-pink-900/20'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-bold text-gray-800 dark:text-white">
                              #{order.id}
                            </span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.text}`}>
                              {statusConfig.icon} {statusConfig.label}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">{formatDate(order.order_date)}</span>
                            <span className="font-medium text-pink-600">฿{order.total_income.toLocaleString()}</span>
                          </div>
                          {remaining > 0 && order.order_status === 'booking' && (
                            <div className="mt-2 text-xs text-orange-600 dark:text-orange-400">
                              ⚠️ ค้างชำระ ฿{remaining.toLocaleString()}
                            </div>
                          )}
                        </button>
                      )
                    })
                  )}
                </div>
              </>
            )}
          </div>

          {/* Right Panel - Order Detail */}
          <div className="lg:col-span-2">
            {!selectedOrder ? (
              <div className="card text-center py-16">
                <p className="text-6xl mb-4">👈</p>
                <p className="text-gray-500 dark:text-gray-400 text-lg">เลือกออเดอร์เพื่อดูรายละเอียด</p>
              </div>
            ) : (
              <div className="card space-y-6">
                {/* Order Header */}
                <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b dark:border-gray-700">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
                      Order #{selectedOrder.id}
                    </h2>
                    <p className="text-gray-500">{formatDate(selectedOrder.order_date)}</p>
                  </div>
                  <div className={`px-4 py-2 rounded-xl text-lg font-bold ${getOrderStatusConfig(selectedOrder.order_status).bg} ${getOrderStatusConfig(selectedOrder.order_status).text}`}>
                    {getOrderStatusConfig(selectedOrder.order_status).icon} {getOrderStatusConfig(selectedOrder.order_status).label}
                  </div>
                </div>

                {/* Payment Summary */}
                <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                  <div className="text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">ยอดรวม</p>
                    <p className="text-2xl font-bold text-gray-800 dark:text-white">
                      ฿{selectedOrder.total_income.toLocaleString()}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">ชำระแล้ว</p>
                    <p className="text-2xl font-bold text-green-600">
                      ฿{selectedOrder.deposit.toLocaleString()}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">ค้างชำระ</p>
                    <p className={`text-2xl font-bold ${selectedOrder.total_income - selectedOrder.deposit > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                      ฿{(selectedOrder.total_income - selectedOrder.deposit).toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3">
                  {selectedOrder.order_status === 'booking' && (
                    <>
                      <button
                        onClick={openPaymentModal}
                        className="px-6 py-3 bg-green-500 text-white rounded-xl font-bold hover:bg-green-600 transition-colors"
                      >
                        💰 รับชำระเงิน
                      </button>
                      <button
                        onClick={() => updateOrderStatus('paid')}
                        className="px-6 py-3 bg-blue-500 text-white rounded-xl font-bold hover:bg-blue-600 transition-colors"
                      >
                        ✅ ชำระครบแล้ว
                      </button>
                    </>
                  )}
                  {selectedOrder.order_status === 'paid' && (
                    <button
                      onClick={() => updateOrderStatus('done')}
                      className="px-6 py-3 bg-purple-500 text-white rounded-xl font-bold hover:bg-purple-600 transition-colors"
                    >
                      🎉 เสร็จสิ้นทั้งหมด
                    </button>
                  )}
                  {selectedOrder.order_status !== 'cancelled' && selectedOrder.order_status !== 'done' && (
                    <button
                      onClick={() => updateOrderStatus('cancelled')}
                      className="px-6 py-3 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl font-medium hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                    >
                      ❌ ยกเลิก
                    </button>
                  )}
                </div>

                {/* Services List */}
                <div>
                  <h3 className="font-bold text-gray-800 dark:text-white mb-3">
                    รายการบริการ ({selectedOrder.order_items.length})
                  </h3>
                  <div className="space-y-3">
                    {selectedOrder.order_items.map(item => {
                      const itemStatus = getItemStatusConfig(item.item_status)
                      return (
                        <div
                          key={item.id}
                          className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-bold text-gray-800 dark:text-white">
                                  {item.product?.product_name}
                                </span>
                                {item.product?.is_free && (
                                  <span className="px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 rounded text-xs">
                                    ฟรี
                                  </span>
                                )}
                                {item.is_upsell && (
                                  <span className="px-2 py-0.5 bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 rounded text-xs">
                                    Upsell
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-sm">
                                <span className={`font-medium ${itemStatus.color}`}>
                                  {itemStatus.icon} {itemStatus.label}
                                </span>
                                {item.appointment_date && (
                                  <span className="text-gray-500">
                                    📅 {formatDate(item.appointment_date)} {item.appointment_time || ''}
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => openItemEdit(item)}
                              className="px-4 py-2 bg-pink-500 text-white rounded-lg text-sm font-medium hover:bg-pink-600 transition-colors"
                            >
                              จัดการ
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Note */}
                {selectedOrder.note && (
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      📝 {selectedOrder.note}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-xl font-bold text-gray-800 dark:text-white">
              💰 รับชำระเงิน
            </h3>

            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-xl space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">ยอดรวม</span>
                <span className="font-bold">฿{selectedOrder.total_income.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">ชำระแล้ว</span>
                <span className="font-bold text-green-600">฿{selectedOrder.deposit.toLocaleString()}</span>
              </div>
              <div className="flex justify-between pt-2 border-t dark:border-gray-600">
                <span className="text-gray-500">ค้างชำระ</span>
                <span className="font-bold text-orange-600">฿{(selectedOrder.total_income - selectedOrder.deposit).toLocaleString()}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                จำนวนเงินที่รับ
              </label>
              <input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="input w-full text-xl font-bold text-center"
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                วิธีชำระ
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="select w-full"
              >
                <option value="โอนเงิน">โอนเงิน</option>
                <option value="เงินสด">เงินสด</option>
                <option value="บัตรเครดิต">บัตรเครดิต</option>
              </select>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="btn btn-secondary flex-1"
              >
                ยกเลิก
              </button>
              <button
                onClick={processPayment}
                className="btn btn-primary flex-1"
              >
                ✅ ยืนยันรับเงิน
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Item Edit Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white">
              จัดการ: {editingItem.product?.product_name}
            </h3>

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
