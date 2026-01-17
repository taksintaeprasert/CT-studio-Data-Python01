'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface ServiceHistory {
  id: number
  order_id: number
  appointment_date: string | null
  appointment_time: string | null
  item_status: string
  created_at: string
  product: {
    product_name: string
    product_code: string
  }
  artist: {
    staff_name: string
  } | null
  photos: {
    id: number
    photo_url: string
    note: string | null
    created_at: string
  }[]
}

interface CustomerHistoryModalProps {
  customerId: number
  customerName: string
  onClose: () => void
}

export default function CustomerHistoryModal({
  customerId,
  customerName,
  onClose,
}: CustomerHistoryModalProps) {
  const [services, setServices] = useState<ServiceHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchHistory()
  }, [customerId])

  const fetchHistory = async () => {
    setLoading(true)

    // Get all orders for this customer
    const { data: orders } = await supabase
      .from('orders')
      .select('id')
      .eq('customer_id', customerId)

    if (!orders || orders.length === 0) {
      setServices([])
      setLoading(false)
      return
    }

    const orderIds = orders.map(o => o.id)

    // Get all order items with photos
    const { data: items } = await supabase
      .from('order_items')
      .select(`
        id,
        order_id,
        appointment_date,
        appointment_time,
        item_status,
        created_at,
        product:products(product_name, product_code),
        artist:staff!order_items_artist_id_fkey(staff_name),
        photos:service_photos(id, photo_url, note, created_at)
      `)
      .in('order_id', orderIds)
      .order('created_at', { ascending: false })

    setServices(items || [])
    setLoading(false)
  }

  const downloadPhoto = async (url: string, filename: string) => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(blobUrl)
    } catch (error) {
      console.error('Download error:', error)
      alert('ไม่สามารถดาวน์โหลดรูปได้')
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return { label: 'รอดำเนินการ', color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' }
      case 'scheduled':
        return { label: 'นัดหมายแล้ว', color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' }
      case 'completed':
        return { label: 'เสร็จสิ้น', color: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' }
      case 'cancelled':
        return { label: 'ยกเลิก', color: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' }
      default:
        return { label: status, color: 'bg-gray-100 text-gray-600' }
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="p-6 border-b dark:border-gray-700 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">ประวัติบริการ</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">{customerName}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="text-center py-12 text-gray-500">Loading...</div>
            ) : services.length === 0 ? (
              <div className="text-center py-12 text-gray-500">ไม่พบประวัติบริการ</div>
            ) : (
              <div className="space-y-6">
                {services.map(service => {
                  const status = getStatusLabel(service.item_status)
                  return (
                    <div key={service.id} className="card p-4">
                      {/* Service Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-medium text-gray-800 dark:text-white">
                            <span className="text-pink-500 font-mono text-sm">[{service.product?.product_code}]</span>{' '}
                            {service.product?.product_name}
                          </p>
                          <div className="flex flex-wrap gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
                            <span>Order #{service.order_id}</span>
                            {service.appointment_date && (
                              <span>
                                | นัด: {new Date(service.appointment_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                                {service.appointment_time && ` ${service.appointment_time.slice(0, 5)}`}
                              </span>
                            )}
                            {service.artist && (
                              <span>| ช่าง: {service.artist.staff_name}</span>
                            )}
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${status.color}`}>
                          {status.label}
                        </span>
                      </div>

                      {/* Photos */}
                      {service.photos && service.photos.length > 0 && (
                        <div className="mt-4">
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            รูปภาพ ({service.photos.length})
                          </p>
                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                            {service.photos.map(photo => (
                              <div key={photo.id} className="relative group">
                                <img
                                  src={photo.photo_url}
                                  alt="Service photo"
                                  className="w-full aspect-square object-cover rounded-lg cursor-pointer hover:opacity-90"
                                  onClick={() => setSelectedPhoto(photo.photo_url)}
                                />
                                <button
                                  onClick={() => downloadPhoto(photo.photo_url, `service_${service.id}_${photo.id}.jpg`)}
                                  className="absolute bottom-1 right-1 p-1.5 bg-black/50 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="ดาวน์โหลด"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                  </svg>
                                </button>
                              </div>
                            ))}
                          </div>
                          {service.photos[0]?.note && (
                            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 italic">
                              หมายเหตุ: {service.photos[0].note}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t dark:border-gray-700">
            <button
              onClick={onClose}
              className="w-full py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              ปิด
            </button>
          </div>
        </div>
      </div>

      {/* Full Screen Photo Viewer */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <button
            onClick={() => setSelectedPhoto(null)}
            className="absolute top-4 right-4 p-2 text-white hover:bg-white/20 rounded-lg"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src={selectedPhoto}
            alt="Full size"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={(e) => {
              e.stopPropagation()
              downloadPhoto(selectedPhoto, `photo_${Date.now()}.jpg`)
            }}
            className="absolute bottom-4 right-4 px-4 py-2 bg-white text-gray-800 rounded-lg font-medium hover:bg-gray-100 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            ดาวน์โหลด
          </button>
        </div>
      )}
    </>
  )
}
