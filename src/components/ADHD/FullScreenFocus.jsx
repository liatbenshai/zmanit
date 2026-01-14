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
 * 
 * 🔧 תיקון: שימוש ב-Date.now() במקום setInterval לספירת זמן מדויקת
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
  const [accumulatedSeconds, setAccumulatedSeconds] = useState(0); // 🔧 זמן שנצבר לפני השהיות
  const [showInterruptionModal, setShowInterruptionModal] = useState(false); // 🆕 פופאפ בלת"ם
  const [interruptionTitle, setInterruptionTitle] = useState(''); // 🆕 כותרת בלת"ם
  const [showLogInterruptionModal, setShowLogInterruptionModal] = useState(false); // 🆕 תיעוד הפרעה
  const [interruptionType, setInterruptionType] = useState('distraction'); // 🆕 סוג הפרעה
  const [interruptionNote, setInterruptionNote] = useState(''); // 🆕 הערה להפרעה
  const intervalRef = useRef(null);
  const elapsedRef = useRef(0);
  const startTimeRef = useRef(null); // 🔧 שמירת זמן התחלה ב-ref

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
      const now = Date.now();
      setStartTime(now);
      startTimeRef.current = now;
      setElapsedSeconds(0);
      setAccumulatedSeconds(0);
      setIsRunning(true);
      setIsPaused(false);
      elapsedRef.current = 0;
      
      // שמירת מצב טיימר ל-localStorage (לשחזור אם הדף נסגר)
      localStorage.setItem('zmanit_active_timer', task.id);
      localStorage.setItem('zmanit_timer_start', now.toString());
      console.log('🎯 FullScreenFocus נפתח - טיימר:', task.id, 'התחלה:', new Date(now).toLocaleTimeString());
    }
  }, [isOpen, task?.id]);

  // 🔧 טיימר משופר - מבוסס Date.now() במקום ספירה
  const [showTimeUpDialog, setShowTimeUpDialog] = useState(false);
  const timeUpTriggeredRef = useRef(false);

  useEffect(() => {
    if (isRunning && !isPaused && startTimeRef.current) {
      // עדכון כל 100ms לדיוק מקסימלי
      intervalRef.current = setInterval(() => {
        const now = Date.now();
        const currentSessionSeconds = Math.floor((now - startTimeRef.current) / 1000);
        const totalSeconds = accumulatedSeconds + currentSessionSeconds;
        
        setElapsedSeconds(totalSeconds);
        elapsedRef.current = totalSeconds;
      }, 100); // 🔧 עדכון כל 100ms במקום 1000ms
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
  }, [isRunning, isPaused, accumulatedSeconds]);

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
    
    // 🔧 שמירת הזמן שנצבר עד עכשיו
    const currentSessionSeconds = startTimeRef.current ? Math.floor((Date.now() - startTimeRef.current) / 1000) : 0;
    const totalSeconds = accumulatedSeconds + currentSessionSeconds;
    setAccumulatedSeconds(totalSeconds);
    
    // שמירת מצב השהייה ל-localStorage
    localStorage.setItem('zmanit_focus_paused', JSON.stringify({
      isPaused: true,
      pausedAt: new Date().toISOString(),
      taskId: task.id,
      taskTitle: task.title,
      accumulatedSeconds: totalSeconds // 🔧 שמירת הזמן שנצבר
    }));
    
    // שמירת דקות ל-DB (רק אם יש דקות שלמות חדשות)
    const totalMinutes = Math.floor(totalSeconds / 60);
    const previouslySavedMinutes = Math.floor(accumulatedSeconds / 60);
    const newMinutes = totalMinutes - previouslySavedMinutes;
    
    if (onPause && newMinutes > 0) {
      await onPause(newMinutes);
      console.log('💾 FullScreenFocus handlePause - נשמרו:', newMinutes, 'דקות חדשות, סה"כ:', totalMinutes, 'דקות');
    }
    
    toast('⏸️ מושהה');
  };

  // המשך
  const handleResume = () => {
    // 🔧 התחלת סשן חדש עם שמירת הזמן שנצבר
    const now = Date.now();
    startTimeRef.current = now;
    localStorage.setItem('zmanit_timer_start', now.toString());
    
    setIsRunning(true);
    setIsPaused(false);
    localStorage.setItem('zmanit_active_timer', task.id);
    localStorage.removeItem('zmanit_focus_paused');
    toast.success('▶️ ממשיכים!');
  };

  // סיום
  const handleComplete = async () => {
    localStorage.removeItem('zmanit_active_timer');
    localStorage.removeItem('zmanit_focus_paused');
    localStorage.removeItem('zmanit_timer_start'); // 🔧 ניקוי זמן התחלה
    
    // 🔧 חישוב סה"כ זמן עבודה מדויק
    const currentSessionSeconds = startTimeRef.current ? Math.floor((Date.now() - startTimeRef.current) / 1000) : 0;
    const totalSeconds = accumulatedSeconds + currentSessionSeconds;
    const minutesWorked = Math.floor(totalSeconds / 60);
    
    // שמירת הזמן לפני סימון כהושלם
    if (onTimeUpdate && minutesWorked > 0) {
      await onTimeUpdate(minutesWorked);
      console.log('💾 FullScreenFocus handleComplete - נשמרו:', minutesWorked, 'דקות (', totalSeconds, 'שניות)');
    }
    
    if (onComplete) {
      await onComplete();
    }
    
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
                      // 🔧 חישוב זמן מדויק
                      const currentSessionSeconds = startTimeRef.current ? Math.floor((Date.now() - startTimeRef.current) / 1000) : 0;
                      const totalSeconds = accumulatedSeconds + currentSessionSeconds;
                      const minutesWorked = Math.floor(totalSeconds / 60);
                      
                      // 1. שמירת הזמן
                      if (onPause && minutesWorked > 0) {
                        await onPause(minutesWorked);
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
                      localStorage.removeItem('zmanit_timer_start');
                      toast.success(`💾 נשמרו ${minutesWorked} דקות. הפרעה תועדה.`);
                      setInterruptionNote('');
                      setShowLogInterruptionModal(false);
                      onClose?.(); // סגירת מסך המיקוד
                    }}
                    className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition-colors"
                  >
                    ⏹️ עצור ושמור ({Math.floor((accumulatedSeconds + (startTimeRef.current ? Math.floor((Date.now() - startTimeRef.current) / 1000) : 0)) / 60)} דקות)
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
                        // 🔧 חישוב זמן מדויק
                        const currentSessionSeconds = startTimeRef.current ? Math.floor((Date.now() - startTimeRef.current) / 1000) : 0;
                        const totalSeconds = accumulatedSeconds + currentSessionSeconds;
                        const minutesWorked = Math.floor(totalSeconds / 60);
                        
                        // 1. שמירת הזמן של המשימה הנוכחית
                        if (onPause && minutesWorked > 0) {
                          await onPause(minutesWorked);
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
                        localStorage.removeItem('zmanit_timer_start');
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
