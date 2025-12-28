'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface OrderDetail {
  id: number
  order_date: string
  appointment_date: string | null
  appointment_time: string | null
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
  products: { product_name: string; list_price: number } | null
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
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('โอนเงิน')
  const [paymentNote, setPaymentNote] = useState('')

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
          products (product_name, list_price)
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

  const updateStatus = async (newStatus: string) => {
    await supabase
      .from('orders')
      .update({ order_status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', params.id)
    fetchOrder()
  }

  const addPayment = async () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) return

    await supabase.from('payments').insert({
      order_id: parseInt(params.id),
      amount: parseFloat(paymentAmount),
      payment_method: paymentMethod,
      note: paymentNote || null,
    })

    setShowPaymentModal(false)
    setPaymentAmount('')
    setPaymentNote('')
    fetchOrder()
  }

  const deleteOrder = async () => {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบออเดอร์นี้?')) return

    await supabase.from('orders').delete().eq('id', params.id)
    router.push('/orders')
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
    const badges: Record<string, { class: string; label: string }> = {
      booking: { class: 'badge-booking', label: 'จอง' },
      active: { class: 'badge-active', label: 'กำลังทำ' },
      done: { class: 'badge-done', label: 'เสร็จสิ้น' },
      cancel: { class: 'badge-cancel', label: 'ยกเลิก' },
    }
    return badges[status] || { class: 'badge', label: status }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">กำลังโหลด...</div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-bold text-gray-800">ไม่พบออเดอร์</h2>
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
            <h1 className="text-2xl font-bold text-gray-800">ออเดอร์ #{order.id}</h1>
            <p className="text-gray-500">{formatDate(order.order_date)}</p>
          </div>
        </div>
        <span className={`badge ${badge.class} text-lg px-4 py-2`}>{badge.label}</span>
      </div>

      {/* Order Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card space-y-4">
          <h2 className="font-bold text-gray-800 border-b pb-2">ข้อมูลออเดอร์</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-500">ลูกค้า</span>
              <span className="font-medium">{order.customers?.full_name || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Sales</span>
              <span className="font-medium">{order.sales?.staff_name || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Artist</span>
              <span className="font-medium">{order.artist?.staff_name || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">วันนัดหมาย</span>
              <span className="font-medium">
                {formatDate(order.appointment_date)}
                {order.appointment_time && ` ${order.appointment_time}`}
              </span>
            </div>
            {order.note && (
              <div className="pt-2 border-t">
                <span className="text-gray-500">หมายเหตุ:</span>
                <p className="mt-1">{order.note}</p>
              </div>
            )}
          </div>
        </div>

        <div className="card space-y-4">
          <h2 className="font-bold text-gray-800 border-b pb-2">สรุปการชำระเงิน</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-500">ยอดรวม</span>
              <span className="font-medium">{formatCurrency(order.total_income)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">ชำระแล้ว</span>
              <span className="font-medium text-green-600">{formatCurrency(totalPaid)}</span>
            </div>
            <div className="flex justify-between text-lg pt-2 border-t">
              <span className="font-bold">คงเหลือ</span>
              <span className={`font-bold ${remaining > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {formatCurrency(remaining)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Order Items */}
      <div className="card">
        <h2 className="font-bold text-gray-800 border-b pb-2 mb-4">รายการสินค้า/บริการ</h2>
        <div className="space-y-2">
          {orderItems.map(item => (
            <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <span className="font-medium">{item.products?.product_name}</span>
                {item.is_upsell && (
                  <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded">Upsell</span>
                )}
              </div>
              <span className="text-gray-600">{formatCurrency(item.products?.list_price || 0)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Payments */}
      <div className="card">
        <div className="flex items-center justify-between border-b pb-2 mb-4">
          <h2 className="font-bold text-gray-800">ประวัติการชำระเงิน</h2>
          <button
            onClick={() => setShowPaymentModal(true)}
            className="btn btn-primary text-sm"
          >
            + เพิ่มการชำระ
          </button>
        </div>
        <div className="space-y-2">
          {payments.length > 0 ? (
            payments.map(payment => (
              <div key={payment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <span className="font-medium">{formatDate(payment.payment_date)}</span>
                  {payment.note && <span className="text-gray-500 ml-2">({payment.note})</span>}
                </div>
                <div className="text-right">
                  <span className="font-medium text-green-600">{formatCurrency(payment.amount)}</span>
                  <span className="text-gray-500 text-sm ml-2">{payment.payment_method}</span>
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-gray-500 py-4">ยังไม่มีการชำระเงิน</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="card">
        <h2 className="font-bold text-gray-800 border-b pb-2 mb-4">เปลี่ยนสถานะ</h2>
        <div className="flex flex-wrap gap-2">
          {order.order_status !== 'booking' && (
            <button onClick={() => updateStatus('booking')} className="btn bg-yellow-100 text-yellow-800">
              จอง
            </button>
          )}
          {order.order_status !== 'active' && (
            <button onClick={() => updateStatus('active')} className="btn bg-blue-100 text-blue-800">
              กำลังทำ
            </button>
          )}
          {order.order_status !== 'done' && (
            <button onClick={() => updateStatus('done')} className="btn bg-green-100 text-green-800">
              เสร็จสิ้น
            </button>
          )}
          {order.order_status !== 'cancel' && (
            <button onClick={() => updateStatus('cancel')} className="btn bg-red-100 text-red-800">
              ยกเลิก
            </button>
          )}
        </div>
        <div className="border-t mt-4 pt-4">
          <button onClick={deleteOrder} className="btn btn-danger">
            ลบออเดอร์
          </button>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-800">เพิ่มการชำระเงิน</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">จำนวนเงิน</label>
              <input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="input"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">วิธีชำระ</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="select"
              >
                <option value="โอนเงิน">โอนเงิน</option>
                <option value="เงินสด">เงินสด</option>
                <option value="บัตรเครดิต">บัตรเครดิต</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">หมายเหตุ</label>
              <input
                type="text"
                value={paymentNote}
                onChange={(e) => setPaymentNote(e.target.value)}
                className="input"
                placeholder="เช่น ชำระส่วนที่เหลือ"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="btn btn-secondary flex-1"
              >
                ยกเลิก
              </button>
              <button onClick={addPayment} className="btn btn-primary flex-1">
                บันทึก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
