'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import DateRangeFilter from '@/components/date-range-filter'
import { useLanguage } from '@/lib/language-context'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
  Filler,
} from 'chart.js'
import { Pie, Line } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement, Filler)

interface Staff {
  id: number
  staff_name: string
}

interface SalesData {
  id: number
  staff_name: string
  totalSales: number
  realIncome: number  // Deposits (actual income received)
  orderCount: number
  completedOrders: number
  upsellRate: number
  upsellCount: number
  chatCount: number
}

interface ChatCount {
  staff_id: number
  chat_count: number
}

interface DailyData {
  date: string
  booking: number
  income: number
}

export default function SalesPerformancePage() {
  const [allStaff, setAllStaff] = useState<Staff[]>([])
  const [salesData, setSalesData] = useState<SalesData[]>([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedStaffId, setSelectedStaffId] = useState<string>('')

  // Chat count modal
  const [showChatModal, setShowChatModal] = useState(false)
  const [chatDate, setChatDate] = useState('')
  const [chatInputs, setChatInputs] = useState<Record<number, number>>({})
  const [savingChat, setSavingChat] = useState(false)
  // Per-staff daily metrics
  const [walkInCounts, setWalkInCounts] = useState<Record<number, number>>({})
  const [googleReviewCounts, setGoogleReviewCounts] = useState<Record<number, number>>({})
  const [followUpClosedCounts, setFollowUpClosedCounts] = useState<Record<number, number>>({})

  // Daily report
  const [sendingReport, setSendingReport] = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportDate, setReportDate] = useState('')

  // Daily booking/income data for line charts
  const [dailyData, setDailyData] = useState<DailyData[]>([])

  const { t } = useLanguage()
  const supabase = createClient()

  const handleDateChange = (start: string, end: string) => {
    setStartDate(start)
    setEndDate(end)
  }

  useEffect(() => {
    fetchStaffList()
    // Load last 7 days by default
    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - 7)
    const formatDate = (d: Date) => {
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
    setStartDate(formatDate(start))
    setEndDate(formatDate(end))
  }, [])

  useEffect(() => {
    if (startDate && endDate) {
      fetchSalesData()
      fetchDailyData()
    }
  }, [startDate, endDate, selectedStaffId])

  const fetchStaffList = async () => {
    const { data } = await supabase
      .from('staff')
      .select('id, staff_name')
      .in('role', ['sales', 'admin'])
      .eq('is_active', true)
      .order('staff_name')

    setAllStaff(data || [])
  }

  const fetchSalesData = async () => {
    if (!startDate || !endDate) return

    setLoading(true)

    // Get staff to filter
    let staffQuery = supabase
      .from('staff')
      .select('id, staff_name')
      .in('role', ['sales', 'admin'])
      .eq('is_active', true)

    if (selectedStaffId) {
      staffQuery = staffQuery.eq('id', parseInt(selectedStaffId))
    }

    const { data: staff } = await staffQuery

    if (!staff || staff.length === 0) {
      setSalesData([])
      setLoading(false)
      return
    }

    // Get orders within date range (for booking calculation)
    const { data: orders } = await supabase
      .from('orders')
      .select('id, sales_id, order_status, total_income')
      .gte('created_at', `${startDate}T00:00:00`)
      .lte('created_at', `${endDate}T23:59:59`)

    // Get ALL orders to map payments to staff (not filtered by date)
    const { data: allOrders } = await supabase
      .from('orders')
      .select('id, sales_id')

    // Get payments made within date range (by payment_date)
    const { data: payments } = await supabase
      .from('payments')
      .select('order_id, amount')
      .gte('payment_date', startDate)
      .lte('payment_date', endDate)

    // Get order items with upsell
    const { data: orderItems } = await supabase
      .from('order_items')
      .select('order_id, is_upsell')

    // Get chat counts within date range
    const { data: chatCounts } = await supabase
      .from('chat_counts')
      .select('staff_id, chat_count')
      .gte('date', startDate)
      .lte('date', endDate)

    // Calculate stats for each staff
    const salesStats: SalesData[] = staff.map(s => {
      const staffOrders = orders?.filter(o => o.sales_id === s.id) || []
      const staffOrderIds = staffOrders.map(o => o.id)
      const totalSales = staffOrders.reduce((sum, o) => sum + (o.total_income || 0), 0)

      // Calculate real income from payments (by payment_date) - use ALL orders for attribution
      const allStaffOrderIds = allOrders?.filter(o => o.sales_id === s.id).map(o => o.id) || []
      const staffPayments = payments?.filter(p => allStaffOrderIds.includes(p.order_id)) || []
      const realIncome = staffPayments.reduce((sum, p) => sum + (p.amount || 0), 0)

      const completedOrders = staffOrders.filter(o => o.order_status === 'done').length

      // Calculate upsell rate
      const staffItems = orderItems?.filter(i => staffOrderIds.includes(i.order_id)) || []
      const upsellItems = staffItems.filter(i => i.is_upsell).length
      const upsellRate = staffItems.length > 0 ? (upsellItems / staffItems.length) * 100 : 0

      // Count orders with upsell
      const ordersWithUpsell = staffOrders.filter(o =>
        orderItems?.some(i => i.order_id === o.id && i.is_upsell)
      ).length

      // Sum chat counts for this staff in the date range
      const staffChatCounts = chatCounts?.filter(c => c.staff_id === s.id) || []
      const totalChats = staffChatCounts.reduce((sum, c) => sum + (c.chat_count || 0), 0)

      return {
        id: s.id,
        staff_name: s.staff_name,
        totalSales,
        realIncome,
        orderCount: staffOrders.length,
        completedOrders,
        upsellRate,
        upsellCount: ordersWithUpsell,
        chatCount: totalChats,
      }
    })

    // Sort by total sales descending
    salesStats.sort((a, b) => b.totalSales - a.totalSales)
    setSalesData(salesStats)
    setLoading(false)
  }

  // Fetch daily booking/income data for line charts
  const fetchDailyData = async () => {
    if (!startDate || !endDate) return

    // Get all orders within date range (for booking calculation)
    const { data: orders } = await supabase
      .from('orders')
      .select('id, created_at, total_income, sales_id')
      .gte('created_at', `${startDate}T00:00:00`)
      .lte('created_at', `${endDate}T23:59:59`)

    // Get ALL orders to map payments to staff (not filtered by date)
    const { data: allOrders } = await supabase
      .from('orders')
      .select('id, sales_id')

    // Get payments within date range (by payment_date)
    const { data: payments } = await supabase
      .from('payments')
      .select('order_id, amount, payment_date')
      .gte('payment_date', startDate)
      .lte('payment_date', endDate)

    // Filter by staff if selected
    const filteredOrders = selectedStaffId
      ? orders?.filter(o => o.sales_id === parseInt(selectedStaffId))
      : orders

    // Group by date
    const dailyMap: Record<string, { booking: number; income: number }> = {}

    // Generate all dates in range
    const start = new Date(startDate)
    const end = new Date(endDate)
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0]
      dailyMap[dateStr] = { booking: 0, income: 0 }
    }

    // Sum booking (total_income from orders) by date
    filteredOrders?.forEach(order => {
      const dateStr = order.created_at.split('T')[0]
      if (dailyMap[dateStr]) {
        dailyMap[dateStr].booking += order.total_income || 0
      }
    })

    // Sum income (payments) by payment_date - use ALL orders for staff attribution
    if (selectedStaffId) {
      // Get all order IDs for this staff (from all time, not just date range)
      const allStaffOrderIds = allOrders?.filter(o => o.sales_id === parseInt(selectedStaffId)).map(o => o.id) || []
      payments?.forEach(payment => {
        if (allStaffOrderIds.includes(payment.order_id)) {
          const dateStr = payment.payment_date
          if (dailyMap[dateStr]) {
            dailyMap[dateStr].income += payment.amount || 0
          }
        }
      })
    } else {
      // No staff filter - sum all payments
      payments?.forEach(payment => {
        const dateStr = payment.payment_date
        if (dailyMap[dateStr]) {
          dailyMap[dateStr].income += payment.amount || 0
        }
      })
    }

    // Convert to array and sort by date
    const daily = Object.entries(dailyMap)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date))

    setDailyData(daily)
  }

  const fetchAllSalesData = async () => {
    setLoading(true)
    setStartDate('')
    setEndDate('')

    // Get all staff to filter
    let staffQuery = supabase
      .from('staff')
      .select('id, staff_name')
      .in('role', ['sales', 'admin'])
      .eq('is_active', true)

    if (selectedStaffId) {
      staffQuery = staffQuery.eq('id', parseInt(selectedStaffId))
    }

    const { data: staff } = await staffQuery

    if (!staff || staff.length === 0) {
      setSalesData([])
      setDailyData([])
      setLoading(false)
      return
    }

    // Get ALL orders (no date filter)
    const { data: orders } = await supabase
      .from('orders')
      .select('id, sales_id, order_status, total_income, created_at')

    // Get ALL payments (no date filter)
    const { data: payments } = await supabase
      .from('payments')
      .select('order_id, amount, payment_date')

    // Get all order items with upsell
    const { data: orderItems } = await supabase
      .from('order_items')
      .select('order_id, is_upsell')

    // Get ALL chat counts (no date filter)
    const { data: chatCounts } = await supabase
      .from('chat_counts')
      .select('staff_id, chat_count')

    // Calculate stats for each staff
    const salesStats: SalesData[] = staff.map(s => {
      const staffOrders = orders?.filter(o => o.sales_id === s.id) || []
      const staffOrderIds = staffOrders.map(o => o.id)
      const totalSales = staffOrders.reduce((sum, o) => sum + (o.total_income || 0), 0)

      // Calculate real income from ALL payments
      const staffPayments = payments?.filter(p => staffOrderIds.includes(p.order_id)) || []
      const realIncome = staffPayments.reduce((sum, p) => sum + (p.amount || 0), 0)

      const completedOrders = staffOrders.filter(o => o.order_status === 'done').length

      // Calculate upsell rate
      const staffItems = orderItems?.filter(i => staffOrderIds.includes(i.order_id)) || []
      const upsellItems = staffItems.filter(i => i.is_upsell).length
      const upsellRate = staffItems.length > 0 ? (upsellItems / staffItems.length) * 100 : 0

      // Count orders with upsell
      const ordersWithUpsell = staffOrders.filter(o =>
        orderItems?.some(i => i.order_id === o.id && i.is_upsell)
      ).length

      // Sum ALL chat counts for this staff
      const staffChatCounts = chatCounts?.filter(c => c.staff_id === s.id) || []
      const totalChats = staffChatCounts.reduce((sum, c) => sum + (c.chat_count || 0), 0)

      return {
        id: s.id,
        staff_name: s.staff_name,
        totalSales,
        realIncome,
        orderCount: staffOrders.length,
        completedOrders,
        upsellRate,
        upsellCount: ordersWithUpsell,
        chatCount: totalChats,
      }
    })

    // Sort by total sales descending
    salesStats.sort((a, b) => b.totalSales - a.totalSales)
    setSalesData(salesStats)
    setDailyData([]) // Clear daily data when showing all
    setLoading(false)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  // Pie chart colors
  const pieColors = [
    'rgba(236, 72, 153, 0.8)',  // pink
    'rgba(59, 130, 246, 0.8)',   // blue
    'rgba(34, 197, 94, 0.8)',    // green
    'rgba(249, 115, 22, 0.8)',   // orange
    'rgba(139, 92, 246, 0.8)',   // purple
    'rgba(236, 201, 75, 0.8)',   // yellow
    'rgba(20, 184, 166, 0.8)',   // teal
    'rgba(239, 68, 68, 0.8)',    // red
  ]

  // Pie Chart - Booking by Staff
  const bookingPieData = {
    labels: salesData.map(s => s.staff_name),
    datasets: [
      {
        data: salesData.map(s => s.totalSales),
        backgroundColor: pieColors.slice(0, salesData.length),
        borderWidth: 2,
        borderColor: '#fff',
      },
    ],
  }

  // Pie Chart - Orders by Staff
  const ordersPieData = {
    labels: salesData.map(s => s.staff_name),
    datasets: [
      {
        data: salesData.map(s => s.orderCount),
        backgroundColor: pieColors.slice(0, salesData.length),
        borderWidth: 2,
        borderColor: '#fff',
      },
    ],
  }

  // Line Chart - Booking over time
  const bookingLineData = {
    labels: dailyData.map(d => {
      const date = new Date(d.date)
      return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
    }),
    datasets: [
      {
        label: 'Booking (฿)',
        data: dailyData.map(d => d.booking),
        borderColor: 'rgba(236, 72, 153, 1)',
        backgroundColor: 'rgba(236, 72, 153, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  }

  // Line Chart - Income over time
  const incomeLineData = {
    labels: dailyData.map(d => {
      const date = new Date(d.date)
      return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
    }),
    datasets: [
      {
        label: 'Income (฿)',
        data: dailyData.map(d => d.income),
        borderColor: 'rgba(34, 197, 94, 1)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  }

  // Pie Chart - Income by Staff (using deposits/real income)
  const incomePieData = {
    labels: salesData.map(s => s.staff_name),
    datasets: [
      {
        data: salesData.map(s => s.realIncome),  // Use actual income from deposits
        backgroundColor: pieColors.slice(0, salesData.length),
        borderWidth: 2,
        borderColor: '#fff',
      },
    ],
  }

  // Helper to format local date (Thailand time)
  const formatLocalDate = (d: Date) => {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Open chat count modal
  const openChatModal = () => {
    const today = formatLocalDate(new Date())
    setChatDate(today)
    setChatInputs({})
    setWalkInCounts({})
    setGoogleReviewCounts({})
    setFollowUpClosedCounts({})
    setShowChatModal(true)
    loadChatCountsForDate(today)
  }

  // Load existing chat counts for a date
  const loadChatCountsForDate = async (date: string) => {
    const { data } = await supabase
      .from('chat_counts')
      .select('staff_id, chat_count, walk_in_count, google_review_count, follow_up_closed')
      .eq('date', date)

    const inputs: Record<number, number> = {}
    const walkIns: Record<number, number> = {}
    const googleReviews: Record<number, number> = {}
    const followUps: Record<number, number> = {}

    data?.forEach(c => {
      inputs[c.staff_id] = c.chat_count || 0
      walkIns[c.staff_id] = c.walk_in_count || 0
      googleReviews[c.staff_id] = c.google_review_count || 0
      followUps[c.staff_id] = c.follow_up_closed || 0
    })

    setChatInputs(inputs)
    setWalkInCounts(walkIns)
    setGoogleReviewCounts(googleReviews)
    setFollowUpClosedCounts(followUps)
  }

  // Save chat counts
  const saveChatCounts = async () => {
    if (!chatDate) return

    setSavingChat(true)

    try {
      // Get all sales staff
      const salesStaffIds = allStaff.map(s => s.id)
      const errors: string[] = []

      // Upsert chat counts for each staff
      for (const staffId of salesStaffIds) {
        const chatCount = chatInputs[staffId] || 0
        const walkInCount = walkInCounts[staffId] || 0
        const googleReviewCount = googleReviewCounts[staffId] || 0
        const followUpClosed = followUpClosedCounts[staffId] || 0

        // First try to check if record exists
        const { data: existing } = await supabase
          .from('chat_counts')
          .select('id')
          .eq('staff_id', staffId)
          .eq('date', chatDate)
          .maybeSingle()

        let error
        if (existing) {
          // Update existing record
          const updateData: any = {
            chat_count: chatCount,
            walk_in_count: walkInCount,
            google_review_count: googleReviewCount,
            follow_up_closed: followUpClosed,
            updated_at: new Date().toISOString()
          }
          const result = await supabase
            .from('chat_counts')
            .update(updateData)
            .eq('id', existing.id)
          error = result.error
        } else {
          // Insert new record
          const insertData: any = {
            staff_id: staffId,
            date: chatDate,
            chat_count: chatCount,
            walk_in_count: walkInCount,
            google_review_count: googleReviewCount,
            follow_up_closed: followUpClosed,
          }
          const result = await supabase
            .from('chat_counts')
            .insert(insertData)
          error = result.error
        }

        if (error) {
          console.error(`Error saving chat count for staff ${staffId}:`, error)
          errors.push(`Staff ID ${staffId}: ${error.message}`)
        }
      }

      if (errors.length > 0) {
        alert(`เกิดข้อผิดพลาด:\n${errors.join('\n')}`)
      } else {
        setShowChatModal(false)
        // Refresh data
        fetchSalesData()
      }
    } catch (err) {
      console.error('Save chat count error:', err)
      alert('เกิดข้อผิดพลาดในการบันทึก')
    } finally {
      setSavingChat(false)
    }
  }

  // Open daily report modal
  const openReportModal = () => {
    const today = formatLocalDate(new Date())
    setReportDate(today)
    setShowReportModal(true)
  }

  // Send daily report via LINE
  const sendDailyReport = async () => {
    if (!reportDate) return

    setSendingReport(true)

    try {
      const response = await fetch('/api/daily-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: reportDate }),
      })

      const result = await response.json()

      if (result.success) {
        alert('ส่ง Daily Report ไป LINE สำเร็จ!')
        setShowReportModal(false)
      } else {
        alert(`ไม่สามารถส่ง Report: ${result.error}`)
      }
    } catch (err) {
      console.error('Send report error:', err)
      alert('เกิดข้อผิดพลาดในการส่ง Report')
    } finally {
      setSendingReport(false)
    }
  }

  const pieChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          boxWidth: 12,
          padding: 10,
        },
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const value = context.raw as number
            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0)
            const percentage = ((value / total) * 100).toFixed(1)
            return `${context.label}: ${formatCurrency(value)} (${percentage}%)`
          },
        },
      },
    },
  }

  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            return `${context.dataset.label}: ${formatCurrency(context.raw)}`
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value: any) => formatCurrency(value),
        },
      },
    },
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">{t('sales.title')}</h1>
        <p className="text-gray-500 dark:text-gray-400">{t('sales.subtitle')}</p>
      </div>

      {/* Filters */}
      <div className="card space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <DateRangeFilter onDateChange={handleDateChange} onShowAll={fetchAllSalesData} />

          {/* Staff Filter */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('sales.filterByStaff')}:
              </label>
              <select
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
                className="select min-w-[200px]"
              >
                <option value="">{t('sales.allStaff')}</option>
                {allStaff.map(staff => (
                  <option key={staff.id} value={staff.id}>
                    {staff.staff_name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={openChatModal}
              className="btn btn-secondary"
            >
              + บันทึกจำนวนแชท
            </button>
            <button
              type="button"
              onClick={openReportModal}
              className="btn btn-primary"
            >
              📊 ส่ง Daily Report
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">{t('common.loading')}</p>
        </div>
      ) : (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="card">
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('sales.totalSales')}</p>
              <p className="text-2xl font-bold text-pink-600 mt-1">
                {formatCurrency(salesData.reduce((sum, s) => sum + s.totalSales, 0))}
              </p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500 dark:text-gray-400">Income (ยอดรับจริง)</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {formatCurrency(salesData.reduce((sum, s) => sum + s.realIncome, 0))}
              </p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('sales.totalOrders')}</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-white mt-1">
                {salesData.reduce((sum, s) => sum + s.orderCount, 0)}
              </p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500 dark:text-gray-400">จำนวนแชททั้งหมด</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">
                {salesData.reduce((sum, s) => sum + s.chatCount, 0)}
              </p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500 dark:text-gray-400">Avg Conversion Rate</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">
                {(() => {
                  const totalChats = salesData.reduce((sum, s) => sum + s.chatCount, 0)
                  const totalOrders = salesData.reduce((sum, s) => sum + s.orderCount, 0)
                  return totalChats > 0 ? ((totalOrders / totalChats) * 100).toFixed(1) : '0'
                })()}%
              </p>
            </div>
          </div>

          {/* Booking Section */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
              📊 Booking (ยอดขาย)
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Booking Pie Chart */}
              <div className="card">
                <h3 className="font-bold text-gray-800 dark:text-white mb-4">Booking ตาม Staff</h3>
                <div className="h-64">
                  {salesData.length > 0 ? (
                    <Pie data={bookingPieData} options={pieChartOptions} />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400">
                      {t('sales.noData')}
                    </div>
                  )}
                </div>
              </div>

              {/* Booking Line Chart */}
              <div className="card">
                <h3 className="font-bold text-gray-800 dark:text-white mb-4">Booking ตามเวลา</h3>
                <div className="h-64">
                  {dailyData.length > 0 ? (
                    <Line data={bookingLineData} options={lineChartOptions} />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400">
                      {t('sales.noData')}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Income Section */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
              💰 Income (รายได้จริง)
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Income Pie Chart */}
              <div className="card">
                <h3 className="font-bold text-gray-800 dark:text-white mb-4">Income ตาม Staff</h3>
                <div className="h-64">
                  {salesData.length > 0 ? (
                    <Pie data={incomePieData} options={pieChartOptions} />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400">
                      {t('sales.noData')}
                    </div>
                  )}
                </div>
              </div>

              {/* Income Line Chart */}
              <div className="card">
                <h3 className="font-bold text-gray-800 dark:text-white mb-4">Income ตามเวลา</h3>
                <div className="h-64">
                  {dailyData.length > 0 ? (
                    <Line data={incomeLineData} options={lineChartOptions} />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400">
                      {t('sales.noData')}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Orders Section */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
              📦 Orders (จำนวน Order)
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Orders Pie Chart */}
              <div className="card">
                <h3 className="font-bold text-gray-800 dark:text-white mb-4">Orders ตาม Staff</h3>
                <div className="h-64">
                  {salesData.length > 0 ? (
                    <Pie data={ordersPieData} options={pieChartOptions} />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400">
                      {t('sales.noData')}
                    </div>
                  )}
                </div>
              </div>

              {/* Summary Card */}
              <div className="card">
                <h3 className="font-bold text-gray-800 dark:text-white mb-4">สรุปยอดรวม</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-pink-50 dark:bg-pink-900/20 rounded-lg">
                    <span className="text-gray-600 dark:text-gray-300">Total Booking</span>
                    <span className="text-xl font-bold text-pink-600">
                      {formatCurrency(dailyData.reduce((sum, d) => sum + d.booking, 0))}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <span className="text-gray-600 dark:text-gray-300">Total Income</span>
                    <span className="text-xl font-bold text-green-600">
                      {formatCurrency(dailyData.reduce((sum, d) => sum + d.income, 0))}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <span className="text-gray-600 dark:text-gray-300">Total Orders</span>
                    <span className="text-xl font-bold text-blue-600">
                      {salesData.reduce((sum, s) => sum + s.orderCount, 0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Staff Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {salesData.map((sales, index) => {
              const avgPerOrder = sales.orderCount > 0 ? sales.totalSales / sales.orderCount : 0
              const conversionRate = sales.chatCount > 0
                ? (sales.orderCount / sales.chatCount) * 100
                : 0

              return (
                <div key={sales.id} className="card relative">
                  {/* Rank Badge */}
                  {index < 3 && !selectedStaffId && (
                    <div className={`absolute -top-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                      index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : 'bg-amber-600'
                    }`}>
                      {index + 1}
                    </div>
                  )}

                  <div className="text-lg font-bold text-gray-800 dark:text-white mb-4">{sales.staff_name}</div>

                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">{t('sales.totalSales')}</span>
                      <span className="font-bold text-pink-600">{formatCurrency(sales.totalSales)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Income (รับจริง)</span>
                      <span className="font-bold text-green-600">{formatCurrency(sales.realIncome)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Orders</span>
                      <span className="font-medium text-gray-800 dark:text-white">{sales.orderCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">จำนวนแชท</span>
                      <span className="font-medium text-blue-600">{sales.chatCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Conversion Rate</span>
                      <span className="font-medium text-purple-600">{conversionRate.toFixed(1)}%</span>
                    </div>
                    <div className="pt-2 border-t dark:border-gray-700">
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">{t('sales.avgPerOrder')}</span>
                        <span className="font-medium text-gray-800 dark:text-white">{formatCurrency(avgPerOrder)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}

            {salesData.length === 0 && (
              <div className="col-span-full text-center text-gray-500 dark:text-gray-400 py-12">
                {t('sales.noData')}
              </div>
            )}
          </div>
        </>
      )}

      {/* Chat Count Modal */}
      {showChatModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">บันทึกจำนวนแชท</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">วันที่</label>
              <input
                type="date"
                value={chatDate}
                onChange={(e) => {
                  setChatDate(e.target.value)
                  loadChatCountsForDate(e.target.value)
                }}
                className="input w-full"
              />
            </div>

            {/* Staff Data Entry */}
            <div className="space-y-4 mb-4">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">ข้อมูลแต่ละคน Sales</p>
              {allStaff.map(staff => (
                <div key={staff.id} className="border dark:border-gray-600 rounded-lg p-4 space-y-3">
                  <div className="font-bold text-gray-800 dark:text-white mb-3">{staff.staff_name}</div>

                  {/* Chat Count */}
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm text-gray-600 dark:text-gray-300">💬 แชท</span>
                    <input
                      type="number"
                      min="0"
                      value={chatInputs[staff.id] || ''}
                      onChange={(e) => setChatInputs({
                        ...chatInputs,
                        [staff.id]: parseInt(e.target.value) || 0
                      })}
                      placeholder="0"
                      className="input w-20 text-center"
                    />
                  </div>

                  {/* Walk-in */}
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm text-gray-600 dark:text-gray-300">🚶 รับลูกค้าหน้าร้าน</span>
                    <input
                      type="number"
                      min="0"
                      value={walkInCounts[staff.id] || ''}
                      onChange={(e) => setWalkInCounts({
                        ...walkInCounts,
                        [staff.id]: parseInt(e.target.value) || 0
                      })}
                      placeholder="0"
                      className="input w-20 text-center"
                    />
                  </div>

                  {/* Google Reviews */}
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm text-gray-600 dark:text-gray-300">⭐ Google reviews</span>
                    <input
                      type="number"
                      min="0"
                      value={googleReviewCounts[staff.id] || ''}
                      onChange={(e) => setGoogleReviewCounts({
                        ...googleReviewCounts,
                        [staff.id]: parseInt(e.target.value) || 0
                      })}
                      placeholder="0"
                      className="input w-20 text-center"
                    />
                  </div>

                  {/* Follow-up Closed */}
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm text-gray-600 dark:text-gray-300">📞 Closed from follow-up</span>
                    <input
                      type="number"
                      min="0"
                      value={followUpClosedCounts[staff.id] || ''}
                      onChange={(e) => setFollowUpClosedCounts({
                        ...followUpClosedCounts,
                        [staff.id]: parseInt(e.target.value) || 0
                      })}
                      placeholder="0"
                      className="input w-20 text-center"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowChatModal(false)}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                disabled={savingChat}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={saveChatCounts}
                className="flex-1 px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 disabled:opacity-50"
                disabled={savingChat}
              >
                {savingChat ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Daily Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">📊 ส่ง Daily Report ไป LINE</h3>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">เลือกวันที่</label>
              <input
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                className="input w-full"
              />
              <p className="text-xs text-gray-500 mt-2">
                Report จะถูกส่งไปยัง LINE ที่ตั้งค่าไว้
              </p>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-6">
              <p className="text-sm font-medium text-gray-800 dark:text-white mb-2">ข้อมูลที่จะส่ง:</p>
              <ul className="text-xs text-gray-600 dark:text-gray-300 space-y-1">
                <li>• สรุปภาพรวม (Chat, Orders, CR%)</li>
                <li>• ยอด Booking / Paid / Done</li>
                <li>• รายได้จริงวันนี้</li>
                <li>• ผลงาน Sales แต่ละคน</li>
                <li>• บริการที่ขายได้</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                disabled={sendingReport}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={sendDailyReport}
                className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
                disabled={sendingReport}
              >
                {sendingReport ? 'กำลังส่ง...' : '📤 ส่ง Report'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
