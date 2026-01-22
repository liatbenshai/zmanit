=== תיקון מקיף - סנכרון זמנים והתראות ===

הבעיות שזוהו ותוקנו:

===== בעיה 1: התצוגה היומית הציגה שעות שונות מהדשבורד =====

הסיבה: smartSchedulerV4 חישב זמנים חדשים במקום להשתמש ב-due_time מה-DB

תיקון ב-smartSchedulerV4.js:
- אם למשימה יש due_time, כל הבלוקים שלה יוצגו ברצף מאותה שעה
- לא עוד חיפוש "סלוט פנוי" למשימות עם שעה קבועה

תיקון ב-DailyView.jsx:
- העברת due_time מקורי (block.task?.due_time) במקום block.startTime

===== בעיה 2: התראות לא בזמנים הנכונים =====

ההתראות משתמשות ב-task.due_time ישירות מ-DB (וזה נכון!).
הבעיה הייתה ש-alertManager נחסם כשיש טיימר פעיל.

תיקון ב-UnifiedNotificationManager.jsx:
- alertManager נקרא תמיד, גם כשיש טיימר
- הוא יודע לשלוח התראות על המשימה הפעילה

===== בעיה 3: איפוס שדות =====

תיקון ב-TaskContext.jsx:
- realtime UPDATE שומר על שדות קיימים
- changeQuadrant ו-toggleComplete שומרים על שדות

===== קבצים (5) =====

1. src/utils/smartSchedulerV4.js
   - תיקון שעות: due_time נכבד לכל הבלוקים

2. src/components/DailyView/DailyView.jsx
   - תיקון: העברת due_time מקורי ל-DailyTaskCard

3. src/components/Notifications/UnifiedNotificationManager.jsx
   - תיקון: alertManager נקרא תמיד

4. src/context/TaskContext.jsx
   - תיקון: שמירת שדות בעדכון

5. src/components/Dashboard/SmartDashboard.jsx
   - תיקון: סנכרון זמן נכון

===== מה אמור לעבוד =====

✅ התצוגה היומית מציגה אותן שעות כמו הדשבורד
✅ שינוי שעה מתעדכן בכל המקומות
✅ התראות בזמנים הנכונים
✅ התראה "עברת את הזמן" כשטיימר רץ
✅ משימות לא מתאפסות

