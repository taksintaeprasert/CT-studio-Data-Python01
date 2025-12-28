'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface Order {
  id: number
  order_date: string
  appointment_date: string | null
  order_status: string
  total_income: number
  deposit: number
  customers: { full_name: string } | null
  sales: { staff_name: string } | null
  artist: { staff_name: string } | null
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const supabase = createClient()

  useEffect(() => {
    fetchOrders()
  }, [])

  const fetchOrders = async () => {
    const { data } = await supabase
      .from('orders')
      .select(`
        id,
        order_date,
        appointment_date,
        order_status,
        total_income,
        deposit,
        customers (full_name),
        sales:staff!orders_sales_id_fkey (staff_name),
        artist:staff!orders_artist_id_fkey (staff_name)
      `)
      .order('created_at', { ascending: false })

    setOrders(data || [])
    setLoading(false)
  }

  const filteredOrders = orders.filter((order) => {
    const matchSearch = order.customers?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      order.id.toString().includes(search)
    const matchStatus = !statusFilter || order.order_status === statusFilter
    return matchSearch && matchStatus
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
    const badges: Record<string, { class: string; label: string }> = {
      booking: { class: 'badge-booking', label: 'จอง' },
      active: { class: 'badge-active', label: 'กำลังทำ' },
      done: { class: 'badge-done', label: 'เสร็จสิ้น' },
      cancel: { class: 'badge-cancel', label: 'ยกเลิก' },
    }
    return badges[status] || { class: 'badge', label: status }
  }

  // Calculate stats
  const stats = {
    total: orders.length,
    booking: orders.filter(o => o.order_status === 'booking').length,
    active: orders.filter(o => o.order_status === 'active').length,
    done: orders.filter(o => o.order_status === 'done').length,
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">คำสั่งซื้อ</h1>
          <p className="text-gray-500">จัดการรายการคำสั่งซื้อทั้งหมด</p>
        </div>
        <Link href="/orders/new" className="btn btn-primary">
          + สร้างออเดอร์ใหม่
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card text-center">
          <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
          <p className="text-sm text-gray-500">ทั้งหมด</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-yellow-600">{stats.booking}</p>
          <p className="text-sm text-gray-500">รอนัดหมาย</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-blue-600">{stats.active}</p>
          <p className="text-sm text-gray-500">กำลังทำ</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-green-600">{stats.done}</p>
          <p className="text-sm text-gray-500">เสร็จสิ้น</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <input
          type="text"
          placeholder="ค้นหาด้วยชื่อลูกค้าหรือรหัส..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input flex-1"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="select w-full sm:w-48"
        >
          <option value="">สถานะทั้งหมด</option>
          <option value="booking">จอง</option>
          <option value="active">กำลังทำ</option>
          <option value="done">เสร็จสิ้น</option>
          <option value="cancel">ยกเลิก</option>
        </select>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>รหัส</th>
                <th>ลูกค้า</th>
                <th>Sales</th>
                <th>Artist</th>
                <th>วันนัดหมาย</th>
                <th>ยอดเงิน</th>
                <th>สถานะ</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => {
                const badge = getStatusBadge(order.order_status)
                return (
                  <tr key={order.id}>
                    <td className="font-medium">#{order.id}</td>
                    <td>{order.customers?.full_name || '-'}</td>
                    <td>{order.sales?.staff_name || '-'}</td>
                    <td>{order.artist?.staff_name || '-'}</td>
                    <td>{formatDate(order.appointment_date)}</td>
                    <td>{formatCurrency(order.total_income)}</td>
                    <td>
                      <span className={`badge ${badge.class}`}>{badge.label}</span>
                    </td>
                    <td>
                      <Link
                        href={`/orders/${order.id}`}
                        className="text-pink-500 hover:text-pink-600 font-medium"
                      >
                        ดูรายละเอียด
                      </Link>
                    </td>
                  </tr>
                )
              })}
              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center text-gray-500 py-8">
                    ไม่พบรายการ
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
