'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/language-context'

interface Staff {
  id: number
  staff_name: string
}

interface Appointment {
  id: number
  order_id: number
  product_name: string
  product_code: string
  appointment_date: string
  appointment_time: string | null
  item_status: string
  artist_id: number | null
  artist_name: string | null
  customer_name: string
  booking_title: string | null
  note: string | null
}

export default function CalendarPage() {
  const router = useRouter()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [artists, setArtists] = useState<Staff[]>([])
  const [selectedArtistIds, setSelectedArtistIds] = useState<Set<number>>(new Set())
  const [showNoArtist, setShowNoArtist] = useState(true)
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [dayAppointments, setDayAppointments] = useState<Appointment[]>([])
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)

  const { t, language } = useLanguage()
  const supabase = createClient()

  const daysOfWeek = language === 'th'
    ? ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const monthNames = language === 'th'
    ? ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
    : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

  useEffect(() => {
    fetchArtists()
  }, [])

  useEffect(() => {
    fetchAppointments()
  }, [currentDate])

  // Initialize all artists as selected when artists are loaded
  useEffect(() => {
    if (artists.length > 0 && selectedArtistIds.size === 0) {
      setSelectedArtistIds(new Set(artists.map(a => a.id)))
    }
  }, [artists])

  const fetchArtists = async () => {
    const { data } = await supabase
      .from('staff')
      .select('id, staff_name')
      .eq('role', 'artist')
      .eq('is_active', true)
      .order('staff_name')

    setArtists(data || [])
  }

  const fetchAppointments = async () => {
    setLoading(true)

    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1).toISOString().split('T')[0]
    const lastDay = new Date(year, month + 1, 0).toISOString().split('T')[0]

    const { data } = await supabase
      .from('order_items')
      .select(`
        id,
        order_id,
        appointment_date,
        appointment_time,
        item_status,
        artist_id,
        booking_title,
        artist:staff!order_items_artist_id_fkey(staff_name),
        product:products(product_name, product_code),
        order:orders(
          note,
          customers(full_name)
        )
      `)
      .not('appointment_date', 'is', null)
      .gte('appointment_date', firstDay)
      .lte('appointment_date', lastDay)
      .neq('item_status', 'cancelled')

    const mapped: Appointment[] = (data || []).map((item: any) => ({
      id: item.id,
      order_id: item.order_id,
      product_name: item.product?.product_name || 'Unknown',
      product_code: item.product?.product_code || '',
      appointment_date: item.appointment_date,
      appointment_time: item.appointment_time,
      item_status: item.item_status,
      artist_id: item.artist_id,
      artist_name: item.artist?.staff_name || null,
      customer_name: item.order?.customers?.full_name || 'Unknown',
      booking_title: item.booking_title || null,
      note: item.order?.note || null,
    }))

    setAppointments(mapped)
    setLoading(false)
  }

  const toggleArtist = (artistId: number) => {
    const newSet = new Set(selectedArtistIds)
    if (newSet.has(artistId)) {
      newSet.delete(artistId)
    } else {
      newSet.add(artistId)
    }
    setSelectedArtistIds(newSet)
  }

  const selectAllArtists = () => {
    setSelectedArtistIds(new Set(artists.map(a => a.id)))
    setShowNoArtist(true)
  }

  const deselectAllArtists = () => {
    setSelectedArtistIds(new Set())
    setShowNoArtist(false)
  }

  // Filter appointments based on selected artists
  const filterAppointments = (appts: Appointment[]) => {
    return appts.filter(apt => {
      if (apt.artist_id === null) {
        return showNoArtist
      }
      return selectedArtistIds.has(apt.artist_id)
    })
  }

  // Sort appointments by time (earliest first)
  const sortByTime = (appts: Appointment[]) => {
    return [...appts].sort((a, b) => {
      const timeA = a.appointment_time || '99:99:99'
      const timeB = b.appointment_time || '99:99:99'
      return timeA.localeCompare(timeB)
    })
  }

  const getDaysInMonth = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDayOfMonth = new Date(year, month, 1)
    const lastDayOfMonth = new Date(year, month + 1, 0)
    const daysInMonth = lastDayOfMonth.getDate()
    const startingDay = firstDayOfMonth.getDay()

    const days: { date: number | null; dateStr: string }[] = []

    for (let i = 0; i < startingDay; i++) {
      days.push({ date: null, dateStr: '' })
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      days.push({ date: day, dateStr })
    }

    return days
  }

  const getAppointmentsForDay = (dateStr: string) => {
    const dayAppts = appointments.filter(a => a.appointment_date === dateStr)
    return sortByTime(filterAppointments(dayAppts))
  }

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
    setSelectedDay(null)
  }

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
    setSelectedDay(null)
  }

  const goToToday = () => {
    setCurrentDate(new Date())
    setSelectedDay(null)
  }

  const handleDayClick = (dateStr: string) => {
    setSelectedDay(dateStr)
    setDayAppointments(getAppointmentsForDay(dateStr))
  }

  // Update day appointments when filter changes
  useEffect(() => {
    if (selectedDay) {
      setDayAppointments(getAppointmentsForDay(selectedDay))
    }
  }, [selectedArtistIds, showNoArtist, appointments])

  const isToday = (dateStr: string) => {
    const today = new Date().toISOString().split('T')[0]
    return dateStr === today
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'bg-blue-500'
      case 'completed':
        return 'bg-green-500'
      case 'pending':
        return 'bg-yellow-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getArtistColor = (artistId: number | null) => {
    if (!artistId) return 'bg-gray-400'
    const colors = [
      'bg-pink-500',
      'bg-purple-500',
      'bg-indigo-500',
      'bg-blue-500',
      'bg-teal-500',
      'bg-green-500',
      'bg-orange-500',
      'bg-red-500',
    ]
    return colors[artistId % colors.length]
  }

  const getArtistBorderColor = (artistId: number | null) => {
    if (!artistId) return 'border-gray-400'
    const colors = [
      'border-pink-500',
      'border-purple-500',
      'border-indigo-500',
      'border-blue-500',
      'border-teal-500',
      'border-green-500',
      'border-orange-500',
      'border-red-500',
    ]
    return colors[artistId % colors.length]
  }

  const formatTime = (time: string | null) => {
    if (!time) return '--:--'
    return time.substring(0, 5)
  }

  const handleOpenChat = (apt: Appointment) => {
    router.push(`/booking/${apt.id}`)
  }

  const days = getDaysInMonth()
  const selectedCount = selectedArtistIds.size + (showNoArtist ? 1 : 0)
  const totalCount = artists.length + 1

  return (
    <div className="space-y-4 pb-6 px-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="pt-4 flex flex-col gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">{t('calendar.title')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('calendar.subtitle')}</p>
        </div>

        {/* Artist Filter - Checkbox Style - Mobile Optimized */}
        <div className="relative w-full">
          <button
            onClick={() => setShowFilterDropdown(!showFilterDropdown)}
            className="w-full flex items-center gap-2 px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-98 transition-all shadow-sm"
          >
            <svg className="w-5 h-5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <span className="font-semibold text-gray-700 dark:text-gray-200 flex-1 text-left">
              {language === 'th' ? 'กรอง Artist' : 'Filter Artists'}
            </span>
            <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-pink-100 dark:bg-pink-900 text-pink-600 dark:text-pink-300">
              {selectedCount}/{totalCount}
            </span>
            <svg className={`w-5 h-5 text-gray-500 transition-transform flex-shrink-0 ${showFilterDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Dropdown */}
          {showFilterDropdown && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowFilterDropdown(false)} />
              <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">
                {/* Select All / Deselect All */}
                <div className="p-3 border-b dark:border-gray-700 flex gap-2">
                  <button
                    onClick={selectAllArtists}
                    className="flex-1 px-3 py-1.5 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    {language === 'th' ? 'เลือกทั้งหมด' : 'Select All'}
                  </button>
                  <button
                    onClick={deselectAllArtists}
                    className="flex-1 px-3 py-1.5 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    {language === 'th' ? 'ยกเลิกทั้งหมด' : 'Deselect All'}
                  </button>
                </div>

                {/* Artist Checkboxes */}
                <div className="max-h-64 overflow-y-auto p-2">
                  {artists.map(artist => (
                    <label
                      key={artist.id}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <input
                        type="checkbox"
                        checked={selectedArtistIds.has(artist.id)}
                        onChange={() => toggleArtist(artist.id)}
                        className="w-4 h-4 text-pink-500 rounded border-gray-300 focus:ring-pink-500"
                      />
                      <div className={`w-3 h-3 rounded-full ${getArtistColor(artist.id)}`} />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{artist.staff_name}</span>
                    </label>
                  ))}
                  {/* No Artist option */}
                  <label className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 border-t dark:border-gray-700 mt-1 pt-3">
                    <input
                      type="checkbox"
                      checked={showNoArtist}
                      onChange={() => setShowNoArtist(!showNoArtist)}
                      className="w-4 h-4 text-pink-500 rounded border-gray-300 focus:ring-pink-500"
                    />
                    <div className="w-3 h-3 rounded-full bg-gray-400" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {language === 'th' ? 'ไม่มี Artist' : 'No Artist'}
                    </span>
                  </label>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {/* Calendar Grid */}
        <div className="card p-4">
          {/* Month Navigation - Mobile Optimized */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={prevMonth}
              className="p-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 active:scale-95 transition-all"
            >
              <svg className="w-6 h-6 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div className="flex flex-col items-center gap-1">
              <h2 className="text-lg font-bold text-gray-800 dark:text-white">
                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear() + (language === 'th' ? 543 : 0)}
              </h2>
              <button
                onClick={goToToday}
                className="px-3 py-1 text-xs bg-pink-500 text-white rounded-lg hover:bg-pink-600 active:scale-95 transition-all"
              >
                {t('calendar.today')}
              </button>
            </div>

            <button
              onClick={nextMonth}
              className="p-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 active:scale-95 transition-all"
            >
              <svg className="w-6 h-6 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Days Header */}
          <div className="grid grid-cols-7 gap-0.5 mb-2">
            {daysOfWeek.map((day, i) => (
              <div
                key={day}
                className={`text-center text-xs font-semibold py-2 ${
                  i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-pink-500 border-t-transparent mb-3"></div>
              <p className="text-gray-500 dark:text-gray-400">{t('common.loading')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-0.5">
              {days.map((day, index) => {
                if (day.date === null) {
                  return <div key={`empty-${index}`} className="h-20 sm:h-24" />
                }

                const filteredDayAppts = getAppointmentsForDay(day.dateStr)
                const dayOfWeek = new Date(day.dateStr).getDay()
                const isSunday = dayOfWeek === 0
                const isSaturday = dayOfWeek === 6

                return (
                  <button
                    key={day.dateStr}
                    onClick={() => handleDayClick(day.dateStr)}
                    className={`h-20 sm:h-24 p-1 border rounded-lg transition-all text-left overflow-hidden active:scale-95
                      ${isToday(day.dateStr)
                        ? 'border-pink-500 bg-pink-50 dark:bg-pink-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-pink-300 dark:hover:border-pink-700'
                      }
                      ${selectedDay === day.dateStr ? 'ring-2 ring-pink-500' : ''}
                    `}
                  >
                    <div className={`text-xs font-bold mb-0.5 ${
                      isToday(day.dateStr)
                        ? 'text-pink-600 dark:text-pink-400'
                        : isSunday
                          ? 'text-red-500'
                          : isSaturday
                            ? 'text-blue-500'
                            : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      {day.date}
                    </div>

                    {/* Appointments preview */}
                    <div className="space-y-0.5 overflow-hidden">
                      {filteredDayAppts.slice(0, 2).map(apt => (
                        <div
                          key={apt.id}
                          className={`text-[10px] px-0.5 py-0.5 rounded truncate text-white ${getArtistColor(apt.artist_id)}`}
                        >
                          {apt.product_name}
                        </div>
                      ))}
                      {filteredDayAppts.length > 2 && (
                        <div className="text-[9px] text-gray-500 dark:text-gray-400 px-0.5 font-medium">
                          +{filteredDayAppts.length - 2}
                        </div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Day Detail Panel - Mobile Optimized */}
        <div className="card p-4">
          <h3 className="font-bold text-gray-800 dark:text-white mb-3 pb-3 border-b dark:border-gray-700 text-base">
            {selectedDay ? (
              <>
                {t('calendar.appointments')} - {new Date(selectedDay).toLocaleDateString(language === 'th' ? 'th-TH' : 'en-US', {
                  day: 'numeric',
                  month: 'short'
                })}
              </>
            ) : (
              t('calendar.appointments')
            )}
          </h3>

          {!selectedDay ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <svg className="w-16 h-16 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm">{language === 'th' ? 'เลือกวันเพื่อดูรายละเอียด' : 'Select a day to view details'}</p>
            </div>
          ) : dayAppointments.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <svg className="w-16 h-16 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm">{t('calendar.noAppointments')}</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {dayAppointments.map(apt => (
                <div
                  key={apt.id}
                  className={`rounded-xl overflow-hidden border-2 ${getArtistBorderColor(apt.artist_id)} bg-white dark:bg-gray-800 shadow-md`}
                >
                  {/* Header - Product + Time + Artist - Mobile Optimized */}
                  <div className={`px-3 py-3 ${getArtistColor(apt.artist_id)} text-white`}>
                    <div className="space-y-2">
                      {/* Product Name */}
                      <h4 className="font-bold text-base">{apt.product_name}</h4>

                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Time Badge */}
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {formatTime(apt.appointment_time)}
                        </span>

                        {/* Artist Badge */}
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-white/25">
                          {apt.artist_name || 'No Artist'}
                        </span>

                        {/* Status Badge */}
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                          apt.item_status === 'completed' ? 'bg-green-400/30' : 'bg-black/20'
                        }`}>
                          {apt.item_status}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Body - Customer & Order Details - Mobile Optimized */}
                  <div className="px-3 py-2.5 space-y-2">
                    <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300 text-sm">
                      <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span className="font-medium truncate">{apt.customer_name}</span>
                    </div>

                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs">
                      <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      <span>Order #{apt.order_id}</span>
                    </div>

                    {apt.note && (
                      <div className="pt-2 mt-2 border-t dark:border-gray-700">
                        <div className="flex items-start gap-2 text-gray-500 dark:text-gray-400 text-xs">
                          <svg className="w-3 h-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                          </svg>
                          <span className="break-words">{apt.note}</span>
                        </div>
                      </div>
                    )}

                    {/* Chat Button - Mobile Optimized */}
                    <div className="pt-2 mt-2 border-t dark:border-gray-700">
                      <button
                        onClick={() => handleOpenChat(apt)}
                        className="w-full px-3 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 active:scale-95 text-white rounded-lg font-medium transition-all shadow-md text-sm flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        💬 เปิดแชท
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Legend - Mobile Optimized */}
      <div className="card p-4">
        <h4 className="font-semibold text-gray-800 dark:text-white mb-3 text-sm">Artist Legend</h4>
        <div className="flex flex-wrap gap-2">
          {artists.map(artist => (
            <div key={artist.id} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className={`w-3 h-3 rounded ${getArtistColor(artist.id)}`} />
              <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">{artist.staff_name}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="w-3 h-3 rounded bg-gray-400" />
            <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">No Artist</span>
          </div>
        </div>
      </div>
    </div>
  )
}
