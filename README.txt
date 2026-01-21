=== עדכון zmanit - תיקון יסודי של טיימר והתראות ===

בדקתי את כל הקוד לעומק. הנה מה שתוקן:

===== בעיה 1: הטיימר נעצר כשעוברים בין מסכים =====

הסיבה: כשהקומפוננטה נטענת מחדש, היא מוחקת את zmanit_active_timer
        לפני שהיא בודקת אם יש טיימר רץ על משימה אחרת.

תיקון: עכשיו לפני מחיקה, בודקים אם יש טיימר רץ על *כל* משימה
        (לא רק על המשימה הנוכחית)

קבצים:
- TaskTimerWithInterruptions.jsx
- MiniTimer.jsx


===== בעיה 2: התראות מגיעות כשעובדים =====

הסיבה: הבדיקה לטיימר פעיל הייתה שגויה!
        הקוד בדק: "אם הטיימר רץ על *המשימה הזו* - לא לשלוח"
        אבל היה צריך: "אם יש טיימר רץ על *משימה כלשהי* - לא לשלוח על אחרות"

תיקון: שיניתי את הלוגיקה ב-3 מקומות:
- NotificationContext.jsx - התראות מהדפדפן
- pushNotifications.js - התראות Push
- smartAlertManager.js - התראות חכמות (fallback)
- UnifiedNotificationManager.jsx - הזזתי את הבדיקה לפני alertManager


===== בעיה 3: סנכרון בין דשבורד לתצוגה יומית =====

הסיבה: חישוב שגוי של הזמן שעבר בדשבורד
        (data.startTime הוא string, לא timestamp)

תיקון: new Date(data.startTime).getTime() במקום data.startTime

קבצים:
- SmartDashboard.jsx


===== קבצים בעדכון (7 קבצים) =====

src/components/Tasks/TaskTimerWithInterruptions.jsx
src/components/Dashboard/MiniTimer.jsx
src/components/Dashboard/SmartDashboard.jsx
src/components/Notifications/UnifiedNotificationManager.jsx
src/context/NotificationContext.jsx
src/services/pushNotifications.js
src/utils/smartAlertManager.js


===== הוראות =====

העלי את כל הקבצים שבזיפ הזה לפרויקט ב-GitHub
(שמרי על מבנה התיקיות!)

