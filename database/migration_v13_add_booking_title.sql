-- Migration V13: Add booking_title to order_items
-- This stores the formatted booking title for easy display
-- Run this in Supabase SQL Editor

-- Add booking_title column
ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS booking_title TEXT;

-- Create index for searching
CREATE INDEX IF NOT EXISTS idx_order_items_booking_title
  ON order_items(booking_title);

-- Add comment
COMMENT ON COLUMN order_items.booking_title IS 'Formatted booking title: ชื่อช่าง-รหัสบริการ-ชื่อจริงลูกค้า-ชื่อเล่น';

-- Update existing records with booking_title (optional - can be done gradually)
-- This will generate titles for existing bookings
UPDATE order_items oi
SET booking_title = CONCAT(
  COALESCE(s.staff_name, 'ไม่ระบุช่าง'), '-',
  COALESCE(p.product_code, 'N/A'), '-',
  SPLIT_PART(COALESCE(c.full_name, 'ไม่ระบุชื่อ'), ' ', 1), '-',
  COALESCE(c.nickname, '')
)
FROM staff s, products p, orders o, customers c
WHERE oi.artist_id = s.id
  AND oi.product_id = p.id
  AND oi.order_id = o.id
  AND o.customer_id = c.id
  AND oi.appointment_date IS NOT NULL
  AND oi.booking_title IS NULL;

-- Verify migration
-- SELECT id, booking_title, appointment_date
-- FROM order_items
-- WHERE appointment_date IS NOT NULL
-- LIMIT 10;
