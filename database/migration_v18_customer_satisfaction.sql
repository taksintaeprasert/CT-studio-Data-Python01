-- Migration V18: Customer Satisfaction Ratings
-- Run this in Supabase SQL Editor

-- =============================================
-- CUSTOMER SATISFACTION RATINGS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS customer_satisfaction (
  id SERIAL PRIMARY KEY,
  artist_id INTEGER NOT NULL REFERENCES staff(id),
  service_category VARCHAR(50) NOT NULL,
  service_other TEXT,
  -- Rating fields (1-5 scale)
  pain_level INTEGER CHECK (pain_level >= 1 AND pain_level <= 5),
  artist_service_quality INTEGER CHECK (artist_service_quality >= 1 AND artist_service_quality <= 5),
  result_satisfaction INTEGER CHECK (result_satisfaction >= 1 AND result_satisfaction <= 5),
  front_desk_service INTEGER CHECK (front_desk_service >= 1 AND front_desk_service <= 5),
  chat_response_quality INTEGER CHECK (chat_response_quality >= 1 AND chat_response_quality <= 5),
  -- Metadata
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_satisfaction_artist ON customer_satisfaction(artist_id);
CREATE INDEX IF NOT EXISTS idx_satisfaction_category ON customer_satisfaction(service_category);
CREATE INDEX IF NOT EXISTS idx_satisfaction_date ON customer_satisfaction(submitted_at);

-- =============================================
-- RLS POLICIES
-- =============================================
ALTER TABLE customer_satisfaction ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" ON customer_satisfaction FOR ALL USING (true);

-- =============================================
-- COMMENTS
-- =============================================
COMMENT ON TABLE customer_satisfaction IS 'Customer satisfaction ratings for artists and services';
COMMENT ON COLUMN customer_satisfaction.pain_level IS 'Pain level during service: 1=Most painful, 5=No pain';
COMMENT ON COLUMN customer_satisfaction.artist_service_quality IS 'Artist service quality: 1=Poor, 5=Excellent';
COMMENT ON COLUMN customer_satisfaction.result_satisfaction IS 'Satisfaction with result: 1=Poor, 5=Excellent';
COMMENT ON COLUMN customer_satisfaction.front_desk_service IS 'Front desk service quality: 1=Poor, 5=Excellent';
COMMENT ON COLUMN customer_satisfaction.chat_response_quality IS 'Chat response quality: 1=Poor, 5=Excellent';
