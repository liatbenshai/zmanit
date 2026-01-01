# 🛠️ מערכת הגדרות מותאמות אישית

מערכת מלאה להגדרות משתמש עם שמירה ב-Supabase.

## 📁 מבנה הקבצים

```
settings-system/
├── migrations/
│   └── 001_user_settings.sql    # טבלת הגדרות ב-Supabase
├── src/
│   ├── context/
│   │   └── SettingsContext.jsx  # Context להגדרות
│   ├── hooks/
│   │   └── useSettings.js       # Hook לשימוש בהגדרות
│   └── components/
│       └── Settings/
│           ├── index.js
│           ├── SettingsPage.jsx           # דף ראשי
│           ├── TaskTypesSettings.jsx      # סוגי משימות
│           ├── CategoriesSettings.jsx     # קטגוריות
│           ├── WorkScheduleSettings.jsx   # ימים ושעות
│           ├── NotificationsSettings.jsx  # התראות
│           ├── DisplaySettings.jsx        # תצוגה
│           └── TimerSettings.jsx          # טיימר
```

## 🚀 שלבי התקנה

### שלב 1: יצירת טבלה ב-Supabase

1. פתחי את Supabase Dashboard
2. לכי ל-SQL Editor
3. העתיקי והריצי את הקוד מ-`migrations/001_user_settings.sql`

### שלב 2: העתקת קבצים

העתיקי את הקבצים לפרויקט:

```bash
# Context
cp src/context/SettingsContext.jsx → src/context/

# Hook
cp src/hooks/useSettings.js → src/hooks/

# Components
cp src/components/Settings/* → src/components/Settings/
```

### שלב 3: עדכון App.jsx

עטפי את האפליקציה ב-SettingsProvider:

```jsx
import { SettingsProvider } from './context/SettingsContext';

function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <TaskProvider>
          {/* שאר האפליקציה */}
        </TaskProvider>
      </SettingsProvider>
    </AuthProvider>
  );
}
```

### שלב 4: הוספת נתיב להגדרות

ב-Router או בניווט:

```jsx
import { SettingsPage } from './components/Settings';

// בנתיבים
<Route path="/settings" element={<SettingsPage />} />

// או כמודל
{showSettings && <SettingsPage onClose={() => setShowSettings(false)} />}
```

### שלב 5: שימוש בהגדרות

```jsx
import { useSettings } from '../hooks/useSettings';

function MyComponent() {
  const { 
    taskTypes,           // סוגי משימות
    categories,          // קטגוריות
    workDays,            // ימי עבודה
    workHours,           // שעות עבודה
    getTaskType,         // קבלת סוג משימה
    getTaskTypes,        // כל הסוגים (ממוינים)
    updateSettings,      // עדכון הגדרות
    addTaskType,         // הוספת סוג
    updateTaskType,      // עדכון סוג
    deleteTaskType,      // מחיקת סוג
    minutesToTime,       // 510 → "08:30"
    timeToMinutes,       // "08:30" → 510
    isWorkDay,           // בדיקה אם יום עבודה
  } = useSettings();

  // שימוש
  const types = getTaskTypes(); // מערך ממוין
  const type = getTaskType('transcription'); // סוג ספציפי
}
```

## ✨ פיצ'רים

### 🏷️ סוגי משימות
- הוספה/עריכה/מחיקה
- בחירת אייקון וצבע
- משך ברירת מחדל
- שיוך לקטגוריה
- סדר הצגה

### 📁 קטגוריות
- עבודה, מיזם, משפחה, אישי
- הוספה של קטגוריות מותאמות
- אייקונים וצבעים

### 📅 לוח זמנים
- הפעלה/כיבוי ימי עבודה
- שעות התחלה וסיום לכל יום
- משך בלוק והפסקה
- חלונות בוקר/אחה"צ

### 🔔 התראות
- תזכורת לפני משימה
- סיכום בוקר
- תזכורת הפסקה
- סיום יום עבודה
- צלילים ורטט

### 🎨 תצוגה
- ערכת נושא (בהיר/כהה/מערכת)
- תצוגת ברירת מחדל
- הצגת משימות שהושלמו
- מצב קומפקטי

### ⏱️ טיימר
- התחלה/השלמה אוטומטית
- הצגה בכותרת הדף
- מצב פומודורו מלא

## 🔧 עדכון smartScheduler

כדי שה-smartScheduler ישתמש בהגדרות המותאמות:

```javascript
// ב-smartScheduler.js
import { DEFAULT_SETTINGS } from '../context/SettingsContext';

// או - העברת הגדרות כפרמטר
export function smartScheduleWeek(weekStart, allTasks, userSettings = DEFAULT_SETTINGS) {
  const config = {
    dayStart: userSettings.work_hours.dayStart,
    dayEnd: userSettings.work_hours.dayEnd,
    // ...
  };
}
```

## 📝 הערות

- ההגדרות נשמרות אוטומטית ב-Supabase
- משתמש חדש מקבל ברירות מחדל
- אם אין חיבור - נעשה שימוש בברירות מחדל מקומיות
- שינויים בהגדרות משפיעים מיד על כל האפליקציה
