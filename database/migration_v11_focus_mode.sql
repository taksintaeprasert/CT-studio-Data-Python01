-- Migration V11: Focus Mode - Booking Chat & Check-in System
-- Add features for sales focus mode workflow
-- Run this in Supabase SQL Editor

-- =============================================
-- 1. ADD COLUMNS TO order_items
-- =============================================
-- Add item_price to track individual service price
ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS item_price DECIMAL(10, 2) DEFAULT 0;

-- Add check_in_time to track when customer arrives for service
ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS check_in_time TIMESTAMP WITH TIME ZONE;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_order_items_check_in ON order_items(check_in_time);

-- Add comments
COMMENT ON COLUMN order_items.item_price IS 'Price of this specific service item';
COMMENT ON COLUMN order_items.check_in_time IS 'Timestamp when customer checked in for this service';

-- =============================================
-- 2. ADD COLUMNS TO payments
-- =============================================
-- Add credit_card_fee to track 3% fee for credit card payments
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS credit_card_fee DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS net_amount DECIMAL(10, 2);

-- Add index
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);

-- Add comments
COMMENT ON COLUMN payments.credit_card_fee IS '3% fee for credit card payments';
COMMENT ON COLUMN payments.net_amount IS 'Net amount after deducting fees (amount - credit_card_fee)';

-- =============================================
-- 3. CREATE booking_messages TABLE
-- =============================================
-- For chat/messaging system per booking (order_item)
CREATE TABLE IF NOT EXISTS booking_messages (
  id SERIAL PRIMARY KEY,
  order_item_id INTEGER NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  sender_id INTEGER REFERENCES staff(id) ON DELETE SET NULL,
  sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('staff', 'system')),
  message_type VARCHAR(20) NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'url', 'file')),
  message_text TEXT,
  file_url TEXT,
  file_name TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_booking_messages_order_item ON booking_messages(order_item_id);
CREATE INDEX IF NOT EXISTS idx_booking_messages_sender ON booking_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_booking_messages_created ON booking_messages(created_at DESC);

-- Add comments
COMMENT ON TABLE booking_messages IS 'Chat/messaging system for each booking (order_item)';
COMMENT ON COLUMN booking_messages.order_item_id IS 'Reference to the booking (order_item)';
COMMENT ON COLUMN booking_messages.sender_id IS 'Staff who sent the message (null for system messages)';
COMMENT ON COLUMN booking_messages.sender_type IS 'Type of sender: staff or system';
COMMENT ON COLUMN booking_messages.message_type IS 'Type of message: text, url, or file attachment';
COMMENT ON COLUMN booking_messages.message_text IS 'Text content of the message';
COMMENT ON COLUMN booking_messages.file_url IS 'URL of attached file (if message_type is file)';
COMMENT ON COLUMN booking_messages.file_name IS 'Original filename of attached file';
COMMENT ON COLUMN booking_messages.is_read IS 'Whether the message has been read';

-- =============================================
-- 4. ENABLE ROW LEVEL SECURITY
-- =============================================
ALTER TABLE booking_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to read all messages
CREATE POLICY "Authenticated users can read all booking messages"
ON booking_messages FOR SELECT
TO authenticated
USING (true);

-- Policy: Allow authenticated users to insert messages
CREATE POLICY "Authenticated users can insert booking messages"
ON booking_messages FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy: Allow authenticated users to update messages
CREATE POLICY "Authenticated users can update booking messages"
ON booking_messages FOR UPDATE
TO authenticated
USING (true);

-- =============================================
-- 5. CREATE HELPER FUNCTIONS
-- =============================================

-- Function to get booking messages with sender info
CREATE OR REPLACE FUNCTION get_booking_messages(p_order_item_id INTEGER)
RETURNS TABLE (
  id INTEGER,
  order_item_id INTEGER,
  sender_name VARCHAR(255),
  sender_type VARCHAR(20),
  message_type VARCHAR(20),
  message_text TEXT,
  file_url TEXT,
  file_name TEXT,
  is_read BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    bm.id,
    bm.order_item_id,
    COALESCE(s.staff_name, 'System') as sender_name,
    bm.sender_type,
    bm.message_type,
    bm.message_text,
    bm.file_url,
    bm.file_name,
    bm.is_read,
    bm.created_at
  FROM booking_messages bm
  LEFT JOIN staff s ON bm.sender_id = s.id
  WHERE bm.order_item_id = p_order_item_id
  ORDER BY bm.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_booking_messages(INTEGER) TO authenticated;

-- Function to mark messages as read
CREATE OR REPLACE FUNCTION mark_messages_as_read(p_order_item_id INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE booking_messages
  SET is_read = true
  WHERE order_item_id = p_order_item_id AND is_read = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION mark_messages_as_read(INTEGER) TO authenticated;

-- Function to calculate payment with credit card fee
CREATE OR REPLACE FUNCTION calculate_payment_fee(
  p_amount DECIMAL,
  p_payment_method VARCHAR
)
RETURNS TABLE (
  credit_card_fee DECIMAL,
  net_amount DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    CASE
      WHEN LOWER(p_payment_method) = 'credit card'
      THEN ROUND(p_amount * 0.03, 2)
      ELSE 0::DECIMAL
    END as credit_card_fee,
    CASE
      WHEN LOWER(p_payment_method) = 'credit card'
      THEN p_amount - ROUND(p_amount * 0.03, 2)
      ELSE p_amount
    END as net_amount;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

GRANT EXECUTE ON FUNCTION calculate_payment_fee(DECIMAL, VARCHAR) TO authenticated;

-- =============================================
-- 6. VERIFY MIGRATION
-- =============================================
-- Check order_items columns:
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'order_items' AND column_name IN ('item_price', 'check_in_time')
-- ORDER BY column_name;

-- Check payments columns:
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'payments' AND column_name IN ('credit_card_fee', 'net_amount')
-- ORDER BY column_name;

-- Check booking_messages table:
-- SELECT table_name, column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'booking_messages'
-- ORDER BY ordinal_position;

-- Test calculate_payment_fee function:
-- SELECT * FROM calculate_payment_fee(10000, 'credit card');
-- SELECT * FROM calculate_payment_fee(10000, 'cash');
