# Bug Fix: Payment Slip Thumbnail ไม่แสดง (Bucket not found - 404)

## ปัญหา
- ไม่สามารถดูไฟล์สลิป (Payment Slip) ในขนาด Thumbnail ได้
- Error message: `{"statusCode":"404","error":"Bucket not found","message":"Bucket not found"}`
- เกิดขึ้นที่หน้าประวัติการเงิน (Payment History) และ Order Details

## สาเหตุ
Storage bucket `payment-receipts` ถูกสร้างเป็น **private bucket** (`public = false`) ตั้งแต่ migration v14
แต่โค้ดใช้ method `getPublicUrl()` ซึ่งต้องการ public bucket เพื่อให้ URL สามารถเข้าถึงได้โดยตรง

### ตำแหน่งที่เกิดปัญหา:
1. **Migration:** `database/migration_v14_add_payment_receipts.sql:21`
   ```sql
   VALUES ('payment-receipts', 'payment-receipts', false)  -- ❌ false = private
   ```

2. **Code:** `app/focus/components/payment-modal.tsx:89-93`
   ```typescript
   const { data: urlData } = supabase.storage
     .from('payment-receipts')
     .getPublicUrl(filePath)  // ❌ ต้องการ public bucket
   ```

3. **RLS Policy:** ไม่มี policy สำหรับ public access (ต้องการ authentication)

## การแก้ไข

### 1. Migration Script
สร้างไฟล์ `database/migration_v14_1_fix_payment_receipts_bucket.sql`:
- อัพเดท bucket ให้เป็น public (`public = true`)
- เพิ่ม RLS policy สำหรับ public read access

### 2. Documentation Update
อัพเดท `SUPABASE_STORAGE_SETUP.md`:
- เพิ่มคำแนะนำสำหรับการรัน migration v14.1
- ปรับปรุง troubleshooting guide
- เน้นย้ำความสำคัญของ public bucket

## วิธีแก้ไขด่วน (Quick Fix)

### ตัวเลือก 1: รัน Migration (แนะนำ)
```bash
# 1. เข้าสู่ Supabase SQL Editor
# 2. รันไฟล์:
database/migration_v14_1_fix_payment_receipts_bucket.sql

# 3. ตรวจสอบ
SELECT id, name, public FROM storage.buckets WHERE id = 'payment-receipts';
-- Expected: public = true
```

### ตัวเลือก 2: แก้ผ่าน Dashboard
1. Supabase Dashboard → Storage → payment-receipts
2. Settings → **Public bucket: ON** ✅
3. SQL Editor → รัน:
   ```sql
   CREATE POLICY "Public can view payment receipts"
   ON storage.objects FOR SELECT
   TO public
   USING (bucket_id = 'payment-receipts');
   ```

## ผลลัพธ์หลังแก้ไข
- ✅ Thumbnail ของสลิปแสดงผลได้ปกติ
- ✅ ปุ่ม "ดูสลิปการโอนเงิน" เปิดรูปภาพได้
- ✅ ไม่มี error "Bucket not found" อีกต่อไป

## ไฟล์ที่เกี่ยวข้อง
- `database/migration_v14_1_fix_payment_receipts_bucket.sql` (ใหม่)
- `SUPABASE_STORAGE_SETUP.md` (อัพเดทแล้ว)
- `database/migration_v14_add_payment_receipts.sql` (ต้นฉบับ)
- `app/focus/components/payment-modal.tsx`
- `app/(dashboard)/orders/[id]/page.tsx`
- `app/(dashboard)/customers/[id]/page.tsx`

## การทดสอบ
1. อัพโหลดสลิปใหม่ผ่าน Payment Modal
2. ตรวจสอบว่า thumbnail แสดงผลในหน้า Order Details
3. คลิก "ดูสลิปการโอนเงิน" เพื่อเปิดรูปภาพ
4. ตรวจสอบหน้า Payment History Modal

## หมายเหตุ
- สลิปที่อัพโหลดก่อนหน้านี้จะสามารถเข้าถึงได้ทันทีหลังแก้ไข (ไม่ต้องอัพโหลดใหม่)
- Migration นี้ปลอดภัยและสามารถรันซ้ำได้ (idempotent)
- ไม่มีผลกระทบต่อข้อมูลที่มีอยู่
