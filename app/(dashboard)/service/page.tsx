'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import DateRangeFilter from '@/components/date-range-filter'
import { useLanguage } from '@/lib/language-context'
import BookingModal from '@/app/focus/components/booking-modal'
import PaymentModal from '@/app/focus/components/payment-modal'
import PaymentHistoryModal from '@/app/focus/components/payment-history-modal'

interface Customer {
  id: number
  full_name: string
  nickname: string | null
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
  item_price: number | null
  booking_title: string | null
  artist: { staff_name: string } | null
  product: {
    product_name: string
    product_code: string
    is_free: boolean
    validity_months: number | null
    list_price: number | null
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
  payments?: { amount: number }[]
}

export default function AppointmentPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [artists, setArtists] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Appointment date range filter
  const [appointmentStartDate, setAppointmentStartDate] = useState('')
  const [appointmentEndDate, setAppointmentEndDate] = useState('')

  // Checkbox filters
  const [filterCompleted, setFilterCompleted] = useState(false)
  const [filterUnpaid, setFilterUnpaid] = useState(false)
  const [filterExpiringSoon, setFilterExpiringSoon] = useState(false)
  const [filterHalfPrice, setFilterHalfPrice] = useState(false)
  const [filterFree, setFilterFree] = useState(false)
  const [filterMode, setFilterMode] = useState<'AND' | 'OR'>('AND')

