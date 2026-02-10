-- =============================================
-- Debug Booking Messages Delete Issue
-- Run this in Supabase SQL Editor while logged in as the user
-- =============================================

-- STEP 1: Check current user info
SELECT
  auth.uid() as current_auth_uid,
  s.id as staff_id,
  s.staff_name,
  s.auth_user_id,
  s.role
FROM staff s
WHERE s.auth_user_id = auth.uid();

-- STEP 2: Check the message you're trying to delete (replace 819 with your message ID)
SELECT
  id,
  order_item_id,
  sender_id,
  sender_type,
  message_type,
  message_text,
  file_url,
  created_at
FROM booking_messages
WHERE id = 819;

-- STEP 3: Check if the sender_id matches current user's staff.id
SELECT
  bm.id as message_id,
  bm.sender_id as message_sender_id,
  s.id as current_user_staff_id,
  CASE
    WHEN bm.sender_id = s.id THEN 'MATCH ✓'
    ELSE 'NO MATCH ✗'
  END as sender_check
FROM booking_messages bm
CROSS JOIN (
  SELECT id FROM staff WHERE auth_user_id = auth.uid()
) s
WHERE bm.id = 819;

-- STEP 4: Check RLS policies on booking_messages
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'booking_messages'
  AND cmd = 'DELETE';

-- STEP 5: Check if RLS is enabled
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'booking_messages';

-- STEP 6: Try to simulate the delete check
-- This shows whether the USING clause would allow deletion
SELECT
  bm.id,
  bm.sender_id,
  (SELECT id FROM staff WHERE auth_user_id = auth.uid()) as current_staff_id,
  bm.sender_id = (SELECT id FROM staff WHERE auth_user_id = auth.uid()) as can_delete
FROM booking_messages bm
WHERE bm.id = 819;

-- =============================================
-- If you need to fix: Re-create the DELETE policy
-- =============================================

-- Drop existing policy
-- DROP POLICY IF EXISTS "Users can delete their own booking messages" ON booking_messages;

-- Recreate policy
-- CREATE POLICY "Users can delete their own booking messages"
-- ON booking_messages FOR DELETE
-- TO authenticated
-- USING (
--   sender_id = (SELECT id FROM staff WHERE auth_user_id = auth.uid())
-- );
