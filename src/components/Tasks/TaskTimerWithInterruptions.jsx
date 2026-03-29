import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTasks } from '../../hooks/useTasks';
import { useAuth } from '../../hooks/useAuth';
import Button from '../UI/Button';
import toast from 'react-hot-toast';

/**
 * סוגי הפרעות
 */
const INTERRUPTION_TYPES = {
  client_call: { id: 'client_call', name: 'שיחת לקוח', icon: '📞', color: 'blue' },
  phone_call: { id: 'phone_call', name: 'טלפון', icon: '📱', color: 'green' },
  distraction: { id: 'distraction', name: 'הסחת דעת', icon: '🎯', color: 'orange' },
  break: { id: 'break', name: 'הפסקה', icon: '☕', color: 'yellow' },
  urgent: { id: 'urgent', name: 'משימה דחופה', icon: '🚨', color: 'red' },
  other: { id: 'other', name: 'אחר', icon: '❓', color: 'gray' }
};

/**
 * טיימר עם תמיכה בהפרעות
 * הזמן של ההפרעות נספר בנפרד ולא מתווסף לזמן המשימה
 * 
 * 🔧 תיקונים (גרסה 2.1):
 * - תיקון שמירת ID הטיימר (לא 'active')
 * - שמירת מצב מושהה ב-zmanit_active_timer
 * - סנכרון טוב יותר עם מנהל ההתראות
 */
