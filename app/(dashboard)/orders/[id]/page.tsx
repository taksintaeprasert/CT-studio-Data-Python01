'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface OrderDetail {
  id: number
  order_date: string
  created_at: string
  order_status: string
  total_income: number
  deposit: number
  payment_method: string | null
  note: string | null
  customers: { id: number; full_name: string } | null
  sales: { id: number; staff_name: string } | null
  artist: { id: number; staff_name: string } | null
}

interface OrderItem {
  id: number
  is_upsell: boolean
  products: { product_name: string; list_price: number; is_free: boolean } | null
}

interface Payment {
  id: number
  payment_date: string
  amount: number
  payment_method: string | null
  note: string | null
}

export default function OrderDetailPage({ params }: { params: { id: string } }) {
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    fetchOrder()
  }, [params.id])

  const fetchOrder = async () => {
    const [orderRes, itemsRes, paymentsRes] = await Promise.all([
      supabase
        .from('orders')
        .select(`
          *,
          customers (id, full_name),
          sales:staff!orders_sales_id_fkey (id, staff_name),
          artist:staff!orders_artist_id_fkey (id, staff_name)
        `)
        .eq('id', params.id)
        .single(),
      supabase
        .from('order_items')
        .select(`
          id,
          is_upsell,
          products (product_name, list_price, is_free)
        `)
        .eq('order_id', params.id),
      supabase
        .from('payments')
        .select('*')
        .eq('order_id', params.id)
        .order('payment_date', { ascending: false }),
    ])

    setOrder(orderRes.data)
    setOrderItems(itemsRes.data || [])
    setPayments(paymentsRes.data || [])
    setLoading(false)
  }

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
      month: 'long',
      year: 'numeric',
    })
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      booking: { bg: 'bg-yellow-500', text: 'text-white', label: 'จอง' },
      paid: { bg: 'bg-green-500', text: 'text-white', label: 'ชำระแล้ว' },
      done: { bg: 'bg-blue-500', text: 'text-white', label: 'เสร็จสิ้น' },
      cancelled: { bg: 'bg-red-500', text: 'text-white', label: 'ยกเลิก' },
    }
    return badges[status] || { bg: 'bg-gray-500', text: 'text-white', label: status }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500 dark:text-gray-400">กำลังโหลด...</div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white">ไม่พบออเดอร์</h2>
        <Link href="/orders" className="text-pink-500 hover:text-pink-600 mt-2 inline-block">
          กลับไปหน้ารายการ
        </Link>
      </div>
    )
  }

  const badge = getStatusBadge(order.order_status)
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)
  const remaining = order.total_income - totalPaid

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/orders" className="btn btn-secondary">
            ← กลับ
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">ออเดอร์ #{order.id}</h1>
            <p className="text-gray-500 dark:text-gray-400">{formatDate(order.order_date)}</p>
          </div>
        </div>
        <span className={`${badge.bg} ${badge.text} text-lg px-4 py-2 rounded-xl font-bold`}>{badge.label}</span>
      </div>

      {/* Order Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card space-y-4">
          <h2 className="font-bold text-gray-800 dark:text-white border-b dark:border-gray-700 pb-2">ข้อมูลออเดอร์</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">ลูกค้า</span>
              <span className="font-medium text-gray-800 dark:text-white">{order.customers?.full_name || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Sales</span>
              <span className="font-medium text-gray-800 dark:text-white">{order.sales?.staff_name || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Artist</span>
              <span className="font-medium text-gray-800 dark:text-white">{order.artist?.staff_name || '-'}</span>
            </div>
            {order.note && (
              <div className="pt-2 border-t dark:border-gray-700">
                <span className="text-gray-500 dark:text-gray-400">หมายเหตุ:</span>
                <p className="mt-1 text-gray-800 dark:text-white">{order.note}</p>
              </div>
            )}
          </div>
        </div>

        <div className="card space-y-4">
          <h2 className="font-bold text-gray-800 dark:text-white border-b dark:border-gray-700 pb-2">สรุปการชำระเงิน</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">ยอดรวม</span>
              <span className="font-medium text-gray-800 dark:text-white">{formatCurrency(order.total_income)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">ชำระแล้ว</span>
              <span className="font-medium text-green-600">{formatCurrency(totalPaid)}</span>
            </div>
            <div className="flex justify-between text-lg pt-2 border-t dark:border-gray-700">
              <span className="font-bold text-gray-800 dark:text-white">คงเหลือ</span>
              <span className={`font-bold ${remaining > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {formatCurrency(remaining)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Order Items */}
      <div className="card">
        <h2 className="font-bold text-gray-800 dark:text-white border-b dark:border-gray-700 pb-2 mb-4">รายการสินค้า/บริการ</h2>
        <div className="space-y-2">
          {orderItems.map(item => (
            <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="flex items-center gap-3">
                <span className="font-medium text-gray-800 dark:text-white">{item.products?.product_name}</span>
                {item.products?.is_free && (
                  <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 px-2 py-0.5 rounded">ฟรี</span>
                )}
                {item.is_upsell && (
                  <span className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 px-2 py-0.5 rounded">Upsell</span>
                )}
              </div>
              <span className="text-gray-600 dark:text-gray-300">{formatCurrency(item.products?.list_price || 0)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Payments History */}
      <div className="card">
        <div className="flex items-center justify-between border-b dark:border-gray-700 pb-2 mb-4">
          <h2 className="font-bold text-gray-800 dark:text-white">ประวัติการชำระเงิน</h2>
        </div>
        <div className="space-y-2">
          {payments.length > 0 ? (
            payments.map(payment => (
              <div key={payment.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div>
                  <span className="font-medium text-gray-800 dark:text-white">{formatDate(payment.payment_date)}</span>
                  {payment.note && <span className="text-gray-500 dark:text-gray-400 ml-2">({payment.note})</span>}
                </div>
                <div className="text-right">
                  <span className="font-medium text-green-600">{formatCurrency(payment.amount)}</span>
                  <span className="text-gray-500 dark:text-gray-400 text-sm ml-2">{payment.payment_method}</span>
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-gray-500 dark:text-gray-400 py-4">ยังไม่มีการชำระเงิน</p>
          )}
        </div>
      </div>

      {/* Info Note */}
      <div className="card bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
        <p className="text-blue-800 dark:text-blue-200 text-sm">
          To receive payment or change status, please go to <Link href="/service" className="font-bold underline hover:text-blue-600">Appointments</Link> page.
        </p>
      </div>
    </div>
  )
}
