/**
 * מערכת התראות מאוחדת - גרסה פשוטה וברורה
 * ==========================================
 * 
 * מה המערכת עושה:
 * 1. מתריעה 5 דקות לפני סיום זמן משימה פעילה
 * 2. מציגה פופאפ גדול במרכז המסך כשאין משימה פעילה
 * 3. מאפשרת להמשיך או לעבור למשימה אחרת
 * 4. מעדכנת את שאר המשימות בהתאם
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTasks } from '../../hooks/useTasks';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';

// =============================================
// פונקציות עזר
// =============================================

/**
 * המרת תאריך לפורמט ISO מקומי
 */
function toLocalISODate(date) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * בדיקה אם יש טיימר פעיל
 */
function getActiveTimerInfo() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('timer_v2_')) {
        const saved = localStorage.getItem(key);
        if (saved) {
          const data = JSON.parse(saved);
          if (data.isRunning || data.isPaused) {
            return {
              taskId: key.replace('timer_v2_', ''),
              isRunning: data.isRunning,
              isPaused: data.isPaused,
              elapsedSeconds: data.elapsedSeconds || 0
            };
          }
        }
      }
    }
  } catch (e) {
    console.error('שגיאה בבדיקת טיימר:', e);
  }
  return null;
}

// =============================================
// קומפוננטת פופאפ התראה
// =============================================

