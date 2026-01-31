# שיפוץ מערכת ההתראות - v3.0

## 📋 סיכום השינויים

### קבצים שנמחקו:
- `src/utils/smartAlertManager.js` - הלוגיקה הועברה ל-UnifiedNotificationManager
- `src/services/notificationService.js` - לא היה בשימוש אמיתי

### קבצים שהוסרו מ-App.jsx (עדיין קיימים בפרויקט):
- `IdleDetector` - הלוגיקה נכללת עכשיו ב-UnifiedNotificationManager
- `WhyNotStartedDetector` - הלוגיקה נכללת עכשיו ב-UnifiedNotificationManager
- `EndOfDaySummary` - כבר יש EndOfDayPopup

### קבצים חדשים:
- `src/utils/delayStats.js` - פונקציות סטטיסטיקות איחורים (getAverageBufferTime, getDelayStats)

### קבצים שעודכנו:
- `src/App.jsx` - הוסרו רכיבים כפולים
- `src/components/Notifications/UnifiedNotificationManager.jsx` - נכתב מחדש לחלוטין (v3.0)
- `src/components/Dashboard/DailyProgressCard.jsx` - עדכון import

## 🎯 מה התיקון פותר:

### לפני:
- 6 מערכות נפרדות שולחות התראות במקביל
- כל מערכת עם מנגנון מניעת כפילויות משלה
- לולאות בדיקה מקבילות שלא מתואמות
- פופאפים שקופצים כמה פעמים על אותה משימה

### אחרי:
- **מקור אחד** להתראות - UnifiedNotificationManager
- מנגנון מניעת כפילויות אחד ומרכזי
- לולאת בדיקה אחת כל 30 שניות
- כל התראה נשלחת פעם אחת בלבד (עם מרווח מינימלי)

## ⚙️ הגדרות ברירת מחדל:

| סוג התראה | מרווח מינימלי | סף הפעלה |
|-----------|--------------|-----------|
| משימה מתחילה | 5 דקות | 5 דק' לפני |
| משימה באיחור | 10 דקות | 2-30 דק' איחור |
| אין טיימר פעיל | 10 דקות | בשעות עבודה |
| טיימר מושהה | 10 דקות | 10+ דק' |
| זמן מסתיים | 3 דקות | 5 דק' לפני |
| אירוע יומן | 15 דקות | 10 דק' לפני |

## 📝 הערות:

1. קבצי IdleDetector.jsx ו-WhyNotStartedDetector.jsx עדיין קיימים בפרויקט למקרה שתרצי להשתמש בהם בעתיד, אבל הם לא נטענים.

2. EndOfDayPopup נשאר כרכיב נפרד - זה בסדר כי הוא עוסק בסיכום סוף יום ולא בהתראות רגילות.

3. DeadlineConflictManager נשאר כרכיב נפרד - זה בסדר כי הוא עוסק בהתנגשויות תכנון ולא בהתראות זמן אמת.
