-- Supabase/Postgres schema for message storage

-- messages table stores message content and metadata
CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  channel_id TEXT NOT NULL,
  user_id_hash TEXT NOT NULL,
  content TEXT,
  timestamp TIMESTAMP WITH TIME ZONE,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- archive table for messages that were removed due to retention
CREATE TABLE IF NOT EXISTS messages_archive (
  id BIGSERIAL PRIMARY KEY,
  channel_id TEXT,
  user_id_hash TEXT,
  content TEXT,
  timestamp TIMESTAMP WITH TIME ZONE,
  metadata JSONB,
  archived_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- channels metadata
CREATE TABLE IF NOT EXISTS channels (
  id TEXT PRIMARY KEY,
  name TEXT,
  platform TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- analytics table for daily aggregates
CREATE TABLE IF NOT EXISTS analytics (
  id BIGSERIAL PRIMARY KEY,
  channel_id TEXT,
  message_count INTEGER,
  active_users INTEGER,
  date DATE
);
