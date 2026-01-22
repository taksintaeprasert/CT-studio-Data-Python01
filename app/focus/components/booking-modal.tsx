'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/user-context'
import BookingChatBox from './booking-chat-box'

interface BookingModalProps {
  orderItem: {
    id: number
    product_id: number
    item_price: number
    appointment_date: string | null
    artist_id: number | null
    products: {
      product_code: string
      product_name: string
      list_price: number
    } | null
  }
  customer: {
    id: number
    full_name: string
    nickname: string | null
    phone: string | null
  }
  onClose: () => void
  onComplete: () => void
}

interface Artist {
  id: number
  staff_name: string
  email: string
}

export default function BookingModal({ orderItem, customer, onClose, onComplete }: BookingModalProps) {
  const supabase = createClient()
  const { user } = useUser()

  const [artists, setArtists] = useState<Artist[]>([])
  const [selectedArtist, setSelectedArtist] = useState<number | null>(orderItem.artist_id)
  const [appointmentDate, setAppointmentDate] = useState('')
  const [appointmentTime, setAppointmentTime] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadArtists()
    
    // Pre-fill if already booked
    if (orderItem.appointment_date) {
      const date = new Date(orderItem.appointment_date)
      setAppointmentDate(date.toISOString().split('T')[0])
      setAppointmentTime(date.toTimeString().slice(0, 5))
    } else {
      // Default to today
      setAppointmentDate(new Date().toISOString().split('T')[0])
    }
  }, [orderItem])

  const loadArtists = async () => {
    const { data } = await supabase
      .from('staff')
      .select('id, staff_name, email')
      .eq('role', 'artist')
      .eq('is_active', true)
      .order('staff_name')

    setArtists(data || [])
  }

  const handleSave = async () => {
    if (!selectedArtist) {
      alert('กรุณาเลือกช่าง')
      return
    }

    if (!appointmentDate) {
      alert('กรุณาเลือกวันนัดหมาย')
      return
    }

    setSaving(true)

    try {
      // Combine date and time
      const dateTimeString = appointmentTime
        ? `${appointmentDate}T${appointmentTime}:00`
        : `${appointmentDate}T10:00:00`

      // Get artist info
      const artist = artists.find(a => a.id === selectedArtist)

      // Create booking title: ชื่อช่าง-รหัสบริการ-ชื่อจริงลูกค้า-ชื่อเล่น
      const firstName = customer.full_name.split(' ')[0]
      const bookingTitle = `${artist?.staff_name || 'ไม่ระบุช่าง'}-${orderItem.products?.product_code || 'N/A'}-${firstName}-${customer.nickname || ''}`

      const { error } = await supabase
        .from('order_items')
        .update({
          artist_id: selectedArtist,
          appointment_date: dateTimeString,
          booking_title: bookingTitle,
        })
        .eq('id', orderItem.id)

      if (error) throw error

      // Create system message
      await supabase.from('booking_messages').insert({
        order_item_id: orderItem.id,
        sender_type: 'system',
        message_type: 'text',
        message_text: `จองคิวช่าง ${artist?.staff_name} วันที่ ${new Date(dateTimeString).toLocaleDateString('th-TH', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}`,
        is_read: false,
      })

      alert('✅ บันทึกการจองสำเร็จ!')
      onComplete()
    } catch (error) {
      console.error('Error saving booking:', error)
      alert('เกิดข้อผิดพลาดในการบันทึก')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b dark:border-gray-700 bg-gradient-to-r from-purple-500 to-pink-500">
          <div className="flex items-start justify-between">
            <div className="text-white">
              <h2 className="text-2xl font-bold mb-1">📅 จองคิวช่าง</h2>
              <p className="text-purple-100 text-sm">
                {orderItem.products?.product_name} • {customer.full_name}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 text-2xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/20"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Booking Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Artist Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                เลือกช่าง <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedArtist || ''}
                onChange={(e) => setSelectedArtist(parseInt(e.target.value))}
                className="input w-full"
              >
                <option value="">-- เลือกช่าง --</option>
                {artists.map(artist => (
                  <option key={artist.id} value={artist.id}>
                    {artist.staff_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                วันที่นัดหมาย <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={appointmentDate}
                onChange={(e) => setAppointmentDate(e.target.value)}
                className="input w-full"
              />
            </div>

            {/* Time */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                เวลานัดหมาย
              </label>
              <input
                type="time"
                value={appointmentTime}
                onChange={(e) => setAppointmentTime(e.target.value)}
                className="input w-full"
              />
            </div>

            {/* Price */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                ราคา
              </label>
              <div className="input w-full bg-gray-50 dark:bg-gray-800 text-pink-600 dark:text-pink-400 font-bold">
                ฿{orderItem.item_price.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Chat Box */}
          <div className="border-t dark:border-gray-700 pt-6">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
              <span>💬</span> บันทึกและแชทเกี่ยวกับการจอง
            </h3>
            <BookingChatBox orderItemId={orderItem.id} />
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="btn-secondary flex-1 py-3"
          >
            ยกเลิก
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary flex-1 py-3"
          >
            {saving ? 'กำลังบันทึก...' : '✅ บันทึกการจอง'}
          </button>
        </div>
      </div>
    </div>
  )
}
