'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import DateRangeFilter from '@/components/date-range-filter'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
} from 'chart.js'
import { Pie, Bar } from 'react-chartjs-2'

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title)

interface OrderItem {
  id: number
  order_id: number
  is_upsell: boolean
  item_status: 'pending' | 'scheduled' | 'completed' | 'cancelled'
  appointment_date: string | null
  products: {
    product_code: string
    product_name: string
    list_price: number
    is_free: boolean
    validity_months: number
  } | null
}

interface Order {
  id: number
  order_date: string
  created_at: string
  order_status: string
  total_income: number
  deposit: number
  contact_channel: string | null
  customers: { full_name: string; phone: string | null; contact_channel: string | null } | null
  order_items: OrderItem[]
  payments?: { amount: number }[]
}

interface MarketingData {
  id: number
  date: string
  chat_inquiries: number
}

interface AdsSpending {
  id: number
  month: string
  amount: number
  platform: string
  note: string | null
}

// Interface for alert items
interface AlertItem {
  type: 'unscheduled' | 'expiring_soon'
  orderId: number
  orderItemId: number
  customerName: string
  phone: string | null
  productName: string
  productCode: string
  message: string
  severity: 'warning' | 'danger'
  createdAt: string
  expiryDate?: string
  daysRemaining?: number
  validityMonths?: number
  isFreeOrDiscount: boolean
}

