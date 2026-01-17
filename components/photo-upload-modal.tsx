'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/user-context'

interface PhotoUploadModalProps {
  orderItemId: number
  customerName: string
  productName: string
  onClose: () => void
  onComplete: () => void
  onSkip: () => void
}

export default function PhotoUploadModal({
  orderItemId,
  customerName,
  productName,
  onClose,
  onComplete,
  onSkip,
}: PhotoUploadModalProps) {
  const { user } = useUser()
  const [uploading, setUploading] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])

    // Validate file types
    const validFiles = files.filter(file =>
      file.type.startsWith('image/') && file.size <= 10 * 1024 * 1024 // 10MB max
    )

    if (validFiles.length !== files.length) {
      setError('บางไฟล์ไม่ถูกต้อง (รองรับเฉพาะรูปภาพ ขนาดไม่เกิน 10MB)')
    }

    // Create preview URLs
    const newPreviewUrls = validFiles.map(file => URL.createObjectURL(file))

    setSelectedFiles(prev => [...prev, ...validFiles])
    setPreviewUrls(prev => [...prev, ...newPreviewUrls])
  }

  const removeFile = (index: number) => {
    URL.revokeObjectURL(previewUrls[index])
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
    setPreviewUrls(prev => prev.filter((_, i) => i !== index))
  }

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      setError('กรุณาเลือกรูปภาพอย่างน้อย 1 รูป')
      return
    }

    setUploading(true)
    setError('')

    try {
      for (const file of selectedFiles) {
        // Generate unique filename
        const fileExt = file.name.split('.').pop()
        const fileName = `${orderItemId}_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
        const filePath = `service-photos/${fileName}`

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('service-photos')
          .upload(filePath, file)

        if (uploadError) {
          throw new Error(`Upload failed: ${uploadError.message}`)
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('service-photos')
          .getPublicUrl(filePath)

        // Save to service_photos table
        const { error: dbError } = await supabase
          .from('service_photos')
          .insert({
            order_item_id: orderItemId,
            photo_url: urlData.publicUrl,
            photo_path: filePath,
            uploaded_by: user?.id || null,
            note: note || null,
          })

        if (dbError) {
          throw new Error(`Database error: ${dbError.message}`)
        }
      }

      // Clean up preview URLs
      previewUrls.forEach(url => URL.revokeObjectURL(url))

      onComplete()
    } catch (err) {
      console.error('Upload error:', err)
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการอัพโหลด')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">อัพโหลดรูปหลังทำเสร็จ</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {customerName} - {productName}
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* File Input */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl hover:border-pink-500 dark:hover:border-pink-500 transition-colors"
            >
              <div className="flex flex-col items-center gap-2 text-gray-500 dark:text-gray-400">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="font-medium">คลิกเพื่อเลือกรูปภาพ</span>
                <span className="text-xs">รองรับไฟล์รูปภาพ ขนาดไม่เกิน 10MB</span>
              </div>
            </button>
          </div>

          {/* Preview */}
          {previewUrls.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {previewUrls.map((url, index) => (
                <div key={index} className="relative aspect-square">
                  <img
                    src={url}
                    alt={`Preview ${index + 1}`}
                    className="w-full h-full object-cover rounded-lg"
                  />
                  <button
                    onClick={() => removeFile(index)}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-sm"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Note */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              หมายเหตุ (ไม่บังคับ)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="input w-full"
              rows={2}
              placeholder="เช่น สีที่ใช้, เทคนิคพิเศษ..."
            />
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t dark:border-gray-700 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            ยกเลิก
          </button>
          <button
            onClick={onSkip}
            className="flex-1 py-3 bg-yellow-500 text-white rounded-lg font-medium hover:bg-yellow-600 transition-colors"
          >
            ข้ามขั้นตอนนี้
          </button>
          <button
            onClick={handleUpload}
            disabled={uploading || selectedFiles.length === 0}
            className="flex-1 py-3 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? 'กำลังอัพโหลด...' : `อัพโหลด (${selectedFiles.length})`}
          </button>
        </div>
      </div>
    </div>
  )
}
