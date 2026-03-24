-- =============================================
-- מיגרציה: הוספת שדות דדליין נפרדים
-- =============================================
-- 
-- שינוי מבנה:
-- due_date + due_time = שעת התחלה מבוקשת (לשיבוץ)
-- deadline_date + deadline_time = דדליין אמיתי (להתראות)
--

-- הוספת שדה תאריך דדליין
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS deadline_date DATE;

-- הוספת שדה שעת דדליין
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS deadline_time TIME;

-- אינדקס לשיפור ביצועים
CREATE INDEX IF NOT EXISTS idx_tasks_deadline_date 
ON public.tasks(deadline_date) 
WHERE deadline_date IS NOT NULL;

-- הערה על השדות
COMMENT ON COLUMN public.tasks.due_date IS 'תאריך התחלה מבוקש (לשיבוץ)';
COMMENT ON COLUMN public.tasks.due_time IS 'שעת התחלה מבוקשת (לשיבוץ)';
COMMENT ON COLUMN public.tasks.deadline_date IS 'תאריך דדליין - עד מתי לסיים';
COMMENT ON COLUMN public.tasks.deadline_time IS 'שעת דדליין - עד איזו שעה לסיים (אופציונלי)';

