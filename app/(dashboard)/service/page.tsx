'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import DateRangeFilter from '@/components/date-range-filter'
import { useLanguage } from '@/lib/language-context'

interface Customer {
  id: number
  full_name: string
  phone: string | null
  contact_channel: string | null
}

interface Staff {
  id: number
  staff_name: string
}

interface OrderItem {
  id: number
  order_id: number
  product_id: number
  is_upsell: boolean
  appointment_date: string | null
  appointment_time: string | null
  item_status: 'pending' | 'scheduled' | 'completed' | 'cancelled'
  artist_id: number | null
  artist: { staff_name: string } | null
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
  order_items: OrderItem[]
}

export default function AppointmentPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [artists, setArtists] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Filter for unscheduled services
  const [showUnscheduledOnly, setShowUnscheduledOnly] = useState(false)
  const [showFreeOnlyUnscheduled, setShowFreeOnlyUnscheduled] = useState(false)

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
  const [editArtistId, setEditArtistId] = useState<string>('')

  // Order edit modal (for corrections)
  const [showEditOrderModal, setShowEditOrderModal] = useState(false)
  const [editOrderStatus, setEditOrderStatus] = useState<Order['order_status']>('booking')
  const [editOrderDeposit, setEditOrderDeposit] = useState('')

  const { t } = useLanguage()
  const supabase = createClient()

  const handleDateChange = (start: string, end: string) => {
    setStartDate(start)
    setEndDate(end)
  }

  useEffect(() => {
    fetchArtists()
  }, [])

  useEffect(() => {
    if (startDate && endDate) {
      fetchOrders()
    }
  }, [startDate, endDate])

  const fetchArtists = async () => {
    const { data } = await supabase
      .from('staff')
      .select('id, staff_name')
      .eq('role', 'artist')
      .eq('is_active', true)
      .order('staff_name')

    setArtists(data || [])
  }

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
        order_items(
          *,
          artist:staff!order_items_artist_id_fkey(staff_name),
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
        order_items(
          *,
          artist:staff!order_items_artist_id_fkey(staff_name),
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
          order_items(
            *,
            artist:staff!order_items_artist_id_fkey(staff_name),
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
    setEditArtistId(item.artist_id ? String(item.artist_id) : '')
  }

  const saveItemEdit = async () => {
    if (!editingItem) return

    await supabase
      .from('order_items')
      .update({
        appointment_date: editDate || null,
        appointment_time: editTime || null,
        item_status: editStatus,
        artist_id: editArtistId ? parseInt(editArtistId) : null,
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
        return { label: t('appointments.pending'), color: 'text-gray-500' }
      case 'scheduled':
        return { label: t('appointments.scheduled'), color: 'text-blue-500' }
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

  // Check if order has unscheduled paid services
  const hasUnscheduledPaidService = (order: Order) => {
    return order.order_items.some(
      item => !item.appointment_date && !item.product?.is_free
    )
  }

  // Check if order has unscheduled free services
  const hasUnscheduledFreeService = (order: Order) => {
    return order.order_items.some(
      item => !item.appointment_date && item.product?.is_free
    )
  }

  // Filter orders based on unscheduled filter
  const filteredOrders = orders.filter(order => {
    if (!showUnscheduledOnly) return true

    if (showFreeOnlyUnscheduled) {
      // Show only orders with unscheduled FREE services
      return hasUnscheduledFreeService(order)
    } else {
      // Show orders with ANY unscheduled services
      return order.order_items.some(item => !item.appointment_date)
    }
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">{t('appointments.title')}</h1>
        <p className="text-gray-500 dark:text-gray-400">{t('appointments.subtitle')}</p>
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
            {t('common.search')}
          </button>
        </div>

        {/* Unscheduled Filter */}
        <div className="flex flex-wrap items-center gap-4 p-3 bg-gradient-to-r from-orange-500 to-pink-500 rounded-xl">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showUnscheduledOnly}
              onChange={(e) => {
                setShowUnscheduledOnly(e.target.checked)
                if (!e.target.checked) setShowFreeOnlyUnscheduled(false)
              }}
              className="w-5 h-5 rounded accent-white"
            />
            <span className="font-bold text-white">
              Show Unscheduled Only
            </span>
          </label>

          {showUnscheduledOnly && (
            <label className="flex items-center gap-2 cursor-pointer ml-4 px-3 py-1 bg-white/20 rounded-lg">
              <input
                type="checkbox"
                checked={showFreeOnlyUnscheduled}
                onChange={(e) => setShowFreeOnlyUnscheduled(e.target.checked)}
                className="w-4 h-4 rounded accent-green-400"
              />
              <span className="text-white text-sm font-medium">
                Free Services Only
              </span>
            </label>
          )}

          {showUnscheduledOnly && (
            <span className="ml-auto text-white/80 text-sm">
              Found: {filteredOrders.length} orders
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-500 dark:text-gray-400">{t('common.loading')}</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Orders List */}
          <div className="lg:col-span-1 space-y-4">
            <h3 className="font-bold text-gray-800 dark:text-white">
              Orders ({filteredOrders.length})
            </h3>

            {filteredOrders.length === 0 ? (
              <div className="card text-center py-12">
                <p className="text-gray-500 dark:text-gray-400">No orders found</p>
                <p className="text-sm text-gray-400">Try changing the date range or filter</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[calc(100vh-400px)] overflow-y-auto">
                {filteredOrders.map(order => {
                  const statusConfig = getOrderStatusConfig(order.order_status)
                  const isSelected = selectedOrder?.id === order.id
                  const remaining = order.total_income - order.deposit
                  const hasPaidUnscheduled = hasUnscheduledPaidService(order)

                  return (
                    <button
                      key={order.id}
                      onClick={() => setSelectedOrder(order)}
                      className={`w-full text-left card p-4 transition-all relative ${
                        isSelected
                          ? 'ring-2 ring-pink-500 bg-pink-50 dark:bg-pink-900/20'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      }`}
                    >
                      {/* Warning indicator for paid services without appointments */}
                      {hasPaidUnscheduled && (
                        <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center animate-pulse" title="Has paid service without appointment">
                          <span className="text-white text-xs font-bold">!</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-gray-800 dark:text-white">
                          #{order.id}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.text}`}>
                            {statusConfig.label}
                          </span>
                          {/* Mobile tap indicator */}
                          <span className="lg:hidden text-pink-500 text-sm">→</span>
                        </div>
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
                          {t('common.remaining')}: ฿{remaining.toLocaleString()}
                        </div>
                      )}

                      {/* Show unscheduled services count */}
                      {hasPaidUnscheduled && (
                        <div className="mt-2 text-xs text-red-500 font-medium flex items-center gap-1">
                          <span>⚠</span>
                          <span>Paid service needs appointment</span>
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Right Panel - Order Detail (Desktop only) */}
          <div className="lg:col-span-2 hidden lg:block">
            {!selectedOrder ? (
              <div className="card text-center py-16">
                <p className="text-gray-500 dark:text-gray-400 text-lg">{t('appointments.selectOrder')}</p>
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
                    <p className="text-sm text-gray-500 dark:text-gray-400">{t('common.total')}</p>
                    <p className="text-2xl font-bold text-gray-800 dark:text-white">
                      ฿{selectedOrder.total_income.toLocaleString()}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">{t('common.paid')}</p>
                    <p className="text-2xl font-bold text-green-600">
                      ฿{selectedOrder.deposit.toLocaleString()}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">{t('common.remaining')}</p>
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
                      {t('appointments.receivePayment')}
                    </button>
                  )}

                  {selectedOrder.order_status !== 'cancelled' && selectedOrder.order_status !== 'done' && (
                    <button
                      onClick={handleCancelOrder}
                      className="px-6 py-3 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl font-medium hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                    >
                      {t('appointments.cancel')}
                    </button>
                  )}

                  <button
                    onClick={openEditOrderModal}
                    className="px-6 py-3 bg-blue-500 text-white rounded-xl font-bold hover:bg-blue-600 transition-colors"
                  >
                    {t('appointments.edit')}
                  </button>
                </div>

                {/* Services List */}
                <div>
                  <h3 className="font-bold text-gray-800 dark:text-white mb-3">
                    {t('appointments.services')} ({selectedOrder.order_items.length})
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
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className="text-xs text-pink-500 font-mono">[{item.product?.product_code}]</span>
                                <span className="font-bold text-gray-800 dark:text-white">
                                  {item.product?.product_name}
                                </span>
                                {item.product?.is_free && (
                                  <span className="px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 rounded text-xs">
                                    {t('common.free')}
                                  </span>
                                )}
                                {item.is_upsell && (
                                  <span className="px-2 py-0.5 bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 rounded text-xs">
                                    {t('common.upsell')}
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
                              {item.artist && (
                                <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                  Artist: <span className="font-medium text-pink-600">{item.artist.staff_name}</span>
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => openItemEdit(item)}
                              className="px-4 py-2 bg-pink-500 text-white rounded-lg text-sm font-medium hover:bg-pink-600 transition-colors"
                            >
                              {t('appointments.manage')}
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
                      {t('common.note')}: {selectedOrder.note}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobile Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-end lg:hidden z-40">
          <div className="bg-white dark:bg-gray-800 rounded-t-2xl w-full max-h-[90vh] overflow-y-auto animate-slide-up">
            {/* Mobile Header with Close Button */}
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b dark:border-gray-700 p-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800 dark:text-white">
                Order #{selectedOrder.id}
              </h2>
              <button
                onClick={() => setSelectedOrder(null)}
                className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Order Status & Customer */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-gray-600 dark:text-gray-300 font-medium">
                    {selectedOrder.customers?.full_name || '-'}
                  </p>
                  {selectedOrder.customers?.phone && (
                    <p className="text-sm text-gray-400">{selectedOrder.customers.phone}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">{formatDateTime(selectedOrder.created_at)}</p>
                </div>
                <div className={`px-3 py-1.5 rounded-xl text-sm font-bold ${getOrderStatusConfig(selectedOrder.order_status).bg} ${getOrderStatusConfig(selectedOrder.order_status).text}`}>
                  {getOrderStatusConfig(selectedOrder.order_status).label}
                </div>
              </div>

              {/* Payment Summary */}
              <div className="grid grid-cols-3 gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <div className="text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t('common.total')}</p>
                  <p className="text-lg font-bold text-gray-800 dark:text-white">
                    ฿{selectedOrder.total_income.toLocaleString()}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t('common.paid')}</p>
                  <p className="text-lg font-bold text-green-600">
                    ฿{selectedOrder.deposit.toLocaleString()}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t('common.remaining')}</p>
                  <p className={`text-lg font-bold ${selectedOrder.total_income - selectedOrder.deposit > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                    ฿{(selectedOrder.total_income - selectedOrder.deposit).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                {selectedOrder.order_status !== 'cancelled' && (
                  <button
                    onClick={openPaymentModal}
                    className="flex-1 px-4 py-3 bg-green-500 text-white rounded-xl font-bold"
                  >
                    {t('appointments.receivePayment')}
                  </button>
                )}
                <button
                  onClick={openEditOrderModal}
                  className="px-4 py-3 bg-blue-500 text-white rounded-xl font-bold"
                >
                  {t('appointments.edit')}
                </button>
              </div>

              {/* Services List */}
              <div>
                <h3 className="font-bold text-gray-800 dark:text-white mb-2">
                  {t('appointments.services')} ({selectedOrder.order_items.length})
                </h3>
                <div className="space-y-2">
                  {selectedOrder.order_items.map(item => {
                    const itemStatus = getItemStatusConfig(item.item_status)
                    return (
                      <div
                        key={item.id}
                        className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1 mb-1 flex-wrap">
                              <span className="text-xs text-pink-500 font-mono">[{item.product?.product_code}]</span>
                              {item.product?.is_free && (
                                <span className="px-1.5 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 rounded text-xs">
                                  {t('common.free')}
                                </span>
                              )}
                            </div>
                            <p className="font-medium text-gray-800 dark:text-white text-sm truncate">
                              {item.product?.product_name}
                            </p>
                            <div className="flex items-center gap-2 text-xs mt-1">
                              <span className={`font-medium ${itemStatus.color}`}>
                                {itemStatus.label}
                              </span>
                              {item.appointment_date && (
                                <span className="text-gray-400">
                                  {formatDate(item.appointment_date)}
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => openItemEdit(item)}
                            className="px-3 py-1.5 bg-pink-500 text-white rounded-lg text-xs font-medium shrink-0"
                          >
                            {t('appointments.manage')}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {selectedOrder.note && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    {t('common.note')}: {selectedOrder.note}
                  </p>
                </div>
              )}

              {/* Cancel Order Button (at bottom) */}
              {selectedOrder.order_status !== 'cancelled' && selectedOrder.order_status !== 'done' && (
                <button
                  onClick={handleCancelOrder}
                  className="w-full px-4 py-3 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl font-medium"
                >
                  {t('appointments.cancel')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-xl font-bold text-gray-800 dark:text-white">
              {t('appointments.receivePayment')}
            </h3>

            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-xl space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">{t('common.total')}</span>
                <span className="font-bold text-gray-800 dark:text-white">฿{selectedOrder.total_income.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">{t('common.paid')}</span>
                <span className="font-bold text-green-600">฿{selectedOrder.deposit.toLocaleString()}</span>
              </div>
              <div className="flex justify-between pt-2 border-t dark:border-gray-600">
                <span className="text-gray-500 dark:text-gray-400">{t('common.remaining')}</span>
                <span className="font-bold text-orange-600">฿{(selectedOrder.total_income - selectedOrder.deposit).toLocaleString()}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('common.amount')}
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
                {t('common.paymentMethod')}
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
                {t('common.cancel')}
              </button>
              <button
                onClick={processPayment}
                className="btn btn-primary flex-1"
              >
                {t('common.confirm')}
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
              {t('common.confirm')}
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              {confirmAction.message}
            </p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setConfirmAction(null)}
                className="btn btn-secondary flex-1"
              >
                {t('common.no')}
              </button>
              <button
                onClick={confirmActionHandler}
                className="btn bg-red-500 hover:bg-red-600 text-white flex-1"
              >
                {t('common.yes')}, {t('common.confirm')}
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
              {t('appointments.edit')} Order
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
                {t('common.cancel')}
              </button>
              <button
                onClick={saveOrderEdit}
                className="btn btn-primary flex-1"
              >
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Item Edit Modal with Artist Selection */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white">
              {t('appointments.manage')}: {editingItem.product?.product_name}
            </h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('appointments.serviceStatus')}
              </label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as OrderItem['item_status'])}
                className="select w-full"
              >
                <option value="pending">{t('appointments.pending')}</option>
                <option value="scheduled">{t('appointments.scheduled')}</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            {/* Artist Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('appointments.artist')}
              </label>
              <select
                value={editArtistId}
                onChange={(e) => setEditArtistId(e.target.value)}
                className="select w-full"
              >
                <option value="">{t('appointments.selectArtist')}</option>
                {artists.map(artist => (
                  <option key={artist.id} value={artist.id}>
                    {artist.staff_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('appointments.appointmentDate')}
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
                  {t('appointments.time')}
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
                {t('common.cancel')}
              </button>
              <button
                onClick={saveItemEdit}
                className="btn btn-primary flex-1"
              >
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
