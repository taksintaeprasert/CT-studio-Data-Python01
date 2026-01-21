-- Migration V9: Add photo_type to service_photos table
-- This supports both 'before' and 'after' photos for services
-- Run this in Supabase SQL Editor

-- Add photo_type column
ALTER TABLE service_photos
ADD COLUMN IF NOT EXISTS photo_type VARCHAR(10) DEFAULT 'after'
  CHECK (photo_type IN ('before', 'after'));

-- Update existing records to 'after' (they are all after photos currently)
UPDATE service_photos SET photo_type = 'after' WHERE photo_type IS NULL;

-- Make photo_type NOT NULL after setting defaults
ALTER TABLE service_photos
ALTER COLUMN photo_type SET NOT NULL;

-- Add index for faster filtering by photo_type
CREATE INDEX IF NOT EXISTS idx_service_photos_photo_type ON service_photos(photo_type);

-- Add index for faster filtering by order_item_id and photo_type together
CREATE INDEX IF NOT EXISTS idx_service_photos_order_item_type
  ON service_photos(order_item_id, photo_type);

-- Add comments
COMMENT ON COLUMN service_photos.photo_type IS 'Type of photo: before (รูปก่อนทำ) or after (รูปหลังทำเสร็จ)';

-- View to check the migration
-- SELECT id, order_item_id, photo_type, photo_path, created_at
-- FROM service_photos
-- ORDER BY created_at DESC
-- LIMIT 10;
