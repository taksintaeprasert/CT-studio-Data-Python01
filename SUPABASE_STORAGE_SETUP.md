# Supabase Storage Setup Guide

## Payment Receipts Storage Bucket

หากคุณพบข้อผิดพลาด "Bucket not found" เมื่อพยายามดูสลิปการโอนเงิน (Payment Slip Thumbnails) มีสองวิธีในการแก้ไข:

### วิธีที่ 1: รัน Migration Script (แนะนำ)

**สำหรับผู้ที่เคยรัน migration_v14 ไปแล้ว:**

1. เข้าสู่ Supabase SQL Editor
2. รันไฟล์ `database/migration_v14_1_fix_payment_receipts_bucket.sql`
3. ตรวจสอบว่า bucket เป็น public แล้ว:
   ```sql
   SELECT id, name, public FROM storage.buckets WHERE id = 'payment-receipts';
   -- Expected: public = true
   ```

**สำหรับผู้ที่ยังไม่เคยรัน migration:**

1. รันไฟล์ `database/migration_v14_add_payment_receipts.sql` ก่อน
2. จากนั้นรันไฟล์ `database/migration_v14_1_fix_payment_receipts_bucket.sql`

### วิธีที่ 2: ตั้งค่าด้วยตนเองผ่าน Dashboard

1. **เข้าสู่ Supabase Dashboard**
   - ไปที่ [https://supabase.com/dashboard](https://supabase.com/dashboard)
   - เลือก Project ของคุณ

2. **สร้างหรืออัพเดท Storage Bucket**
   - คลิกที่ "Storage" ในเมนูด้านซ้าย
   - ถ้ามี bucket `payment-receipts` อยู่แล้ว:
     - คลิกที่ bucket
     - ไปที่ "Settings" → ตั้งค่า **Public bucket: ON**
   - ถ้ายังไม่มี bucket ให้คลิก "New bucket" และตั้งค่าดังนี้:
     - **Name**: `payment-receipts`
     - **Public bucket**: เปิด (ON) - **สำคัญมาก!** เพื่อให้ getPublicUrl() ทำงานได้
     - **File size limit**: 5 MB (หรือตามต้องการ)
     - **Allowed MIME types**: `image/*`
   - คลิก "Create bucket" หรือ "Save"

3. **ตั้งค่า Storage Policies (RLS)**

   หลังจากสร้าง bucket แล้ว คุณต้องตั้งค่า Row Level Security (RLS) policies:

   ไปที่ **SQL Editor** และรัน SQL ด้านล่างนี้:

   #### Policy 1: Allow public to view receipts (สำคัญมาก!)
   ```sql
   CREATE POLICY "Public can view payment receipts"
   ON storage.objects FOR SELECT
   TO public
   USING (bucket_id = 'payment-receipts');
   ```
   **หมายเหตุ:** Policy นี้จำเป็นต้องใช้ `TO public` เพื่อให้ thumbnail แสดงผลได้โดยไม่ต้อง authentication

   #### Policy 2: Allow authenticated users to upload receipts
   ```sql
   CREATE POLICY "Authenticated users can upload payment receipts"
   ON storage.objects FOR INSERT
   TO authenticated
   WITH CHECK (bucket_id = 'payment-receipts');
   ```

   #### Policy 3: Allow authenticated users to update receipts
   ```sql
   CREATE POLICY "Authenticated users can update payment receipts"
   ON storage.objects FOR UPDATE
   TO authenticated
   USING (bucket_id = 'payment-receipts');
   ```

   #### Policy 4: Allow authenticated users to delete receipts
   ```sql
   CREATE POLICY "Authenticated users can delete payment receipts"
   ON storage.objects FOR DELETE
   TO authenticated
   USING (bucket_id = 'payment-receipts');
   ```

4. **ทดสอบการทำงาน**
   - ไปที่หน้า "Appointments" (Service Page)
   - เลือก booking และคลิก "รับชำระเงิน"
   - อัพโหลดรูปสลิปการโอนเงิน
   - บันทึกการชำระเงิน
   - ตรวจสอบว่าสามารถคลิก "ดูสลิปการโอนเงิน" ได้โดยไม่มี error

### โครงสร้างไฟล์ใน Bucket

ระบบจะจัดเก็บไฟล์ตามรูปแบบ:
```
payment-receipts/
├── {order_id}/
│   ├── {timestamp}_{filename}.jpg
│   ├── {timestamp}_{filename}.png
│   └── ...
```

ตัวอย่าง:
```
payment-receipts/
├── 123/
│   ├── 1704067200000_slip.jpg
│   └── 1704153600000_receipt.png
└── 456/
    └── 1704240000000_payment.jpg
```

### การแก้ปัญหา

#### ปัญหา: "Bucket not found" (404 Error)
**สาเหตุ:** Bucket เป็น private แต่โค้ดใช้ `getPublicUrl()` ที่ต้องการ public bucket

**วิธีแก้:**
1. ✅ ตรวจสอบว่าได้สร้าง bucket ชื่อ `payment-receipts` แล้ว
   ```sql
   SELECT id, name, public FROM storage.buckets WHERE id = 'payment-receipts';
   ```
2. ✅ **สำคัญที่สุด!** ตรวจสอบว่า bucket เป็น **public bucket** (`public = true`)
   - ถ้ายัง `public = false` ให้รัน migration `migration_v14_1_fix_payment_receipts_bucket.sql`
   - หรือแก้ในหน้า Dashboard: Storage → payment-receipts → Settings → Public bucket: ON
3. ✅ ตรวจสอบว่าได้ตั้งค่า RLS policy "Public can view payment receipts" แล้ว
   ```sql
   SELECT policyname, cmd, roles
   FROM pg_policies
   WHERE tablename = 'objects'
     AND policyname = 'Public can view payment receipts';
   ```

#### ปัญหา: "Access denied" หรือ "Permission denied"
- ✅ ตรวจสอบ RLS policies ว่าได้ตั้งค่าถูกต้องหรือไม่
- ✅ ตรวจสอบว่าผู้ใช้ได้ login และมี authentication token

#### ปัญหา: "File size too large"
- ✅ ตรวจสอบขนาดไฟล์ (ต้องไม่เกิน 5MB)
- ✅ ปรับขนาดรูปภาพก่อนอัพโหลด

### หมายเหตุ

- ระบบจะตรวจสอบไฟล์ก่อนอัพโหลด (เฉพาะไฟล์รูปภาพ, ขนาดไม่เกิน 5MB)
- สลิปจะถูกจัดเก็บตาม order_id เพื่อความเป็นระเบียบ
- การลบ payment record จะไม่ลบไฟล์สลิปออกจาก storage โดยอัตโนมัติ (ต้องลบด้วยตนเอง)

### ข้อมูลเพิ่มเติม

สำหรับข้อมูลเพิ่มเติมเกี่ยว Supabase Storage:
- [Supabase Storage Documentation](https://supabase.com/docs/guides/storage)
- [Storage Policies](https://supabase.com/docs/guides/storage/security/access-control)
