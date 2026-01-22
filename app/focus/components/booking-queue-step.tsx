'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/user-context'
import BookingModal from './booking-modal'

interface BookingQueueStepProps {
  orderId: number
  onComplete: () => void
}

interface OrderItem {
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
  artists: {
    id: number
    staff_name: string
  } | null
}

interface Customer {
  id: number
  full_name: string
  phone: string | null
}

export default function BookingQueueStep({ orderId, onComplete }: BookingQueueStepProps) {
  const supabase = createClient()
  const { user } = useUser()

  const [loading, setLoading] = useState(true)
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [selectedItem, setSelectedItem] = useState<OrderItem | null>(null)
  const [showBookingModal, setShowBookingModal] = useState(false)

  useEffect(() => {
    loadOrderItems()
  }, [orderId])

  const loadOrderItems = async () => {
    setLoading(true)

    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select(`
        id,
        product_id,
        item_price,
        appointment_date,
        artist_id,
        products (product_code, product_name, list_price),
        artists:staff!order_items_artist_id_fkey (id, staff_name)
      `)
      .eq('order_id', orderId)

    if (itemsError) {
      console.error('Error loading order items:', itemsError)
      alert('ไม่สามารถโหลดข้อมูลบริการได้')
      return
    }

    const { data: order } = await supabase
      .from('orders')
      .select('customers (id, full_name, phone)')
      .eq('id', orderId)
      .single()

    if (order?.customers) {
      setCustomer(order.customers as Customer)
    }

    setOrderItems(items || [])
    setLoading(false)
  }

  const handleBookService = (item: OrderItem) => {
    setSelectedItem(item)
    setShowBookingModal(true)
  }

  const handleBookingComplete = () => {
    setShowBookingModal(false)
    setSelectedItem(null)
    loadOrderItems()
  }

  const handleSkipAll = () => {
    if (confirm('ต้องการข้ามการลงคิวทั้งหมดใช่หรือไม่?')) {
      onComplete()
    }
  }

  const allBooked = orderItems.every(item => item.appointment_date !== null && item.artist_id !== null)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500 dark:text-gray-400">กำลังโหลดข้อมูลบริการ...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="card p-6 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-gray-800 dark:to-gray-700 border-2 border-purple-200 dark:border-purple-800">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
          📅 ลงคิวช่างสำหรับลูกค้า
        </h2>
        {customer && (
          <p className="text-gray-600 dark:text-gray-300">
            <span className="font-medium">ลูกค้า:</span> {customer.full_name}
            {customer.phone && <span className="text-gray-500 ml-2">({customer.phone})</span>}
          </p>
        )}
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          กรุณาเลือกวันเวลาและช่างสำหรับแต่ละบริการ
        </p>
      </div>

      <div className="space-y-4">
        {orderItems.map((item) => {
          const isBooked = item.appointment_date !== null && item.artist_id !== null
          return (
            <div key={item.id} className={`card p-6 border-2 transition-all ${isBooked ? 'border-green-400 dark:border-green-600 bg-green-50 dark:bg-green-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600'}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs font-mono text-pink-500 bg-pink-100 dark:bg-pink-900/30 px-2 py-1 rounded">{item.products?.product_code}</span>
                    {isBooked && <span className="text-xs font-medium text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded">✓ จองแล้ว</span>}
                  </div>
                  <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2">{item.products?.product_name}</h3>
                  <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
                    <div><span className="font-medium">ราคา:</span> ฿{item.item_price.toLocaleString()}</div>
                    {isBooked && (
                      <>
                        <div><span className="font-medium">วันนัด:</span> {new Date(item.appointment_date!).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                        <div><span className="font-medium">ช่าง:</span> {item.artists?.staff_name || '-'}</div>
                      </>
                    )}
                  </div>
                </div>
                <button onClick={() => handleBookService(item)} className={`px-6 py-3 rounded-lg font-medium transition-all ${isBooked ? 'bg-blue-500 hover:bg-blue-600 text-white' : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg hover:shadow-xl'}`}>
                  {isBooked ? '📝 แก้ไข' : '📅 ลงคิวช่าง'}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex gap-4">
        <button onClick={handleSkipAll} className="btn-secondary flex-1 py-4 text-lg">ข้ามขั้นตอนนี้</button>
        {allBooked && <button onClick={onComplete} className="btn-primary flex-1 py-4 text-lg">✅ ดำเนินการต่อ ({orderItems.length} บริการจองครบแล้ว)</button>}
      </div>

      {showBookingModal && selectedItem && customer && (
        <BookingModal orderItem={selectedItem} customer={customer} onClose={() => setShowBookingModal(false)} onComplete={handleBookingComplete} />
      )}
    </div>
  )
}
