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

interface Order {
  id: number
  order_date: string
  created_at: string
  order_status: string
  total_income: number
  deposit: number
  contact_channel: string | null
  customers: { full_name: string; contact_channel: string | null } | null
  order_items: { id: number; is_upsell: boolean; products: { list_price: number } | null }[]
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

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'marketing'>('overview')
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Marketing Data
  const [marketingData, setMarketingData] = useState<MarketingData[]>([])
  const [adsSpending, setAdsSpending] = useState<AdsSpending[]>([])
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [chatInquiries, setChatInquiries] = useState('')
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7))
  const [adsAmount, setAdsAmount] = useState('')

  const supabase = createClient()

  const handleDateChange = (start: string, end: string) => {
    setStartDate(start)
    setEndDate(end)
  }

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
        )
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
  const totalIncome = orders.reduce((sum, o) => sum + (o.deposit || 0), 0)
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
        <div className="flex gap-2">
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
        </div>
      </div>

      {activeTab === 'overview' ? (
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
      ) : (
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
      )}
    </div>
  )
}