  // Selected order for detail view
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)

  // Payment modal
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentOrderItemId, setPaymentOrderItemId] = useState<number | null>(null)
  const [totalPaid, setTotalPaid] = useState(0)
  const [remainingAmount, setRemainingAmount] = useState(0)

  // Payment History modal
  const [showPaymentHistory, setShowPaymentHistory] = useState(false)

  // Confirmation modal
  const [confirmAction, setConfirmAction] = useState<{type: string; message: string} | null>(null)

  // Item edit modal (for scheduling)
  const [editingItem, setEditingItem] = useState<OrderItem | null>(null)
  const [editDate, setEditDate] = useState('')
  const [editTime, setEditTime] = useState('')
  const [editArtistId, setEditArtistId] = useState<string>('')

  // Booking Modal (with chat)
  const [showBookingModal, setShowBookingModal] = useState(false)
  const [bookingOrderItem, setBookingOrderItem] = useState<OrderItem | null>(null)
  const [bookingCustomer, setBookingCustomer] = useState<Customer | null>(null)

  // Status change modal
  const [statusChangeItem, setStatusChangeItem] = useState<OrderItem | null>(null)

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
    fetchAllOrders() // Load all orders by default
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
        customers (id, full_name, nickname, phone, contact_channel),
        sales:staff!orders_sales_id_fkey(staff_name),
        order_items(
          *,
          artist:staff!order_items_artist_id_fkey(staff_name),
          product:products(product_name, product_code, is_free, validity_months, list_price)
        ),
        payments(amount)
      `)
      .gte('created_at', `${startDate}T00:00:00`)
      .lte('created_at', `${endDate}T23:59:59`)
      .order('created_at', { ascending: false })

    setOrders(ordersData || [])
    setLoading(false)
  }

  const fetchAllOrders = async () => {
    setLoading(true)
    setSelectedOrder(null)
    setStartDate('')
    setEndDate('')

    const { data: ordersData } = await supabase
      .from('orders')
      .select(`
        *,
        customers (id, full_name, nickname, phone, contact_channel),
        sales:staff!orders_sales_id_fkey(staff_name),
        order_items(
          *,
          artist:staff!order_items_artist_id_fkey(staff_name),
          product:products(product_name, product_code, is_free, validity_months, list_price)
        ),
        payments(amount)
      `)
      .order('created_at', { ascending: false })
      .limit(200)

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
        customers!inner (id, full_name, nickname, phone, contact_channel),
        sales:staff!orders_sales_id_fkey(staff_name),
        order_items(
          *,
          artist:staff!order_items_artist_id_fkey(staff_name),
          product:products(product_name, product_code, is_free, validity_months, list_price)
        ),
        payments(amount)
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
            product:products(product_name, product_code, is_free, validity_months, list_price)
          ),
          payments(amount)
        `)
        .eq('id', selectedOrder.id)
        .single()

      if (updatedOrder) setSelectedOrder(updatedOrder)
    }
  }

  const openPaymentModal = async () => {
    if (!selectedOrder) return

    // Load payment data
    const { data: payments } = await supabase
      .from('payments')
      .select('amount')
      .eq('order_id', selectedOrder.id)

    const paid = payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0
    const remaining = selectedOrder.total_income - paid

    setTotalPaid(paid)
    setRemainingAmount(remaining)

    // Set first order item id for booking messages
    const firstItem = selectedOrder.order_items?.[0]
    if (firstItem) {
      setPaymentOrderItemId(firstItem.id)
    }

    setShowPaymentModal(true)
  }

  const handlePaymentSuccess = async () => {
    await refreshOrders()
    if (selectedOrder) {
      // Reload selected order WITH payments
      const { data } = await supabase
        .from('orders')
        .select(`
          *,
          customers (id, full_name, nickname, phone, contact_channel),
          sales:staff!orders_sales_id_fkey(id, staff_name),
          order_items(
            *,
            artist:staff!order_items_artist_id_fkey(staff_name),
            product:products(product_name, product_code, is_free, validity_months, list_price)
          ),
          payments(amount)
        `)
        .eq('id', selectedOrder.id)
        .single()

      if (data) {
        setSelectedOrder(data)
      }
    }
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
    setEditArtistId(item.artist_id ? String(item.artist_id) : '')
  }

  const saveItemEdit = async () => {
    if (!editingItem) return

    // Auto-set status to 'scheduled' when saving appointment
    await supabase
      .from('order_items')
      .update({
        appointment_date: editDate || null,
        appointment_time: editTime || null,
        item_status: 'scheduled',
        artist_id: editArtistId ? parseInt(editArtistId) : null,
      })
      .eq('id', editingItem.id)

    setEditingItem(null)
    await refreshOrders()
  }

  // Open Booking Modal with chat
  const openBookingModal = (item: OrderItem) => {
    if (!selectedOrder?.customers) return

    setBookingOrderItem(item)
    setBookingCustomer(selectedOrder.customers)
    setShowBookingModal(true)
  }

  const closeBookingModal = () => {
    setShowBookingModal(false)
    setBookingOrderItem(null)
    setBookingCustomer(null)
  }

  // Open status change modal
  const openStatusChange = (item: OrderItem) => {
    setStatusChangeItem(item)
  }

  // Save status change
  const saveStatusChange = async (newStatus: OrderItem['item_status']) => {
    if (!statusChangeItem) return

    // Validation: Cannot mark as "completed" if appointment date is in the future
    if (newStatus === 'completed' && statusChangeItem.appointment_date) {
      const appointmentDate = new Date(statusChangeItem.appointment_date)
      const today = new Date()
      today.setHours(23, 59, 59, 999) // End of today

      if (appointmentDate > today) {
        alert('ไม่สามารถเปลี่ยนเป็น "เสร็จแล้ว" ได้\nเนื่องจากยังไม่ถึงวันนัดหมาย')
        return
      }
    }

    await supabase
      .from('order_items')
      .update({ item_status: newStatus })
      .eq('id', statusChangeItem.id)

    setStatusChangeItem(null)
    await refreshOrders()
  }

  // Compute order status based on service completion
  // Done = ALL services are completed, Ongoing = otherwise
  const getComputedStatus = (order: Order): 'done' | 'ongoing' => {
    const items = order.order_items || []
    if (items.length === 0) return 'ongoing'

    const allCompleted = items.every(item =>
      (item.item_status || '').toString().toLowerCase() === 'completed'
    )
    return allCompleted ? 'done' : 'ongoing'
  }

  const getOrderStatusConfig = (order: Order) => {
    const status = getComputedStatus(order)
    switch (status) {
      case 'ongoing':
        return { label: 'Ongoing', bg: 'bg-yellow-500', text: 'text-white' }
      case 'done':
        return { label: 'Done', bg: 'bg-green-500', text: 'text-white' }
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

  // Get today's date in YYYY-MM-DD format
  const getTodayDate = () => {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Select order and fetch fresh data from database
  const selectOrder = async (orderId: number) => {
    const { data: freshOrder } = await supabase
      .from('orders')
      .select(`
        *,
        customers (id, full_name, nickname, phone, contact_channel),
        sales:staff!orders_sales_id_fkey(staff_name),
        order_items(
          *,
          artist:staff!order_items_artist_id_fkey(staff_name),
          product:products(product_name, product_code, is_free, validity_months, list_price)
        ),
        payments(amount)
      `)
      .eq('id', orderId)
      .single()

    if (freshOrder) {
      setSelectedOrder(freshOrder)
    }
  }

  // Check if order has appointment within date range
  const hasAppointmentInRange = (order: Order, start: string, end: string) => {
    return order.order_items.some(item => {
      if (!item.appointment_date) return false
      return item.appointment_date >= start && item.appointment_date <= end
    })
  }

  // Helper: Calculate total paid from payments table
  const getTotalPaid = (order: Order): number => {
    return order.payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0
  }

  // Helper: Check if order has any completed service
  const hasCompletedService = (order: Order) => {
    return order.order_items.some(item =>
      (item.item_status || '').toString().toLowerCase() === 'completed'
    )
  }

  // Helper: Check if order has remaining balance (unpaid)
  const hasRemainingBalance = (order: Order) => {
    const totalPaid = getTotalPaid(order)
    return order.total_income - totalPaid > 0
  }

  // Helper: Check if order has service expiring within 2 months
  const hasExpiringSoon = (order: Order) => {
    const twoMonthsFromNow = new Date()
    twoMonthsFromNow.setMonth(twoMonthsFromNow.getMonth() + 2)

    return order.order_items.some(item => {
      if (!item.appointment_date || !item.product?.validity_months) return false
      // Calculate expiry date from appointment date + validity months
      const appointmentDate = new Date(item.appointment_date)
      const expiryDate = new Date(appointmentDate)
      expiryDate.setMonth(expiryDate.getMonth() + item.product.validity_months)
      // Check if expiry is within 2 months
      const now = new Date()
      return expiryDate > now && expiryDate <= twoMonthsFromNow
    })
  }

  // Helper: Check if order has 50% discount service
  const hasHalfPriceService = (order: Order) => {
    return order.order_items.some(item => {
      if (!item.item_price || !item.product?.list_price) return false
      // Check if item_price is roughly 50% of list_price (with 5% tolerance)
      const expectedHalfPrice = item.product.list_price * 0.5
      const tolerance = item.product.list_price * 0.05
      return item.item_price >= expectedHalfPrice - tolerance && item.item_price <= expectedHalfPrice + tolerance
    })
  }

  // Helper: Check if order has FREE service
  const hasFreeService = (order: Order) => {
    return order.order_items.some(item => item.product?.is_free)
  }

  // Filter orders based on all filters
  const filteredOrders = orders.filter(order => {
    // Appointment date range filter
    if (appointmentStartDate && appointmentEndDate) {
      if (!hasAppointmentInRange(order, appointmentStartDate, appointmentEndDate)) {
        return false
      }
    }

    // Get active checkbox filters
    const activeFilters = [
      filterCompleted && hasCompletedService(order),
      filterUnpaid && hasRemainingBalance(order),
      filterExpiringSoon && hasExpiringSoon(order),
      filterHalfPrice && hasHalfPriceService(order),
      filterFree && hasFreeService(order),
    ]

    // Check if any checkbox is checked
    const hasActiveFilter = filterCompleted || filterUnpaid || filterExpiringSoon || filterHalfPrice || filterFree

    if (!hasActiveFilter) return true

    if (filterMode === 'AND') {
      // AND mode: all checked filters must match
      if (filterCompleted && !hasCompletedService(order)) return false
      if (filterUnpaid && !hasRemainingBalance(order)) return false
      if (filterExpiringSoon && !hasExpiringSoon(order)) return false
      if (filterHalfPrice && !hasHalfPriceService(order)) return false
      if (filterFree && !hasFreeService(order)) return false
      return true
    } else {
      // OR mode: at least one checked filter must match
      return activeFilters.some(result => result === true)
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
        {/* Order Created Date Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
            วันที่ที่สร้าง Order
          </label>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <DateRangeFilter onDateChange={handleDateChange} onShowAll={fetchAllOrders} />
          </div>
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

        {/* Appointment Date Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
            วันที่นัดหมาย
          </label>
          <div className="flex flex-wrap items-center gap-3">
            {/* Quick buttons */}
            <button
              onClick={() => {
                const today = getTodayDate()
                setAppointmentStartDate(today)
                setAppointmentEndDate(today)
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                appointmentStartDate === getTodayDate() && appointmentEndDate === getTodayDate()
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              วันนี้
            </button>

            {/* Date range inputs */}
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={appointmentStartDate}
                onChange={(e) => setAppointmentStartDate(e.target.value)}
                className="input px-3 py-2"
              />
              <span className="text-gray-500">-</span>
              <input
                type="date"
                value={appointmentEndDate}
                onChange={(e) => setAppointmentEndDate(e.target.value)}
                className="input px-3 py-2"
              />
              {(appointmentStartDate || appointmentEndDate) && (
                <button
                  onClick={() => {
                    setAppointmentStartDate('')
                    setAppointmentEndDate('')
                  }}
                  className="px-3 py-2 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Active filter indicator */}
            {appointmentStartDate && appointmentEndDate && (
              <span className="text-green-600 dark:text-green-400 font-medium text-sm">
                พบ {filteredOrders.length} ออเดอร์ (นัด {new Date(appointmentStartDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} - {new Date(appointmentEndDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })})
              </span>
            )}
          </div>
        </div>

        {/* Checkbox Filters */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">
              ตัวกรองเพิ่มเติม
            </label>
            {/* OR/AND Toggle */}
            <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <button
                onClick={() => setFilterMode('AND')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  filterMode === 'AND'
                    ? 'bg-pink-500 text-white'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                AND
              </button>
              <button
                onClick={() => setFilterMode('OR')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  filterMode === 'OR'
                    ? 'bg-pink-500 text-white'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                OR
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filterCompleted}
                onChange={(e) => setFilterCompleted(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-green-500 focus:ring-green-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">บริการ Completed</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filterUnpaid}
                onChange={(e) => setFilterUnpaid(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">มีค้างชำระ</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filterExpiringSoon}
                onChange={(e) => setFilterExpiringSoon(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-red-500 focus:ring-red-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">ใกล้หมดอายุ (2 เดือน)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filterHalfPrice}
                onChange={(e) => setFilterHalfPrice(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">บริการ 50%</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filterFree}
                onChange={(e) => setFilterFree(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-purple-500 focus:ring-purple-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">บริการ FREE</span>
            </label>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {filterMode === 'AND' ? 'แสดงออเดอร์ที่ตรงตามเงื่อนไขทั้งหมดที่เลือก' : 'แสดงออเดอร์ที่ตรงตามเงื่อนไขใดเงื่อนไขหนึ่ง'}
          </p>
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
                  const statusConfig = getOrderStatusConfig(order)
                  const isSelected = selectedOrder?.id === order.id
                  const totalPaid = getTotalPaid(order)
                  const remaining = order.total_income - totalPaid
                  const hasPaidUnscheduled = hasUnscheduledPaidService(order)

                  return (
                    <button
                      key={order.id}
                      onClick={() => selectOrder(order.id)}
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
                  <div className={`px-4 py-2 rounded-xl text-lg font-bold ${getOrderStatusConfig(selectedOrder)?.bg} ${getOrderStatusConfig(selectedOrder)?.text}`}>
                    {getOrderStatusConfig(selectedOrder)?.label}
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
                      ฿{getTotalPaid(selectedOrder).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">{t('common.remaining')}</p>
                    <p className={`text-2xl font-bold ${selectedOrder.total_income - getTotalPaid(selectedOrder) > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                      ฿{(selectedOrder.total_income - getTotalPaid(selectedOrder)).toLocaleString()}
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
                  <button
                    onClick={() => setShowPaymentHistory(true)}
                    className="px-6 py-3 bg-blue-500 text-white rounded-xl font-bold hover:bg-blue-600 transition-colors"
                  >
                    📋 ดู LOG การรับชำระ
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
                            <div className="flex items-center gap-2">
                              {/* Status Button */}
                              <button
                                onClick={() => openStatusChange(item)}
                                className={`px-3 py-2 rounded-lg text-sm font-bold ${
                                  item.item_status === 'pending' ? 'bg-gray-200 text-gray-600 dark:bg-gray-600 dark:text-gray-300' :
                                  item.item_status === 'scheduled' ? 'bg-blue-500 text-white' :
                                  item.item_status === 'completed' ? 'bg-green-500 text-white' :
                                  'bg-red-500 text-white'
                                }`}
                              >
                                {item.item_status === 'pending' ? 'รอนัด' :
                                 item.item_status === 'scheduled' ? 'นัดแล้ว' :
                                 item.item_status === 'completed' ? 'เสร็จ' : 'ยกเลิก'}
                              </button>
                              {/* Schedule/Edit Button - changes based on status */}
                              <button
                                onClick={() => openBookingModal(item)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                  item.item_status === 'pending' || !item.appointment_date
                                    ? 'bg-pink-500 text-white hover:bg-pink-600'
                                    : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                                }`}
                              >
                                {item.item_status === 'pending' || !item.appointment_date ? 'ลงคิวช่าง' : 'แก้ไขคิวช่าง'}
                              </button>
                            </div>
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
                <div className={`px-3 py-1.5 rounded-xl text-sm font-bold ${getOrderStatusConfig(selectedOrder)?.bg} ${getOrderStatusConfig(selectedOrder)?.text}`}>
                  {getOrderStatusConfig(selectedOrder)?.label}
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
                    ฿{getTotalPaid(selectedOrder).toLocaleString()}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t('common.remaining')}</p>
                  <p className={`text-lg font-bold ${selectedOrder.total_income - getTotalPaid(selectedOrder) > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                    ฿{(selectedOrder.total_income - getTotalPaid(selectedOrder)).toLocaleString()}
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
                  onClick={() => setShowPaymentHistory(true)}
                  className="flex-1 px-4 py-3 bg-blue-500 text-white rounded-xl font-bold"
                >
                  📋 LOG
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
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => openStatusChange(item)}
                              className={`px-2 py-1.5 rounded-lg text-xs font-bold ${
                                item.item_status === 'pending' ? 'bg-gray-200 text-gray-600' :
                                item.item_status === 'scheduled' ? 'bg-blue-500 text-white' :
                                item.item_status === 'completed' ? 'bg-green-500 text-white' :
                                'bg-red-500 text-white'
                              }`}
                            >
                              {item.item_status === 'pending' ? 'รอ' :
                               item.item_status === 'scheduled' ? 'นัด' :
                               item.item_status === 'completed' ? 'เสร็จ' : 'ยกเลิก'}
                            </button>
                            <button
                              onClick={() => openBookingModal(item)}
                              className={`px-2 py-1.5 rounded-lg text-xs font-medium ${
                                item.item_status === 'pending' || !item.appointment_date
                                  ? 'bg-pink-500 text-white'
                                  : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                              }`}
                            >
                              {item.item_status === 'pending' || !item.appointment_date ? 'ลงคิว' : 'แก้ไข'}
                            </button>
                          </div>
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
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedOrder && paymentOrderItemId && (
        <PaymentModal
          orderId={selectedOrder.id}
          orderItemId={paymentOrderItemId}
          remainingAmount={remainingAmount}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={handlePaymentSuccess}
        />
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

      {/* Item Edit Modal - Schedule Appointment (ลงคิวช่าง) */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white">
              ลงคิวช่าง: {editingItem.product?.product_name}
            </h3>

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

            <p className="text-sm text-blue-600 dark:text-blue-400">
              * สถานะจะเปลี่ยนเป็น "นัดหมายแล้ว" อัตโนมัติเมื่อบันทึก
            </p>

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

      {/* Status Change Modal */}
      {statusChangeItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white text-center">
              เปลี่ยนสถานะบริการ
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
              {statusChangeItem.product?.product_name}
            </p>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => saveStatusChange('pending')}
                className={`p-4 rounded-xl font-bold transition-all ${
                  statusChangeItem.item_status === 'pending'
                    ? 'bg-gray-300 text-gray-700 ring-2 ring-gray-500'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
                }`}
              >
                รอนัด
              </button>
              <button
                onClick={() => saveStatusChange('scheduled')}
                className={`p-4 rounded-xl font-bold transition-all ${
                  statusChangeItem.item_status === 'scheduled'
                    ? 'bg-blue-600 text-white ring-2 ring-blue-300'
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                }`}
              >
                นัดแล้ว
              </button>
              <button
                onClick={() => saveStatusChange('completed')}
                className={`p-4 rounded-xl font-bold transition-all ${
                  statusChangeItem.item_status === 'completed'
                    ? 'bg-green-600 text-white ring-2 ring-green-300'
                    : 'bg-green-500 text-white hover:bg-green-600'
                }`}
              >
                เสร็จแล้ว
              </button>
              <button
                onClick={() => saveStatusChange('cancelled')}
                className={`p-4 rounded-xl font-bold transition-all ${
                  statusChangeItem.item_status === 'cancelled'
                    ? 'bg-red-600 text-white ring-2 ring-red-300'
                    : 'bg-red-500 text-white hover:bg-red-600'
                }`}
              >
                ยกเลิก
              </button>
            </div>

            <button
              onClick={() => setStatusChangeItem(null)}
              className="w-full btn btn-secondary mt-4"
            >
              ปิด
            </button>
          </div>
        </div>
      )}

      {/* Booking Modal with Chat */}
      {showBookingModal && bookingOrderItem && bookingCustomer && (
        <BookingModal
          orderItem={{
            id: bookingOrderItem.id,
            product_id: bookingOrderItem.product_id,
            item_price: bookingOrderItem.item_price || 0,
            appointment_date: bookingOrderItem.appointment_date,
            artist_id: bookingOrderItem.artist_id,
            products: bookingOrderItem.product ? {
              product_code: bookingOrderItem.product.product_code,
              product_name: bookingOrderItem.product.product_name,
              list_price: bookingOrderItem.product.list_price || 0,
            } : null,
          }}
          customer={{
            id: bookingCustomer.id,
            full_name: bookingCustomer.full_name,
            nickname: bookingCustomer.nickname,
            phone: bookingCustomer.phone,
          }}
          onClose={closeBookingModal}
          onComplete={async () => {
            closeBookingModal()
            await refreshOrders()
          }}
        />
      )}

      {/* Payment History Modal */}
      {showPaymentHistory && selectedOrder && (
        <PaymentHistoryModal
          orderId={selectedOrder.id}
          onClose={() => setShowPaymentHistory(false)}
          onUpdate={async () => {
            await refreshOrders()
          }}
        />
      )}
    </div>
  )
}
