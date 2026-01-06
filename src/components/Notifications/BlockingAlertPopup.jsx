/**
 * פופאפ התראה חוסם
 * ================
 * 
 * מציג התראה שדורשת תגובה מהמשתמש
 * לא ניתן לסגור אותה בלי לבחור פעולה
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ALERT_TYPES, ALERT_PRIORITY } from '../../utils/smartAlertManager';

/**
 * רכיב פופאפ התראה
 */
function BlockingAlertPopup({ 
  alert, 
  onAction, 
  onDismiss,
  allowDismiss = true 
}) {
  const [isVisible, setIsVisible] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const audioRef = useRef(null);
  
  // צליל התראה
  useEffect(() => {
    if (alert?.sound && audioRef.current) {
      audioRef.current.play().catch(() => {});
    }
  }, [alert]);
  
  // רטט (למובייל)
  useEffect(() => {
    if (alert?.vibrate && 'vibrate' in navigator) {
      navigator.vibrate([200, 100, 200, 100, 200]);
    }
  }, [alert]);
  
  // מונע סגירה אם זה פופאפ חוסם
  const handleBackdropClick = () => {
    if (!alert?.blockingPopup && allowDismiss) {
      onDismiss?.();
    }
  };
  
  const handleAction = (actionId) => {
    setIsVisible(false);
    setTimeout(() => {
      onAction?.(alert, actionId);
    }, 200);
  };
  
  if (!alert || !isVisible) return null;
  
  // צבעים לפי עדיפות
  const priorityStyles = {
    [ALERT_PRIORITY.CRITICAL]: {
      bg: 'bg-red-50 dark:bg-red-900/30',
      border: 'border-red-300 dark:border-red-700',
      icon: '🔴',
      headerBg: 'bg-red-500'
    },
    [ALERT_PRIORITY.HIGH]: {
      bg: 'bg-orange-50 dark:bg-orange-900/30',
      border: 'border-orange-300 dark:border-orange-700',
      icon: '🟠',
      headerBg: 'bg-orange-500'
    },
    [ALERT_PRIORITY.MEDIUM]: {
      bg: 'bg-blue-50 dark:bg-blue-900/30',
      border: 'border-blue-300 dark:border-blue-700',
      icon: '🔵',
      headerBg: 'bg-blue-500'
    },
    [ALERT_PRIORITY.LOW]: {
      bg: 'bg-gray-50 dark:bg-gray-800',
      border: 'border-gray-300 dark:border-gray-600',
      icon: '⚪',
      headerBg: 'bg-gray-500'
    }
  };
  
  const style = priorityStyles[alert.priority] || priorityStyles[ALERT_PRIORITY.MEDIUM];
  
  // אייקון לפי סוג התראה
  const getAlertIcon = () => {
    switch (alert.type) {
      case ALERT_TYPES.TASK_STARTING_SOON: return '⏰';
      case ALERT_TYPES.TASK_OVERDUE: return '🔴';
      case ALERT_TYPES.TRANSITION_NEEDED: return '🔄';
      case ALERT_TYPES.IDLE_DETECTED: return '😴';
      case ALERT_TYPES.BREAK_REMINDER: return '☕';
      case ALERT_TYPES.PROCRASTINATION_WARNING: return '🎯';
      case ALERT_TYPES.TASK_ENDING_SOON: return '⏱';
      default: return '📢';
    }
  };
  
  return (
    <AnimatePresence>
      {isVisible && (
        <>
          {/* רקע חוסם */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={handleBackdropClick}
          >
            {/* הפופאפ */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className={`
                w-full max-w-md rounded-2xl shadow-2xl overflow-hidden
                ${style.bg} ${style.border} border-2
              `}
              onClick={(e) => e.stopPropagation()}
            >
              {/* כותרת */}
              <div className={`${style.headerBg} text-white px-6 py-4`}>
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{getAlertIcon()}</span>
                  <div>
                    <h2 className="text-xl font-bold">
                      {alert.title}
                    </h2>
                    {alert.time && (
                      <div className="text-sm opacity-80">
                        {alert.time}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* תוכן */}
              <div className="p-6">
                <p className="text-lg text-gray-700 dark:text-gray-200 mb-6 leading-relaxed">
                  {alert.message}
                </p>
                
                {/* כפתורי פעולה */}
                <div className="space-y-3">
                  {alert.actions?.map((action, idx) => (
                    <button
                      key={action.id}
                      onClick={() => handleAction(action.id)}
                      className={`
                        w-full py-3 px-4 rounded-xl font-medium text-lg
                        transition-all duration-200 transform hover:scale-[1.02]
                        ${action.primary 
                          ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg' 
                          : 'bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600'
                        }
                      `}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
                
                {/* אפשרות לסגור אם מותר */}
                {!alert.blockingPopup && allowDismiss && (
                  <button
                    onClick={() => onDismiss?.()}
                    className="w-full mt-4 py-2 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    סגור
                  </button>
                )}
                
                {/* הודעה אם זה חוסם */}
                {alert.blockingPopup && (
                  <div className="mt-4 text-center text-sm text-gray-400">
                    * יש לבחור פעולה כדי להמשיך
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
          
          {/* אלמנט אודיו להתראה */}
          <audio ref={audioRef} preload="auto">
            <source src="/notification.mp3" type="audio/mpeg" />
            <source src="/notification.ogg" type="audio/ogg" />
          </audio>
        </>
      )}
    </AnimatePresence>
  );
}

/**
 * רכיב מנהל פופאפים
 * שומר על תור של התראות ומציג אחת אחת
 */
export function AlertPopupManager({ 
  alerts = [], 
  onAction, 
  onDismiss 
}) {
  const [currentAlert, setCurrentAlert] = useState(null);
  const [queue, setQueue] = useState([]);
  
  // עדכון תור ההתראות
  useEffect(() => {
    const newAlerts = alerts.filter(a => 
      a.showPopup && !queue.find(q => q.id === a.id)
    );
    
    if (newAlerts.length > 0) {
      setQueue(prev => [...prev, ...newAlerts]);
    }
  }, [alerts]);
  
  // הצגת ההתראה הבאה מהתור
  useEffect(() => {
    if (!currentAlert && queue.length > 0) {
      // מיון לפי עדיפות
      const priorityOrder = {
        [ALERT_PRIORITY.CRITICAL]: 0,
        [ALERT_PRIORITY.HIGH]: 1,
        [ALERT_PRIORITY.MEDIUM]: 2,
        [ALERT_PRIORITY.LOW]: 3
      };
      
      const sorted = [...queue].sort((a, b) => 
        (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3)
      );
      
      setCurrentAlert(sorted[0]);
    }
  }, [queue, currentAlert]);
  
  const handleAction = (alert, actionId) => {
    // הסרה מהתור
    setQueue(prev => prev.filter(a => a.id !== alert.id));
    setCurrentAlert(null);
    
    // קריאה לקולבק
    onAction?.(alert, actionId);
  };
  
  const handleDismiss = () => {
    if (currentAlert) {
      setQueue(prev => prev.filter(a => a.id !== currentAlert.id));
      setCurrentAlert(null);
      onDismiss?.(currentAlert);
    }
  };
  
  return (
    <BlockingAlertPopup
      alert={currentAlert}
      onAction={handleAction}
      onDismiss={handleDismiss}
      allowDismiss={!currentAlert?.blockingPopup}
    />
  );
}

/**
 * רכיב התראה קטנה (toast)
 */
export function AlertToast({ alert, onDismiss, onClick }) {
  const [isVisible, setIsVisible] = useState(true);
  
  useEffect(() => {
    // סגירה אוטומטית אחרי 5 שניות (אם לא דורש תגובה)
    if (!alert.requiresResponse) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => onDismiss?.(), 200);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [alert, onDismiss]);
  
  if (!isVisible) return null;
  
  const priorityColors = {
    [ALERT_PRIORITY.CRITICAL]: 'bg-red-500',
    [ALERT_PRIORITY.HIGH]: 'bg-orange-500',
    [ALERT_PRIORITY.MEDIUM]: 'bg-blue-500',
    [ALERT_PRIORITY.LOW]: 'bg-gray-500'
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 100 }}
      className={`
        ${priorityColors[alert.priority] || 'bg-blue-500'}
        text-white rounded-lg shadow-lg p-4 cursor-pointer
        max-w-sm
      `}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <span className="text-xl">{alert.icon || '📢'}</span>
        <div className="flex-1 min-w-0">
          <div className="font-medium">{alert.title}</div>
          <div className="text-sm opacity-90 truncate">{alert.message}</div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDismiss?.();
          }}
          className="text-white/70 hover:text-white"
        >
          ✕
        </button>
      </div>
    </motion.div>
  );
}

export default BlockingAlertPopup;