function TaskTimerWithInterruptions({ task, onUpdate, onComplete, onTimeUpdate }) {
  const { updateTaskTime, tasks } = useTasks();
  const { user } = useAuth();

  // קבלת המשימה העדכנית
  const currentTask = useMemo(() => {
    if (!task || !task.id) {
      return null;
    }
    const found = tasks.find(t => t.id === task.id);
    return found || task;
  }, [tasks, task?.id]);

  // State
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [startTime, setStartTime] = useState(null);
  const [targetMinutes, setTargetMinutes] = useState(30);
  
  // State להפרעות
  const [isInterrupted, setIsInterrupted] = useState(false);
  const [interruptionType, setInterruptionType] = useState(null);
  const [interruptionStart, setInterruptionStart] = useState(null);
  const [interruptionSeconds, setInterruptionSeconds] = useState(0);
  const [totalInterruptionSeconds, setTotalInterruptionSeconds] = useState(0);
  const [interruptions, setInterruptions] = useState([]);
  const [showInterruptionMenu, setShowInterruptionMenu] = useState(false);

  // Refs
  const intervalRef = useRef(null);
  const interruptionIntervalRef = useRef(null);
  const savingRef = useRef(false);
  
  // ✅ Refs לשמירה על unmount ומעבר משימה
  const saveProgressRef = useRef(null);
  const elapsedSecondsRef = useRef(0);
  const isRunningRef = useRef(false);
  const previousTaskIdRef = useRef(currentTask?.id);

  // מפתח localStorage
  const timerStorageKey = currentTask ? `timer_v2_${currentTask.id}` : null;

  // חישובים
  const timeSpent = currentTask?.time_spent ? parseInt(currentTask.time_spent) : 0;
  const estimated = currentTask?.estimated_duration ? parseInt(currentTask.estimated_duration) : 0;
  const currentSessionMinutes = Math.floor(elapsedSeconds / 60);
  const totalSpent = timeSpent + currentSessionMinutes;
  const remaining = Math.max(0, estimated - totalSpent);
  const isOverTime = totalSpent > estimated && estimated > 0;
  const progress = estimated > 0
    ? Math.min(100, Math.round((totalSpent / estimated) * 100))
    : 0;

  // עדכון targetMinutes
  useEffect(() => {
    if (currentTask?.estimated_duration) {
      setTargetMinutes(currentTask.estimated_duration);
    }
  }, [currentTask?.estimated_duration]);

  // טעינת state מ-localStorage
  useEffect(() => {
    if (currentTask?.id && timerStorageKey) {
      const saved = localStorage.getItem(timerStorageKey);
      if (saved) {
        try {
          const data = JSON.parse(saved);
          
          // 🔧 תיקון: בדיקה אם הטיימר מושהה
          if (data.isPaused) {
            // טיימר מושהה - שחזור מצב השהייה
            setIsRunning(false);
            setIsPaused(true);
            setElapsedSeconds(0); // הזמן כבר נשמר ב-DB
            setTotalInterruptionSeconds(data.totalInterruptionSeconds || 0);
            setInterruptions(data.interruptions || []);
            console.log('⏸️ טיימר מושהה שוחזר');
            return;
          }
          
          if (data.startTime && data.isRunning && !data.isInterrupted) {
            const start = new Date(data.startTime);
            const elapsed = Math.floor((new Date() - start) / 1000);
            if (elapsed > 0 && elapsed < 24 * 60 * 60) { // פחות מ-24 שעות
              setStartTime(start);
              setElapsedSeconds(elapsed);
              setIsRunning(true);
              setIsPaused(false);
              setTotalInterruptionSeconds(data.totalInterruptionSeconds || 0);
              setInterruptions(data.interruptions || []);
              // 🔧 תיקון: שמירת מצב טיימר פעיל עם ID אמיתי (לא 'active')
              localStorage.setItem('zmanit_active_timer', currentTask.id);
              console.log('🔄 טיימר שוחזר! נשמר:', currentTask.id);
              toast.success(`⏰ טיימר חודש! עברו ${Math.floor(elapsed / 60)} דקות`);
            }
          }
        } catch (err) {
          console.error('שגיאה בטעינת טיימר:', err);
        }
      }
    }
  }, [currentTask?.id, timerStorageKey]);

  // 🔧 תיקון: שמירה ב-localStorage - כולל ID נכון
  const saveToStorage = useCallback(() => {
    if (timerStorageKey && currentTask?.id) {
      const data = {
        taskId: currentTask.id, // 🔧 שומרים את ה-ID
        startTime: startTime?.toISOString(),
        isRunning,
        isPaused,
        isInterrupted,
        interruptionType,
        interruptionStart: interruptionStart?.toISOString(),
        totalInterruptionSeconds,
        interruptions,
        budgetMinutes:
          (targetMinutes && targetMinutes > 0)
            ? targetMinutes
            : (estimated > 0 ? estimated : 30)
      };
      localStorage.setItem(timerStorageKey, JSON.stringify(data));
    }
  }, [timerStorageKey, currentTask?.id, startTime, isRunning, isPaused, isInterrupted, interruptionType, interruptionStart, totalInterruptionSeconds, interruptions, targetMinutes, estimated]);

  useEffect(() => {
    saveToStorage();
  }, [saveToStorage]);

  // 🔧 תיקון: שמירת מצב טיימר פעיל ב-localStorage - עם ID נכון!
  useEffect(() => {
    const taskId = currentTask?.id;
    
    if (!taskId) {
      console.log('🔍 אין taskId - לא עושים כלום');
      return;
    }
    
    console.log('🔍 useEffect טיימר:', { isRunning, isPaused, taskId });
    
    if (isRunning) {
      // 🔧 תיקון: שומרים את ה-ID האמיתי, לא 'active'
      localStorage.setItem('zmanit_active_timer', taskId);
      console.log('🟢 טיימר רץ - נשמר:', taskId);
    } else if (isPaused) {
      // 🔧 תיקון חשוב: כשמושהה, לא מוחקים! משאירים את ה-ID
      // מנהל ההתראות יבדוק אם הטיימר רץ או מושהה לפי timer_v2_
      console.log('⏸️ טיימר מושהה - נשאר:', taskId);
      // לא מוחקים את zmanit_active_timer!
    } else {
      // רק אם לא רץ ולא מושהה - בודקים אם זה הטיימר הפעיל ומוחקים
      const currentActiveTimer = localStorage.getItem('zmanit_active_timer');
      if (currentActiveTimer === taskId) {
        // בדיקה אם יש טיימר רץ על משימה אחרת
        let otherRunning = false;
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('timer_v2_') && key !== `timer_v2_${taskId}`) {
            try {
              const data = JSON.parse(localStorage.getItem(key));
              if (data.isRunning && data.startTime) {
                otherRunning = true;
                const otherId = key.replace('timer_v2_', '');
                localStorage.setItem('zmanit_active_timer', otherId);
                console.log('⏳ יש טיימר אחר שרץ:', otherId);
                break;
              }
            } catch (e) {}
          }
        }
        
        if (!otherRunning) {
          localStorage.removeItem('zmanit_active_timer');
          console.log('🔴 אין טיימר פעיל - נמחק');
        }
      }
    }
  }, [isRunning, isPaused, currentTask?.id]);

  // טיימר ראשי
  useEffect(() => {
    if (isRunning && !isInterrupted) {
      intervalRef.current = setInterval(() => {
        if (startTime) {
          const now = new Date();
          const elapsed = Math.floor((now - startTime) / 1000) - totalInterruptionSeconds;
          setElapsedSeconds(Math.max(0, elapsed));
          
          // עדכון הקומפוננט האב כל דקה
          const newTotalMinutes = timeSpent + Math.floor(Math.max(0, elapsed) / 60);
          if (onTimeUpdate) {
            onTimeUpdate(newTotalMinutes, true);
          }
        }
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      // עדכון שהטיימר עצר
      if (onTimeUpdate && !isRunning) {
        onTimeUpdate(totalSpent, false);
      }
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, isInterrupted, startTime, totalInterruptionSeconds, timeSpent, totalSpent, onTimeUpdate]);

  // טיימר הפרעה
  useEffect(() => {
    if (isInterrupted && interruptionStart) {
      interruptionIntervalRef.current = setInterval(() => {
        const now = new Date();
        const elapsed = Math.floor((now - interruptionStart) / 1000);
        setInterruptionSeconds(elapsed);
      }, 1000);
    } else {
      if (interruptionIntervalRef.current) {
        clearInterval(interruptionIntervalRef.current);
        interruptionIntervalRef.current = null;
      }
    }
    return () => {
      if (interruptionIntervalRef.current) clearInterval(interruptionIntervalRef.current);
    };
  }, [isInterrupted, interruptionStart]);

  // 🔧 תיקון: התחלת עבודה - שמירת ID נכון
  const startTimer = (e) => {
    if (e) e.stopPropagation();
    
    if (!currentTask?.id) {
      toast.error('שגיאה: לא נמצאה משימה');
      return;
    }
    
    const now = new Date();
    setStartTime(now);
    setIsRunning(true);
    setIsPaused(false);
    setElapsedSeconds(0);
    
    // 🔧 תיקון: שמירת ID אמיתי (לא 'active')
    localStorage.setItem('zmanit_active_timer', currentTask.id);
    console.log('🟢 טיימר התחיל! נשמר:', currentTask.id);
    
    // מחיקת מצב השהייה אם היה
    localStorage.removeItem('zmanit_focus_paused');
    
    toast.success('▶ התחלנו לעבוד!');
  };

  // 🔧 תיקון: השהיה - לא מוחקים את zmanit_active_timer!
  const pauseTimer = async (e) => {
    if (e) e.stopPropagation();
    setIsRunning(false);
    setIsPaused(true);
    
    // 🔧 תיקון חשוב: לא מוחקים את zmanit_active_timer!
    // מנהל ההתראות יבדוק את timer_v2_ וירא שהטיימר מושהה
    // localStorage.removeItem('zmanit_active_timer'); // ← הוסר!
    
    // 🔧 שמירת מצב השהייה ל-localStorage
    if (timerStorageKey && currentTask?.id) {
      const data = {
        taskId: currentTask.id,
        startTime: null,
        isRunning: false,
        isPaused: true,
        pausedAt: new Date().toISOString(),
        isInterrupted: false,
        totalInterruptionSeconds,
        interruptions
      };
      localStorage.setItem(timerStorageKey, JSON.stringify(data));
    }
    
    // 🔧 שמירה ל-IdleDetector - לפופאפ "משימה מושהית יותר מידי זמן"
    localStorage.setItem('zmanit_focus_paused', JSON.stringify({
      isPaused: true,
      pausedAt: new Date().toISOString(),
      taskId: currentTask?.id,
      taskTitle: currentTask?.title
    }));
    
    // ✅ שמירת הזמן שעבד עד עכשיו
    if (elapsedSeconds >= 60) {
      const result = await saveProgress(false);
      if (result && result.success) {
        toast.success(`⏸️ הושהה! ${result.minutesToAdd} דקות נשמרו`, {
          duration: 3000,
          icon: '💾'
        });
      } else {
        toast('⏸ טיימר מושהה');
      }
    } else {
      toast('⏸ טיימר מושהה (פחות מדקה - לא נשמר עדיין)');
    }
  };

  // 🔧 תיקון: המשך - שמירת ID נכון
  const resumeTimer = (e) => {
    if (e) e.stopPropagation();
    
    if (!currentTask?.id) {
      toast.error('שגיאה: לא נמצאה משימה');
      return;
    }
    
    const now = new Date();
    setStartTime(now);
    setIsRunning(true);
    setIsPaused(false);
    setElapsedSeconds(0); // מתחילים מחדש (הזמן הקודם כבר נשמר)
    
    // 🔧 תיקון: שמירת ID אמיתי
    localStorage.setItem('zmanit_active_timer', currentTask.id);
    
    // 🔧 שמירת מצב רץ ל-localStorage
    if (timerStorageKey) {
      const data = {
        taskId: currentTask.id,
        startTime: now.toISOString(),
        isRunning: true,
        isPaused: false,
        isInterrupted: false,
        totalInterruptionSeconds,
        interruptions
      };
      localStorage.setItem(timerStorageKey, JSON.stringify(data));
    }
    
    // מחיקת מצב השהייה
    localStorage.removeItem('zmanit_focus_paused');
    
    toast.success('▶ ממשיכים!');
  };

  // התחלת הפרעה
  const startInterruption = (type, e) => {
    if (e) e.stopPropagation();
    setIsInterrupted(true);
    setInterruptionType(type);
    setInterruptionStart(new Date());
    setInterruptionSeconds(0);
    setShowInterruptionMenu(false);
    toast(`⏸ ${INTERRUPTION_TYPES[type].icon} ${INTERRUPTION_TYPES[type].name}`);
  };

  // סיום הפרעה - שמירה ב-DB
  const endInterruption = async (e) => {
    if (e) e.stopPropagation();
    if (!isInterrupted || !interruptionStart) return;

    const durationSeconds = interruptionSeconds;
    const duration = Math.ceil(durationSeconds / 60); // בדקות
    
    // שמירת ההפרעה מקומית
    const newInterruption = {
      type: interruptionType,
      duration,
      durationSeconds,
      startTime: interruptionStart.toISOString(),
      endTime: new Date().toISOString()
    };
    setInterruptions(prev => [...prev, newInterruption]);
    
    // שמירה ב-DB
    if (user?.id) {
      try {
        const { saveInterruption } = await import('../../services/supabase');
        await saveInterruption({
          user_id: user.id,
          task_id: currentTask?.id || null,
          type: interruptionType,
          duration_seconds: durationSeconds,
          started_at: interruptionStart.toISOString(),
          ended_at: new Date().toISOString(),
          task_title: currentTask?.title || null
        });
      } catch (err) {
        console.error('❌ שגיאה בשמירת הפרעה:', err);
        // ממשיכים גם אם השמירה נכשלה
      }
    }
    
    // עדכון סה"כ זמן הפרעות
    setTotalInterruptionSeconds(prev => prev + durationSeconds);
    
    // איפוס
    setIsInterrupted(false);
    setInterruptionType(null);
    setInterruptionStart(null);
    setInterruptionSeconds(0);

    toast.success(`✅ חזרנו לעבודה! (${duration} דק' הפרעה)`);
  };

  // שמירת התקדמות
  const saveProgress = async (reset = false) => {
    
    if (savingRef.current) {
      return;
    }
    savingRef.current = true;

    // ✅ בדיקה שיש משימה
    if (!currentTask || !currentTask.id) {
      console.error('❌ אין משימה לשמור!');
      savingRef.current = false;
      toast.error('שגיאה: לא נמצאה משימה');
      return { success: false, reason: 'no_task' };
    }

    const minutesToAdd = Math.floor(elapsedSeconds / 60);
    
    if (minutesToAdd < 1) {
      savingRef.current = false;
      if (reset) {
        // אם ביקשו reset, לפחות לאפס את הטיימר
        resetTimer();
        toast.success('הטיימר אופס');
      }
      return { success: false, reason: 'less_than_minute' };
    }

    try {
      const newTimeSpent = timeSpent + minutesToAdd;
      await updateTaskTime(currentTask.id, newTimeSpent);

      // תיעוד פרודוקטיביות
      try {
        const { logProductivity } = await import('../Productivity/ProductivityTracker');
        logProductivity(user?.id, {
          minutesWorked: minutesToAdd,
          minutesEstimated: estimated > 0 ? Math.round(minutesToAdd * (estimated / (timeSpent + minutesToAdd))) : minutesToAdd,
          interruption: interruptions.length > 0
        });
      } catch (e) {
      }

      // שמירת היסטוריית הפרעות
      if (user?.id && interruptions.length > 0) {
        const storedInterruptions = JSON.parse(
          localStorage.getItem(`interruptions_${user.id}`) || '[]'
        );
        const today = new Date().toISOString().split('T')[0];
        const newInterruptions = interruptions.map(i => ({
          ...i,
          id: Date.now().toString() + Math.random(),
          date: today,
          taskId: currentTask.id,
          taskTitle: currentTask.title
        }));
        localStorage.setItem(
          `interruptions_${user.id}`,
          JSON.stringify([...newInterruptions, ...storedInterruptions])
        );
      }

      if (reset) {
        resetTimer();
      }

      savingRef.current = false;
      return { success: true, minutesToAdd, newTimeSpent };
    } catch (err) {
      console.error('שגיאה בשמירה:', err);
      savingRef.current = false;
      return { success: false, error: err };
    }
  };

  // ✅ שמירת הפונקציה ב-ref
  saveProgressRef.current = saveProgress;
  
  // ✅ עדכון refs לשמירה
  useEffect(() => {
    elapsedSecondsRef.current = elapsedSeconds;
    isRunningRef.current = isRunning;
  }, [elapsedSeconds, isRunning]);
  
  // ✅ שמירה כשעוברים משימה (לא כשהקומפוננטה נהרסת!)
  useEffect(() => {
    const prevId = previousTaskIdRef.current;
    const newId = currentTask?.id;
    
    // 🔧 תיקון: רק אם באמת עוברים למשימה אחרת (לא undefined)
    // אם newId הוא undefined, הקומפוננטה נהרסת - לא צריך לאפס
    if (prevId && newId && prevId !== newId && isRunningRef.current && elapsedSecondsRef.current >= 60) {
      if (saveProgressRef.current) {
        saveProgressRef.current(true).catch(err => {
          console.warn('⚠️ שמירה בעת מעבר משימה נכשלה:', err);
        });
      }
      
      // איפוס - רק אם באמת עוברים למשימה אחרת
      setIsRunning(false);
      setElapsedSeconds(0);
      setStartTime(null);
    }
    
    // עדכון ה-ref רק אם יש ערך חדש
    if (newId) {
      previousTaskIdRef.current = newId;
    }
  }, [currentTask?.id]);
  
  // ✅ שמירה כשהקומפוננטה מתפרקת - בלי לאפס!
  useEffect(() => {
    return () => {
      // 🔧 תיקון: שומרים את ההתקדמות אבל לא מאפסים את הטיימר
      // כך שכשחוזרים למשימה, הטיימר ימשיך מאיפה שהפסיק
      if (isRunningRef.current && elapsedSecondsRef.current >= 60 && saveProgressRef.current) {
        saveProgressRef.current(false).catch(err => {  // false = לא לאפס!
          console.warn('⚠️ שמירה לפני unmount נכשלה:', err);
        });
      }
    };
  }, []);

  // 🔧 תיקון: איפוס - ניקוי כל המצבים
  const resetTimer = (e) => {
    if (e) e.stopPropagation();
    setIsRunning(false);
    setIsPaused(false);
    setElapsedSeconds(0);
    setStartTime(null);
    setIsInterrupted(false);
    setInterruptionType(null);
    setInterruptionStart(null);
    setInterruptionSeconds(0);
    setTotalInterruptionSeconds(0);
    setInterruptions([]);
    
    if (timerStorageKey) {
      localStorage.removeItem(timerStorageKey);
    }
    
    // 🔧 תיקון: ניקוי מצב השהייה
    localStorage.removeItem('zmanit_focus_paused');
    
    // 🔧 תיקון: ניקוי טיימר פעיל אם זה הטיימר הנוכחי
    const currentActiveTimer = localStorage.getItem('zmanit_active_timer');
    if (currentActiveTimer === currentTask?.id) {
      localStorage.removeItem('zmanit_active_timer');
    }
  };

  // 🔧 תיקון: עצירה ושמירה - שמירה קודם, ניקוי אחר כך!
  const stopAndSaveRef = useRef(null);
  
  const stopAndSave = async (e) => {
    if (e) e.stopPropagation();
    
    // 🔧 תיקון חשוב: שומרים קודם!
    console.log('🔴 טיימר נעצר! שומרים לפני ניקוי...');
    const result = await saveProgress(true);
    
    // 🔧 תיקון: ניקוי רק אחרי שמירה מוצלחת!
    const currentActiveTimer = localStorage.getItem('zmanit_active_timer');
    if (currentActiveTimer === currentTask?.id) {
      localStorage.removeItem('zmanit_active_timer');
    }
    localStorage.removeItem('zmanit_focus_paused');
    console.log('🔴 ניקוי localStorage אחרי שמירה');
    
    if (result?.success) {
      toast.success(`💾 נשמר! ${result.minutesToAdd} דקות נוספו`);
    }
  };
  
  stopAndSaveRef.current = stopAndSave;

  // פורמט זמן
  const formatSeconds = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatMinutes = (minutes) => {
    if (!minutes) return '0 דק\'';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins} דק'`;
    if (mins === 0) return `${hours}:00`;
    return `${hours}:${mins.toString().padStart(2, '0')}`;
  };

  if (!currentTask) {
    return (
      <div className="p-4 text-center text-gray-500">
        בחרי משימה להתחיל
      </div>
    );
  }


  // עוצר כל לחיצה מלהגיע ל-div ההורה (שסוגר/פותח את הכרטיס)
  const handleContainerClick = (e) => {
    e.stopPropagation();
  };

  return (
    <div 
      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
      onClick={handleContainerClick}
    >
      {/* כותרת */}
      <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
        <h4 className="font-medium text-gray-900 dark:text-white truncate">
          {currentTask.title}
        </h4>
        <div className="flex gap-2 text-xs text-gray-500 mt-1">
          <span>יעד: {formatMinutes(targetMinutes)}</span>
          <span>•</span>
          <span>עבדת: {formatMinutes(totalSpent)}</span>
          {totalInterruptionSeconds > 0 && (
            <>
              <span>•</span>
              <span className="text-orange-500">
                הפרעות: {formatMinutes(Math.floor(totalInterruptionSeconds / 60))}
              </span>
            </>
          )}
        </div>
      </div>

      {/* טיימר */}
      <div className="p-6">
        {/* תצוגת הפרעה */}
        <AnimatePresence>
          {isInterrupted && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-4 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-xl"
            >
              <div className="text-center mb-3">
                <span className="text-3xl">
                  {INTERRUPTION_TYPES[interruptionType]?.icon || '⏸'}
                </span>
                <div className="text-sm font-medium text-orange-700 dark:text-orange-300 mt-1">
                  {INTERRUPTION_TYPES[interruptionType]?.name || 'הפרעה'}
                </div>
              </div>
              <div className="text-4xl font-mono font-bold text-center text-orange-600 dark:text-orange-400 mb-3">
                {formatSeconds(interruptionSeconds)}
              </div>
              <Button
                onClick={endInterruption}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white"
              >
                ▶ חזור לעבודה
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* תצוגת טיימר רגיל */}
        {!isInterrupted && (
          <>
            {/* פס התקדמות */}
            <div className="mb-4">
              <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full ${isOverTime ? 'bg-gradient-to-r from-red-400 to-red-600' : 'bg-gradient-to-r from-blue-400 to-blue-600'}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, progress)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>{progress}%</span>
                <span className={isOverTime ? 'text-red-600 font-medium' : ''}>
                  {isOverTime 
                    ? `חריגה: +${formatMinutes(totalSpent - estimated)}`
                    : `נותרו ${formatMinutes(remaining)}`
                  }
                </span>
              </div>
            </div>

            {/* זמן */}
            <div className="text-center mb-4">
              <div className={`text-5xl font-mono font-bold ${
                isRunning 
                  ? 'text-blue-600 dark:text-blue-400' 
                  : 'text-gray-600 dark:text-gray-400'
              }`}>
                {formatSeconds(elapsedSeconds)}
              </div>
            </div>

            {/* כפתורים ראשיים */}
            <div className="space-y-2">
              {!isRunning && !isPaused && (
                <Button
                  onClick={startTimer}
                  className="w-full bg-green-500 hover:bg-green-600 text-white text-lg py-3"
                >
                  ▶ התחל עבודה
                </Button>
              )}

              {isRunning && (
                <div className="flex gap-2">
                  <Button
                    onClick={pauseTimer}
                    className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white"
                  >
                    ⏸ השהה
                  </Button>
                  <Button
                    onClick={(e) => {
                      stopAndSave(e);
                    }}
                    className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                  >
                    ⏹ עצור
                  </Button>
                </div>
              )}

              {isPaused && (
                <>
                  <Button
                    onClick={resumeTimer}
                    className="w-full bg-blue-500 hover:bg-blue-600 text-white text-lg py-3"
                  >
                    ▶ המשך עבודה
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      onClick={stopAndSave}
                      className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                    >
                      💾 שמור
                    </Button>
                    <Button
                      onClick={resetTimer}
                      variant="secondary"
                      className="flex-1"
                    >
                      🔄 איפוס
                    </Button>
                  </div>
                </>
              )}

              {/* כפתור הפרעה */}
              {(isRunning || isPaused) && elapsedSeconds > 0 && (
                <div className="relative">
                  <Button
                    onClick={() => setShowInterruptionMenu(!showInterruptionMenu)}
                    variant="secondary"
                    className="w-full mt-2 border-orange-200 text-orange-600 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400"
                  >
                    📞 לקוח מתקשר / הפרעה
                  </Button>

                  {/* תפריט הפרעות */}
                  <AnimatePresence>
                    {showInterruptionMenu && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute bottom-full left-0 right-0 mb-2 p-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10"
                      >
                        <div className="text-xs text-gray-500 mb-2 text-center">
                          בחר סוג הפרעה:
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {Object.values(INTERRUPTION_TYPES).map(type => (
                            <button
                              key={type.id}
                              onClick={() => startInterruption(type.id)}
                              className="p-2 text-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            >
                              <span className="text-xl block">{type.icon}</span>
                              <span className="text-xs text-gray-600 dark:text-gray-400">
                                {type.name}
                              </span>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </>
        )}

        {/* היסטוריית הפרעות */}
        {interruptions.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500 mb-2">הפרעות בסשן זה:</div>
            <div className="flex flex-wrap gap-1">
              {interruptions.map((int, i) => (
                <span 
                  key={i}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 dark:bg-orange-900/20 rounded text-xs text-orange-700 dark:text-orange-300"
                >
                  {INTERRUPTION_TYPES[int.type]?.icon} {int.duration} דק'
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* טיפ */}
      {isRunning && (
        <div className="px-4 pb-4 text-xs text-center text-gray-500">
          💡 לחיצה על "לקוח מתקשר" תעצור את הטיימר בלי לספור את הזמן
        </div>
      )}
    </div>
  );
}

export default TaskTimerWithInterruptions;
