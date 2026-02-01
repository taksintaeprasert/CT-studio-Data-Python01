-- =============================================
-- BACKFILL SCRIPT: Fix completion timestamps for existing orders
-- =============================================
-- Purpose: Update old orders so they are properly counted in statistics
--
-- This script fixes order_items where:
-- 1. item_status = 'completed' (service was marked complete)
-- 2. Missing artist_completed_at and/or sales_completed_at timestamps
--
-- Without both timestamps, completed services won't be counted in:
-- - Dashboard statistics
-- - Artist performance metrics
-- - Sales performance metrics
-- - Commission calculations
-- =============================================

-- Show statistics BEFORE fix
SELECT
  'BEFORE FIX' as status,
  COUNT(*) as total_completed_items,
  COUNT(artist_completed_at) as has_artist_timestamp,
  COUNT(sales_completed_at) as has_sales_timestamp,
  COUNT(*) FILTER (WHERE artist_completed_at IS NOT NULL AND sales_completed_at IS NOT NULL) as has_both_timestamps,
  COUNT(*) FILTER (WHERE artist_completed_at IS NULL OR sales_completed_at IS NULL) as missing_timestamps
FROM order_items
WHERE item_status = 'completed';

-- =============================================
-- FIX 1: Set artist_completed_at for completed items
-- =============================================
-- Use the earlier of: updated_at or sales_completed_at
-- (Artist usually completes before sales confirms)
UPDATE order_items
SET artist_completed_at = COALESCE(
  -- Use sales_completed_at - 1 hour if it exists (artist likely finished before)
  sales_completed_at - INTERVAL '1 hour',
  -- Otherwise use updated_at as fallback
  updated_at,
  -- Last resort: use current time
  CURRENT_TIMESTAMP
)
WHERE item_status = 'completed'
  AND artist_completed_at IS NULL;

-- =============================================
-- FIX 2: Set sales_completed_at for completed items
-- =============================================
-- Use updated_at or current timestamp
UPDATE order_items
SET sales_completed_at = COALESCE(
  updated_at,
  CURRENT_TIMESTAMP
)
WHERE item_status = 'completed'
  AND sales_completed_at IS NULL;

-- =============================================
-- FIX 3: Handle scheduled items with artist assignment
-- =============================================
-- If item_status is 'scheduled' and has artist_id but appointment_date is past,
-- it might have been completed but not marked properly
UPDATE order_items
SET
  item_status = 'completed',
  artist_completed_at = COALESCE(updated_at, CURRENT_TIMESTAMP),
  sales_completed_at = COALESCE(updated_at, CURRENT_TIMESTAMP)
WHERE item_status = 'scheduled'
  AND artist_id IS NOT NULL
  AND appointment_date < CURRENT_DATE - INTERVAL '7 days'
  AND artist_completed_at IS NULL;

-- Show statistics AFTER fix
SELECT
  'AFTER FIX' as status,
  COUNT(*) as total_completed_items,
  COUNT(artist_completed_at) as has_artist_timestamp,
  COUNT(sales_completed_at) as has_sales_timestamp,
  COUNT(*) FILTER (WHERE artist_completed_at IS NOT NULL AND sales_completed_at IS NOT NULL) as has_both_timestamps,
  COUNT(*) FILTER (WHERE artist_completed_at IS NULL OR sales_completed_at IS NULL) as missing_timestamps
FROM order_items
WHERE item_status = 'completed';

-- =============================================
-- VERIFICATION: Show sample of fixed records
-- =============================================
SELECT
  oi.id,
  oi.order_id,
  oi.booking_title,
  oi.item_status,
  oi.artist_id,
  s.name as artist_name,
  oi.appointment_date,
  oi.artist_completed_at,
  oi.sales_completed_at,
  oi.updated_at,
  o.order_date
FROM order_items oi
LEFT JOIN staff s ON s.id = oi.artist_id
LEFT JOIN orders o ON o.id = oi.order_id
WHERE oi.item_status = 'completed'
ORDER BY oi.id DESC
LIMIT 30;

-- =============================================
-- BONUS: Check for orders that should be marked as 'done'
-- =============================================
-- Orders where ALL items are completed should have order_status = 'done'
SELECT
  o.id as order_id,
  o.order_status,
  o.order_date,
  COUNT(oi.id) as total_items,
  COUNT(*) FILTER (WHERE oi.item_status = 'completed'
                   AND oi.artist_completed_at IS NOT NULL
                   AND oi.sales_completed_at IS NOT NULL) as completed_items,
  c.name as customer_name,
  s.name as sales_name
FROM orders o
LEFT JOIN order_items oi ON oi.order_id = o.id
LEFT JOIN customers c ON c.id = o.customer_id
LEFT JOIN staff s ON s.id = o.sales_id
WHERE o.order_status IN ('booking', 'active', 'paid')
GROUP BY o.id, c.name, s.name
HAVING COUNT(oi.id) > 0
   AND COUNT(oi.id) = COUNT(*) FILTER (WHERE oi.item_status = 'completed'
                                       AND oi.artist_completed_at IS NOT NULL
                                       AND oi.sales_completed_at IS NOT NULL)
ORDER BY o.order_date DESC;

-- =============================================
-- INSTRUCTIONS
-- =============================================
-- 1. Run this script in Supabase SQL Editor
-- 2. Review the BEFORE/AFTER statistics
-- 3. Check the sample records to verify correctness
-- 4. If needed, manually update order_status to 'done' for fully completed orders
--    using the bonus query results
-- =============================================
