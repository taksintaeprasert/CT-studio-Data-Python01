'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/user-context'
import PhotoUploadModal from '@/components/photo-upload-modal'

interface Appointment {
  id: number
  order_id: number
  appointment_date: string
  appointment_time: string | null
  item_status: 'pending' | 'scheduled' | 'completed' | 'cancelled'
  product: {
    product_name: string
    product_code: string
  }
  order: {
    id: number
    customers: {
      full_name: string
      phone: string | null
    } | null
  }
}

export default function ArtistHomePage() {
  const { user, loading: userLoading } = useUser()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(new Date())
  const [showPhotoModal, setShowPhotoModal] = useState(false)
  const [completingItem, setCompletingItem] = useState<Appointment | null>(null)
  const supabase = createClient()

  useEffect(() => {
    if (user?.id) {
      fetchAppointments()
    }
  }, [user?.id, selectedMonth])

  const fetchAppointments = async () => {
    if (!user?.id) return

    setLoading(true)

    // Get first and last day of selected month
    const firstDay = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1)
    const lastDay = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0)

    const formatDate = (d: Date) => {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }

    const { data } = await supabase
      .from('order_items')
      .select(`
        id,
        order_id,
        appointment_date,
        appointment_time,
        item_status,
        product:products(product_name, product_code),
        order:orders(id, customers(full_name, phone))
      `)
      .eq('artist_id', user.id)
      .gte('appointment_date', formatDate(firstDay))
      .lte('appointment_date', formatDate(lastDay))
      .order('appointment_date', { ascending: true })
      .order('appointment_time', { ascending: true })

    setAppointments(data || [])
    setLoading(false)
  }

  const getTodayDate = () => {
    const today = new Date()
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  }

  // Filter appointments for different views
  const todayStr = getTodayDate()
  const todayAppointments = appointments.filter(a => a.appointment_date === todayStr)
  const scheduledAppointments = appointments.filter(a => a.item_status === 'scheduled')
  const completedAppointments = appointments.filter(a => a.item_status === 'completed')

  // Handle complete button click
  const handleCompleteClick = (appointment: Appointment) => {
    setCompletingItem(appointment)
    setShowPhotoModal(true)
  }

  // Handle photo upload complete
  const handlePhotoUploadComplete = async () => {
    if (!completingItem) return

    // Update item status to completed
    await supabase
      .from('order_items')
      .update({ item_status: 'completed' })
      .eq('id', completingItem.id)

    setShowPhotoModal(false)
    setCompletingItem(null)
    fetchAppointments()
  }

  // Handle skip photo (complete without photo)
  const handleSkipPhoto = async () => {
    if (!completingItem) return

    await supabase
      .from('order_items')
      .update({ item_status: 'completed' })
      .eq('id', completingItem.id)

    setShowPhotoModal(false)
    setCompletingItem(null)
    fetchAppointments()
  }

  // Month navigation
  const prevMonth = () => {
    setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1, 1))
  }

  const nextMonth = () => {
    setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 1))
  }

  // Generate calendar days
  const generateCalendarDays = () => {
    const year = selectedMonth.getFullYear()
    const month = selectedMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startPadding = firstDay.getDay()
    const days: (number | null)[] = []

    // Add padding for days before month starts
    for (let i = 0; i < startPadding; i++) {
      days.push(null)
    }

    // Add days of month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(i)
    }

    return days
  }

  // Get appointments for a specific day
  const getAppointmentsForDay = (day: number) => {
    const dateStr = `${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return appointments.filter(a => a.appointment_date === dateStr)
  }

  // Check if user is artist
  if (userLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  if (!user || user.role !== 'artist') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="text-2xl font-bold text-red-500 mb-2">Access Denied</div>
        <div className="text-gray-500">หน้านี้สำหรับ Artist เท่านั้น</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Artist Home</h1>
        <p className="text-gray-500 dark:text-gray-400">สวัสดี {user.staffName} - ดูคิวและนัดหมายของคุณ</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">นัดวันนี้</p>
              <p className="text-3xl font-bold text-pink-500">{todayAppointments.length}</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center">
              <svg className="w-6 h-6 text-pink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">รอดำเนินการ (เดือนนี้)</p>
              <p className="text-3xl font-bold text-blue-500">{scheduledAppointments.length}</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">เสร็จแล้ว (เดือนนี้)</p>
              <p className="text-3xl font-bold text-green-500">{completedAppointments.length}</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Today's Queue */}
      <div className="card">
        <div className="p-4 border-b dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white">คิววันนี้ ({todayAppointments.length})</h2>
        </div>
        <div className="divide-y dark:divide-gray-700">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : todayAppointments.length === 0 ? (
            <div className="p-8 text-center text-gray-500">ไม่มีนัดหมายวันนี้</div>
          ) : (
            todayAppointments.map(apt => (
              <div key={apt.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-pink-500">
                      {apt.appointment_time?.slice(0, 5) || '--:--'}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-800 dark:text-white">
                      {apt.order?.customers?.full_name || '-'}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      <span className="text-pink-500 font-mono">[{apt.product?.product_code}]</span> {apt.product?.product_name}
                    </p>
                    {apt.order?.customers?.phone && (
                      <p className="text-xs text-gray-400">Tel: {apt.order.customers.phone}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {apt.item_status === 'completed' ? (
                    <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full text-sm font-medium">
                      เสร็จแล้ว
                    </span>
                  ) : (
                    <button
                      onClick={() => handleCompleteClick(apt)}
                      className="px-4 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors"
                    >
                      เสร็จสิ้น
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Monthly Calendar */}
      <div className="card">
        <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white">ปฏิทินเดือน</h2>
          <div className="flex items-center gap-4">
            <button
              onClick={prevMonth}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="font-medium text-gray-800 dark:text-white min-w-[150px] text-center">
              {selectedMonth.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}
            </span>
            <button
              onClick={nextMonth}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
        <div className="p-4">
          {/* Calendar Header */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map(day => (
              <div key={day} className="text-center text-sm font-medium text-gray-500 dark:text-gray-400 py-2">
                {day}
              </div>
            ))}
          </div>
          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-1">
            {generateCalendarDays().map((day, index) => {
              if (day === null) {
                return <div key={index} className="aspect-square" />
              }

              const dayAppointments = getAppointmentsForDay(day)
              const isToday = `${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` === todayStr
              const hasAppointments = dayAppointments.length > 0

              return (
                <div
                  key={index}
                  className={`aspect-square p-1 rounded-lg ${
                    isToday
                      ? 'bg-pink-500 text-white'
                      : hasAppointments
                      ? 'bg-blue-50 dark:bg-blue-900/20'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className="text-center">
                    <span className={`text-sm ${isToday ? 'font-bold' : ''}`}>{day}</span>
                  </div>
                  {hasAppointments && (
                    <div className="text-center">
                      <span className={`text-xs font-bold ${isToday ? 'text-white' : 'text-blue-500'}`}>
                        {dayAppointments.length} นัด
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* All Appointments This Month */}
      <div className="card">
        <div className="p-4 border-b dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white">นัดหมายทั้งหมดในเดือนนี้ ({appointments.length})</h2>
        </div>
        <div className="divide-y dark:divide-gray-700 max-h-96 overflow-y-auto">
          {appointments.length === 0 ? (
            <div className="p-8 text-center text-gray-500">ไม่มีนัดหมาย</div>
          ) : (
            appointments.map(apt => (
              <div key={apt.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-center min-w-[80px]">
                    <p className="text-sm font-medium text-gray-800 dark:text-white">
                      {new Date(apt.appointment_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                    </p>
                    <p className="text-xs text-gray-500">
                      {apt.appointment_time?.slice(0, 5) || '--:--'}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-800 dark:text-white">
                      {apt.order?.customers?.full_name || '-'}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      <span className="text-pink-500 font-mono">[{apt.product?.product_code}]</span> {apt.product?.product_name}
                    </p>
                  </div>
                </div>
                <div>
                  {apt.item_status === 'completed' ? (
                    <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full text-sm font-medium">
                      เสร็จแล้ว
                    </span>
                  ) : apt.item_status === 'scheduled' ? (
                    <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full text-sm font-medium">
                      รอดำเนินการ
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full text-sm font-medium">
                      {apt.item_status}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Photo Upload Modal */}
      {showPhotoModal && completingItem && (
        <PhotoUploadModal
          orderItemId={completingItem.id}
          customerName={completingItem.order?.customers?.full_name || '-'}
          productName={completingItem.product?.product_name || '-'}
          onClose={() => {
            setShowPhotoModal(false)
            setCompletingItem(null)
          }}
          onComplete={handlePhotoUploadComplete}
          onSkip={handleSkipPhoto}
        />
      )}
    </div>
  )
}
