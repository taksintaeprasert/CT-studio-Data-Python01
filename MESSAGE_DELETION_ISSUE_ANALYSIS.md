# Message Deletion Issue - Analysis & Solution

> Issue Date: 2026-02-10
> Branch: `claude/read-handoff-brief-YYzJo`
> Affected Component: Booking Chat Message Deletion

---

## Issue Summary

Message deletion in the booking chat system fails silently - the file is deleted from storage, but the database record remains. This occurs due to Row Level Security (RLS) policy blocking the deletion.

---

## Evidence

### Screenshot 1: Debug Query Result
```
id: 819
sender_id: 15
current_staff: NULL
can_delete: NULL
```

### Screenshot 2: Console Logs
```
[handleDeleteMessage] User confirmed deletion
[handleDeleteMessage] Message has file, extracting path from URL
[handleDeleteMessage] Successfully deleted file
[handleDeleteMessage] Deleting message from database, message ID: 819
[handleDeleteMessage] Delete result - data: [ ] count: null
[handleDeleteMessage] Successfully deleted message, reloading
```

**Key Observation**: File deletion succeeds, but database deletion returns `count: null` (0 rows affected).

---

## Root Cause Analysis

### 1. RLS Policy Configuration

From `database/migration_v20_booking_messages_delete.sql`:
```sql
CREATE POLICY "Users can delete their own booking messages"
ON booking_messages FOR DELETE
TO authenticated
USING (
  sender_id = (SELECT id FROM staff WHERE auth_user_id = auth.uid())
);
```

**The Policy Requires:**
- Current authenticated user's `auth.uid()` must map to a `staff.id`
- That `staff.id` must match the message's `sender_id`

### 2. The Problem

When the debug query returns NULL for both `current_staff` and `can_delete`:

```sql
SELECT
  bm.sender_id,
  (SELECT id FROM staff WHERE auth_user_id = auth.uid()) as current_staff_id,
  bm.sender_id = (SELECT id FROM staff WHERE auth_user_id = auth.uid()) as can_delete
FROM booking_messages bm
WHERE bm.id = 819;

-- Result:
-- sender_id: 15
-- current_staff_id: NULL  ❌
-- can_delete: NULL         ❌
```

This means: `(SELECT id FROM staff WHERE auth_user_id = auth.uid())` returns NULL

### 3. Why This Happens

There are three possible scenarios:

#### Scenario A: User Not Authenticated
- `auth.uid()` returns NULL
- No valid auth session exists

#### Scenario B: auth_user_id Not Set (Most Likely)
- Staff ID 15 exists in the database
- But `staff.auth_user_id` is NULL for this staff member
- The staff account hasn't been linked to Supabase Auth yet

#### Scenario C: Wrong Auth Session
- User is logged in as a different staff member
- Their `auth_user_id` doesn't match sender_id = 15

---

## Technical Flow

### Current Implementation

**Frontend** (`app/focus/components/booking-chat-box.tsx:227-299`):
```typescript
const handleDeleteMessage = async (msg: MessageWithSender) => {
  // ✅ Check 1: Cannot delete system messages
  if (msg.sender_type === 'system') return;

  // ✅ Check 2: Must be the sender (frontend check)
  if (msg.sender_id !== user?.id) return;

  // ✅ Delete file from storage
  if (msg.message_type === 'file' && msg.file_url) {
    await supabase.storage.from('service-photos').remove([filePath]);
  }

  // ❌ Delete from database (blocked by RLS)
  const { data, error, count } = await supabase
    .from('booking_messages')
    .delete()
    .eq('id', msg.id)
    .select();

  // Returns count: null (no rows deleted)
}
```

**Database RLS Check**:
```sql
-- For each DELETE attempt, PostgreSQL evaluates:
WHERE sender_id = (SELECT id FROM staff WHERE auth_user_id = auth.uid())

-- If auth_user_id is NULL for this staff:
WHERE 15 = NULL  -- Always FALSE → DELETE blocked
```

---

## Impact

### User Experience
1. ✅ File is deleted from storage (no orphaned files)
2. ❌ Message still appears in chat
3. ❌ User sees "Successfully deleted" but message remains
4. ❌ Confusing behavior - appears to work but doesn't

### Data Integrity
- Storage and database become out of sync
- Orphaned file URLs in message records

---

## Solutions

### Solution 1: Link Staff to Auth (Recommended) ✅

**Fix the root cause** by ensuring all staff members have `auth_user_id` set.

#### Step 1: Check which staff lack auth_user_id
```sql
-- Run in Supabase SQL Editor
SELECT id, staff_name, email, role, auth_user_id
FROM staff
WHERE is_active = true
ORDER BY id;
```

#### Step 2: Check staff ID 15 specifically
```sql
SELECT id, staff_name, email, role, auth_user_id
FROM staff
WHERE id = 15;
```

#### Step 3: Verify current auth session
```sql
SELECT
  auth.uid() as current_auth_uid,
  s.id as staff_id,
  s.staff_name,
  s.email,
  s.role
FROM staff s
WHERE s.auth_user_id = auth.uid();
```

#### Step 4: Create auth account for staff
Follow the guide in `docs/STAFF_AUTHENTICATION.md`:

**Using API** (if available):
```bash
curl -X POST http://localhost:3000/api/staff/create-auth \
  -H "Content-Type: application/json" \
  -d '{
    "staffId": 15,
    "password": "secure_password_here"
  }'
```

