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
} from 'chart.js'
import { Bar } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

interface Staff {
  id: number
  staff_name: string
}

interface SalesData {
  id: number
  staff_name: string
  totalSales: number
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

  const { t } = useLanguage()
  const supabase = createClient()

  const handleDateChange = (start: string, end: string) => {
    setStartDate(start)
    setEndDate(end)
  }

  useEffect(() => {
    fetchStaffList()
  }, [])

  useEffect(() => {
    if (startDate && endDate) {
      fetchSalesData()
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

    // Get chat counts within date range
    const { data: chatCounts } = await supabase
      .from('chat_counts')
      .select('staff_id, chat_count')
      .gte('date', startDate)
      .lte('date', endDate)

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

      // Sum chat counts for this staff in the date range
      const staffChatCounts = chatCounts?.filter(c => c.staff_id === s.id) || []
      const totalChats = staffChatCounts.reduce((sum, c) => sum + (c.chat_count || 0), 0)

      return {
        id: s.id,
        staff_name: s.staff_name,
        totalSales,
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
    ],
  }

  const conversionChartData = {
    labels: salesData.map(s => s.staff_name),
    datasets: [
      {
        label: 'Conversion Rate (%)',
        data: salesData.map(s => s.chatCount > 0 ? (s.orderCount / s.chatCount) * 100 : 0),
        backgroundColor: 'rgba(34, 197, 94, 0.8)',
        borderRadius: 8,
      },
    ],
  }

  // Open chat count modal
  const openChatModal = () => {
    const today = new Date().toISOString().split('T')[0]
    setChatDate(today)
    setChatInputs({})
    setShowChatModal(true)
    loadChatCountsForDate(today)
  }

  // Load existing chat counts for a date
  const loadChatCountsForDate = async (date: string) => {
    const { data } = await supabase
      .from('chat_counts')
      .select('staff_id, chat_count')
      .eq('date', date)

    const inputs: Record<number, number> = {}
    data?.forEach(c => {
      inputs[c.staff_id] = c.chat_count
    })
    setChatInputs(inputs)
  }

  // Save chat counts
  const saveChatCounts = async () => {
    if (!chatDate) return

    setSavingChat(true)

    try {
      // Get all sales staff
      const salesStaffIds = allStaff.map(s => s.id)

      // Upsert chat counts for each staff
      for (const staffId of salesStaffIds) {
        const chatCount = chatInputs[staffId] || 0

        await supabase
          .from('chat_counts')
          .upsert({
            staff_id: staffId,
            date: chatDate,
            chat_count: chatCount,
          }, {
            onConflict: 'staff_id,date',
          })
      }

      setShowChatModal(false)
      // Refresh data
      fetchSalesData()
    } catch (err) {
      console.error('Save chat count error:', err)
      alert('เกิดข้อผิดพลาดในการบันทึก')
    } finally {
      setSavingChat(false)
    }
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
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">{t('sales.title')}</h1>
        <p className="text-gray-500 dark:text-gray-400">{t('sales.subtitle')}</p>
      </div>

      {/* Filters */}
      <div className="card space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <DateRangeFilter onDateChange={handleDateChange} />

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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card">
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('sales.totalSales')}</p>
              <p className="text-2xl font-bold text-pink-600 mt-1">
                {formatCurrency(salesData.reduce((sum, s) => sum + s.totalSales, 0))}
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
              <p className="text-2xl font-bold text-green-600 mt-1">
                {(() => {
                  const totalChats = salesData.reduce((sum, s) => sum + s.chatCount, 0)
                  const totalOrders = salesData.reduce((sum, s) => sum + s.orderCount, 0)
                  return totalChats > 0 ? ((totalOrders / totalChats) * 100).toFixed(1) : '0'
                })()}%
              </p>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sales Chart */}
            <div className="card">
              <h3 className="font-bold text-gray-800 dark:text-white mb-4">{t('sales.salesByStaff')}</h3>
              <div className="h-64">
                {salesData.length > 0 ? (
                  <Bar data={chartData} options={chartOptions} />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    {t('sales.noData')}
                  </div>
                )}
              </div>
            </div>

            {/* Orders Chart */}
            <div className="card">
              <h3 className="font-bold text-gray-800 dark:text-white mb-4">{t('sales.ordersByStaff')}</h3>
              <div className="h-64">
                {salesData.length > 0 ? (
                  <Bar data={orderChartData} options={chartOptions} />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    {t('sales.noData')}
                  </div>
                )}
              </div>
            </div>

            {/* Conversion Rate Chart */}
            <div className="card lg:col-span-2">
              <h3 className="font-bold text-gray-800 dark:text-white mb-4">Conversion Rate ตาม Staff</h3>
              <div className="h-64">
                {salesData.length > 0 ? (
                  <Bar data={conversionChartData} options={chartOptions} />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    {t('sales.noData')}
                  </div>
                )}
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
                      <span className="text-gray-500 dark:text-gray-400">Orders</span>
                      <span className="font-medium text-gray-800 dark:text-white">{sales.orderCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">จำนวนแชท</span>
                      <span className="font-medium text-blue-600">{sales.chatCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Conversion Rate</span>
                      <span className="font-medium text-green-600">{conversionRate.toFixed(1)}%</span>
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

            <div className="space-y-3 mb-6">
              {allStaff.map(staff => (
                <div key={staff.id} className="flex items-center justify-between gap-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <span className="font-medium text-gray-800 dark:text-white">{staff.staff_name}</span>
                  <input
                    type="number"
                    min="0"
                    value={chatInputs[staff.id] || ''}
                    onChange={(e) => setChatInputs({
                      ...chatInputs,
                      [staff.id]: parseInt(e.target.value) || 0
                    })}
                    placeholder="0"
                    className="input w-24 text-center"
                  />
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
    </div>
  )
}
