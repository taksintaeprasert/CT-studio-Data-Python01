'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import DateRangeFilter from '@/components/date-range-filter'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

interface SalesData {
  id: number
  staff_name: string
  totalSales: number
  orderCount: number
  completedOrders: number
  upsellRate: number
  upsellCount: number
}

export default function SalesPerformancePage() {
  const [salesData, setSalesData] = useState<SalesData[]>([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const supabase = createClient()

  const handleDateChange = (start: string, end: string) => {
    setStartDate(start)
    setEndDate(end)
  }

  useEffect(() => {
    if (startDate && endDate) {
      fetchSalesData()
    }
  }, [startDate, endDate])

  const fetchSalesData = async () => {
    if (!startDate || !endDate) return

    setLoading(true)

    // Get staff
    const { data: staff } = await supabase
      .from('staff')
      .select('id, staff_name')
      .in('role', ['sales', 'admin'])
      .eq('is_active', true)

    if (!staff) {
      setSalesData([])
      setLoading(false)
      return
    }

    // Get orders within date range
    const { data: orders } = await supabase
      .from('orders')
      .select('id, sales_id, order_status, total_income')
      .gte('created_at', `${startDate}T00:00:00`)
      .lte('created_at', `${endDate}T23:59:59`)

    // Get order items with upsell
    const { data: orderItems } = await supabase
      .from('order_items')
      .select('order_id, is_upsell')

    // Calculate stats for each staff
    const salesStats: SalesData[] = staff.map(s => {
      const staffOrders = orders?.filter(o => o.sales_id === s.id) || []
      const totalSales = staffOrders.reduce((sum, o) => sum + (o.total_income || 0), 0)
      const completedOrders = staffOrders.filter(o => o.order_status === 'done').length

      // Calculate upsell rate
      const staffOrderIds = staffOrders.map(o => o.id)
      const staffItems = orderItems?.filter(i => staffOrderIds.includes(i.order_id)) || []
      const upsellItems = staffItems.filter(i => i.is_upsell).length
      const upsellRate = staffItems.length > 0 ? (upsellItems / staffItems.length) * 100 : 0

      // Count orders with upsell
      const ordersWithUpsell = staffOrders.filter(o =>
        orderItems?.some(i => i.order_id === o.id && i.is_upsell)
      ).length

      return {
        id: s.id,
        staff_name: s.staff_name,
        totalSales,
        orderCount: staffOrders.length,
        completedOrders,
        upsellRate,
        upsellCount: ordersWithUpsell,
      }
    })

    // Sort by total sales descending
    salesStats.sort((a, b) => b.totalSales - a.totalSales)
    setSalesData(salesStats)
    setLoading(false)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  // Chart data
  const chartData = {
    labels: salesData.map(s => s.staff_name),
    datasets: [
      {
        label: 'Total Sales (฿)',
        data: salesData.map(s => s.totalSales),
        backgroundColor: 'rgba(236, 72, 153, 0.8)',
        borderRadius: 8,
      },
    ],
  }

  const orderChartData = {
    labels: salesData.map(s => s.staff_name),
    datasets: [
      {
        label: 'Total Orders',
        data: salesData.map(s => s.orderCount),
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        borderRadius: 8,
      },
      {
        label: 'Completed',
        data: salesData.map(s => s.completedOrders),
        backgroundColor: 'rgba(34, 197, 94, 0.8)',
        borderRadius: 8,
      },
    ],
  }

  const upsellChartData = {
    labels: salesData.map(s => s.staff_name),
    datasets: [
      {
        label: 'Upsell Rate (%)',
        data: salesData.map(s => s.upsellRate),
        backgroundColor: 'rgba(139, 92, 246, 0.8)',
        borderRadius: 8,
      },
    ],
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Sales Performance</h1>
        <p className="text-gray-500 dark:text-gray-400">Sales team performance analytics</p>
      </div>

      {/* Date Filter */}
      <div className="card">
        <DateRangeFilter onDateChange={handleDateChange} />
      </div>

      {loading ? (
        <div className="card text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">Loading...</p>
        </div>
      ) : (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card">
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Sales</p>
              <p className="text-2xl font-bold text-pink-600 mt-1">
                {formatCurrency(salesData.reduce((sum, s) => sum + s.totalSales, 0))}
              </p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Orders</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-white mt-1">
                {salesData.reduce((sum, s) => sum + s.orderCount, 0)}
              </p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500 dark:text-gray-400">Completed</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {salesData.reduce((sum, s) => sum + s.completedOrders, 0)}
              </p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500 dark:text-gray-400">Avg Upsell Rate</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">
                {salesData.length > 0 ? (salesData.reduce((sum, s) => sum + s.upsellRate, 0) / salesData.length).toFixed(1) : 0}%
              </p>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sales Chart */}
            <div className="card">
              <h3 className="font-bold text-gray-800 dark:text-white mb-4">Sales by Staff</h3>
              <div className="h-64">
                {salesData.length > 0 ? (
                  <Bar data={chartData} options={chartOptions} />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    No data available
                  </div>
                )}
              </div>
            </div>

            {/* Orders Chart */}
            <div className="card">
              <h3 className="font-bold text-gray-800 dark:text-white mb-4">Orders by Staff</h3>
              <div className="h-64">
                {salesData.length > 0 ? (
                  <Bar data={orderChartData} options={chartOptions} />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    No data available
                  </div>
                )}
              </div>
            </div>

            {/* Upsell Rate Chart */}
            <div className="card lg:col-span-2">
              <h3 className="font-bold text-gray-800 dark:text-white mb-4">Upsell Rate by Staff</h3>
              <div className="h-64">
                {salesData.length > 0 ? (
                  <Bar data={upsellChartData} options={chartOptions} />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    No data available
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Staff Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {salesData.map((sales, index) => {
              const avgPerOrder = sales.orderCount > 0 ? sales.totalSales / sales.orderCount : 0
              const completionRate = sales.orderCount > 0
                ? (sales.completedOrders / sales.orderCount) * 100
                : 0

              return (
                <div key={sales.id} className="card relative">
                  {/* Rank Badge */}
                  {index < 3 && (
                    <div className={`absolute -top-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                      index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : 'bg-amber-600'
                    }`}>
                      {index + 1}
                    </div>
                  )}

                  <div className="text-lg font-bold text-gray-800 dark:text-white mb-4">{sales.staff_name}</div>

                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Total Sales</span>
                      <span className="font-bold text-pink-600">{formatCurrency(sales.totalSales)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Orders</span>
                      <span className="font-medium text-gray-800 dark:text-white">{sales.orderCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Completed</span>
                      <span className="font-medium text-green-600">{sales.completedOrders}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Upsell Rate</span>
                      <span className="font-medium text-purple-600">{sales.upsellRate.toFixed(1)}%</span>
                    </div>
                    <div className="pt-2 border-t dark:border-gray-700">
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Avg/Order</span>
                        <span className="font-medium text-gray-800 dark:text-white">{formatCurrency(avgPerOrder)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Completion</span>
                        <span className="font-medium text-gray-800 dark:text-white">{completionRate.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}

            {salesData.length === 0 && (
              <div className="col-span-full text-center text-gray-500 dark:text-gray-400 py-12">
                No data in this period
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
