import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

async function getMetrics() {
  const supabase = createClient()

  // Get total income from orders
  const { data: ordersData } = await supabase
    .from('orders')
    .select('total_income, order_status')

  const totalBooking = ordersData?.reduce((sum, o) => sum + (o.total_income || 0), 0) || 0
  const totalOrders = ordersData?.length || 0

  // Get total payments
  const { data: paymentsData } = await supabase
    .from('payments')
    .select('amount')

  const totalPayments = paymentsData?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0

  // Get total customers
  const { count: customerCount } = await supabase
    .from('customers')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)

  // Get recent orders with customer info
  const { data: recentOrders } = await supabase
    .from('orders')
    .select(`
      id,
      order_date,
      order_status,
      total_income,
      customers (full_name)
    `)
    .order('created_at', { ascending: false })
    .limit(5)

  return {
    totalBooking,
    totalPayments,
    totalOrders,
    customerCount: customerCount || 0,
    recentOrders: recentOrders || [],
  }
}

export default async function DashboardPage() {
  const metrics = await getMetrics()

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { class: string; label: string }> = {
      booking: { class: 'badge-booking', label: 'จอง' },
      active: { class: 'badge-active', label: 'กำลังทำ' },
      done: { class: 'badge-done', label: 'เสร็จสิ้น' },
      cancel: { class: 'badge-cancel', label: 'ยกเลิก' },
    }
    return badges[status] || { class: 'badge', label: status }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">แดชบอร์ด</h1>
        <p className="text-gray-500 dark:text-gray-400">ภาพรวมของร้าน CT Studio</p>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card card-hover">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-sm">ยอดจอง</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-white mt-1">
                {formatCurrency(metrics.totalBooking)}
              </p>
            </div>
            <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center">
              <span className="text-2xl">💰</span>
            </div>
          </div>
        </div>

        <div className="card card-hover">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-sm">รายได้รับจริง</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-white mt-1">
                {formatCurrency(metrics.totalPayments)}
              </p>
            </div>
            <div className="w-12 h-12 rounded-full gradient-secondary flex items-center justify-center">
              <span className="text-2xl">💵</span>
            </div>
          </div>
        </div>

        <div className="card card-hover">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-sm">จำนวนออเดอร์</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-white mt-1">
                {metrics.totalOrders}
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
              <span className="text-2xl">📋</span>
            </div>
          </div>
        </div>

        <div className="card card-hover">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-sm">จำนวนลูกค้า</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-white mt-1">
                {metrics.customerCount}
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
              <span className="text-2xl">👥</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white">ออเดอร์ล่าสุด</h2>
          <Link href="/orders" className="text-pink-500 hover:text-pink-600 text-sm font-medium">
            ดูทั้งหมด →
          </Link>
        </div>

        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>รหัส</th>
                <th>ลูกค้า</th>
                <th>วันที่</th>
                <th>ยอดเงิน</th>
                <th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {metrics.recentOrders.map((order: any) => {
                const badge = getStatusBadge(order.order_status)
                return (
                  <tr key={order.id}>
                    <td className="font-medium">#{order.id}</td>
                    <td>{order.customers?.full_name || '-'}</td>
                    <td>
                      {new Date(order.order_date).toLocaleDateString('th-TH', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td>{formatCurrency(order.total_income)}</td>
                    <td>
                      <span className={`badge ${badge.class}`}>{badge.label}</span>
                    </td>
                  </tr>
                )
              })}
              {metrics.recentOrders.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-gray-500 dark:text-gray-400 py-8">
                    ยังไม่มีออเดอร์
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
