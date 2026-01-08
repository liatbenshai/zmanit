import { useState, useEffect, useCallback } from 'react';
import { useTasks } from '../../hooks/useTasks';
import { 
  detectDeadlineConflicts, 
  getMostUrgentConflict 
} from '../../utils/deadlineConflictDetector';
import toast from 'react-hot-toast';

// ============================================
// צלילי התראה
// ============================================

const ALERT_SOUNDS = {
  critical: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1pZWNgX2Jkc4SEfW5ja29xb3R9h46Mh4OCg4mMkJKUlJSSj4yIhYKBhIaIiYqLjIyMi4qJiIeGhYSDgoGBgYKChIOFh4mLjY+Rk5WWl5iYmJeWlJKQjouJh4WDgoGBgYKDhIaHiYuNj5GTlJaXmJiYmJeVk5GQjo2Ki4qMj5KXnKCkqKutrrCxsbCvrqyqqKWioJ6cnJubnJ2eoKKkpqeop6aloqCdmpiWlJOSkpKTlJaYmpydnp6enZ2cm5qZmJeWlZSUlJSUlJWWl5iYmZmZmZiYl5aWlZWUlJOTk5OTk5OUlJWVlpaWl5eXl5eXlpaVlZWUlJSTk5OTk5OTk5OTlJSUlZWVlZaWlpaWlpaVlZWUlJSUk5OTk5KSk5OTk5OUlJSVlZWVlZWVlZWVlZSUlJSTk5OTk5OTk5OTk5OTk5OTlJSUlJSUlJSUlJSUlJSTk5OTk5OTk5OT',
  warning: 'data:audio/wav;base64,UklGRl4GAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YToGAABzdIBycnR2eoKKkZaanJ2dnZuYlJCMiIWDg4SEhYaHiIiIiIeGhYSDgoGBgYGBgoKDhIWGh4iJioqLi4uKiomIh4aFhIOCgoGBgYGBgoKDhIWGhomKjI2Oj4+Pj46NjIqJh4aFhIOCgoGBgYGBgoOEhYeIiYuMjY6Oj4+Pjo2Mi4qIh4aFhIOCgoGBgYGBgoOEhYeIiouMjY6Oj4+Pjo2Mi4qJh4aFhIOCgYGBgYGBgoOEhYaHiImKi4yNjY2NjIuKiYiHhoWEg4KCgYGBgYGCgoOEhYaHiImKi4yMjY2MjIuKiYiHhoWEg4KBgYGBgYGCgoOEhYaHiImKi4yMjIyMi4qJiIeGhYSEgoKBgYGBgYKCg4SEhYaHiImKioqLi4uKiomIh4aFhIOCgoGBgYGBgYKDg4SEhYaGh4iJiYqKiomJiIeHhoWEg4OCgoGBgYGBgoKDg4SEhYWGhoeHiIiIiIiHh4aGhYSEg4KCgYGBgYGBgoKDg4SEhIWFhoaGhoeHh4eHhoaFhYSEg4OCgoGBgYGBgYKCgoODg4SEhIWFhYaGhoaGhoWFhYSEg4ODgoKBgYGBgYGCgoKDg4ODhISEhIWFhYWFhYWFhISEg4ODgoKCgYGBgYGBgoKCgoODg4ODhISEhISEhISEhIODg4ODgoKCgYGBgYGBgYKCgoKDg4ODg4OEhISEhISEg4ODg4OCgoKCgYGBgYGBgYKCgoKCg4ODg4ODg4ODg4ODg4ODgoKCgoKBgYGBgYGBgoKCgoKCg4ODg4ODg4ODg4ODgoKCgoKCgYGBgYGBgYGCgoKCgoKDg4ODg4ODg4ODgoKCgoKCgYGBgYGBgYGBgoKCgoKCgoODg4ODg4ODgoKCgoKCgYGBgYGBgYGBgoKCgoKCgoKDg4ODg4KCgoKCgoKBgYGBgYGBgYGBgoKCgoKCgoKCgoKCgoKCgoKCgYGBgYGBgYGBgYGCgoKCgoKCgoKCgoKCgoKCgYGBgYGBgYGBgYGBgoKCgoKCgoKCgoKCgoKCgYGBgYGBgYGBgYGBgYKCgoKCgoKCgoKCgoKBgYGBgYGBgYGBgYGBgYKCgoKCgoKCgoKCgYGBgYGBgYGBgYGBgYGBgoKCgoKCgoKCgoGBgYGBgYGBgYGBgYGBgYGCgoKCgoKCgoKBgYGBgYGBgYGBgYGBgYGBgYKCgoKCgoKBgYGBgYGBgYGBgYGBgYGBgYGBgoKCgoKCgYGBgYGBgYGBgYGBgYGBgYGBgYGCgoKCgoGBgYGBgYGBgYGBgYGBgYGBgYGBgYGCgoKBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGCgoGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgoGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGB',
  info: 'data:audio/wav;base64,UklGRl4FAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YToFAABnZ3p6gIF/fXx8fH19f4GCg4OCgoGBgYGBgoKCg4OCgoGBgYGBgYKCgoKCgoKBgYGBgYGBgoKCgoKCgYGBgYGBgYGBgoKCgoGBgYGBgYGBgYGCgoKCgYGBgYGBgYGBgYKCgoGBgYGBgYGBgYGBgYKCgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGB'
};

