-- Migration V17: Add separate completion tracking for artist and sales
-- This allows tracking when artist completes service vs when sales confirms completion
-- Run this in Supabase SQL Editor

-- =============================================
-- 1. ADD COMPLETION TRACKING COLUMNS
-- =============================================
-- Add artist completion timestamp
ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS artist_completed_at TIMESTAMP WITH TIME ZONE;

-- Add sales completion timestamp
ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS sales_completed_at TIMESTAMP WITH TIME ZONE;

-- =============================================
-- 2. CREATE INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_order_items_artist_completed ON order_items(artist_completed_at);
CREATE INDEX IF NOT EXISTS idx_order_items_sales_completed ON order_items(sales_completed_at);

-- =============================================
-- 3. ADD COMMENTS
-- =============================================
COMMENT ON COLUMN order_items.artist_completed_at IS 'Timestamp when artist marked service as completed';
COMMENT ON COLUMN order_items.sales_completed_at IS 'Timestamp when sales confirmed service completion';

-- =============================================
-- 4. CREATE artist_notifications TABLE
-- =============================================
-- For tracking notifications shown to artists
CREATE TABLE IF NOT EXISTS artist_notifications (
  id SERIAL PRIMARY KEY,
  artist_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  notification_type VARCHAR(50) NOT NULL CHECK (notification_type IN ('new_queue', 'schedule_change')),
  order_item_id INTEGER NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- 5. CREATE INDEXES FOR NOTIFICATIONS
-- =============================================
CREATE INDEX IF NOT EXISTS idx_artist_notifications_artist ON artist_notifications(artist_id);
CREATE INDEX IF NOT EXISTS idx_artist_notifications_created ON artist_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_artist_notifications_read ON artist_notifications(is_read);

-- =============================================
-- 6. ENABLE RLS FOR NOTIFICATIONS
-- =============================================
ALTER TABLE artist_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" ON artist_notifications FOR ALL USING (true);

-- =============================================
-- 7. ADD COMMENTS FOR NOTIFICATIONS TABLE
-- =============================================
COMMENT ON TABLE artist_notifications IS 'Stores notifications for artists about new queues and schedule changes';
COMMENT ON COLUMN artist_notifications.artist_id IS 'Artist receiving this notification';
COMMENT ON COLUMN artist_notifications.notification_type IS 'Type: new_queue (new assignment) or schedule_change (date modified)';
COMMENT ON COLUMN artist_notifications.order_item_id IS 'Related order item';
COMMENT ON COLUMN artist_notifications.message IS 'Notification message text';
COMMENT ON COLUMN artist_notifications.is_read IS 'Whether artist has seen this notification';

-- =============================================
-- 8. CREATE FUNCTION TO AUTO-CREATE NOTIFICATIONS
-- =============================================
-- Function to create notification when order_item is assigned or modified
CREATE OR REPLACE FUNCTION create_artist_notification()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if artist_id changed (new assignment)
  IF (TG_OP = 'INSERT' AND NEW.artist_id IS NOT NULL) OR
     (TG_OP = 'UPDATE' AND OLD.artist_id IS DISTINCT FROM NEW.artist_id AND NEW.artist_id IS NOT NULL) THEN
    INSERT INTO artist_notifications (artist_id, notification_type, order_item_id, message)
    SELECT
      NEW.artist_id,
      'new_queue',
      NEW.id,
      'คุณได้รับคิวใหม่: ' || COALESCE(NEW.booking_title, 'บริการ #' || NEW.id)
    WHERE NEW.appointment_date IS NOT NULL;
  END IF;

  -- Check if appointment_date changed (schedule change)
  IF TG_OP = 'UPDATE' AND
     OLD.appointment_date IS DISTINCT FROM NEW.appointment_date AND
     NEW.artist_id IS NOT NULL AND
     NEW.appointment_date IS NOT NULL THEN
    INSERT INTO artist_notifications (artist_id, notification_type, order_item_id, message)
    VALUES (
      NEW.artist_id,
      'schedule_change',
      NEW.id,
      'นัดหมายถูกเลื่อน: ' || COALESCE(NEW.booking_title, 'บริการ #' || NEW.id) ||
      ' เป็นวันที่ ' || TO_CHAR(NEW.appointment_date, 'DD/MM/YYYY')
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 9. CREATE TRIGGER FOR AUTO-NOTIFICATIONS
-- =============================================
DROP TRIGGER IF EXISTS trigger_artist_notification ON order_items;
CREATE TRIGGER trigger_artist_notification
  AFTER INSERT OR UPDATE ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION create_artist_notification();

-- =============================================
-- 10. VERIFY MIGRATION
-- =============================================
-- Check order_items columns:
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'order_items'
--   AND column_name IN ('artist_completed_at', 'sales_completed_at')
-- ORDER BY column_name;

-- Check notifications table:
-- SELECT * FROM artist_notifications ORDER BY created_at DESC LIMIT 10;
