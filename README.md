# תיקון מערכת דדליין והתראות

## מה השתנה

### מבנה חדש:
| שדה | תפקיד | אופציונלי |
|-----|-------|-----------|
| `due_date` + `due_time` | שעת התחלה לשיבוץ | due_time אופציונלי |
| `deadline_date` + `deadline_time` | דדליין אמיתי | שניהם אופציונליים |

### התנהגות חדשה:
- **אם יש שעת התחלה** (due_time) - המשימה תשובץ בדיוק בשעה הזו
- **אם אין שעת התחלה** - המערכת משבצת אוטומטית
- **התראות יקפצו רק** כשיש deadline_date ולא עומדים בו!

## הוראות התקנה

### שלב 1: מיגרציה ב-Supabase
1. היכנסי ל-Supabase Dashboard
2. לכי ל-SQL Editor
3. הריצי את הקוד מהקובץ:
   `supabase/migrations/021_add_deadline_fields.sql`

### שלב 2: העלאת קבצים
העתיקי את כל תיקיית `src` לפרויקט (תדרוס את הקיים)

### שלב 3: דחיפה ל-GitHub
```bash
git add .
git commit -m "מערכת דדליין חדשה"
git push
```

## קבצים שהשתנו
- `src/App.jsx` - ללא שינוי (שחזור)
- `src/components/DailyView/SimpleTaskForm.jsx` - טופס עם שדות דדליין חדשים
- `src/utils/smartSchedulerV4.js` - שיבוץ לפי שעת התחלה
- `src/utils/deadlineConflictDetector.js` - התראות רק על דדליין אמיתי
- `supabase/migrations/021_add_deadline_fields.sql` - שדות חדשים ב-DB
