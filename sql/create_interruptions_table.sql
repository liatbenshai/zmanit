-- טבלת הפרעות לניתוח
-- ================================
-- יש להריץ ב-Supabase SQL Editor

-- יצירת הטבלה
CREATE TABLE IF NOT EXISTS interruptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    type VARCHAR(50) NOT NULL,
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    task_title TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- אינדקסים לביצועים
CREATE INDEX IF NOT EXISTS idx_interruptions_user_id ON interruptions(user_id);
CREATE INDEX IF NOT EXISTS idx_interruptions_started_at ON interruptions(started_at);
CREATE INDEX IF NOT EXISTS idx_interruptions_type ON interruptions(type);
CREATE INDEX IF NOT EXISTS idx_interruptions_user_date ON interruptions(user_id, started_at);

-- RLS - אבטחה ברמת שורה
ALTER TABLE interruptions ENABLE ROW LEVEL SECURITY;

-- מדיניות: משתמש רואה רק את ההפרעות שלו
CREATE POLICY "Users can view own interruptions" 
ON interruptions FOR SELECT 
USING (auth.uid() = user_id);

-- מדיניות: משתמש יכול להוסיף הפרעות
CREATE POLICY "Users can insert own interruptions" 
ON interruptions FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- מדיניות: משתמש יכול לעדכן הפרעות שלו
CREATE POLICY "Users can update own interruptions" 
ON interruptions FOR UPDATE 
USING (auth.uid() = user_id);

-- מדיניות: משתמש יכול למחוק הפרעות שלו
CREATE POLICY "Users can delete own interruptions" 
ON interruptions FOR DELETE 
USING (auth.uid() = user_id);

-- הענקת הרשאות
GRANT ALL ON interruptions TO authenticated;

-- הוספת תיאור לטבלה
COMMENT ON TABLE interruptions IS 'מעקב הפרעות לניתוח וייעול זמן עבודה';
COMMENT ON COLUMN interruptions.type IS 'סוג הפרעה: client_call, phone_call, meeting, distraction, break, technical, urgent_task, other';
COMMENT ON COLUMN interruptions.duration_seconds IS 'אורך ההפרעה בשניות';
COMMENT ON COLUMN interruptions.task_title IS 'שם המשימה שהופסקה (אם רלוונטי)';
