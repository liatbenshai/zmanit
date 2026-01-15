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
  onTimeUpdate,
  onAddTask, // 🆕 להוספת בלת"ם
  onLogInterruption // 🆕 לתיעוד הפרעה
}) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [showInterruptionModal, setShowInterruptionModal] = useState(false); // 🆕 פופאפ בלת"ם
  const [interruptionTitle, setInterruptionTitle] = useState(''); // 🆕 כותרת בלת"ם
  const [showLogInterruptionModal, setShowLogInterruptionModal] = useState(false); // 🆕 תיעוד הפרעה
  const [interruptionType, setInterruptionType] = useState('distraction'); // 🆕 סוג הפרעה
  const [interruptionNote, setInterruptionNote] = useState(''); // 🆕 הערה להפרעה
  const intervalRef = useRef(null);
  const elapsedRef = useRef(0);

  // 🆕 סוגי הפרעות
  const INTERRUPTION_TYPES = {
    client_call: { name: 'שיחת לקוח', icon: '📞' },
    phone_call: { name: 'שיחת טלפון', icon: '📱' },
    meeting: { name: 'פגישה לא מתוכננת', icon: '👥' },
    distraction: { name: 'הסחת דעת', icon: '🎯' },
    break: { name: 'הפסקה', icon: '☕' },
    technical: { name: 'בעיה טכנית', icon: '🔧' },
    colleague: { name: 'עמית לעבודה', icon: '🧑‍💼' },
    other: { name: 'אחר', icon: '❓' }
  };

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
  const [showFeedbackOptions, setShowFeedbackOptions] = useState(false); // 🆕 הצגת אפשרויות משוב
  const [taskExtended, setTaskExtended] = useState(false); // 🆕 האם המשימה הוארכה
  const timeUpTriggeredRef = useRef(false); // למניעת התראה כפולה
  const lastSavedMinuteRef = useRef(0); // 🆕 לשמירה תקופתית
  
  // 🆕 שמירה תקופתית של הזמן כל 60 שניות
  useEffect(() => {
    if (!isRunning || isPaused || !task?.id || !onTimeUpdate) return;
    
    const saveInterval = setInterval(async () => {
      const currentMinutes = Math.floor(elapsedRef.current / 60);
      
      // שומרים רק אם עברה לפחות דקה מהשמירה האחרונה
      if (currentMinutes > 0 && currentMinutes !== lastSavedMinuteRef.current) {
        lastSavedMinuteRef.current = currentMinutes;
        
        try {
          // שליחת הזמן הכולל (כולל מה שכבר נשמר)
          const totalMinutes = timeSpent + currentMinutes;
          await onTimeUpdate(totalMinutes, true); // true = הטיימר עדיין רץ
          console.log('⏱️ שמירה תקופתית:', totalMinutes, 'דקות');
        } catch (err) {
          console.error('❌ שגיאה בשמירה תקופתית:', err);
        }
      }
    }, 60 * 1000); // כל 60 שניות
    
    return () => clearInterval(saveInterval);
  }, [isRunning, isPaused, task?.id, onTimeUpdate, timeSpent]);
  
  // בדיקה אם המשימה כבר הוארכה בעבר
  useEffect(() => {
    if (task?.id) {
      try {
        const extensions = JSON.parse(localStorage.getItem('zmanit_task_extensions') || '{}');
        setTaskExtended(!!extensions[task.id]?.extended);
      } catch (e) {}
    }
  }, [task?.id]);

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
  const handlePause = async () => {
    setIsRunning(false);
    setIsPaused(true);
    localStorage.removeItem('zmanit_active_timer');
    
    // שמירת מצב השהייה ל-IdleDetector
    localStorage.setItem('zmanit_focus_paused', JSON.stringify({
      isPaused: true,
      pausedAt: new Date().toISOString(),
      taskId: task.id,
      taskTitle: task.title
    }));
    
    // 🔧 תיקון: שימוש ב-elapsedSeconds כגיבוי
    const currentElapsed = elapsedRef.current > 0 ? elapsedRef.current : elapsedSeconds;
    const minutesWorked = Math.floor(currentElapsed / 60);
    
    console.log('💾 FullScreenFocus handlePause - elapsedRef:', elapsedRef.current, 'elapsedSeconds:', elapsedSeconds, 'minutesWorked:', minutesWorked);
    
    if (onPause && minutesWorked > 0) {
      await onPause(minutesWorked);
      console.log('💾 FullScreenFocus handlePause - נשמרו:', minutesWorked, 'דקות');
      // 🆕 איפוס אחרי שמירה כדי לא לספור פעמיים
      elapsedRef.current = 0;
      setElapsedSeconds(0);
    }
    
    toast('⏸️ מושהה');
  };

  // המשך
  const handleResume = () => {
    setIsRunning(true);
    setIsPaused(false);
    localStorage.setItem('zmanit_active_timer', task.id);
    localStorage.removeItem('zmanit_focus_paused'); // מחיקת מצב השהייה
    toast.success('▶️ ממשיכים!');
  };

  // סיום
  const handleComplete = async () => {
    localStorage.removeItem('zmanit_active_timer');
    localStorage.removeItem('zmanit_focus_paused'); // ניקוי מצב השהייה
    
    // 🔧 תיקון: שימוש ב-elapsedSeconds (הערך המעודכן) ולא elapsedRef
    const currentElapsed = elapsedRef.current > 0 ? elapsedRef.current : elapsedSeconds;
    const minutesWorked = Math.max(1, Math.floor(currentElapsed / 60)); // לפחות דקה אחת
    
    console.log('💾 FullScreenFocus handleComplete - elapsedRef:', elapsedRef.current, 'elapsedSeconds:', elapsedSeconds, 'minutesWorked:', minutesWorked);
    
    // 🔧 תיקון: await לשמירת הזמן לפני סימון כהושלם
    if (onTimeUpdate && minutesWorked > 0) {
      await onTimeUpdate(minutesWorked);
      console.log('💾 FullScreenFocus handleComplete - נשמרו:', minutesWorked, 'דקות');
    }
    
    if (onComplete) {
      await onComplete();
    }
    
    toast.success(`✅ כל הכבוד! עבדת ${minutesWorked} דקות`);
  };

  // 🆕 שמירת משוב וסיום
  const saveFeedbackAndComplete = async (feedback) => {
    const currentElapsed = elapsedRef.current > 0 ? elapsedRef.current : elapsedSeconds;
    const minutesWorked = timeSpent + Math.floor(currentElapsed / 60);
    try {
      const feedbackData = JSON.parse(localStorage.getItem('zmanit_completion_feedback') || '[]');
      feedbackData.push({
        taskId: task?.id,
        taskType: task?.task_type,
        feedback,
        actualDuration: minutesWorked,
        estimatedDuration: estimated,
        ratio: minutesWorked / estimated,
        timestamp: new Date().toISOString()
      });
      // שומרים רק 100 אחרונים
      if (feedbackData.length > 100) feedbackData.shift();
      localStorage.setItem('zmanit_completion_feedback', JSON.stringify(feedbackData));
    } catch (e) {}
    
    const messages = {
      completed_all: '🎉 מעולה! סיימת הכל!',
      completed_partial: '👍 טוב! סיימת חלק',
      did_not_finish: '📝 נרשם - נלמד מזה'
    };
    
    toast.success(messages[feedback]);
    setShowTimeUpDialog(false);
    setShowFeedbackOptions(false);
    await handleComplete();
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
          
          {/* 🆕 כפתורי הפרעות */}
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => setShowLogInterruptionModal(true)}
              className="flex-1 px-4 py-3 bg-orange-500/80 hover:bg-orange-600 text-white font-medium rounded-xl transition-colors"
            >
              ⏸️ הפרעה - תעד והמשך
            </button>
            <button
              onClick={() => setShowInterruptionModal(true)}
              className="flex-1 px-4 py-3 bg-red-500/80 hover:bg-red-600 text-white font-medium rounded-xl transition-colors"
            >
              🚨 בלת"ם - משימה דחופה
            </button>
          </div>
        </div>

        {/* 🆕 פופאפ תיעוד הפרעה */}
        <AnimatePresence>
          {showLogInterruptionModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
              onClick={() => setShowLogInterruptionModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full"
                dir="rtl"
              >
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  ⏸️ הפרעה
                </h3>
                
                {/* בחירת סוג הפרעה */}
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {Object.entries(INTERRUPTION_TYPES).map(([key, { name, icon }]) => (
                    <button
                      key={key}
                      onClick={() => setInterruptionType(key)}
                      className={`p-2 rounded-lg text-center transition-all ${
                        interruptionType === key
                          ? 'bg-orange-500 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      <span className="text-xl block">{icon}</span>
                      <span className="text-xs">{name}</span>
                    </button>
                  ))}
                </div>
                
                {/* הערה */}
                <input
                  type="text"
                  value={interruptionNote}
                  onChange={(e) => setInterruptionNote(e.target.value)}
                  placeholder="הערה (אופציונלי)"
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-xl mb-4 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                
                <div className="space-y-3">
                  {/* כפתור ראשי - עצור ושמור */}
                  <button
                    onClick={async () => {
                      // 1. שמירת הזמן
                      const minutesWorked = Math.floor(elapsedRef.current / 60);
                      if (onPause && minutesWorked > 0) {
                        await onPause(minutesWorked);
                        // איפוס אחרי שמירה
                        elapsedRef.current = 0;
                        setElapsedSeconds(0);
                      }
                      
                      // 2. תיעוד ההפרעה
                      if (onLogInterruption) {
                        await onLogInterruption({
                          type: interruptionType,
                          description: interruptionNote.trim() || INTERRUPTION_TYPES[interruptionType].name,
                          task_id: task?.id,
                          duration: 0
                        });
                      }
                      
                      // 3. ניקוי
                      localStorage.removeItem('zmanit_active_timer');
                      toast.success(`💾 נשמרו ${minutesWorked} דקות. הפרעה תועדה.`);
                      setInterruptionNote('');
                      setShowLogInterruptionModal(false);
                      onClose?.(); // סגירת מסך המיקוד
                    }}
                    className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition-colors"
                  >
                    ⏹️ עצור ושמור ({Math.floor(elapsedRef.current / 60)} דקות)
                  </button>
                  
                  {/* כפתור משני - רק תעד וחזור */}
                  <button
                    onClick={async () => {
                      if (onLogInterruption) {
                        await onLogInterruption({
                          type: interruptionType,
                          description: interruptionNote.trim() || INTERRUPTION_TYPES[interruptionType].name,
                          task_id: task?.id,
                          duration: 0
                        });
                      }
                      toast.success('הפרעה תועדה ✓');
                      setInterruptionNote('');
                      setShowLogInterruptionModal(false);
                    }}
                    className="w-full py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-xl transition-colors"
                  >
                    📝 רק תעד (המשך לעבוד)
                  </button>
                  
                  <button
                    onClick={() => {
                      setShowLogInterruptionModal(false);
                      setInterruptionNote('');
                    }}
                    className="w-full py-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 transition-colors"
                  >
                    ביטול
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 🆕 פופאפ בלת"ם */}
        <AnimatePresence>
          {showInterruptionModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
              onClick={() => setShowInterruptionModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full"
                dir="rtl"
              >
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  🚨 הוספת בלת"ם
                </h3>
                
                <input
                  type="text"
                  value={interruptionTitle}
                  onChange={(e) => setInterruptionTitle(e.target.value)}
                  placeholder="מה צריך לעשות?"
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-xl mb-4 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  autoFocus
                />
                
                <div className="space-y-3">
                  {/* כפתור ראשי - עצור ועבור לבלת"מ */}
                  <button
                    onClick={async () => {
                      if (interruptionTitle.trim() && onAddTask) {
                        // 1. שמירת הזמן של המשימה הנוכחית
                        const minutesWorked = Math.floor(elapsedRef.current / 60);
                        if (onPause && minutesWorked > 0) {
                          await onPause(minutesWorked);
                          // איפוס אחרי שמירה
                          elapsedRef.current = 0;
                          setElapsedSeconds(0);
                        }
                        
                        // 2. הוספת הבלת"מ
                        const today = new Date().toISOString().split('T')[0];
                        await onAddTask({
                          title: `🚨 ${interruptionTitle.trim()}`,
                          quadrant: 1, // דחוף וחשוב
                          due_date: today,
                          priority: 'urgent',
                          estimated_duration: 15
                        });
                        
                        // 3. ניקוי וסגירה
                        localStorage.removeItem('zmanit_active_timer');
                        toast.success(`💾 נשמרו ${minutesWorked} דקות. בלת"ם נוסף!`);
                        setInterruptionTitle('');
                        setShowInterruptionModal(false);
                        onClose?.(); // סגירת מסך המיקוד
                      }
                    }}
                    className="w-full py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition-colors"
                  >
                    🔄 עצור ועבור לבלת"ם
                  </button>
                  
                  {/* כפתור משני - רק הוסף וחזור */}
                  <button
                    onClick={async () => {
                      if (interruptionTitle.trim() && onAddTask) {
                        const today = new Date().toISOString().split('T')[0];
                        await onAddTask({
                          title: `🚨 ${interruptionTitle.trim()}`,
                          quadrant: 1,
                          due_date: today,
                          priority: 'urgent',
                          estimated_duration: 15
                        });
                        toast.success('בלת"ם נוסף - ממשיכים!');
                        setInterruptionTitle('');
                        setShowInterruptionModal(false);
                      }
                    }}
                    className="w-full py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-xl transition-colors"
                  >
                    📝 רק הוסף לרשימה (המשך לעבוד)
                  </button>
                  
                  <button
                    onClick={() => {
                      setShowInterruptionModal(false);
                      setInterruptionTitle('');
                    }}
                    className="w-full py-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 transition-colors"
                  >
                    ביטול
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

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
        
        {/* 🆕 דיאלוג סיום זמן - עם הארכה 20% ומשוב */}
        <AnimatePresence>
          {showTimeUpDialog && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
            >
              <motion.div
                initial={{ scale: 0.8, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-white dark:bg-gray-800 rounded-3xl p-6 max-w-md w-full"
                dir="rtl"
              >
                {!showFeedbackOptions ? (
                  <>
                    {/* מצב ראשון - בחירה בין הארכה לסיום */}
                    <div className="text-center mb-6">
                      <div className="text-5xl mb-3">⏰</div>
                      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                        הזמן המוקצב נגמר!
                      </h2>
                      <p className="text-gray-600 dark:text-gray-400 text-sm">
                        עבדת {formatDuration(totalMinutesWorked)} על "{task?.title}"
                      </p>
                    </div>
                    
                    {/* סטטיסטיקה */}
                    <div className="flex justify-center gap-4 mb-6">
                      <div className="bg-gray-100 dark:bg-gray-700 rounded-lg px-4 py-2 text-center">
                        <div className="text-xs text-gray-500">תוכנן</div>
                        <div className="font-bold">{estimated} דק'</div>
                      </div>
                      <div className="bg-gray-100 dark:bg-gray-700 rounded-lg px-4 py-2 text-center">
                        <div className="text-xs text-gray-500">בפועל</div>
                        <div className="font-bold">{totalMinutesWorked} דק'</div>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      {/* כפתור הארכה 20% - רק אם לא הוארכה */}
                      {!taskExtended && (
                        <button
                          onClick={() => {
                            const extensionMinutes = Math.ceil(estimated * 0.2);
                            setTaskExtended(true);
                            setShowTimeUpDialog(false);
                            // שמירה ב-localStorage שהמשימה הוארכה
                            try {
                              const extensions = JSON.parse(localStorage.getItem('zmanit_task_extensions') || '{}');
                              extensions[task.id] = { extended: true, timestamp: new Date().toISOString() };
                              localStorage.setItem('zmanit_task_extensions', JSON.stringify(extensions));
                            } catch (e) {}
                            toast.success(`⏱️ נוספו ${extensionMinutes} דקות (20%)`, { duration: 3000 });
                          }}
                          className="w-full py-4 bg-gradient-to-r from-orange-400 to-amber-500 text-white font-bold rounded-xl text-lg shadow-lg shadow-orange-500/30 flex items-center justify-center gap-2"
                        >
                          <span>⏱️</span>
                          <span>עוד {Math.ceil(estimated * 0.2)} דקות (20%)</span>
                        </button>
                      )}
                      
                      {taskExtended && (
                        <div className="w-full py-3 bg-gray-100 dark:bg-gray-700 text-gray-500 font-medium rounded-xl text-center">
                          ⚠️ כבר השתמשת בהארכה
                        </div>
                      )}
                      
                      <button
                        onClick={() => setShowFeedbackOptions(true)}
                        className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl text-lg shadow-lg shadow-green-500/30"
                      >
                        ✓ סיימתי - תני משוב
                      </button>
                      
                      <button
                        onClick={() => {
                          setShowTimeUpDialog(false);
                          toast('💪 ממשיכה...', { duration: 2000 });
                        }}
                        className="w-full py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-xl"
                      >
                        ממשיכה בלי הארכה
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    {/* מצב שני - משוב על הספק */}
                    <div className="text-center mb-6">
                      <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                        איך הרגשת עם ההספק?
                      </h2>
                      <p className="text-gray-500 text-sm mt-1">המערכת לומדת כדי להציע הערכות טובות יותר</p>
                    </div>
                    
                    <div className="space-y-3">
                      <button
                        onClick={() => {
                          saveFeedbackAndComplete('completed_all');
                        }}
                        className="w-full p-4 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-xl font-medium flex items-center gap-3 hover:bg-green-200 transition-colors"
                      >
                        <span className="text-2xl">😊</span>
                        <div className="text-right">
                          <div className="font-bold">סיימתי הכל!</div>
                          <div className="text-sm opacity-75">עשיתי את כל מה שרציתי</div>
                        </div>
                      </button>
                      
                      <button
                        onClick={() => {
                          saveFeedbackAndComplete('completed_partial');
                        }}
                        className="w-full p-4 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded-xl font-medium flex items-center gap-3 hover:bg-yellow-200 transition-colors"
                      >
                        <span className="text-2xl">😐</span>
                        <div className="text-right">
                          <div className="font-bold">סיימתי חלקית</div>
                          <div className="text-sm opacity-75">עשיתי את הרוב אבל לא הכל</div>
                        </div>
                      </button>
                      
                      <button
                        onClick={() => {
                          saveFeedbackAndComplete('did_not_finish');
                        }}
                        className="w-full p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-xl font-medium flex items-center gap-3 hover:bg-red-200 transition-colors"
                      >
                        <span className="text-2xl">😓</span>
                        <div className="text-right">
                          <div className="font-bold">לא הספקתי</div>
                          <div className="text-sm opacity-75">צריך יותר זמן בפעם הבאה</div>
                        </div>
                      </button>
                      
                      <button
                        onClick={() => setShowFeedbackOptions(false)}
                        className="w-full py-2 text-gray-500 text-sm"
                      >
                        ← חזרה
                      </button>
                    </div>
                  </>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
