'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/user-context'
import { useRouter } from 'next/navigation'
import type { ArtistNotification } from '@/lib/supabase/types'

interface PerformanceMetrics {
  totalCustomers: number
  completedServices: number
  totalBookingAmount: number
  totalCommission: number
  periodMonth: string
}

interface Notification extends ArtistNotification {
  order_item?: {
    booking_title: string | null
  } | null
}

export default function ArtistHomePage() {
  const { user, loading: userLoading } = useUser()
  const router = useRouter()
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    totalCustomers: 0,
    completedServices: 0,
    totalBookingAmount: 0,
    totalCommission: 0,
    periodMonth: ''
  })
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    if (user?.id) {
      fetchPerformanceMetrics()
      fetchNotifications()
    }
  }, [user?.id])

  // Calculate current month dates (1st to last day of current month)
  const getPeriodDates = () => {
    const today = new Date()
    const year = today.getFullYear()
    const month = today.getMonth()

    // First day of current month
    const firstDay = new Date(year, month, 1)

    // Last day of current month
    const lastDay = new Date(year, month + 1, 0)

    const formatDate = (d: Date) => {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }

    return {
      startDate: formatDate(firstDay),
      endDate: formatDate(lastDay),
      displayMonth: today.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })
    }
  }

  const fetchPerformanceMetrics = async () => {
    if (!user?.id) return

    setLoading(true)
    const { startDate, endDate, displayMonth } = getPeriodDates()

    try {
      // Get commission settings for this artist
      const { data: commissionData } = await supabase
        .from('commission_settings')
        .select('commission_normal_percent, commission_50_percent')
        .eq('artist_id', user.id)
        .single()

      const commissionNormal = commissionData?.commission_normal_percent || 0
      const commission50 = commissionData?.commission_50_percent || 0

      // Get all order_items for this artist where order_date is in current month
      const { data: orderItems } = await supabase
        .from('order_items')
        .select(`
          id,
          order_id,
          item_price,
          artist_completed_at,
          sales_completed_at,
          orders!inner(order_date),
          product:products(validity_months)
        `)
        .eq('artist_id', user.id)
        .gte('orders.order_date', startDate)
        .lte('orders.order_date', endDate)

      if (!orderItems) {
        setLoading(false)
        return
      }

      // Count unique orders (customers)
      const uniqueOrders = new Set(orderItems.map(item => item.order_id))
      const totalCustomers = uniqueOrders.size

      // Count completed services (both artist AND sales marked complete)
      const completedServices = orderItems.filter(item =>
        item.artist_completed_at && item.sales_completed_at
      ).length

      // Calculate total booking amount
      const totalBookingAmount = orderItems.reduce((sum, item) => sum + (item.item_price || 0), 0)

      // Calculate commission from completed services only
      const completedItems = orderItems.filter(item =>
        item.artist_completed_at && item.sales_completed_at
      )

      let totalCommission = 0
      completedItems.forEach(item => {
        const itemPrice = item.item_price || 0
        const validityMonths = item.product?.validity_months || 0

        // Check if it's a 50% service (validity_months = 12)
        if (validityMonths === 12) {
          totalCommission += itemPrice * (commission50 / 100)
        } else {
          // Normal service (including FREE services)
          totalCommission += itemPrice * (commissionNormal / 100)
        }
      })

      setMetrics({
        totalCustomers,
        completedServices,
        totalBookingAmount,
        totalCommission: Math.round(totalCommission), // Round to nearest baht
        periodMonth: displayMonth
      })
    } catch (error) {
      console.error('Error fetching performance metrics:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchNotifications = async () => {
    if (!user?.id) return

    try {
      const { data } = await supabase
        .from('artist_notifications')
        .select(`
          *,
          order_item:order_items(booking_title)
        `)
        .eq('artist_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10)

      setNotifications(data || [])
    } catch (error) {
      console.error('Error fetching notifications:', error)
    }
  }

  const markNotificationAsRead = async (notificationId: number) => {
    try {
      await supabase
        .from('artist_notifications')
        .update({ is_read: true })
        .eq('id', notificationId)

      // Update local state
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      )
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'new_queue':
        return '🔔'
      case 'schedule_change':
        return '📅'
      default:
        return '📢'
    }
  }

  const formatNotificationTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'เมื่อสักครู่'
    if (diffMins < 60) return `${diffMins} นาทีที่แล้ว`
    if (diffHours < 24) return `${diffHours} ชั่วโมงที่แล้ว`
    if (diffDays < 7) return `${diffDays} วันที่แล้ว`

    return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
  }

  // Check if user is artist
  if (userLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">กำลังโหลด...</div>
      </div>
    )
  }

  if (!user || user.role !== 'artist') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="text-2xl font-bold text-red-500 mb-2">ไม่มีสิทธิ์เข้าถึง</div>
        <div className="text-gray-500">หน้านี้สำหรับ Artist เท่านั้น</div>
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-6 max-w-2xl mx-auto px-4">
      {/* Header - Mobile Optimized */}
      <div className="pt-4">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Artist Home</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">สวัสดี {user.staffName}</p>
      </div>

      {/* Performance Period Banner */}
      <div className="card p-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white">
        <div className="text-center">
          <p className="text-sm opacity-90">ผลงานของคุณ</p>
          <p className="text-2xl font-bold">{metrics.periodMonth}</p>
          <p className="text-xs opacity-75 mt-1">
            (คำนวณจาก Booking ในเดือนนี้)
          </p>
        </div>
      </div>

      {/* Performance Metrics - Mobile Cards */}
      <div className="grid grid-cols-1 gap-4">
        {/* Total Customers */}
        <div className="card p-5 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-2 border-blue-200 dark:border-blue-700">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-1">
                จำนวนลูกค้า
              </p>
              <p className="text-4xl font-bold text-blue-700 dark:text-blue-300">
                {loading ? '...' : metrics.totalCustomers}
              </p>
              <p className="text-xs text-blue-500 dark:text-blue-400 mt-1">
                orders ทั้งหมด
              </p>
            </div>
            <div className="w-16 h-16 rounded-full bg-blue-200 dark:bg-blue-700 flex items-center justify-center">
              <svg className="w-8 h-8 text-blue-600 dark:text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Completed Services */}
        <div className="card p-5 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-2 border-green-200 dark:border-green-700">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-green-600 dark:text-green-400 mb-1">
                ทำเสร็จแล้ว
              </p>
              <p className="text-4xl font-bold text-green-700 dark:text-green-300">
                {loading ? '...' : metrics.completedServices}
              </p>
              <p className="text-xs text-green-500 dark:text-green-400 mt-1">
                บริการที่ยืนยันแล้วทั้ง 2 ฝ่าย
              </p>
            </div>
            <div className="w-16 h-16 rounded-full bg-green-200 dark:bg-green-700 flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600 dark:text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Total Booking Amount */}
        <div className="card p-5 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-2 border-purple-200 dark:border-purple-700">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-purple-600 dark:text-purple-400 mb-1">
                มูลค่า Booking
              </p>
              <p className="text-4xl font-bold text-purple-700 dark:text-purple-300">
                {loading ? '...' : metrics.totalBookingAmount.toLocaleString()}
              </p>
              <p className="text-xs text-purple-500 dark:text-purple-400 mt-1">
                บาท
              </p>
            </div>
            <div className="w-16 h-16 rounded-full bg-purple-200 dark:bg-purple-700 flex items-center justify-center">
              <svg className="w-8 h-8 text-purple-600 dark:text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Total Commission */}
        <div className="card p-5 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border-2 border-orange-200 dark:border-orange-700">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-orange-600 dark:text-orange-400 mb-1">
                ค่าคอมมิชชั่น
              </p>
              <p className="text-4xl font-bold text-orange-700 dark:text-orange-300">
                {loading ? '...' : metrics.totalCommission.toLocaleString()}
              </p>
              <p className="text-xs text-orange-500 dark:text-orange-400 mt-1">
                บาท (จากบริการที่เสร็จแล้ว)
              </p>
            </div>
            <div className="w-16 h-16 rounded-full bg-orange-200 dark:bg-orange-700 flex items-center justify-center">
              <svg className="w-8 h-8 text-orange-600 dark:text-orange-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Notifications Section */}
      <div className="card">
        <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-gray-800 dark:text-white">การแจ้งเตือน</h2>
            {notifications.filter(n => !n.is_read).length > 0 && (
              <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
                {notifications.filter(n => !n.is_read).length}
              </span>
            )}
          </div>
          <button
            onClick={() => router.push('/calendar')}
            className="text-sm text-pink-500 hover:text-pink-600 font-medium"
          >
            ดูปฏิทิน →
          </button>
        </div>

        <div className="divide-y dark:divide-gray-700 max-h-[500px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p className="text-gray-400">ไม่มีการแจ้งเตือน</p>
            </div>
          ) : (
            notifications.map(notif => (
              <div
                key={notif.id}
                onClick={() => !notif.is_read && markNotificationAsRead(notif.id)}
                className={`p-4 transition-colors cursor-pointer ${
                  notif.is_read
                    ? 'bg-white dark:bg-gray-900'
                    : 'bg-pink-50 dark:bg-pink-900/10 hover:bg-pink-100 dark:hover:bg-pink-900/20'
                }`}
              >
                <div className="flex gap-3">
                  <div className="text-2xl flex-shrink-0">
                    {getNotificationIcon(notif.notification_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${
                      notif.is_read
                        ? 'text-gray-700 dark:text-gray-300'
                        : 'text-gray-900 dark:text-white font-medium'
                    }`}>
                      {notif.message}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {formatNotificationTime(notif.created_at)}
                    </p>
                  </div>
                  {!notif.is_read && (
                    <div className="w-2 h-2 bg-pink-500 rounded-full flex-shrink-0 mt-2"></div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Quick Actions - Mobile Optimized */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => router.push('/calendar')}
          className="card p-4 hover:shadow-lg transition-shadow text-center bg-gradient-to-br from-pink-500 to-pink-600 text-white"
        >
          <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-white/20 flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="font-medium text-sm">ปฏิทินนัดหมาย</p>
        </button>

        <button
          onClick={() => router.push('/service')}
          className="card p-4 hover:shadow-lg transition-shadow text-center bg-gradient-to-br from-blue-500 to-blue-600 text-white"
        >
          <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-white/20 flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p className="font-medium text-sm">รายการบริการ</p>
        </button>
      </div>
    </div>
  )
}
