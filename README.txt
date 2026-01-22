=== עדכון zmanit - תיקון קריטי! ===

מצאתי את הבעיה האמיתית!

===== הבעיה העיקרית =====

קובץ: TaskContext.jsx
שורות: 118-123 (המקור)

כשעדכנת משימה, ה-realtime של Supabase שלח UPDATE.
הקוד הישן עשה:

  { ...payload.new, time_spent: payload.new.time_spent || 0 }

זה החליף את כל המשימה עם מה שהגיע מהשרת!
אם payload.new לא הכיל estimated_duration, quadrant, due_time - הם נמחקו!

===== התיקון =====

עכשיו הקוד עושה:

  { 
    ...t,              // קודם - שומרים על כל השדות הקיימים
    ...payload.new,    // אחרי - מעדכנים רק מה שהגיע
    time_spent: payload.new.time_spent ?? t.time_spent ?? 0
  }

===== קבצים בעדכון =====

1. src/context/TaskContext.jsx - התיקון העיקרי!
2. src/components/Dashboard/SmartDashboard.jsx - חישוב זמן
3. src/components/Notifications/UnifiedNotificationManager.jsx - בדיקת טיימר

===== הוראות =====

העלי את 3 הקבצים ל-GitHub

