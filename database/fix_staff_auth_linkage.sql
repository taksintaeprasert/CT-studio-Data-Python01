-- =============================================
-- Fix Staff Auth Linkage - Step by Step Guide
-- Run each section separately to diagnose and fix
-- =============================================

-- STEP 1: Check your current auth session
-- This shows who you're logged in as
SELECT
  auth.uid() as your_auth_uuid,
  auth.email() as your_email;

-- STEP 2: Check staff ID 15 (the one having deletion issues)
SELECT
  id,
  staff_name,
  email,
  role,
  auth_user_id,
  is_active,
  CASE
    WHEN auth_user_id IS NULL THEN '❌ NO AUTH LINKED'
    ELSE '✅ AUTH LINKED'
  END as status
FROM staff
WHERE id = 15;

-- STEP 3: Check if an auth user exists for this email
-- Replace 'STAFF_EMAIL_HERE' with the actual email from STEP 2
SELECT
  id as auth_uuid,
  email,
  created_at,
  last_sign_in_at,
  email_confirmed_at
FROM auth.users
WHERE email = 'STAFF_EMAIL_HERE';

-- STEP 4: Check ALL staff members and their auth status
SELECT
  s.id,
  s.staff_name,
  s.email,
  s.role,
  s.auth_user_id,
  CASE
    WHEN s.auth_user_id IS NULL THEN '❌ NO AUTH'
    ELSE '✅ HAS AUTH'
  END as status,
  au.email as auth_email,
  au.last_sign_in_at
FROM staff s
LEFT JOIN auth.users au ON s.auth_user_id = au.id
WHERE s.is_active = true
ORDER BY s.id;

-- =============================================
-- FIX OPTIONS
-- =============================================

-- OPTION A: If auth user ALREADY EXISTS for the email
-- 1. Get the UUID from STEP 3
-- 2. Run this (replace ACTUAL_UUID with the id from STEP 3):
/*
UPDATE staff
SET auth_user_id = 'ACTUAL_UUID_FROM_STEP_3'
WHERE id = 15;
*/

-- OPTION B: If NO auth user exists yet
-- You need to create one first using ONE of these methods:

-- Method B1: Using Supabase Dashboard
/*
1. Go to: Authentication → Users → "Add user"
2. Enter email (use staff's email)
3. Enter password
4. Check "Auto Confirm User"
5. Click "Save"
6. Copy the User ID (UUID) shown
7. Come back and run:

UPDATE staff
SET auth_user_id = 'UUID_YOU_JUST_COPIED'
WHERE id = 15;
*/

-- Method B2: Using Admin SQL Function (if service role key available)
/*
-- This creates an auth user programmatically
-- Replace values as needed:

WITH new_user AS (
  -- Note: This requires service_role privileges
  -- You may need to use Supabase Dashboard instead
  SELECT extensions.uuid_generate_v4() as id
)
UPDATE staff
SET auth_user_id = (SELECT id FROM new_user)
WHERE id = 15;
*/

-- =============================================
-- VERIFICATION
-- =============================================

-- Run this after making changes to verify the fix:
SELECT
  s.id as staff_id,
  s.staff_name,
  s.email as staff_email,
  s.auth_user_id,
  au.email as auth_email,
  au.created_at as auth_created,
  CASE
    WHEN s.auth_user_id IS NOT NULL AND au.id IS NOT NULL THEN '✅ PROPERLY LINKED'
    WHEN s.auth_user_id IS NULL THEN '❌ NO AUTH_USER_ID SET'
    WHEN au.id IS NULL THEN '❌ AUTH USER NOT FOUND'
    ELSE '⚠️ UNKNOWN ISSUE'
  END as linkage_status
FROM staff s
LEFT JOIN auth.users au ON s.auth_user_id = au.id
WHERE s.id = 15;

-- =============================================
-- TEST MESSAGE DELETION POLICY
-- =============================================

-- After linking, test if deletion would work:
SELECT
  bm.id as message_id,
  bm.sender_id,
  bm.message_text,
  (SELECT id FROM staff WHERE auth_user_id = auth.uid()) as current_staff_id,
  bm.sender_id = (SELECT id FROM staff WHERE auth_user_id = auth.uid()) as can_delete,
  CASE
    WHEN bm.sender_id = (SELECT id FROM staff WHERE auth_user_id = auth.uid())
    THEN '✅ CAN DELETE'
    ELSE '❌ CANNOT DELETE'
  END as delete_permission
FROM booking_messages bm
WHERE bm.id = 819;

-- =============================================
-- BATCH FIX: Link ALL staff members at once
-- =============================================

-- If you want to see which staff need auth accounts:
SELECT
  s.id,
  s.staff_name,
  s.email,
  s.role,
  CASE
    WHEN s.auth_user_id IS NULL AND au.id IS NOT NULL THEN '⚠️ AUTH EXISTS BUT NOT LINKED'
    WHEN s.auth_user_id IS NULL AND au.id IS NULL THEN '❌ NEEDS AUTH ACCOUNT CREATED'
    WHEN s.auth_user_id IS NOT NULL AND au.id IS NOT NULL THEN '✅ PROPERLY LINKED'
    ELSE '⚠️ BROKEN LINK (auth_user_id points to non-existent user)'
  END as status,
  au.id as existing_auth_uuid
FROM staff s
LEFT JOIN auth.users au ON s.email = au.email
WHERE s.is_active = true
ORDER BY s.id;

-- To link existing auth accounts to staff (only if auth user already exists):
/*
UPDATE staff s
SET auth_user_id = au.id
FROM auth.users au
WHERE s.email = au.email
  AND s.auth_user_id IS NULL
  AND s.is_active = true;

-- Then verify:
SELECT COUNT(*) as linked_count
FROM staff
WHERE auth_user_id IS NOT NULL AND is_active = true;
*/
