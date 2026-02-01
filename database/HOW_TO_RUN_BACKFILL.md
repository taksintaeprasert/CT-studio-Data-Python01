# วิธีรันสคริปต์แก้ไข Order เก่าให้ถูกนับ

## ปัญหา
Order ที่สร้างก่อนหน้านี้ไม่ถูกนับในสถิติต่างๆ เพราะขาด timestamp ของ `artist_completed_at` และ `sales_completed_at`

## วิธีแก้ไข

### ขั้นตอนที่ 1: เปิด Supabase SQL Editor
1. ไปที่ [Supabase Dashboard](https://supabase.com/dashboard)
2. เลือกโปรเจกต์ของคุณ
3. คลิกที่ **SQL Editor** ในเมนูด้านซ้าย

### ขั้นตอนที่ 2: รันสคริปต์ Backfill
1. เปิดไฟล์ `database/backfill_order_completion_timestamps.sql`
2. **Copy ทั้งหมด** แล้ว paste ใน SQL Editor
3. คลิก **Run** หรือกด `Ctrl+Enter`

### ขั้นตอนที่ 3: ตรวจสอบผลลัพธ์
สคริปต์จะแสดง:

#### 📊 สถิติก่อนแก้ (BEFORE FIX)
```
status      | total_completed_items | has_artist_timestamp | has_sales_timestamp | has_both_timestamps | missing_timestamps
------------|-----------------------|----------------------|---------------------|---------------------|--------------------
BEFORE FIX  | 150                   | 30                   | 50                  | 20                  | 130
```

#### 📊 สถิติหลังแก้ (AFTER FIX)
```
status      | total_completed_items | has_artist_timestamp | has_sales_timestamp | has_both_timestamps | missing_timestamps
------------|-----------------------|----------------------|---------------------|---------------------|--------------------
AFTER FIX   | 150                   | 150                  | 150                 | 150                 | 0
```

✅ **missing_timestamps ต้องเป็น 0** = แก้สำเร็จ!

#### 📋 ตัวอย่าง Records ที่แก้ไข
สคริปต์จะแสดง 30 รายการล่าสุดพร้อมข้อมูล:
- Order ID
- ชื่อบริการ (booking_title)
- สถานะ (item_status)
- ช่าง (artist_name)
- วันนัด (appointment_date)
- ⭐ **artist_completed_at** (จะมีค่าแล้ว)
- ⭐ **sales_completed_at** (จะมีค่าแล้ว)

### ขั้นตอนที่ 4 (ถ้าจำเป็น): อัพเดท Order Status
Query สุดท้ายจะแสดง **Order ที่ควรเป็น 'done'** แต่ยังไม่ได้เปลี่ยน status

ถ้าต้องการเปลี่ยน order_status เป็น 'done' ทั้งหมด ให้รัน:

```sql
-- อัพเดท Order ที่บริการทำเสร็จหมดแล้วให้เป็น 'done'
UPDATE orders
SET order_status = 'done'
WHERE id IN (
  SELECT o.id
  FROM orders o
  LEFT JOIN order_items oi ON oi.order_id = o.id
  WHERE o.order_status IN ('booking', 'active', 'paid')
  GROUP BY o.id
  HAVING COUNT(oi.id) > 0
     AND COUNT(oi.id) = COUNT(*) FILTER (
       WHERE oi.item_status = 'completed'
       AND oi.artist_completed_at IS NOT NULL
       AND oi.sales_completed_at IS NOT NULL
     )
);
```

## ผลลัพธ์ที่คาดหวัง

หลังรันสคริปต์แล้ว Order เก่าจะ:
- ✅ ถูกนับในสถิติ Dashboard
- ✅ ถูกนับในประสิทธิภาพของเซลส์ (Sales Performance)
- ✅ ถูกนับในประสิทธิภาพของช่าง (Artist Performance)
- ✅ ถูกคำนวณค่าคอมมิชชั่นให้ช่าง
- ✅ ถูกนับในจำนวนบริการที่ทำสำเร็จ

## หมายเหตุ

### การตั้งค่า Timestamp
สคริปต์จะตั้งค่า timestamp ดังนี้:

**artist_completed_at:**
- ถ้ามี sales_completed_at อยู่แล้ว → ใช้เวลาก่อนหน้า 1 ชั่วโมง (เพราะช่างมักทำเสร็จก่อนเซลส์ยืนยัน)
- ถ้าไม่มี → ใช้เวลาจาก `updated_at`
- ถ้าไม่มีทั้ง 2 → ใช้เวลาปัจจุบัน

**sales_completed_at:**
- ใช้เวลาจาก `updated_at`
- ถ้าไม่มี → ใช้เวลาปัจจุบัน

### ความปลอดภัย
- ✅ สคริปต์จะ**อัพเดทเฉพาะ** records ที่มี `item_status = 'completed'` เท่านั้น
- ✅ **ไม่ลบข้อมูล** ใดๆ
- ✅ ไม่กระทบต่อ Order ใหม่ที่มี timestamp อยู่แล้ว
- ✅ สามารถรันซ้ำได้โดยไม่เกิดปัญหา (idempotent)

## วิธีตรวจสอบว่าใช้งานได้

### ตรวจสอบที่ Dashboard
1. ไปที่หน้า Dashboard
2. ดูสถิติ "งานที่เสร็จแล้ว" (Done) → ตัวเลขควรเพิ่มขึ้น
3. ดูสถิติ "กำลังดำเนินการ" (Ongoing) → ตัวเลขควรลดลง

### ตรวจสอบที่ Sales Performance
1. ไปที่หน้า Sales
2. เลือกช่วงเวลาที่มี Order เก่า
3. ดูจำนวน "งานที่เสร็จแล้ว" (Completed Orders) → ควรเพิ่มขึ้น

### ตรวจสอบที่ Artist Performance
1. ไปที่หน้า Artist
2. เลือกช่างที่ทำงานเสร็จแล้ว
3. ดูจำนวน "บริการที่ทำเสร็จ" (Completed Services) → ควรเพิ่มขึ้น
4. ดู "ค่าคอมมิชชั่น" (Total Commission) → ควรเพิ่มขึ้น

## คำถามที่พบบ่อย

### Q: ต้องรันทุกครั้งที่มี Order ใหม่หรือไม่?
A: **ไม่ต้อง** - Order ใหม่ที่สร้างหลังจาก Migration V17 จะมี timestamp อัตโนมัติแล้ว สคริปต์นี้แก้เฉพาะ Order เก่าเท่านั้น

### Q: รันซ้ำได้ไหม?
A: **ได้** - สคริปต์จะอัพเดทเฉพาะ records ที่ขาด timestamp เท่านั้น ถ้ารันซ้ำจะไม่เปลี่ยนแปลงอะไร

### Q: ข้อมูลเดิมจะหายไหม?
A: **ไม่หาย** - สคริปต์เพิ่มข้อมูลเท่านั้น ไม่ลบหรือแก้ไขข้อมูลที่มีอยู่แล้ว

### Q: ถ้าไม่แน่ใจจะทำยังไง?
A: **ทดสอบก่อน** - รัน SELECT queries ส่วนแรกก่อนเพื่อดูจำนวน records ที่จะถูกแก้:

```sql
-- ดูว่ามีกี่ records ที่จะถูกแก้
SELECT COUNT(*) as will_be_fixed
FROM order_items
WHERE item_status = 'completed'
  AND (artist_completed_at IS NULL OR sales_completed_at IS NULL);
```

## การติดต่อขอความช่วยเหลือ

หากพบปัญหาหรือมีคำถาม กรุณาติดต่อทีมพัฒนาพร้อม:
1. Screenshot ของ error message (ถ้ามี)
2. ผลลัพธ์จาก BEFORE/AFTER statistics
3. จำนวน records ที่คาดว่าจะถูกแก้
