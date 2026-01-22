'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import BookingChatBox from '@/app/focus/components/booking-chat-box'

interface BookingChatModalProps {
  orderItemId: number
  bookingTitle: string
  onClose: () => void
}

interface OrderItemDetails {
  id: number
  appointment_date: string | null
  artist_id: number | null
  products: {
    product_code: string
    product_name: string
  } | null
  artists: {
    staff_name: string
  } | null
  orders: {
    customers: {
      full_name: string
      nickname: string | null
    }
  } | null
}

export default function BookingChatModal({ orderItemId, bookingTitle, onClose }: BookingChatModalProps) {
  const supabase = createClient()
  const [orderItem, setOrderItem] = useState<OrderItemDetails | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadOrderItemDetails()
  }, [orderItemId])

  const loadOrderItemDetails = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('order_items')
      .select(`
        id,
        appointment_date,
        artist_id,
        products (product_code, product_name),
        artists:staff!order_items_artist_id_fkey (staff_name),
        orders!inner (
          customers!inner (
            full_name,
            nickname
          )
        )
      `)
      .eq('id', orderItemId)
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b dark:border-gray-700 bg-gradient-to-r from-purple-500 to-pink-500">
          <div className="flex items-start justify-between">
            <div className="text-white">
              <h2 className="text-2xl font-bold mb-2">💬 Booking Chat</h2>
              <p className="text-purple-100 text-lg font-medium">{bookingTitle}</p>
              {!loading && orderItem && (
                <div className="mt-3 space-y-1 text-sm text-purple-100">
                  <div>📅 วันนัด: {formatDateTime(orderItem.appointment_date)}</div>
                  <div>👨‍🎨 ช่าง: {orderItem.artists?.staff_name || '-'}</div>
                  <div>💼 บริการ: {orderItem.products?.product_name}</div>
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 text-2xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/20"
            >
              ×
            </button>
          </div>
        </div>

        {/* Chat Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center text-gray-500 py-8">กำลังโหลด...</div>
          ) : (
            <BookingChatBox orderItemId={orderItemId} />
          )}
        </div>
      </div>
    </div>
  )
}
