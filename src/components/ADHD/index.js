/**
 * 🧠 מודול ADHD - כלים לבניית הרגלים ומיקוד
 * 
 * קומפוננטות מותאמות במיוחד למוח עם ADHD:
 * - תצוגת משימה אחת (מפחיתה עומס)
 * - משוב "איך הלך?" (לומד הערכות זמן)
 * - כפתור "אני אבודה" (עזרה ברגעי עומס)
 * - גיימיפיקציה (מוטיבציה דרך נקודות והישגים)
 * - ריטואלים יומיים (בניית הרגלים)
 */

// תצוגת משימה אחת - מפחיתה עומס
export { default as SingleTaskView } from './SingleTaskView';

// משוב בסיום משימה - לומד הערכות זמן
export { default as TaskCompletionFeedback } from './TaskCompletionFeedback';

// כפתור "אני אבודה" - עזרה ברגעי עומס
export { default as PanicButton } from './PanicButton';

// גיימיפיקציה - מוטיבציה דרך נקודות
export { 
  GamificationProvider, 
  useGamification, 
  PointsBadge, 
  ProgressDashboard 
} from './GamificationSystem';

// ריטואלים יומיים - בניית הרגלים
export { 
  MorningRitual, 
  EveningRitual, 
  useRitualCheck 
} from './DailyRituals';
