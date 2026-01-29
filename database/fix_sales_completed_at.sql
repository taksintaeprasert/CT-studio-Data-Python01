-- Fix sales_completed_at for existing completed order_items
-- This script updates order_items where:
-- 1. item_status = 'completed' (Sales already marked as complete)
-- 2. sales_completed_at IS NULL (timestamp not set)
--
-- This ensures that the Artist Home page correctly counts completed services

-- Update order_items with completed status but missing sales_completed_at
UPDATE order_items
SET sales_completed_at = CURRENT_TIMESTAMP
WHERE item_status = 'completed'
  AND sales_completed_at IS NULL;

-- Show affected rows
SELECT
  id,
  order_id,
  item_status,
  artist_completed_at,
  sales_completed_at,
  appointment_date
FROM order_items
WHERE item_status = 'completed'
ORDER BY id DESC
LIMIT 20;
