-- Migration v21: Update DELETE policy for booking_messages
-- Allow all authenticated users to delete any booking message (except system messages)

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can delete their own booking messages" ON booking_messages;

-- Create new policy that allows all authenticated users to delete any message
-- System messages (sender_type = 'system') cannot be deleted (enforced in frontend)
CREATE POLICY "Authenticated users can delete any booking message"
ON booking_messages FOR DELETE
TO authenticated
USING (true);

COMMENT ON POLICY "Authenticated users can delete any booking message" ON booking_messages IS 'Allow all authenticated users to delete any booking message. System messages are protected by frontend logic.';
