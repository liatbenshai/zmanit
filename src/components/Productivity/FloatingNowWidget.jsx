import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTasks } from '../../hooks/useTasks';
import { TASK_TYPES } from '../../config/taskTypes';
import toast from 'react-hot-toast';

/**
 * ווידג'ט צף "עכשיו" - תמיד על המסך
 * מראה את המשימה הנוכחית עם טיימר
 */

const WIDGET_POSITION_KEY = 'zmanit_widget_position';
const WIDGET_MINIMIZED_KEY = 'zmanit_widget_minimized';

function FloatingNowWidget() {
  const { tasks, editTask, toggleComplete } = useTasks();
  
  // מצב הווידג'ט
  const [isMinimized, setIsMinimized] = useState(() => {
    return localStorage.getItem(WIDGET_MINIMIZED_KEY) === 'true';
  });
  const [position, setPosition] = useState(() => {
    try {
      const saved = localStorage.getItem(WIDGET_POSITION_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return { x: 20, y: 100 }; // ברירת מחדל - צד ימין למעלה
  });
  const [isDragging, setIsDragging] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerStartTime, setTimerStartTime] = useState(null);

  // מציאת המשימה הנוכחית/הבאה
  const currentTask = useMemo(() => {
    if (!tasks || tasks.length === 0) return null;
    
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    // בדיקה אם יש טיימר פעיל
    const activeTimerId = localStorage.getItem('zmanit_active_timer');
    if (activeTimerId) {
      const activeTask = tasks.find(t => t.id === activeTimerId);
      if (activeTask && !activeTask.is_completed) {
        return { task: activeTask, status: 'active' };
      }
    }
    
    // משימות של היום שלא הושלמו
    const todayTasks = tasks.filter(t => 
      !t.is_completed && 
      !t.deleted_at &&
      t.due_date === today
    );
    
    // משימה עם שעה שהגיע הזמן שלה
    const currentTimeTask = todayTasks.find(t => {
      if (!t.due_time) return false;
      const [h, m] = t.due_time.split(':').map(Number);
      const taskMinutes = h * 60 + (m || 0);
      const taskEndMinutes = taskMinutes + (t.estimated_duration || 30);
      return currentMinutes >= taskMinutes && currentMinutes < taskEndMinutes;
    });
    
    if (currentTimeTask) {
      return { task: currentTimeTask, status: 'now' };
    }
    
    // המשימה הבאה (הכי קרובה בזמן)
    const upcomingTasks = todayTasks
      .filter(t => {
        if (!t.due_time) return false;
        const [h, m] = t.due_time.split(':').map(Number);
        const taskMinutes = h * 60 + (m || 0);
        return taskMinutes > currentMinutes;
      })
      .sort((a, b) => a.due_time.localeCompare(b.due_time));
    
    if (upcomingTasks.length > 0) {
      return { task: upcomingTasks[0], status: 'next' };
    }
    
    // משימה דחופה או ראשונה ברשימה
    const urgentTask = todayTasks.find(t => t.priority === 'urgent');
    if (urgentTask) {
      return { task: urgentTask, status: 'urgent' };
    }
    
    // פשוט הראשונה
    if (todayTasks.length > 0) {
      return { task: todayTasks[0], status: 'pending' };
    }
    
    return null;
  }, [tasks]);

  // טיימר
  useEffect(() => {
    if (!isTimerRunning || !timerStartTime) return;
    
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - timerStartTime) / 1000);
      setElapsedSeconds(elapsed);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isTimerRunning, timerStartTime]);

  // בדיקת טיימר פעיל בטעינה
  useEffect(() => {
    const activeTimerId = localStorage.getItem('zmanit_active_timer');
    const timerStart = localStorage.getItem('zmanit_timer_start');
    
    if (activeTimerId && timerStart) {
      setIsTimerRunning(true);
      setTimerStartTime(parseInt(timerStart));
    }
  }, []);

  // שמירת מיקום
  useEffect(() => {
    localStorage.setItem(WIDGET_POSITION_KEY, JSON.stringify(position));
  }, [position]);

  // שמירת מצב מוקטן
  useEffect(() => {
    localStorage.setItem(WIDGET_MINIMIZED_KEY, isMinimized.toString());
  }, [isMinimized]);

  // פורמט זמן
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // חישוב זמן שנשאר
  const getRemainingTime = () => {
    if (!currentTask?.task) return null;
    const duration = currentTask.task.estimated_duration || 30;
    const remainingSeconds = (duration * 60) - elapsedSeconds;
    if (remainingSeconds <= 0) return 'הזמן נגמר!';
    const mins = Math.floor(remainingSeconds / 60);
    return `נשארו ${mins} דקות`;
  };

  // התחלת טיימר
  const handleStart = () => {
    if (!currentTask?.task) return;
    const startTime = Date.now();
    setTimerStartTime(startTime);
    setIsTimerRunning(true);
    setElapsedSeconds(0);
    localStorage.setItem('zmanit_active_timer', currentTask.task.id);
    localStorage.setItem('zmanit_timer_start', startTime.toString());
    toast.success('▶️ התחלנו!');
  };

  // השהיית טיימר
  const handlePause = () => {
    setIsTimerRunning(false);
    localStorage.removeItem('zmanit_active_timer');
    localStorage.removeItem('zmanit_timer_start');
    toast('⏸️ מושהה');
  };

  // סיום משימה
  const handleComplete = async () => {
    if (!currentTask?.task) return;
    
    // שמירת זמן שעבד
    const minutesWorked = Math.floor(elapsedSeconds / 60);
    if (minutesWorked > 0) {
      const newTimeSpent = (currentTask.task.time_spent || 0) + minutesWorked;
      await editTask(currentTask.task.id, { time_spent: newTimeSpent });
    }
    
    // סימון כהושלם
    await toggleComplete(currentTask.task.id);
    
    // איפוס טיימר
    setIsTimerRunning(false);
    setElapsedSeconds(0);
    setTimerStartTime(null);
    localStorage.removeItem('zmanit_active_timer');
    localStorage.removeItem('zmanit_timer_start');
    
    toast.success('✅ כל הכבוד!');
  };

  // גרירה
  const handleDragEnd = (event, info) => {
    setIsDragging(false);
    setPosition({
      x: Math.max(0, Math.min(window.innerWidth - 200, position.x + info.offset.x)),
      y: Math.max(0, Math.min(window.innerHeight - 100, position.y + info.offset.y))
    });
  };

  // סטטוס צבע
  const getStatusColor = () => {
    if (!currentTask) return 'bg-gray-500';
    switch (currentTask.status) {
      case 'active': return 'bg-green-500';
      case 'now': return 'bg-blue-500';
      case 'urgent': return 'bg-red-500';
      case 'next': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = () => {
    if (!currentTask) return '';
    switch (currentTask.status) {
      case 'active': return '▶️ עובדת';
      case 'now': return '🎯 עכשיו';
      case 'urgent': return '🔥 דחוף';
      case 'next': return '⏰ הבאה';
      default: return '📋 ממתינה';
    }
  };

  const taskType = currentTask?.task ? TASK_TYPES[currentTask.task.task_type] || TASK_TYPES.other : null;

  // אין משימות - לא מציגים כלום
  if (!currentTask) return null;

  return (
    <AnimatePresence>
      <motion.div
        drag
        dragMomentum={false}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={handleDragEnd}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{ 
          position: 'fixed',
          left: position.x,
          top: position.y,
          zIndex: 9998,
          touchAction: 'none'
        }}
        className={`
          select-none
          ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}
        `}
        dir="rtl"
      >
        {isMinimized ? (
          /* מצב מוקטן - רק אייקון */
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsMinimized(false)}
            className={`
              w-14 h-14 rounded-full shadow-lg flex items-center justify-center
              ${getStatusColor()} text-white text-2xl
              border-4 border-white dark:border-gray-800
            `}
            title="הצג משימה נוכחית"
          >
            {taskType?.icon || '📋'}
          </motion.button>
        ) : (
          /* מצב מלא */
          <motion.div
            layout
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden w-72 border border-gray-200 dark:border-gray-700"
          >
            {/* כותרת עם סטטוס */}
            <div className={`${getStatusColor()} px-4 py-2 flex items-center justify-between`}>
              <div className="flex items-center gap-2 text-white">
                <span className="text-lg">{taskType?.icon || '📋'}</span>
                <span className="text-sm font-medium">{getStatusText()}</span>
              </div>
              <button
                onClick={() => setIsMinimized(true)}
                className="text-white/80 hover:text-white p-1"
                title="מזער"
              >
                ▼
              </button>
            </div>

            {/* תוכן */}
            <div className="p-4">
              {/* שם המשימה */}
              <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-2 line-clamp-2">
                {currentTask.task.title}
              </h3>

              {/* זמן */}
              <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-4">
                {currentTask.task.due_time && (
                  <span>🕐 {currentTask.task.due_time}</span>
                )}
                <span>⏱️ {currentTask.task.estimated_duration || 30} דק'</span>
              </div>

              {/* טיימר */}
              {isTimerRunning && (
                <div className="bg-gray-100 dark:bg-gray-700 rounded-xl p-3 mb-4 text-center">
                  <div className="text-3xl font-mono font-bold text-gray-900 dark:text-white">
                    {formatTime(elapsedSeconds)}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {getRemainingTime()}
                  </div>
                </div>
              )}

              {/* כפתורים */}
              <div className="flex gap-2">
                {!isTimerRunning ? (
                  <button
                    onClick={handleStart}
                    className="flex-1 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <span>▶️</span>
                    <span>התחילי</span>
                  </button>
                ) : (
                  <button
                    onClick={handlePause}
                    className="flex-1 py-3 bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <span>⏸️</span>
                    <span>השהי</span>
                  </button>
                )}
                
                <button
                  onClick={handleComplete}
                  className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <span>✓</span>
                  <span>סיימתי</span>
                </button>
              </div>
            </div>

            {/* פס תחתון - ניתן לגרור */}
            <div className="bg-gray-100 dark:bg-gray-700 px-4 py-2 text-center">
              <span className="text-xs text-gray-400">⋮⋮ גרור להזיז ⋮⋮</span>
            </div>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

export default FloatingNowWidget;
