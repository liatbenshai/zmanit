/**
 * מעקב פרודוקטיביות - ניטור זמן חכם
 * ====================================
 * 
 * מזהה כש"מעגלים פינות" ומעודד להישאר ממוקדים
 * 
 * תכונות:
 * 1. מעקב אחר זמן פעילות במשימה
 * 2. זיהוי חוסר פעילות (idle)
 * 3. זיהוי החלפות תכופות בין משימות
 * 4. סיכום יומי של זמן עבודה בפועל
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

// סוגי התראות (היו בקובץ smartAlertManager שנמחק)
const ALERT_TYPES = {
  IDLE_DETECTED: 'idle_detected',
  PROCRASTINATION_WARNING: 'procrastination_warning'
};

/**
 * הגדרות ניטור
 */
const MONITOR_CONFIG = {
  idleThreshold: 5 * 60 * 1000,        // 5 דקות = חוסר פעילות
  warningThreshold: 3 * 60 * 1000,      // 3 דקות = אזהרה
  taskSwitchWindow: 30 * 60 * 1000,     // 30 דקות - חלון לספירת החלפות
  maxSwitches: 5,                        // מקסימום החלפות לפני אזהרה
  checkInterval: 30 * 1000,              // בדיקה כל 30 שניות
  focusSessionLength: 45 * 60 * 1000,    // 45 דקות - סשן ריכוז
  breakLength: 5 * 60 * 1000             // 5 דקות הפסקה
};

/**
 * רכיב ניטור פרודוקטיביות
 */
