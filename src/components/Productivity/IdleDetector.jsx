import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTasks } from '../../hooks/useTasks';
import { useAuth } from '../../hooks/useAuth';
import FullScreenFocus from '../ADHD/FullScreenFocus';
import { getDayOverrides } from '../DailyView/DayOverrideButton';
import { WORK_HOURS } from '../../config/workSchedule';
import toast from 'react-hot-toast';

/**
 * זיהוי זמן מת - עם אווטאר מנהלת המשרד
 * 
 * כשעוברות יותר מדי דקות בלי פעילות,
 * מנהלת המשרד מופיעה עם תזכורת ידידותית
 */

const IDLE_THRESHOLD_MINUTES = 5; // אחרי כמה דקות להתריע
const PAUSE_THRESHOLD_MINUTES = 5; // אחרי כמה דקות השהייה להתריע
const CHECK_INTERVAL_SECONDS = 30; // כל כמה לבדוק

// מצב בדיקה - כבוי
const TEST_MODE = false;

// הודעות מנהלת המשרד
const MANAGER_MESSAGES = {
  idle: [
    "ליאת, כבר {minutes} דקות בלי משימה פעילה... הכל בסדר?",
    "היי ליאת! שמתי לב שאת לא עובדת על כלום. מה קורה?",
    "ליאת, עברו {minutes} דקות. בואי נחזור לעבודה! 💪",
    "אני רואה שאת בהפסקה כבר {minutes} דקות... צריכה עזרה להתמקד?",
  ],
  paused: [
    "ליאת, השהית את המשימה כבר {minutes} דקות. הכל טוב?",
    "המשימה בהשהייה כבר {minutes} דקות... רוצה לחזור אליה?",
    "היי! שמתי לב שהמשימה מושהית. צריכה לתעד הפרעה?",
  ],
  encouragement: [
    "💪 קורה לכולם! העיקר שחזרת. בואי נתמקד!",
    "✨ מעולה שחזרת! בהצלחה!",
    "🎯 יופי, עכשיו בואי נעשה את זה!",
    "🚀 אחלה! חזרה לעבודה!",
  ]
};

// סוגי תשובות
const IDLE_REASONS = [
  { id: 'back_to_work', icon: '💪', label: 'חוזרת לעבודה!', color: 'green', primary: true },
  { id: 'interruption', icon: '📞', label: 'הייתה הפרעה', color: 'blue' },
  { id: 'break', icon: '☕', label: 'הפסקה מתוכננת', color: 'yellow' },
  { id: 'distracted', icon: '🫣', label: 'התפזרתי...', color: 'red' },
  { id: 'thinking', icon: '🤔', label: 'חושבת/מתכננת', color: 'purple' },
  { id: 'meeting', icon: '👥', label: 'הייתי בפגישה', color: 'indigo' },
];

/**
 * המרת תאריך לפורמט ISO מקומי
 */
