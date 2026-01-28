'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/user-context'
import type { Staff, CommissionSetting } from '@/lib/supabase/types'

interface ArtistWithCommission extends Staff {
  commission?: CommissionSetting
}

export default function CommissionSettingsPage() {
  const { user } = useUser()
  const [artists, setArtists] = useState<ArtistWithCommission[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingArtist, setEditingArtist] = useState<ArtistWithCommission | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [commissionNormal, setCommissionNormal] = useState('0')
  const [commission50, setCommission50] = useState('0')

  const supabase = createClient()

  useEffect(() => {
    if (user?.role === 'super_admin') {
      fetchArtistsWithCommission()
    }
  }, [user])

  const fetchArtistsWithCommission = async () => {
    setLoading(true)

    // Fetch all artists
    const { data: artistsData } = await supabase
      .from('staff')
      .select('*')
      .eq('role', 'artist')
      .eq('is_active', true)
      .order('staff_name')

    if (!artistsData) {
      setLoading(false)
      return
    }

    // Fetch commission settings for all artists
    const { data: commissionsData } = await supabase
      .from('commission_settings')
      .select('*')

    // Merge data
    const artistsWithCommission = artistsData.map(artist => {
      const commission = commissionsData?.find(c => c.artist_id === artist.id)
      return {
        ...artist,
        commission
      }
    })

    setArtists(artistsWithCommission)
    setLoading(false)
  }

  const openModal = (artist: ArtistWithCommission) => {
    setEditingArtist(artist)
    setCommissionNormal(artist.commission?.commission_normal_percent?.toString() || '0')
    setCommission50(artist.commission?.commission_50_percent?.toString() || '0')
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingArtist(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingArtist) return

    setSubmitting(true)

    try {
      const normalPercent = parseFloat(commissionNormal) || 0
      const percent50 = parseFloat(commission50) || 0

      // Validate percentages
      if (normalPercent < 0 || normalPercent > 100 || percent50 < 0 || percent50 > 100) {
        alert('เปอร์เซ็นต์ต้องอยู่ระหว่าง 0-100')
        setSubmitting(false)
        return
      }

      if (editingArtist.commission) {
        // Update existing commission setting
        const { error } = await supabase
          .from('commission_settings')
          .update({
            commission_normal_percent: normalPercent,
            commission_50_percent: percent50,
            updated_at: new Date().toISOString()
          })
          .eq('artist_id', editingArtist.id)

        if (error) throw error
      } else {
        // Insert new commission setting
        const { error } = await supabase
          .from('commission_settings')
          .insert({
            artist_id: editingArtist.id,
            commission_normal_percent: normalPercent,
            commission_50_percent: percent50
          })

        if (error) throw error
      }

      await fetchArtistsWithCommission()
      closeModal()
    } catch (error) {
      console.error('Error saving commission settings:', error)
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล')
    } finally {
      setSubmitting(false)
    }
  }

  // Check if user has permission
  if (!user || user.role !== 'super_admin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="text-2xl font-bold text-red-500 mb-2">ไม่มีสิทธิ์เข้าถึง</div>
        <div className="text-gray-500">หน้านี้สำหรับ Super Admin เท่านั้น</div>
      </div>
    )
  }

  return (
    <div className="p-4 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">ตั้งค่าค่าคอมมิชชั่น</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          จัดการค่าคอมมิชชั่นของช่างแต่ละคน
        </p>
      </div>

      {/* Artists List */}
      {loading ? (
        <div className="text-center py-10">กำลังโหลด...</div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    ชื่อช่าง
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Email
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    คอมมิชชั่นทั่วไป (%)
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    คอมมิชชั่น 50% (%)
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    จัดการ
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-gray-700">
                {artists.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      ไม่มีข้อมูลช่าง
                    </td>
                  </tr>
                ) : (
                  artists.map(artist => (
                    <tr
                      key={artist.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 dark:text-white">
                          {artist.staff_name}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {artist.email}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                          {artist.commission?.commission_normal_percent?.toFixed(2) || '0.00'}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
                          {artist.commission?.commission_50_percent?.toFixed(2) || '0.00'}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => openModal(artist)}
                          className="btn-secondary text-sm px-3 py-1"
                        >
                          ตั้งค่า
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && editingArtist && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">
              ตั้งค่าค่าคอมมิชชั่น - {editingArtist.staff_name}
            </h2>

            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                {/* Normal Commission */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    คอมมิชชั่นทั่วไป (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={commissionNormal}
                    onChange={(e) => setCommissionNormal(e.target.value)}
                    className="input w-full"
                    placeholder="0.00"
                    required
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    สำหรับบริการทั่วไปและบริการ FREE (ไม่รวมบริการ 50%)
                  </p>
                </div>

                {/* 50% Commission */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    คอมมิชชั่น 50% (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={commission50}
                    onChange={(e) => setCommission50(e.target.value)}
                    className="input w-full"
                    placeholder="0.00"
                    required
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    สำหรับบริการที่มีส่วนลด 50%
                  </p>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-2 mt-6">
                <button
                  type="button"
                  onClick={closeModal}
                  className="btn-secondary flex-1"
                  disabled={submitting}
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1"
                  disabled={submitting}
                >
                  {submitting ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
