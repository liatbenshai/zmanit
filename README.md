# 📅 Google Calendar Sync - הוראות התקנה

## מה זה עושה?
- אירועים מיומן גוגל **נהפכים למשימות אמיתיות** (עם טיימר ואפשרות סימון)
- משימות מזמנית יוצאות ליומן גוגל (עם google_event_id)
- סנכרון אוטומטי כשנכנסים לדף היומי
- **אין כפילויות** - המערכת מזהה לפי google_event_id

---

## שלב 1: הרצת Migration בדאטהבייס

1. לכי ל-Supabase → SQL Editor
2. הריצי את הקוד מ-`migration.sql`:

```sql
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS google_event_id TEXT,
ADD COLUMN IF NOT EXISTS is_from_google BOOLEAN DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_user_google_event 
ON tasks(user_id, google_event_id) 
WHERE google_event_id IS NOT NULL;
```

---

## שלב 2: החלפת קבצים

| קובץ בZIP | להעתיק ל: |
|-----------|-----------|
| `useGoogleCalendar.js` | `src/hooks/useGoogleCalendar.js` |
| `AdminSettings.jsx` | `src/Admin/AdminSettings.jsx` **וגם** `src/components/Admin/AdminSettings.jsx` |
| `src/DailyView/DailyView.jsx` | `src/DailyView/DailyView.jsx` **וגם** `src/components/DailyView/DailyView.jsx` |

---

## שלב 3: Push

```bash
git add .
git commit -m "Google Calendar real sync - events become tasks"
git push
```

---

## איך זה עובד עכשיו?

### 🔄 סנכרון אוטומטי
- כשנכנסים לדף היומי, המערכת בודקת אם יש אירועים ביומן גוגל
- אירועים חדשים **נוצרים כמשימות אמיתיות** בדאטהבייס
- אם אירוע כבר קיים (לפי google_event_id) - הוא מתעדכן

### ✅ משימות מגוגל
- מופיעות עם תגית "📅 גוגל"
- אפשר להפעיל עליהן טיימר
- אפשר לסמן אותן כהושלמו
- הן שומרות על השעה המקורית מהיומן

### 🔗 חיבור לגוגל
- עכשיו רק דרך **הדשבורד** (הגדרות → יומן גוגל)
- אין יותר כפתור התחברות בדף היומי

---

## פתרון בעיות

### "יש כפילויות"
הריצי את ה-migration כדי שהמערכת תזהה אירועים קיימים

### "אירועים לא מופיעים"
1. ודאי שאת מחוברת לגוגל (בדשבורד)
2. רענני את הדף
3. בדקי ב-Console אם יש שגיאות
