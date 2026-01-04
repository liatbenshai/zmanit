# 🔧 תיקון התראות - זמנית

## מה תוקן?

### הבעיה
ההתראות הציגו "משימה באיחור" גם כשעבדת על משימה אחרת באותו זמן.
הזמנים של המשימות השתנו בהתראות אבל לא התאימו למה שמוצג בתצוגה.

### הפתרון
הוספתי בדיקה לפני כל התראה: **האם יש טיימר רץ על משימה כלשהי?**

- אם את עובדת על משימה - לא יוצגו התראות על "איחור" או "בקרוב" על משימות אחרות
- אם אין טיימר פעיל - ההתראות יוצגו כרגיל

## קבצים שהשתנו

```
src/
├── Notifications/
│   ├── AlertsManager.jsx      ← מתוקן
│   └── SmartNotifications.jsx ← מתוקן
└── components/
    └── Notifications/
        ├── AlertsManager.jsx      ← מתוקן (עותק)
        └── SmartNotifications.jsx ← מתוקן (עותק)
```

## איך להעלות ל-GitHub

### אפשרות 1: החלפה ידנית
1. פתחי את תיקיית הפרויקט שלך
2. העתיקי את הקבצים למיקומים הנכונים:
   - `src/Notifications/AlertsManager.jsx`
   - `src/Notifications/SmartNotifications.jsx`
   - `src/components/Notifications/AlertsManager.jsx`
   - `src/components/Notifications/SmartNotifications.jsx`
3. עשי commit ו-push ל-GitHub

### אפשרות 2: דרך GitHub
1. היכנסי ל-GitHub לפרויקט שלך
2. נווטי לכל קובץ ולחצי "Edit"
3. החליפי את התוכן בקובץ המתוקן
4. לחצי "Commit changes"

## שינויים טכניים (לא חייבת לקרוא)

### פונקציות חדשות שנוספו:

```javascript
// בודקת אם יש טיימר רץ על משימה ספציפית
function isTimerRunning(taskId) { ... }

// מחפשת איזו משימה פעילה עכשיו (או null אם אין)
function getActiveTaskId(tasks) { ... }
```

### לוגיקה שהשתנתה:

**לפני:**
```javascript
// משימה באיחור - בודק רק אם יש time_spent
if (diff < -2 && !task.time_spent) {
  // מציג התראת איחור
}
```

**אחרי:**
```javascript
// משימה באיחור - בודק גם אם יש משימה פעילה
if (diff < -2 && !task.time_spent && !activeTaskId) {
  // מציג התראת איחור רק אם אין משימה פעילה
}
```

---

נוצר על ידי Claude 🤖
תאריך: ינואר 2026
