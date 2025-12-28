'use client'

import { useState, useEffect } from 'react'
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
  note: string | null
}

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [artists, setArtists] = useState<Staff[]>([])
  const [selectedArtist, setSelectedArtist] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [dayAppointments, setDayAppointments] = useState<Appointment[]>([])

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
  }, [currentDate, selectedArtist])

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

    let query = supabase
      .from('order_items')
      .select(`
        id,
        order_id,
        appointment_date,
        appointment_time,
        item_status,
        artist_id,
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

    if (selectedArtist) {
      query = query.eq('artist_id', parseInt(selectedArtist))
    }

    const { data } = await query

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
      note: item.order?.note || null,
    }))

    setAppointments(mapped)
    setLoading(false)
  }

  const getDaysInMonth = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDayOfMonth = new Date(year, month, 1)
    const lastDayOfMonth = new Date(year, month + 1, 0)
    const daysInMonth = lastDayOfMonth.getDate()
    const startingDay = firstDayOfMonth.getDay()

    const days: { date: number | null; dateStr: string }[] = []

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDay; i++) {
      days.push({ date: null, dateStr: '' })
    }

    // Add the days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      days.push({ date: day, dateStr })
    }

    return days
  }

  const getAppointmentsForDay = (dateStr: string) => {
    return appointments.filter(a => a.appointment_date === dateStr)
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

  const days = getDaysInMonth()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">{t('calendar.title')}</h1>
          <p className="text-gray-500 dark:text-gray-400">{t('calendar.subtitle')}</p>
        </div>

        {/* Artist Filter */}
        <div className="flex items-center gap-4">
          <select
            value={selectedArtist}
            onChange={(e) => setSelectedArtist(e.target.value)}
            className="select min-w-[200px]"
          >
            <option value="">{t('calendar.allArtists')}</option>
            {artists.map(artist => (
              <option key={artist.id} value={artist.id}>
                {artist.staff_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-2 card">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={prevMonth}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div className="flex items-center gap-4">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear() + (language === 'th' ? 543 : 0)}
              </h2>
              <button
                onClick={goToToday}
                className="px-3 py-1 text-sm bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors"
              >
                {t('calendar.today')}
              </button>
            </div>

            <button
              onClick={nextMonth}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Days Header */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {daysOfWeek.map((day, i) => (
              <div
                key={day}
                className={`text-center text-sm font-medium py-2 ${
                  i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <p className="text-gray-500 dark:text-gray-400">{t('common.loading')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {days.map((day, index) => {
                if (day.date === null) {
                  return <div key={`empty-${index}`} className="h-24 lg:h-28" />
                }

                const dayAppointments = getAppointmentsForDay(day.dateStr)
                const dayOfWeek = new Date(day.dateStr).getDay()
                const isSunday = dayOfWeek === 0
                const isSaturday = dayOfWeek === 6

                return (
                  <button
                    key={day.dateStr}
                    onClick={() => handleDayClick(day.dateStr)}
                    className={`h-24 lg:h-28 p-1 border rounded-lg transition-all text-left overflow-hidden
                      ${isToday(day.dateStr)
                        ? 'border-pink-500 bg-pink-50 dark:bg-pink-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-pink-300 dark:hover:border-pink-700'
                      }
                      ${selectedDay === day.dateStr ? 'ring-2 ring-pink-500' : ''}
                    `}
                  >
                    <div className={`text-sm font-medium mb-1 ${
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
                      {dayAppointments.slice(0, 3).map(apt => (
                        <div
                          key={apt.id}
                          className={`text-xs px-1 py-0.5 rounded truncate text-white ${getArtistColor(apt.artist_id)}`}
                        >
                          {apt.product_name}
                        </div>
                      ))}
                      {dayAppointments.length > 3 && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 px-1">
                          +{dayAppointments.length - 3} more
                        </div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Day Detail Panel */}
        <div className="card">
          <h3 className="font-bold text-gray-800 dark:text-white mb-4">
            {selectedDay ? (
              <>
                {t('calendar.appointments')} - {new Date(selectedDay).toLocaleDateString(language === 'th' ? 'th-TH' : 'en-US', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                })}
              </>
            ) : (
              t('calendar.appointments')
            )}
          </h3>

          {!selectedDay ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              {language === 'th' ? 'เลือกวันเพื่อดูรายละเอียด' : 'Select a day to view details'}
            </div>
          ) : dayAppointments.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              {t('calendar.noAppointments')}
            </div>
          ) : (
            <div className="space-y-3 max-h-[calc(100vh-350px)] overflow-y-auto">
              {dayAppointments.map(apt => (
                <div
                  key={apt.id}
                  className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl border-l-4"
                  style={{ borderLeftColor: apt.artist_id ? '' : '#9ca3af' }}
                >
                  <div className={`w-full h-1 rounded-full mb-2 ${getArtistColor(apt.artist_id)}`} />

                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="font-bold text-gray-800 dark:text-white">
                      {apt.product_name}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs text-white ${getStatusColor(apt.item_status)}`}>
                      {apt.item_status}
                    </span>
                  </div>

                  <div className="text-sm space-y-1 text-gray-600 dark:text-gray-300">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>{apt.appointment_time || '-'}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span>{apt.customer_name}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Artist: {apt.artist_name || '-'}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      <span>Order #{apt.order_id}</span>
                    </div>

                    {apt.note && (
                      <div className="flex items-start gap-2 mt-2 pt-2 border-t dark:border-gray-600">
                        <svg className="w-4 h-4 text-gray-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                        </svg>
                        <span className="text-xs">{apt.note}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="card">
        <h4 className="font-medium text-gray-800 dark:text-white mb-3">Artist Legend</h4>
        <div className="flex flex-wrap gap-3">
          {artists.map(artist => (
            <div key={artist.id} className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded ${getArtistColor(artist.id)}`} />
              <span className="text-sm text-gray-600 dark:text-gray-300">{artist.staff_name}</span>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-gray-400" />
            <span className="text-sm text-gray-600 dark:text-gray-300">No Artist</span>
          </div>
        </div>
      </div>
    </div>
  )
}
