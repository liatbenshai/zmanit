# Deadline Conflict Detection System - זמנית

## קבצים חדשים (להוסיף)

### `src/utils/deadlineConflictDetector.js`
מנוע זיהוי התנגשויות דדליין:
- סורק משימות עם תאריכי יעד
- מחשב זמן עבודה זמין עד הדדליין
- מזהה כשלא נספיק לעמוד בדדליין
- מציע פתרונות (הארכת דדליין, דחיית משימות אחרות, התחלה מיידית)

### `src/components/Notifications/DeadlineConflictModal.jsx`
ממשק משתמש להתראות:
- `DeadlineConflictModal` - מודל עם פתרונות
- `DeadlineConflictManager` - רץ ברקע ובודק כל 5 דקות
- `DeadlineConflictBanner` - באנר בדשבורד
- כולל צלילי התראה לפי חומרה

## קבצים מעודכנים (להחליף)

### `src/App.jsx`
נוסף import ורכיב `DeadlineConflictManager`

### `src/components/Dashboard/SmartDashboard.jsx`
נוסף import ורכיב `DeadlineConflictBanner`

### `src/components/Productivity/UrgentTaskButton.jsx`
### `src/Productivity/UrgentTaskButton.jsx`
**תיקון באג**: משימות בלת"מ היו נשמרות עם שעה 08:00 במקום השעה הנוכחית

## התקנה

1. העתיקי את הקבצים החדשים למקומם
2. החליפי את הקבצים המעודכנים
3. הפעילי מחדש את האפליקציה

## פיצ'רים

✅ זיהוי אוטומטי של התנגשויות דדליין  
✅ התראות עם צלילים (קריטי/אזהרה/מידע)  
✅ 4 פתרונות: הארכת דדליין, דחיית משימות, קיצור משך, התחלה מיידית  
✅ באנר בדשבורד עם סיכום משימות בסיכון  
✅ בדיקה כל 5 דקות + בדיקה מיידית כשמשימה משתנה  
✅ תיקון באג 08:00 במשימות בלת"מ  
