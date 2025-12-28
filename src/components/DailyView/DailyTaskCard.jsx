import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useTasks } from '../../hooks/useTasks';
import toast from 'react-hot-toast';
import TaskTimerWithInterruptions from '../Tasks/TaskTimerWithInterruptions';
import { TASK_TYPES } from './DailyView';

/**
 * בדיקה אם ID הוא UUID תקין
 */
function isValidUUID(id) {
  if (!id || typeof id !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * בדיקה אם זה בלוק וירטואלי (לא משימה אמיתית ב-DB)
 */
function isVirtualBlock(id) {
  return !isValidUUID(id);
}

/**
 * קבלת מפתח localStorage להשלמת בלוק וירטואלי
 */
function getVirtualBlockKey(id, date) {
  const dateStr = date || new Date().toISOString().split('T')[0];
  return `virtual_block_completed_${id}_${dateStr}`;
}

/**
 * כרטיס משימה לתצוגה יומית
 */
function DailyTaskCard({ task, onEdit, onUpdate }) {
  const { toggleComplete, removeTask, tasks } = useTasks();
  const [showTimer, setShowTimer] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [liveSpent, setLiveSpent] = useState(task.time_spent || 0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  
  // מצב השלמה לבלוקים וירטואליים (נשמר ב-localStorage)
  const [virtualCompleted, setVirtualCompleted] = useState(false);

  // שימוש בנתוני הבלוק שנשלחו, לא במשימה המקורית
  const currentTask = task;
  
  // בדיקה אם זה בלוק וירטואלי
  const isVirtual = isVirtualBlock(currentTask.id);
  
  // קבלת המשימה המקורית רק לצורך פעולות (toggle, delete)
  const originalTask = tasks.find(t => t.id === task.id);
  
  // סוג המשימה
  const taskType = TASK_TYPES[currentTask.task_type] || TASK_TYPES.other;

  // בדיקה אם זה בלוק מפוצל (יש blockIndex)
  const isBlock = currentTask.blockIndex !== undefined && currentTask.totalBlocks > 1;

  // מפתח localStorage לטיימר
  const timerStorageKey = currentTask.id ? `timer_v2_${currentTask.id}` : null;
  
  // טעינת מצב השלמה לבלוק וירטואלי מ-localStorage
  useEffect(() => {
    if (isVirtual) {
      const key = getVirtualBlockKey(currentTask.id);
      const saved = localStorage.getItem(key);
      setVirtualCompleted(saved === 'true');
    }
  }, [isVirtual, currentTask.id]);

  // עדכון liveSpent כשה-task משתנה מבחוץ
  useEffect(() => {
    setLiveSpent(task.time_spent || 0);
  }, [task.time_spent]);

  // בדיקת מצב טיימר מ-localStorage - גם כשהכרטיס סגור!
  useEffect(() => {
    if (!timerStorageKey) return;

    const checkTimerState = () => {
      try {
        const saved = localStorage.getItem(timerStorageKey);
        if (saved) {
          const data = JSON.parse(saved);
          if (data.isRunning && data.startTime && !data.isInterrupted) {
            // הטיימר רץ! חשב כמה זמן עבר
            const startTime = new Date(data.startTime);
            const now = new Date();
            const elapsedSeconds = Math.floor((now - startTime) / 1000) - (data.totalInterruptionSeconds || 0);
            const elapsedMinutes = Math.floor(Math.max(0, elapsedSeconds) / 60);
            const baseTimeSpent = task.time_spent || 0;
            
            setLiveSpent(baseTimeSpent + elapsedMinutes);
            setIsTimerRunning(true);
          } else {
            setIsTimerRunning(false);
          }
        }
      } catch (e) {
        console.error('Error reading timer state:', e);
      }
    };

    // בדיקה ראשונית
    checkTimerState();

    // בדיקה כל שנייה לעדכון בזמן אמת
    const interval = setInterval(checkTimerState, 1000);

    return () => clearInterval(interval);
  }, [timerStorageKey, task.time_spent]);

  // callback לקבלת עדכונים מהטיימר (כשפתוח)
  const handleTimerUpdate = useCallback((newSpent, running) => {
    setLiveSpent(newSpent);
    setIsTimerRunning(running);
  }, []);

  // סימון כהושלם - עם הודעה חכמה
  const handleToggleComplete = async (e) => {
    if (e) e.stopPropagation();
    
    // טיפול בבלוק וירטואלי (כמו אדמיניסטרציה)
    if (isVirtual) {
      const newCompleted = !virtualCompleted;
      setVirtualCompleted(newCompleted);
      
      // שמירה ב-localStorage
      const key = getVirtualBlockKey(currentTask.id);
      localStorage.setItem(key, newCompleted.toString());
      
      if (newCompleted) {
        toast.success('✅ הבלוק הושלם!');
      } else {
        toast.success('הבלוק הוחזר לפעיל');
      }
      
      if (onUpdate) onUpdate();
      return;
    }
    
    // טיפול במשימה רגילה
    try {
      await toggleComplete(currentTask.id);
      
      // בודקים את המצב לפני הלחיצה (currentTask.is_completed)
      if (currentTask.is_completed) {
        // החזרה לפעיל
        toast.success('המשימה הוחזרה לפעילה');
      } else {
        // סיום משימה
        const timeUsed = liveSpent;
        const estimated = currentTask.estimated_duration || 0;
        
        if (timeUsed < estimated && estimated > 0) {
          // סיימה מוקדם!
          const saved = estimated - timeUsed;
          toast.success(
            `🎉 סיימת מוקדם! חסכת ${formatMinutes(saved)}`,
            { duration: 4000 }
          );
        } else if (timeUsed > estimated * 1.2 && estimated > 0) {
          // לקח יותר זמן
          const extra = timeUsed - estimated;
          toast(
            `✅ הושלם! לקח ${formatMinutes(extra)} יותר מהצפוי`,
            { icon: '⏰', duration: 4000 }
          );
        } else {
          toast.success('✅ המשימה הושלמה!');
        }
      }
      
      if (onUpdate) onUpdate();
    } catch (err) {
      toast.error('שגיאה בעדכון');
    }
  };

  // מחיקה
  const handleDelete = async (e) => {
    e.stopPropagation();
    
    // בלוק וירטואלי - אי אפשר למחוק
    if (isVirtual) {
      toast.error('לא ניתן למחוק בלוק קבוע');
      return;
    }
    
    if (!confirm('למחוק את המשימה?')) return;
    setDeleting(true);
    try {
      await removeTask(currentTask.id);
      toast.success('המשימה נמחקה');
    } catch (err) {
      toast.error('שגיאה במחיקה');
      setDeleting(false);
    }
  };

  // חישוב התקדמות - לפי זמן הבלוק עם עדכון בזמן אמת
  const estimated = currentTask.estimated_duration || 0;
  const spent = liveSpent;
  const remaining = Math.max(0, estimated - spent);
  const progress = estimated > 0 ? Math.min(100, Math.round((spent / estimated) * 100)) : 0;
  const isOverTime = spent > estimated && estimated > 0;
  
  // האם המשימה הושלמה - משלב בלוקים וירטואליים ומשימות רגילות
  const isCompleted = isVirtual ? virtualCompleted : currentTask.is_completed;

  // פורמט דקות
  const formatMinutes = (minutes) => {
    if (minutes < 60) return `${minutes} דק'`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}:${mins.toString().padStart(2, '0')}` : `${hours} שעות`;
  };

  // שם תצוגה עם אינדקס בלוק
  const displayTitle = isBlock 
    ? `${currentTask.title} (${currentTask.blockIndex}/${currentTask.totalBlocks})`
    : currentTask.title;

  return (
    <motion.div
      layout
      className={`
        card p-4 transition-all duration-200
        ${isCompleted ? 'opacity-60' : ''}
        ${deleting ? 'opacity-50 scale-95' : ''}
        ${isOverTime ? 'border-l-4 border-l-red-500' : ''}
      `}
    >
      <div className="flex items-start gap-3">
        {/* כפתור סימון */}
        <button
          onClick={handleToggleComplete}
          className={`
            flex-shrink-0 w-6 h-6 rounded-full border-2 mt-0.5
            transition-all duration-200 flex items-center justify-center
            ${isCompleted 
              ? 'bg-green-500 border-green-500 text-white' 
              : 'border-gray-300 dark:border-gray-600 hover:border-green-500'
            }
          `}
        >
          {isCompleted && (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        {/* תוכן */}
        <div className="flex-1 min-w-0">
          {/* שורה ראשונה: כותרת וסוג */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg">{taskType.icon}</span>
            <h3 className={`
              font-medium text-gray-900 dark:text-white
              ${isCompleted ? 'line-through text-gray-500' : ''}
            `}>
              {displayTitle}
            </h3>
            {/* תגית באיחור - מוצגת רק אם המשימה באיחור */}
            {currentTask.isOverdue && (
              <span className="text-xs px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full">
                ⏰ באיחור
              </span>
            )}
            {/* תגית דחוף - רק אם זה באמת דחוף ולא רק באיחור */}
            {currentTask.priority === 'urgent' && !currentTask.isOverdue && (
              <span className="text-xs px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full">
                🔴 דחוף
              </span>
            )}
            {currentTask.priority === 'high' && (
              <span className="text-xs px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded-full">
                🟠 גבוה
              </span>
            )}
            {/* שעות הבלוק */}
            {currentTask.startTime && currentTask.endTime && (
              <span className="text-sm text-gray-500 dark:text-gray-400" dir="ltr">
                {currentTask.startTime} - {currentTask.endTime}
              </span>
            )}
          </div>

          {/* בר התקדמות תמיד מוצג */}
          {!isCompleted && estimated > 0 && (
            <div className="mt-2 flex items-center gap-3">
              {/* אייקון שעון חול עם אנימציה */}
              <div className={`text-lg transition-transform duration-500 ${
                isTimerRunning ? 'animate-spin' : ''
              }`} style={{ animationDuration: '3s' }}>
                {isTimerRunning ? '⏳' : progress === 0 ? '⏳' : progress < 100 ? '⌛' : '✅'}
              </div>
              
              {/* סרגל התקדמות */}
              <div className="flex-1 h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden relative">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, progress)}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className={`h-full rounded-full ${
                    isOverTime ? 'bg-red-500' :
                    progress >= 80 ? 'bg-orange-500' :
                    progress >= 50 ? 'bg-yellow-500' :
                    progress > 0 ? 'bg-blue-500' :
                    'bg-gray-300'
                  }`}
                />
                {/* פולס כשרץ */}
                {isTimerRunning && (
                  <div className="absolute inset-0 bg-white/30 animate-pulse rounded-full" />
                )}
              </div>
              
              {/* טקסט התקדמות */}
              <span className={`text-sm font-medium whitespace-nowrap ${
                isOverTime ? 'text-red-600 dark:text-red-400' : 
                isTimerRunning ? 'text-green-600 dark:text-green-400' :
                progress > 0 ? 'text-blue-600 dark:text-blue-400' :
                'text-gray-500 dark:text-gray-400'
              }`}>
                {spent > 0 && `${formatMinutes(spent)} / `}{formatMinutes(estimated)}
                {isTimerRunning && ' 🔴'}
              </span>
            </div>
          )}

          {/* פרטים נוספים כשפתוח */}
          {!isCompleted && showTimer && (
            <div className="mt-2 space-y-2">
              {/* אזהרה אם עבר את הזמן */}
              {isOverTime && (
                <div className="text-sm text-red-600 dark:text-red-400 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  ⚠️ עברת את הזמן המתוכנן ב-{formatMinutes(spent - estimated)}
                </div>
              )}
            </div>
          )}

          {/* תיאור */}
          {currentTask.description && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {currentTask.description}
            </p>
          )}

          {/* סיכום למשימה שהושלמה */}
          {isCompleted && estimated > 0 && (
            <div className="mt-2 text-sm">
              {spent > estimated ? (
                <span className="text-orange-600 dark:text-orange-400">
                  הערכת {formatMinutes(estimated)} → לקח {formatMinutes(spent)} (פי {(spent/estimated).toFixed(1)})
                </span>
              ) : (
                <span className="text-green-600 dark:text-green-400">
                  הערכת {formatMinutes(estimated)} → לקח {formatMinutes(spent)} 👍
                </span>
              )}
            </div>
          )}
        </div>

        {/* כפתורי פעולה */}
        <div className="flex items-center gap-1">
          {/* כפתור טיימר */}
          {!isCompleted && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowTimer(!showTimer);
              }}
              className={`
                p-2 rounded-lg transition-colors
                ${showTimer 
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' 
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500'
                }
              `}
              title={showTimer ? 'הסתר טיימר' : 'הצג טיימר'}
            >
              ⏱️
            </button>
          )}
          
          {/* כפתור עריכה */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
            title="ערוך"
          >
            ✏️
          </button>
          
          {/* כפתור מחיקה */}
          <button
            onClick={handleDelete}
            className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-500 hover:text-red-600"
            title="מחק"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* טיימר עם הפרעות */}
      {showTimer && !isCompleted && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <TaskTimerWithInterruptions
            task={currentTask}
            onUpdate={onUpdate}
            onComplete={handleToggleComplete}
            onTimeUpdate={handleTimerUpdate}
          />
        </div>
      )}
    </motion.div>
  );
}

export default DailyTaskCard;
