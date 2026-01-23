'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import BookingChatBox from '@/app/focus/components/booking-chat-box'

interface OrderItemDetails {
  id: number
  appointment_date: string | null
  artist_id: number | null
  item_price: number
  booking_title: string | null
  products: {
    product_code: string
    product_name: string
  } | null
  artists: {
    staff_name: string
  } | null
  orders: {
    id: number
    customers: {
      full_name: string
      nickname: string | null
    }
  } | null
}

export default function BookingPage({ params }: { params: { orderItemId: string } }) {
  const router = useRouter()
  const supabase = createClient()
  const [orderItem, setOrderItem] = useState<OrderItemDetails | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadOrderItemDetails()
  }, [params.orderItemId])

  const loadOrderItemDetails = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('order_items')
      .select(`
        id,
        appointment_date,
        artist_id,
        item_price,
        booking_title,
        products (product_code, product_name),
        artists:staff!order_items_artist_id_fkey (staff_name),
        orders!inner (
          id,
          customers!inner (
            full_name,
            nickname
          )
        )
      `)
      .eq('id', params.orderItemId)
      .single()

    if (error) {
      console.error('Error loading order item:', error)
    } else {
      setOrderItem(data)
    }
    setLoading(false)
  }

  const formatDateTime = (dateTime: string | null) => {
    if (!dateTime) return '-'
    return new Date(dateTime).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center text-gray-500 py-8">กำลังโหลด...</div>
      </div>
    )
  }

  if (!orderItem) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-500 mb-4">ไม่พบข้อมูลการจอง</p>
          <button onClick={() => router.back()} className="btn-primary">
            กลับ
          </button>
        </div>
      </div>
    )
  }

  const bookingTitle = orderItem.booking_title || `${orderItem.artists?.staff_name || 'ไม่ระบุช่าง'}-${orderItem.products?.product_code || 'N/A'}`

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl shadow-2xl p-6 mb-6">
        <div className="flex items-start justify-between">
          <div className="text-white flex-1">
            <div className="flex items-center gap-3 mb-2">
              <button
                onClick={() => router.back()}
                className="text-white hover:text-gray-200 text-2xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/20"
              >
                ←
              </button>
              <h1 className="text-3xl font-bold">💬 Booking Chat</h1>
            </div>
            <p className="text-purple-100 text-xl font-medium mb-3">{bookingTitle}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-sm text-purple-100">
              <div className="bg-white/10 rounded-lg px-3 py-2">
                <div className="text-purple-200 text-xs mb-1">📅 วันนัด</div>
                <div className="font-medium">{formatDateTime(orderItem.appointment_date)}</div>
              </div>
              <div className="bg-white/10 rounded-lg px-3 py-2">
                <div className="text-purple-200 text-xs mb-1">👨‍🎨 ช่าง</div>
                <div className="font-medium">{orderItem.artists?.staff_name || '-'}</div>
              </div>
              <div className="bg-white/10 rounded-lg px-3 py-2">
                <div className="text-purple-200 text-xs mb-1">💼 บริการ</div>
                <div className="font-medium">{orderItem.products?.product_name}</div>
              </div>
              <div className="bg-white/10 rounded-lg px-3 py-2">
                <div className="text-purple-200 text-xs mb-1">💰 ราคา</div>
                <div className="font-medium">฿{orderItem.item_price.toLocaleString()}</div>
              </div>
            </div>
            {orderItem.orders?.customers && (
              <div className="mt-3 bg-white/10 rounded-lg px-3 py-2 inline-block">
                <div className="text-purple-200 text-xs mb-1">👤 ลูกค้า</div>
                <div className="font-medium">
                  {orderItem.orders.customers.full_name}
                  {orderItem.orders.customers.nickname && ` (${orderItem.orders.customers.nickname})`}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chat Content */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-6">
        <BookingChatBox orderItemId={orderItem.id} />
      </div>
    </div>
  )
}
