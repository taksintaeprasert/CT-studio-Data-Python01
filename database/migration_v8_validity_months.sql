-- Migration V8: Add validity_months field to products table
-- This field stores how many months a service/product is valid for
-- FREE products = 3 months, 50% products = 12 months, others = 0 (unlimited)

-- Step 1: Add the validity_months column
ALTER TABLE products ADD COLUMN IF NOT EXISTS validity_months INTEGER DEFAULT 0;

-- Step 2: Update FREE products to 3 months validity
UPDATE products
SET validity_months = 3
WHERE is_free = true OR product_code ILIKE '%FREE%';

-- Step 3: Update 50% products to 12 months validity (1 year)
UPDATE products
SET validity_months = 12
WHERE product_code ILIKE '%50%%' OR product_name ILIKE '%50%%';

-- Step 4: Verify the updates
-- SELECT product_code, product_name, is_free, validity_months FROM products ORDER BY validity_months DESC, product_code;

COMMENT ON COLUMN products.validity_months IS 'Number of months this service is valid for. 0 = unlimited, 3 = FREE services, 12 = 50% services';
