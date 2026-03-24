# 📋 דוח סקירת קוד - זמנית
**תאריך:** 28.12.2025

---

## 🔴 באגים קריטיים (תוקנו!)

### 1. שדה priority לא נשמר לדאטהבייס
**קבצים מושפעים:**
- `src/services/supabase.js` - createTask, updateTask ✅ תוקן
- `src/services/taskIntervals.js` - 3 מקומות ✅ תוקן

**תסמינים:** משימות תמיד מופיעות כ"רגיל" גם אם נבחר "דחוף"

### 2. שיבוץ כפול של משימות
**קבצים מושפעים:**
- `src/utils/smartScheduler.js` ✅ תוקן

**תסמינים:** משימות מופיעות כ-`(1/2) (1/2)` במקום `(1/2)`

**פתרון:** הוספת בדיקה `!task.title.includes('/')`

### 3. משימות-הורה מוצגות יחד עם הילדים
**קבצים מושפעים:**
- `src/utils/smartScheduler.js` ✅ תוקן
- `src/utils/dayPlanner.js` ✅ תוקן

**פתרון:** סינון `is_project: true`

### 4. אי-התאמה snake_case / camelCase
**קבצים מושפעים:**
- `src/context/TaskContext.jsx` ✅ תוקן

**תסמינים:** תאריכים לא נשמרים נכון

---

## 🟠 בעיות אבטחה (דורש טיפול)

| חבילה | חומרה | בעיה | פתרון |
|--------|--------|------|--------|
| xlsx | HIGH | Prototype Pollution + ReDoS | להחליף ל-exceljs או sheetjs-style |
| dompurify | MODERATE | XSS vulnerability | `npm audit fix --force` |
| esbuild/vite | MODERATE | Dev server vulnerability | עדכון vite לגרסה 7+ |

**פקודה לתיקון:**
```bash
npm audit fix --force
```

---

## 🟡 קבצים שלא בשימוש (ניתן למחוק)

```
src/utils/
├── actionExecutor.js          ❌ לא בשימוש
├── autoReschedule.js          ❌ לא בשימוש
├── dayPlanner-timezone-fix.js ❌ גרסה ישנה
├── idleTimeTracker.js         ❌ לא בשימוש
├── insightsEngine.js          ❌ לא בשימוש
├── proactiveScheduler-debug.js ❌ קובץ debug
├── proactiveScheduler.js      ❌ לא בשימוש
├── slotSuggester.js           ❌ לא בשימוש
├── smartNotifications.js      ❌ לא בשימוש
├── smartScheduling.js         ❌ לא בשימוש (יש smartScheduler)
├── smartTimeInsights.js       ❌ לא בשימוש
└── timerStorageMigration.js   ❌ לא בשימוש
```

**חיסכון פוטנציאלי:** ~150KB בגודל ה-bundle

---

## 🟢 שיפורים מומלצים

### 1. ביצועים
- **Bundle size גדול:** 663KB (מומלץ < 500KB)
- **פתרון:** Code splitting עם dynamic imports
```javascript
// במקום:
import { HeavyComponent } from './HeavyComponent';

// להשתמש ב:
const HeavyComponent = lazy(() => import('./HeavyComponent'));
```

### 2. קוד נקי
- **46 console.log** נשארו בקוד
- **פתרון:** להסיר או להחליף ב-logger עם levels

### 3. TODO שלא הושלמו
```
src/pages/TaskInsights.jsx:218 - יישום הצעות
src/components/Scheduler/SmartWorkIntake.jsx:395 - לוגיקה להעברת משימות
```

### 4. קבצים גדולים מדי (לפצל)
| קובץ | שורות |
|------|--------|
| TaskTimer.jsx | 830 |
| TaskForm.jsx | 813 |
| SmartDayPlanner.jsx | 897 |

---

## 📦 קבצים שתוקנו (לעדכון)

```
src/
├── services/
│   ├── supabase.js         ← priority בשמירה
│   └── taskIntervals.js    ← priority ב-3 מקומות
├── utils/
│   ├── smartScheduler.js   ← כפילות + סינון is_project
│   └── dayPlanner.js       ← סינון is_project
├── context/
│   └── TaskContext.jsx     ← snake_case/camelCase
└── components/DailyView/
    ├── SimpleTaskForm.jsx  ← defaultDate
    └── RescheduleModal.jsx ← לוגים
```

---

## ✅ סיכום פעולות

### מיידי (באג קריטי):
1. ✅ תיקון שמירת priority
2. ✅ תיקון שיבוץ כפול
3. ✅ תיקון סינון משימות-הורה

### קצר טווח (שבוע):
1. ⬜ עדכון חבילות עם פגיעויות אבטחה
2. ⬜ מחיקת קבצים שלא בשימוש
3. ⬜ הסרת console.log

### ארוך טווח (חודש):
1. ⬜ Code splitting לשיפור ביצועים
2. ⬜ פיצול קומפוננטות גדולות
3. ⬜ השלמת TODO items
