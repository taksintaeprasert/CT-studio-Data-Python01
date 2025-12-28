'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import DateRangeFilter from '@/components/date-range-filter'

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
  created_at: string
  order_status: 'booking' | 'paid' | 'done' | 'cancelled'
  total_income: number
  deposit: number
  payment_method: string | null
  note: string | null
  customers: Customer | null
  sales: { staff_name: string } | null
  artist: { staff_name: string } | null
  order_items: OrderItem[]
}

export default function AppointmentPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Selected order for detail view
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)

  // Payment modal
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('Transfer')

  // Confirmation modal
  const [confirmAction, setConfirmAction] = useState<{type: string; message: string} | null>(null)

  // Item edit modal
  const [editingItem, setEditingItem] = useState<OrderItem | null>(null)
  const [editDate, setEditDate] = useState('')
  const [editTime, setEditTime] = useState('')
  const [editStatus, setEditStatus] = useState<OrderItem['item_status']>('pending')

  // Order edit modal (for corrections)
  const [showEditOrderModal, setShowEditOrderModal] = useState(false)
  const [editOrderStatus, setEditOrderStatus] = useState<Order['order_status']>('booking')
  const [editOrderDeposit, setEditOrderDeposit] = useState('')

  const supabase = createClient()

  const handleDateChange = (start: string, end: string) => {
    setStartDate(start)
    setEndDate(end)
  }

  useEffect(() => {
    if (startDate && endDate) {
      fetchOrders()
    }
  }, [startDate, endDate])

  const fetchOrders = async () => {
    if (!startDate || !endDate) return

    setLoading(true)
    setSelectedOrder(null)

    const { data: ordersData } = await supabase
      .from('orders')
      .select(`
        *,
        customers (*),
        sales:staff!orders_sales_id_fkey(staff_name),
        artist:staff!orders_artist_id_fkey(staff_name),
        order_items(
          *,
          product:products(product_name, product_code, is_free)
        )
      `)
      .gte('created_at', `${startDate}T00:00:00`)
      .lte('created_at', `${endDate}T23:59:59`)
      .order('created_at', { ascending: false })

    setOrders(ordersData || [])
    setLoading(false)
  }

  const searchOrders = async () => {
    if (!searchQuery.trim()) {
      fetchOrders()
      return
    }

    setLoading(true)
    setSelectedOrder(null)

    const { data: ordersData } = await supabase
      .from('orders')
      .select(`
        *,
        customers!inner (*),
        sales:staff!orders_sales_id_fkey(staff_name),
        artist:staff!orders_artist_id_fkey(staff_name),
        order_items(
          *,
          product:products(product_name, product_code, is_free)
        )
      `)
      .or(`full_name.ilike.%${searchQuery.trim()}%,phone.ilike.%${searchQuery.trim()}%`, { foreignTable: 'customers' })
      .order('created_at', { ascending: false })
      .limit(20)

    setOrders(ordersData || [])
    setLoading(false)
  }

  const refreshOrders = async () => {
    if (searchQuery.trim()) {
      await searchOrders()
    } else {
      await fetchOrders()
    }

    if (selectedOrder) {
      const { data: updatedOrder } = await supabase
        .from('orders')
        .select(`
          *,
          customers (*),
          sales:staff!orders_sales_id_fkey(staff_name),
          artist:staff!orders_artist_id_fkey(staff_name),
          order_items(
            *,
            product:products(product_name, product_code, is_free)
          )
        `)
        .eq('id', selectedOrder.id)
        .single()

      if (updatedOrder) setSelectedOrder(updatedOrder)
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
      alert('Please enter a valid amount')
      return
    }

    await supabase.from('payments').insert({
      order_id: selectedOrder.id,
      amount: amount,
      payment_method: paymentMethod,
      note: 'Additional payment',
    })

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

  const handleCancelOrder = () => {
    setConfirmAction({
      type: 'cancel',
      message: 'Are you sure you want to cancel this order?'
    })
  }

  const confirmActionHandler = async () => {
    if (!selectedOrder || !confirmAction) return

    if (confirmAction.type === 'cancel') {
      await supabase
        .from('orders')
        .update({ order_status: 'cancelled' })
        .eq('id', selectedOrder.id)
    }

    setConfirmAction(null)
    await refreshOrders()
  }

  const openEditOrderModal = () => {
    if (!selectedOrder) return
    setEditOrderStatus(selectedOrder.order_status)
    setEditOrderDeposit(selectedOrder.deposit.toString())
    setShowEditOrderModal(true)
  }

  const saveOrderEdit = async () => {
    if (!selectedOrder) return

    await supabase
      .from('orders')
      .update({
        order_status: editOrderStatus,
        deposit: parseFloat(editOrderDeposit) || 0,
      })
      .eq('id', selectedOrder.id)

    setShowEditOrderModal(false)
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
        return { label: 'Booking', bg: 'bg-yellow-500', text: 'text-white' }
      case 'paid':
        return { label: 'Paid', bg: 'bg-green-500', text: 'text-white' }
      case 'done':
        return { label: 'Completed', bg: 'bg-blue-500', text: 'text-white' }
      case 'cancelled':
        return { label: 'Cancelled', bg: 'bg-red-500', text: 'text-white' }
    }
  }

  const getItemStatusConfig = (status: OrderItem['item_status']) => {
    switch (status) {
      case 'pending':
        return { label: 'Pending', color: 'text-gray-500' }
      case 'scheduled':
        return { label: 'Scheduled', color: 'text-blue-500' }
      case 'completed':
        return { label: 'Completed', color: 'text-green-500' }
      case 'cancelled':
        return { label: 'Cancelled', color: 'text-red-500' }
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

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Appointments</h1>
        <p className="text-gray-500 dark:text-gray-400">Manage orders and service appointments</p>
      </div>

      {/* Filters */}
      <div className="card space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <DateRangeFilter onDateChange={handleDateChange} />
        </div>

        {/* Search */}
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchOrders()}
            placeholder="Search by name or phone..."
            className="input flex-1"
          />
          <button
            onClick={searchOrders}
            className="btn btn-primary px-6"
          >
            Search
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-500 dark:text-gray-400">Loading...</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Orders List */}
          <div className="lg:col-span-1 space-y-4">
            <h3 className="font-bold text-gray-800 dark:text-white">
              Orders ({orders.length})
            </h3>

            {orders.length === 0 ? (
              <div className="card text-center py-12">
                <p className="text-gray-500 dark:text-gray-400">No orders found</p>
                <p className="text-sm text-gray-400">Try changing the date range</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[calc(100vh-350px)] overflow-y-auto">
                {orders.map(order => {
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
                          {statusConfig.label}
                        </span>
                      </div>
                      <div className="text-sm text-gray-800 dark:text-white font-medium mb-1">
                        {order.customers?.full_name || '-'}
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400 text-xs">{formatDateTime(order.created_at)}</span>
                        <span className="font-medium text-pink-600">฿{order.total_income.toLocaleString()}</span>
                      </div>
                      {remaining > 0 && order.order_status === 'booking' && (
                        <div className="mt-2 text-xs text-orange-600 dark:text-orange-400">
                          Remaining: ฿{remaining.toLocaleString()}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Right Panel - Order Detail */}
          <div className="lg:col-span-2">
            {!selectedOrder ? (
              <div className="card text-center py-16">
                <p className="text-gray-500 dark:text-gray-400 text-lg">Select an order to view details</p>
              </div>
            ) : (
              <div className="card space-y-6">
                {/* Order Header */}
                <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b dark:border-gray-700">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
                      Order #{selectedOrder.id}
                    </h2>
                    <p className="text-gray-400 text-sm">Created: {formatDateTime(selectedOrder.created_at)}</p>
                    <p className="text-gray-600 dark:text-gray-300 mt-1">
                      {selectedOrder.customers?.full_name || '-'}
                      {selectedOrder.customers?.phone && (
                        <span className="ml-2 text-sm">{selectedOrder.customers.phone}</span>
                      )}
                    </p>
                  </div>
                  <div className={`px-4 py-2 rounded-xl text-lg font-bold ${getOrderStatusConfig(selectedOrder.order_status).bg} ${getOrderStatusConfig(selectedOrder.order_status).text}`}>
                    {getOrderStatusConfig(selectedOrder.order_status).label}
                  </div>
                </div>

                {/* Payment Summary */}
                <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                  <div className="text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Total</p>
                    <p className="text-2xl font-bold text-gray-800 dark:text-white">
                      ฿{selectedOrder.total_income.toLocaleString()}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Paid</p>
                    <p className="text-2xl font-bold text-green-600">
                      ฿{selectedOrder.deposit.toLocaleString()}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Remaining</p>
                    <p className={`text-2xl font-bold ${selectedOrder.total_income - selectedOrder.deposit > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                      ฿{(selectedOrder.total_income - selectedOrder.deposit).toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3">
                  {selectedOrder.order_status !== 'cancelled' && (
                    <button
                      onClick={openPaymentModal}
                      className="px-6 py-3 bg-green-500 text-white rounded-xl font-bold hover:bg-green-600 transition-colors"
                    >
                      Receive Payment
                    </button>
                  )}

                  {selectedOrder.order_status !== 'cancelled' && selectedOrder.order_status !== 'done' && (
                    <button
                      onClick={handleCancelOrder}
                      className="px-6 py-3 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl font-medium hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                    >
                      Cancel
                    </button>
                  )}

                  <button
                    onClick={openEditOrderModal}
                    className="px-6 py-3 bg-blue-500 text-white rounded-xl font-bold hover:bg-blue-600 transition-colors"
                  >
                    Edit
                  </button>
                </div>

                {/* Services List */}
                <div>
                  <h3 className="font-bold text-gray-800 dark:text-white mb-3">
                    Services ({selectedOrder.order_items.length})
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
                                    Free
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
                                  {itemStatus.label}
                                </span>
                                {item.appointment_date && (
                                  <span className="text-gray-500 dark:text-gray-400">
                                    {formatDate(item.appointment_date)} {item.appointment_time || ''}
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => openItemEdit(item)}
                              className="px-4 py-2 bg-pink-500 text-white rounded-lg text-sm font-medium hover:bg-pink-600 transition-colors"
                            >
                              Manage
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {selectedOrder.note && (
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      Note: {selectedOrder.note}
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
              Receive Payment
            </h3>

            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-xl space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Total</span>
                <span className="font-bold text-gray-800 dark:text-white">฿{selectedOrder.total_income.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Paid</span>
                <span className="font-bold text-green-600">฿{selectedOrder.deposit.toLocaleString()}</span>
              </div>
              <div className="flex justify-between pt-2 border-t dark:border-gray-600">
                <span className="text-gray-500 dark:text-gray-400">Remaining</span>
                <span className="font-bold text-orange-600">฿{(selectedOrder.total_income - selectedOrder.deposit).toLocaleString()}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Amount
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
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="select w-full"
              >
                <option value="Transfer">Transfer</option>
                <option value="Cash">Cash</option>
                <option value="Credit Card">Credit Card</option>
              </select>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="btn btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={processPayment}
                className="btn btn-primary flex-1"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-xl font-bold text-gray-800 dark:text-white">
              Confirm Action
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              {confirmAction.message}
            </p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setConfirmAction(null)}
                className="btn btn-secondary flex-1"
              >
                No
              </button>
              <button
                onClick={confirmActionHandler}
                className="btn bg-red-500 hover:bg-red-600 text-white flex-1"
              >
                Yes, Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Edit Modal */}
      {showEditOrderModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-xl font-bold text-gray-800 dark:text-white">
              Edit Order
            </h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Order Status
              </label>
              <select
                value={editOrderStatus}
                onChange={(e) => setEditOrderStatus(e.target.value as Order['order_status'])}
                className="select w-full"
              >
                <option value="booking">Booking</option>
                <option value="paid">Paid</option>
                <option value="done">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Amount Paid (฿)
              </label>
              <input
                type="number"
                value={editOrderDeposit}
                onChange={(e) => setEditOrderDeposit(e.target.value)}
                className="input w-full"
                placeholder="0"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowEditOrderModal(false)}
                className="btn btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={saveOrderEdit}
                className="btn btn-primary flex-1"
              >
                Save
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
              Manage: {editingItem.product?.product_name}
            </h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Service Status
              </label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as OrderItem['item_status'])}
                className="select w-full"
              >
                <option value="pending">Pending</option>
                <option value="scheduled">Scheduled</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Appointment Date
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
                  Time
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
                Cancel
              </button>
              <button
                onClick={saveItemEdit}
                className="btn btn-primary flex-1"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
