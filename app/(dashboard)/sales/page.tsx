'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface SalesData {
  id: number
  staff_name: string
  totalSales: number
  orderCount: number
  completedOrders: number
  upsellRate: number
}

export default function SalesPerformancePage() {
  const [salesData, setSalesData] = useState<SalesData[]>([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState('30')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')

  const supabase = createClient()

  useEffect(() => {
    fetchSalesData()
  }, [dateRange, customStartDate, customEndDate])

  const getDateFilter = () => {
    if (dateRange === 'custom' && customStartDate && customEndDate) {
      return { start: customStartDate, end: customEndDate }
    }

    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - parseInt(dateRange))

    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    }
  }

  const fetchSalesData = async () => {
    setLoading(true)
    const { start, end } = getDateFilter()

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
      .gte('order_date', start)
      .lte('order_date', end)

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

      return {
        id: s.id,
        staff_name: s.staff_name,
        totalSales,
        orderCount: staffOrders.length,
        completedOrders,
        upsellRate,
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">กำลังโหลด...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Sales Performance</h1>
        <p className="text-gray-500">ผลงานของพนักงานขาย</p>
      </div>

      {/* Date Filter */}
      <div className="card">
        <h2 className="font-bold text-gray-800 mb-4">ช่วงเวลา</h2>
        <div className="flex flex-wrap gap-4">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="select w-48"
          >
            <option value="7">7 วันที่ผ่านมา</option>
            <option value="30">30 วันที่ผ่านมา</option>
            <option value="90">90 วันที่ผ่านมา</option>
            <option value="365">1 ปีที่ผ่านมา</option>
            <option value="custom">กำหนดเอง</option>
          </select>

          {dateRange === 'custom' && (
            <div className="flex gap-2">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="input"
              />
              <span className="self-center">ถึง</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="input"
              />
            </div>
          )}
        </div>
      </div>

      {/* Sales Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {salesData.map((sales, index) => {
          const avgPerOrder = sales.orderCount > 0 ? sales.totalSales / sales.orderCount : 0
          const completionRate = sales.orderCount > 0
            ? (sales.completedOrders / sales.orderCount) * 100
            : 0

          return (
            <div key={sales.id} className="card card-hover relative">
              {/* Rank Badge */}
              {index < 3 && (
                <div className={`absolute -top-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                  index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : 'bg-amber-600'
                }`}>
                  {index + 1}
                </div>
              )}

              <div className="text-lg font-bold text-gray-800 mb-4">{sales.staff_name}</div>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">ยอดขายรวม</span>
                  <span className="font-bold text-pink-600">{formatCurrency(sales.totalSales)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">จำนวนออเดอร์</span>
                  <span className="font-medium">{sales.orderCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">เสร็จสิ้น</span>
                  <span className="font-medium text-green-600">{sales.completedOrders}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">อัตรา Upsell</span>
                  <span className="font-medium text-purple-600">{sales.upsellRate.toFixed(1)}%</span>
                </div>
                <div className="pt-2 border-t">
                  <div className="flex justify-between">
                    <span className="text-gray-500">เฉลี่ย/ออเดอร์</span>
                    <span className="font-medium">{formatCurrency(avgPerOrder)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">อัตราสำเร็จ</span>
                    <span className="font-medium">{completionRate.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}

        {salesData.length === 0 && (
          <div className="col-span-full text-center text-gray-500 py-12">
            ไม่มีข้อมูลในช่วงเวลานี้
          </div>
        )}
      </div>
    </div>
  )
}
