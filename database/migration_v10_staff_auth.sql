-- Migration V10: Link staff table with Supabase Authentication
-- This allows each staff member to have their own login account
-- Run this in Supabase SQL Editor

-- =============================================
-- ADD auth_user_id COLUMN TO STAFF TABLE
-- =============================================
ALTER TABLE staff
ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add index for faster lookup by auth_user_id
CREATE INDEX IF NOT EXISTS idx_staff_auth_user_id ON staff(auth_user_id);

-- Add comment
COMMENT ON COLUMN staff.auth_user_id IS 'Link to Supabase auth.users for authentication';

-- =============================================
-- CREATE HELPER FUNCTION: Get Staff by Auth User
-- =============================================
-- This function helps get staff info from auth user
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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_staff_by_auth_user() TO authenticated;

-- =============================================
-- CREATE HELPER FUNCTION: Check if email exists
-- =============================================
CREATE OR REPLACE FUNCTION staff_email_exists(check_email VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM staff WHERE email = check_email
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- UPDATE RLS POLICIES (if needed)
-- =============================================
-- Note: You may need to update existing RLS policies to use auth_user_id
-- Example: Allow staff to update their own records
-- CREATE POLICY "Staff can update own record"
-- ON staff FOR UPDATE
-- TO authenticated
-- USING (auth_user_id = auth.uid());

-- =============================================
-- VERIFY MIGRATION
-- =============================================
-- Check that column was added:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'staff' AND column_name = 'auth_user_id';

-- Check current staff without auth accounts:
-- SELECT id, staff_name, email, role, auth_user_id
-- FROM staff
-- WHERE auth_user_id IS NULL AND is_active = true;
