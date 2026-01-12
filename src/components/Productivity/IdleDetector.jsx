import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTasks } from '../../hooks/useTasks';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';

/**
 * זיהוי זמן מת - עם אווטאר מנהלת המשרד
 * 
 * כשעוברות יותר מדי דקות בלי פעילות,
 * מנהלת המשרד מופיעה עם תזכורת ידידותית
 */

const IDLE_THRESHOLD_MINUTES = 5; // אחרי כמה דקות להתריע
const PAUSE_THRESHOLD_MINUTES = 5; // אחרי כמה דקות השהייה להתריע
const CHECK_INTERVAL_SECONDS = 30; // כל כמה לבדוק (הקטנתי כי הזמנים קצרים)

// ✅ מצב בדיקה - שנה ל-false אחרי הבדיקה!
const TEST_MODE = true;

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

function IdleDetector() {
  const { user } = useAuth();
  const { tasks } = useTasks();
  
  const [showAlert, setShowAlert] = useState(false);
  const [alertType, setAlertType] = useState('idle'); // 'idle' or 'paused'
  const [idleMinutes, setIdleMinutes] = useState(0);
  const [lastActivity, setLastActivity] = useState(new Date());
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
            pausedSince = data.lastPausedAt ? new Date(data.lastPausedAt) : null;
          }
        } catch (e) {}
      }
    }
    return { hasRunningTimer, hasPausedTimer, pausedTask, pausedSince };
  }, []);

  // בדיקה אם זה שעות עבודה
  const checkWorkHours = useCallback(() => {
    // ✅ מצב בדיקה - תמיד מחזיר true
    if (TEST_MODE) return true;
    
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();
    
    // ימים א'-ה'
    const isWorkDay = day >= 0 && day <= 4;
    // שעות 8:00-18:00
    const isWorkTime = hour >= 8 && hour < 18;
    
    return isWorkDay && isWorkTime;
  }, []);

  // בדיקה תקופתית
  useEffect(() => {
    if (!user) return;

    // פונקציית הבדיקה
    const checkIdleStatus = () => {
      const inWorkHours = checkWorkHours();
      setIsWorkHours(inWorkHours);
      
      console.log('🔍 IdleDetector:', { 
        inWorkHours, 
        showAlert,
        lastActivity: lastActivity.toLocaleTimeString(),
        minutesSinceActivity: Math.floor((new Date() - lastActivity) / 60000)
      });
      
      if (!inWorkHours) {
        console.log('❌ לא בשעות עבודה');
        setShowAlert(false);
        return;
      }

      const { hasRunningTimer, hasPausedTimer, pausedTask, pausedSince } = checkTimerStatus();
      console.log('🔍 Timer status:', { hasRunningTimer, hasPausedTimer });
      
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
          console.log('🚨 מציג התראה! דקות idle:', minutesIdle);
          setAlertType('idle');
          setCurrentMessage(getRandomMessage('idle', minutesIdle));
          setShowAlert(true);
        }
      }
    };

    // ✅ בדיקה ראשונית מיידית
    checkIdleStatus();
    
    // ✅ מצב בדיקה - מציג התראה מיידית!
    if (TEST_MODE && !showAlert) {
      console.log('🧪 TEST MODE - מציג התראה מיידית!');
      setIdleMinutes(5);
      setAlertType('idle');
      setCurrentMessage(getRandomMessage('idle', 5));
      setShowAlert(true);
    }

    // בדיקה תקופתית
    const interval = setInterval(checkIdleStatus, CHECK_INTERVAL_SECONDS * 1000);

    return () => clearInterval(interval);
  }, [user, lastActivity, showAlert, checkTimerStatus, checkWorkHours, getRandomMessage]);

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

    // הודעת עידוד
    const encouragement = MANAGER_MESSAGES.encouragement[
      Math.floor(Math.random() * MANAGER_MESSAGES.encouragement.length)
    ];
    toast(encouragement, { duration: 3000 });

    // איפוס
    setShowAlert(false);
    setLastActivity(new Date());
    setIdleMinutes(0);
  }, [idleMinutes, alertType, user?.id]);

  // דחייה זמנית
  const handleSnooze = useCallback(() => {
    setShowAlert(false);
    setLastActivity(new Date(Date.now() - (IDLE_THRESHOLD_MINUTES - 5) * 60000));
    toast('⏰ אזכיר שוב בעוד 5 דקות', { duration: 2000 });
  }, []);

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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={handleSnooze}
          />
          
          {/* חלון ההתראה */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 50 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50
                       w-[90%] max-w-md bg-white dark:bg-gray-800 rounded-3xl shadow-2xl
                       overflow-hidden"
            dir="rtl"
          >
            {/* כותרת עם אווטאר */}
            <div className="relative bg-gradient-to-l from-purple-600 via-pink-500 to-orange-400 p-6">
              {/* עיגולים דקורטיביים */}
              <div className="absolute top-0 left-0 w-32 h-32 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2"></div>
              <div className="absolute bottom-0 right-0 w-24 h-24 bg-white/10 rounded-full translate-x-1/3 translate-y-1/3"></div>
              
              <div className="relative flex items-center gap-4">
                {/* אווטאר מנהלת המשרד */}
                <div className="relative">
                  <motion.div
                    animate={{ 
                      scale: [1, 1.05, 1],
                      rotate: [0, 2, -2, 0]
                    }}
                    transition={{ 
                      duration: 2,
                      repeat: Infinity,
                      repeatType: "reverse"
                    }}
                    className="w-20 h-20 rounded-full overflow-hidden border-4 border-white shadow-lg"
                  >
                    <img 
                      src="/images/office-manager.jpg" 
                      alt="מנהלת המשרד"
                      className="w-full h-full object-cover object-top"
                    />
                  </motion.div>
                  {/* בועת דיבור קטנה */}
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.3 }}
                    className="absolute -top-1 -right-1 bg-white rounded-full p-1.5 shadow-md"
                  >
                    <span className="text-lg">👋</span>
                  </motion.div>
                </div>

                {/* טקסט */}
                <div className="flex-1 text-white">
                  <h2 className="text-xl font-bold mb-1">היי ליאת!</h2>
                  <p className="text-white/90 text-sm leading-relaxed">
                    {currentMessage}
                  </p>
                </div>
              </div>

              {/* מידע על המשימה המושהית */}
              {alertType === 'paused' && pausedTaskName && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="mt-4 bg-white/20 backdrop-blur-sm rounded-xl p-3"
                >
                  <p className="text-white/80 text-xs mb-1">משימה מושהית:</p>
                  <p className="text-white font-medium truncate">{pausedTaskName}</p>
                </motion.div>
              )}
            </div>

            {/* אפשרויות */}
            <div className="p-4 space-y-2">
              {/* כפתור ראשי */}
              {IDLE_REASONS.filter(r => r.primary).map(reason => (
                <motion.button
                  key={reason.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleResponse(reason)}
                  className="w-full p-4 rounded-xl bg-gradient-to-l from-green-500 to-emerald-500 
                           text-white font-bold text-lg shadow-lg shadow-green-500/30
                           flex items-center justify-center gap-3"
                >
                  <span className="text-2xl">{reason.icon}</span>
                  <span>{reason.label}</span>
                </motion.button>
              ))}

              {/* שאר האפשרויות */}
              <div className="grid grid-cols-2 gap-2 mt-3">
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
            </div>

            {/* כפתור דחייה */}
            <div className="px-4 pb-4">
              <button
                onClick={handleSnooze}
                className="w-full p-3 text-gray-400 dark:text-gray-500 text-sm 
                         hover:text-gray-600 dark:hover:text-gray-300 
                         hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all"
              >
                ⏰ הזכירי לי בעוד 5 דקות
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default IdleDetector;
