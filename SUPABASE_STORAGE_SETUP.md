# Supabase Storage Setup Guide

## Payment Receipts Storage Bucket

หากคุณพบข้อผิดพลาด "Bucket not found" เมื่อพยายามดูสลิปการโอนเงิน ให้ทำตามขั้นตอนด้านล่างนี้เพื่อสร้าง Storage Bucket ใน Supabase

### ขั้นตอนการตั้งค่า

1. **เข้าสู่ Supabase Dashboard**
   - ไปที่ [https://supabase.com/dashboard](https://supabase.com/dashboard)
   - เลือก Project ของคุณ

2. **สร้าง Storage Bucket**
   - คลิกที่ "Storage" ในเมนูด้านซ้าย
   - คลิกปุ่ม "New bucket"
   - ตั้งค่าดังนี้:
     - **Name**: `payment-receipts`
     - **Public bucket**: เปิด (ON) - เพื่อให้สามารถเข้าถึงรูปภาพได้โดยตรง
     - **File size limit**: 5 MB (หรือตามต้องการ)
     - **Allowed MIME types**: `image/*`
   - คลิก "Create bucket"

3. **ตั้งค่า Storage Policies (RLS)**

   หลังจากสร้าง bucket แล้ว คุณต้องตั้งค่า Row Level Security (RLS) policies:

   #### Policy 1: Allow public to view receipts
   ```sql
   CREATE POLICY "Public can view payment receipts"
   ON storage.objects FOR SELECT
   USING (bucket_id = 'payment-receipts');
   ```

   #### Policy 2: Allow authenticated users to upload receipts
   ```sql
   CREATE POLICY "Authenticated users can upload payment receipts"
   ON storage.objects FOR INSERT
   WITH CHECK (
     bucket_id = 'payment-receipts'
     AND auth.role() = 'authenticated'
   );
   ```

   #### Policy 3: Allow authenticated users to delete receipts
   ```sql
   CREATE POLICY "Authenticated users can delete payment receipts"
   ON storage.objects FOR DELETE
   USING (
     bucket_id = 'payment-receipts'
     AND auth.role() = 'authenticated'
   );
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

#### ปัญหา: "Bucket not found"
- ✅ ตรวจสอบว่าได้สร้าง bucket ชื่อ `payment-receipts` แล้ว
- ✅ ตรวจสอบว่า bucket เป็น public bucket
- ✅ ตรวจสอบว่าได้ตั้งค่า RLS policies ถูกต้องแล้ว

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
