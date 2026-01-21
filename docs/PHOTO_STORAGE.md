# Photo Storage System

> เอกสารสำหรับระบบจัดการรูปภาพผลงานลูกค้า
> Last Updated: 2026-01-21

---

## Overview

ระบบจัดการรูปภาพผลงานลูกค้า (Before/After Photos) ใช้ **Supabase Storage** เป็น storage backend และเชื่อมกับ `service_photos` table ใน database

### Use Cases
1. **รูปก่อนทำ (Before Photos)** - Sales อัพโหลดตอนกรอกข้อมูลลูกค้า เพื่อให้ช่างดูก่อนเริ่มงาน
2. **รูปหลังทำเสร็จ (After Photos)** - อัพโหลดหลังทำบริการเสร็จ เก็บเป็น Portfolio

---

## Database Schema

### Table: `service_photos`

```sql
CREATE TABLE service_photos (
  id SERIAL PRIMARY KEY,
  order_item_id INTEGER NOT NULL REFERENCES order_items(id),
  photo_url TEXT NOT NULL,
  photo_path TEXT NOT NULL,
  photo_type VARCHAR(10) NOT NULL CHECK (photo_type IN ('before', 'after')),
  uploaded_by INTEGER REFERENCES staff(id),
  note TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_service_photos_photo_type ON service_photos(photo_type);
CREATE INDEX idx_service_photos_order_item_type ON service_photos(order_item_id, photo_type);
```

### Fields
- `id` - Primary key
- `order_item_id` - เชื่อมกับ order_items (แต่ละบริการที่ลูกค้าสั่ง)
- `photo_url` - Public URL ของรูปภาพ
- `photo_path` - Path ใน Supabase Storage (สำหรับลบไฟล์)
- `photo_type` - ประเภทรูป: `'before'` หรือ `'after'`
- `uploaded_by` - Staff ID ที่อัพโหลด (nullable)
- `note` - หมายเหตุเกี่ยวกับรูป (เช่น สีที่ใช้, เทคนิคพิเศษ)
- `created_at` - เวลาที่อัพโหลด

---

## Supabase Storage

### Bucket Configuration
- **Bucket Name**: `service-photos`
- **Access**: Public (read), Authenticated (write)
- **File Structure**:
  ```
  service-photos/
    before/
      {order_item_id}_before_{timestamp}_{random}.jpg
    after/
      {order_item_id}_after_{timestamp}_{random}.jpg
  ```

### Storage Policies (ต้องตั้งค่าใน Supabase Dashboard)

```sql
-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'service-photos');

-- Allow authenticated users to delete their own uploads
CREATE POLICY "Users can delete own photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'service-photos');

-- Allow public read access
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'service-photos');
```

---

## TypeScript API

### Types

```typescript
import type { PhotoType, ServicePhoto } from '@/lib/supabase/types'

// PhotoType = 'before' | 'after'
// ServicePhoto = Database['public']['Tables']['service_photos']['Row']
```

### Functions

#### 1. Upload Single Photo

```typescript
import { uploadServicePhoto } from '@/lib/storage'

const result = await uploadServicePhoto({
  file: File,                    // รูปภาพที่ต้องการอัพโหลด
  orderItemId: number,           // ID ของ order_item
  photoType: 'before' | 'after', // ประเภทรูป
  uploadedBy?: number,           // Staff ID (optional)
  note?: string,                 // หมายเหตุ (optional)
})

// Returns:
// { success: true, photo: ServicePhoto } | { success: false, error: string }
```

#### 2. Upload Multiple Photos

```typescript
import { uploadMultipleServicePhotos } from '@/lib/storage'

const result = await uploadMultipleServicePhotos({
  files: File[],                 // Array ของรูปภาพ
  orderItemId: number,
  photoType: 'before' | 'after',
  uploadedBy?: number,
  note?: string,
})

// Returns:
// { success: boolean, photos: ServicePhoto[], errors: string[] }
```

#### 3. Get Photos

```typescript
import { getServicePhotos } from '@/lib/storage'

// Get all photos for an order item
const allPhotos = await getServicePhotos(orderItemId)

// Get only before photos
const beforePhotos = await getServicePhotos(orderItemId, 'before')

// Get only after photos
const afterPhotos = await getServicePhotos(orderItemId, 'after')
```

#### 4. Delete Photo

```typescript
import { deleteServicePhoto } from '@/lib/storage'

const result = await deleteServicePhoto(photoId)
// Returns: { success: boolean, error?: string }
```

#### 5. Check Photo Existence

```typescript
import { hasBeforePhotos, hasAfterPhotos } from '@/lib/storage'

const hasBefore = await hasBeforePhotos(orderItemId) // boolean
const hasAfter = await hasAfterPhotos(orderItemId)   // boolean
```

#### 6. Validate File

