import { createClient } from '@/lib/supabase/client'
import type { PhotoType, ServicePhoto } from '@/lib/supabase/types'

export const STORAGE_BUCKET = 'service-photos'
export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic']

/**
 * Upload a photo to Supabase Storage and save metadata to database
 */
export async function uploadServicePhoto({
  file,
  orderItemId,
  photoType,
  uploadedBy,
  note,
}: {
  file: File
  orderItemId: number
  photoType: PhotoType
  uploadedBy?: number
  note?: string
}): Promise<{ success: boolean; photo?: ServicePhoto; error?: string }> {
  const supabase = createClient()

  try {
    // Validate file
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return {
        success: false,
        error: 'ประเภทไฟล์ไม่ถูกต้อง รองรับเฉพาะ JPG, PNG, WebP, HEIC',
      }
    }

    if (file.size > MAX_FILE_SIZE) {
      return {
        success: false,
        error: `ขนาดไฟล์เกิน ${MAX_FILE_SIZE / 1024 / 1024}MB`,
      }
    }

    // Generate unique filename
    const fileExt = file.name.split('.').pop()
    const fileName = `${orderItemId}_${photoType}_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
    const filePath = `${photoType}/${fileName}`

    // Upload to Storage
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return { success: false, error: `Upload failed: ${uploadError.message}` }
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(filePath)

    // Save to database
    const { data: photo, error: dbError } = await supabase
      .from('service_photos')
      .insert({
        order_item_id: orderItemId,
        photo_url: urlData.publicUrl,
        photo_path: filePath,
        photo_type: photoType,
        uploaded_by: uploadedBy || null,
        note: note || null,
      })
      .select()
      .single()

    if (dbError) {
      // Rollback: Delete uploaded file
      await supabase.storage.from(STORAGE_BUCKET).remove([filePath])
      console.error('Database error:', dbError)
      return { success: false, error: `Database error: ${dbError.message}` }
    }

    return { success: true, photo }
  } catch (error) {
    console.error('Unexpected error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'เกิดข้อผิดพลาดที่ไม่คาดคิด',
    }
  }
}

/**
 * Upload multiple photos at once
 */
export async function uploadMultipleServicePhotos({
  files,
  orderItemId,
  photoType,
  uploadedBy,
  note,
}: {
  files: File[]
  orderItemId: number
  photoType: PhotoType
  uploadedBy?: number
  note?: string
}): Promise<{
  success: boolean
  photos: ServicePhoto[]
  errors: string[]
}> {
  const photos: ServicePhoto[] = []
  const errors: string[] = []

  for (const file of files) {
    const result = await uploadServicePhoto({
      file,
      orderItemId,
      photoType,
      uploadedBy,
      note,
    })

    if (result.success && result.photo) {
      photos.push(result.photo)
    } else {
      errors.push(result.error || 'Unknown error')
    }
  }

  return {
    success: errors.length === 0,
    photos,
    errors,
  }
}

/**
 * Get all photos for an order item
 */
export async function getServicePhotos(
  orderItemId: number,
  photoType?: PhotoType
): Promise<ServicePhoto[]> {
  const supabase = createClient()

  let query = supabase
    .from('service_photos')
    .select('*')
    .eq('order_item_id', orderItemId)
    .order('created_at', { ascending: true })

  if (photoType) {
    query = query.eq('photo_type', photoType)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching photos:', error)
    return []
  }

  return data || []
}

/**
 * Delete a photo from both Storage and Database
 */
export async function deleteServicePhoto(
  photoId: number
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient()

  try {
    // Get photo details first
    const { data: photo, error: fetchError } = await supabase
      .from('service_photos')
      .select('photo_path')
      .eq('id', photoId)
      .single()

    if (fetchError || !photo) {
      return { success: false, error: 'Photo not found' }
    }

    // Delete from Storage
    const { error: storageError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([photo.photo_path])

    if (storageError) {
      console.error('Storage delete error:', storageError)
      // Continue anyway to delete from database
    }

    // Delete from Database
    const { error: dbError } = await supabase
      .from('service_photos')
      .delete()
      .eq('id', photoId)

    if (dbError) {
      return { success: false, error: `Database error: ${dbError.message}` }
    }

    return { success: true }
  } catch (error) {
    console.error('Unexpected error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'เกิดข้อผิดพลาดที่ไม่คาดคิด',
    }
  }
}

/**
 * Get photo count by type
 */
export async function getPhotoCount(
  orderItemId: number,
  photoType: PhotoType
): Promise<number> {
  const supabase = createClient()

  const { count, error } = await supabase
    .from('service_photos')
    .select('*', { count: 'exact', head: true })
    .eq('order_item_id', orderItemId)
    .eq('photo_type', photoType)

  if (error) {
    console.error('Error counting photos:', error)
    return 0
  }

  return count || 0
}

/**
 * Check if an order item has before photos
 */
export async function hasBeforePhotos(orderItemId: number): Promise<boolean> {
  const count = await getPhotoCount(orderItemId, 'before')
  return count > 0
}

/**
 * Check if an order item has after photos
 */
export async function hasAfterPhotos(orderItemId: number): Promise<boolean> {
  const count = await getPhotoCount(orderItemId, 'after')
  return count > 0
}

/**
 * Validate file before upload
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: 'ประเภทไฟล์ไม่ถูกต้อง รองรับเฉพาะ JPG, PNG, WebP, HEIC',
    }
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `ขนาดไฟล์เกิน ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    }
  }

  return { valid: true }
}
