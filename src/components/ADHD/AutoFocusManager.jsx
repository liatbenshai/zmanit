import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTasks } from '../../hooks/useTasks';
import { TASK_TYPES } from '../../config/taskTypes';
import { formatDuration } from '../../config/workSchedule';
import TaskTimerWithInterruptions from '../Tasks/TaskTimerWithInterruptions';
import toast from 'react-hot-toast';

/**
 * 🎯 AutoFocusManager - מנגנון מיקוד אוטומטי
 * 
 * כשמגיע זמן משימה:
 * 1. נפתח מסך מיקוד אוטומטי
 * 2. אם לא מתחילים תוך 2 דקות - שואל למה
 * 3. שומר את הסיבות ללמידה עתידית
 */

// סיבות אפשריות לאי-התחלה
const DELAY_REASONS = [
  { id: 'busy', icon: '🔄', label: 'עסוקה במשימה אחרת', action: 'snooze_5' },
  { id: 'meeting', icon: '👥', label: 'בפגישה/שיחה', action: 'snooze_15' },
  { id: 'break', icon: '☕', label: 'בהפסקה', action: 'snooze_10' },
  { id: 'not_ready', icon: '📋', label: 'צריכה להתכונן קודם', action: 'snooze_5' },
  { id: 'wrong_time', icon: '⏰', label: 'השעה לא מתאימה - תזיזי', action: 'reschedule' },
  { id: 'cancel', icon: '❌', label: 'לא רלוונטי היום', action: 'move_tomorrow' },
  { id: 'forgot', icon: '🤷', label: 'פשוט שכחתי', action: 'start_now' },
];

/**
 * Hook לניהול זמני משימות
 */
export function useTaskTimeMonitor(tasks) {
  const [pendingTask, setPendingTask] = useState(null);
  const [showFocusModal, setShowFocusModal] = useState(false);
  const [showWhyNotModal, setShowWhyNotModal] = useState(false);
  const [waitingStartTime, setWaitingStartTime] = useState(null);
  const notifiedTasks = useRef(new Set());
  const checkInterval = useRef(null);

  // 🆕 בדיקה אם יש טיימר פעיל
  const checkIfWorking = () => {
    const activeTimer = localStorage.getItem('zmanit_active_timer');
    console.log('🔍 בדיקת טיימר פעיל:', activeTimer);
    return !!activeTimer;
  };

  // בדיקה כל 10 שניות
  useEffect(() => {
    const checkTasks = () => {
      // 🆕 אם עובדים על משימה - לא להציק!
      const isWorking = checkIfWorking();
      if (isWorking) {
        console.log('🔇 AutoFocus: יש טיימר פעיל - לא מפריעים');
        return;
      }
      console.log('✅ AutoFocus: אין טיימר פעיל - בודק משימות');
      
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const today = now.toISOString().split('T')[0];

      // 🔍 לוג לדיבוג
      console.log('🎯 AutoFocus בודק משימות:', {
        today,
        currentTime: `${Math.floor(currentMinutes/60)}:${currentMinutes%60}`,
        tasksCount: tasks?.length || 0
      });

      // מציאת משימה שהגיע זמנה
      for (const task of tasks) {
        // 🔍 לוג לכל משימה
        if (!task.is_completed && task.due_date === today) {
          console.log('📋 משימה להיום:', {
            title: task.title,
            due_time: task.due_time,
            due_date: task.due_date
          });
        }

        if (task.is_completed || task.due_date !== today || !task.due_time) continue;
        
        // תיקון: due_time יכול להיות "09:45" או "09:45:00"
        const timeParts = task.due_time.split(':');
        const h = parseInt(timeParts[0], 10);
        const m = parseInt(timeParts[1], 10) || 0;
        const taskMinutes = h * 60 + m;
        const diff = currentMinutes - taskMinutes;
        
        // ✅ תנאי מתוקן:
        // diff >= -2: המשימה מתחילה בעוד 2 דקות או שכבר התחילה
        // diff <= 30: לא עברו יותר מ-30 דקות מההתחלה
        const inWindow = diff >= -2 && diff <= 30;
        
        console.log('⏰ בדיקת זמן:', {
          title: task.title,
          taskTime: task.due_time,
          currentMinutes,
          taskMinutes,
          diff,
          inWindow
        });
        
        const taskKey = `focus-${task.id}-${today}`;
        if (inWindow && !notifiedTasks.current.has(taskKey)) {
          console.log('🎯 פותח מודאל מיקוד!', task.title);
          notifiedTasks.current.add(taskKey);
          setPendingTask(task);
          setShowFocusModal(true);
          setWaitingStartTime(Date.now());
          
          // צליל התראה
          playNotificationSound();
          
          break;
        }
      }
    };

    checkInterval.current = setInterval(checkTasks, 10000); // כל 10 שניות
    checkTasks(); // בדיקה ראשונית

    return () => {
      if (checkInterval.current) clearInterval(checkInterval.current);
    };
  }, [tasks]);

  // בדיקה אם עברו 2 דקות בלי התחלה
  useEffect(() => {
    if (!waitingStartTime || !showFocusModal) return;

    const checkDelay = setInterval(() => {
      const elapsed = (Date.now() - waitingStartTime) / 1000 / 60; // דקות
      if (elapsed >= 2) {
        setShowFocusModal(false);
        setShowWhyNotModal(true);
        clearInterval(checkDelay);
      }
    }, 10000); // בדיקה כל 10 שניות

    return () => clearInterval(checkDelay);
  }, [waitingStartTime, showFocusModal]);

  const handleStartTask = useCallback(() => {
    setShowFocusModal(false);
    setWaitingStartTime(null);
    return pendingTask;
  }, [pendingTask]);

  const handleDelayReason = useCallback((reason) => {
    setShowWhyNotModal(false);
    setWaitingStartTime(null);
    
    // שמירת הסיבה ללמידה
    saveDelayReason(pendingTask?.id, reason);
    
    return { task: pendingTask, reason, action: reason.action };
  }, [pendingTask]);

  const dismissAll = useCallback(() => {
    setShowFocusModal(false);
    setShowWhyNotModal(false);
    setPendingTask(null);
    setWaitingStartTime(null);
  }, []);

  return {
    pendingTask,
    showFocusModal,
    showWhyNotModal,
    handleStartTask,
    handleDelayReason,
    dismissAll,
    setShowFocusModal,
    setShowWhyNotModal
  };
}

