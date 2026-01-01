import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTasks } from '../../hooks/useTasks';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';

/**
 * זיהוי זמן מת - מתריע כשאין טיימר רץ
 * 
 * הרעיון: אם עברו X דקות בלי שום פעילות (טיימר לא רץ),
 * המערכת שואלת "מה קורה?" ומתעדת את התשובה
 */

const IDLE_THRESHOLD_MINUTES = 15; // אחרי כמה דקות להתריע
const CHECK_INTERVAL_SECONDS = 60; // כל כמה לבדוק

// סוגי תשובות לזמן מת
const IDLE_REASONS = [
  { id: 'back_to_work', icon: '💪', label: 'חוזרת לעבודה', color: 'green' },
  { id: 'interruption', icon: '📞', label: 'הייתה הפרעה', color: 'blue' },
  { id: 'break', icon: '☕', label: 'הפסקה', color: 'yellow' },
  { id: 'distracted', icon: '🫣', label: 'התפזרתי...', color: 'red' },
  { id: 'thinking', icon: '🤔', label: 'חושבת/מתכננת', color: 'purple' },
  { id: 'other', icon: '❓', label: 'אחר', color: 'gray' }
];

function IdleDetector() {
  const { user } = useAuth();
  const { tasks } = useTasks();
  
  const [showAlert, setShowAlert] = useState(false);
  const [idleMinutes, setIdleMinutes] = useState(0);
  const [lastActivity, setLastActivity] = useState(new Date());
  const [idleHistory, setIdleHistory] = useState([]);
  const [isWorkHours, setIsWorkHours] = useState(true);

  // בדיקה אם יש טיימר רץ
  const checkForRunningTimer = useCallback(() => {
    // בודק ב-localStorage אם יש טיימר פעיל
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('timer_v2_')) {
        try {
          const data = JSON.parse(localStorage.getItem(key));
          if (data?.isRunning && !data?.isInterrupted) {
            return true; // יש טיימר רץ
          }
        } catch (e) {}
      }
    }
    return false;
  }, []);

  // בדיקה אם זה שעות עבודה
  const checkWorkHours = useCallback(() => {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();
    
    // ימים א'-ה' (0=ראשון, 6=שבת)
    const isWorkDay = day >= 0 && day <= 4;
    // שעות 8:00-17:00
    const isWorkTime = hour >= 8 && hour < 17;
    
    return isWorkDay && isWorkTime;
  }, []);

  // בדיקה תקופתית
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      const inWorkHours = checkWorkHours();
      setIsWorkHours(inWorkHours);
      
      // רק בשעות עבודה
      if (!inWorkHours) {
        setShowAlert(false);
        return;
      }

      const hasRunningTimer = checkForRunningTimer();
      
      if (hasRunningTimer) {
        // יש טיימר - איפוס
        setLastActivity(new Date());
        setIdleMinutes(0);
        setShowAlert(false);
      } else {
        // אין טיימר - חישוב זמן מת
        const now = new Date();
        const minutesIdle = Math.floor((now - lastActivity) / 60000);
        setIdleMinutes(minutesIdle);
        
        // הצגת התראה אם עבר הסף
        if (minutesIdle >= IDLE_THRESHOLD_MINUTES && !showAlert) {
          setShowAlert(true);
        }
      }
    }, CHECK_INTERVAL_SECONDS * 1000);

    // בדיקה ראשונית
    setIsWorkHours(checkWorkHours());

    return () => clearInterval(interval);
  }, [user, lastActivity, showAlert, checkForRunningTimer, checkWorkHours]);

  // טיפול בתשובה
  const handleResponse = useCallback(async (reason) => {
    const idleRecord = {
      reason: reason.id,
      reasonLabel: reason.label,
      duration: idleMinutes,
      timestamp: new Date().toISOString()
    };

    // שמירה בהיסטוריה מקומית
    setIdleHistory(prev => [...prev, idleRecord]);
    
    // שמירה ב-localStorage לסטטיסטיקות
    try {
      const today = new Date().toISOString().split('T')[0];
      const key = `idle_log_${user?.id}_${today}`;
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      existing.push(idleRecord);
      localStorage.setItem(key, JSON.stringify(existing));
    } catch (e) {
      console.error('Error saving idle log:', e);
    }

    // הודעה מותאמת
    if (reason.id === 'distracted') {
      toast('💪 קורה! העיקר שחזרת. בואי נתמקד', { icon: '🎯' });
    } else if (reason.id === 'back_to_work') {
      toast.success('מעולה! בהצלחה 🚀');
    } else if (reason.id === 'break') {
      toast('הפסקות חשובות! עכשיו חזרה לעבודה 💪', { icon: '☕' });
    }

    // איפוס
    setShowAlert(false);
    setLastActivity(new Date());
    setIdleMinutes(0);
  }, [idleMinutes, user?.id]);

  // דחייה זמנית (5 דקות)
  const handleSnooze = useCallback(() => {
    setShowAlert(false);
    setLastActivity(new Date(Date.now() - (IDLE_THRESHOLD_MINUTES - 5) * 60000)); // יתריע שוב בעוד 5 דק'
    toast('⏰ אזכיר שוב בעוד 5 דקות', { duration: 2000 });
  }, []);

  // לא מציג אם אין משתמש או לא בשעות עבודה
  if (!user || !isWorkHours) return null;

  return (
    <AnimatePresence>
      {showAlert && (
        <>
          {/* רקע כהה */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50"
            onClick={handleSnooze}
          />
          
          {/* חלון ההתראה */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50
                       w-[90%] max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl
                       overflow-hidden"
          >
            {/* כותרת */}
            <div className="bg-gradient-to-l from-orange-500 to-red-500 p-4 text-white">
              <div className="flex items-center gap-3">
                <span className="text-3xl">⏰</span>
                <div>
                  <h2 className="text-xl font-bold">מה קורה?</h2>
                  <p className="text-orange-100 text-sm">
                    עברו {idleMinutes} דקות בלי פעילות
                  </p>
                </div>
              </div>
            </div>

            {/* אפשרויות */}
            <div className="p-4 space-y-2">
              {IDLE_REASONS.map(reason => (
                <button
                  key={reason.id}
                  onClick={() => handleResponse(reason)}
                  className={`
                    w-full p-3 rounded-xl flex items-center gap-3 transition-all
                    hover:scale-[1.02] active:scale-[0.98]
                    ${reason.color === 'green' ? 'bg-green-100 dark:bg-green-900/30 hover:bg-green-200' : ''}
                    ${reason.color === 'blue' ? 'bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200' : ''}
                    ${reason.color === 'yellow' ? 'bg-yellow-100 dark:bg-yellow-900/30 hover:bg-yellow-200' : ''}
                    ${reason.color === 'red' ? 'bg-red-100 dark:bg-red-900/30 hover:bg-red-200' : ''}
                    ${reason.color === 'purple' ? 'bg-purple-100 dark:bg-purple-900/30 hover:bg-purple-200' : ''}
                    ${reason.color === 'gray' ? 'bg-gray-100 dark:bg-gray-700/30 hover:bg-gray-200' : ''}
                  `}
                >
                  <span className="text-2xl">{reason.icon}</span>
                  <span className="font-medium text-gray-800 dark:text-gray-200">
                    {reason.label}
                  </span>
                </button>
              ))}
            </div>

            {/* כפתור דחייה */}
            <div className="p-4 pt-0">
              <button
                onClick={handleSnooze}
                className="w-full p-2 text-gray-500 dark:text-gray-400 text-sm hover:text-gray-700"
              >
                הזכר לי בעוד 5 דקות
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default IdleDetector;
