-- Migration V9: Create service_photos table
-- This table stores before/after photos for each service (order_item)
-- Run this in Supabase SQL Editor

-- =============================================
-- CREATE service_photos TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS service_photos (
  id SERIAL PRIMARY KEY,
  order_item_id INTEGER NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  photo_path TEXT NOT NULL,
  photo_type VARCHAR(10) NOT NULL DEFAULT 'after' CHECK (photo_type IN ('before', 'after')),
  uploaded_by INTEGER REFERENCES staff(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- CREATE INDEXES
-- =============================================
-- Index for finding photos by order_item_id (most common query)
CREATE INDEX IF NOT EXISTS idx_service_photos_order_item_id
  ON service_photos(order_item_id);

-- Index for filtering by photo type
CREATE INDEX IF NOT EXISTS idx_service_photos_photo_type
  ON service_photos(photo_type);

-- Composite index for filtering by order_item and type together
CREATE INDEX IF NOT EXISTS idx_service_photos_order_item_type
  ON service_photos(order_item_id, photo_type);

-- Index for finding photos uploaded by specific staff
CREATE INDEX IF NOT EXISTS idx_service_photos_uploaded_by
  ON service_photos(uploaded_by);

-- Index for ordering by creation date
CREATE INDEX IF NOT EXISTS idx_service_photos_created_at
  ON service_photos(created_at DESC);

-- =============================================
-- ADD COMMENTS
-- =============================================
COMMENT ON TABLE service_photos IS 'Stores before/after photos for each service (order_item)';
COMMENT ON COLUMN service_photos.id IS 'Primary key';
COMMENT ON COLUMN service_photos.order_item_id IS 'Reference to order_items table';
COMMENT ON COLUMN service_photos.photo_url IS 'Public URL from Supabase Storage';
COMMENT ON COLUMN service_photos.photo_path IS 'Storage path for deletion (e.g., before/123_before_1234567890.jpg)';
COMMENT ON COLUMN service_photos.photo_type IS 'Type of photo: before (รูปก่อนทำ) or after (รูปหลังทำเสร็จ)';
COMMENT ON COLUMN service_photos.uploaded_by IS 'Staff ID who uploaded the photo';
COMMENT ON COLUMN service_photos.note IS 'Optional note about the photo (e.g., colors used, techniques)';
COMMENT ON COLUMN service_photos.created_at IS 'Timestamp when photo was uploaded';

-- =============================================
-- ENABLE ROW LEVEL SECURITY (RLS)
-- =============================================
ALTER TABLE service_photos ENABLE ROW LEVEL SECURITY;

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
-- VERIFY MIGRATION
-- =============================================
-- Run this to check if table was created successfully:
-- SELECT table_name, column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'service_photos'
-- ORDER BY ordinal_position;

-- Check indexes:
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'service_photos';
