-- Migration V14.1: Fix payment-receipts bucket to be public
-- This fixes the "Bucket not found" error when viewing payment slip thumbnails
-- Run this in Supabase SQL Editor

-- =============================================
-- 1. UPDATE BUCKET TO BE PUBLIC
-- =============================================
-- Update the payment-receipts bucket to be public so getPublicUrl() works
UPDATE storage.buckets
SET public = true
WHERE id = 'payment-receipts';

-- =============================================
-- 2. ADD PUBLIC READ POLICY
-- =============================================
-- Drop existing policies if they exist (to avoid errors on re-run)
DROP POLICY IF EXISTS "Public can view payment receipts" ON storage.objects;

-- Policy: Allow public (everyone) to view payment receipts
-- This is needed because getPublicUrl() requires public access
CREATE POLICY "Public can view payment receipts"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'payment-receipts');

-- =============================================
-- 3. VERIFY MIGRATION
-- =============================================
-- Check that bucket is now public:
-- SELECT id, name, public FROM storage.buckets WHERE id = 'payment-receipts';
-- Expected: public = true

-- Check storage policies:
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
-- FROM pg_policies
-- WHERE tablename = 'objects' AND policyname LIKE '%payment receipts%'
-- ORDER BY policyname;

-- Test public URL access:
-- 1. Upload a test image via the payment modal
-- 2. Check that the thumbnail displays correctly
-- 3. Verify that clicking "ดูสลิปการโอนเงิน" opens the image