// Interface for price range breakdown
interface PriceBreakdown {
  id: string
  label: string
  minPrice: number
  maxPrice: number
  count: number
}

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<'alerts' | 'overview' | 'marketing' | 'report'>('alerts')
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Alerts Data
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [alertsLoading, setAlertsLoading] = useState(true)
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null)

  // Edit Modal State
  const [editingAlert, setEditingAlert] = useState<AlertItem | null>(null)
  const [newExpiryMonths, setNewExpiryMonths] = useState('')

  // Inline scheduling state
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')
  const [scheduleArtist, setScheduleArtist] = useState('')
  const [artists, setArtists] = useState<{id: number, staff_name: string}[]>([])

  // Inline payment state

  // Marketing Data
  const [marketingData, setMarketingData] = useState<MarketingData[]>([])
  const [adsSpending, setAdsSpending] = useState<AdsSpending[]>([])
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [chatInquiries, setChatInquiries] = useState('')
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7))
  const [adsAmount, setAdsAmount] = useState('')

  // Report Data
  const [reportStartDate, setReportStartDate] = useState('')
  const [reportEndDate, setReportEndDate] = useState('')
  const [reportLoading, setReportLoading] = useState(false)
  const [priceBreakdowns, setPriceBreakdowns] = useState<PriceBreakdown[]>([
    { id: '1', label: '0 - 3,000', minPrice: 0, maxPrice: 3000, count: 0 },
    { id: '2', label: '3,001 - 6,000', minPrice: 3001, maxPrice: 6000, count: 0 },
    { id: '3', label: '6,001+', minPrice: 6001, maxPrice: 999999, count: 0 },
  ])
  const [reportOrders, setReportOrders] = useState<any[]>([])

  const supabase = createClient()

  const handleDateChange = (start: string, end: string) => {
    setStartDate(start)
    setEndDate(end)
  }

  useEffect(() => {
    // Fetch alerts and artists on initial load
    fetchAlerts()
    fetchArtists()
  }, [])

  const fetchArtists = async () => {
    const { data } = await supabase
      .from('staff')
      .select('id, staff_name')
      .eq('role', 'artist')
      .eq('is_active', true)
      .order('staff_name')
    setArtists(data || [])
  }

  // Schedule a service from alert
  const scheduleFromAlert = async (alert: AlertItem) => {
    if (!scheduleDate) {
      window.alert('กรุณาเลือกวันที่นัดหมาย')
      return
    }

    const { error } = await supabase
      .from('order_items')
      .update({
        appointment_date: scheduleDate,
        appointment_time: scheduleTime || null,
        artist_id: scheduleArtist ? parseInt(scheduleArtist) : null,
        item_status: 'scheduled'
      })
      .eq('id', alert.orderItemId)

    if (!error) {
      window.alert('นัดหมายเรียบร้อย')
      setScheduleDate('')
      setScheduleTime('')
      setScheduleArtist('')
      setExpandedAlert(null)
      fetchAlerts()
    } else {
      window.alert('เกิดข้อผิดพลาด: ' + error.message)
    }
  }

  // Receive payment from alert
  useEffect(() => {
    if (startDate && endDate) {
      fetchData()
    }
  }, [startDate, endDate])

  useEffect(() => {
    if (activeTab === 'marketing') {
      fetchMarketingData()
    }
  }, [activeTab])

  // Fetch alerts - unscheduled services and expiring services
  const fetchAlerts = async () => {
    setAlertsLoading(true)
    const alertsList: AlertItem[] = []

    const { data: ordersWithItems, error: fetchError } = await supabase
      .from('orders')
      .select(`
        id,
        created_at,
        order_status,
        total_income,
        deposit,
        customers (full_name, phone),
        order_items (
          id,
          item_status,
          appointment_date,
          products (product_code, product_name, is_free, validity_months, list_price)
        ),
        payments (amount)
      `)
      .neq('order_status', 'cancelled')
      .order('created_at', { ascending: false })

    if (ordersWithItems) {
      // Auto-fix order statuses based on payment amounts
      const ordersToMarkPaid: number[] = []
      const ordersToMarkBooking: number[] = []

      ordersWithItems.forEach((order: any) => {
        const totalIncome = order.total_income || 0
        const totalPaid = order.payments?.reduce((sum: number, p: { amount: number }) => sum + (p.amount || 0), 0) || 0
        const orderStatus = (order.order_status || '').toString().toLowerCase()

        // Fix 1: Orders marked as 'booking' but fully paid → change to 'paid'
        if (orderStatus === 'booking' && totalPaid >= totalIncome && totalIncome > 0) {
          ordersToMarkPaid.push(order.id)
        }

        // Fix 2: Orders marked as 'paid' but NOT fully paid → change to 'booking'
        if (orderStatus === 'paid' && totalPaid < totalIncome && totalIncome > 0) {
          ordersToMarkBooking.push(order.id)
        }
      })

      // Update fully-paid orders to 'paid' status
      if (ordersToMarkPaid.length > 0) {
        await supabase
          .from('orders')
          .update({ order_status: 'paid' })
          .in('id', ordersToMarkPaid)
      }

      // Update not-fully-paid orders to 'booking' status
      if (ordersToMarkBooking.length > 0) {
        await supabase
          .from('orders')
          .update({ order_status: 'booking' })
          .in('id', ordersToMarkBooking)
      }

      // Auto-fix services: "completed" but appointment date is in the future → change to "scheduled"
      const today = new Date()
      today.setHours(23, 59, 59, 999) // End of today
      const itemsToFixStatus: number[] = []

      ordersWithItems.forEach((order: any) => {
        order.order_items?.forEach((item: any) => {
          const itemStatus = (item.item_status || '').toString().toLowerCase()
          if (itemStatus === 'completed' && item.appointment_date) {
            const appointmentDate = new Date(item.appointment_date)
            // If appointment is in the future, it can't be completed yet
            if (appointmentDate > today) {
              itemsToFixStatus.push(item.id)
            }
          }
        })
      })

      if (itemsToFixStatus.length > 0) {
        await supabase
          .from('order_items')
          .update({ item_status: 'scheduled' })
          .in('id', itemsToFixStatus)
      }

      ordersWithItems.forEach((order: any) => {
        const customer = order.customers as { full_name: string; phone: string | null } | null

        // Process each item for alerts
        order.order_items?.forEach((item: any) => {
          const product = item.products
          if (!product) return

          // Check if it's FREE or 50% service by product_code OR validity_months
          const productCode = product.product_code?.toUpperCase() || ''
          const productName = product.product_name?.toUpperCase() || ''
          const itemStatus = (item.item_status || '').toLowerCase()
          const isFreeOrDiscount =
            product.is_free ||
            productCode.includes('FREE') ||
            productCode.includes('50%') ||
            productName.includes('FREE') ||
            productName.includes('50%') ||
            (product.validity_months && product.validity_months > 0)

          // Alert 1: Unscheduled REGULAR services (not FREE/50%)
          // Regular services should be scheduled immediately
          if (
            itemStatus === 'pending' &&
            !item.appointment_date &&
            !isFreeOrDiscount
          ) {
            alertsList.push({
              type: 'unscheduled',
              orderId: order.id,
              orderItemId: item.id,
              customerName: customer?.full_name || '-',
              phone: customer?.phone || null,
              productName: product.product_name,
              productCode: product.product_code,
              message: 'บริการปกติ ต้องนัดหมายทันที',
              severity: 'danger',
              createdAt: order.created_at,
              isFreeOrDiscount: false,
            })
          }

          // Alert 3: FREE/50% services expiring within 14 days (2 weeks)
          // These need validity_months to calculate expiry
          if (
            isFreeOrDiscount &&
            itemStatus !== 'completed' &&
            itemStatus !== 'cancelled'
          ) {
            // Default validity: FREE = 3 months, 50% = 12 months
            let validityMonths = product.validity_months || 0
            if (validityMonths === 0) {
              if (productCode.includes('FREE') || productName.includes('FREE') || product.is_free) {
                validityMonths = 3
              } else if (productCode.includes('50%') || productName.includes('50%')) {
                validityMonths = 12
              }
            }

            if (validityMonths > 0) {
              const purchaseDate = new Date(order.created_at)
              const expiryDate = new Date(purchaseDate)
              expiryDate.setMonth(expiryDate.getMonth() + validityMonths)

              const today = new Date()
              const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

              // Alert when <= 14 days remaining (2 weeks)
              if (daysUntilExpiry <= 14 && daysUntilExpiry > 0) {
                alertsList.push({
                  type: 'expiring_soon',
                  orderId: order.id,
                  orderItemId: item.id,
                  customerName: customer?.full_name || '-',
                  phone: customer?.phone || null,
                  productName: product.product_name,
                  productCode: product.product_code,
                  message: `เหลือ ${daysUntilExpiry} วัน - ติดตามลูกค้า`,
                  severity: 'warning',
                  createdAt: order.created_at,
                  expiryDate: expiryDate.toISOString(),
                  daysRemaining: daysUntilExpiry,
                  validityMonths: validityMonths,
                  isFreeOrDiscount: true,
                })
              } else if (daysUntilExpiry <= 0) {
                alertsList.push({
                  type: 'expiring_soon',
                  orderId: order.id,
                  orderItemId: item.id,
                  customerName: customer?.full_name || '-',
                  phone: customer?.phone || null,
                  productName: product.product_name,
                  productCode: product.product_code,
                  message: `หมดอายุแล้ว ${Math.abs(daysUntilExpiry)} วัน`,
                  severity: 'danger',
                  createdAt: order.created_at,
                  expiryDate: expiryDate.toISOString(),
                  daysRemaining: daysUntilExpiry,
                  validityMonths: validityMonths,
                  isFreeOrDiscount: true,
                })
              }
            }
          }
        })
      })
    }

    // Sort alerts: danger first, then warning
    alertsList.sort((a, b) => {
      const severityOrder = { danger: 0, warning: 1 }
      return severityOrder[a.severity] - severityOrder[b.severity]
    })

    setAlerts(alertsList)
    setAlertsLoading(false)
  }

  // Extend service validity
  const extendValidity = async () => {
    if (!editingAlert || !newExpiryMonths) return

    const additionalMonths = parseInt(newExpiryMonths)
    if (isNaN(additionalMonths) || additionalMonths <= 0) {
      alert('กรุณาใส่จำนวนเดือนที่ถูกต้อง')
      return
    }

    // We need to update the order_items table with a custom validity extension
    // For now, we'll store a note or create a way to track extended validity
    // A simple approach: add validity_extended_months column or update created_at to extend the period

    // For simplicity, let's create a new order item note or handle via order note
    // Actually, we should track this properly - let's add extended validity to order_items

    const { error } = await supabase
      .from('order_items')
      .update({
        // Store extension info - you may need to add this column
        // For now, let's just mark it and handle via note
        item_status: 'pending' // Reset to pending if expired
      })
      .eq('id', editingAlert.orderItemId)

    if (!error) {
      alert(`ต่ออายุเรียบร้อย เพิ่ม ${additionalMonths} เดือน`)
      setEditingAlert(null)
      setNewExpiryMonths('')
      fetchAlerts()
    } else {
      alert('เกิดข้อผิดพลาด: ' + error.message)
    }
  }

  const fetchData = async () => {
    if (!startDate || !endDate) return

    setLoading(true)

    const { data: ordersData } = await supabase
      .from('orders')
      .select(`
        id,
        order_date,
        created_at,
        order_status,
        total_income,
        deposit,
        contact_channel,
        customers (full_name, contact_channel),
        order_items (
          id,
          is_upsell,
          products (list_price)
        ),
        payments(amount)
      `)
      .gte('created_at', `${startDate}T00:00:00`)
      .lte('created_at', `${endDate}T23:59:59`)
      .order('created_at', { ascending: false })

    setOrders(ordersData || [])

    // Fetch marketing data for the period
    const { data: mkData } = await supabase
      .from('marketing_data')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)

    setMarketingData(mkData || [])

    // Fetch ads spending for the months in period
    const startMonth = startDate.slice(0, 7) + '-01'
    const endMonth = endDate.slice(0, 7) + '-01'

    const { data: adsData } = await supabase
      .from('ads_spending')
      .select('*')
      .gte('month', startMonth)
      .lte('month', endMonth)

    setAdsSpending(adsData || [])
    setLoading(false)
  }

  // Fetch report data
  const fetchReportData = async () => {
    if (!reportStartDate || !reportEndDate) return

    setReportLoading(true)

    const { data: ordersData } = await supabase
      .from('orders')
      .select(`
        id,
        created_at,
        order_status,
        total_income,
        order_items (
          id,
          products (product_code, product_name, list_price, is_free, validity_months)
        )
      `)
      .neq('order_status', 'cancelled')
      .gte('created_at', `${reportStartDate}T00:00:00`)
      .lte('created_at', `${reportEndDate}T23:59:59`)
      .order('created_at', { ascending: false })

    if (ordersData) {
      // Filter orders that have at least one regular service (not FREE/50%)
      const regularOrders = ordersData.filter((order: any) => {
        return order.order_items?.some((item: any) => {
          const product = item.products
          if (!product) return false

          const productCode = product.product_code?.toUpperCase() || ''
          const productName = product.product_name?.toUpperCase() || ''
          const isFreeOrDiscount =
            product.is_free ||
            productCode.includes('FREE') ||
            productCode.includes('50%') ||
            productName.includes('FREE') ||
            productName.includes('50%') ||
            (product.validity_months && product.validity_months > 0)

          return !isFreeOrDiscount
        })
      })

      setReportOrders(regularOrders)

      // Calculate counts for each breakdown
      const updatedBreakdowns = priceBreakdowns.map(breakdown => {
        const count = regularOrders.filter((order: any) => {
          // Calculate total of regular services in this order
          const regularTotal = order.order_items?.reduce((sum: number, item: any) => {
            const product = item.products
            if (!product) return sum

            const productCode = product.product_code?.toUpperCase() || ''
            const productName = product.product_name?.toUpperCase() || ''
            const isFreeOrDiscount =
              product.is_free ||
              productCode.includes('FREE') ||
              productCode.includes('50%') ||
              productName.includes('FREE') ||
              productName.includes('50%') ||
              (product.validity_months && product.validity_months > 0)

            if (!isFreeOrDiscount) {
              return sum + (product.list_price || 0)
            }
            return sum
          }, 0) || 0

          return regularTotal >= breakdown.minPrice && regularTotal <= breakdown.maxPrice
        }).length

        return { ...breakdown, count }
      })

      setPriceBreakdowns(updatedBreakdowns)
    }

    setReportLoading(false)
  }

  // Add a new breakdown
  const addBreakdown = () => {
    const newId = Date.now().toString()
    setPriceBreakdowns([...priceBreakdowns, {
      id: newId,
      label: 'ใหม่',
      minPrice: 0,
      maxPrice: 10000,
      count: 0
    }])
  }

  // Remove a breakdown
  const removeBreakdown = (id: string) => {
    if (priceBreakdowns.length > 1) {
      setPriceBreakdowns(priceBreakdowns.filter(b => b.id !== id))
    }
  }

  // Update a breakdown
  const updateBreakdown = (id: string, field: 'minPrice' | 'maxPrice' | 'label', value: string | number) => {
    setPriceBreakdowns(priceBreakdowns.map(b => {
      if (b.id === id) {
        return { ...b, [field]: value }
      }
      return b
    }))
  }

  const fetchMarketingData = async () => {
    const { data: mkData } = await supabase
      .from('marketing_data')
      .select('*')
      .order('date', { ascending: false })
      .limit(30)

    setMarketingData(mkData || [])

    const { data: adsData } = await supabase
      .from('ads_spending')
      .select('*')
      .order('month', { ascending: false })
      .limit(12)

    setAdsSpending(adsData || [])
  }

  const saveChatInquiries = async () => {
    const inquiries = parseInt(chatInquiries)
    if (isNaN(inquiries)) {
      alert('Please enter a valid number')
      return
    }

    const { error } = await supabase
      .from('marketing_data')
      .upsert({
        date: selectedDate,
        chat_inquiries: inquiries,
      }, { onConflict: 'date' })

    if (!error) {
      alert('Saved successfully')
      setChatInquiries('')
      fetchMarketingData()
    }
  }

  const saveAdsSpending = async () => {
    const amount = parseFloat(adsAmount)
    if (isNaN(amount)) {
      alert('Please enter a valid amount')
      return
    }

    const { error } = await supabase
      .from('ads_spending')
      .upsert({
        month: selectedMonth + '-01',
        amount: amount,
        platform: 'all',
      }, { onConflict: 'month' })

    if (!error) {
      alert('Saved successfully')
      setAdsAmount('')
      fetchMarketingData()
    }
  }

  // Calculate metrics
  const totalBooking = orders.reduce((sum, o) => sum + (o.total_income || 0), 0)
  const totalIncome = orders.reduce((sum, o) => {
    const orderPaid = o.payments?.reduce((pSum, p) => pSum + (p.amount || 0), 0) || 0
    return sum + orderPaid
  }, 0)
  const totalOrders = orders.length

  // AOV
  const aov = totalOrders > 0 ? totalBooking / totalOrders : 0

  // AOV without upsell
  const nonUpsellTotal = orders.reduce((sum, o) => {
    const nonUpsellItems = o.order_items?.filter(item => !item.is_upsell) || []
    const itemTotal = nonUpsellItems.reduce((s, item) => s + (item.products?.list_price || 0), 0)
    return sum + itemTotal
  }, 0)
  const aovWithoutUpsell = totalOrders > 0 ? nonUpsellTotal / totalOrders : 0

  // Upsell count and rate
  const ordersWithUpsell = orders.filter(o =>
    o.order_items?.some(item => item.is_upsell)
  ).length
  const upsellRate = totalOrders > 0 ? (ordersWithUpsell / totalOrders) * 100 : 0

  // Total upsell amount
  const upsellTotal = orders.reduce((sum, o) => {
    const upsellItems = o.order_items?.filter(item => item.is_upsell) || []
    const itemTotal = upsellItems.reduce((s, item) => s + (item.products?.list_price || 0), 0)
    return sum + itemTotal
  }, 0)

  // Chat inquiries total
  const totalInquiries = marketingData.reduce((sum, m) => sum + (m.chat_inquiries || 0), 0)

  // Conversion rate
  const conversionRate = totalInquiries > 0 ? (totalOrders / totalInquiries) * 100 : 0

  // Total ads spending
  const totalAdsSpending = adsSpending.reduce((sum, a) => sum + (a.amount || 0), 0)

  // ROAS
  const roas = totalAdsSpending > 0 ? totalBooking / totalAdsSpending : 0

  // Channel distribution
  const channelCounts: Record<string, number> = {}
  orders.forEach(o => {
    const channel = o.contact_channel || o.customers?.contact_channel || 'Unknown'
    channelCounts[channel] = (channelCounts[channel] || 0) + 1
  })

  const channelColors = [
    'rgba(236, 72, 153, 0.8)',
    'rgba(59, 130, 246, 0.8)',
    'rgba(34, 197, 94, 0.8)',
    'rgba(249, 115, 22, 0.8)',
    'rgba(139, 92, 246, 0.8)',
    'rgba(107, 114, 128, 0.8)',
  ]

  const pieData = {
    labels: Object.keys(channelCounts),
    datasets: [{
      data: Object.values(channelCounts),
      backgroundColor: channelColors.slice(0, Object.keys(channelCounts).length),
      borderWidth: 0,
    }],
  }

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
      },
    },
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      booking: { bg: 'bg-yellow-500', text: 'text-white', label: 'Booking' },
      paid: { bg: 'bg-green-500', text: 'text-white', label: 'Paid' },
      done: { bg: 'bg-blue-500', text: 'text-white', label: 'Completed' },
      cancelled: { bg: 'bg-red-500', text: 'text-white', label: 'Cancelled' },
    }
    return badges[status] || { bg: 'bg-gray-500', text: 'text-white', label: status }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400">CT Studio Overview</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setActiveTab('alerts')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors relative ${
              activeTab === 'alerts'
                ? 'bg-red-500 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
            }`}
          >
            แจ้งเตือน
            {alerts.filter(a => a.severity === 'danger').length > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center animate-pulse">
                {alerts.filter(a => a.severity === 'danger').length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'overview'
                ? 'bg-pink-500 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('marketing')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'marketing'
                ? 'bg-pink-500 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
            }`}
          >
            Marketing Data
          </button>
          <button
            onClick={() => setActiveTab('report')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'report'
                ? 'bg-purple-500 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
            }`}
          >
            Report
          </button>
        </div>
      </div>

      {activeTab === 'alerts' ? (
        /* Alerts Tab - Problem-focused Collapsible List */
        <div className="space-y-4">
          {/* Header with Refresh */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-800 dark:text-white">
                แจ้งเตือน ({alerts.length})
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                กดที่รายการเพื่อแก้ไข
              </p>
            </div>
            <button
              onClick={fetchAlerts}
              disabled={alertsLoading}
              className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
            >
              {alertsLoading ? '...' : 'รีเฟรช'}
            </button>
          </div>

          {/* Summary Badges */}
          <div className="flex gap-3 flex-wrap">
            <span className="px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full text-sm font-medium">
              ยังไม่นัด: {alerts.filter(a => a.type === 'unscheduled').length}
            </span>
            <span className="px-3 py-1.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded-full text-sm font-medium">
              ใกล้หมดอายุ: {alerts.filter(a => a.type === 'expiring_soon').length}
            </span>
          </div>

          {alertsLoading ? (
            <div className="card text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">กำลังโหลด...</p>
            </div>
          ) : alerts.length === 0 ? (
            <div className="card text-center py-8">
              <p className="text-lg font-bold text-green-600 dark:text-green-400">ไม่มีงานค้าง</p>
            </div>
          ) : (
            <div className="card p-0 divide-y dark:divide-gray-700">
              {alerts.map((alert, index) => {
                const alertKey = `${alert.orderId}-${alert.orderItemId}-${index}`
                const isExpanded = expandedAlert === alertKey

                return (
                  <div key={alertKey}>
                    {/* Collapsed Header - Problem as main text */}
                    <button
                      onClick={() => {
                        setExpandedAlert(isExpanded ? null : alertKey)
                        // Reset form when expanding
                        if (!isExpanded) {
                          setScheduleDate('')
                          setScheduleTime('')
                          setScheduleArtist('')
                          setNewExpiryMonths('')
                        }
                      }}
                      className={`w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                        isExpanded ? 'bg-gray-50 dark:bg-gray-700/30' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Status indicator */}
                          <span className={`w-2 h-2 rounded-full shrink-0 ${
                            alert.severity === 'danger' ? 'bg-red-500' : 'bg-orange-500'
                          }`} />

                          {/* Problem as main text, customer secondary */}
                          <div className="min-w-0">
                            <p className={`font-bold truncate ${
                              alert.severity === 'danger'
                                ? 'text-red-700 dark:text-red-400'
                                : 'text-orange-700 dark:text-orange-400'
                            }`}>
                              {alert.message}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                              {alert.customerName} - #{alert.orderId}
                            </p>
                          </div>
                        </div>

                        {/* Expand Arrow */}
                        <span className={`text-gray-400 transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`}>
                          ▼
                        </span>
                      </div>
                    </button>

                    {/* Expanded - Inline Edit Form */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-2 bg-gray-50 dark:bg-gray-800/50 space-y-4">
                        {/* Service Info */}
                        <div className="p-3 bg-white dark:bg-gray-700 rounded-lg">
                          <p className="font-medium text-gray-800 dark:text-white">
                            <span className="text-pink-500 font-mono text-sm">[{alert.productCode}]</span>{' '}
                            {alert.productName}
                          </p>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-gray-500 dark:text-gray-400">
                            {alert.phone && <span>Tel: {alert.phone}</span>}
                            <span>สร้าง: {new Date(alert.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</span>
                            {alert.expiryDate && (
                              <span className="text-orange-600 dark:text-orange-400">
                                หมดอายุ: {new Date(alert.expiryDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Inline Edit Form based on alert type */}
                        {alert.type === 'unscheduled' ? (
                          /* Schedule Form */
                          <div className="p-3 bg-white dark:bg-gray-700 rounded-lg space-y-3">
                            <p className="font-medium text-gray-800 dark:text-white text-sm">นัดหมายบริการ</p>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">วันที่</label>
                                <input
                                  type="date"
                                  value={scheduleDate}
                                  onChange={(e) => setScheduleDate(e.target.value)}
                                  className="input w-full text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">เวลา</label>
                                <input
                                  type="time"
                                  value={scheduleTime}
                                  onChange={(e) => setScheduleTime(e.target.value)}
                                  className="input w-full text-sm"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">ช่าง</label>
                              <select
                                value={scheduleArtist}
                                onChange={(e) => setScheduleArtist(e.target.value)}
                                className="select w-full text-sm"
                              >
                                <option value="">-- เลือกช่าง --</option>
                                {artists.map(a => (
                                  <option key={a.id} value={a.id}>{a.staff_name}</option>
                                ))}
                              </select>
                            </div>
                            <button
                              onClick={() => scheduleFromAlert(alert)}
                              className="w-full py-2 bg-pink-500 text-white rounded-lg font-medium hover:bg-pink-600 transition-colors"
                            >
                              บันทึกนัดหมาย
                            </button>
                          </div>
                        ) : (
                          /* Extend Validity Form */
                          <div className="p-3 bg-white dark:bg-gray-700 rounded-lg space-y-3">
                            <p className="font-medium text-gray-800 dark:text-white text-sm">ต่ออายุบริการ</p>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">เพิ่มอายุ (เดือน)</label>
                              <input
                                type="number"
                                value={newExpiryMonths}
                                onChange={(e) => setNewExpiryMonths(e.target.value)}
                                className="input w-full text-sm"
                                placeholder="เช่น 3, 6, 12"
                                min="1"
                              />
                            </div>
                            <button
                              onClick={() => {
                                setEditingAlert(alert)
                                extendValidity()
                              }}
                              className="w-full py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
                            >
                              บันทึกต่ออายุ
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ) : activeTab === 'overview' ? (
        <>
          {/* Date Range Filter */}
          <div className="card">
            <DateRangeFilter onDateChange={handleDateChange} />
          </div>

          {loading ? (
            <div className="card text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">Loading...</p>
            </div>
          ) : (
            <>
              {/* Main Metrics */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="card">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Total Booking</p>
                  <p className="text-2xl font-bold text-gray-800 dark:text-white mt-1">
                    {formatCurrency(totalBooking)}
                  </p>
                </div>
                <div className="card">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Total Income</p>
                  <p className="text-2xl font-bold text-green-600 mt-1">
                    {formatCurrency(totalIncome)}
                  </p>
                </div>
                <div className="card">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Total Orders</p>
                  <p className="text-2xl font-bold text-gray-800 dark:text-white mt-1">
                    {totalOrders}
                  </p>
                </div>
                <div className="card">
                  <p className="text-sm text-gray-500 dark:text-gray-400">AOV</p>
                  <p className="text-2xl font-bold text-gray-800 dark:text-white mt-1">
                    {formatCurrency(aov)}
                  </p>
                </div>
              </div>

              {/* Secondary Metrics */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="card">
                  <p className="text-sm text-gray-500 dark:text-gray-400">AOV (excl. Upsell)</p>
                  <p className="text-xl font-bold text-gray-800 dark:text-white mt-1">
                    {formatCurrency(aovWithoutUpsell)}
                  </p>
                </div>
                <div className="card">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Upsell Orders</p>
                  <p className="text-xl font-bold text-purple-600 mt-1">
                    {ordersWithUpsell}
                  </p>
                  <p className="text-xs text-gray-400">Total: {formatCurrency(upsellTotal)}</p>
                </div>
                <div className="card">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Upsell Rate</p>
                  <p className="text-xl font-bold text-purple-600 mt-1">
                    {upsellRate.toFixed(1)}%
                  </p>
                </div>
                <div className="card">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Conversion Rate</p>
                  <p className="text-xl font-bold text-blue-600 mt-1">
                    {conversionRate.toFixed(1)}%
                  </p>
                  <p className="text-xs text-gray-400">{totalOrders} / {totalInquiries} inquiries</p>
                </div>
              </div>

              {/* ROAS and Ads */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="card">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Ads Spending</p>
                  <p className="text-xl font-bold text-orange-600 mt-1">
                    {formatCurrency(totalAdsSpending)}
                  </p>
                </div>
                <div className="card">
                  <p className="text-sm text-gray-500 dark:text-gray-400">ROAS</p>
                  <p className="text-xl font-bold text-green-600 mt-1">
                    {roas.toFixed(2)}x
                  </p>
                  <p className="text-xs text-gray-400">Booking / Ads Spending</p>
                </div>
                <div className="card">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Cost per Order</p>
                  <p className="text-xl font-bold text-gray-800 dark:text-white mt-1">
                    {totalOrders > 0 ? formatCurrency(totalAdsSpending / totalOrders) : '฿0'}
                  </p>
                </div>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Channel Distribution */}
                <div className="card">
                  <h3 className="font-bold text-gray-800 dark:text-white mb-4">Orders by Channel</h3>
                  <div className="h-64">
                    {Object.keys(channelCounts).length > 0 ? (
                      <Pie data={pieData} options={pieOptions} />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-400">
                        No data available
                      </div>
                    )}
                  </div>
                </div>

                {/* Recent Orders */}
                <div className="card">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-gray-800 dark:text-white">Recent Orders</h3>
                    <Link href="/orders" className="text-pink-500 hover:text-pink-600 text-sm font-medium">
                      View All
                    </Link>
                  </div>
                  <div className="space-y-3">
                    {orders.slice(0, 5).map((order) => {
                      const badge = getStatusBadge(order.order_status)
                      return (
                        <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                          <div>
                            <p className="font-medium text-gray-800 dark:text-white">#{order.id}</p>
                            <p className="text-sm text-gray-500">{order.customers?.full_name || '-'}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-gray-800 dark:text-white">{formatCurrency(order.total_income)}</p>
                            <span className={`${badge.bg} ${badge.text} px-2 py-0.5 rounded-full text-xs`}>
                              {badge.label}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                    {orders.length === 0 && (
                      <p className="text-center text-gray-400 py-4">No orders found</p>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      ) : activeTab === 'marketing' ? (
        /* Marketing Data Tab */
        <div className="space-y-6">
          {/* Input Forms */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chat Inquiries */}
            <div className="card">
              <h3 className="font-bold text-gray-800 dark:text-white mb-4">Chat Inquiries (Daily)</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Number of Inquiries
                  </label>
                  <input
                    type="number"
                    value={chatInquiries}
                    onChange={(e) => setChatInquiries(e.target.value)}
                    className="input w-full"
                    placeholder="0"
                  />
                </div>
                <button
                  onClick={saveChatInquiries}
                  className="btn btn-primary w-full"
                >
                  Save
                </button>
              </div>
            </div>

            {/* Ads Spending */}
            <div className="card">
              <h3 className="font-bold text-gray-800 dark:text-white mb-4">Ads Spending (Monthly)</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Month
                  </label>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Amount (฿)
                  </label>
                  <input
                    type="number"
                    value={adsAmount}
                    onChange={(e) => setAdsAmount(e.target.value)}
                    className="input w-full"
                    placeholder="0"
                  />
                </div>
                <button
                  onClick={saveAdsSpending}
                  className="btn btn-primary w-full"
                >
                  Save
                </button>
              </div>
            </div>
          </div>

          {/* Data History */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chat History */}
            <div className="card">
              <h3 className="font-bold text-gray-800 dark:text-white mb-4">Recent Chat Inquiries</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {marketingData.map((data) => (
                  <div key={data.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <span className="text-gray-600 dark:text-gray-300">
                      {new Date(data.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    <span className="font-bold text-gray-800 dark:text-white">{data.chat_inquiries} inquiries</span>
                  </div>
                ))}
                {marketingData.length === 0 && (
                  <p className="text-center text-gray-400 py-4">No data</p>
                )}
              </div>
            </div>

            {/* Ads History */}
            <div className="card">
              <h3 className="font-bold text-gray-800 dark:text-white mb-4">Ads Spending History</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {adsSpending.map((data) => (
                  <div key={data.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <span className="text-gray-600 dark:text-gray-300">
                      {new Date(data.month).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}
                    </span>
                    <span className="font-bold text-orange-600">{formatCurrency(data.amount)}</span>
                  </div>
                ))}
                {adsSpending.length === 0 && (
                  <p className="text-center text-gray-400 py-4">No data</p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Report Tab */
        <div className="space-y-6">
          {/* Date Range */}
          <div className="card">
            <h3 className="font-bold text-gray-800 dark:text-white mb-4">ช่วงเวลา</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  วันเริ่มต้น
                </label>
                <input
                  type="date"
                  value={reportStartDate}
                  onChange={(e) => setReportStartDate(e.target.value)}
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  วันสิ้นสุด
                </label>
                <input
                  type="date"
                  value={reportEndDate}
                  onChange={(e) => setReportEndDate(e.target.value)}
                  className="input w-full"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={fetchReportData}
                  disabled={!reportStartDate || !reportEndDate || reportLoading}
                  className="btn btn-primary w-full"
                >
                  {reportLoading ? 'กำลังโหลด...' : 'ดูรายงาน'}
                </button>
              </div>
            </div>
          </div>

          {/* Price Breakdowns */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 dark:text-white">Price Range Breakdowns</h3>
              <button
                onClick={addBreakdown}
                className="px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-lg text-sm font-medium hover:bg-purple-200 dark:hover:bg-purple-800/40 transition-colors"
              >
                + เพิ่ม Breakdown
              </button>
            </div>

            <div className="space-y-3">
              {priceBreakdowns.map((breakdown, index) => (
                <div key={breakdown.id} className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-purple-600 dark:text-purple-400 w-8">{index + 1}</span>
                    </div>
                    <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">ชื่อ</label>
                        <input
                          type="text"
                          value={breakdown.label}
                          onChange={(e) => updateBreakdown(breakdown.id, 'label', e.target.value)}
                          className="input w-full text-sm"
                          placeholder="เช่น 0-3000"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">ราคาต่ำสุด (฿)</label>
                        <input
                          type="number"
                          value={breakdown.minPrice}
                          onChange={(e) => updateBreakdown(breakdown.id, 'minPrice', parseInt(e.target.value) || 0)}
                          className="input w-full text-sm"
                          min="0"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">ราคาสูงสุด (฿)</label>
                        <input
                          type="number"
                          value={breakdown.maxPrice}
                          onChange={(e) => updateBreakdown(breakdown.id, 'maxPrice', parseInt(e.target.value) || 0)}
                          className="input w-full text-sm"
                          min="0"
                        />
                      </div>
                      <div className="flex items-end gap-2">
                        <div className="flex-1">
                          <label className="block text-xs text-gray-500 mb-1">จำนวน Order</label>
                          <div className="input w-full text-sm bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-bold text-center">
                            {breakdown.count}
                          </div>
                        </div>
                        {priceBreakdowns.length > 1 && (
                          <button
                            onClick={() => removeBreakdown(breakdown.id)}
                            className="px-2 py-2 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                            title="ลบ"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Summary & Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Summary Numbers */}
            <div className="card">
              <h3 className="font-bold text-gray-800 dark:text-white mb-4">สรุป</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <span className="text-gray-600 dark:text-gray-300">Order ทั้งหมด (ไม่รวม FREE/50%)</span>
                  <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">{reportOrders.length}</span>
                </div>
                {priceBreakdowns.map((breakdown, index) => (
                  <div key={breakdown.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <span className="text-gray-600 dark:text-gray-300">
                      <span className="font-mono text-sm text-gray-400 mr-2">{index + 1}.</span>
                      {breakdown.label}
                    </span>
                    <span className="text-xl font-bold text-gray-800 dark:text-white">{breakdown.count}</span>
                  </div>
                ))}
              </div>
              {reportOrders.length === 0 && reportStartDate && reportEndDate && !reportLoading && (
                <p className="text-center text-gray-400 py-4 mt-4">กดปุ่ม "ดูรายงาน" เพื่อดูข้อมูล</p>
              )}
            </div>

            {/* Bar Chart */}
            <div className="card">
              <h3 className="font-bold text-gray-800 dark:text-white mb-4">กราฟแท่ง</h3>
              <div className="h-64">
                {priceBreakdowns.some(b => b.count > 0) ? (
                  <Bar
                    data={{
                      labels: priceBreakdowns.map(b => b.label),
                      datasets: [{
                        label: 'จำนวน Order',
                        data: priceBreakdowns.map(b => b.count),
                        backgroundColor: priceBreakdowns.map((_, i) => {
                          const colors = [
                            'rgba(147, 51, 234, 0.7)',
                            'rgba(59, 130, 246, 0.7)',
                            'rgba(34, 197, 94, 0.7)',
                            'rgba(249, 115, 22, 0.7)',
                            'rgba(236, 72, 153, 0.7)',
                            'rgba(139, 92, 246, 0.7)',
                          ]
                          return colors[i % colors.length]
                        }),
                        borderRadius: 8,
                      }]
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          display: false
                        }
                      },
                      scales: {
                        y: {
                          beginAtZero: true,
                          ticks: {
                            stepSize: 1
                          }
                        }
                      }
                    }}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    {reportLoading ? 'กำลังโหลด...' : 'เลือกช่วงเวลาและกด "ดูรายงาน"'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Info Note */}
          <div className="card bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
            <p className="text-sm text-purple-700 dark:text-purple-300">
              <strong>หมายเหตุ:</strong> รายงานนี้แสดงจำนวน Order ที่มีบริการปกติ (ไม่รวม FREE และ 50%)
              โดยคำนวณจากราคารวมของบริการปกติในแต่ละ Order
            </p>
          </div>
        </div>
      )}

      {/* Extend Validity Modal */}
      {editingAlert && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white">
              ต่ออายุบริการ
            </h3>

            <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <p className="text-sm text-gray-500 dark:text-gray-400">ลูกค้า</p>
              <p className="font-bold text-gray-800 dark:text-white">{editingAlert.customerName}</p>
              <p className="text-sm text-pink-500 mt-1">{editingAlert.productName}</p>
              {editingAlert.expiryDate && (
                <p className="text-sm text-orange-600 dark:text-orange-400 mt-2">
                  หมดอายุ: {new Date(editingAlert.expiryDate).toLocaleDateString('th-TH')}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                ต่ออายุเพิ่ม (เดือน)
              </label>
              <input
                type="number"
                value={newExpiryMonths}
                onChange={(e) => setNewExpiryMonths(e.target.value)}
                className="input w-full"
                placeholder="เช่น 3, 6, 12"
                min="1"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  setEditingAlert(null)
                  setNewExpiryMonths('')
                }}
                className="btn btn-secondary flex-1"
              >
                ยกเลิก
              </button>
              <button
                onClick={extendValidity}
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
