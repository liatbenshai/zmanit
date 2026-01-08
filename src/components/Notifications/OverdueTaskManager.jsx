/**
 * פופאפ חוסם למשימות באיחור
 * ===========================
 * 
 * מופעל כאשר:
 * 1. משימה עם due_time מוגדר לא הושלמה ועבר הזמן
 * 2. משימה עם due_time מוגדר לא התחילה ועבר הזמן
 * 
 * לא ניתן לסגור בלי לבחור פעולה!
 * מיועד לאנשים עם הפרעות קשב שצריכים מסגרת ברורה.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTasks } from '../../hooks/useTasks';
import toast from 'react-hot-toast';

/**
 * קבלת תאריך בפורמט ISO מקומי
 */
function toLocalISODate(date) {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * המרת זמן לדקות
 */
function timeToMinutes(timeStr) {
  if (!timeStr) return null;
  const parts = timeStr.split(':');
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1] || '0', 10);
  if (isNaN(hours) || isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

/**
 * פורמט דקות לתצוגה
 */
function formatMinutes(minutes) {
  if (minutes < 60) return `${minutes} דקות`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}:${String(mins).padStart(2, '0')}` : `${hours} שעות`;
}

/**
 * רכיב ראשי: מנהל פופאפים למשימות באיחור
 */
function OverdueTaskManager({ tasks = [], onStartTask }) {
  const { editTask } = useTasks();
  const [currentOverdue, setCurrentOverdue] = useState(null);
  const [handledToday, setHandledToday] = useState(new Set());
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [showRescheduleInput, setShowRescheduleInput] = useState(false);
  
  // ✅ ניקוי handledToday כשמשימות נמחקות
  useEffect(() => {
    if (tasks) {
      const currentTaskIds = new Set(tasks.map(t => t.id));
      setHandledToday(prev => {
        const validHandled = new Set([...prev].filter(id => currentTaskIds.has(id)));
        return validHandled.size !== prev.size ? validHandled : prev;
      });
      
      // ✅ סגור פופאפ אם המשימה נמחקה או הושלמה
      if (currentOverdue) {
        const task = tasks.find(t => t.id === currentOverdue.id);
        if (!task || task.is_completed) {
          setCurrentOverdue(null);
        }
      }
    }
  }, [tasks, currentOverdue]);
  
  // פונקציה להשמעת צליל התראה
  const playAlarmSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // צליל ראשון
      const osc1 = audioContext.createOscillator();
      const gain1 = audioContext.createGain();
      osc1.connect(gain1);
      gain1.connect(audioContext.destination);
      osc1.frequency.value = 800;
      osc1.type = 'sine';
      gain1.gain.setValueAtTime(0.4, audioContext.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      osc1.start(audioContext.currentTime);
      osc1.stop(audioContext.currentTime + 0.3);
      
      // צליל שני
      setTimeout(() => {
        try {
          const osc2 = audioContext.createOscillator();
          const gain2 = audioContext.createGain();
          osc2.connect(gain2);
          gain2.connect(audioContext.destination);
          osc2.frequency.value = 1000;
          osc2.type = 'sine';
          gain2.gain.setValueAtTime(0.4, audioContext.currentTime);
          gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
          osc2.start(audioContext.currentTime);
          osc2.stop(audioContext.currentTime + 0.3);
        } catch (e) {}
      }, 200);
      
      // צליל שלישי
      setTimeout(() => {
        try {
          const osc3 = audioContext.createOscillator();
          const gain3 = audioContext.createGain();
          osc3.connect(gain3);
          gain3.connect(audioContext.destination);
          osc3.frequency.value = 1200;
          osc3.type = 'sine';
          gain3.gain.setValueAtTime(0.4, audioContext.currentTime);
          gain3.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
          osc3.start(audioContext.currentTime);
          osc3.stop(audioContext.currentTime + 0.4);
        } catch (e) {}
      }, 400);
    } catch (e) {
      console.warn('לא ניתן להשמיע צליל:', e);
    }
  }, []);
  
  // איפוס יומי
  useEffect(() => {
    const today = toLocalISODate(new Date());
    const savedToday = localStorage.getItem('overdue_handled_date');
    
    if (savedToday !== today) {
      localStorage.setItem('overdue_handled_date', today);
      localStorage.removeItem('overdue_handled_tasks');
      setHandledToday(new Set());
    } else {
      const saved = localStorage.getItem('overdue_handled_tasks');
      if (saved) {
        setHandledToday(new Set(JSON.parse(saved)));
      }
    }
  }, []);
  
  // בדיקת משימות באיחור - כל 30 שניות
  useEffect(() => {
    const checkOverdue = () => {
      const now = new Date();
      const today = toLocalISODate(now);
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      
      // מציאת משימות באיחור
      const overdueTasks = tasks.filter(task => {
        // רק משימות שלא הושלמו
        if (task.is_completed) return false;
        
        // רק משימות של היום
        if (task.due_date !== today) return false;
        
        // רק משימות עם שעה מוגדרת
        if (!task.due_time) return false;
        
        // כבר טופלה היום
        if (handledToday.has(task.id)) return false;
        
        // חישוב איחור
        const taskMinutes = timeToMinutes(task.due_time);
        if (taskMinutes === null) return false;
        
        // האם המשימה הייתה אמורה להסתיים?
        const taskEndMinutes = taskMinutes + (task.estimated_duration || 30);
        
        // אם עברנו את זמן הסיום המתוכנן - באיחור!
        // מתריעים רק אם עברו לפחות 5 דקות (כדי לא להציק)
        const isOverdue = currentMinutes > taskEndMinutes + 5;
        
        // אם לא התחילו לעבוד - באיחור גם אם עבר זמן ההתחלה
        const notStarted = !task.time_spent || task.time_spent === 0;
        const missedStart = notStarted && currentMinutes > taskMinutes + 10;
        
        return isOverdue || missedStart;
      });
      
      // אם יש משימות באיחור ואין פופאפ פתוח - פותחים
      if (overdueTasks.length > 0 && !currentOverdue) {
        // ממיינים לפי דחיפות
        const sorted = overdueTasks.sort((a, b) => {
          const priorityOrder = { urgent: 0, high: 1, normal: 2 };
          return (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2);
        });
        
        setCurrentOverdue(sorted[0]);
        
        // צליל התראה
        playAlarmSound();
        
        // רטט (מובייל)
        if ('vibrate' in navigator) {
          navigator.vibrate([300, 100, 300, 100, 300]);
        }
      }
    };
    
    // בדיקה ראשונית
    checkOverdue();
    
    // בדיקה כל 30 שניות
    const interval = setInterval(checkOverdue, 30 * 1000);
    
    return () => clearInterval(interval);
  }, [tasks, handledToday, currentOverdue, playAlarmSound]);
  
  // סימון משימה כ"טופלה"
  const markHandled = useCallback((taskId) => {
    setHandledToday(prev => {
      const newSet = new Set(prev);
      newSet.add(taskId);
      localStorage.setItem('overdue_handled_tasks', JSON.stringify([...newSet]));
      return newSet;
    });
    setCurrentOverdue(null);
    setShowRescheduleInput(false);
    setRescheduleTime('');
  }, []);
  
  // פעולה 1: להתחיל לעבוד עכשיו
  const handleStartNow = useCallback(() => {
    if (!currentOverdue) return;
    
    markHandled(currentOverdue.id);
    onStartTask?.(currentOverdue);
    toast.success(`💪 מתחילה לעבוד על "${currentOverdue.title}"`);
  }, [currentOverdue, markHandled, onStartTask]);
  
  // פעולה 2: דחייה לשעה ספציפית
  const handleReschedule = useCallback(async () => {
    if (!currentOverdue || !rescheduleTime) {
      toast.error('יש לבחור שעה');
      return;
    }
    
    try {
      await editTask(currentOverdue.id, {
        due_time: rescheduleTime
      });
      
      markHandled(currentOverdue.id);
      toast.success(`⏰ המשימה תזכיר לך ב-${rescheduleTime}`);
    } catch (err) {
      toast.error('שגיאה בעדכון המשימה');
    }
  }, [currentOverdue, rescheduleTime, editTask, markHandled]);
  
  // פעולה 3: דחייה למחר
  const handleMoveToTomorrow = useCallback(async () => {
    if (!currentOverdue) return;
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    // דילוג על שבת
    if (tomorrow.getDay() === 6) tomorrow.setDate(tomorrow.getDate() + 1);
    
    try {
      await editTask(currentOverdue.id, {
        due_date: toLocalISODate(tomorrow),
        due_time: null // יתוזמן מחדש
      });
      
      markHandled(currentOverdue.id);
      toast('📅 המשימה הועברה למחר', { icon: '⚠️' });
    } catch (err) {
      toast.error('שגיאה בעדכון המשימה');
    }
  }, [currentOverdue, editTask, markHandled]);
  
  // פעולה 4: סימון כהושלמה (אם באמת סיימו)
  const handleMarkComplete = useCallback(async () => {
    if (!currentOverdue) return;
    
    try {
      await editTask(currentOverdue.id, {
        is_completed: true
      });
      
      markHandled(currentOverdue.id);
      toast.success('✅ המשימה סומנה כהושלמה');
    } catch (err) {
      toast.error('שגיאה בעדכון המשימה');
    }
  }, [currentOverdue, editTask, markHandled]);
  
  // פעולה 5: ביטול המשימה
  const handleCancel = useCallback(async () => {
    if (!currentOverdue) return;
    
    // שואלים לאישור
    const confirmed = window.confirm(`האם את בטוחה שרוצה לבטל את "${currentOverdue.title}"?`);
    if (!confirmed) return;
    
    try {
      await editTask(currentOverdue.id, {
        is_completed: true,
        description: (currentOverdue.description || '') + '\n[בוטלה]'
      });
      
      markHandled(currentOverdue.id);
      toast('🗑️ המשימה בוטלה', { icon: '❌' });
    } catch (err) {
      toast.error('שגיאה בעדכון המשימה');
    }
  }, [currentOverdue, editTask, markHandled]);
  
  // חישוב זמן האיחור
  const getOverdueInfo = useCallback(() => {
    if (!currentOverdue) return null;
    
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const taskMinutes = timeToMinutes(currentOverdue.due_time);
    const taskEndMinutes = taskMinutes + (currentOverdue.estimated_duration || 30);
    
    const notStarted = !currentOverdue.time_spent || currentOverdue.time_spent === 0;
    const missedStartBy = currentMinutes - taskMinutes;
    const overdueBy = currentMinutes - taskEndMinutes;
    
    return {
      notStarted,
      missedStartBy: Math.max(0, missedStartBy),
      overdueBy: Math.max(0, overdueBy),
      scheduledTime: currentOverdue.due_time,
      scheduledEnd: `${Math.floor(taskEndMinutes / 60)}:${String(taskEndMinutes % 60).padStart(2, '0')}`,
      duration: currentOverdue.estimated_duration || 30,
      timeSpent: currentOverdue.time_spent || 0
    };
  }, [currentOverdue]);
  
  const overdueInfo = getOverdueInfo();
  
  if (!currentOverdue || !overdueInfo) return null;
  
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] p-4"
        // לא מאפשרים סגירה בלחיצה על הרקע!
      >
        <motion.div
          initial={{ scale: 0.8, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.8, y: 20 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
          dir="rtl"
        >
          {/* כותרת אדומה */}
          <div className="bg-red-500 text-white p-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">⏰</span>
              <div>
                <h2 className="text-xl font-bold">משימה באיחור!</h2>
                <p className="text-red-100 text-sm">נדרשת החלטה</p>
              </div>
            </div>
          </div>
          
          {/* תוכן */}
          <div className="p-4 space-y-4">
            {/* פרטי המשימה */}
            <div className="bg-red-50 dark:bg-red-900/30 rounded-xl p-4 border-2 border-red-200 dark:border-red-700">
              <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">
                {currentOverdue.title}
              </h3>
              
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-gray-600 dark:text-gray-300">
                  <span className="font-medium">תוכנן ל:</span> {overdueInfo.scheduledTime}
                </div>
                <div className="text-gray-600 dark:text-gray-300">
                  <span className="font-medium">משך:</span> {formatMinutes(overdueInfo.duration)}
                </div>
              </div>
              
              {/* סטטוס האיחור */}
              <div className="mt-3 pt-3 border-t border-red-200 dark:border-red-700">
                {overdueInfo.notStarted ? (
                  <div className="text-red-700 dark:text-red-400 font-medium">
                    ❌ לא התחלת! איחור של {formatMinutes(overdueInfo.missedStartBy)}
                  </div>
                ) : (
                  <div className="text-orange-700 dark:text-orange-400 font-medium">
                    ⏱️ עבדת {formatMinutes(overdueInfo.timeSpent)} מתוך {formatMinutes(overdueInfo.duration)}
                    <br />
                    <span className="text-red-700 dark:text-red-400">
                      חריגה של {formatMinutes(overdueInfo.overdueBy)}
                    </span>
                  </div>
                )}
              </div>
            </div>
            
            {/* אפשרויות פעולה */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                מה את רוצה לעשות?
              </p>
              
              {/* כפתור ראשי - להתחיל עכשיו */}
              <button
                onClick={handleStartNow}
                className="w-full py-3 px-4 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <span>▶️</span>
                <span>להתחיל לעבוד עכשיו</span>
              </button>
              
              {/* דחייה לשעה */}
              {!showRescheduleInput ? (
                <button
                  onClick={() => setShowRescheduleInput(true)}
                  className="w-full py-3 px-4 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <span>⏰</span>
                  <span>לדחות לשעה אחרת היום</span>
                </button>
              ) : (
                <div className="bg-blue-50 dark:bg-blue-900/30 rounded-xl p-3 border border-blue-200 dark:border-blue-700">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    לאיזה שעה לדחות?
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="time"
                      value={rescheduleTime}
                      onChange={(e) => setRescheduleTime(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                    <button
                      onClick={handleReschedule}
                      disabled={!rescheduleTime}
                      className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white font-medium rounded-lg transition-colors"
                    >
                      אישור
                    </button>
                    <button
                      onClick={() => setShowRescheduleInput(false)}
                      className="px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}
              
              {/* דחייה למחר */}
              <button
                onClick={handleMoveToTomorrow}
                className="w-full py-3 px-4 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <span>📅</span>
                <span>להעביר למחר</span>
              </button>
              
              {/* סימון כהושלמה */}
              {overdueInfo.timeSpent > 0 && (
                <button
                  onClick={handleMarkComplete}
                  className="w-full py-2 px-4 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <span>✅</span>
                  <span>כבר סיימתי (לסמן כהושלמה)</span>
                </button>
              )}
              
              {/* ביטול */}
              <button
                onClick={handleCancel}
                className="w-full py-2 px-4 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <span>🗑️</span>
                <span>לבטל את המשימה</span>
              </button>
            </div>
            
            {/* הודעה */}
            <div className="text-center text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-700">
              💡 לא ניתן לסגור בלי לבחור פעולה
            </div>
          </div>
        </motion.div>
        
        {/* צליל התראה - Web Audio API */}
      </motion.div>
    </AnimatePresence>
  );
}

export default OverdueTaskManager;
