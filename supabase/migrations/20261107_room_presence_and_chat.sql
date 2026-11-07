-- ====================================================================
-- Migration: In-Room Realtime Chat, Presence & Live Win Announcements
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.room_chat_messages (
  id text PRIMARY KEY,
  room_id text NOT NULL,
  game_id text NOT NULL,
  user_id uuid,
  wallet_address text NOT NULL,
  username text NOT NULL,
  message text NOT NULL,
  message_type text NOT NULL DEFAULT 'chat', -- 'chat', 'system_win', 'emoji'
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_room_chat_room ON public.room_chat_messages(room_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.room_chat_messages ENABLE ROW LEVEL SECURITY;

-- Allow public read access to messages
DROP POLICY IF EXISTS "Allow all users to read room messages" ON public.room_chat_messages;
CREATE POLICY "Allow all users to read room messages"
  ON public.room_chat_messages FOR SELECT
  USING (true);

-- Allow insert
DROP POLICY IF EXISTS "Allow users to post room messages" ON public.room_chat_messages;
CREATE POLICY "Allow users to post room messages"
  ON public.room_chat_messages FOR INSERT
  WITH CHECK (true);

