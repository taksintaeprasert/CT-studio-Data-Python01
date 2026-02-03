-- Migration V19: Add commission_base_price field to order_items
-- This field stores the price used for commission calculation
-- For FREE services, this should equal the price of the related paid service
-- Run this in Supabase SQL Editor

-- =============================================
-- 1. ADD commission_base_price COLUMN
-- =============================================
-- Add commission_base_price to track the price used for commission calculation
ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS commission_base_price DECIMAL(10, 2);

-- =============================================
-- 2. SET DEFAULT VALUES FOR EXISTING RECORDS
-- =============================================
-- For existing records, set commission_base_price = item_price as default
UPDATE order_items
SET commission_base_price = COALESCE(item_price, 0)
WHERE commission_base_price IS NULL;

-- =============================================
-- 3. ADD NOT NULL CONSTRAINT
-- =============================================
-- After setting defaults, make it NOT NULL with default 0 for new records
ALTER TABLE order_items
ALTER COLUMN commission_base_price SET DEFAULT 0,
ALTER COLUMN commission_base_price SET NOT NULL;

-- =============================================
-- 4. ADD INDEX
-- =============================================
CREATE INDEX IF NOT EXISTS idx_order_items_commission_base_price ON order_items(commission_base_price);

-- =============================================
-- 5. ADD COMMENT
-- =============================================
COMMENT ON COLUMN order_items.commission_base_price IS 'Price used for commission calculation. For FREE services, this equals the paired paid service price. For normal services, this equals item_price.';

-- =============================================
-- 6. VERIFY MIGRATION
-- =============================================
-- Check the new column:
-- SELECT column_name, data_type, column_default, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'order_items' AND column_name = 'commission_base_price';

-- Check sample data:
-- SELECT id, product_id, item_price, commission_base_price
-- FROM order_items
-- LIMIT 10;
