# คู่มือแก้ปัญหาการลบรูปภาพ (Photo Deletion Debugging Guide)

## ปัญหา: กดปุ่มลบแล้วรูปไม่หาย

หากคุณพบปัญหาที่กดปุ่มลบแล้วรูปภาพไม่ถูกลบออก ให้ทำตามขั้นตอนด้านล่างนี้

---

## ขั้นตอนที่ 1: ตรวจสอบ Browser Console

1. **เปิด Developer Console**
   - Chrome/Edge: กด `F12` หรือ `Ctrl+Shift+I` (Windows) / `Cmd+Option+I` (Mac)
   - Firefox: กด `F12`
   - Safari: เปิด Develop menu → Show Web Inspector

2. **ดู Console Log**
   - เมื่อคุณกดปุ่มลบ คุณควรเห็น log messages แบบนี้:
   ```
   [handleDeletePhoto] Attempting to delete photo id: 123
   [handleDeletePhoto] User confirmed, calling deleteServicePhoto
   [deleteServicePhoto] Starting deletion for photoId: 123
   [deleteServicePhoto] Found photo with path: customer_456/before_1234567890.jpg
   [deleteServicePhoto] Successfully deleted from storage
   [deleteServicePhoto] Successfully deleted from database
   [handleDeletePhoto] Result: {success: true}
   [handleDeletePhoto] Deletion successful, reloading photos
   ```

3. **หาข้อผิดพลาด**
   - หากเห็น **error messages สีแดง** → บันทึกข้อความ error แล้วไปขั้นตอนที่ 2
   - หากเห็น `Photo not found` → ปัญหาอยู่ที่ RLS policies (ไปขั้นตอนที่ 3)
   - หากเห็น `Database error` → ปัญหาอยู่ที่ permissions (ไปขั้นตอนที่ 3)
   - หากไม่มี log อะไรเลย → JavaScript error (ไปขั้นตอนที่ 4)

---

## ขั้นตอนที่ 2: ตรวจสอบ Error Messages

### Error: "Photo not found"
**สาเหตุ:** User ไม่มีสิทธิ์ SELECT ข้อมูลจากตาราง `service_photos`

**แก้ไข:** รัน SQL script เพื่อแก้ไข RLS policies:
```sql
-- ไปที่ Supabase Dashboard → SQL Editor
-- รันไฟล์: database/verify_and_fix_photo_deletion_policies.sql
```

### Error: "Database error: ..."
**สาเหตุ:** User ไม่มีสิทธิ์ DELETE ข้อมูลจากตาราง `service_photos`

**แก้ไข:** รัน SQL script เพื่อแก้ไข RLS policies (เหมือนข้างบน)

### Error: "Storage delete error"
**สาเหตุ:** User ไม่มีสิทธิ์ลบไฟล์จาก Storage bucket

**แก้ไข:**
1. ไปที่ Supabase Dashboard → Storage → service-photos
2. ตรวจสอบ Policies tab
3. ต้องมี DELETE policy ที่อนุญาต authenticated users

---

## ขั้นตอนที่ 3: แก้ไข RLS Policies

1. **เข้า Supabase Dashboard**
   - ไปที่ SQL Editor

2. **รัน Verification Script**
   ```bash
   # เปิดไฟล์ database/verify_and_fix_photo_deletion_policies.sql
   # Copy ทั้งหมดแล้ว paste ใน SQL Editor
   # กด Run
   ```

3. **ตรวจสอบผลลัพธ์**
   - ตอนจบ script จะแสดง policies ที่สร้างขึ้นใหม่
   - ต้องเห็น policies สำหรับ SELECT, INSERT, UPDATE, DELETE

---

## ขั้นตอนที่ 4: ตรวจสอบ Authentication

