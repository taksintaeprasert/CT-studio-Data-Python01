-- Migration V8: Add daily metrics columns to chat_counts table
-- Run this in Supabase SQL Editor

-- Add new columns for daily metrics tracking
ALTER TABLE chat_counts
ADD COLUMN IF NOT EXISTS walk_in_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS google_review_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS follow_up_closed INTEGER DEFAULT 0;

-- Add comments
COMMENT ON COLUMN chat_counts.walk_in_count IS 'Number of walk-in customers for this date';
COMMENT ON COLUMN chat_counts.google_review_count IS 'Number of Google reviews received for this date';
COMMENT ON COLUMN chat_counts.follow_up_closed IS 'Number of deals closed from follow-up for this date';
