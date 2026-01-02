-- Migration: Add is_fixed column to tasks table
-- Version: 017
-- Description: Adds support for fixed (immovable) tasks like Google Calendar events

-- הוספת עמודת is_fixed לטבלת המשימות
-- משימות קבועות (כמו אירועי גוגל) לא ניתנות להזזה על ידי המשבץ האוטומטי

-- בדיקה אם העמודה כבר קיימת
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tasks' AND column_name = 'is_fixed'
    ) THEN
        ALTER TABLE tasks ADD COLUMN is_fixed BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- עדכון כל האירועים שהגיעו מגוגל להיות קבועים
UPDATE tasks 
SET is_fixed = TRUE 
WHERE is_from_google = TRUE 
   OR google_event_id IS NOT NULL;

-- אינדקס לשיפור ביצועים
CREATE INDEX IF NOT EXISTS idx_tasks_is_fixed ON tasks(is_fixed) WHERE is_fixed = TRUE;

-- הוספת הערה לתיעוד
COMMENT ON COLUMN tasks.is_fixed IS 'משימות קבועות לא ניתנות להזזה על ידי המשבץ האוטומטי. אירועי גוגל הם תמיד קבועים.';
