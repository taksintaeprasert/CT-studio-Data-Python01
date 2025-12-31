-- Migration: Add nickname and age columns to customers table
-- Run this in Supabase SQL Editor

-- Add nickname column (optional)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS nickname VARCHAR(100);

-- Add age column (optional)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS age INTEGER;

-- Add comment for documentation
COMMENT ON COLUMN customers.nickname IS 'Customer nickname (optional)';
COMMENT ON COLUMN customers.age IS 'Customer age (optional)';
