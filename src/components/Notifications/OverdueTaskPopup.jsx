import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTasks } from '../../hooks/useTasks';
import toast from 'react-hot-toast';

/**
 * פופאפ למשימה באיחור
 * =====================
 * 
 * מציג אפשרויות:
 * 1. התחל לעבוד - מתחיל את הטיימר
 * 2. דחה ב-5/10/15 דקות - מעדכן את זמן המשימה
 * 3. הוסף זמן למשימה - מעדכן את משך המשימה
 * 4. דלג - מסמן כהושלמה או מעביר ליום אחר
 */

// אפשרויות דחייה
const DELAY_OPTIONS = [
  { id: 'delay_5', minutes: 5, label: '5 דקות', icon: '⏱️' },
  { id: 'delay_10', minutes: 10, label: '10 דקות', icon: '⏱️' },
  { id: 'delay_15', minutes: 15, label: '15 דקות', icon: '⏱️' },
  { id: 'delay_30', minutes: 30, label: '30 דקות', icon: '⏱️' },
];

// אפשרויות הוספת זמן
const EXTEND_OPTIONS = [
  { id: 'extend_15', minutes: 15, label: '+15 דק׳' },
  { id: 'extend_30', minutes: 30, label: '+30 דק׳' },
  { id: 'extend_45', minutes: 45, label: '+45 דק׳' },
  { id: 'extend_60', minutes: 60, label: '+60 דק׳' },
];