/**
 * צליל התראה
 */
function playNotificationSound() {
  try {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleEs+m9LLqWs4JFCl3OsAAADv7+/v7+/v7+/v7+/v7+/v');
    audio.play().catch(() => {});
  } catch (e) {}
}

/**
 * שמירת סיבת עיכוב ללמידה
 */
function saveDelayReason(taskId, reason) {
  try {
    const key = 'zmanit_delay_reasons';
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    existing.push({
      taskId,
      reason: reason.id,
      timestamp: new Date().toISOString(),
      dayOfWeek: new Date().getDay(),
      hour: new Date().getHours()
    });
    // שמירת 100 האחרונים
    localStorage.setItem(key, JSON.stringify(existing.slice(-100)));
  } catch (e) {}
}

/**
 * 🎯 מודאל מיקוד - נפתח כשמגיע זמן משימה
 */
export function TaskFocusModal({ task, onStart, onSnooze, onDismiss }) {
  const taskType = TASK_TYPES[task?.task_type] || TASK_TYPES.other;
  const [countdown, setCountdown] = useState(120); // 2 דקות

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(c => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!task) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
    >
      <motion.div
        initial={{ scale: 0.8, y: 50 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.8, y: 50 }}
        className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden"
      >
        {/* כותרת צבעונית */}
        <div 
          className="p-6 text-white text-center"
          style={{ backgroundColor: taskType.color || '#6366f1' }}
        >
          <div className="text-5xl mb-3">{taskType.icon || '📋'}</div>
          <div className="text-sm opacity-80 mb-1">הגיע הזמן!</div>
          <h2 className="text-2xl font-bold">{task.title}</h2>
          {task.client && (
            <div className="text-sm opacity-80 mt-1">👤 {task.client}</div>
          )}
        </div>

        {/* פרטים */}
        <div className="p-6">
          <div className="flex justify-center gap-6 mb-6 text-center">
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {task.due_time}
              </div>
              <div className="text-xs text-gray-500">שעה</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {task.estimated_duration || 30}
              </div>
              <div className="text-xs text-gray-500">דקות</div>
            </div>
          </div>

          {/* ספירה לאחור */}
          <div className="text-center mb-6">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              ממתינה לתגובה...
            </div>
            <div className="text-xs text-orange-500 mt-1">
              {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}
            </div>
          </div>

          {/* כפתורים */}
          <div className="space-y-3">
            <button
              onClick={onStart}
              className="w-full py-4 bg-green-500 hover:bg-green-600 text-white text-xl font-bold rounded-2xl transition-colors flex items-center justify-center gap-3"
            >
              <span className="text-2xl">▶️</span>
              מתחילה!
            </button>

            <div className="flex gap-3">
              <button
                onClick={() => onSnooze(5)}
                className="flex-1 py-3 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-xl font-medium"
              >
                ⏰ עוד 5 דק'
              </button>
              <button
                onClick={() => onSnooze(15)}
                className="flex-1 py-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl font-medium"
              >
                ⏰ עוד 15 דק'
              </button>
            </div>

            <button
              onClick={onDismiss}
              className="w-full py-2 text-gray-400 text-sm"
            >
              לא עכשיו
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/**
 * 🤔 מודאל "למה לא התחלת?"
 */
export function WhyNotStartedModal({ task, onSelectReason, onDismiss }) {
  if (!task) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
    >
      <motion.div
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.8 }}
        className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden"
      >
        {/* כותרת */}
        <div className="p-6 bg-orange-500 text-white text-center">
          <div className="text-4xl mb-2">🤔</div>
          <h2 className="text-xl font-bold">לא התחלת את המשימה</h2>
          <p className="text-orange-100 text-sm mt-1">{task.title}</p>
        </div>

        {/* סיבות */}
        <div className="p-4">
          <p className="text-center text-gray-600 dark:text-gray-400 mb-4">
            מה קרה? (זה עוזר לי ללמוד)
          </p>
          
          <div className="space-y-2">
            {DELAY_REASONS.map(reason => (
              <button
                key={reason.id}
                onClick={() => onSelectReason(reason)}
                className="w-full p-3 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-xl flex items-center gap-3 transition-colors text-right"
              >
                <span className="text-2xl">{reason.icon}</span>
                <span className="flex-1 text-gray-700 dark:text-gray-300">{reason.label}</span>
                <span className="text-gray-400">←</span>
              </button>
            ))}
          </div>

          <button
            onClick={onDismiss}
            className="w-full mt-4 py-2 text-gray-400 text-sm"
          >
            סגור
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/**
 * 🎯 AutoFocusManager - קומפוננטה ראשית
 * 
 * שים את זה ב-App.jsx או בלייאאוט הראשי
 */
