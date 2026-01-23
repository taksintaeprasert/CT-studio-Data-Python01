-- Migration V15: Add credit card fee and net amount columns to payments
-- This tracks credit card fees (3%) and net amount after fees
-- Run this in Supabase SQL Editor

-- =============================================
-- ADD FEE COLUMNS TO PAYMENTS TABLE
-- =============================================
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS credit_card_fee DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS net_amount DECIMAL(10, 2);

-- Add comments
COMMENT ON COLUMN payments.credit_card_fee IS 'Credit card processing fee (3% of amount)';
COMMENT ON COLUMN payments.net_amount IS 'Net amount after deducting fees (amount - credit_card_fee)';

-- =============================================
-- UPDATE EXISTING RECORDS
-- =============================================
-- Set credit_card_fee to 0 for all existing records (assume no credit card was used)
UPDATE payments
SET credit_card_fee = 0
WHERE credit_card_fee IS NULL;

-- Set net_amount = amount for all existing records (no fees)
UPDATE payments
SET net_amount = amount
WHERE net_amount IS NULL;

-- =============================================
-- VERIFY MIGRATION
-- =============================================
-- Check payments table columns:
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'payments' AND column_name IN ('credit_card_fee', 'net_amount')
-- ORDER BY column_name;
