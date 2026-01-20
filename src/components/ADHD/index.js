/**
 * 🧠 מודול ADHD - כלים לבניית הרגלים ומיקוד
 * 
 * קומפוננטות מותאמות במיוחד למוח עם ADHD:
 * - תצוגת משימה אחת (מפחיתה עומס)
 * - משוב "איך הלך?" (לומד הערכות זמן)
 * - כפתור "אני אבודה" (עזרה ברגעי עומס)
 * - גיימיפיקציה (מוטיבציה דרך נקודות והישגים)
 * - ריטואלים יומיים (בניית הרגלים)
 * - אשף תכנון שבועי (שיבוץ אינטראקטיבי)
 * - כפתור "משימה לשבוע" (הוספה מהירה)
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

// אשף תכנון שבועי - שיבוץ אינטראקטיבי
export { default as WeeklyPlanningWizard } from './WeeklyPlanningWizard';

// כפתור "משימה לשבוע" - הוספה מהירה
export { default as AddWeekTaskButton } from './AddWeekTaskButton';

// דיאלוג סיום טיימר - שואל מה קרה
export { default as TimerEndDialog } from './TimerEndDialog';