1. **ตรวจสอบว่า User Login แล้วหรือยัง**
   ```javascript
   // เปิด Console แล้วพิมพ์:
   const { data } = await supabase.auth.getSession()
   console.log(data.session)
   ```
   - ถ้า session เป็น `null` → ต้อง login ใหม่
   - ถ้ามี session → ตรวจสอบ `data.session.user.id`

2. **ตรวจสอบว่า User มี staff record**
   ```javascript
   // ตรวจสอบว่ามี staff record หรือไม่
   const { data } = await supabase.from('staff').select('*').eq('auth_user_id', session.user.id).single()
   console.log(data)
   ```

---

## ขั้นตอนที่ 5: ทดสอบการลบแบบ Manual

ลองลบจาก Database โดยตรง:

```sql
-- ไปที่ Supabase Dashboard → SQL Editor
-- แทนที่ 123 ด้วย photo id จริง
DELETE FROM service_photos WHERE id = 123;
```

- **ถ้าลบได้** → ปัญหาอยู่ที่ code ไม่ใช่ database
- **ถ้าลบไม่ได้** → ปัญหาอยู่ที่ RLS policies

---

## ขั้นตอนที่ 6: ล้าง Cache และ Reload

บางครั้งรูปภาพถูกลบแล้วแต่ browser cache ทำให้ยังเห็นอยู่:

1. **Hard Reload**
   - Windows: `Ctrl + Shift + R`
   - Mac: `Cmd + Shift + R`

2. **ล้าง Browser Cache**
   - Chrome: Settings → Privacy and security → Clear browsing data
   - เลือก "Cached images and files"

---

## สาเหตุที่พบบ่อย

### 1. RLS Policies ไม่ได้ถูก Apply
**อาการ:** เห็น error "Photo not found" หรือ "permission denied"
**แก้ไข:** รัน `verify_and_fix_photo_deletion_policies.sql`

### 2. Storage Bucket Policies ไม่ถูกต้อง
**อาการ:** เห็น "Storage delete error" แต่ database deletion สำเร็จ
**แก้ไข:** ไปที่ Storage → service-photos → Policies → เพิ่ม DELETE policy

### 3. User ไม่ได้ Login
**อาการ:** ไม่เห็นปุ่มลบเลย หรือกดแล้วไม่มีอะไรเกิดขึ้น
**แก้ไข:** Login ใหม่

### 4. Browser Cache
**อาการ:** เห็น success message แต่รูปยังอยู่
**แก้ไข:** Hard reload (Ctrl+Shift+R)

---

## ติดต่อ Support

หากลองทุกวิธีแล้วยังแก้ไม่ได้:

1. **Screenshot Console Errors**
   - เปิด Console (F12)
   - Screenshot ข้อความ error ทั้งหมด

2. **บันทึกข้อมูล**
   - Photo ID ที่พยายามลบ
   - User ID ที่กำลัง login
   - Error messages จาก console

3. **ส่งรายละเอียดให้ Developer**

---

## Technical Details

### การลบรูปทำงาน 2 ขั้นตอน:

1. **ลบไฟล์จาก Supabase Storage**
   - Bucket: `service-photos`
   - Path: `customer_{customerId}/{fileName}`
   - ต้องมี DELETE policy

2. **ลบ record จาก Database**
   - Table: `service_photos`
   - ต้องมี DELETE policy สำหรับ authenticated users

### ตำแหน่งไฟล์ Code:

- **Customer Photos Manager:** `/components/customer-photos-manager.tsx`
- **Delete Function:** `/lib/storage/photos.ts` (function: `deleteServicePhoto`)
- **Booking Chat Delete:** `/app/focus/components/booking-chat-box.tsx`

### RLS Policies ที่จำเป็น:

**service_photos table:**
- ✅ SELECT policy (อ่านข้อมูล)
- ✅ DELETE policy (ลบข้อมูล)

**storage.objects:**
- ✅ SELECT policy for bucket 'service-photos'
- ✅ DELETE policy for bucket 'service-photos'
