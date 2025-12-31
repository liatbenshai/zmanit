-- =============================================
-- טבלת הגדרות אפליקציה למשתמש
-- =============================================

CREATE TABLE IF NOT EXISTS app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- שעות עבודה
  work_start_time TIME DEFAULT '08:30:00',
  work_end_time TIME DEFAULT '16:15:00',
  
  -- ימי עבודה (מערך: 0=ראשון, 6=שבת)
  work_days INTEGER[] DEFAULT '{0,1,2,3,4}',
  
  -- שישי (אופציונלי)
  friday_enabled BOOLEAN DEFAULT true,
  friday_start_time TIME DEFAULT '08:30:00',
  friday_end_time TIME DEFAULT '12:00:00',
  
  -- הפסקות
  break_enabled BOOLEAN DEFAULT false,
  break_start_time TIME DEFAULT '12:00:00',
  break_end_time TIME DEFAULT '12:30:00',
  break_between_tasks INTEGER DEFAULT 5, -- דקות בין משימות
  
  -- הגדרות טיימר
  default_task_duration INTEGER DEFAULT 30,
  min_block_size INTEGER DEFAULT 15,
  max_block_size INTEGER DEFAULT 90,
  
  -- הגדרות התראות
  reminder_minutes INTEGER DEFAULT 5,
  notify_on_time BOOLEAN DEFAULT true,
  notify_on_end BOOLEAN DEFAULT true,
  repeat_every_minutes INTEGER DEFAULT 10,
  
  -- מטא
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- אינדקס
CREATE INDEX IF NOT EXISTS idx_app_settings_user_id ON app_settings(user_id);

-- RLS
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settings" ON app_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings" ON app_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings" ON app_settings
  FOR UPDATE USING (auth.uid() = user_id);

-- =============================================
-- טבלת סוגי משימות מותאמים אישית
-- =============================================

CREATE TABLE IF NOT EXISTS custom_task_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- פרטי סוג המשימה
  type_id VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  icon VARCHAR(10) DEFAULT '📋',
  category VARCHAR(20) DEFAULT 'work', -- work, family, home
  
  -- צבעים
  bg_color VARCHAR(20) DEFAULT '#f3f4f6',
  border_color VARCHAR(20) DEFAULT '#d1d5db',
  text_color VARCHAR(20) DEFAULT '#374151',
  gradient VARCHAR(100),
  
  -- הגדרות זמן
  default_duration INTEGER DEFAULT 30,
  time_ratio DECIMAL(3,2) DEFAULT 1.0, -- יחס זמן (לתמלול: 3)
  input_type VARCHAR(20), -- recording, pages, words
  
  -- שעות מועדפות
  preferred_start_hour DECIMAL(4,2),
  preferred_end_hour DECIMAL(4,2),
  
  -- סטטוס
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  
  -- מטא
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, type_id)
);

-- אינדקס
CREATE INDEX IF NOT EXISTS idx_custom_task_types_user_id ON custom_task_types(user_id);

-- RLS
ALTER TABLE custom_task_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own task types" ON custom_task_types
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own task types" ON custom_task_types
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own task types" ON custom_task_types
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own task types" ON custom_task_types
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- פונקציה לעדכון updated_at
-- =============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- טריגרים
DROP TRIGGER IF EXISTS update_app_settings_updated_at ON app_settings;
CREATE TRIGGER update_app_settings_updated_at
  BEFORE UPDATE ON app_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_custom_task_types_updated_at ON custom_task_types;
CREATE TRIGGER update_custom_task_types_updated_at
  BEFORE UPDATE ON custom_task_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
