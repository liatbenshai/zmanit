# עדכון זמנית - 31/12/2024 (גרסה 8)

## 🆕 חדש: מערכת קונפיגורציה מודולרית!

### מה חדש?
- **הגדרות מרכזיות** - כל ההגדרות במקום אחד
- **שמירה ב-Supabase** - סנכרון בין מכשירים
- **ממשק אדמין** - עריכה נוחה של שעות עבודה, התראות ועוד

---

## 📦 קבצים בעדכון (14 קבצים)

```
src/
├── config/
│   └── appConfig.js          ← 🆕 קונפיגורציה מרכזית
├── hooks/
│   └── useConfig.js          ← 🆕 Hook לשימוש בקונפיגורציה
├── components/
│   ├── Admin/
│   │   └── AdminSettings.jsx ← 🆕 ממשק אדמין
│   ├── Analytics/
│   │   ├── DailySummary.jsx
│   │   └── WeeklyReview.jsx
│   ├── DailyView/
│   │   ├── DailyView.jsx
│   │   └── SimpleTaskForm.jsx
│   ├── Dashboard/
│   │   └── SmartDashboard.jsx
│   ├── Notifications/
│   │   └── NotificationChecker.jsx
│   └── Tasks/
│       └── TaskTimerWithInterruptions.jsx
└── utils/
    ├── autoRescheduleDaily.js
    └── taskOrder.js

supabase-migrations/
└── create_app_settings.sql   ← 🆕 טבלאות חדשות
```

---

## 🔧 התקנה - 3 שלבים

### שלב 1: העתקת קבצים
חלצי את ה-ZIP והעתיקי את תיקיית `src/` לפרויקט.

### שלב 2: יצירת טבלאות ב-Supabase
הריצי את ה-SQL מהקובץ `supabase-migrations/create_app_settings.sql`:

1. כנסי ל-Supabase Dashboard
2. לכי ל-SQL Editor
3. העתיקי את כל התוכן מהקובץ
4. לחצי Run

### שלב 3: רענון
```bash
npm run dev
# או
Ctrl+Shift+R בדפדפן
```

---

## ⚙️ איך להשתמש בממשק האדמין

### אפשרות 1: הוספה לדשבורד
ב-SmartDashboard.jsx, הוסיפי כפתור:

```jsx
import AdminSettings from '../Admin/AdminSettings';
import Modal from '../UI/Modal';

// בתוך הקומפוננטה:
const [showSettings, setShowSettings] = useState(false);

// בתוך ה-return:
<button onClick={() => setShowSettings(true)}>
  ⚙️ הגדרות
</button>

{showSettings && (
  <Modal onClose={() => setShowSettings(false)}>
    <AdminSettings onClose={() => setShowSettings(false)} />
  </Modal>
)}
```

### אפשרות 2: דף נפרד
צרי נתיב חדש ב-Router:

```jsx
import AdminSettings from './components/Admin/AdminSettings';

<Route path="/settings" element={<AdminSettings />} />
```

---

## 📋 מה ניתן להגדיר

### 🕐 שעות עבודה
- שעת התחלה (ברירת מחדל: 08:30)
- שעת סיום (ברירת מחדל: 16:15)
- ימי עבודה (א'-ה')
- שישי - שעות מיוחדות
- הפסקת צהריים

### 🔔 התראות
- כמה דקות לפני משימה
- התראה בזמן ההתחלה
- התראה בסיום
- תדירות חזרה

### ⏱️ טיימר
- משך ברירת מחדל למשימה
- גודל בלוק מינימלי/מקסימלי

---

## 🐛 תיקוני באגים (מגרסאות קודמות)

1. ✅ ספירה כפולה של אינטרוולים
2. ✅ התראות על משימה פעילה
3. ✅ התראות לפי לו"ז דינמי
4. ✅ סדר בלוקים של פרויקטים
5. ✅ כפל זמן בעריכה

---

## 🔮 בקרוב

- [ ] ממשק לעריכת סוגי משימות
- [ ] אינטגרציה עם Google Calendar
- [ ] למידה מהיסטוריה
- [ ] Hook אחיד ללו"ז

---

## 💡 שימוש ב-Hook

```jsx
import { useConfig, useWorkHours, useRemainingWorkTime } from '../hooks/useConfig';

function MyComponent() {
  // קונפיגורציה מלאה
  const { config, workHours, update } = useConfig();
  
  // רק שעות עבודה
  const { start, end, totalMinutes } = useWorkHours();
  
  // זמן נותר היום
  const remainingMinutes = useRemainingWorkTime();
  
  return (
    <div>
      שעות עבודה: {start} - {end}
      נותרו: {remainingMinutes} דקות
    </div>
  );
}
```