function OverdueTaskPopup({ 
  isOpen, 
  onClose, 
  task, 
  onStartTask,
  onReschedule 
}) {
  const { editTask, toggleComplete } = useTasks();
  const [showDelayOptions, setShowDelayOptions] = useState(false);
  const [showExtendOptions, setShowExtendOptions] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // חישוב כמה זמן באיחור
  const getDelayMinutes = useCallback(() => {
    if (!task?.due_time) return 0;
    const [h, m] = task.due_time.split(':').map(Number);
    const taskMinutes = h * 60 + (m || 0);
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    return Math.max(0, currentMinutes - taskMinutes);
  }, [task?.due_time]);
  
  const delayMinutes = getDelayMinutes();
  
  // התחל לעבוד על המשימה
  const handleStartTask = useCallback(() => {
    if (!task?.id) return;
    
    // שמירת ID המשימה להתחלת טיימר
    localStorage.setItem('start_task_id', task.id);
    localStorage.setItem('zmanit_active_timer', task.id);
    
    // עדכון localStorage של הטיימר
    const timerData = {
      taskId: task.id,
      startTime: new Date().toISOString(),
      isRunning: true,
      isPaused: false,
      isInterrupted: false,
      totalInterruptionSeconds: 0,
      interruptions: []
    };
    localStorage.setItem(`timer_v2_${task.id}`, JSON.stringify(timerData));
    
    toast.success(`▶️ מתחילים לעבוד על "${task.title}"!`);
    
    if (onStartTask) {
      onStartTask(task.id);
    }
    
    onClose();
    
    // ניווט לתצוגה היומית
    window.location.href = '/daily';
  }, [task, onStartTask, onClose]);
  
  // דחיית המשימה
  const handleDelay = useCallback(async (minutes) => {
    if (!task?.id || isProcessing) return;
    
    setIsProcessing(true);
    
    try {
      // חישוב זמן חדש
      const now = new Date();
      const newStartMinutes = now.getHours() * 60 + now.getMinutes() + minutes;
      const newHour = Math.floor(newStartMinutes / 60);
      const newMinute = newStartMinutes % 60;
      const newDueTime = `${newHour.toString().padStart(2, '0')}:${newMinute.toString().padStart(2, '0')}`;
      
      await editTask(task.id, { due_time: newDueTime });
      
      toast.success(`⏱️ המשימה נדחתה ל-${newDueTime}`);
      onClose();
    } catch (err) {
      console.error('שגיאה בדחיית משימה:', err);
      toast.error('שגיאה בדחיית המשימה');
    } finally {
      setIsProcessing(false);
    }
  }, [task, editTask, onClose, isProcessing]);
  
  // הוספת זמן למשימה
  const handleExtend = useCallback(async (minutes) => {
    if (!task?.id || isProcessing) return;
    
    setIsProcessing(true);
    
    try {
      const currentDuration = task.estimated_duration || 30;
      const newDuration = currentDuration + minutes;
      
      await editTask(task.id, { estimated_duration: newDuration });
      
      toast.success(`⏱️ נוספו ${minutes} דקות למשימה (סה״כ ${newDuration} דק׳)`);
      setShowExtendOptions(false);
    } catch (err) {
      console.error('שגיאה בהוספת זמן:', err);
      toast.error('שגיאה בהוספת זמן');
    } finally {
      setIsProcessing(false);
    }
  }, [task, editTask, isProcessing]);
  
  // דילוג על המשימה
  const handleSkip = useCallback(async () => {
    if (!task?.id || isProcessing) return;
    
    setIsProcessing(true);
    
    try {
      // מעביר את המשימה למחר
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];
      
      await editTask(task.id, { 
        due_date: tomorrowStr,
        due_time: '09:00' // שעה סבירה למחר
      });
      
      toast.success('📅 המשימה הועברה למחר');
      onClose();
    } catch (err) {
      console.error('שגיאה בהעברת משימה:', err);
      toast.error('שגיאה בהעברת המשימה');
    } finally {
      setIsProcessing(false);
    }
  }, [task, editTask, onClose, isProcessing]);
  
  // סימון כהושלמה
  const handleComplete = useCallback(async () => {
    if (!task?.id || isProcessing) return;
    
    setIsProcessing(true);
    
    try {
      await toggleComplete(task.id, true);
      toast.success('✅ המשימה סומנה כהושלמה');
      onClose();
    } catch (err) {
      console.error('שגיאה בסימון משימה:', err);
      toast.error('שגיאה בסימון המשימה');
    } finally {
      setIsProcessing(false);
    }
  }, [task, toggleComplete, onClose, isProcessing]);
  
  if (!isOpen || !task) return null;
  
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[10000]"
        onClick={onClose}
      />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.8, y: 20 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[10001]
                   w-[95%] max-w-md bg-white dark:bg-gray-800 rounded-3xl shadow-2xl
                   overflow-hidden"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* כותרת עם רקע אדום */}
        <div className="bg-gradient-to-l from-red-500 to-orange-500 p-6 text-white text-center">
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
            className="text-5xl mb-3"
          >
            🔴
          </motion.div>
          <h2 className="text-2xl font-bold">משימה באיחור!</h2>
          <p className="text-white/90 mt-2 text-lg">
            "{task.title}"
          </p>
          <p className="text-white/70 text-sm mt-1">
            הייתה אמורה להתחיל ב-{task.due_time}
            {delayMinutes > 0 && ` (לפני ${delayMinutes} דקות)`}
          </p>
        </div>
        
        {/* תוכן */}
        <div className="p-5 space-y-4">
          
          {/* כפתור ראשי - התחל לעבוד */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleStartTask}
            disabled={isProcessing}
            className="w-full p-4 rounded-xl bg-gradient-to-l from-green-500 to-emerald-500 
                     text-white font-bold text-lg shadow-lg shadow-green-500/30
                     flex items-center justify-center gap-3 disabled:opacity-50"
          >
            <span className="text-2xl">▶️</span>
            <span>התחל לעבוד עכשיו</span>
          </motion.button>
          
          {/* דחיית המשימה */}
          <div className="space-y-2">
            <button
              onClick={() => {
                setShowDelayOptions(!showDelayOptions);
                setShowExtendOptions(false);
              }}
              className="w-full p-3 rounded-xl bg-blue-50 dark:bg-blue-900/30 
                       text-blue-700 dark:text-blue-300 font-medium
                       flex items-center justify-between"
            >
              <span className="flex items-center gap-2">
                <span>⏱️</span>
                <span>דחה את המשימה</span>
              </span>
              <span className={`transition-transform ${showDelayOptions ? 'rotate-180' : ''}`}>
                ▼
              </span>
            </button>
            
            <AnimatePresence>
              {showDelayOptions && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="grid grid-cols-4 gap-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                    {DELAY_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        onClick={() => handleDelay(option.minutes)}
                        disabled={isProcessing}
                        className="p-3 rounded-lg bg-white dark:bg-gray-700 
                                 hover:bg-blue-50 dark:hover:bg-blue-900/30
                                 text-gray-700 dark:text-gray-200 text-sm font-medium
                                 transition-colors disabled:opacity-50"
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          {/* הוספת זמן למשימה */}
          <div className="space-y-2">
            <button
              onClick={() => {
                setShowExtendOptions(!showExtendOptions);
                setShowDelayOptions(false);
              }}
              className="w-full p-3 rounded-xl bg-purple-50 dark:bg-purple-900/30 
                       text-purple-700 dark:text-purple-300 font-medium
                       flex items-center justify-between"
            >
              <span className="flex items-center gap-2">
                <span>⏰</span>
                <span>הוסף זמן למשימה ({task.estimated_duration || 30} דק׳)</span>
              </span>
              <span className={`transition-transform ${showExtendOptions ? 'rotate-180' : ''}`}>
                ▼
              </span>
            </button>
            
            <AnimatePresence>
              {showExtendOptions && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="grid grid-cols-4 gap-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                    {EXTEND_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        onClick={() => handleExtend(option.minutes)}
                        disabled={isProcessing}
                        className="p-3 rounded-lg bg-white dark:bg-gray-700 
                                 hover:bg-purple-50 dark:hover:bg-purple-900/30
                                 text-gray-700 dark:text-gray-200 text-sm font-medium
                                 transition-colors disabled:opacity-50"
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          {/* אפשרויות נוספות */}
          <div className="flex gap-2">
            <button
              onClick={handleSkip}
              disabled={isProcessing}
              className="flex-1 p-3 rounded-xl bg-gray-100 dark:bg-gray-700 
                       text-gray-600 dark:text-gray-300 font-medium
                       hover:bg-gray-200 dark:hover:bg-gray-600
                       flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span>📅</span>
              <span>העבר למחר</span>
            </button>
            
            <button
              onClick={handleComplete}
              disabled={isProcessing}
              className="flex-1 p-3 rounded-xl bg-gray-100 dark:bg-gray-700 
                       text-gray-600 dark:text-gray-300 font-medium
                       hover:bg-gray-200 dark:hover:bg-gray-600
                       flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span>✅</span>
              <span>בוצע</span>
            </button>
          </div>
          
          {/* כפתור סגירה */}
          <button
            onClick={onClose}
            className="w-full p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 
                     text-sm transition-colors"
          >
            סגור (אזכיר בעוד כמה דקות)
          </button>
        </div>
        
        {/* הודעת עידוד */}
        <div className="px-5 pb-5 text-center text-sm text-gray-500 dark:text-gray-400">
          💪 קורה לכולם! העיקר שחוזרים למסלול
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default OverdueTaskPopup;
