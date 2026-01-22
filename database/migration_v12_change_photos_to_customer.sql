-- Migration V12: Change service_photos from order_item_id to customer_id
-- Photos should belong to customers, not order items
-- Run this in Supabase SQL Editor

-- =============================================
-- STEP 1: Drop existing indexes and constraints
-- =============================================
-- Drop indexes related to order_item_id
DROP INDEX IF EXISTS idx_service_photos_order_item_id;
DROP INDEX IF EXISTS idx_service_photos_order_item_type;

-- =============================================
-- STEP 2: Modify the table structure
-- =============================================
-- Drop the old foreign key column
ALTER TABLE service_photos
DROP COLUMN IF EXISTS order_item_id;

-- Add new customer_id column
ALTER TABLE service_photos
ADD COLUMN IF NOT EXISTS customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE;

-- =============================================
-- STEP 3: Create new indexes for customer_id
-- =============================================
-- Index for finding photos by customer_id (most common query)
CREATE INDEX IF NOT EXISTS idx_service_photos_customer_id
  ON service_photos(customer_id);

-- Index for filtering by photo type
-- (already exists from V9, but included for completeness)
CREATE INDEX IF NOT EXISTS idx_service_photos_photo_type
  ON service_photos(photo_type);

-- Composite index for filtering by customer and type together
CREATE INDEX IF NOT EXISTS idx_service_photos_customer_type
  ON service_photos(customer_id, photo_type);

-- Index for finding photos uploaded by specific staff
-- (already exists from V9, but included for completeness)
CREATE INDEX IF NOT EXISTS idx_service_photos_uploaded_by
  ON service_photos(uploaded_by);

-- Index for ordering by creation date
-- (already exists from V9, but included for completeness)
CREATE INDEX IF NOT EXISTS idx_service_photos_created_at
  ON service_photos(created_at DESC);

-- =============================================
-- STEP 4: Update comments
-- =============================================
COMMENT ON TABLE service_photos IS 'Stores before/after photos for each customer';
COMMENT ON COLUMN service_photos.customer_id IS 'Reference to customers table - photos belong to customers';
COMMENT ON COLUMN service_photos.photo_url IS 'Public URL from Supabase Storage';
COMMENT ON COLUMN service_photos.photo_path IS 'Storage path for deletion (e.g., customer_123/before_1234567890.jpg)';
COMMENT ON COLUMN service_photos.photo_type IS 'Type of photo: before (รูปก่อนทำ) or after (รูปหลังทำเสร็จ)';
COMMENT ON COLUMN service_photos.uploaded_by IS 'Staff ID who uploaded the photo';
COMMENT ON COLUMN service_photos.note IS 'Optional note about the photo';
COMMENT ON COLUMN service_photos.created_at IS 'Timestamp when photo was uploaded';

-- =============================================
-- VERIFY MIGRATION
-- =============================================
-- Run this to check if table was modified successfully:
-- SELECT table_name, column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'service_photos'
-- ORDER BY ordinal_position;

-- Check indexes:
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'service_photos';

-- Check foreign keys:
-- SELECT
--   tc.constraint_name,
--   tc.table_name,
--   kcu.column_name,
--   ccu.table_name AS foreign_table_name,
--   ccu.column_name AS foreign_column_name
-- FROM information_schema.table_constraints AS tc
-- JOIN information_schema.key_column_usage AS kcu
--   ON tc.constraint_name = kcu.constraint_name
--   AND tc.table_schema = kcu.table_schema
-- JOIN information_schema.constraint_column_usage AS ccu
--   ON ccu.constraint_name = tc.constraint_name
--   AND ccu.table_schema = tc.table_schema
-- WHERE tc.constraint_type = 'FOREIGN KEY'
--   AND tc.table_name = 'service_photos';
