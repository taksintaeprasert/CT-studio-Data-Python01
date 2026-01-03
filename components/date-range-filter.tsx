'use client'

import { useState, useEffect } from 'react'

interface DateRangeFilterProps {
  onDateChange: (startDate: string, endDate: string) => void
  onShowAll?: () => void
  showQuickOptions?: boolean
  className?: string
}

export default function DateRangeFilter({
  onDateChange,
  onShowAll,
  showQuickOptions = true,
  className = ''
}: DateRangeFilterProps) {
  const [quickRange, setQuickRange] = useState('7')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  useEffect(() => {
    calculateDates(quickRange)
  }, [])

  const calculateDates = (range: string) => {
    const end = new Date()
    const start = new Date()

    switch (range) {
      case 'today':
        // start and end are already today
        break
      case '7':
        start.setDate(end.getDate() - 7)
        break
      case '14':
        start.setDate(end.getDate() - 14)
        break
      case '28':
        start.setDate(end.getDate() - 28)
        break
      case 'month':
        start.setDate(1)
        break
      case 'all':
        // Will be handled separately via onShowAll
        return
      case 'custom':
        return
      default:
        start.setDate(end.getDate() - 7)
    }

    // Use local date (Thailand time) instead of UTC
    const formatLocalDate = (d: Date) => {
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    const startStr = formatLocalDate(start)
    const endStr = formatLocalDate(end)

    setStartDate(startStr)
    setEndDate(endStr)
    onDateChange(startStr, endStr)
  }

  const handleQuickRangeChange = (range: string) => {
    setQuickRange(range)
    if (range === 'all') {
      onShowAll?.()
    } else if (range !== 'custom') {
      calculateDates(range)
    }
  }

  const handleCustomDateChange = () => {
    if (startDate && endDate) {
      onDateChange(startDate, endDate)
    }
  }

  useEffect(() => {
    if (quickRange === 'custom' && startDate && endDate) {
      handleCustomDateChange()
    }
  }, [startDate, endDate])

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      {showQuickOptions && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => handleQuickRangeChange('today')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              quickRange === 'today'
                ? 'bg-pink-500 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Today
          </button>
          <button
            onClick={() => handleQuickRangeChange('7')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              quickRange === '7'
                ? 'bg-pink-500 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            7 Days
          </button>
          <button
            onClick={() => handleQuickRangeChange('14')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              quickRange === '14'
                ? 'bg-pink-500 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            14 Days
          </button>
          <button
            onClick={() => handleQuickRangeChange('28')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              quickRange === '28'
                ? 'bg-pink-500 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            28 Days
          </button>
          <button
            onClick={() => handleQuickRangeChange('month')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              quickRange === 'month'
                ? 'bg-pink-500 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            This Month
          </button>
          <button
            onClick={() => handleQuickRangeChange('custom')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              quickRange === 'custom'
                ? 'bg-pink-500 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Custom
          </button>
          {onShowAll && (
            <button
              onClick={() => handleQuickRangeChange('all')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                quickRange === 'all'
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              All
            </button>
          )}
        </div>
      )}

      {(quickRange === 'custom' || !showQuickOptions) && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="input px-3 py-1.5 text-sm"
          />
          <span className="text-gray-500 dark:text-gray-400">-</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="input px-3 py-1.5 text-sm"
          />
        </div>
      )}
    </div>
  )
}
