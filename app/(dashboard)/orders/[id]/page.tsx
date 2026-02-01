'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import BookingModal from '@/app/focus/components/booking-modal'

interface Customer {
  id: number
  full_name: string
  nickname: string | null
  phone: string | null
  age: number | null
  medical_condition: string | null
  color_allergy: string | null
  drug_allergy: string | null
  face_photo_url: string | null
}

interface OrderDetail {
  id: number
  order_date: string
  created_at: string
  order_status: string
  total_income: number
  deposit: number
  payment_method: string | null
  note: string | null
  customers: Customer | null
  sales: { id: number; staff_name: string } | null
  artist: { id: number; staff_name: string } | null
}

interface OrderItem {
  id: number
  product_id: number
  is_upsell: boolean
  item_status: string
  item_price: number
  appointment_date: string | null
  appointment_time: string | null
  artist_id: number | null
  products: { product_name: string; list_price: number; is_free: boolean; product_code: string } | null
  artist: { id: number; staff_name: string } | null
}

interface Payment {
  id: number
  payment_date: string
  amount: number
  payment_method: string | null
  note: string | null
  receipt_url: string | null
}

interface Staff {
  id: number
  staff_name: string
}

export default function OrderDetailPage({ params }: { params: { id: string } }) {
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [artists, setArtists] = useState<Staff[]>([])

  // Schedule modal state
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [selectedItemForSchedule, setSelectedItemForSchedule] = useState<OrderItem | null>(null)
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')
  const [scheduleArtistId, setScheduleArtistId] = useState('')
  const [savingSchedule, setSavingSchedule] = useState(false)

  // Booking modal state (with chat)
  const [showBookingModal, setShowBookingModal] = useState(false)
  const [bookingOrderItem, setBookingOrderItem] = useState<OrderItem | null>(null)

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    fetchOrder()
    fetchArtists()
  }, [params.id])

  const fetchArtists = async () => {
    const { data } = await supabase
      .from('staff')
      .select('id, staff_name')
      .eq('role', 'artist')
      .eq('is_active', true)
      .order('staff_name')

    setArtists(data || [])
  }

  const fetchOrder = async () => {
    const [orderRes, itemsRes, paymentsRes] = await Promise.all([
      supabase
        .from('orders')
        .select(`
          *,
          customers (*),
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
          item_status,
          appointment_date,
          appointment_time,
          artist_id,
          products (product_name, list_price, is_free, product_code),
          artist:staff!order_items_artist_id_fkey (id, staff_name)
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

  // Open schedule modal
  const openScheduleModal = (item: OrderItem) => {
    setSelectedItemForSchedule(item)
    setScheduleDate(item.appointment_date || '')
    setScheduleTime(item.appointment_time || '')
    setScheduleArtistId(item.artist_id ? String(item.artist_id) : '')
    setShowScheduleModal(true)
  }

  // Save schedule
  const saveSchedule = async () => {
    if (!selectedItemForSchedule) return

    setSavingSchedule(true)

    const { error } = await supabase
      .from('order_items')
      .update({
        appointment_date: scheduleDate || null,
        appointment_time: scheduleTime || null,
        artist_id: scheduleArtistId ? parseInt(scheduleArtistId) : null,
        item_status: 'scheduled', // Auto set to scheduled
      })
      .eq('id', selectedItemForSchedule.id)

    if (error) {
      alert('เกิดข้อผิดพลาดในการบันทึก')
      console.error(error)
    } else {
      setShowScheduleModal(false)
      fetchOrder() // Refresh data
    }

    setSavingSchedule(false)
  }

  // Open booking modal with chat
  const openBookingModal = (item: OrderItem) => {
    if (!order?.customers) return

    setBookingOrderItem(item)
    setShowBookingModal(true)
  }

  const closeBookingModal = () => {
    setShowBookingModal(false)
    setBookingOrderItem(null)
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
          <h2 className="font-bold text-gray-800 dark:text-white border-b dark:border-gray-700 pb-2">ข้อมูลลูกค้า</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">ชื่อเล่น</span>
              <span className="font-medium text-gray-800 dark:text-white">{order.customers?.nickname || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">เบอร์โทร</span>
              <span className="font-medium text-gray-800 dark:text-white">{order.customers?.phone || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">อายุ</span>
              <span className="font-medium text-gray-800 dark:text-white">{order.customers?.age ? `${order.customers.age} ปี` : '-'}</span>
            </div>
            {order.customers?.medical_condition && (
              <div className="pt-2 border-t dark:border-gray-700">
                <span className="text-gray-500 dark:text-gray-400">โรคประจำตัว:</span>
                <p className="mt-1 text-gray-800 dark:text-white">{order.customers.medical_condition}</p>
              </div>
            )}
            {order.customers?.color_allergy && (
              <div className="pt-2 border-t dark:border-gray-700">
                <span className="text-gray-500 dark:text-gray-400">ประวัติแพ้สี:</span>
                <p className="mt-1 text-gray-800 dark:text-white">{order.customers.color_allergy}</p>
              </div>
            )}
            {order.customers?.drug_allergy && (
              <div className="pt-2 border-t dark:border-gray-700">
                <span className="text-gray-500 dark:text-gray-400">ประวัติแพ้ยา:</span>
                <p className="mt-1 text-gray-800 dark:text-white">{order.customers.drug_allergy}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
              <div key={payment.id} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="font-medium text-gray-800 dark:text-white">{formatDate(payment.payment_date)}</span>
                    {payment.note && <span className="text-gray-500 dark:text-gray-400 ml-2">({payment.note})</span>}
                  </div>
                  <div className="text-right">
                    <span className="font-medium text-green-600">{formatCurrency(payment.amount)}</span>
                    <span className="text-gray-500 dark:text-gray-400 text-sm ml-2">{payment.payment_method}</span>
                  </div>
                </div>
                {payment.receipt_url && (
                  <div className="flex items-center gap-3 mt-2">
                    {/* Thumbnail */}
                    <a
                      href={payment.receipt_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative w-16 h-16 rounded-lg overflow-hidden border-2 border-green-400 dark:border-green-500 hover:border-green-500 dark:hover:border-green-400 transition-colors cursor-pointer flex-shrink-0 group"
                    >
                      <Image
                        src={payment.receipt_url}
                        alt="สลิปการโอนเงิน"
                        fill
                        className="object-cover"
                        sizes="64px"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement
                          target.style.display = 'none'
                          const parent = target.parentElement
                          if (parent) {
                            parent.innerHTML = `
                              <div class="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
                                <svg class="w-6 h-6 text-gray-400 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                </svg>
                              </div>
                            `
                          }
                        }}
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all" />
                    </a>

                    {/* Text link */}
                    <a
                      href={payment.receipt_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline transition-colors"
                    >
                      📎 ดูสลิปการโอนเงิน
                    </a>
                  </div>
                )}
              </div>
            ))
          ) : (
            <p className="text-center text-gray-500 dark:text-gray-400 py-4">ยังไม่มีการชำระเงิน</p>
          )}
        </div>
      </div>

      {/* Schedule Services Section */}
      <div className="card space-y-4">
        <h2 className="font-bold text-gray-800 dark:text-white border-b dark:border-gray-700 pb-2">นัดหมายบริการ</h2>
        <div className="space-y-3">
          {orderItems.map(item => {
            const statusColor = item.item_status === 'scheduled' ? 'text-blue-500' :
                               item.item_status === 'completed' ? 'text-green-500' :
                               item.item_status === 'cancelled' ? 'text-red-500' : 'text-gray-500'
            const statusLabel = item.item_status === 'scheduled' ? 'นัดแล้ว' :
                               item.item_status === 'completed' ? 'เสร็จแล้ว' :
                               item.item_status === 'cancelled' ? 'ยกเลิก' : 'รอนัด'
            const isBooked = item.appointment_date !== null && item.artist_id !== null

            return (
              <div key={item.id} className={`flex items-center justify-between p-4 ${isBooked ? 'bg-gray-50 dark:bg-gray-700/50' : 'bg-gradient-to-r from-pink-50 to-purple-50 dark:from-pink-900/20 dark:to-purple-900/20 border-2 border-pink-300 dark:border-pink-700'} rounded-xl`}>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-pink-500 font-mono">[{item.products?.product_code}]</span>
                    <span className="font-medium text-gray-800 dark:text-white">{item.products?.product_name}</span>
                    {item.products?.is_free && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">ฟรี</span>
                    )}
                  </div>
                  <div className="text-sm space-y-1">
                    <div>
                      <span className={`font-medium ${statusColor}`}>{statusLabel}</span>
                      {item.appointment_date && (
                        <span className="text-gray-500 dark:text-gray-400 ml-2">
                          {new Date(item.appointment_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {item.appointment_time && ` ${item.appointment_time}`}
                        </span>
                      )}
                    </div>
                    {item.artist && (
                      <div className="text-gray-600 dark:text-gray-300">
                        👨‍🎨 ช่าง: <span className="font-medium">{item.artist.staff_name}</span>
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => openBookingModal(item)}
                  className={`px-6 py-3 text-white rounded-xl font-bold text-lg shadow-lg transition-all ${
                    isBooked
                      ? 'bg-pink-500 hover:bg-pink-600 hover:scale-105'
                      : 'bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 hover:scale-110 animate-pulse hover:animate-none'
                  }`}
                >
                  {isBooked ? '🔄 แก้ไขคิว' : '🎯 ลงคิวช่าง!'}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Info Note */}
      <div className="card bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
        <p className="text-blue-800 dark:text-blue-200 text-sm">
          To receive payment or change status, please go to <Link href="/service" className="font-bold underline hover:text-blue-600">Appointments</Link> page.
        </p>
      </div>

      {/* Schedule Modal */}
      {showScheduleModal && selectedItemForSchedule && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white">
              ลงคิวช่าง: {selectedItemForSchedule.products?.product_name}
            </h3>

            {/* Artist Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                ช่าง
              </label>
              <select
                value={scheduleArtistId}
                onChange={(e) => setScheduleArtistId(e.target.value)}
                className="select w-full"
              >
                <option value="">-- เลือกช่าง --</option>
                {artists.map(artist => (
                  <option key={artist.id} value={artist.id}>
                    {artist.staff_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  วันที่นัด
                </label>
                <input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  เวลา
                </label>
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="input w-full"
                />
              </div>
            </div>

            <p className="text-sm text-blue-600 dark:text-blue-400">
              * สถานะจะเปลี่ยนเป็น "นัดหมายแล้ว" อัตโนมัติเมื่อบันทึก
            </p>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowScheduleModal(false)}
                className="btn btn-secondary flex-1"
              >
                ยกเลิก
              </button>
              <button
                onClick={saveSchedule}
                disabled={savingSchedule}
                className="btn btn-primary flex-1"
              >
                {savingSchedule ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Booking Modal with Chat */}
      {showBookingModal && bookingOrderItem && order?.customers && (
        <BookingModal
          orderItem={{
            id: bookingOrderItem.id,
            product_id: bookingOrderItem.products?.product_code ? parseInt(bookingOrderItem.products.product_code) : 0,
            item_price: bookingOrderItem.products?.list_price || 0,
            appointment_date: bookingOrderItem.appointment_date,
            artist_id: bookingOrderItem.artist_id,
            products: bookingOrderItem.products ? {
              product_code: bookingOrderItem.products.product_code,
              product_name: bookingOrderItem.products.product_name,
              list_price: bookingOrderItem.products.list_price,
            } : null,
          }}
          customer={order.customers}
          orderId={order.id}
          onClose={closeBookingModal}
          onComplete={async () => {
            closeBookingModal()
            await fetchOrder()
          }}
        />
      )}
    </div>
  )
}
