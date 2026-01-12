# 🔄 עדכונים לזמנית - ינואר 2026

## סיכום השינויים

### 1. סנכרון בין תצוגות ✅
- **בעיה:** הדשבורד, תצוגה יומית ותצוגה שבועית לא היו מסונכרנים
- **פתרון:** הוספת `dataVersion` ל-TaskContext שמתעדכן בכל שינוי
- כל הקומפוננטות מאזינות לשינויים ומתעדכנות אוטומטית

### 2. מערכת התראות מאוחדת ✅
- **בעיה:** היו 3 מערכות התראה נפרדות שגרמו לבלאגן
- **פתרון:** `UnifiedNotificationManager` שמאחד את כולם
- מונע התראות כפולות ותומך ב-popup ו-toast

### 3. תצוגה ממוקדת (Focus Mode) ✅
- **חדש:** כפתור "▶️ התחל" בכל משימה בדשבורד ובתצוגה יומית
- לחיצה פותחת מסך מיקוד מלא עם טיימר גדול
- תמיכה ב-בלת"מים והפרעות מתוך מסך המיקוד

### 4. תיעוד הפרעות ✅
- **חדש:** כפתור "⏸️ הפרעה - תעד והמשך" במסך המיקוד
- 8 סוגי הפרעות: שיחת לקוח, טלפון, פגישה, הסחת דעת, הפסקה, בעיה טכנית, עמית לעבודה, אחר
- נשמר ב-Supabase לניתוח עתידי

### 5. עיצוב משופר לדשבורד ✅
- כרטיסי משימות עם עיצוב ברור יותר
- סימון צבעוני למשימות באיחור (אדום) ופעילות (ירוק)
- תגיות "דחוף", "באיחור", "פעיל" ברורות
- כפתור "התחל" בולט

---

## קבצים חדשים

| קובץ | תיאור |
|------|--------|
| `src/hooks/useSchedule.js` | Hook מרכזי לחישוב שיבוץ |
| `src/components/Notifications/UnifiedNotificationManager.jsx` | מנהל התראות מאוחד |

---

## קבצים מעודכנים

| קובץ | שינויים |
|------|----------|
| `src/context/TaskContext.jsx` | הוספת dataVersion, lastUpdated, forceRefresh |
| `src/App.jsx` | החלפה למנהל התראות מאוחד |
| `src/components/Layout/Header.jsx` | כפתור סנכרון 🔄 |
| `src/components/DailyView/DailyView.jsx` | תצוגה ממוקדת + dataVersion |
| `src/components/DailyView/DailyTaskCard.jsx` | כפתור "התחל במיקוד" |
| `src/components/Dashboard/SmartDashboard.jsx` | תצוגה ממוקדת + עיצוב משופר |
| `src/components/Planning/WeeklyPlannerPro.jsx` | dataVersion לסנכרון |
| `src/components/ADHD/FullScreenFocus.jsx` | תיעוד הפרעות |

---

## התקנה

1. חלצי את ה-ZIP לתיקיית הפרויקט
2. הקבצים יעברו למקומות הנכונים (שומרים על מבנה התיקיות)
3. הריצי `npm install` (ללא תלויות חדשות)
4. הריצי `npm run build` לבדיקה

---

## שימוש

### התחלת עבודה במצב מיקוד:
1. לחצי על "▶️ התחל" במשימה כלשהי
2. יפתח מסך מיקוד מלא עם טיימר
3. כפתורים זמינים:
   - ⏸️ השהה / ▶️ המשך
   - ✅ סיימתי!
   - ⏸️ הפרעה - תעד והמשך
   - 🚨 בלת"ם - משימה דחופה
   - 📌 מזעור (הטיימר ממשיך ברקע)

### סנכרון ידני:
- לחצי על 🔄 ב-Header
- יציג גרסת נתונים וזמן עדכון אחרון

---

## טבלת Supabase נדרשת

אם עוד אין טבלת `interruptions`, צרי אותה:

```sql
CREATE TABLE interruptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  type TEXT NOT NULL,
  description TEXT,
  task_id UUID REFERENCES tasks(id),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_minutes INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE interruptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own interruptions"
  ON interruptions
  FOR ALL
  USING (auth.uid() = user_id);
```

---

*עודכן: ינואר 2026*
