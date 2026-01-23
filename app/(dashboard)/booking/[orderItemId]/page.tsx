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
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header - Clean and Minimal */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="container mx-auto px-4 py-3 max-w-5xl">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => router.back()}
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-xl w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              ←
            </button>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white truncate flex-1">
              {bookingTitle}
            </h1>
          </div>

          {/* Info Grid - Compact */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div className="bg-gray-50 dark:bg-gray-800 rounded px-2 py-1.5">
              <div className="text-gray-500 dark:text-gray-400 mb-0.5">วันนัด</div>
              <div className="font-medium text-gray-900 dark:text-white text-xs">
                {formatDateTime(orderItem.appointment_date)}
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded px-2 py-1.5">
              <div className="text-gray-500 dark:text-gray-400 mb-0.5">ช่าง</div>
              <div className="font-medium text-gray-900 dark:text-white text-xs">
                {orderItem.artists?.staff_name || '-'}
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded px-2 py-1.5">
              <div className="text-gray-500 dark:text-gray-400 mb-0.5">บริการ</div>
              <div className="font-medium text-gray-900 dark:text-white text-xs truncate">
                {orderItem.products?.product_name}
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded px-2 py-1.5">
              <div className="text-gray-500 dark:text-gray-400 mb-0.5">ราคา</div>
              <div className="font-medium text-pink-600 dark:text-pink-400 text-xs">
                ฿{orderItem.item_price.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Customer Info - Inline */}
          {orderItem.orders?.customers && (
            <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
              ลูกค้า: <span className="font-medium text-gray-900 dark:text-white">
                {orderItem.orders.customers.full_name}
                {orderItem.orders.customers.nickname && ` (${orderItem.orders.customers.nickname})`}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Chat Content - Takes Full Height */}
      <div className="flex-1 overflow-hidden">
        <div className="container mx-auto px-4 h-full max-w-5xl">
          <BookingChatBox orderItemId={orderItem.id} />
        </div>
      </div>
    </div>
  )
}