function ProductivityMonitor({ 
  activeTask = null,
  scheduledBlocks = [],
  onAlert,
  onStartTask,
  onPauseTask,
  onCompleteTask
}) {
  const [isActive, setIsActive] = useState(false);
  const [activeSeconds, setActiveSeconds] = useState(0);
  const [idleSeconds, setIdleSeconds] = useState(0);
  const [taskSwitches, setTaskSwitches] = useState([]);
  const [lastActivity, setLastActivity] = useState(Date.now());
  const [focusMode, setFocusMode] = useState(false);
  const [showWarning, setShowWarning] = useState(null);
  const [dailyStats, setDailyStats] = useState({
    activeMinutes: 0,
    idleMinutes: 0,
    tasksCompleted: 0,
    interruptions: 0
  });
  
  const timerRef = useRef(null);
  const lastTaskIdRef = useRef(null);
  
  // מעקב אחר פעילות
  useEffect(() => {
    const trackActivity = () => {
      setLastActivity(Date.now());
      if (idleSeconds > 0) {
        setIdleSeconds(0);
      }
    };
    
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach(e => window.addEventListener(e, trackActivity, { passive: true }));
    
    return () => {
      events.forEach(e => window.removeEventListener(e, trackActivity));
    };
  }, [idleSeconds]);
  
  // טיימר מעקב
  useEffect(() => {
    if (activeTask) {
      setIsActive(true);
      
      // בדיקת החלפת משימה
      if (lastTaskIdRef.current && lastTaskIdRef.current !== activeTask.id) {
        recordTaskSwitch();
      }
      lastTaskIdRef.current = activeTask.id;
      
      timerRef.current = setInterval(() => {
        const now = Date.now();
        const timeSinceActivity = now - lastActivity;
        
        if (timeSinceActivity > MONITOR_CONFIG.idleThreshold) {
          // חוסר פעילות!
          setIdleSeconds(prev => prev + 1);
          
          if (idleSeconds === 0) {
            showIdleWarning();
          }
        } else if (timeSinceActivity > MONITOR_CONFIG.warningThreshold) {
          // אזהרה על חוסר פעילות קרב
          setIdleSeconds(prev => prev + 0.5);
        } else {
          setActiveSeconds(prev => prev + 1);
        }
        
        // בדיקת עיגול פינות
        checkProcrastination();
        
      }, 1000);
      
      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      };
    } else {
      setIsActive(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  }, [activeTask, lastActivity]);
  
  // רישום החלפת משימה
  const recordTaskSwitch = useCallback(() => {
    const now = Date.now();
    const recentSwitches = taskSwitches.filter(t => now - t < MONITOR_CONFIG.taskSwitchWindow);
    recentSwitches.push(now);
    setTaskSwitches(recentSwitches);
    
    setDailyStats(prev => ({
      ...prev,
      interruptions: prev.interruptions + 1
    }));
  }, [taskSwitches]);
  
  // בדיקת עיגול פינות
  const checkProcrastination = useCallback(() => {
    const now = Date.now();
    const recentSwitches = taskSwitches.filter(t => now - t < MONITOR_CONFIG.taskSwitchWindow);
    
    if (recentSwitches.length >= MONITOR_CONFIG.maxSwitches) {
      showProcrastinationWarning();
    }
  }, [taskSwitches]);
  
  // הצגת אזהרת חוסר פעילות
  const showIdleWarning = () => {
    setShowWarning({
      type: 'idle',
      title: '😴 נראה שיש הפסקה...',
      message: activeTask 
        ? `זיהינו חוסר פעילות. האם את עדיין עובדת על "${activeTask.title}"?`
        : 'מה עושים עכשיו?',
      actions: [
        { id: 'continue', label: '▶ ממשיכה', primary: true },
        { id: 'break', label: '☕ הפסקה' },
        { id: 'done', label: '✅ סיימתי' }
      ]
    });
    
    onAlert?.({
      type: ALERT_TYPES.IDLE_DETECTED,
      priority: 'high'
    });
  };
  
  // הצגת אזהרת עיגול פינות
  const showProcrastinationWarning = () => {
    if (showWarning?.type === 'procrastination') return; // כבר מוצגת
    
    const switches = taskSwitches.length;
    
    setShowWarning({
      type: 'procrastination',
      title: '🎯 נראה שיש קצת עיגול פינות...',
      message: `החלפת משימות ${switches} פעמים ב-30 הדקות האחרונות. בואי נתמקד במשימה אחת!`,
      actions: [
        { id: 'focus', label: '🎯 מצב ריכוז', primary: true },
        { id: 'choose', label: '📋 בחרי משימה' },
        { id: 'dismiss', label: '👍 הבנתי' }
      ]
    });
    
    onAlert?.({
      type: ALERT_TYPES.PROCRASTINATION_WARNING,
      priority: 'high'
    });
  };
  
  // טיפול בפעולות אזהרה
  const handleWarningAction = (actionId) => {
    switch (actionId) {
      case 'continue':
        setLastActivity(Date.now());
        setIdleSeconds(0);
        break;
        
      case 'break':
        onPauseTask?.();
        toast('☕ תהני מההפסקה! אני אזכיר לך לחזור.');
        // כאן היינו מתזמנים תזכורת לחזור
        break;
        
      case 'done':
        if (activeTask) {
          onCompleteTask?.(activeTask.id);
        }
        break;
        
      case 'focus':
        setFocusMode(true);
        setTaskSwitches([]);
        toast.success('🎯 מצב ריכוז הופעל! התראות מושתקות ל-45 דקות.');
        break;
        
      case 'choose':
        // פתיחת בחירת משימה
        break;
    }
    
    setShowWarning(null);
  };
  
  // סגירת אזהרה
  const dismissWarning = () => {
    setShowWarning(null);
    setLastActivity(Date.now());
  };
  
  // פורמט זמן
  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    
    if (h > 0) {
      return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${m}:${String(s).padStart(2, '0')}`;
  };
  
  return (
    <>
      {/* סרגל מצב */}
      <div className="fixed bottom-4 left-4 z-40">
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className={`
            rounded-xl shadow-lg px-4 py-2 flex items-center gap-4
            ${focusMode 
              ? 'bg-purple-600 text-white' 
              : isActive 
                ? 'bg-green-600 text-white' 
                : 'bg-gray-800 text-white'
            }
          `}
        >
          {/* סטטוס */}
          <div className="flex items-center gap-2">
            <span className="text-lg">
              {focusMode ? '🎯' : isActive ? '▶' : '⏸'}
            </span>
            <span className="font-medium">
              {focusMode 
                ? 'מצב ריכוז' 
                : isActive 
                  ? 'עובדת' 
                  : 'ממתינה'
              }
            </span>
          </div>
          
          {/* טיימר */}
          {isActive && (
            <div className="flex items-center gap-2 border-r border-white/30 pr-4">
              <span className="text-sm opacity-80">זמן פעיל:</span>
              <span className="font-mono font-bold">
                {formatTime(activeSeconds)}
              </span>
            </div>
          )}
          
          {/* משימה נוכחית */}
          {activeTask && (
            <div className="flex items-center gap-2 max-w-[200px]">
              <span className="truncate text-sm">
                {activeTask.title}
              </span>
            </div>
          )}
          
          {/* אינדיקטור חוסר פעילות */}
          {idleSeconds > 30 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-1 bg-yellow-500 text-yellow-900 px-2 py-1 rounded-full text-xs font-medium"
            >
              <span>😴</span>
              <span>{Math.floor(idleSeconds / 60)}:{String(Math.floor(idleSeconds) % 60).padStart(2, '0')}</span>
            </motion.div>
          )}
          
          {/* מצב ריכוז - יציאה */}
          {focusMode && (
            <button
              onClick={() => setFocusMode(false)}
              className="text-xs opacity-70 hover:opacity-100"
            >
              צא ממצב ריכוז
            </button>
          )}
        </motion.div>
      </div>
      
      {/* פופאפ אזהרה */}
      <AnimatePresence>
        {showWarning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className={`
                w-full max-w-md rounded-2xl shadow-2xl overflow-hidden bg-white dark:bg-gray-800
              `}
            >
              {/* כותרת */}
              <div className={`
                px-6 py-4 text-white
                ${showWarning.type === 'idle' ? 'bg-yellow-500' : 'bg-purple-500'}
              `}>
                <h2 className="text-xl font-bold">{showWarning.title}</h2>
              </div>
              
              {/* תוכן */}
              <div className="p-6">
                <p className="text-lg text-gray-700 dark:text-gray-200 mb-6">
                  {showWarning.message}
                </p>
                
                {/* סטטיסטיקות */}
                {showWarning.type === 'idle' && (
                  <div className="mb-4 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm">
                    <div className="flex justify-between">
                      <span>זמן פעיל היום:</span>
                      <span className="font-bold">{formatTime(activeSeconds)}</span>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span>זמן לא פעיל:</span>
                      <span className="font-bold text-yellow-600">{formatTime(Math.floor(idleSeconds))}</span>
                    </div>
                  </div>
                )}
                
                {showWarning.type === 'procrastination' && (
                  <div className="mb-4 p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg text-sm">
                    <div className="flex justify-between">
                      <span>החלפות משימה:</span>
                      <span className="font-bold text-purple-600">{taskSwitches.length}</span>
                    </div>
                    <div className="mt-2 text-xs text-gray-500">
                      💡 טיפ: נסי להישאר על משימה אחת לפחות 25 דקות
                    </div>
                  </div>
                )}
                
                {/* כפתורי פעולה */}
                <div className="space-y-3">
                  {showWarning.actions.map((action, idx) => (
                    <button
                      key={action.id}
                      onClick={() => handleWarningAction(action.id)}
                      className={`
                        w-full py-3 px-4 rounded-xl font-medium text-lg transition-all
                        ${action.primary 
                          ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                          : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200'
                        }
                      `}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/**
 * סיכום יומי
 */
export function DailyProductivitySummary({ stats }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
      <h3 className="font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
        <span>📊</span>
        סיכום היום
      </h3>
      
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
          <div className="text-2xl font-bold text-green-600">
            {Math.floor((stats.activeMinutes || 0) / 60)}:{String((stats.activeMinutes || 0) % 60).padStart(2, '0')}
          </div>
          <div className="text-xs text-gray-500">שעות עבודה</div>
        </div>
        
        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">
            {stats.tasksCompleted || 0}
          </div>
          <div className="text-xs text-gray-500">משימות הושלמו</div>
        </div>
        
        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg">
          <div className="text-2xl font-bold text-yellow-600">
            {Math.floor((stats.idleMinutes || 0))}
          </div>
          <div className="text-xs text-gray-500">דקות לא פעיל</div>
        </div>
        
        <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg">
          <div className="text-2xl font-bold text-purple-600">
            {stats.interruptions || 0}
          </div>
          <div className="text-xs text-gray-500">הפרעות</div>
        </div>
      </div>
      
      {/* טיפ */}
      {(stats.idleMinutes || 0) > 30 && (
        <div className="mt-3 p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg text-sm text-yellow-800 dark:text-yellow-200">
          💡 היום היה קצת זמן לא פעיל. נסי מחר לקחת הפסקות קצרות יותר.
        </div>
      )}
    </div>
  );
}

export default ProductivityMonitor;
