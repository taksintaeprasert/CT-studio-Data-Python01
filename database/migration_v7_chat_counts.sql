-- Migration V7: Create chat_counts table for tracking daily chat counts per staff
-- Run this in Supabase SQL Editor

-- Create chat_counts table
CREATE TABLE IF NOT EXISTS chat_counts (
    id SERIAL PRIMARY KEY,
    staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    chat_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Unique constraint: one entry per staff per day
    UNIQUE(staff_id, date)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_chat_counts_staff_date ON chat_counts(staff_id, date);
CREATE INDEX IF NOT EXISTS idx_chat_counts_date ON chat_counts(date);

-- Enable RLS (Row Level Security)
ALTER TABLE chat_counts ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations for authenticated users
CREATE POLICY "Allow all operations for authenticated users" ON chat_counts
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Comment on table
COMMENT ON TABLE chat_counts IS 'Daily chat count tracking for sales staff to calculate conversion rate';
COMMENT ON COLUMN chat_counts.staff_id IS 'Reference to staff table';
COMMENT ON COLUMN chat_counts.date IS 'Date of the chat count';
COMMENT ON COLUMN chat_counts.chat_count IS 'Number of chats received by this staff on this date';
