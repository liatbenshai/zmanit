import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TASK_TYPES } from '../../config/taskTypes';
import { formatDuration } from '../../config/workSchedule';
import toast from 'react-hot-toast';

/**
 * 🎯 FullScreenFocus - מסך מיקוד מלא
 * 
 * נפתח כשלוחצים "התחל לעבוד" על משימה
 * מציג רק את המשימה הנוכחית עם טיימר גדול
 */

// פורמט זמן MM:SS
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// פורמט שעה HH:MM
function formatTimeOfDay(date) {
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

export default function FullScreenFocus({ 
  isOpen, 
  task, 
  onClose, 
  onComplete,
  onPause,
  onTimeUpdate 
}) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const intervalRef = useRef(null);
  const elapsedRef = useRef(0);

  const taskType = task ? (TASK_TYPES[task.task_type] || TASK_TYPES.other) : TASK_TYPES.other;
  const estimated = task?.estimated_duration || 30;
  const timeSpent = task?.time_spent || 0;
  
  // התחלת טיימר כשנפתח
  useEffect(() => {
    if (isOpen && task) {
      setStartTime(new Date());
      setElapsedSeconds(0);
      setIsRunning(true);
      setIsPaused(false);
      
      // שמירת מצב טיימר
      localStorage.setItem('zmanit_active_timer', task.id);
      console.log('🎯 FullScreenFocus נפתח - טיימר:', task.id);
    }
  }, [isOpen, task?.id]);

  // טיימר
  const [showTimeUpDialog, setShowTimeUpDialog] = useState(false); // 🆕 דיאלוג סיום זמן
  const timeUpTriggeredRef = useRef(false); // למניעת התראה כפולה

  useEffect(() => {
    if (isRunning && !isPaused) {
      intervalRef.current = setInterval(() => {
        setElapsedSeconds(prev => {
          elapsedRef.current = prev + 1;
          return prev + 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, isPaused]);

  // 🆕 בדיקה אם הזמן המוקצב נגמר
  useEffect(() => {
    const totalMinutes = timeSpent + Math.floor(elapsedSeconds / 60);
    
    if (totalMinutes >= estimated && !timeUpTriggeredRef.current && isRunning) {
      timeUpTriggeredRef.current = true;
      
      // צליל התראה
      playTimeUpSound();
      
      // רטט (מובייל)
      if ('vibrate' in navigator) {
        navigator.vibrate([500, 200, 500, 200, 500]);
      }
      
      // פתיחת דיאלוג
      setShowTimeUpDialog(true);
    }
  }, [elapsedSeconds, timeSpent, estimated, isRunning]);

  // 🆕 צליל סיום זמן
  const playTimeUpSound = () => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // צליל מנצח
      const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
      notes.forEach((freq, i) => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.3, audioContext.currentTime + i * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + i * 0.15 + 0.3);
        osc.start(audioContext.currentTime + i * 0.15);
        osc.stop(audioContext.currentTime + i * 0.15 + 0.3);
      });
    } catch (e) {
      console.log('Audio not available');
    }
  };

  // חישוב אחוז התקדמות
  const totalMinutesWorked = timeSpent + Math.floor(elapsedSeconds / 60);
  const progressPercent = Math.min(100, Math.round((totalMinutesWorked / estimated) * 100));
  const remainingMinutes = Math.max(0, estimated - totalMinutesWorked);
  
  // זמן סיום משוער
  const estimatedEndTime = startTime 
    ? new Date(startTime.getTime() + remainingMinutes * 60 * 1000)
    : null;

  // השהיה
  const handlePause = () => {
    setIsRunning(false);
    setIsPaused(true);
    localStorage.removeItem('zmanit_active_timer');
    toast('⏸️ מושהה');
    onPause?.(Math.floor(elapsedRef.current / 60));
  };

  // המשך
  const handleResume = () => {
    setIsRunning(true);
    setIsPaused(false);
    localStorage.setItem('zmanit_active_timer', task.id);
    toast.success('▶️ ממשיכים!');
  };

  // סיום
  const handleComplete = () => {
    localStorage.removeItem('zmanit_active_timer');
    const minutesWorked = Math.floor(elapsedRef.current / 60);
    onTimeUpdate?.(minutesWorked);
    onComplete?.();
    toast.success('✅ כל הכבוד!');
  };

  // יציאה (מזעור)
  const handleMinimize = () => {
    // לא עוצרים את הטיימר, רק סוגרים את המסך
    toast('📌 הטיימר ממשיך ברקע');
    onClose?.();
  };

  if (!isOpen || !task) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col"
        dir="rtl"
      >
        {/* כפתור מזעור */}
        <div className="absolute top-4 left-4">
          <button
            onClick={handleMinimize}
            className="p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
            title="מזער (הטיימר ימשיך)"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* שעה נוכחית */}
        <div className="absolute top-4 right-4 text-white/60 text-lg">
          {formatTimeOfDay(new Date())}
        </div>

        {/* תוכן מרכזי */}
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          
          {/* אייקון סוג משימה */}
          <div className="text-6xl mb-4">{taskType.icon}</div>
          
          {/* שם המשימה */}
          <h1 className="text-3xl md:text-4xl font-bold text-white text-center mb-2">
            {task.title}
          </h1>
          
          {/* פרטים */}
          <div className="flex items-center gap-4 text-white/70 mb-8">
            <span className="px-3 py-1 rounded-full text-sm" style={{ backgroundColor: taskType.color + '40' }}>
              {taskType.name}
            </span>
            {task.client_name && (
              <span>👤 {task.client_name}</span>
            )}
          </div>

          {/* טיימר גדול */}
          <div className="relative mb-8">
            {/* עיגול התקדמות */}
            <svg className="w-64 h-64 md:w-80 md:h-80 transform -rotate-90">
              {/* רקע */}
              <circle
                cx="50%"
                cy="50%"
                r="45%"
                fill="none"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="8"
              />
              {/* התקדמות */}
              <circle
                cx="50%"
                cy="50%"
                r="45%"
                fill="none"
                stroke={progressPercent >= 100 ? '#22c55e' : taskType.color || '#3b82f6'}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${progressPercent * 2.83} 283`}
                className="transition-all duration-1000"
              />
            </svg>
            
            {/* זמן במרכז */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className={`text-5xl md:text-7xl font-mono font-bold ${isPaused ? 'text-yellow-400' : 'text-white'}`}>
                {formatTime(elapsedSeconds)}
              </div>
              <div className="text-white/60 text-lg mt-2">
                {progressPercent}% מתוך {formatDuration(estimated)}
              </div>
              {estimatedEndTime && remainingMinutes > 0 && (
                <div className="text-white/40 text-sm mt-1">
                  סיום משוער: {formatTimeOfDay(estimatedEndTime)}
                </div>
              )}
            </div>
          </div>

          {/* סטטיסטיקות */}
          <div className="flex gap-8 text-center mb-8">
            <div>
              <div className="text-2xl font-bold text-white">{formatDuration(totalMinutesWorked)}</div>
              <div className="text-white/60 text-sm">עבדת היום</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{formatDuration(remainingMinutes)}</div>
              <div className="text-white/60 text-sm">נשאר</div>
            </div>
          </div>

          {/* כפתורים */}
          <div className="flex gap-4">
            {!isPaused ? (
              <>
                <button
                  onClick={handlePause}
                  className="px-8 py-4 bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-2xl text-xl transition-colors"
                >
                  ⏸️ השהה
                </button>
                <button
                  onClick={handleComplete}
                  className="px-8 py-4 bg-green-500 hover:bg-green-600 text-white font-bold rounded-2xl text-xl transition-colors"
                >
                  ✅ סיימתי!
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleResume}
                  className="px-8 py-4 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-2xl text-xl transition-colors"
                >
                  ▶️ המשך
                </button>
                <button
                  onClick={handleComplete}
                  className="px-8 py-4 bg-green-500 hover:bg-green-600 text-white font-bold rounded-2xl text-xl transition-colors"
                >
                  ✅ סיימתי!
                </button>
              </>
            )}
          </div>
        </div>

        {/* הודעת מוטיבציה */}
        <div className="text-center pb-8">
          <p className="text-white/40 text-sm">
            {progressPercent < 25 && '💪 התחלה טובה! המשיכי ככה'}
            {progressPercent >= 25 && progressPercent < 50 && '🔥 את בדרך הנכונה!'}
            {progressPercent >= 50 && progressPercent < 75 && '⭐ יותר מחצי! מעולה!'}
            {progressPercent >= 75 && progressPercent < 100 && '🎯 כמעט שם! סיום קרוב!'}
            {progressPercent >= 100 && '🎉 עברת את הזמן המתוכנן! כל הכבוד!'}
          </p>
        </div>
        
        {/* 🆕 דיאלוג סיום זמן */}
        <AnimatePresence>
          {showTimeUpDialog && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.8, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-white dark:bg-gray-800 rounded-3xl p-8 max-w-md w-full text-center"
                dir="rtl"
              >
                <div className="text-6xl mb-4">⏰</div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  הזמן המוקצב נגמר!
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  עבדת {formatDuration(totalMinutesWorked)} על "{task?.title}"
                </p>
                
                <div className="space-y-3">
                  <button
                    onClick={() => {
                      setShowTimeUpDialog(false);
                      handleComplete();
                    }}
                    className="w-full py-4 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl text-lg transition-colors"
                  >
                    ✅ סיימתי את המשימה!
                  </button>
                  
                  <button
                    onClick={() => {
                      setShowTimeUpDialog(false);
                      toast('⏰ ממשיכה לעבוד...', { icon: '💪' });
                    }}
                    className="w-full py-4 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl text-lg transition-colors"
                  >
                    🔄 צריכה עוד זמן
                  </button>
                  
                  <button
                    onClick={() => {
                      setShowTimeUpDialog(false);
                      handlePause();
                    }}
                    className="w-full py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-xl transition-colors"
                  >
                    ⏸️ הפסקה
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