function toLocalISODate(date) {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function IdleDetector() {
  const { user } = useAuth();
  const { tasks, editTask, toggleComplete, addTask } = useTasks();
  const navigate = useNavigate();
  
  const [showAlert, setShowAlert] = useState(false);
  const [alertDismissedAt, setAlertDismissedAt] = useState(null); // 🆕 מתי נסגרה ההתראה
  const [alertType, setAlertType] = useState('idle'); // 'idle' or 'paused'
  const [idleMinutes, setIdleMinutes] = useState(0);
  const [lastActivity, setLastActivity] = useState(new Date());
  
  // 🆕 State לפוקוס
  const [showFocus, setShowFocus] = useState(false);
  const [focusTask, setFocusTask] = useState(null);
  
  // 🆕 מציאת המשימה הבאה לעבודה
  const nextTask = useMemo(() => {
    if (!tasks || tasks.length === 0) return null;
    
    const today = toLocalISODate(new Date()); // 🔧 תיקון
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    // משימות של היום שלא הושלמו
    const todayTasks = tasks.filter(t => {
      if (t.is_completed || t.deleted_at) return false;
      const taskDate = t.due_date ? toLocalISODate(new Date(t.due_date)) : null;
      return taskDate === today;
    });
    
    // משימות באיחור (מימים קודמים)
    const overdueTasks = tasks.filter(t => {
      if (t.is_completed || t.deleted_at || !t.due_date) return false;
      const taskDate = toLocalISODate(new Date(t.due_date));
      return taskDate < today;
    });
    
    // משימות שהשעה שלהן כבר עברה היום
    const lateToday = todayTasks.filter(t => {
      if (!t.due_time) return false;
      const [h, m] = t.due_time.split(':').map(Number);
      const taskMinutes = h * 60 + (m || 0);
      return taskMinutes < currentMinutes; // השעה כבר עברה
    });
    
    // משימות שעדיין לא הגיע הזמן שלהן
    const upcomingToday = todayTasks.filter(t => {
      if (!t.due_time) return true; // משימות בלי שעה
      const [h, m] = t.due_time.split(':').map(Number);
      const taskMinutes = h * 60 + (m || 0);
      return taskMinutes >= currentMinutes;
    });
    
    // פונקציית מיון
    const sortTasks = (taskList) => {
      return taskList.sort((a, b) => {
        // דחוף קודם
        if (a.priority === 'urgent' && b.priority !== 'urgent') return -1;
        if (b.priority === 'urgent' && a.priority !== 'urgent') return 1;
        
        // לפי שעה
        if (a.due_time && b.due_time) return a.due_time.localeCompare(b.due_time);
        if (a.due_time) return -1;
        if (b.due_time) return 1;
        
        // לפי תאריך (הישן יותר קודם)
        if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
        
        return 0;
      });
    };
    
    // סדר עדיפויות:
    // 1. משימות באיחור מימים קודמים
    // 2. משימות שהשעה שלהן עברה היום
    // 3. משימות דחופות
    // 4. משימות רגילות לפי שעה
    
    const sortedOverdue = sortTasks([...overdueTasks]);
    const sortedLateToday = sortTasks([...lateToday]);
    const sortedUpcoming = sortTasks([...upcomingToday]);
    
    // מחזיר את המשימה הראשונה לפי העדיפות
    return sortedOverdue[0] || sortedLateToday[0] || sortedUpcoming[0] || null;
  }, [tasks]);
  const [pausedTaskName, setPausedTaskName] = useState('');
  const [isWorkHours, setIsWorkHours] = useState(true);
  const [currentMessage, setCurrentMessage] = useState('');

  // בחירת הודעה אקראית
  const getRandomMessage = useCallback((type, minutes) => {
    const messages = MANAGER_MESSAGES[type];
    const msg = messages[Math.floor(Math.random() * messages.length)];
    return msg.replace('{minutes}', minutes);
  }, []);

  // בדיקה אם יש טיימר רץ או מושהה
  const checkTimerStatus = useCallback(() => {
    let hasRunningTimer = false;
    let hasPausedTimer = false;
    let pausedTask = '';
    let pausedSince = null;

    // בדיקה אם יש טיימר פעיל מ-FullScreenFocus
    const activeTimer = localStorage.getItem('zmanit_active_timer');
    if (activeTimer) {
      hasRunningTimer = true;
    }

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('timer_v2_')) {
        try {
          const data = JSON.parse(localStorage.getItem(key));
          if (data?.isRunning && !data?.isInterrupted) {
            hasRunningTimer = true;
          } else if (data?.isRunning && data?.isInterrupted) {
            // טיימר מושהה
            hasPausedTimer = true;
            pausedTask = data.taskTitle || '';
            // תיקון: חיפוש interruptionStart או lastPausedAt
            const pauseTime = data.interruptionStart || data.lastPausedAt;
            pausedSince = pauseTime ? new Date(pauseTime) : null;
          }
        } catch (e) {}
      }
      // בדיקה של zmanit_focus_paused (מ-FullScreenFocus)
      if (key === 'zmanit_focus_paused') {
        try {
          const data = JSON.parse(localStorage.getItem(key));
          if (data?.isPaused && data?.pausedAt) {
            hasPausedTimer = true;
            pausedTask = data.taskTitle || '';
            pausedSince = new Date(data.pausedAt);
          }
        } catch (e) {}
      }
    }
    return { hasRunningTimer, hasPausedTimer, pausedTask, pausedSince };
  }, []);

  // בדיקה אם זה שעות עבודה - עם תמיכה בדריסות יום
  const checkWorkHours = useCallback(() => {
    // מצב בדיקה - תמיד מחזיר true
    if (TEST_MODE) return true;
    
    const now = new Date();
    const hour = now.getHours();
    const minutes = now.getMinutes();
    const day = now.getDay();
    const dateISO = now.toISOString().split('T')[0];
    
    // קבלת הגדרות יום העבודה מ-WORK_HOURS
    const dayConfig = WORK_HOURS[day];
    if (!dayConfig || !dayConfig.enabled) {
      return false; // יום לא פעיל (שישי/שבת)
    }
    
    // בדיקת דריסות יום (אם המשתמש שינה שעות ליום ספציפי)
    const overrides = getDayOverrides();
    const dayOverride = overrides[dateISO];
    
    // שימוש בשעות מותאמות או ברירת מחדל
    let startHour, endHour;
    if (dayOverride) {
      startHour = dayOverride.start; // פורמט עשרוני: 8.5 = 08:30
      endHour = dayOverride.end;
    } else {
      startHour = dayConfig.start;
      endHour = dayConfig.end;
    }
    
    // המרה לדקות
    const currentTime = hour * 60 + minutes;
    const startTime = Math.floor(startHour * 60);
    const endTime = Math.floor(endHour * 60);
    
    const isWorkTime = currentTime >= startTime && currentTime <= endTime;
    
    return isWorkTime;
  }, []);

  // בדיקה תקופתית
  useEffect(() => {
    if (!user) return;

    // פונקציית הבדיקה
    const checkIdleStatus = () => {
      const inWorkHours = checkWorkHours();
      setIsWorkHours(inWorkHours);
      
      if (!inWorkHours) {
        setShowAlert(false);
        return;
      }

      // 🆕 בדיקת cooldown - לא להציג התראה חדשה תוך 60 שניות מסגירה
      if (alertDismissedAt) {
        const secondsSinceDismiss = Math.floor((new Date() - alertDismissedAt) / 1000);
        if (secondsSinceDismiss < 60) {
          return; // עדיין ב-cooldown
        }
      }

      const { hasRunningTimer, hasPausedTimer, pausedTask, pausedSince } = checkTimerStatus();
      
      if (hasRunningTimer) {
        // יש טיימר רץ - איפוס
        setLastActivity(new Date());
        setIdleMinutes(0);
        setShowAlert(false);
      } else if (hasPausedTimer && pausedSince) {
        // טיימר מושהה - בדיקת זמן
        const minutesPaused = Math.floor((new Date() - pausedSince) / 60000);
        setIdleMinutes(minutesPaused);
        if (minutesPaused >= PAUSE_THRESHOLD_MINUTES && !showAlert) {
          setAlertType('paused');
          setPausedTaskName(pausedTask);
          setCurrentMessage(getRandomMessage('paused', minutesPaused));
          setShowAlert(true);
        }
      } else {
        // אין טיימר בכלל
        const now = new Date();
        const minutesIdle = Math.floor((now - lastActivity) / 60000);
        setIdleMinutes(minutesIdle);
        
        if (minutesIdle >= IDLE_THRESHOLD_MINUTES && !showAlert) {
          setAlertType('idle');
          setCurrentMessage(getRandomMessage('idle', minutesIdle));
          setShowAlert(true);
        }
      }
    };

    // בדיקה ראשונית מיידית
    checkIdleStatus();

    // בדיקה תקופתית
    const interval = setInterval(checkIdleStatus, CHECK_INTERVAL_SECONDS * 1000);

    return () => clearInterval(interval);
  }, [user, lastActivity, showAlert, alertDismissedAt, checkTimerStatus, checkWorkHours, getRandomMessage]);

  // טיפול בתשובה
  const handleResponse = useCallback(async (reason) => {
    const idleRecord = {
      reason: reason.id,
      reasonLabel: reason.label,
      duration: idleMinutes,
      type: alertType,
      timestamp: new Date().toISOString()
    };

    // שמירה ב-localStorage
    try {
      const today = new Date().toISOString().split('T')[0];
      const key = `idle_log_${user?.id}_${today}`;
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      existing.push(idleRecord);
      localStorage.setItem(key, JSON.stringify(existing));
    } catch (e) {
      console.error('Error saving idle log:', e);
    }

    // סגירת ההתראה
    setShowAlert(false);
    setAlertDismissedAt(new Date());
    setLastActivity(new Date());
    setIdleMinutes(0);

    // 🆕 פתיחת משימה אם לחצו "חוזרת לעבודה"
    if (reason.id === 'back_to_work') {
      // בדיקה אם יש משימה מושהית
      const pausedData = localStorage.getItem('zmanit_focus_paused');
      if (pausedData) {
        try {
          const { taskId } = JSON.parse(pausedData);
          const pausedTask = tasks?.find(t => t.id === taskId);
          if (pausedTask && !pausedTask.is_completed) {
            // פתיחת המשימה המושהית
            setFocusTask(pausedTask);
            setShowFocus(true);
            toast.success('🔄 חוזרת למשימה שהפסקת!', { duration: 2000 });
            return;
          }
        } catch (e) {}
      }
      
      // אם אין משימה מושהית - פתיחת המשימה הבאה
      if (nextTask) {
        setFocusTask(nextTask);
        setShowFocus(true);
        toast.success(`🎯 מתחילה: ${nextTask.title}`, { duration: 2000 });
        return;
      }
      
      // אם אין משימות - ניווט לתצוגה יומית
      toast('📋 אין משימות מתוכננות - בואי נתכנן!', { duration: 3000 });
      navigate('/daily');
      return;
    }

    // הודעת עידוד לשאר הסיבות
    const encouragement = MANAGER_MESSAGES.encouragement[
      Math.floor(Math.random() * MANAGER_MESSAGES.encouragement.length)
    ];
    toast(encouragement, { duration: 3000 });
  }, [idleMinutes, alertType, user?.id, tasks, nextTask, navigate]);
  
  // 🆕 עדכון זמן עבודה
  const handleFocusTimeUpdate = useCallback(async (minutes) => {
    if (!focusTask) return;
    try {
      const newTimeSpent = (focusTask.time_spent || 0) + minutes;
      await editTask(focusTask.id, { time_spent: newTimeSpent });
      setFocusTask(prev => prev ? { ...prev, time_spent: newTimeSpent } : null);
    } catch (err) {
      console.error('שגיאה בעדכון זמן:', err);
    }
  }, [focusTask, editTask]);
  
  // 🆕 סיום משימה
  const handleFocusComplete = useCallback(async () => {
    if (!focusTask) return;
    try {
      await toggleComplete(focusTask.id);
      setShowFocus(false);
      setFocusTask(null);
      toast.success('✅ כל הכבוד!');
    } catch (err) {
      toast.error('שגיאה');
    }
  }, [focusTask, toggleComplete]);

  // דחייה זמנית
  const handleSnooze = useCallback(() => {
    setShowAlert(false);
    setAlertDismissedAt(new Date()); // 🆕 שמירת זמן הסגירה
    setLastActivity(new Date(Date.now() - (IDLE_THRESHOLD_MINUTES - 5) * 60000));
    toast('⏰ אזכיר שוב בעוד 5 דקות', { duration: 2000 });
  }, []);

  if (!user || !isWorkHours) return null;

  return (
    <AnimatePresence>
      {showAlert && (
        <>
          {/* רקע כהה - מעל FullScreenFocus */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[10000]"
            onClick={handleSnooze}
          />
          
          {/* חלון ההתראה - מרכז המסך */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[10001]
                       w-[95%] max-w-2xl bg-white dark:bg-gray-800 rounded-3xl shadow-2xl
                       overflow-hidden"
            dir="rtl"
          >
            {/* תוכן ראשי - אווטאר בצד */}
            <div className="flex">
              {/* צד ימין - אווטאר גדול */}
              <div className="relative bg-gradient-to-b from-purple-600 via-pink-500 to-orange-400 flex flex-col items-center justify-start overflow-hidden min-w-[220px]">
                {/* עיגולים דקורטיביים */}
                <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
                
                {/* אווטאר גדול - מלבני עם פינות מעוגלות */}
                <motion.div
                  animate={{ 
                    scale: [1, 1.02, 1],
                  }}
                  transition={{ 
                    duration: 3,
                    repeat: Infinity,
                    repeatType: "reverse"
                  }}
                  className="relative w-full"
                >
                  <div className="w-full h-56 overflow-hidden">
                    <img 
                      src="/images/office-manager.jpg" 
                      alt="מנהלת המשרד"
                      className="w-full h-full object-cover object-top"
                    />
                  </div>
                  {/* בועת דיבור */}
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.3 }}
                    className="absolute top-3 left-3 bg-white rounded-full p-2 shadow-lg"
                  >
                    <span className="text-2xl">👋</span>
                  </motion.div>
                </motion.div>

                {/* הודעה */}
                <div className="p-4 text-center text-white">
                  <h2 className="text-xl font-bold">היי ליאת!</h2>
                  <p className="text-white/90 text-sm mt-2 leading-relaxed">
                    {currentMessage}
                  </p>
                  
                  {/* מידע על המשימה המושהית */}
                  {alertType === 'paused' && pausedTaskName && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="mt-3 bg-white/20 backdrop-blur-sm rounded-xl p-2"
                    >
                      <p className="text-white/70 text-xs">משימה מושהית:</p>
                      <p className="text-white text-sm font-medium truncate">{pausedTaskName}</p>
                    </motion.div>
                  )}
                </div>
              </div>

              {/* צד שמאל - אפשרויות */}
              <div className="flex-1 p-5">
                <h3 className="text-gray-500 dark:text-gray-400 text-sm mb-3">מה קרה?</h3>
                
                {/* כפתור ראשי */}
                {IDLE_REASONS.filter(r => r.primary).map(reason => (
                  <motion.button
                    key={reason.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleResponse(reason)}
                    className="w-full p-4 rounded-xl bg-gradient-to-l from-green-500 to-emerald-500 
                             text-white font-bold text-lg shadow-lg shadow-green-500/30
                             flex items-center justify-center gap-3 mb-4"
                  >
                    <span className="text-2xl">{reason.icon}</span>
                    <span>{reason.label}</span>
                  </motion.button>
                ))}

                {/* שאר האפשרויות */}
                <div className="grid grid-cols-2 gap-2">
                  {IDLE_REASONS.filter(r => !r.primary).map(reason => (
                    <motion.button
                      key={reason.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleResponse(reason)}
                      className={`
                        p-3 rounded-xl flex items-center gap-2 transition-all text-sm
                        ${reason.color === 'blue' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : ''}
                        ${reason.color === 'yellow' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' : ''}
                        ${reason.color === 'red' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' : ''}
                        ${reason.color === 'purple' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' : ''}
                        ${reason.color === 'indigo' ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' : ''}
                      `}
                    >
                      <span className="text-xl">{reason.icon}</span>
                      <span className="font-medium">{reason.label}</span>
                    </motion.button>
                  ))}
                </div>

                {/* כפתור דחייה */}
                <button
                  onClick={handleSnooze}
                  className="w-full mt-4 p-3 text-gray-400 dark:text-gray-500 text-sm 
                           hover:text-gray-600 dark:hover:text-gray-300 
                           hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all"
                >
                  ⏰ הזכירי לי בעוד 5 דקות
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
      
      {/* 🆕 מסך מיקוד */}
      <FullScreenFocus
        isOpen={showFocus}
        task={focusTask}
        onClose={() => {
          setShowFocus(false);
          setFocusTask(null);
        }}
        onComplete={handleFocusComplete}
        onPause={handleFocusTimeUpdate}
        onTimeUpdate={handleFocusTimeUpdate}
        onAddTask={addTask}
      />
    </AnimatePresence>
  );
}

export default IdleDetector;
