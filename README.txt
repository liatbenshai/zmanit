=== עדכון מלא - דשבורד + תיקון התראות ===

=== קבצים (5) ===

1. src/components/Dashboard/SmartDashboard.jsx
   🆕 דשבורד חדש מעוצב

2. src/components/Notifications/UnifiedNotificationManager.jsx
   🐛 תיקון התראות!
   - קורא את הזמן מהטיימר (localStorage) במקום מה-DB
   - מתריע 5 דקות לפני סיום הזמן
   - מתריע כשהזמן נגמר
   - התראות כל 3-5 דקות (לא פעם בשעה)

3. src/components/DailyView/DailyView.jsx
   🐛 תיקון: משימות לא חוזרות ל-08:00

4. src/utils/smartSchedulerV4.js
   🐛 תיקון: due_time נכבד

5. src/context/TaskContext.jsx
   🐛 תיקון: שמירת שדות

=== התקנה ===

החליפי את 5 הקבצים במיקומים המתאימים.

