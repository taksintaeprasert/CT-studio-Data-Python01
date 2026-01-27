'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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
    age: number | null
    medical_condition: string | null
    color_allergy: string | null
    drug_allergy: string | null
    face_photo_url: string | null
  }
  orderId: number
  onClose: () => void
  onComplete: () => void
}

interface Artist {
  id: number
  staff_name: string
  email: string
}

export default function BookingModal({ orderItem, customer, orderId, onClose, onComplete }: BookingModalProps) {
  const router = useRouter()
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
    }
    // Don't set default date - allow booking without date
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

  const sendCustomerInfoToChat = async () => {
    try {
      const messages: any[] = []

      // 1. Get payment receipt (slip)
      const { data: payments } = await supabase
        .from('payments')
        .select('receipt_url, receipt_path, amount, payment_method')
        .eq('order_id', orderId)
        .not('receipt_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)

      if (payments && payments.length > 0 && payments[0].receipt_url) {
        messages.push({
          order_item_id: orderItem.id,
          sender_type: 'system',
          message_type: 'file',
          message_text: `💰 สลิปโอนเงิน: ${payments[0].payment_method} ฿${payments[0].amount.toLocaleString()}`,
          file_url: payments[0].receipt_url,
          file_name: 'สลิปโอนเงิน',
          is_read: false,
        })
      }

      // 2. Send customer face photo (from order creation)
      if (customer.face_photo_url) {
        messages.push({
          order_item_id: orderItem.id,
          sender_type: 'system',
          message_type: 'file',
          message_text: '📸 รูปหน้าลูกค้า',
          file_url: customer.face_photo_url,
          file_name: 'รูปหน้าลูกค้า',
          is_read: false,
        })
      }

      // 3. Get customer photos (before photos from service_photos table)
      const { data: photos } = await supabase
        .from('service_photos')
        .select('photo_url, photo_type')
        .eq('customer_id', customer.id)
        .eq('photo_type', 'before')
        .order('created_at', { ascending: false })
        .limit(3)

      if (photos && photos.length > 0) {
        for (const photo of photos) {
          messages.push({
            order_item_id: orderItem.id,
            sender_type: 'system',
            message_type: 'file',
            message_text: '',
            file_url: photo.photo_url,
            file_name: 'รูปหน้าลูกค้า',
            is_read: false,
          })
        }
      }

      // 4. Send customer information text
      const infoLines: string[] = []

      if (customer.nickname) {
        infoLines.push(`👤 ชื่อเล่น: ${customer.nickname}`)
      }

      if (customer.age) {
        infoLines.push(`🎂 อายุ: ${customer.age} ปี`)
      }

      if (customer.color_allergy && customer.color_allergy.trim()) {
        infoLines.push(`⚠️ ประวัติแพ้สี: ${customer.color_allergy}`)
      }

      if (customer.drug_allergy && customer.drug_allergy.trim()) {
        infoLines.push(`⚠️ ประวัติแพ้ยา: ${customer.drug_allergy}`)
      }

      if (customer.medical_condition && customer.medical_condition.trim()) {
        infoLines.push(`🏥 โรคประจำตัว: ${customer.medical_condition}`)
      }

      if (infoLines.length > 0) {
        messages.push({
          order_item_id: orderItem.id,
          sender_type: 'system',
          message_type: 'text',
          message_text: '📋 ข้อมูลลูกค้า:\n' + infoLines.join('\n'),
          is_read: false,
        })
      }

      // Insert all messages
      if (messages.length > 0) {
        const { error } = await supabase
          .from('booking_messages')
          .insert(messages)

        if (error) {
          console.error('Error sending customer info to chat:', error)
        }
      }
    } catch (error) {
      console.error('Error in sendCustomerInfoToChat:', error)
    }
  }

  const handleSave = async () => {
    if (!selectedArtist) {
      alert('กรุณาเลือกช่าง')
      return
    }

    // Date is now optional - booking can be saved without appointment date

    setSaving(true)

    try {
      // Get artist info
      const artist = artists.find(a => a.id === selectedArtist)

      // Create booking title: ชื่อช่าง-รหัสบริการ-ชื่อจริงลูกค้า-ชื่อเล่น
      const firstName = customer.full_name.split(' ')[0]
      const bookingTitle = `${artist?.staff_name || 'ไม่ระบุช่าง'}-${orderItem.products?.product_code || 'N/A'}-${firstName}-${customer.nickname || ''}`

      const { error } = await supabase
        .from('order_items')
        .update({
          artist_id: selectedArtist,
          appointment_date: appointmentDate || null,
          appointment_time: appointmentTime || null,
          booking_title: bookingTitle,
          item_status: appointmentDate ? 'scheduled' : 'pending',
        })
        .eq('id', orderItem.id)

      if (error) {
        console.error('Update error:', error)
        throw error
      }

      // Create system message
      let messageText = ''
      if (appointmentDate) {
        const dateTimeForMessage = appointmentTime
          ? `${appointmentDate}T${appointmentTime}:00`
          : `${appointmentDate}T10:00:00`

        messageText = `จองคิวช่าง ${artist?.staff_name} วันที่ ${new Date(dateTimeForMessage).toLocaleDateString('th-TH', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}`
      } else {
        messageText = `เลือกช่าง ${artist?.staff_name} (ยังไม่ได้นัดหมายวัน)`
      }

      const { error: msgError } = await supabase.from('booking_messages').insert({
        order_item_id: orderItem.id,
        sender_type: 'system',
        message_type: 'text',
        message_text: messageText,
        is_read: false,
      })

      if (msgError) {
        console.error('Message insert error:', msgError)
      }

      // Send customer information to chat
      await sendCustomerInfoToChat()

      if (appointmentDate) {
        alert('✅ บันทึกการจองสำเร็จ!')
      } else {
        alert('✅ บันทึกการเลือกช่างสำเร็จ! (ยังไม่ได้นัดหมายวัน)')
      }

      // Navigate to full page booking view
      router.push(`/booking/${orderItem.id}`)

      // Close modal after a short delay to allow navigation
      setTimeout(() => {
        onComplete()
      }, 100)
    } catch (error: any) {
      console.error('Error saving booking:', error)
      alert(`เกิดข้อผิดพลาดในการบันทึก: ${error.message || 'Unknown error'}`)
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
                วันที่นัดหมาย <span className="text-gray-400 text-xs">(ไม่บังคับ)</span>
              </label>
              <div className="space-y-2">
                <input
                  type="date"
                  value={appointmentDate}
                  onChange={(e) => setAppointmentDate(e.target.value)}
                  className="input w-full"
                  placeholder="เลือกวันนัดหมาย"
                />
                {appointmentDate && (
                  <button
                    type="button"
                    onClick={() => {
                      setAppointmentDate('')
                      setAppointmentTime('')
                    }}
                    className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    ✕ ล้างวันนัดหมาย (เลือกช่างอย่างเดียว)
                  </button>
                )}
              </div>
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
