-- =============================================
-- Verify and Fix Photo Deletion Policies
-- Run this in Supabase SQL Editor if deletion is not working
-- =============================================

-- =============================================
-- PART 1: Verify Existing Policies
-- =============================================

-- Check current RLS policies on service_photos table
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'service_photos';

-- Check current storage bucket policies
SELECT
  id,
  name,
  public
FROM storage.buckets
WHERE id = 'service-photos';

-- Check storage.objects policies
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'objects' AND schemaname = 'storage';

-- =============================================
-- PART 2: Drop and Recreate RLS Policies (if needed)
-- =============================================

-- Drop existing policies on service_photos (if they exist)
DROP POLICY IF EXISTS "Authenticated users can read all photos" ON service_photos;
DROP POLICY IF EXISTS "Authenticated users can insert photos" ON service_photos;
DROP POLICY IF EXISTS "Authenticated users can update photos" ON service_photos;
DROP POLICY IF EXISTS "Authenticated users can delete photos" ON service_photos;
DROP POLICY IF EXISTS "Authenticated users can view service photos" ON service_photos;
DROP POLICY IF EXISTS "Authenticated users can insert service photos" ON service_photos;
DROP POLICY IF EXISTS "Authenticated users can delete service photos" ON service_photos;

-- Recreate policies with proper permissions
-- Policy: Allow authenticated users (staff) to read all photos
CREATE POLICY "Authenticated users can read all photos"
ON service_photos FOR SELECT
TO authenticated
USING (true);

-- Policy: Allow authenticated users (staff) to insert photos
CREATE POLICY "Authenticated users can insert photos"
ON service_photos FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy: Allow authenticated users (staff) to update photos
CREATE POLICY "Authenticated users can update photos"
ON service_photos FOR UPDATE
TO authenticated
USING (true);

-- Policy: Allow authenticated users (staff) to delete photos
CREATE POLICY "Authenticated users can delete photos"
ON service_photos FOR DELETE
TO authenticated
USING (true);

-- =============================================
-- PART 3: Fix Storage Bucket Policies
-- =============================================

-- Drop existing storage policies for service-photos bucket
DROP POLICY IF EXISTS "Authenticated users can upload photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete photos" ON storage.objects;

-- Recreate storage policies
-- Policy: Allow authenticated users to upload photos
CREATE POLICY "Authenticated users can upload to service-photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'service-photos');

-- Policy: Allow authenticated users to view photos
CREATE POLICY "Authenticated users can view service-photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'service-photos');

-- Policy: Allow authenticated users to delete photos
CREATE POLICY "Authenticated users can delete from service-photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'service-photos');

-- Policy: Allow authenticated users to update photos
CREATE POLICY "Authenticated users can update service-photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'service-photos');

-- =============================================
-- PART 4: Ensure RLS is Enabled
-- =============================================

-- Enable RLS on service_photos table
ALTER TABLE service_photos ENABLE ROW LEVEL SECURITY;

-- =============================================
-- PART 5: Verify Policies Were Created
-- =============================================

-- Check service_photos policies
SELECT
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE tablename = 'service_photos';

-- Check storage.objects policies for service-photos
SELECT
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE tablename = 'objects'
  AND schemaname = 'storage'
  AND (
    policyname LIKE '%service-photos%'
    OR qual::text LIKE '%service-photos%'
  );

-- =============================================
-- PART 6: Test Query (Optional)
-- =============================================

-- Test if you can select photos (should work if authenticated)
-- SELECT id, customer_id, photo_type, photo_path, created_at
-- FROM service_photos
-- LIMIT 5;

-- Test if you can delete a photo (replace 999 with actual photo id)
-- DELETE FROM service_photos WHERE id = 999;
