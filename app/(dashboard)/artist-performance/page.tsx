'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/user-context'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Line, Pie } from 'react-chartjs-2'
import type { Staff } from '@/lib/supabase/types'

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
)

interface PerformanceData {
  totalCustomers: number
  completedServices: number
  bookingByDate: { date: string; amount: number }[]
  commissionByDate: { date: string; amount: number }[]
  customersByCategory: { category: string; count: number }[]
}

export default function ArtistPerformancePage() {
  const { user } = useUser()
  const [artists, setArtists] = useState<Staff[]>([])
  const [selectedArtistId, setSelectedArtistId] = useState<number | null>(null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedRange, setSelectedRange] = useState<'7' | '14' | '28' | 'custom'>('28')
  const [loading, setLoading] = useState(false)
  const [performanceData, setPerformanceData] = useState<PerformanceData>({
    totalCustomers: 0,
    completedServices: 0,
    bookingByDate: [],
    commissionByDate: [],
    customersByCategory: []
  })

  const supabase = createClient()

  useEffect(() => {
    // Set default date range (28 days)
    const today = new Date()
    const pastDate = new Date()
    pastDate.setDate(today.getDate() - 28)
    setStartDate(pastDate.toISOString().split('T')[0])
    setEndDate(today.toISOString().split('T')[0])

    if (user) {
      if (user.role === 'super_admin') {
        fetchArtists()
      } else if (user.role === 'artist') {
        setSelectedArtistId(user.id)
      }
    }
  }, [user])

  useEffect(() => {
    if (selectedArtistId && startDate && endDate) {
      fetchPerformanceData()
    }
  }, [selectedArtistId, startDate, endDate])

  const fetchArtists = async () => {
    const { data } = await supabase
      .from('staff')
      .select('*')
      .eq('role', 'artist')
      .eq('is_active', true)
      .order('staff_name')

    if (data && data.length > 0) {
      setArtists(data)
      setSelectedArtistId(data[0].id)
    }
  }

  const handleRangeSelect = (days: '7' | '14' | '28' | 'custom') => {
    setSelectedRange(days)

    if (days !== 'custom') {
      const today = new Date()
      const pastDate = new Date()
      pastDate.setDate(today.getDate() - parseInt(days))

      setStartDate(pastDate.toISOString().split('T')[0])
      setEndDate(today.toISOString().split('T')[0])
    }
  }

  const handleDateChange = (start: string, end: string) => {
    setStartDate(start)
    setEndDate(end)
    setSelectedRange('custom')
  }

  const fetchPerformanceData = async () => {
    if (!selectedArtistId) return

    setLoading(true)

    try {
      // Get commission settings
      const { data: commissionData } = await supabase
        .from('commission_settings')
        .select('commission_normal_percent, commission_50_percent')
        .eq('artist_id', selectedArtistId)
        .single()

      const commissionNormal = commissionData?.commission_normal_percent || 0
      const commission50 = commissionData?.commission_50_percent || 0

      // Get all order_items for selected artist in date range
      const { data: orderItems } = await supabase
        .from('order_items')
        .select(`
          id,
          order_id,
          item_price,
          artist_completed_at,
          sales_completed_at,
          appointment_date,
          orders!inner(order_date, customer_id),
          product:products(category, validity_months)
        `)
        .eq('artist_id', selectedArtistId)
        .gte('orders.order_date', startDate)
        .lte('orders.order_date', endDate)

      if (!orderItems) {
        setLoading(false)
        return
      }

      // Count unique customers
      const uniqueOrders = new Set(orderItems.map(item => item.order_id))
      const totalCustomers = uniqueOrders.size

      // Count completed services
      const completedItems = orderItems.filter(item =>
        item.artist_completed_at && item.sales_completed_at
      )
      const completedServices = completedItems.length

      // Group booking by date
      const bookingByDateMap = new Map<string, number>()
      orderItems.forEach(item => {
        const date = item.orders?.order_date
        if (date) {
          const current = bookingByDateMap.get(date) || 0
          bookingByDateMap.set(date, current + (item.item_price || 0))
        }
      })

      // Group commission by date (only completed services)
      const commissionByDateMap = new Map<string, number>()
      completedItems.forEach(item => {
        const date = item.orders?.order_date
        if (date) {
          const itemPrice = item.item_price || 0
          const validityMonths = item.product?.validity_months || 0
          const commissionPercent = validityMonths === 12 ? commission50 : commissionNormal
          const commission = itemPrice * (commissionPercent / 100)

          const current = commissionByDateMap.get(date) || 0
          commissionByDateMap.set(date, current + commission)
        }
      })

      // Sort dates and create arrays
      const sortedDates = Array.from(bookingByDateMap.keys()).sort()
      const bookingByDate = sortedDates.map(date => ({
        date,
        amount: bookingByDateMap.get(date) || 0
      }))

      const commissionByDate = sortedDates.map(date => ({
        date,
        amount: commissionByDateMap.get(date) || 0
      }))

      // Group customers by product category
      const categoryMap = new Map<string, Set<number>>()
      orderItems.forEach(item => {
        const category = item.product?.category || 'อื่นๆ'
        const customerId = item.orders?.customer_id
        if (customerId) {
          if (!categoryMap.has(category)) {
            categoryMap.set(category, new Set())
          }
          categoryMap.get(category)?.add(customerId)
        }
      })

      const customersByCategory = Array.from(categoryMap.entries()).map(([category, customers]) => ({
        category,
        count: customers.size
      }))

      setPerformanceData({
        totalCustomers,
        completedServices,
        bookingByDate,
        commissionByDate,
        customersByCategory
      })
    } catch (error) {
      console.error('Error fetching performance data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Chart data
  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      }
    },
    scales: {
      y: {
        beginAtZero: true
      }
    }
  }

  const bookingLineData = {
    labels: performanceData.bookingByDate.map(d => {
      const date = new Date(d.date)
      return `${date.getDate()}/${date.getMonth() + 1}`
    }),
    datasets: [
      {
        label: 'มูลค่า Booking',
        data: performanceData.bookingByDate.map(d => d.amount),
        borderColor: 'rgb(168, 85, 247)',
        backgroundColor: 'rgba(168, 85, 247, 0.1)',
        tension: 0.3,
        fill: true
      }
    ]
  }

  const commissionLineData = {
    labels: performanceData.commissionByDate.map(d => {
      const date = new Date(d.date)
      return `${date.getDate()}/${date.getMonth() + 1}`
    }),
    datasets: [
      {
        label: 'ค่าคอมมิชชั่น',
        data: performanceData.commissionByDate.map(d => d.amount),
        borderColor: 'rgb(249, 115, 22)',
        backgroundColor: 'rgba(249, 115, 22, 0.1)',
        tension: 0.3,
        fill: true
      }
    ]
  }

  const pieData = {
    labels: performanceData.customersByCategory.map(c => c.category),
    datasets: [
      {
        label: 'จำนวนลูกค้า',
        data: performanceData.customersByCategory.map(c => c.count),
        backgroundColor: [
          'rgba(239, 68, 68, 0.8)',
          'rgba(59, 130, 246, 0.8)',
          'rgba(34, 197, 94, 0.8)',
          'rgba(168, 85, 247, 0.8)',
          'rgba(249, 115, 22, 0.8)',
          'rgba(236, 72, 153, 0.8)',
        ],
        borderColor: [
          'rgb(239, 68, 68)',
          'rgb(59, 130, 246)',
          'rgb(34, 197, 94)',
          'rgb(168, 85, 247)',
          'rgb(249, 115, 22)',
          'rgb(236, 72, 153)',
        ],
        borderWidth: 2
      }
    ]
  }

  // Check permissions
  if (!user || (user.role !== 'artist' && user.role !== 'super_admin')) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="text-2xl font-bold text-red-500 mb-2">ไม่มีสิทธิ์เข้าถึง</div>
        <div className="text-gray-500">หน้านี้สำหรับ Artist และ Super Admin เท่านั้น</div>
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-6 max-w-2xl mx-auto px-4">
      {/* Header - Mobile Optimized */}
      <div className="pt-4">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Artist Performance</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          สถิติและผลงานเชิงลึก
        </p>
      </div>

      {/* Artist Selector (Super Admin only) - Mobile First */}
      {user.role === 'super_admin' && (
        <div className="card p-4">
          <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
            เลือกช่าง
          </label>
          <select
            value={selectedArtistId || ''}
            onChange={(e) => setSelectedArtistId(Number(e.target.value))}
            className="input w-full"
          >
            {artists.map(artist => (
              <option key={artist.id} value={artist.id}>
                {artist.staff_name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Date Range Filter - Mobile First */}
      <div className="card p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-3 text-gray-700 dark:text-gray-300">
            ช่วงเวลา
          </label>

          {/* Quick Select Buttons */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            <button
              onClick={() => handleRangeSelect('7')}
              className={`px-3 py-2.5 rounded-lg font-medium transition-all text-sm ${
                selectedRange === '7'
                  ? 'bg-pink-500 text-white shadow-lg'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              7 วัน
            </button>
            <button
              onClick={() => handleRangeSelect('14')}
              className={`px-3 py-2.5 rounded-lg font-medium transition-all text-sm ${
                selectedRange === '14'
                  ? 'bg-pink-500 text-white shadow-lg'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              14 วัน
            </button>
            <button
              onClick={() => handleRangeSelect('28')}
              className={`px-3 py-2.5 rounded-lg font-medium transition-all text-sm ${
                selectedRange === '28'
                  ? 'bg-pink-500 text-white shadow-lg'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              28 วัน
            </button>
            <button
              onClick={() => handleRangeSelect('custom')}
              className={`px-3 py-2.5 rounded-lg font-medium transition-all text-sm ${
                selectedRange === 'custom'
                  ? 'bg-pink-500 text-white shadow-lg'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Custom
            </button>
          </div>

          {/* Custom Date Inputs - Show when custom is selected */}
          {selectedRange === 'custom' && (
            <div className="space-y-3 pt-3 border-t dark:border-gray-700">
              <div>
                <label className="block text-xs font-medium mb-1.5 text-gray-600 dark:text-gray-400">
                  วันที่เริ่มต้น
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => handleDateChange(e.target.value, endDate)}
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5 text-gray-600 dark:text-gray-400">
                  วันที่สิ้นสุด
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => handleDateChange(startDate, e.target.value)}
                  className="input w-full"
                />
              </div>
            </div>
          )}

          {/* Date Range Display */}
          <div className="mt-3 pt-3 border-t dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              แสดงข้อมูลตั้งแต่: <span className="font-medium text-gray-700 dark:text-gray-300">{new Date(startDate).toLocaleDateString('th-TH')}</span>
              {' ถึง '}
              <span className="font-medium text-gray-700 dark:text-gray-300">{new Date(endDate).toLocaleDateString('th-TH')}</span>
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card p-8 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-pink-500 border-t-transparent"></div>
          <p className="mt-3 text-gray-600 dark:text-gray-400">กำลังโหลดข้อมูล...</p>
        </div>
      ) : (
        <>
          {/* Summary Cards - Mobile Optimized */}
          <div className="grid grid-cols-1 gap-4">
            {/* Total Customers Card */}
            <div className="card p-5 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-2 border-blue-200 dark:border-blue-700">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-1">
                    จำนวนลูกค้าทั้งหมด
                  </p>
                  <p className="text-4xl font-bold text-blue-700 dark:text-blue-300">
                    {performanceData.totalCustomers}
                  </p>
                  <p className="text-xs text-blue-500 dark:text-blue-400 mt-1">
                    orders ในช่วงเวลาที่เลือก
                  </p>
                </div>
                <div className="w-16 h-16 rounded-full bg-blue-200 dark:bg-blue-700 flex items-center justify-center">
                  <svg className="w-8 h-8 text-blue-600 dark:text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Completed Services Card */}
            <div className="card p-5 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-2 border-green-200 dark:border-green-700">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-600 dark:text-green-400 mb-1">
                    บริการที่ทำเสร็จแล้ว
                  </p>
                  <p className="text-4xl font-bold text-green-700 dark:text-green-300">
                    {performanceData.completedServices}
                  </p>
                  <p className="text-xs text-green-500 dark:text-green-400 mt-1">
                    บริการที่ยืนยันแล้วทั้ง 2 ฝ่าย
                  </p>
                </div>
                <div className="w-16 h-16 rounded-full bg-green-200 dark:bg-green-700 flex items-center justify-center">
                  <svg className="w-8 h-8 text-green-600 dark:text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Charts - Mobile Optimized */}
          <div className="space-y-4">
            {/* Booking Line Chart */}
            <div className="card p-4">
              <h3 className="text-base font-bold text-gray-800 dark:text-white mb-3">
                📊 มูลค่า Booking ตามวันที่
              </h3>
              <div className="h-56">
                <Line data={bookingLineData} options={lineChartOptions} />
              </div>
            </div>

            {/* Commission Line Chart */}
            <div className="card p-4">
              <h3 className="text-base font-bold text-gray-800 dark:text-white mb-3">
                💰 ค่าคอมมิชชั่นตามวันที่
              </h3>
              <div className="h-56">
                <Line data={commissionLineData} options={lineChartOptions} />
              </div>
            </div>

            {/* Customers Pie Chart */}
            <div className="card p-4">
              <h3 className="text-base font-bold text-gray-800 dark:text-white mb-3">
                🎯 จำนวนลูกค้าแยกตามประเภทบริการ
              </h3>
              <div className="h-64 flex items-center justify-center">
                <div className="w-full max-w-xs">
                  <Pie data={pieData} />
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
