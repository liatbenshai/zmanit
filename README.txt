=== עדכון zmanit - תיקון מלא ===

כל התיקונים:

===== 1. TaskContext.jsx =====
- realtime UPDATE: שומר שדות קיימים
- changeQuadrant: שומר שדות קיימים
- toggleComplete: שומר שדות קיימים

===== 2. SmartDashboard.jsx =====
- חישוב זמן נכון עם new Date()

===== 3. UnifiedNotificationManager.jsx =====
- getActiveTaskId: בודק שהטיימר באמת רץ
- סדר בדיקות: טיימר לפני alertManager
- 🆕 ניקוי התראות כשזמן משימה משתנה!

===== מה התיקון החדש פותר =====

אם שינית משימה מ-10:00 ל-14:00:
- לפני: ההתראות נשארו על 10:00
- אחרי: המערכת מזהה שהזמן השתנה ומנקה את ההתראות הישנות
        עכשיו היא תשלח התראה חדשה ב-13:55

===== קבצים =====

1. src/context/TaskContext.jsx
2. src/components/Dashboard/SmartDashboard.jsx
3. src/components/Notifications/UnifiedNotificationManager.jsx

