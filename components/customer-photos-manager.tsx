'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import {
  getServicePhotos,
  uploadMultipleServicePhotos,
  deleteServicePhoto,
  type PhotoType,
  type ServicePhoto,
} from '@/lib/storage/photos'
import { useUser } from '@/lib/user-context'

interface CustomerPhotosManagerProps {
  customerId: number
  customerName: string
}

export default function CustomerPhotosManager({ customerId, customerName }: CustomerPhotosManagerProps) {
  const { user } = useUser()
  const [photos, setPhotos] = useState<ServicePhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [selectedPhotoType, setSelectedPhotoType] = useState<PhotoType>('before')

  useEffect(() => {
    loadPhotos()
  }, [customerId])

  const loadPhotos = async () => {
    setLoading(true)
    const allPhotos = await getServicePhotos(customerId)
    setPhotos(allPhotos)
    setLoading(false)
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    setUploading(true)

    const result = await uploadMultipleServicePhotos({
      files,
      customerId,
      photoType: selectedPhotoType,
      uploadedBy: user?.id,
      note: `Uploaded via Orders page`,
    })

    if (result.errors.length > 0) {
      alert(`เกิดข้อผิดพลาดบางส่วน:\n${result.errors.join('\n')}`)
    } else {
      alert(`✅ อัปโหลด ${result.photos.length} รูปสำเร็จ!`)
    }

    // Reload photos
    await loadPhotos()
    setUploading(false)

    // Clear input
    e.target.value = ''
  }

  const handleDeletePhoto = async (photoId: number) => {
    console.log('[handleDeletePhoto] Attempting to delete photo id:', photoId)

    if (!confirm('ต้องการลบรูปนี้ใช่หรือไม่?')) {
      console.log('[handleDeletePhoto] User cancelled deletion')
      return
    }

    console.log('[handleDeletePhoto] User confirmed, calling deleteServicePhoto')
    const result = await deleteServicePhoto(photoId)
    console.log('[handleDeletePhoto] Result:', result)

    if (result.success) {
      console.log('[handleDeletePhoto] Deletion successful, reloading photos')
      alert('✅ ลบรูปสำเร็จ!')
      await loadPhotos()
      console.log('[handleDeletePhoto] Photos reloaded')
    } else {
      console.error('[handleDeletePhoto] Deletion failed with error:', result.error)
      alert(`❌ เกิดข้อผิดพลาด: ${result.error}`)
    }
  }

  const beforePhotos = photos.filter(p => p.photo_type === 'before')
  const afterPhotos = photos.filter(p => p.photo_type === 'after')

  if (loading) {
    return (
      <div className="card p-6">
        <div className="text-center text-gray-500 dark:text-gray-400">กำลังโหลดรูปภาพ...</div>
      </div>
    )
  }

  return (
    <div className="card p-6 space-y-6">
      <div className="border-b pb-3">
        <h2 className="font-bold text-gray-800 dark:text-white text-lg">
          📸 รูปภาพของ {customerName}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          อัปโหลดและจัดการรูปภาพ Before/After ของลูกค้า
        </p>
      </div>

      {/* Upload Section */}
      <div className="bg-gradient-to-r from-pink-50 to-purple-50 dark:from-gray-800 dark:to-gray-700 p-4 rounded-lg border border-pink-200 dark:border-gray-600">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              เลือกประเภทรูป:
            </label>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="before"
                  checked={selectedPhotoType === 'before'}
                  onChange={(e) => setSelectedPhotoType(e.target.value as PhotoType)}
                  className="radio"
                />
                <span className="text-sm font-medium">รูปก่อนทำ (Before)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="after"
                  checked={selectedPhotoType === 'after'}
                  onChange={(e) => setSelectedPhotoType(e.target.value as PhotoType)}
                  className="radio"
                />
                <span className="text-sm font-medium">รูปหลังทำ (After)</span>
              </label>
            </div>
          </div>

          <div className="w-full sm:w-auto">
            <label className="btn btn-primary cursor-pointer inline-block">
              {uploading ? '⏳ กำลังอัปโหลด...' : '+ เพิ่มรูป'}
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                disabled={uploading}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Before Photos */}
      <div>
        <h3 className="font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
          <span className="text-blue-500">📷</span>
          รูปก่อนทำ ({beforePhotos.length})
        </h3>
        {beforePhotos.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {beforePhotos.map((photo) => (
              <div key={photo.id} className="relative group">
                <div className="relative w-full aspect-square">
                  <Image
                    src={photo.photo_url}
                    alt={`Before ${photo.id}`}
                    fill
                    className="object-cover rounded-lg border-2 border-blue-200 dark:border-blue-800"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleDeletePhoto(photo.id)}
                  className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 text-white rounded-full hover:bg-red-600 flex items-center justify-center text-xs font-bold shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ✕
                </button>
                {photo.note && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 text-white text-xs p-1 rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity">
                    {photo.note}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-400 dark:text-gray-500 py-8 border-2 border-dashed rounded-lg">
            ยังไม่มีรูปก่อนทำ
          </div>
        )}
      </div>

      {/* After Photos */}
      <div>
        <h3 className="font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
          <span className="text-green-500">✨</span>
          รูปหลังทำ ({afterPhotos.length})
        </h3>
        {afterPhotos.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {afterPhotos.map((photo) => (
              <div key={photo.id} className="relative group">
                <div className="relative w-full aspect-square">
                  <Image
                    src={photo.photo_url}
                    alt={`After ${photo.id}`}
                    fill
                    className="object-cover rounded-lg border-2 border-green-200 dark:border-green-800"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleDeletePhoto(photo.id)}
                  className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 text-white rounded-full hover:bg-red-600 flex items-center justify-center text-xs font-bold shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ✕
                </button>
                {photo.note && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 text-white text-xs p-1 rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity">
                    {photo.note}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-400 dark:text-gray-500 py-8 border-2 border-dashed rounded-lg">
            ยังไม่มีรูปหลังทำ
          </div>
        )}
      </div>
    </div>
  )
}
