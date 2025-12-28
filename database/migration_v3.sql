-- Migration V3: Marketing Data for Dashboard metrics
-- Run this in Supabase SQL Editor

-- Create marketing_data table for daily chat inquiries
CREATE TABLE IF NOT EXISTS marketing_data (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  chat_inquiries INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create ads_spending table for monthly ads budget
CREATE TABLE IF NOT EXISTS ads_spending (
  id SERIAL PRIMARY KEY,
  month DATE NOT NULL UNIQUE, -- First day of the month
  amount DECIMAL(12, 2) DEFAULT 0,
  platform VARCHAR(50) DEFAULT 'all', -- facebook, google, tiktok, all
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add contact_channel to orders table if not exists
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS contact_channel VARCHAR(50);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_marketing_data_date ON marketing_data(date);
CREATE INDEX IF NOT EXISTS idx_ads_spending_month ON ads_spending(month);
CREATE INDEX IF NOT EXISTS idx_orders_contact_channel ON orders(contact_channel);

-- Enable RLS
ALTER TABLE marketing_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE ads_spending ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all for authenticated users)
CREATE POLICY "marketing_data_all" ON marketing_data FOR ALL USING (true);
CREATE POLICY "ads_spending_all" ON ads_spending FOR ALL USING (true);
