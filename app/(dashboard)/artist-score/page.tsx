'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import DateRangeFilter from '@/components/date-range-filter'
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  RadarController,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
} from 'chart.js'
import { Radar } from 'react-chartjs-2'

ChartJS.register(
  Title,
  Tooltip,
  Legend,
  RadarController,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler
)

interface Staff {
  id: number
  staff_name: string
}

interface SatisfactionRating {
  id: number
  artist_id: number
  service_category: string
  pain_level: number
  artist_service_quality: number
  result_satisfaction: number
  front_desk_service: number
  chat_response_quality: number
  submitted_at: string
  artist: { staff_name: string }
}

interface ArtistStats {
  artist_id: number
  artist_name: string
  total_ratings: number
  avg_pain_level: number
  avg_artist_quality: number
  avg_result_satisfaction: number
  avg_front_desk: number
  avg_chat_quality: number
  overall_avg: number
  category_stats: Record<string, {
    count: number
    avg_score: number
  }>
}

const SERVICE_CATEGORIES = ['Brow', 'Lip', 'Inliner', 'Hair', 'Pink Area', 'Other']

export default function ArtistScorePage() {
  const [artists, setArtists] = useState<Staff[]>([])
  const [ratings, setRatings] = useState<SatisfactionRating[]>([])
  const [artistStats, setArtistStats] = useState<ArtistStats[]>([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedArtist, setSelectedArtist] = useState<string>('')
  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  const [overallSalesScore, setOverallSalesScore] = useState<number>(0)
  const [overallChatScore, setOverallChatScore] = useState<number>(0)

  const supabase = createClient()

  const handleDateChange = (start: string, end: string) => {
    setStartDate(start)
    setEndDate(end)
  }

  useEffect(() => {
    fetchArtists()
    // Load last 30 days by default
    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - 30)
    const formatDate = (d: Date) => {
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
    setStartDate(formatDate(start))
    setEndDate(formatDate(end))
  }, [])

  useEffect(() => {
    if (startDate && endDate) {
      fetchRatings()
    }
  }, [startDate, endDate, selectedArtist, selectedCategory])

  const fetchArtists = async () => {
    const { data } = await supabase
      .from('staff')
      .select('id, staff_name')
      .eq('role', 'artist')
      .eq('is_active', true)
      .order('staff_name')

    setArtists(data || [])
  }

  const fetchRatings = async () => {
    setLoading(true)

    try {
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
      })

      if (selectedArtist) {
        params.append('artist_id', selectedArtist)
      }

      if (selectedCategory !== 'All') {
        params.append('category', selectedCategory)
      }

      const response = await fetch(`/api/satisfaction?${params}`)
      const result = await response.json()

      if (result.success) {
        setRatings(result.data || [])
        calculateStats(result.data || [])
      }
    } catch (error) {
      console.error('Error fetching ratings:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAllRatings = async () => {
    setLoading(true)
    setStartDate('')
    setEndDate('')

    try {
      const params = new URLSearchParams()

      if (selectedArtist) {
        params.append('artist_id', selectedArtist)
      }

      if (selectedCategory !== 'All') {
        params.append('category', selectedCategory)
      }

      const response = await fetch(`/api/satisfaction?${params}`)
      const result = await response.json()

      if (result.success) {
        setRatings(result.data || [])
        calculateStats(result.data || [])
      }
    } catch (error) {
      console.error('Error fetching ratings:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = (ratingsData: SatisfactionRating[]) => {
    // Group by artist
    const artistMap = new Map<number, SatisfactionRating[]>()

    ratingsData.forEach(rating => {
      if (!artistMap.has(rating.artist_id)) {
        artistMap.set(rating.artist_id, [])
      }
      artistMap.get(rating.artist_id)!.push(rating)
    })

    // Calculate stats for each artist
    const stats: ArtistStats[] = []

    // Calculate overall Sales and Chat scores (not per artist)
    let totalFrontDesk = 0
    let totalChatQuality = 0
    let totalRatingsCount = ratingsData.length

    ratingsData.forEach(rating => {
      totalFrontDesk += rating.front_desk_service || 0
      totalChatQuality += rating.chat_response_quality || 0
    })

    const overallSalesScore = totalRatingsCount > 0 ? totalFrontDesk / totalRatingsCount : 0
    const overallChatScore = totalRatingsCount > 0 ? totalChatQuality / totalRatingsCount : 0

    artistMap.forEach((artistRatings, artistId) => {
      const artistName = artistRatings[0]?.artist?.staff_name || 'Unknown'
      const count = artistRatings.length

      // Calculate averages
      const avgPainLevel = artistRatings.reduce((sum, r) => sum + (r.pain_level || 0), 0) / count
      const avgArtistQuality = artistRatings.reduce((sum, r) => sum + (r.artist_service_quality || 0), 0) / count
      const avgResultSatisfaction = artistRatings.reduce((sum, r) => sum + (r.result_satisfaction || 0), 0) / count
      const avgFrontDesk = artistRatings.reduce((sum, r) => sum + (r.front_desk_service || 0), 0) / count
      const avgChatQuality = artistRatings.reduce((sum, r) => sum + (r.chat_response_quality || 0), 0) / count

      // Overall average - only 3 metrics: pain_level, artist_quality, result_satisfaction
      const overallAvg = (avgPainLevel + avgArtistQuality + avgResultSatisfaction) / 3

      // Calculate stats by category
      const categoryStats: Record<string, { count: number; avg_score: number }> = {}

      artistRatings.forEach(rating => {
        const category = rating.service_category
        if (!categoryStats[category]) {
          categoryStats[category] = { count: 0, avg_score: 0 }
        }

        // Category average also uses only 3 metrics
        const categoryAvg = (
          (rating.pain_level || 0) +
          (rating.artist_service_quality || 0) +
          (rating.result_satisfaction || 0)
        ) / 3

        categoryStats[category].count++
        categoryStats[category].avg_score += categoryAvg
      })

      // Calculate final averages for categories
      Object.keys(categoryStats).forEach(category => {
        categoryStats[category].avg_score /= categoryStats[category].count
      })

      stats.push({
        artist_id: artistId,
        artist_name: artistName,
        total_ratings: count,
        avg_pain_level: avgPainLevel,
        avg_artist_quality: avgArtistQuality,
        avg_result_satisfaction: avgResultSatisfaction,
        avg_front_desk: avgFrontDesk,
        avg_chat_quality: avgChatQuality,
        overall_avg: overallAvg,
        category_stats: categoryStats,
      })
    })

    // Sort by overall average descending
    stats.sort((a, b) => b.overall_avg - a.overall_avg)
    setArtistStats(stats)
    setOverallSalesScore(overallSalesScore)
    setOverallChatScore(overallChatScore)
  }

  const formatScore = (score: number) => {
    return score.toFixed(2)
  }

  // Radar Chart for individual artist (if selected)
  const selectedArtistData = selectedArtist
    ? artistStats.find(a => a.artist_id === parseInt(selectedArtist))
    : null

  const radarData = selectedArtistData
    ? {
        labels: [
          'ระดับความเจ็บ',
          'การบริการของช่าง',
          'ความพึงพอใจหลังทำ',
        ],
        datasets: [
          {
            label: selectedArtistData.artist_name,
            data: [
              selectedArtistData.avg_pain_level,
              selectedArtistData.avg_artist_quality,
              selectedArtistData.avg_result_satisfaction,
            ],
            backgroundColor: 'rgba(236, 72, 153, 0.2)',
            borderColor: 'rgba(236, 72, 153, 1)',
            borderWidth: 2,
            pointBackgroundColor: 'rgba(236, 72, 153, 1)',
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: 'rgba(236, 72, 153, 1)',
          },
        ],
      }
    : null

  const radarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      r: {
        beginAtZero: true,
        max: 5,
        ticks: {
          stepSize: 1,
        },
      },
    },
    plugins: {
      legend: {
        position: 'top' as const,
      },
    },
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Artist Score</h1>
        <p className="text-gray-500 dark:text-gray-400">คะแนนความพึงพอใจของช่าง</p>
      </div>

      {/* Filters */}
      <div className="card space-y-4">
        <DateRangeFilter onDateChange={handleDateChange} onShowAll={fetchAllRatings} />

        <div className="flex flex-col lg:flex-row gap-4">
          {/* Artist Filter */}
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              เลือกช่าง
            </label>
            <select
              value={selectedArtist}
              onChange={(e) => setSelectedArtist(e.target.value)}
              className="select w-full"
            >
              <option value="">ช่างทั้งหมด</option>
              {artists.map(artist => (
                <option key={artist.id} value={artist.id}>
                  {artist.staff_name}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              เลือกหมวดบริการ
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="select w-full"
            >
              <option value="All">ทั้งหมด</option>
              {SERVICE_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">กำลังโหลด...</p>
        </div>
      ) : (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="card">
              <p className="text-sm text-gray-500 dark:text-gray-400">จำนวนช่าง</p>
              <p className="text-2xl font-bold text-pink-600 mt-1">
                {artistStats.length}
              </p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500 dark:text-gray-400">แบบประเมินทั้งหมด</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">
                {ratings.length}
              </p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500 dark:text-gray-400">ช่างที่ดีที่สุด</p>
              <p className="text-lg font-bold text-green-600 mt-1">
                {artistStats[0]?.artist_name || '-'}
              </p>
            </div>
          </div>

          {/* Sales & Chat Scores */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">คะแนนการบริการหน้าร้าน (Sales)</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    คะแนนรวมทั้งหมดจากการให้บริการหน้าร้าน
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-blue-600">
                    {formatScore(overallSalesScore)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">/ 5.00</p>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">คะแนนการตอบแชท</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    คะแนนรวมทั้งหมดจากการตอบแชท
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-teal-600">
                    {formatScore(overallChatScore)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">/ 5.00</p>
                </div>
              </div>
            </div>
          </div>

          {/* Radar Chart (if artist selected) */}
          {selectedArtist && selectedArtistData && radarData && (
            <div className="card">
              <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4">
                คะแนนรายละเอียด - {selectedArtistData.artist_name}
              </h2>
              <div className="h-96">
                <Radar data={radarData} options={radarOptions} />
              </div>
            </div>
          )}

          {/* Rankings */}
          <div className="card">
            <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4">
              อันดับช่างตามคะแนนเฉลี่ย
            </h2>

            <div className="space-y-3">
              {artistStats.map((artist, index) => (
                <div
                  key={artist.artist_id}
                  className={`p-4 rounded-xl transition-all ${
                    index === 0
                      ? 'bg-gradient-to-r from-yellow-100 to-yellow-50 dark:from-yellow-900/30 dark:to-yellow-900/10 border-2 border-yellow-400'
                      : index === 1
                      ? 'bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-700/30 dark:to-gray-700/10 border-2 border-gray-400'
                      : index === 2
                      ? 'bg-gradient-to-r from-amber-100 to-amber-50 dark:from-amber-900/30 dark:to-amber-900/10 border-2 border-amber-600'
                      : 'bg-gray-50 dark:bg-gray-700/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                        index === 0
                          ? 'bg-yellow-500 text-white'
                          : index === 1
                          ? 'bg-gray-400 text-white'
                          : index === 2
                          ? 'bg-amber-600 text-white'
                          : 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                      }`}>
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-bold text-gray-800 dark:text-white">
                          {artist.artist_name}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {artist.total_ratings} รีวิว
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-pink-600">
                        {formatScore(artist.overall_avg)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">/ 5.00</p>
                    </div>
                  </div>

                  {/* Detailed Scores */}
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    <div className="text-center p-2 bg-white dark:bg-gray-800 rounded-lg">
                      <p className="text-xs text-gray-500 dark:text-gray-400">ระดับความเจ็บ</p>
                      <p className="font-bold text-gray-800 dark:text-white">
                        {formatScore(artist.avg_pain_level)}
                      </p>
                    </div>
                    <div className="text-center p-2 bg-white dark:bg-gray-800 rounded-lg">
                      <p className="text-xs text-gray-500 dark:text-gray-400">การบริการของช่าง</p>
                      <p className="font-bold text-gray-800 dark:text-white">
                        {formatScore(artist.avg_artist_quality)}
                      </p>
                    </div>
                    <div className="text-center p-2 bg-white dark:bg-gray-800 rounded-lg">
                      <p className="text-xs text-gray-500 dark:text-gray-400">ความพึงพอใจหลังทำ</p>
                      <p className="font-bold text-gray-800 dark:text-white">
                        {formatScore(artist.avg_result_satisfaction)}
                      </p>
                    </div>
                  </div>

                  {/* Category Breakdown */}
                  {Object.keys(artist.category_stats).length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                        คะแนนตามหมวด:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(artist.category_stats).map(([category, stats]) => (
                          <div
                            key={category}
                            className="px-3 py-1 bg-white dark:bg-gray-800 rounded-full text-xs"
                          >
                            <span className="font-medium text-gray-700 dark:text-gray-300">
                              {category}
                            </span>
                            <span className="ml-1 text-pink-600 font-bold">
                              {formatScore(stats.avg_score)}
                            </span>
                            <span className="ml-1 text-gray-400">
                              ({stats.count})
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {artistStats.length === 0 && (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  ไม่มีข้อมูลคะแนนในช่วงเวลาที่เลือก
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
