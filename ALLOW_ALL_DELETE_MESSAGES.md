# การอนุญาตให้ทุก Account ลบข้อความและรูปภาพใน Booking Chat

## สรุปการเปลี่ยนแปลง

การเปลี่ยนแปลงนี้ทำให้ทุก account ที่ authenticated สามารถลบข้อความหรือรูปภาพใด ๆ ใน booking chat ได้ ไม่ใช่เฉพาะข้อความของตัวเองเท่านั้น

## ไฟล์ที่แก้ไข

### 1. Frontend: `app/focus/components/booking-chat-box.tsx`

#### การเปลี่ยนแปลงที่ 1: ลบการตรวจสอบ sender_id (บรรทัด 237-242)
**ก่อนแก้ไข:**
```typescript
// Only the sender can delete their own message
if (msg.sender_id !== user?.id) {
  console.log('[handleDeleteMessage] User is not the sender')
  alert('คุณสามารถลบได้เฉพาะข้อความของคุณเองเท่านั้น')
  return
}
```

**หลังแก้ไข:**
```typescript
// Allow any authenticated user to delete any message
```

#### การเปลี่ยนแปลงที่ 2: แสดงปุ่มลบสำหรับทุกข้อความ (บรรทัด 437)
**ก่อนแก้ไข:**
```typescript
{/* Delete button - only shown to message sender */}
{msg.sender_id === user?.id && (
  <button onClick={() => handleDeleteMessage(msg)}>
    ลบ
  </button>
)}
```

**หลังแก้ไข:**
```typescript
{/* Delete button - shown for all non-system messages */}
<button onClick={() => handleDeleteMessage(msg)}>
  ลบ
</button>
```

### 2. Database: `database/migration_v21_allow_all_delete_booking_messages.sql`

สร้าง migration file ใหม่เพื่ออัปเดต RLS policy

**ก่อนหน้า (migration_v20):**
```sql
CREATE POLICY "Users can delete their own booking messages"
ON booking_messages FOR DELETE
TO authenticated
USING (
  sender_id = (SELECT id FROM staff WHERE auth_user_id = auth.uid())
);
```

**ใหม่ (migration_v21):**
```sql
CREATE POLICY "Authenticated users can delete any booking message"
ON booking_messages FOR DELETE
TO authenticated
USING (true);
```

## ข้อจำกัดที่ยังคงอยู่

1. **ข้อความระบบ (System Messages):** ไม่สามารถลบได้ โดยการตรวจสอบใน frontend
2. **ต้อง Authenticated:** ต้องเป็นผู้ใช้ที่ล็อกอินแล้วเท่านั้น
3. **ยืนยันการลบ:** ต้องกดยืนยันใน confirm dialog ก่อนลบ

## การใช้งาน Migration

ในการ apply migration นี้ไปยัง database จริง ให้รัน SQL script ดังนี้:

```bash
# ถ้าใช้ Supabase CLI
supabase db push

# หรือรัน SQL โดยตรงผ่าน Supabase Dashboard
# SQL Editor > New query > วาง code จาก migration_v21_allow_all_delete_booking_messages.sql > Run
```

## การทดสอบ

1. เข้าสู่ระบบด้วย account ใดก็ได้
2. เปิด booking chat ที่มีข้อความจากคนอื่น
3. ควรเห็นปุ่ม "ลบ" สำหรับทุกข้อความ (ยกเว้นข้อความระบบ)
4. กดปุ่มลบและยืนยัน ข้อความควรถูกลบได้สำเร็จ

## ข้อควรระวัง

การเปลี่ยนแปลงนี้ทำให้ทุกคนสามารถลบข้อความของคนอื่นได้ ควรพิจารณา:
- ผลกระทบต่อการติดตามประวัติการสื่อสาร
- ความจำเป็นในการเก็บ log การลบข้อความ
- การ train staff ให้ใช้ feature นี้อย่างรับผิดชอบ