**Or manually in Supabase Dashboard**:
1. Authentication → Users → Add user
2. Use staff's email and set password
3. Copy the created User ID (UUID)
4. Run SQL:
```sql
UPDATE staff
SET auth_user_id = 'USER_UUID_HERE'
WHERE id = 15;
```

---

### Solution 2: Alternative RLS Policy (If Solution 1 is Not Feasible)

If you cannot set up auth accounts immediately, consider a more permissive policy:

```sql
-- Drop existing policy
DROP POLICY IF EXISTS "Users can delete their own booking messages" ON booking_messages;

-- Option A: Allow deletion based on current user context (using user context)
CREATE POLICY "Users can delete their own booking messages"
ON booking_messages FOR DELETE
TO authenticated
USING (
  sender_id IN (
    SELECT id FROM staff WHERE auth_user_id = auth.uid()
  )
  OR
  -- Fallback: Allow if user context matches sender_id
  sender_id = current_setting('app.current_staff_id', true)::INTEGER
);

-- Option B: Allow any authenticated user to delete non-system messages
-- ⚠️ WARNING: Less secure - only use temporarily
CREATE POLICY "Authenticated users can delete non-system messages"
ON booking_messages FOR DELETE
TO authenticated
USING (sender_type != 'system');
```

**Trade-offs**:
- Option A: Requires setting user context in application
- Option B: Less secure - any logged-in user can delete any message

---

### Solution 3: Service Role Bypass (Temporary Workaround)

Use service role key to bypass RLS for deletion:

```typescript
// Create a server-side API endpoint
// app/api/messages/delete/route.ts

import { createClient } from '@supabase/supabase-js'

export async function DELETE(request: Request) {
  const { messageId, staffId } = await request.json()

  // Create admin client with service role
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // Bypasses RLS
  )

  // Verify ownership
  const { data: message } = await supabase
    .from('booking_messages')
    .select('sender_id, message_type, file_url')
    .eq('id', messageId)
    .single()

  if (!message || message.sender_id !== staffId) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 })
  }

  // Delete file if exists
  if (message.message_type === 'file' && message.file_url) {
    const filePath = message.file_url.split('/service-photos/')[1]
    await supabase.storage.from('service-photos').remove([filePath])
  }

  // Delete message (bypasses RLS)
  const { error } = await supabase
    .from('booking_messages')
    .delete()
    .eq('id', messageId)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ success: true })
}
```

**Trade-offs**:
- ✅ Works immediately without auth setup
- ❌ Requires API endpoint
- ❌ Bypasses security (must implement own checks)
- ❌ Not the proper long-term solution

---

## Recommended Action Plan

### Phase 1: Immediate Fix (Today)
1. ✅ Run debug queries to identify staff without auth_user_id
2. ✅ Create auth accounts for active staff members
3. ✅ Test message deletion with proper auth

### Phase 2: Verify & Test (This Week)
1. Test message deletion for different staff members
2. Verify RLS policy works correctly
3. Add better error messaging in frontend
4. Add logging for RLS policy failures

### Phase 3: Long-term Improvements
1. Add authentication status check on app load
2. Display warning if staff lacks auth account
3. Create admin UI for managing staff auth accounts
4. Add comprehensive error handling for RLS failures

---

## Testing Checklist

After implementing Solution 1:

- [ ] Staff ID 15 has auth_user_id set
- [ ] Can log in as staff ID 15
- [ ] Debug query returns valid current_staff_id and can_delete = true
- [ ] Can successfully delete own messages
- [ ] Cannot delete other staff's messages
- [ ] Cannot delete system messages
- [ ] File is deleted from storage
- [ ] Message is deleted from database
- [ ] UI updates correctly after deletion

---

## Related Files

- `app/focus/components/booking-chat-box.tsx` - Message deletion logic
- `database/migration_v10_staff_auth.sql` - Staff auth setup
- `database/migration_v11_focus_mode.sql` - booking_messages table
- `database/migration_v20_booking_messages_delete.sql` - DELETE policy
- `database/debug_booking_messages_delete.sql` - Debug queries
- `docs/STAFF_AUTHENTICATION.md` - Auth setup guide

---

## Prevention

To prevent this issue in the future:

### 1. Add Frontend Validation
```typescript
// Check if user has proper auth before showing delete button
const canDelete = (msg: MessageWithSender) => {
  // Must be sender
  if (msg.sender_id !== user?.id) return false

  // Cannot delete system messages
  if (msg.sender_type === 'system') return false

  // Check if user has auth_user_id set
  if (!user?.authUserId) {
    console.warn('Staff lacks auth_user_id - deletion will fail')
    return false
  }

  return true
}
```

### 2. Better Error Handling
```typescript
const { data, error, count } = await supabase
  .from('booking_messages')
  .delete()
  .eq('id', msg.id)
  .select()

if (error) {
  console.error('Delete error:', error)
  alert(`เกิดข้อผิดพลาด: ${error.message}`)
} else if (!data || data.length === 0) {
  console.error('Delete blocked by RLS - no rows affected')
  alert('ไม่สามารถลบข้อความได้ กรุณาติดต่อผู้ดูแลระบบ')
  return
}
```

### 3. Migration Checklist
When creating new staff accounts:
- [ ] Create auth.users entry
- [ ] Link auth_user_id in staff table
- [ ] Verify login works
- [ ] Test RLS-protected operations

---

## Conclusion

The message deletion issue is caused by **staff records not being linked to Supabase authentication**. The RLS policy correctly enforces security but cannot identify the current user when `auth_user_id` is NULL.

**Recommended Solution**: Create auth accounts for all active staff members (Solution 1).

This ensures proper security, authentication, and authorization throughout the system.
