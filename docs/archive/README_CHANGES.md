# שינויים באפליקציה - ינואר 2026

## קבצים להחליף (להעתיק ולהחליף)
העתיקי את כל הקבצים בתיקייה הזו למקומות המתאימים בפרויקט.

## קבצים למחוק מהפרויקט
מחקי את הקבצים הבאים:
```
src/components/Notifications/AlertsManager.jsx
src/components/Notifications/BlockingAlertPopup.jsx
src/components/Notifications/NotificationChecker.jsx
src/components/Notifications/OverdueTaskManager.jsx
src/components/Notifications/SmartNotifications.jsx
src/utils/smartAlertManager.js
```

## קבצי תיעוד עם שמות משובשים למחוק
```
#U256b#U00f6#U256b#U00f2#U256b#U00bf#U256b#U00c9#U256b#U00f2#U256b#U00ac.md
#U256b#U00f6#U256b#U00f2#U256b#U00bf#U256b#U00c9#U256b#U00f2#U256b#U00ac-#U256b#U00f3#U256b#U00f4#U256b#U00a2#U256b#U00f2#U256b#U0192.md
```

## שינויי שמות migrations
שני קבצים שמרו על מספור כפול - שונו:
- `007_work_preferences_and_clients.sql` → `018_work_preferences_and_clients.sql`
- `010_test_time_spent.sql` → `019_test_time_spent.sql`

## פעולה ב-Supabase (חשוב!)
הריצי את הסקריפט `020_fix_parent_tasks.sql` ב-Supabase SQL Editor
זה יתקן משימות קיימות שמוצגות בכפילות.

## שלבי התקנה
1. העתיקי את כל הקבצים למקומות המתאימים
2. מחקי את הקבצים שצוינו למחיקה
3. הריצי `npm install` לעדכון החבילות
4. הריצי את סקריפט ה-SQL ב-Supabase
5. דחפי ל-GitHub: `git add . && git commit -m "שיפורי התראות וביצועים" && git push`

## מה תוקן?
1. ✅ מערכת התראות חדשה ופשוטה - פופאפ גדול במרכז המסך
2. ✅ אפשרות להאריך זמן / לסיים / לדחות משימה
3. ✅ עדכון אוטומטי של משימות הבאות כשמאריכים משימה
4. ✅ Code Splitting - טעינה מהירה יותר
5. ✅ הסרת console.log בייצור
6. ✅ עדכון אבטחה ל-react-router-dom
7. ✅ ניקוי קוד וקבצים מיותרים
