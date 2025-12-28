-- Migration V2: Add appointment tracking per service item
-- Run this in Supabase SQL Editor

-- Add new columns to order_items table
ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS appointment_date DATE,
ADD COLUMN IF NOT EXISTS appointment_time TIME,
ADD COLUMN IF NOT EXISTS item_status VARCHAR(20) DEFAULT 'pending'
  CHECK (item_status IN ('pending', 'scheduled', 'completed', 'cancelled'));

-- Update orders table - change status options
-- Order status: booking (จอง), paid (ชำระแล้ว), cancelled (ยกเลิก)
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_order_status_check
  CHECK (order_status IN ('booking', 'paid', 'done', 'cancelled'));

-- Remove appointment columns from orders (optional - can keep for backwards compatibility)
-- ALTER TABLE orders DROP COLUMN IF EXISTS appointment_date;
-- ALTER TABLE orders DROP COLUMN IF EXISTS appointment_time;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_order_items_status ON order_items(item_status);
CREATE INDEX IF NOT EXISTS idx_order_items_appointment ON order_items(appointment_date);
