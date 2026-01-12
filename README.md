# 🔄 עדכון זמנית - ינואר 2026

## מה חדש

### 1. דשבורד משופר ✅
- **ניווט ברור** - 4 כפתורים גדולים לכל העמודים: יומי, שבועי, ממוקד, תובנות
- **סיכום משימות** - רשימת משימות להיום עם פס התקדמות
- **המלצות חכמות** - התראות על משימות באיחור, יום עמוס, וכו'
- **תצוגת שבוע** - 7 ימים עם מספר משימות לכל יום
- **כפתור התחל** - על כל משימה לפתיחת מצב מיקוד

### 2. תצוגה ממוקדת ✅
- לחיצה על "▶️" פותחת מסך מיקוד מלא
- טיימר גדול וברור
- כפתור "⏸️ הפרעה" לתיעוד הפרעות
- כפתור "🚨 בלת"ם" להוספת משימה דחופה

### 3. תיעוד הפרעות ✅
- 8 סוגי הפרעות: שיחת לקוח, טלפון, פגישה, הסחת דעת, הפסקה, בעיה טכנית, עמית לעבודה, אחר
- נשמר ב-Supabase

### 4. סנכרון בין תצוגות ✅
- כל התצוגות מסונכרנות
- כפתור 🔄 ב-Header לסנכרון ידני

---

## קבצים ב-ZIP

```
src/
├── App.jsx                          # עודכן
├── context/
│   └── TaskContext.jsx              # עודכן - dataVersion
├── hooks/
│   └── useSchedule.js               # חדש
├── components/
│   ├── Dashboard/
│   │   └── SmartDashboard.jsx       # חדש - דשבורד משופר
│   ├── DailyView/
│   │   ├── DailyView.jsx            # עודכן
│   │   └── DailyTaskCard.jsx        # עודכן - כפתור התחל
│   ├── Planning/
│   │   └── WeeklyPlannerPro.jsx     # עודכן
│   ├── Layout/
│   │   └── Header.jsx               # עודכן - כפתור סנכרון
│   ├── ADHD/
│   │   └── FullScreenFocus.jsx      # עודכן - הפרעות
│   └── Notifications/
│       └── UnifiedNotificationManager.jsx  # חדש
```

---

## התקנה

1. חלצי את ה-ZIP לתיקיית הפרויקט
2. הקבצים יעברו למקומות הנכונים
3. `npm run build` לבדיקה

---

## טבלת Supabase (אם צריך)

```sql
CREATE TABLE IF NOT EXISTS interruptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  type TEXT NOT NULL,
  description TEXT,
  task_id UUID REFERENCES tasks(id),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE interruptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own interruptions"
  ON interruptions FOR ALL USING (auth.uid() = user_id);
```

---

*עודכן: ינואר 2026*
