-- Backfill commission_base_price for existing FREE service order items
-- This script updates commission_base_price for FREE services to match their paired paid service price
-- Run this in Supabase SQL Editor AFTER running migration_v19_commission_base_price.sql

-- =============================================
-- 1. CREATE HELPER FUNCTIONS
-- =============================================

-- Function to extract price code from product code (digits at the end or middle)
-- e.g., "LIP10900" → "10900", "LIPFREE6900" → "6900", "BROW5900FREE" → "5900"
CREATE OR REPLACE FUNCTION extract_price_code(product_code TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Try to match digits at the end first
  DECLARE
    price_code TEXT;
  BEGIN
    price_code := substring(product_code from '(\d+)$');

    -- If no digits at end, try to match any digits in the string
    IF price_code IS NULL OR price_code = '' THEN
      price_code := substring(product_code from '(\d+)');
    END IF;

    RETURN price_code;
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to extract base code (letters at the start, before digits or "FREE")
-- e.g., "LIP10900" → "LIP", "LIPFREE6900" → "LIP", "BROW5900FREE" → "BROW"
CREATE OR REPLACE FUNCTION extract_base_code(product_code TEXT)
RETURNS TEXT AS $$
BEGIN
  DECLARE
    base_code TEXT;
  BEGIN
    -- Extract letters at the start, stop at first digit or "FREE"
    base_code := substring(UPPER(product_code) from '^([A-Z]+?)(?:FREE|\d)');

    -- If no match, remove all digits and "FREE" from the code
    IF base_code IS NULL OR base_code = '' THEN
      base_code := regexp_replace(product_code, '[\dFREE]+', '', 'gi');
    END IF;

    RETURN UPPER(TRIM(base_code));
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================
-- 2. UPDATE commission_base_price FOR FREE SERVICES
-- =============================================

-- Update commission_base_price for FREE services by finding their paired paid service
-- A FREE service is paired with a paid service if they have the same base code and price code
UPDATE order_items oi
SET commission_base_price = (
  SELECT COALESCE(
    -- Find the paired paid service in the same order
    (
      SELECT oi_paid.item_price
      FROM order_items oi_paid
      JOIN products p_paid ON oi_paid.product_id = p_paid.id
      WHERE oi_paid.order_id = oi.order_id
        AND oi_paid.id != oi.id
        -- Must be a paid service (not free, has price > 0)
        AND COALESCE(p_paid.is_free, false) = false
        AND p_paid.list_price > 0
        -- Must have matching base code and price code
        AND extract_base_code(p_paid.product_code) = extract_base_code(p_free.product_code)
        AND extract_price_code(p_paid.product_code) = extract_price_code(p_free.product_code)
      LIMIT 1
    ),
    -- If no paired paid service found in same order, try to find by product relationship
    (
      SELECT p_paid.list_price
      FROM products p_paid
      WHERE COALESCE(p_paid.is_free, false) = false
        AND p_paid.list_price > 0
        AND p_paid.is_active = true
        -- Must have matching base code and price code
        AND extract_base_code(p_paid.product_code) = extract_base_code(p_free.product_code)
        AND extract_price_code(p_paid.product_code) = extract_price_code(p_free.product_code)
      ORDER BY p_paid.list_price DESC
      LIMIT 1
    ),
    -- Fallback: keep current commission_base_price
    oi.commission_base_price
  )
)
FROM products p_free
WHERE oi.product_id = p_free.id
  -- Only update FREE services
  AND (
    COALESCE(p_free.is_free, false) = true
    OR UPPER(p_free.product_code) LIKE '%FREE%'
    OR p_free.list_price = 0
  )
  -- Only update if current commission_base_price is 0 (meaning it's using the wrong value)
  AND COALESCE(oi.commission_base_price, 0) = 0;

-- =============================================
-- 3. VERIFY RESULTS
-- =============================================

-- Check how many FREE service items were updated
SELECT
  'FREE services updated' as status,
  COUNT(*) as count
FROM order_items oi
JOIN products p ON oi.product_id = p.id
WHERE (
    COALESCE(p.is_free, false) = true
    OR UPPER(p.product_code) LIKE '%FREE%'
    OR p.list_price = 0
  )
  AND oi.commission_base_price > 0;

-- Sample of FREE services with their commission_base_price
SELECT
  oi.id as order_item_id,
  o.id as order_id,
  p.product_code,
  p.product_name,
  p.list_price as product_list_price,
  oi.item_price,
  oi.commission_base_price,
  CASE
    WHEN oi.commission_base_price > 0 THEN '✓ Has commission base price'
    ELSE '✗ No commission base price'
  END as status
FROM order_items oi
JOIN products p ON oi.product_id = p.id
JOIN orders o ON oi.order_id = o.id
WHERE (
    COALESCE(p.is_free, false) = true
    OR UPPER(p.product_code) LIKE '%FREE%'
    OR p.list_price = 0
  )
ORDER BY oi.id DESC
LIMIT 20;

-- =============================================
-- 4. CLEANUP (Optional - run only if you want to remove helper functions)
-- =============================================
-- DROP FUNCTION IF EXISTS extract_price_code(TEXT);
-- DROP FUNCTION IF EXISTS extract_base_code(TEXT);
