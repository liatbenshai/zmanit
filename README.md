# תיקון התראות IdleDetector

## הבעיה
ההתראות לא הופיעו כי:
1. IdleDetector חיפש `lastPausedAt` אבל FullScreenFocus לא שמר את זה
2. FullScreenFocus לא דיווח ל-IdleDetector כשמשהים משימה

## התיקון
- **IdleDetector.jsx** - עכשיו מזהה גם:
  - `zmanit_active_timer` (טיימר פעיל מ-FullScreenFocus)
  - `zmanit_focus_paused` (משימה מושהית מ-FullScreenFocus)
  - `interruptionStart` (מ-TaskTimerWithInterruptions)

- **FullScreenFocus.jsx** - עכשיו שומר מצב השהייה ב-localStorage

## התקנה
העתיקי את הקבצים ל:
- `src/components/Productivity/IdleDetector.jsx`
- `src/components/ADHD/FullScreenFocus.jsx`

## איך זה עובד
1. כשאת במצב פוקוס ולוחצת "השהייה" - נשמר `zmanit_focus_paused`
2. אחרי 5 דקות - מנהלת המשרד מופיעה!
3. כשאת חוזרת לעבודה או משלימה - המצב מתנקה