/**
 * השמעת צליל התראה
 */
function playAlertSound(severity = 'warning') {
  try {
    const audio = new Audio(ALERT_SOUNDS[severity] || ALERT_SOUNDS.warning);
    audio.volume = 0.5;
    audio.play().catch(() => {}); // התעלם משגיאות (משתמש לא אישר אודיו)
  } catch (e) {
    // דפדפן לא תומך
  }
}

/**
 * מודל התראת התנגשות דדליין
 * =============================
 * 
 * מוצג כאשר המערכת מזהה שלא נעמוד בדדליין
 * מציע פתרונות ומאפשר לבחור פעולה
 */

function DeadlineConflictModal({ conflict, onClose, onAction }) {
  const [selectedSolution, setSelectedSolution] = useState(null);
  const [loading, setLoading] = useState(false);
  const [customTime, setCustomTime] = useState(''); // ✅ שינוי שעה בלבד
  const [showCustomTime, setShowCustomTime] = useState(false);
  
  // ✅ השמעת צליל כשהמודל נפתח
  useEffect(() => {
    if (conflict) {
      playAlertSound(conflict.severity);
    }
  }, [conflict]);
  
  if (!conflict) return null;
  
  const severityColors = {
    critical: 'bg-red-50 dark:bg-red-900/30 border-red-500',
    warning: 'bg-orange-50 dark:bg-orange-900/30 border-orange-500',
    info: 'bg-blue-50 dark:bg-blue-900/30 border-blue-500'
  };
  
  const severityIcons = {
    critical: '🚨',
    warning: '⚠️',
    info: 'ℹ️'
  };
  
  const severityTitles = {
    critical: 'התראה קריטית!',
    warning: 'אזהרה',
    info: 'שימי לב'
  };
  
  const handleAction = async (solution) => {
    setLoading(true);
    setSelectedSolution(solution.id);
    
    try {
      await onAction(solution);
      toast.success('הפעולה בוצעה בהצלחה');
      onClose();
    } catch (err) {
      console.error('שגיאה בביצוע פעולה:', err);
      toast.error('שגיאה בביצוע הפעולה');
    } finally {
      setLoading(false);
      setSelectedSolution(null);
    }
  };
  
  const formatTimeRemaining = (minutes) => {
    if (minutes < 0) return 'עבר הזמן!';
    if (minutes < 60) return `${minutes} דקות`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours < 24) return `${hours} שעות ${mins > 0 ? `ו-${mins} דקות` : ''}`;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days} ימים ${remainingHours > 0 ? `ו-${remainingHours} שעות` : ''}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div 
        className={`w-full max-w-lg rounded-2xl border-2 shadow-2xl ${severityColors[conflict.severity]} overflow-hidden`}
        dir="rtl"
      >
        {/* כותרת */}
        <div className={`p-4 ${
          conflict.severity === 'critical' ? 'bg-red-500' :
          conflict.severity === 'warning' ? 'bg-orange-500' : 'bg-blue-500'
        } text-white`}>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{severityIcons[conflict.severity]}</span>
            <div>
              <h2 className="text-xl font-bold">{severityTitles[conflict.severity]}</h2>
              <p className="text-sm opacity-90">זיהינו בעיה בלוח הזמנים</p>
            </div>
          </div>
        </div>
        
        {/* תוכן */}
        <div className="p-5 space-y-4">
          {/* פרטי המשימה */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700">
                📋
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 dark:text-white text-lg">
                  {conflict.task.title}
                </h3>
                <div className="mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex items-center gap-2">
                    <span>📅</span>
                    <span>דדליין: {conflict.task.due_date} {conflict.task.due_time || ''}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>⏱️</span>
                    <span>זמן שנותר: {formatTimeRemaining(conflict.minutesToDeadline)}</span>
                  </div>
                  {conflict.remainingDuration && (
                    <div className="flex items-center gap-2">
                      <span>📊</span>
                      <span>עבודה נדרשת: {conflict.remainingDuration} דקות</span>
                    </div>
                  )}
                  {conflict.shortfall && (
                    <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-medium">
                      <span>⚠️</span>
                      <span>חסרות: {conflict.shortfall} דקות!</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* הודעה */}
          <div className={`p-4 rounded-xl ${
            conflict.severity === 'critical' ? 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200' :
            conflict.severity === 'warning' ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-200' :
            'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200'
          }`}>
            <p className="font-medium">{conflict.message}</p>
          </div>
          
          {/* פתרונות */}
          <div className="space-y-2">
            <h4 className="font-bold text-gray-700 dark:text-gray-300">מה לעשות?</h4>
            
            {conflict.solutions.map((solution) => (
              <button
                key={solution.id}
                onClick={() => handleAction(solution)}
                disabled={loading}
                className={`w-full p-4 rounded-xl text-right transition-all ${
                  solution.primary 
                    ? 'bg-gradient-to-l from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 shadow-lg' 
                    : 'bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600'
                } ${loading && selectedSolution === solution.id ? 'opacity-70' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className={`font-bold ${solution.primary ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                      {solution.label}
                    </div>
                    <div className={`text-sm ${solution.primary ? 'text-green-100' : 'text-gray-600 dark:text-gray-400'}`}>
                      {solution.description}
                    </div>
                  </div>
                  {loading && selectedSolution === solution.id ? (
                    <div className="animate-spin">⏳</div>
                  ) : (
                    <span className="text-2xl">{solution.primary ? '▶️' : '→'}</span>
                  )}
                </div>
                
                {/* פרטי משימות לדחייה */}
                {solution.type === 'defer_others' && solution.tasks && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      משימות שיידחו:
                    </div>
                    <div className="space-y-1">
                      {solution.tasks.slice(0, 3).map(task => (
                        <div key={task.id} className="text-sm flex justify-between">
                          <span>• {task.title}</span>
                          <span className="text-gray-400">→ {task.suggestedNewDate}</span>
                        </div>
                      ))}
                      {solution.tasks.length > 3 && (
                        <div className="text-xs text-gray-400">
                          ועוד {solution.tasks.length - 3} משימות...
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
        
        {/* כפתור סגירה */}
        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            disabled={loading}
            className="w-full py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            טפל בזה אחר כך
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * רכיב מנהל התראות דדליין
 * ==========================
 * 
 * רץ ברקע ומציג התראות כשצריך
 */
export function DeadlineConflictManager() {
  const { tasks, editTask } = useTasks();
  const [currentConflict, setCurrentConflict] = useState(null);
  const [dismissedConflicts, setDismissedConflicts] = useState(new Set());
  const [lastCheck, setLastCheck] = useState(null);
  
  // ✅ בדיקה אם יש טיימר רץ על משימה מסוימת
  const isTimerRunningOnTask = useCallback((taskId) => {
    try {
      // בדיקת כל המפתחות האפשריים
      const keys = [`timer_v2_${taskId}`, `timer_${taskId}_startTime`];
      for (const key of keys) {
        const data = localStorage.getItem(key);
        if (data) {
          const parsed = JSON.parse(data);
          if (parsed.isRunning === true && !parsed.isInterrupted) {
            return true;
          }
        }
      }
    } catch (e) {}
    return false;
  }, []);
  
  // בדיקת התנגשויות
  const checkConflicts = useCallback(() => {
    if (!tasks || tasks.length === 0) return;
    
    // ✅ אם יש התראה פתוחה - בדוק אם היא עדיין רלוונטית
    if (currentConflict) {
      const task = tasks.find(t => t.id === currentConflict.taskId);
      if (!task || task.is_completed || isTimerRunningOnTask(currentConflict.taskId)) {
        setCurrentConflict(null);
        return;
      }
    }
    
    const conflicts = detectDeadlineConflicts(tasks);
    
    // מצא את ההתנגשות הדחופה ביותר שלא נדחתה ושאין עליה טיימר רץ
    const urgentConflict = conflicts.find(c => 
      !dismissedConflicts.has(c.taskId) && 
      (c.severity === 'critical' || c.severity === 'warning') &&
      !isTimerRunningOnTask(c.taskId) // ✅ לא להתריע על משימה שעובדים עליה!
    );
    
    if (urgentConflict && !currentConflict) {
      setCurrentConflict(urgentConflict);
    }
    
    setLastCheck(new Date());
  }, [tasks, dismissedConflicts, currentConflict, isTimerRunningOnTask]);
  
  // בדיקה תקופתית
  useEffect(() => {
    // בדיקה ראשונית
    const initialCheck = setTimeout(() => {
      checkConflicts();
    }, 3000); // חכה 3 שניות אחרי טעינה
    
    // בדיקה כל 5 דקות
    const interval = setInterval(() => {
      checkConflicts();
    }, 5 * 60 * 1000);
    
    return () => {
      clearTimeout(initialCheck);
      clearInterval(interval);
    };
  }, [checkConflicts]);
  
  // בדיקה מחדש כשמשימות משתנות
  useEffect(() => {
    if (tasks && tasks.length > 0) {
      // דיליי קצר כדי לא להפריע
      const timeout = setTimeout(() => {
        checkConflicts();
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [tasks, checkConflicts]);
  
  // ✅ סגור התראה אם התחיל טיימר על המשימה
  useEffect(() => {
    if (currentConflict && isTimerRunningOnTask(currentConflict.taskId)) {
      setCurrentConflict(null);
    }
  }, [currentConflict, isTimerRunningOnTask]);
  
  // ✅ סגור התראה אם המשימה הושלמה
  useEffect(() => {
    if (currentConflict && tasks) {
      const task = tasks.find(t => t.id === currentConflict.taskId);
      if (!task || task.is_completed) {
        setCurrentConflict(null);
      }
    }
  }, [currentConflict, tasks]);
  
  // טיפול בסגירת ההתראה
  const handleClose = () => {
    if (currentConflict) {
      setDismissedConflicts(prev => new Set([...prev, currentConflict.taskId]));
    }
    setCurrentConflict(null);
  };
  
  // טיפול בפעולה
  const handleAction = async (solution) => {
    if (!editTask) return;
    
    switch (solution.action.type) {
      case 'update_task':
        await editTask(solution.action.taskId, solution.action.changes);
        break;
        
      case 'defer_tasks':
        for (const task of solution.action.tasks) {
          await editTask(task.taskId, { 
            due_date: task.newDate,
            was_deferred: true,
            deferred_at: new Date().toISOString()
          });
        }
        break;
        
      case 'start_task':
        // יש לממש הפעלת טיימר
        // TODO: לחבר ל-TaskTimer
        break;
        
      case 'cancel_task':
        await editTask(solution.action.taskId, { 
          is_completed: true,
          was_cancelled: true 
        });
        break;
    }
  };
  
  // ניקוי יומי
  useEffect(() => {
    const midnightCheck = () => {
      const now = new Date();
      if (now.getHours() === 0 && now.getMinutes() < 5) {
        setDismissedConflicts(new Set());
      }
    };
    
    const interval = setInterval(midnightCheck, 60 * 1000);
    return () => clearInterval(interval);
  }, []);
  
  return (
    <DeadlineConflictModal
      conflict={currentConflict}
      onClose={handleClose}
      onAction={handleAction}
    />
  );
}

/**
 * באנר התראה על התנגשויות (לתצוגה קטנה)
 */
export function DeadlineConflictBanner() {
  const { tasks } = useTasks();
  const [conflicts, setConflicts] = useState([]);
  
  useEffect(() => {
    if (tasks && tasks.length > 0) {
      const detected = detectDeadlineConflicts(tasks);
      setConflicts(detected.filter(c => c.severity === 'critical' || c.severity === 'warning'));
    }
  }, [tasks]);
  
  if (conflicts.length === 0) return null;
  
  const criticalCount = conflicts.filter(c => c.severity === 'critical').length;
  const warningCount = conflicts.filter(c => c.severity === 'warning').length;
  
  return (
    <div 
      className={`p-3 rounded-xl ${
        criticalCount > 0 
          ? 'bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700' 
          : 'bg-orange-100 dark:bg-orange-900/30 border border-orange-300 dark:border-orange-700'
      }`}
      dir="rtl"
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">{criticalCount > 0 ? '🚨' : '⚠️'}</span>
        <div className="flex-1">
          <div className={`font-bold ${
            criticalCount > 0 ? 'text-red-800 dark:text-red-200' : 'text-orange-800 dark:text-orange-200'
          }`}>
            {criticalCount > 0 
              ? `${criticalCount} משימות בסכנה!`
              : `${warningCount} משימות דורשות תשומת לב`
            }
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            יש התנגשויות בלוח הזמנים
          </div>
        </div>
      </div>
      
      {/* רשימת משימות בסיכון */}
      <div className="mt-2 space-y-1">
        {conflicts.slice(0, 3).map(conflict => (
          <div 
            key={conflict.taskId}
            className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2"
          >
            <span>{conflict.severity === 'critical' ? '🔴' : '🟠'}</span>
            <span className="truncate">{conflict.task.title}</span>
            <span className="text-xs text-gray-500 whitespace-nowrap">
              ({conflict.task.due_time || 'ללא שעה'})
            </span>
          </div>
        ))}
        {conflicts.length > 3 && (
          <div className="text-xs text-gray-500">
            ועוד {conflicts.length - 3}...
          </div>
        )}
      </div>
    </div>
  );
}

export default DeadlineConflictModal;
