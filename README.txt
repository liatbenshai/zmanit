=== עדכון zmanit - תיקון התראות מעבר בין משימות ===

הבעיה: לא קיבלת התראות על "עברת את הזמן" ו"צריך לעבור למשימה"

הסיבה: חסמתי את alertManager כשיש טיימר פעיל,
אבל alertManager הוא זה שבודק התראות מעבר!

התיקון: alertManager נקרא תמיד. הוא כבר יודע:
- לשלוח התראות על המשימה הפעילה (endingSoon, transition)
- לא לשלוח התראות על משימות אחרות כשעובדים

===== קבצים =====

1. src/components/Notifications/UnifiedNotificationManager.jsx
   🆕 תיקון: alertManager נקרא תמיד

2. src/utils/smartSchedulerV4.js
   תיקון: due_time נכבד בתצוגה יומית

3. src/context/TaskContext.jsx
   תיקון: איפוס שדות

4. src/components/Dashboard/SmartDashboard.jsx
   תיקון: סנכרון זמן

===== מה עובד עכשיו =====

✅ התראה "5 דקות לסיום המשימה"
✅ התראה "עברת את הזמן - צריך לעבור למשימה הבאה"
✅ התראה "הגיע הזמן למשימה X" (רק כשלא עובדים)
✅ שעות נכונות בתצוגה יומית

