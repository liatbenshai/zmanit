-- ============================================
-- טבלאות מערכת למידה - זמנית
-- ============================================
-- הריצי את הקוד הזה ב-Supabase SQL Editor
-- https://supabase.com/dashboard → SQL Editor
-- ============================================

-- 1. טבלת היסטוריית משימות שהושלמו
CREATE TABLE IF NOT EXISTS learning_completed_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  task_id UUID,
  title TEXT,
  task_type TEXT DEFAULT 'general',
  category TEXT DEFAULT 'work',
  estimated_duration INTEGER DEFAULT 0,
  actual_duration INTEGER DEFAULT 0,
  scheduled_time TEXT,
  actual_start_time TEXT,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  date DATE DEFAULT CURRENT_DATE,
  day_of_week INTEGER,
  hour_completed INTEGER,
  priority TEXT DEFAULT 'normal',
  was_late BOOLEAN DEFAULT FALSE,
  late_minutes INTEGER DEFAULT 0,
  accuracy_ratio DECIMAL(5,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- אינדקסים לביצועים
CREATE INDEX IF NOT EXISTS idx_learning_tasks_user ON learning_completed_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_tasks_date ON learning_completed_tasks(date);
CREATE INDEX IF NOT EXISTS idx_learning_tasks_type ON learning_completed_tasks(task_type);

-- 2. טבלת הפרעות
CREATE TABLE IF NOT EXISTS learning_interruptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  task_id UUID,
  task_title TEXT,
  type TEXT DEFAULT 'other', -- phone, person, email, meeting, break, other
  description TEXT,
  duration INTEGER DEFAULT 5, -- דקות
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  date DATE DEFAULT CURRENT_DATE,
  day_of_week INTEGER,
  hour INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interruptions_user ON learning_interruptions(user_id);
CREATE INDEX IF NOT EXISTS idx_interruptions_date ON learning_interruptions(date);

-- 3. טבלת סיכומים יומיים
CREATE TABLE IF NOT EXISTS learning_daily_summaries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  planned_tasks INTEGER DEFAULT 0,
  completed_tasks INTEGER DEFAULT 0,
  completion_rate INTEGER DEFAULT 0,
  planned_minutes INTEGER DEFAULT 0,
  actual_minutes INTEGER DEFAULT 0,
  time_deviation INTEGER DEFAULT 0,
  late_starts INTEGER DEFAULT 0,
  interruptions INTEGER DEFAULT 0,
  productivity_score INTEGER DEFAULT 0,
  best_hour INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_summaries_user ON learning_daily_summaries(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_summaries_date ON learning_daily_summaries(date);

-- 4. טבלת דפוסי משתמש (קאש לניתוחים)
CREATE TABLE IF NOT EXISTS learning_user_patterns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  estimation_multiplier DECIMAL(3,2) DEFAULT 1.0,
  best_hours INTEGER[] DEFAULT '{}',
  worst_hours INTEGER[] DEFAULT '{}',
  main_distraction TEXT,
  avg_late_minutes INTEGER DEFAULT 0,
  total_tasks_analyzed INTEGER DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_patterns_user ON learning_user_patterns(user_id);

-- 5. טבלת התחלות באיחור
CREATE TABLE IF NOT EXISTS learning_late_starts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  task_id UUID,
  task_title TEXT,
  task_type TEXT DEFAULT 'general',
  scheduled_time TEXT,
  actual_start_time TEXT,
  late_minutes INTEGER DEFAULT 0,
  date DATE DEFAULT CURRENT_DATE,
  day_of_week INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_late_starts_user ON learning_late_starts(user_id);
CREATE INDEX IF NOT EXISTS idx_late_starts_date ON learning_late_starts(date);

-- ============================================
-- Row Level Security (RLS) - אבטחה
-- ============================================

-- הפעלת RLS על כל הטבלאות
ALTER TABLE learning_completed_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_interruptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_daily_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_user_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_late_starts ENABLE ROW LEVEL SECURITY;

-- מדיניות: משתמשים רואים ומעדכנים רק את הנתונים שלהם

-- learning_completed_tasks
CREATE POLICY "Users can view own completed tasks" ON learning_completed_tasks
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own completed tasks" ON learning_completed_tasks
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own completed tasks" ON learning_completed_tasks
  FOR DELETE USING (auth.uid() = user_id);

-- learning_interruptions
CREATE POLICY "Users can view own interruptions" ON learning_interruptions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own interruptions" ON learning_interruptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own interruptions" ON learning_interruptions
  FOR DELETE USING (auth.uid() = user_id);

-- learning_daily_summaries
CREATE POLICY "Users can view own summaries" ON learning_daily_summaries
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own summaries" ON learning_daily_summaries
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own summaries" ON learning_daily_summaries
  FOR UPDATE USING (auth.uid() = user_id);

-- learning_user_patterns
CREATE POLICY "Users can view own patterns" ON learning_user_patterns
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own patterns" ON learning_user_patterns
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own patterns" ON learning_user_patterns
  FOR UPDATE USING (auth.uid() = user_id);

-- learning_late_starts
CREATE POLICY "Users can view own late starts" ON learning_late_starts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own late starts" ON learning_late_starts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own late starts" ON learning_late_starts
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- סיום! ✅
-- ============================================
-- אחרי שהרצת את הקוד הזה, החליפי את קובץ learningEngine.js
-- בגרסה החדשה שתומכת ב-Supabase
-- ============================================
