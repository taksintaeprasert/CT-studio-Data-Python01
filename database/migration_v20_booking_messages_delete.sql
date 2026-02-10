-- Migration v20: Add DELETE policy for booking_messages
-- Allow users to delete their own messages

-- Add DELETE policy for booking_messages
CREATE POLICY "Users can delete their own booking messages"
ON booking_messages FOR DELETE
TO authenticated
USING (
  sender_id = (SELECT id FROM staff WHERE auth_user_id = auth.uid())
);

COMMENT ON POLICY "Users can delete their own booking messages" ON booking_messages IS 'Allow authenticated users to delete only their own messages (not system messages)';