function AlertPopup({ alert, onAction, onDismiss }) {
  if (!alert) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4"
      onClick={(e) => e.target === e.currentTarget && onDismiss()}
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 text-center"
        dir="rtl"
      >
        {/* אייקון */}
        <div className="text-6xl mb-4">{alert.icon}</div>
        
        {/* כותרת */}
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {alert.title}
        </h2>
        
        {/* הודעה */}
        <p className="text-gray-600 dark:text-gray-300 mb-6 text-lg">
          {alert.message}
        </p>
        
        {/* שם המשימה */}
        {alert.taskTitle && (
          <div className="bg-blue-50 dark:bg-blue-900/30 rounded-xl p-4 mb-6">
            <p className="text-blue-800 dark:text-blue-200 font-medium text-lg">
              {alert.taskTitle}
            </p>
          </div>
        )}
        
        {/* כפתורים */}
        <div className="flex flex-col gap-3">
          {alert.actions?.map((action) => (
            <button
              key={action.id}
              onClick={() => onAction(action.id, action)}
              className={`
                w-full py-4 px-6 rounded-xl font-bold text-lg transition-all
                ${action.primary 
                  ? 'bg-blue-500 hover:bg-blue-600 text-white shadow-lg' 
                  : action.danger
                    ? 'bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
                }
              `}
            >
              {action.icon && <span className="ml-2">{action.icon}</span>}
              {action.label}
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

// =============================================
// קומפוננטה ראשית
// =============================================

export function UnifiedNotificationManager() {
  const { user } = useAuth();
  const { tasks, editTask } = useTasks();
  
  // מצב
  const [activeAlert, setActiveAlert] = useState(null);
  const [lastAlertTime, setLastAlertTime] = useState({});
  
  // refs
  const checkIntervalRef = useRef(null);
  const notifiedTasksRef = useRef(new Set());

  // =============================================
  // לוגיקת בדיקת התראות
  // =============================================

  const checkAlerts = useCallback(() => {
    if (!user?.id || !tasks || tasks.length === 0) return;
    
    const now = new Date();
    const today = toLocalISODate(now);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    // בדיקת טיימר פעיל
    const activeTimer = getActiveTimerInfo();
    
    // --- מצב 1: יש טיימר פעיל ---
    if (activeTimer && activeTimer.isRunning) {
      const activeTask = tasks.find(t => t.id === activeTimer.taskId);
      if (activeTask) {
        const estimated = activeTask.estimated_duration || 0;
        const elapsedMinutes = Math.floor(activeTimer.elapsedSeconds / 60);
        const remaining = estimated - elapsedMinutes;
        
        // התראה 5 דקות לפני סיום
        if (remaining > 0 && remaining <= 5 && remaining > 2) {
          const alertKey = `ending-${activeTask.id}`;
          if (!notifiedTasksRef.current.has(alertKey)) {
            notifiedTasksRef.current.add(alertKey);
            
            setActiveAlert({
              type: 'task_ending',
              icon: '⏰',
              title: 'הזמן עומד להיגמר!',
              message: `נשארו ${remaining} דקות לסיום הזמן המוקצב`,
              taskTitle: activeTask.title,
              taskId: activeTask.id,
              actions: [
                { id: 'extend_15', label: 'הוסף 15 דקות', icon: '➕', primary: true },
                { id: 'extend_30', label: 'הוסף 30 דקות', icon: '➕' },
                { id: 'finish', label: 'סיים והמשך למשימה הבאה', icon: '✅' },
                { id: 'dismiss', label: 'אחר כך', icon: '⏭️' }
              ]
            });
          }
        }
        
        // הזמן נגמר
        if (remaining <= 0 && remaining > -2) {
          const alertKey = `timeup-${activeTask.id}`;
          if (!notifiedTasksRef.current.has(alertKey)) {
            notifiedTasksRef.current.add(alertKey);
            
            setActiveAlert({
              type: 'time_up',
              icon: '🔔',
              title: 'הזמן נגמר!',
              message: 'הזמן המוקצב למשימה הסתיים',
              taskTitle: activeTask.title,
              taskId: activeTask.id,
              actions: [
                { id: 'extend_15', label: 'עוד 15 דקות', icon: '➕', primary: true },
                { id: 'extend_30', label: 'עוד 30 דקות', icon: '➕' },
                { id: 'finish', label: 'סיים משימה', icon: '✅', danger: true }
              ]
            });
          }
        }
      }
      return; // יש טיימר פעיל - לא בודקים משימות אחרות
    }
    
    // --- מצב 2: אין טיימר פעיל ---
    // מחפשים משימות שהגיע זמנן
    const todayTasks = tasks.filter(task => {
      if (task.is_completed) return false;
      if (task.is_project && tasks.some(t => t.parent_task_id === task.id)) return false; // מסתירים הורים
      const taskDate = task.due_date ? toLocalISODate(new Date(task.due_date)) : null;
      return taskDate === today && task.due_time;
    });
    
    // מיון לפי שעה
    todayTasks.sort((a, b) => {
      const timeA = a.due_time || '23:59';
      const timeB = b.due_time || '23:59';
      return timeA.localeCompare(timeB);
    });
    
    for (const task of todayTasks) {
      const [hour, min] = (task.due_time || '09:00').split(':').map(Number);
      const taskMinutes = hour * 60 + (min || 0);
      const diff = taskMinutes - currentMinutes;
      
      // משימה שהגיע זמנה (בטווח של -30 עד +5 דקות)
      if (diff <= 5 && diff > -30) {
        // לא מתריעים אם כבר עבדו על המשימה
        if (task.time_spent && task.time_spent > 0) continue;
        
        // לא מתריעים אם דילגנו על המשימה
        if (notifiedTasksRef.current.has(`skipped-${task.id}`)) continue;
        
        const alertKey = `start-${task.id}-${today}`;
        const lastAlert = lastAlertTime[alertKey];
        const minutesSinceLastAlert = lastAlert ? (Date.now() - lastAlert) / 60000 : 999;
        
        // מתריעים מקסימום כל 10 דקות
        if (minutesSinceLastAlert >= 10) {
          setLastAlertTime(prev => ({ ...prev, [alertKey]: Date.now() }));
          
          const isLate = diff < 0;
          const lateMinutes = Math.abs(Math.round(diff));
          
          setActiveAlert({
            type: isLate ? 'task_late' : 'task_starting',
            icon: isLate ? '⚠️' : '🎯',
            title: isLate ? 'משימה באיחור!' : 'הגיע הזמן להתחיל!',
            message: isLate 
              ? `המשימה הייתה אמורה להתחיל לפני ${lateMinutes} דקות`
              : diff <= 0 
                ? 'המשימה מתחילה עכשיו!'
                : `המשימה מתחילה בעוד ${diff} דקות`,
            taskTitle: task.title,
            taskId: task.id,
            estimatedDuration: task.estimated_duration,
            actions: [
              { id: 'start_now', label: '▶️ להתחיל עכשיו', primary: true },
              { id: 'snooze_15', label: '⏰ להזכיר בעוד 15 דקות' },
              { id: 'skip', label: '⏭️ לדלג למשימה הבאה' },
              { id: 'reschedule', label: '📅 לדחות ליום אחר' }
            ]
          });
          
          break; // מציגים רק התראה אחת בכל פעם
        }
      }
    }
    
  }, [user?.id, tasks, lastAlertTime]);

  // =============================================
  // טיפול בפעולות על התראה
  // =============================================

  const handleAction = useCallback(async (actionId) => {
    const alert = activeAlert;
    if (!alert) return;
    
    switch (actionId) {
      case 'start_now':
        // שומרים את המשימה שצריך להתחיל ועוברים לדף היומי
        localStorage.setItem('start_task_id', alert.taskId);
        window.location.href = '/daily';
        break;
        
      case 'extend_15':
      case 'extend_30':
        // הוספת זמן למשימה
        const addMinutes = actionId === 'extend_15' ? 15 : 30;
        const task = tasks.find(t => t.id === alert.taskId);
        if (task) {
          const newDuration = (task.estimated_duration || 0) + addMinutes;
          await editTask(alert.taskId, { estimated_duration: newDuration });
          toast.success(`נוספו ${addMinutes} דקות למשימה`);
          
          // עדכון משימות הבאות (דחייה)
          await pushFollowingTasks(alert.taskId, addMinutes);
        }
        break;
        
      case 'finish':
        // סיום המשימה - עוברים לדף היומי לסמן כהושלם
        localStorage.setItem('complete_task_id', alert.taskId);
        window.location.href = '/daily';
        break;
        
      case 'snooze_15':
        // נזכיר בעוד 15 דקות
        toast('⏰ נזכיר בעוד 15 דקות', { duration: 3000 });
        setTimeout(() => {
          notifiedTasksRef.current.delete(`start-${alert.taskId}-${toLocalISODate(new Date())}`);
        }, 15 * 60 * 1000);
        break;
        
      case 'skip':
        // דילוג למשימה הבאה - סימון כנדחה
        toast('⏭️ המשימה נדחתה', { duration: 2000 });
        // מוסיפים לרשימת המשימות שדילגנו עליהן
        notifiedTasksRef.current.add(`skipped-${alert.taskId}`);
        break;
        
      case 'reschedule':
        // דחייה ליום אחר - פותחים את דף היומי עם מודל דחייה
        localStorage.setItem('reschedule_task_id', alert.taskId);
        window.location.href = '/daily';
        break;
        
      case 'dismiss':
        // פשוט סוגרים
        break;
    }
    
    setActiveAlert(null);
  }, [activeAlert, tasks, editTask]);

  /**
   * דחיית משימות הבאות כשמאריכים משימה
   */
  const pushFollowingTasks = async (currentTaskId, addMinutes) => {
    const today = toLocalISODate(new Date());
    const currentTask = tasks.find(t => t.id === currentTaskId);
    if (!currentTask?.due_time) return;
    
    // מציאת משימות הבאות להיום
    const followingTasks = tasks.filter(task => {
      if (task.id === currentTaskId) return false;
      if (task.is_completed) return false;
      const taskDate = task.due_date ? toLocalISODate(new Date(task.due_date)) : null;
      if (taskDate !== today) return false;
      if (!task.due_time) return false;
      return task.due_time > currentTask.due_time;
    });
    
    // דחיית כל משימה
    for (const task of followingTasks) {
      const [h, m] = task.due_time.split(':').map(Number);
      const newMinutes = h * 60 + m + addMinutes;
      const newHour = Math.floor(newMinutes / 60);
      const newMin = newMinutes % 60;
      const newTime = `${String(newHour).padStart(2, '0')}:${String(newMin).padStart(2, '0')}`;
      
      await editTask(task.id, { due_time: newTime });
    }
    
    if (followingTasks.length > 0) {
      toast(`עודכנו ${followingTasks.length} משימות הבאות`, { icon: '📅' });
    }
  };

  // =============================================
  // הפעלת בדיקה תקופתית
  // =============================================

  useEffect(() => {
    // בדיקה ראשונית אחרי 2 שניות
    const initialTimeout = setTimeout(checkAlerts, 2000);
    
    // בדיקה כל 30 שניות
    checkIntervalRef.current = setInterval(checkAlerts, 30 * 1000);
    
    return () => {
      clearTimeout(initialTimeout);
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [checkAlerts]);

  // איפוס התראות בחצות
  useEffect(() => {
    const resetAtMidnight = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const msUntilMidnight = tomorrow - now;
      
      setTimeout(() => {
        notifiedTasksRef.current.clear();
        setLastAlertTime({});
        resetAtMidnight(); // קריאה רקורסיבית ליום הבא
      }, msUntilMidnight);
    };
    
    resetAtMidnight();
  }, []);

  // =============================================
  // רינדור
  // =============================================

  return (
    <AnimatePresence>
      {activeAlert && (
        <AlertPopup
          alert={activeAlert}
          onAction={handleAction}
          onDismiss={() => setActiveAlert(null)}
        />
      )}
    </AnimatePresence>
  );
}

export default UnifiedNotificationManager;
