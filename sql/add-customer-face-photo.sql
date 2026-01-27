-- ===========================================
-- CT Studio: Add Customer Face Photo Column
-- Run this in Supabase SQL Editor
-- ===========================================

-- Add face_photo_url column to customers table
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS face_photo_url TEXT;

-- Add comment to column for documentation
COMMENT ON COLUMN customers.face_photo_url IS 'URL to customer face photo stored in service-photos bucket';

-- No index needed as this column is not used for queries
-- It's only used for display in booking chat

-- ===========================================
-- NOTES:
-- - This column stores the public URL of the customer's face photo
-- - Photos are stored in the existing 'service-photos' bucket
-- - This is different from customer_photos table which stores before/after photos
-- - The face photo is displayed in booking chat for artist reference
-- ===========================================
