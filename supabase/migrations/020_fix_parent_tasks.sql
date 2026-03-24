-- תיקון משימות הורה שלא מסומנות נכון
-- =======================================
-- הרצה: העתיקי את הקוד ל-Supabase SQL Editor והריצי

-- שלב 1: סמן כל משימה שיש לה ילדים כ-is_project = true
UPDATE tasks
SET is_project = true
WHERE id IN (
  SELECT DISTINCT parent_task_id 
  FROM tasks 
  WHERE parent_task_id IS NOT NULL
)
AND (is_project IS NULL OR is_project = false);

-- שלב 2: הצג כמה משימות תוקנו
SELECT 
  (SELECT COUNT(*) FROM tasks WHERE is_project = true) as parent_tasks,
  (SELECT COUNT(*) FROM tasks WHERE parent_task_id IS NOT NULL) as child_tasks;
