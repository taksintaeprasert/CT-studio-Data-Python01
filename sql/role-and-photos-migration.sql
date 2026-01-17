-- ===========================================
-- CT Studio: Role & Photo System Migration
-- Run this in Supabase SQL Editor
-- ===========================================

-- 1. Update staff role enum to include new roles
-- First, check if we need to alter the column type

-- Option A: If role is already an enum type, add new values
-- ALTER TYPE staff_role ADD VALUE IF NOT EXISTS 'marketer';
-- ALTER TYPE staff_role ADD VALUE IF NOT EXISTS 'super_admin';

-- Option B: If role is just text/varchar, we can just insert new values
-- The application will handle validation

-- 2. Create service_photos table for storing photo references
CREATE TABLE IF NOT EXISTS service_photos (
    id SERIAL PRIMARY KEY,
    order_item_id INTEGER NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    photo_url TEXT NOT NULL,
    photo_path TEXT NOT NULL, -- Storage path for deletion
    uploaded_by INTEGER REFERENCES staff(id),
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_service_photos_order_item_id ON service_photos(order_item_id);

-- 3. Create Supabase Storage bucket for service photos
-- This needs to be done in Storage settings or via API:
-- Bucket name: service-photos
-- Public: false (private bucket)

-- 4. Storage policies (run in Supabase SQL Editor)
-- Allow authenticated users to upload
INSERT INTO storage.buckets (id, name, public)
VALUES ('service-photos', 'service-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Policy: Allow authenticated users to upload photos
CREATE POLICY "Authenticated users can upload photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'service-photos');

-- Policy: Allow authenticated users to view photos
CREATE POLICY "Authenticated users can view photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'service-photos');

-- Policy: Allow authenticated users to delete their uploads
CREATE POLICY "Authenticated users can delete photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'service-photos');

-- 5. RLS policies for service_photos table
ALTER TABLE service_photos ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to view photos
CREATE POLICY "Authenticated users can view service photos"
ON service_photos FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to insert photos
CREATE POLICY "Authenticated users can insert service photos"
ON service_photos FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to delete photos
CREATE POLICY "Authenticated users can delete service photos"
ON service_photos FOR DELETE
TO authenticated
USING (true);

-- ===========================================
-- IMPORTANT: After running this SQL:
-- 1. Go to Storage > Create new bucket named "service-photos"
-- 2. Set bucket to Private
-- 3. Update the staff table to use new roles as needed
-- ===========================================