```typescript
import { validateImageFile } from '@/lib/storage'

const validation = validateImageFile(file)
// Returns: { valid: boolean, error?: string }
```

---

## Usage Examples

### Example 1: Upload Before Photos (Sales Form)

```tsx
import { uploadMultipleServicePhotos } from '@/lib/storage'
import { useUser } from '@/lib/user-context'

function SalesForm() {
  const { user } = useUser()

  const handleUploadBeforePhotos = async (files: File[], orderItemId: number) => {
    const result = await uploadMultipleServicePhotos({
      files,
      orderItemId,
      photoType: 'before',
      uploadedBy: user?.id,
      note: 'รูปก่อนทำที่ลูกค้าส่งมา',
    })

    if (result.success) {
      console.log(`Uploaded ${result.photos.length} photos`)
    } else {
      console.error('Errors:', result.errors)
    }
  }

  return (
    <input
      type="file"
      multiple
      accept="image/*"
      onChange={(e) => {
        const files = Array.from(e.target.files || [])
        handleUploadBeforePhotos(files, orderItemId)
      }}
    />
  )
}
```

### Example 2: Display Photos in Artist View

```tsx
import { useEffect, useState } from 'react'
import { getServicePhotos } from '@/lib/storage'

function ArtistOrderView({ orderItemId }: { orderItemId: number }) {
  const [beforePhotos, setBeforePhotos] = useState([])

  useEffect(() => {
    async function loadPhotos() {
      const photos = await getServicePhotos(orderItemId, 'before')
      setBeforePhotos(photos)
    }
    loadPhotos()
  }, [orderItemId])

  return (
    <div>
      <h3>รูปก่อนทำ ({beforePhotos.length})</h3>
      <div className="grid grid-cols-3 gap-2">
        {beforePhotos.map(photo => (
          <img key={photo.id} src={photo.photo_url} alt="Before" />
        ))}
      </div>
    </div>
  )
}
```

### Example 3: Existing After Photo Upload

```tsx
// ระบบเดิมที่มีอยู่แล้วใน photo-upload-modal.tsx
// ต้องแก้ไขให้ใส่ photo_type: 'after' เท่านั้น

import { uploadServicePhoto } from '@/lib/storage'

const result = await uploadServicePhoto({
  file,
  orderItemId,
  photoType: 'after', // เพิ่มบรรทัดนี้
  uploadedBy: user?.id,
  note,
})
```

---

## Migration

### Run Migration V9

**สร้าง `service_photos` table ใหม่:**

1. ไปที่ Supabase Dashboard → SQL Editor
2. เปิดไฟล์ `database/migration_v9_create_service_photos.sql`
3. Copy & Paste และรัน
4. Verify:
   ```sql
   -- Check table structure
   SELECT table_name, column_name, data_type, is_nullable, column_default
   FROM information_schema.columns
   WHERE table_name = 'service_photos'
   ORDER BY ordinal_position;

   -- Check indexes
   SELECT indexname, indexdef
   FROM pg_indexes
   WHERE tablename = 'service_photos';
   ```

---

## File Validation

### Constraints
- **Allowed Types**: JPEG, JPG, PNG, WebP, HEIC
- **Max Size**: 10MB per file
- **Validation**: ทำที่ client-side ก่อน upload

### Security Considerations
1. ใช้ Supabase Storage Policies เพื่อควบคุมการเข้าถึง
2. Validate file type และ size ก่อน upload
3. Generate unique filename เพื่อป้องกัน collision
4. ใช้ authenticated upload only

---

## Next Steps / TODO

### For Sales Feature
- [ ] สร้างฟอร์มอัพโหลด Before Photos ในหน้าสร้าง Order
- [ ] แสดงรูป Before ในหน้า Order Detail

### For Artist Feature
- [ ] แสดงรูป Before Photos ในหน้า Artist Home
- [ ] อัพเดท Photo Upload Modal ให้รองรับ photo_type
- [ ] Portfolio Gallery (รวมรูป After ทั้งหมด)

### Enhancements
- [ ] Image compression ก่อน upload
- [ ] Thumbnail generation
- [ ] Batch delete photos
- [ ] Photo sorting/reordering
- [ ] Watermark for portfolio photos

---

## Troubleshooting

### Issue: Upload fails with 403 error
**Solution**: ตรวจสอบ Storage Policies ใน Supabase Dashboard

### Issue: Photo URL returns 404
**Solution**: ตรวจสอบว่า bucket เป็น public และ RLS policies ถูกต้อง

### Issue: File too large error
**Solution**: ลด file size หรือเพิ่ม MAX_FILE_SIZE ใน `lib/storage/photos.ts`

---

## References

- [Supabase Storage Documentation](https://supabase.com/docs/guides/storage)
- [Next.js File Upload Best Practices](https://nextjs.org/docs/app/building-your-application/routing/route-handlers#handling-file-uploads)
- Main project handoff: `HANDOFF_BRIEF.md`
