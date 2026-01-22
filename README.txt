=== עדכון zmanit - תיקון שעות בתצוגה יומית ===

הבעיה: כשעדכנת שעה למשימה, התצוגה היומית המשיכה 
להציג את השעה הישנה (מחושבת אוטומטית)

הסיבה: smartSchedulerV4 חיפש סלוט "פנוי" והתעלם 
מה-due_time שהגדרת

===== קבצים =====

1. src/utils/smartSchedulerV4.js - 🆕 התיקון העיקרי!
   אם יש due_time - המשימה תוצג בזמן שהגדרת

2. src/context/TaskContext.jsx
   תיקון איפוס שדות

3. src/components/Dashboard/SmartDashboard.jsx
   סנכרון זמן

4. src/components/Notifications/UnifiedNotificationManager.jsx
   התראות מעודכנות לזמנים חדשים

===== מה התיקון עושה =====

לפני: הגדרת due_time=14:00, אבל התצוגה הציגה 09:35
אחרי: הגדרת due_time=14:00, התצוגה מציגה 14:00

===== הוראות =====

העלי את 4 הקבצים ל-GitHub

