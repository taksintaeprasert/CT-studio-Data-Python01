-- Migration V14: Add payment receipt image support
-- This allows uploading payment slip images as proof of payment
-- Run this in Supabase SQL Editor

-- =============================================
-- 1. ADD RECEIPT COLUMNS TO PAYMENTS TABLE
-- =============================================
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS receipt_url TEXT,
ADD COLUMN IF NOT EXISTS receipt_path TEXT;

-- Add comments
COMMENT ON COLUMN payments.receipt_url IS 'Public URL of payment receipt/slip image from Supabase Storage';
COMMENT ON COLUMN payments.receipt_path IS 'Storage path for deletion (e.g., payment-receipts/123_receipt_1234567890.jpg)';

-- =============================================
-- 2. CREATE STORAGE BUCKET FOR PAYMENT RECEIPTS
-- =============================================
-- Create bucket for payment receipts (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-receipts', 'payment-receipts', false)
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- 3. STORAGE POLICIES
-- =============================================
-- Policy: Allow authenticated users to upload payment receipts
CREATE POLICY IF NOT EXISTS "Authenticated users can upload payment receipts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'payment-receipts');

-- Policy: Allow authenticated users to view payment receipts
CREATE POLICY IF NOT EXISTS "Authenticated users can view payment receipts"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'payment-receipts');

-- Policy: Allow authenticated users to update payment receipts
CREATE POLICY IF NOT EXISTS "Authenticated users can update payment receipts"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'payment-receipts');

-- Policy: Allow authenticated users to delete payment receipts
CREATE POLICY IF NOT EXISTS "Authenticated users can delete payment receipts"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'payment-receipts');

-- =============================================
-- 4. VERIFY MIGRATION
-- =============================================
-- Check payments table columns:
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'payments' AND column_name IN ('receipt_url', 'receipt_path', 'credit_card_fee', 'net_amount')
-- ORDER BY column_name;

-- Check storage bucket:
-- SELECT * FROM storage.buckets WHERE id = 'payment-receipts';

-- Check storage policies:
-- SELECT * FROM pg_policies WHERE tablename = 'objects' AND policyname LIKE '%payment receipts%';
