-- Migration v4: Add artist_id to order_items table
-- This allows assigning different artists to different services within the same order

-- Add artist_id column to order_items
ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS artist_id INTEGER REFERENCES staff(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_order_items_artist_id ON order_items(artist_id);

-- Create index on appointment_date for calendar queries
CREATE INDEX IF NOT EXISTS idx_order_items_appointment_date ON order_items(appointment_date);

-- Add comment to explain the column
COMMENT ON COLUMN order_items.artist_id IS 'Artist assigned to perform this specific service';
