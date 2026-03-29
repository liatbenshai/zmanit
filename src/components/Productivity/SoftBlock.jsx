import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';

/**
 * חסימה רכה - מתריע כשמנסים לעבור משימה באמצע עבודה
 * 
 * עוקב אחרי טיימר פעיל ומציג אזהרה אם המשתמש מנסה
 * להתחיל טיימר אחר או לצאת מהמשימה
 */

// Context לשיתוף מצב הטיימר הפעיל
import { createContext, useContext } from 'react';

const ActiveTimerContext = createContext(null);

export function useActiveTimer() {
  return useContext(ActiveTimerContext);
}

export function ActiveTimerProvider({ children }) {
  const [activeTimer, setActiveTimer] = useState(null);
  const [showWarning, setShowWarning] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  // בדיקת טיימר פעיל מ-localStorage
  const checkActiveTimer = useCallback(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('timer_v2_')) {
        try {
          const data = JSON.parse(localStorage.getItem(key));
          if (data?.isRunning && !data?.isInterrupted) {
            const taskId = key.replace('timer_v2_', '');
            return {
              taskId,
              taskTitle: data.taskTitle || 'משימה פעילה',
              startTime: new Date(data.startTime),
              elapsedMinutes: Math.floor((new Date() - new Date(data.startTime)) / 60000)
            };
          }
        } catch (e) {}
      }
    }
    return null;
  }, []);

  // עדכון תקופתי
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTimer(checkActiveTimer());
    }, 5000);
    
    setActiveTimer(checkActiveTimer());
    return () => clearInterval(interval);
  }, [checkActiveTimer]);

  // בקשה להתחיל טיימר חדש
  const requestStartTimer = useCallback((taskId, taskTitle, onConfirm) => {
    const current = checkActiveTimer();
    
    if (current && current.taskId !== taskId) {
      // יש טיימר אחר פעיל - הצג אזהרה
      setPendingAction({ taskId, taskTitle, onConfirm });
      setShowWarning(true);
      return false;
    }
    
    // אין טיימר פעיל או זה אותו טיימר - המשך
    if (onConfirm) onConfirm();
    return true;
  }, [checkActiveTimer]);

  // אישור מעבר
  const confirmSwitch = useCallback(() => {
    // עצירת הטיימר הקודם
    const current = checkActiveTimer();
    if (current) {
      const key = `timer_v2_${current.taskId}`;
      try {
        const data = JSON.parse(localStorage.getItem(key));
        if (data) {
          data.isRunning = false;
          data.pausedAt = new Date().toISOString();
          localStorage.setItem(key, JSON.stringify(data));
        }
      } catch (e) {}
    }

    // הפעלת הפעולה הממתינה
    if (pendingAction?.onConfirm) {
      pendingAction.onConfirm();
    }

    setShowWarning(false);
    setPendingAction(null);
    toast('⏸️ הטיימר הקודם הופסק', { duration: 2000 });
  }, [pendingAction, checkActiveTimer]);

  // ביטול
  const cancelSwitch = useCallback(() => {
    setShowWarning(false);
    setPendingAction(null);
  }, []);

  return (
    <ActiveTimerContext.Provider value={{ 
      activeTimer, 
      requestStartTimer,
      checkActiveTimer 
    }}>
      {children}

      {/* חלון אזהרה */}
      <AnimatePresence>
        {showWarning && activeTimer && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50"
              onClick={cancelSwitch}
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50
                         w-[90%] max-w-sm bg-white dark:bg-gray-800 rounded-2xl shadow-2xl
                         overflow-hidden"
            >
              {/* כותרת */}
              <div className="bg-gradient-to-l from-orange-500 to-yellow-500 p-4 text-white">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <span>⚠️</span>
                  רגע, יש משימה פעילה!
                </h2>
              </div>

              <div className="p-4 space-y-4">
                {/* משימה נוכחית */}
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="text-sm text-gray-600 dark:text-gray-400">עכשיו עובדת על:</div>
                  <div className="font-medium text-gray-800 dark:text-gray-200 mt-1">
                    {activeTimer.taskTitle}
                  </div>
                  <div className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                    ⏱️ כבר {activeTimer.elapsedMinutes} דקות
                  </div>
                </div>

                {/* משימה חדשה */}
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  רוצה לעבור ל: <strong>{pendingAction?.taskTitle}</strong>
                </div>

                {/* שאלה */}
                <div className="text-center text-gray-700 dark:text-gray-300">
                  בטוח לעבור משימה?
                </div>

                {/* כפתורים */}
                <div className="flex gap-3">
                  <button
                    onClick={cancelSwitch}
                    className="flex-1 p-3 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium"
                  >
                    🎯 להישאר
                  </button>
                  <button
                    onClick={confirmSwitch}
                    className="flex-1 p-3 rounded-lg border border-gray-300 text-gray-700 dark:text-gray-300"
                  >
                    לעבור →
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </ActiveTimerContext.Provider>
  );
}

export default ActiveTimerProvider;
