'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import DateRangeFilter from '@/components/date-range-filter'

interface Order {
  id: number
  order_date: string
  created_at: string
  order_status: string
  total_income: number
  deposit: number
  customers: { full_name: string } | null
  sales: { id: number; staff_name: string } | null
  order_items: { products: { product_code: string } | null }[]
}

interface Staff {
  id: number
  staff_name: string
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [allStaff, setAllStaff] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [salesFilter, setSalesFilter] = useState('')
  const [productCodeFilter, setProductCodeFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)
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
      fetchOrders()
    }
  }, [startDate, endDate])

  const fetchStaffList = async () => {
    const { data } = await supabase
      .from('staff')
      .select('id, staff_name')
      .in('role', ['sales', 'admin'])
      .eq('is_active', true)
      .order('staff_name')
    setAllStaff(data || [])
  }

  const fetchOrders = async () => {
    if (!startDate || !endDate) return

    setLoading(true)
    const { data } = await supabase
      .from('orders')
      .select(`
        id,
        order_date,
        created_at,
        order_status,
        total_income,
        deposit,
        customers (full_name),
        sales:staff!orders_sales_id_fkey (id, staff_name),
        order_items (products (product_code))
      `)
      .gte('created_at', `${startDate}T00:00:00`)
      .lte('created_at', `${endDate}T23:59:59`)
      .order('created_at', { ascending: false })

    setOrders(data || [])
    setLoading(false)
  }

  const deleteOrder = async (orderId: number) => {
    setDeleting(true)
    try {
      // Delete order items first
      await supabase.from('order_items').delete().eq('order_id', orderId)
      // Delete payments
      await supabase.from('payments').delete().eq('order_id', orderId)
      // Delete the order
      const { error } = await supabase.from('orders').delete().eq('id', orderId)

      if (error) {
        alert(`ไม่สามารถลบออเดอร์: ${error.message}`)
      } else {
        setOrders(orders.filter(o => o.id !== orderId))
      }
    } catch (err) {
      console.error('Delete error:', err)
      alert('เกิดข้อผิดพลาดในการลบ')
    } finally {
      setDeleting(false)
      setDeleteConfirm(null)
    }
  }

  const filteredOrders = orders.filter((order) => {
    const matchSearch = order.customers?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      order.id.toString().includes(search)
    const matchStatus = !statusFilter || order.order_status === statusFilter
    const matchSales = !salesFilter || order.sales?.id === parseInt(salesFilter)
    const matchProductCode = !productCodeFilter ||
      order.order_items?.some(item =>
        item.products?.product_code?.toLowerCase().includes(productCodeFilter.toLowerCase())
      )
    return matchSearch && matchStatus && matchSales && matchProductCode
  })

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const formatDate = (date: string | null) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
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

  // Calculate stats
  const stats = {
    total: filteredOrders.length,
    booking: filteredOrders.filter(o => o.order_status === 'booking').length,
    paid: filteredOrders.filter(o => o.order_status === 'paid').length,
    done: filteredOrders.filter(o => o.order_status === 'done').length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Orders</h1>
          <p className="text-gray-500 dark:text-gray-400">Manage all orders</p>
        </div>
        <Link href="/orders/new" className="btn btn-primary">
          + New Order
        </Link>
      </div>

      {/* Date Range Filter */}
      <div className="card">
        <DateRangeFilter onDateChange={handleDateChange} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card text-center">
          <p className="text-2xl font-bold text-gray-800 dark:text-white">{stats.total}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Total</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-yellow-600">{stats.booking}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Booking</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-green-600">{stats.paid}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Paid</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-blue-600">{stats.done}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Completed</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
        <input
          type="text"
          placeholder="ค้นหาชื่อ หรือ ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input flex-1 min-w-[200px]"
        />
        <input
          type="text"
          placeholder="รหัสสินค้า..."
          value={productCodeFilter}
          onChange={(e) => setProductCodeFilter(e.target.value)}
          className="input w-full sm:w-40"
        />
        <select
          value={salesFilter}
          onChange={(e) => setSalesFilter(e.target.value)}
          className="select w-full sm:w-40"
        >
          <option value="">Sales ทั้งหมด</option>
          {allStaff.map(staff => (
            <option key={staff.id} value={staff.id}>{staff.staff_name}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="select w-full sm:w-40"
        >
          <option value="">สถานะทั้งหมด</option>
          <option value="booking">Booking</option>
          <option value="paid">Paid</option>
          <option value="done">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="card text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">Loading...</p>
        </div>
      ) : (
        <>
          {/* Mobile Card View */}
          <div className="sm:hidden space-y-3">
            {filteredOrders.length === 0 ? (
              <div className="card text-center py-8">
                <p className="text-gray-500 dark:text-gray-400">No orders found</p>
              </div>
            ) : (
              filteredOrders.map((order) => {
                const badge = getStatusBadge(order.order_status)
                return (
                  <div key={order.id} className="card p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-gray-800 dark:text-white">#{order.id}</span>
                          <span className={`${badge.bg} ${badge.text} px-2 py-0.5 rounded-full text-xs font-medium`}>
                            {badge.label}
                          </span>
                        </div>
                        <p className="text-gray-800 dark:text-white font-medium">
                          {order.customers?.full_name || '-'}
                        </p>
                      </div>
                      <p className="text-lg font-bold text-pink-600">
                        {formatCurrency(order.total_income)}
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mb-3">
                      <span>{order.sales?.staff_name || '-'}</span>
                      <span>{formatDate(order.created_at)}</span>
                    </div>

                    <div className="flex items-center gap-2 pt-3 border-t dark:border-gray-700">
                      <Link
                        href={`/orders/${order.id}`}
                        className="flex-1 text-center py-2 bg-pink-500 text-white rounded-lg font-medium text-sm"
                      >
                        View
                      </Link>
                      <Link
                        href={`/orders/${order.id}/edit`}
                        className="flex-1 text-center py-2 bg-blue-500 text-white rounded-lg font-medium text-sm"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => setDeleteConfirm(order.id)}
                        className="px-3 py-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg font-medium text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden sm:block card p-0 overflow-hidden">
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Customer</th>
                    <th>Sales</th>
                    <th>Created</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => {
                    const badge = getStatusBadge(order.order_status)
                    return (
                      <tr key={order.id}>
                        <td className="font-medium text-gray-800 dark:text-white">#{order.id}</td>
                        <td className="text-gray-800 dark:text-white">{order.customers?.full_name || '-'}</td>
                        <td className="text-gray-600 dark:text-gray-300">{order.sales?.staff_name || '-'}</td>
                        <td className="text-gray-500 dark:text-gray-400 text-sm">{formatDate(order.created_at)}</td>
                        <td className="text-gray-800 dark:text-white font-medium">{formatCurrency(order.total_income)}</td>
                        <td>
                          <span className={`${badge.bg} ${badge.text} px-2 py-1 rounded-full text-xs font-medium`}>{badge.label}</span>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/orders/${order.id}`}
                              className="text-pink-500 hover:text-pink-600 font-medium"
                            >
                              View
                            </Link>
                            <Link
                              href={`/orders/${order.id}/edit`}
                              className="text-blue-500 hover:text-blue-600 font-medium"
                            >
                              Edit
                            </Link>
                            <button
                              onClick={() => setDeleteConfirm(order.id)}
                              className="text-red-500 hover:text-red-600 font-medium"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {filteredOrders.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center text-gray-500 dark:text-gray-400 py-8">
                        No orders found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">ยืนยันการลบ</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              คุณต้องการลบออเดอร์ #{deleteConfirm} หรือไม่?<br />
              <span className="text-red-500 text-sm">การกระทำนี้ไม่สามารถย้อนกลับได้</span>
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                disabled={deleting}
              >
                ยกเลิก
              </button>
              <button
                onClick={() => deleteOrder(deleteConfirm)}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
                disabled={deleting}
              >
                {deleting ? 'กำลังลบ...' : 'ลบออเดอร์'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
