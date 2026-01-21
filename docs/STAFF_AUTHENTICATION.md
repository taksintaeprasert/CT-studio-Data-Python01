# Staff Authentication Setup Guide

> คู่มือการตั้งค่า Authentication สำหรับ Staff (ช่าง, Sales, Admin)
> Last Updated: 2026-01-21

---

## Overview

เนื่องจากระบบ role-based authentication เพิ่งถูกสร้างขึ้น ทำให้ staff ทั้งหมดที่มีอยู่ในระบบยังไม่มี account สำหรับ login ด้วยตัวเอง

Migration V10 เพิ่ม `auth_user_id` column ใน `staff` table เพื่อเชื่อมโยงกับ Supabase Authentication (`auth.users`)

---

## Architecture

### Before (เดิม)
```
staff table
├── id (INTEGER)
├── staff_name
├── email
├── role
└── is_active
```
**ปัญหา**: ไม่มี authentication, ไม่สามารถ login ได้

### After (ใหม่)
```
staff table                    auth.users (Supabase)
├── id (INTEGER)              ├── id (UUID)
├── staff_name                ├── email
├── email                     ├── encrypted_password
├── role                      └── ...
├── auth_user_id (UUID) ──────┘
└── is_active
```
**ผลลัพธ์**: แต่ละ staff มี login credentials ของตัวเอง

---

## Migration V10

### ขั้นตอนการรัน:

1. **เปิด Supabase Dashboard** → SQL Editor
2. **Copy & Paste** SQL ด้านล่าง:

```sql
-- Migration V10: Link staff with Authentication

ALTER TABLE staff
ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_staff_auth_user_id ON staff(auth_user_id);

COMMENT ON COLUMN staff.auth_user_id IS 'Link to Supabase auth.users for authentication';

-- Helper function to get current staff info
CREATE OR REPLACE FUNCTION get_staff_by_auth_user()
RETURNS TABLE (
  id INTEGER,
  staff_name VARCHAR(255),
  email VARCHAR(255),
  role VARCHAR(20),
  is_active BOOLEAN,
  auth_user_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT s.id, s.staff_name, s.email, s.role, s.is_active, s.auth_user_id
  FROM staff s
  WHERE s.auth_user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_staff_by_auth_user() TO authenticated;
```

3. **Run** (Ctrl/Cmd + Enter)

4. **Verify**:
```sql
-- Check column exists
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'staff' AND column_name = 'auth_user_id';

-- List staff without auth accounts
SELECT id, staff_name, email, role, auth_user_id
FROM staff
WHERE auth_user_id IS NULL AND is_active = true;
```

---

## วิธีสร้าง Auth Accounts

มี 2 วิธี:

### วิธีที่ 1: ใช้ API Endpoint (แนะนำ) 👍

#### 1.1 ตรวจสอบ Staff ที่ยังไม่มี Auth Account

```bash
# GET /api/staff/without-auth
curl http://localhost:3000/api/staff/without-auth
```

Response:
```json
{
  "success": true,
  "count": 5,
  "staff": [
    {
      "id": 1,
      "staff_name": "สมชาย ใจดี",
      "email": "somchai@example.com",
      "role": "artist",
      "auth_user_id": null
    },
    ...
  ]
}
```

#### 1.2 สร้าง Auth Account สำหรับ Staff

```bash
# POST /api/staff/create-auth
curl -X POST http://localhost:3000/api/staff/create-auth \
  -H "Content-Type: application/json" \
  -d '{
    "staffId": 1,
    "password": "password123"
  }'
```

Response (Success):
```json
{
  "success": true,
  "message": "Auth account created successfully",
  "staff": {
    "id": 1,
    "staff_name": "สมชาย ใจดี",
    "email": "somchai@example.com",
    "role": "artist",
    "auth_user_id": "a1b2c3d4-..."
  }
}
```

---

### วิธีที่ 2: ใช้ Supabase Dashboard (Manual)

1. **ไปที่ Supabase Dashboard** → **Authentication** → **Users**
2. **คลิก "Add user"**
3. กรอกข้อมูล:
   - Email: ใช้ email เดียวกับใน staff table
   - Password: ตั้งรหัสผ่านให้ staff
   - Auto Confirm User: ✅ เปิด
4. **Save**
5. **Copy User ID** (UUID)
6. **ไปที่ SQL Editor** และรัน:

```sql
-- Link auth user to staff
UPDATE staff
SET auth_user_id = 'USER_UUID_HERE'
WHERE email = 'staff_email@example.com';
```

---

## Environment Variables

ตรวจสอบว่ามี `.env.local` หรือ Vercel Environment Variables:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx  # ⚠️ สำคัญสำหรับสร้าง auth users
```

**หมายเหตุ**: `SUPABASE_SERVICE_ROLE_KEY` จำเป็นสำหรับ API endpoint `/api/staff/create-auth`

---

## Security Considerations

### API Access Control
- ✅ `/api/staff/create-auth` ควรมี **admin/super_admin only** middleware
- ✅ `/api/staff/without-auth` ควรมี **admin/super_admin only** middleware

### Password Policy
- ความยาวขั้นต่ำ: 6 ตัวอักษร (ปรับได้ใน Supabase Dashboard)
- แนะนำให้ใช้ password ที่แข็งแรง
- บังคับให้เปลี่ยนรหัสผ่านในการ login ครั้งแรก (optional)

### RLS Policies
```sql
-- Allow staff to read their own record
CREATE POLICY "Staff can read own record"
ON staff FOR SELECT
TO authenticated
USING (auth_user_id = auth.uid());

-- Allow staff to update their own profile
CREATE POLICY "Staff can update own profile"
ON staff FOR UPDATE
TO authenticated
USING (auth_user_id = auth.uid())
WITH CHECK (auth_user_id = auth.uid());
```

---

## Usage in Application

### Get Current Logged-in Staff

```typescript
import { createClient } from '@/lib/supabase/client'

async function getCurrentStaff() {
  const supabase = createClient()

  // Get auth user
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  // Get staff record linked to auth user
  const { data: staff } = await supabase
    .from('staff')
    .select('*')
    .eq('auth_user_id', user.id)
    .single()

  return staff
}
```

### Using Helper Function

```typescript
// Use the database function created in migration
const { data: staff } = await supabase
  .rpc('get_staff_by_auth_user')

console.log(staff) // Current logged-in staff info
```

---

## Troubleshooting

### Issue: "SUPABASE_SERVICE_ROLE_KEY is not defined"
**Solution**: เพิ่ม environment variable ใน `.env.local` หรือ Vercel Dashboard

### Issue: "Email already exists in auth system"
**Solution**: ใช้ Supabase Dashboard → Authentication → Users เพื่อเช็คและลบ duplicate user

### Issue: "Staff already has an auth account"
**Solution**: Staff นี้มี account แล้ว, ไม่ต้องสร้างใหม่

### Issue: Cannot login after creating account
**Solution**:
1. เช็คว่า `auth_user_id` ถูก link ไปยัง staff record แล้ว
2. เช็คว่า email/password ถูกต้อง
3. เช็คว่า `is_active = true` ใน staff table

---

## Next Steps

### 1. สร้าง Admin UI
- [ ] หน้า Staff Management
- [ ] ปุ่ม "Create Auth Account" สำหรับแต่ละ staff
- [ ] แสดงสถานะว่ามี auth account แล้วหรือยัง

### 2. Password Reset Flow
- [ ] ปุ่ม "Reset Password" สำหรับ admin
- [ ] Email reset password link
- [ ] First login force password change

### 3. Batch Creation
- [ ] API endpoint สำหรับสร้าง auth accounts ทั้งหมดพร้อมกัน
- [ ] Generate temporary passwords
- [ ] ส่ง email พร้อม credentials

---

## API Reference

### GET `/api/staff/without-auth`
List all staff members without auth accounts

**Response:**
```typescript
{
  success: boolean
  count: number
  staff: Array<{
    id: number
    staff_name: string
    email: string
    role: string
    auth_user_id: null
  }>
}
```

---

### POST `/api/staff/create-auth`
Create auth account for a staff member

**Request Body:**
```typescript
{
  staffId: number
  password: string  // min 6 characters
}
```

**Response:**
```typescript
{
  success: boolean
  message: string
  staff: {
    id: number
    staff_name: string
    email: string
    role: string
    auth_user_id: string  // UUID
  }
}
```

**Error Responses:**
- `400`: Missing staffId or password
- `400`: Password too short
- `400`: Staff already has auth account
- `400`: Email already exists in auth system
- `404`: Staff not found
- `500`: Internal server error

---

## References

- [Supabase Auth Admin](https://supabase.com/docs/reference/javascript/auth-admin-api)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- Main project handoff: `HANDOFF_BRIEF.md`
