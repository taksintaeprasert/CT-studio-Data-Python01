-- =============================================
-- แก้ปัญหาการเชื่อมโยง Staff กับ Auth Account
-- รันทีละส่วนใน Supabase SQL Editor
-- =============================================

-- ขั้นตอนที่ 1: เช็คว่าคุณล็อกอินเป็นใคร
SELECT
  auth.uid() as auth_uuid_ของคุณ,
  auth.email() as email_ที่ล็อกอิน;

-- ขั้นตอนที่ 2: เช็ค Staff ID 15 (คนที่มีปัญหาลบข้อความ)
SELECT
  id,
  staff_name as ชื่อ,
  email,
  role as ตำแหน่ง,
  auth_user_id,
  CASE
    WHEN auth_user_id IS NULL THEN '❌ ยังไม่ได้เชื่อม Auth'
    ELSE '✅ เชื่อม Auth แล้ว'
  END as สถานะ
FROM staff
WHERE id = 15;

-- ขั้นตอนที่ 3: เช็คว่ามี Auth User อยู่แล้วหรือยัง
-- แทนที่ 'EMAIL_STAFF_คนนี้' ด้วย email จากขั้นตอนที่ 2
SELECT
  id as uuid_ของ_auth_user,
  email,
  created_at as สร้างเมื่อ,
  last_sign_in_at as ล็อกอินล่าสุด,
  email_confirmed_at as ยืนยัน_email_แล้ว
FROM auth.users
WHERE email = 'EMAIL_STAFF_คนนี้';

-- ขั้นตอนที่ 4: ดู Staff ทั้งหมดและสถานะ Auth
SELECT
  s.id,
  s.staff_name as ชื่อ,
  s.email,
  s.role as ตำแหน่ง,
  s.auth_user_id,
  CASE
    WHEN s.auth_user_id IS NULL THEN '❌ ยังไม่มี Auth'
    ELSE '✅ มี Auth แล้ว'
  END as สถานะ,
  au.last_sign_in_at as ล็อกอินล่าสุด
FROM staff s
LEFT JOIN auth.users au ON s.auth_user_id = au.id
WHERE s.is_active = true
ORDER BY s.id;

-- =============================================
-- วิธีแก้ไข
-- =============================================

-- กรณีที่ 1: ถ้ามี Auth User อยู่แล้ว (จากขั้นตอนที่ 3 มีข้อมูล)
-- 1. Copy UUID จากขั้นตอนที่ 3 (คอลัมน์ uuid_ของ_auth_user)
-- 2. รัน SQL นี้ (แทนที่ 'UUID_จริง' ด้วย UUID ที่ copy มา):

/*
UPDATE staff
SET auth_user_id = 'UUID_จริง'
WHERE id = 15;
*/

-- ตัวอย่าง (อย่าลืมแทนที่ด้วย UUID จริง):
-- UPDATE staff
-- SET auth_user_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
-- WHERE id = 15;


-- กรณีที่ 2: ถ้ายังไม่มี Auth User (ขั้นตอนที่ 3 ไม่มีข้อมูล)
-- ต้องสร้าง Auth Account ก่อน ผ่าน Supabase Dashboard:

/*
วิธีสร้าง Auth Account:
1. เปิด Supabase Dashboard
2. ไปที่ Authentication → Users
3. คลิก "Add user" (เพิ่มผู้ใช้)
4. กรอกข้อมูล:
   - Email: ใช้ email เดียวกับใน staff table
   - Password: ตั้งรหัสผ่าน (เช่น password123)
   - Auto Confirm User: ✅ เปิด
5. คลิก "Save"
6. Copy "User ID" (UUID) ที่แสดง
7. กลับมารัน SQL นี้:

UPDATE staff
SET auth_user_id = 'UUID_ที่_copy_มา'
WHERE id = 15;
*/

-- =============================================
-- ตรวจสอบผลลัพธ์
-- =============================================

-- รันหลังจากแก้ไขแล้ว เพื่อดูว่าถูกต้องหรือยัง:
SELECT
  s.id,
  s.staff_name as ชื่อ,
  s.email as email_staff,
  s.auth_user_id,
  au.email as email_auth,
  CASE
    WHEN s.auth_user_id IS NOT NULL AND au.id IS NOT NULL THEN '✅ เชื่อมถูกต้อง'
    WHEN s.auth_user_id IS NULL THEN '❌ ยังไม่ได้ตั้งค่า auth_user_id'
    WHEN au.id IS NULL THEN '❌ ไม่เจอ Auth User'
    ELSE '⚠️ มีปัญหาอื่น'
  END as ผลลัพธ์
FROM staff s
LEFT JOIN auth.users au ON s.auth_user_id = au.id
WHERE s.id = 15;

-- =============================================
-- ทดสอบว่าลบข้อความได้หรือยัง
-- =============================================

-- รันหลังจากเชื่อม Auth แล้ว เพื่อเช็คว่าลบข้อความได้ไหม:
SELECT
  bm.id as message_id,
  bm.sender_id,
  LEFT(bm.message_text, 50) as ข้อความ,
  (SELECT id FROM staff WHERE auth_user_id = auth.uid()) as staff_id_ปัจจุบัน,
  bm.sender_id = (SELECT id FROM staff WHERE auth_user_id = auth.uid()) as ลบได้ไหม,
  CASE
    WHEN bm.sender_id = (SELECT id FROM staff WHERE auth_user_id = auth.uid())
    THEN '✅ ลบได้'
    ELSE '❌ ลบไม่ได้'
  END as สิทธิ์การลบ
FROM booking_messages bm
WHERE bm.id = 819;

-- =============================================
-- แก้ทั้งหมดพร้อมกัน (ถ้ามี Auth User อยู่แล้ว)
-- =============================================

-- เช็คว่า Staff คนไหนบ้างที่ต้องเชื่อม Auth:
SELECT
  s.id,
  s.staff_name as ชื่อ,
  s.email,
  s.role as ตำแหน่ง,
  CASE
    WHEN s.auth_user_id IS NULL AND au.id IS NOT NULL THEN '⚠️ มี Auth แล้วแต่ยังไม่ได้เชื่อม'
    WHEN s.auth_user_id IS NULL AND au.id IS NULL THEN '❌ ต้องสร้าง Auth ใหม่'
    WHEN s.auth_user_id IS NOT NULL AND au.id IS NOT NULL THEN '✅ เชื่อมแล้ว'
    ELSE '⚠️ เชื่อมผิด (ชี้ไป auth user ที่ไม่มี)'
  END as สถานะ,
  au.id as auth_uuid_ที่มีอยู่
FROM staff s
LEFT JOIN auth.users au ON s.email = au.email
WHERE s.is_active = true
ORDER BY s.id;

-- เชื่อม Auth ทั้งหมดที่มีอยู่แล้ว (รันหลังเช็คด้านบนแล้ว):
/*
UPDATE staff s
SET auth_user_id = au.id
FROM auth.users au
WHERE s.email = au.email
  AND s.auth_user_id IS NULL
  AND s.is_active = true;

-- เช็คว่าเชื่อมสำเร็จกี่คน:
SELECT COUNT(*) as จำนวนที่เชื่อมแล้ว
FROM staff
WHERE auth_user_id IS NOT NULL AND is_active = true;
*/