function AutoFocusManager() {
  const { tasks, editTask, addTask } = useTasks();
  const {
    pendingTask,
    showFocusModal,
    showWhyNotModal,
    handleStartTask,
    handleDelayReason,
    dismissAll,
    setShowFocusModal,
    setShowWhyNotModal
  } = useTaskTimeMonitor(tasks);

  const [activeTask, setActiveTask] = useState(null);
  const [showTimer, setShowTimer] = useState(false);

  // התחלת משימה
  const onStart = () => {
    const task = handleStartTask();
    setActiveTask(task);
    setShowTimer(true);
    toast.success('🎯 בהצלחה!');
  };

  // דחייה
  const onSnooze = async (minutes) => {
    if (!pendingTask) return;
    
    const now = new Date();
    const newTime = new Date(now.getTime() + minutes * 60000);
    const newTimeStr = `${newTime.getHours().toString().padStart(2, '0')}:${newTime.getMinutes().toString().padStart(2, '0')}`;
    
    await editTask(pendingTask.id, {
      ...pendingTask,
      due_time: newTimeStr
    });
    
    dismissAll();
    toast(`⏰ נדחה ל-${newTimeStr}`, { icon: '🔔' });
  };

  // בחירת סיבה
  const onSelectReason = async (reason) => {
    const result = handleDelayReason(reason);
    
    switch (result.action) {
      case 'snooze_5':
        await onSnooze(5);
        break;
      case 'snooze_10':
        await onSnooze(10);
        break;
      case 'snooze_15':
        await onSnooze(15);
        break;
      case 'reschedule':
        toast('📅 עברי ללוח ותזיזי את המשימה', { duration: 5000 });
        dismissAll();
        break;
      case 'move_tomorrow':
        if (pendingTask) {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          await editTask(pendingTask.id, {
            ...pendingTask,
            due_date: tomorrow.toISOString().split('T')[0]
          });
          toast.success('📅 הועבר למחר');
        }
        dismissAll();
        break;
      case 'start_now':
        onStart();
        break;
      default:
        dismissAll();
    }
  };

  // סיום טיימר
  const onTimerComplete = () => {
    setShowTimer(false);
    setActiveTask(null);
    toast.success('🎉 כל הכבוד!');
  };

  return (
    <>
      {/* מודאל מיקוד */}
      <AnimatePresence>
        {showFocusModal && pendingTask && (
          <TaskFocusModal
            task={pendingTask}
            onStart={onStart}
            onSnooze={onSnooze}
            onDismiss={dismissAll}
          />
        )}
      </AnimatePresence>

      {/* מודאל "למה לא התחלת" */}
      <AnimatePresence>
        {showWhyNotModal && pendingTask && (
          <WhyNotStartedModal
            task={pendingTask}
            onSelectReason={onSelectReason}
            onDismiss={dismissAll}
          />
        )}
      </AnimatePresence>

      {/* טיימר פעיל - מסך מלא */}
      <AnimatePresence>
        {showTimer && activeTask && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gray-900 z-50 flex flex-col"
          >
            <div className="flex-1 flex items-center justify-center p-4">
              <div className="w-full max-w-lg">
                <TaskTimerWithInterruptions
                  task={activeTask}
                  onComplete={onTimerComplete}
                  onUpdate={(updates) => editTask(activeTask.id, updates)}
                />
              </div>
            </div>
            
            <div className="p-4 text-center">
              <button
                onClick={() => setShowTimer(false)}
                className="text-gray-400 hover:text-white"
              >
                מזער טיימר
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default AutoFocusManager;
