-- =============================================
-- Migration: Google Calendar Sync Support
-- =============================================
-- הריצי את זה ב-Supabase SQL Editor

-- 1. הוספת שדות לטבלת tasks
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS google_event_id TEXT,
ADD COLUMN IF NOT EXISTS is_from_google BOOLEAN DEFAULT FALSE;

-- 2. אינדקס למניעת כפילויות
CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_user_google_event 
ON tasks(user_id, google_event_id) 
WHERE google_event_id IS NOT NULL;

-- 3. אינדקס לחיפוש מהיר
CREATE INDEX IF NOT EXISTS idx_tasks_google_event_id 
ON tasks(google_event_id) 
WHERE google_event_id IS NOT NULL;
