import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { updateSubtaskProgress } from '../../services/supabase';
import { useTasks } from '../../hooks/useTasks';
import { saveCompletedTask } from '../../utils/learningEngine';
import { InterruptionButton } from '../Learning/InterruptionLogger';
import TimerEndDialog from '../ADHD/TimerEndDialog';
import toast from 'react-hot-toast';
import Button from '../UI/Button';

/**
 * טיימר למשימה - פרומדורו
 */
function TaskTimer({ task, onUpdate, onComplete }) {
  const { updateTaskTime, tasks } = useTasks();

  // קבלת המשימה העדכנית מה-TaskContext במקום מה-prop - עם useMemo לעדכון אוטומטי
  // חשוב: כל ה-hooks חייבים להיקרא לפני ה-early return!
  const currentTask = useMemo(() => {
    if (!task || !task.id) return null;
    const found = tasks.find(t => t.id === task.id);
    if (found) {
      return found;
    }
    return task;
  }, [tasks, task?.id, task?.time_spent]);

  const [isRunning, setIsRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [startTime, setStartTime] = useState(null);
  const [originalStartTime, setOriginalStartTime] = useState(null); // זמן התחלה מקורי שלא מתאפס
  const [targetMinutes, setTargetMinutes] = useState(30); // זמן יעד - נעדכן ב-useEffect
  const [hasReachedTarget, setHasReachedTarget] = useState(false);
  const [showEndDialog, setShowEndDialog] = useState(false); // ✅ חדש: פופאפ סיום זמן
  const intervalRef = useRef(null);
  const audioRef = useRef(null);
  // מניעת שמירות כפולות במקביל - עם timeout אוטומטי
  const savingRef = useRef(null); // Promise של השמירה הנוכחית
  const savingTimeoutRef = useRef(null);

  // מפתח ב-localStorage לשמירת זמן התחלה
  const timerStorageKey = currentTask ? `timer_${currentTask.id}_startTime` : null;

  // חישובים - יכולים להיות גם כשאין משימה (יחזירו 0)
  const timeSpent = currentTask?.time_spent ? parseInt(currentTask.time_spent) : 0;
  const estimated = currentTask?.estimated_duration ? parseInt(currentTask.estimated_duration) : 0;
  const currentSessionMinutes = Math.floor(elapsedSeconds / 60);
  const totalSpent = timeSpent + currentSessionMinutes;
  const remainingMinutes = targetMinutes - currentSessionMinutes;
  const isTargetReached = currentSessionMinutes >= targetMinutes;
  const progress = targetMinutes > 0
    ? Math.min(100, Math.round((currentSessionMinutes / targetMinutes) * 100))
    : 0;

  // פונקציית saveProgress מוגדרת כאן כדי שתהיה זמינה ל-useEffect
  const saveProgressRef = useRef(null);

  // ✅ פונקציות עזר לסנכרון עם מנהל ההתראות
  // מנהל ההתראות מחפש את הנתונים בפורמט הזה
  const syncTimerToNotificationManager = useCallback((taskId, running, startTimeValue, accumulatedMs = 0) => {
    if (!taskId) return;
    
    try {
      // שמירת מזהה המשימה הפעילה
      if (running) {
        localStorage.setItem('zmanit_active_timer', taskId);
      } else {
        localStorage.removeItem('zmanit_active_timer');
      }
      
      // שמירת נתוני הטיימר בפורמט שמנהל ההתראות מצפה לו
      const timerData = {
        isRunning: running,
        startTime: startTimeValue ? startTimeValue.toISOString() : null,
        accumulatedTime: accumulatedMs,
        elapsed: accumulatedMs
      };
      localStorage.setItem(`timer_v2_${taskId}`, JSON.stringify(timerData));
      
      console.log('🔄 [Timer] סנכרון עם מנהל ההתראות:', { taskId, running, accumulatedMs });
    } catch (e) {
      console.error('🔄 [Timer] שגיאה בסנכרון:', e);
    }
  }, []);
  
  const clearTimerFromNotificationManager = useCallback((taskId) => {
    if (!taskId) return;
    
    try {
      localStorage.removeItem('zmanit_active_timer');
      localStorage.removeItem(`timer_v2_${taskId}`);
      console.log('🔄 [Timer] ניקוי מנהל ההתראות:', taskId);
    } catch (e) {
      console.error('🔄 [Timer] שגיאה בניקוי:', e);
    }
  }, []);

  // צפצוף/התראה
  const playAlarm = () => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 1);

      setTimeout(() => {
        const oscillator2 = audioContext.createOscillator();
        const gainNode2 = audioContext.createGain();
        oscillator2.connect(gainNode2);
        gainNode2.connect(audioContext.destination);
        oscillator2.frequency.value = 800;
        oscillator2.type = 'sine';
        gainNode2.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1);
        oscillator2.start(audioContext.currentTime);
        oscillator2.stop(audioContext.currentTime + 1);
      }, 500);

      setTimeout(() => {
        const oscillator3 = audioContext.createOscillator();
        const gainNode3 = audioContext.createGain();
        oscillator3.connect(gainNode3);
        gainNode3.connect(audioContext.destination);
        oscillator3.frequency.value = 800;
        oscillator3.type = 'sine';
        gainNode3.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode3.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1);
        oscillator3.start(audioContext.currentTime);
        oscillator3.stop(audioContext.currentTime + 1);
      }, 1000);
    } catch (err) {
      console.error('שגיאה בהשמעת צפצוף:', err);
    }
  };

  // עדכון targetMinutes כשהמשימה משתנה
  useEffect(() => {
    if (currentTask?.estimated_duration) {
      setTargetMinutes(currentTask.estimated_duration);
    }
  }, [currentTask?.estimated_duration]);

  // טעינת זמן התחלה מ-localStorage כשהטיימר נטען
  useEffect(() => {
    if (currentTask?.id && timerStorageKey) {
      const savedStartTime = localStorage.getItem(timerStorageKey);
      const savedOriginalStartTime = localStorage.getItem(`${timerStorageKey}_original`);
      
      if (savedStartTime) {
        const start = new Date(savedStartTime);
        const now = new Date();
        const elapsed = Math.floor((now - start) / 1000);

        if (elapsed > 0) {
          setStartTime(start);
          setElapsedSeconds(elapsed);
          setIsRunning(true);
          
          // אם יש זמן התחלה מקורי, נשתמש בו
          if (savedOriginalStartTime) {
            const originalStart = new Date(savedOriginalStartTime);
            setOriginalStartTime(originalStart);
          } else {
            // אם אין, נשתמש ב-startTime כ-originalStartTime
            setOriginalStartTime(start);
          }
          
          // ✅ סנכרון עם מנהל ההתראות - טיימר חודש
          syncTimerToNotificationManager(currentTask.id, true, start, elapsed * 1000);

          toast.success(`⏰ טיימר חודש! עברו ${Math.floor(elapsed / 60)} דקות`, {
            duration: 3000
          });
          
          // שמירה אוטומטית של הזמן שצבר אחרי רענון
          setTimeout(() => {
            if (saveProgressRef.current) {
              const minutesToSave = Math.floor(elapsed / 60);
              if (minutesToSave > 0) {
                saveProgressRef.current(false, true).catch(err => {
                  console.warn('⚠️ שמירה אוטומטית אחרי רענון נכשלה:', err);
                });
              }
            }
          }, 2000); // נמתין 2 שניות כדי לוודא שהכל נטען
        } else {
          localStorage.removeItem(timerStorageKey);
          localStorage.removeItem(`${timerStorageKey}_original`);
          // ✅ ניקוי ממנהל ההתראות
          clearTimerFromNotificationManager(currentTask.id);
        }
      }
    }
  }, [currentTask?.id, timerStorageKey, syncTimerToNotificationManager, clearTimerFromNotificationManager]);

  // עדכון זמן כל שנייה
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setElapsedSeconds(prev => {
          if (startTime) {
            const now = new Date();
            const elapsed = Math.floor((now - startTime) / 1000);
            return elapsed;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, startTime]);

  // טיפול ב-visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isRunning && startTime) {
        const now = new Date();
        const elapsed = Math.floor((now - startTime) / 1000);

        if (elapsed > elapsedSeconds) {
          const diffMinutes = Math.floor((elapsed - elapsedSeconds) / 60);
          setElapsedSeconds(elapsed);

          if (diffMinutes > 0) {
            toast.info(`⏰ עודכנו ${diffMinutes} דקות נוספות`, {
              duration: 2000
            });
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isRunning, startTime, elapsedSeconds]);

  // שמירה אוטומטית כל 10 דקות (פחות תכופה כדי למנוע timeout)
  useEffect(() => {
    if (isRunning && elapsedSeconds > 0 && elapsedSeconds % 600 === 0 && saveProgressRef.current) {
      // שמירה אוטומטית רק אם אין שמירה בתהליך
      if (!savingRef.current) {
        saveProgressRef.current(false, true).catch(err => {
          console.warn('⚠️ שמירה אוטומטית נכשלה:', err);
          // לא מציגים toast לשגיאות שמירה אוטומטית כדי לא להפריע
        });
      }
    }
  }, [elapsedSeconds, isRunning]);

  // בדיקת הגעה ליעד זמן - עוצר את הטיימר ומציג פופאפ בחירה
  useEffect(() => {
    if (isRunning && targetMinutes > 0 && !hasReachedTarget && !showEndDialog) {
      const targetMinutesTotal = targetMinutes;
      
      // חישוב הזמן הכולל: time_spent + הזמן מהסשן הנוכחי
      // אם יש originalStartTime, נשתמש בו (זמן התחלה מקורי שלא מתאפס)
      // אחרת נשתמש ב-startTime (שמתאפס אחרי שמירה אוטומטית)
      let totalMinutes = timeSpent; // הזמן שכבר נשמר
      
      if (originalStartTime) {
        // חישוב הזמן הכולל מהתחלה המקורית
        const now = new Date();
        const totalSecondsFromStart = Math.floor((now - originalStartTime) / 1000);
        totalMinutes = Math.floor(totalSecondsFromStart / 60);
      } else if (startTime) {
        // אם אין originalStartTime, נשתמש ב-startTime + timeSpent
        const now = new Date();
        const sessionSeconds = Math.floor((now - startTime) / 1000);
        totalMinutes = timeSpent + Math.floor(sessionSeconds / 60);
      }
      
      if (totalMinutes >= targetMinutesTotal) {
        setHasReachedTarget(true);
        // ✅ עוצרים את הטיימר ומציגים פופאפ בחירה
        setIsRunning(false);
        playAlarm();
        setShowEndDialog(true);
        
        // שמירה אוטומטית כשמגיעים ליעד
        if (saveProgressRef.current) {
          saveProgressRef.current(false, true).catch(err => {
            console.warn('⚠️ שמירה אוטומטית נכשלה:', err);
          });
        }
      }
    }
  }, [elapsedSeconds, isRunning, targetMinutes, hasReachedTarget, showEndDialog, startTime, originalStartTime, timeSpent]);

  // Early return AFTER all hooks are called
  if (!task || !task.id || !currentTask) {
    return (
      <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
          אין משימה זמינה
        </p>
      </div>
    );
  }

  const startTimer = () => {
    // אם הגענו ליעד, רק מסירים את הדגל - לא מאפסים זמן
    if (hasReachedTarget) {
      setHasReachedTarget(false);
    }
    
    // אם הטיימר לא רץ, מתחילים אותו
    if (!isRunning) {
      const now = new Date();
      
      // ✅ בדיקת התחלה באיחור
      if (currentTask?.due_time && !startTime) {
        const today = now.toISOString().split('T')[0];
        const taskDate = currentTask.due_date || today;
        
        // בדיקה אם המשימה היא להיום
        if (taskDate === today) {
          const [hours, minutes] = currentTask.due_time.split(':').map(Number);
          const scheduledTime = new Date(now);
          scheduledTime.setHours(hours, minutes, 0, 0);
          
          const lateMinutes = Math.floor((now - scheduledTime) / (1000 * 60));
          
          if (lateMinutes > 0) {
            // 🔔 התראה על התחלה באיחור
            toast(`⏰ התחלת באיחור של ${lateMinutes} דקות`, {
              icon: '⚠️',
              duration: 5000,
              style: {
                background: '#FEF3C7',
                color: '#92400E',
                direction: 'rtl'
              }
            });
            
            // 📊 שמירה במערכת הלמידה
            try {
              const lateStartsKey = 'late_starts_history';
              const history = JSON.parse(localStorage.getItem(lateStartsKey) || '[]');
              history.push({
                taskId: currentTask.id,
                taskTitle: currentTask.title,
                taskType: currentTask.task_type || 'general',
                scheduledTime: currentTask.due_time,
                actualStartTime: now.toTimeString().slice(0, 5),
                lateMinutes: lateMinutes,
                date: today,
                dayOfWeek: now.getDay()
              });
              // שומרים רק 100 רשומות אחרונות
              if (history.length > 100) history.shift();
              localStorage.setItem(lateStartsKey, JSON.stringify(history));
              
            } catch (e) {
              console.error('שגיאה בשמירת איחור:', e);
            }
          }
        }
      }
      
      // אם יש startTime קיים, נשתמש בו (למקרה שהטיימר היה מושהה)
      if (!startTime) {
        setStartTime(now);
        // שמירת זמן התחלה ב-localStorage
        if (currentTask?.id) {
          localStorage.setItem(timerStorageKey, now.toISOString());
        }
      }
      // שמירת זמן התחלה מקורי (אם עדיין לא נשמר)
      if (!originalStartTime) {
        setOriginalStartTime(now);
        // שמירה ב-localStorage
        if (currentTask?.id) {
          localStorage.setItem(`${timerStorageKey}_original`, now.toISOString());
        }
      }
      setIsRunning(true);
      
      // ✅ סנכרון עם מנהל ההתראות
      const timerStartTime = startTime || now;
      syncTimerToNotificationManager(currentTask?.id, true, timerStartTime, elapsedSeconds * 1000);
      
      toast.success('טיימר הופעל');
    }
  };
  
  const pauseTimer = async () => {
    setIsRunning(false);
    
    // ✅ תיקון: סנכרון מצב מושהה עם מנהל ההתראות
    if (currentTask?.id) {
      try {
        const accumulatedMs = elapsedSeconds * 1000;
        const timerData = {
          isRunning: false,
          isPaused: true,
          pausedAt: new Date().toISOString(),
          startTime: startTime ? startTime.toISOString() : null,
          accumulatedTime: accumulatedMs,
          elapsed: accumulatedMs
        };
        localStorage.setItem(`timer_v2_${currentTask.id}`, JSON.stringify(timerData));
        // לא מוחקים את zmanit_active_timer - מנהל ההתראות יבדוק isPaused
      } catch (e) {
        console.error('שגיאה בסנכרון השהייה:', e);
      }
    }
    
    // ✅ שמירת הזמן שעבד עד עכשיו
    if (elapsedSeconds >= 60) {
      const result = await saveProgress(false, true);
      if (result && result.success) {
        toast.success(`⏸️ הושהה! ${result.minutesToAdd} דקות נשמרו`, {
          duration: 3000,
          icon: '💾'
        });
      } else {
        toast.success('טיימר הושהה');
      }
    } else {
      toast.success('טיימר הושהה (פחות מדקה - לא נשמר עדיין)');
    }
  };
  
  const stopTimer = async () => {
    setIsRunning(false);
    
    // חישוב זמן מדויק לפי startTime
    let finalElapsedSeconds = elapsedSeconds;
    if (startTime) {
      const now = new Date();
      finalElapsedSeconds = Math.floor((now - startTime) / 1000);
      setElapsedSeconds(finalElapsedSeconds);
    }
    
    if (finalElapsedSeconds > 0) {
      const result = await saveProgress(true, true); // שמירה עם איפוס, בלי onUpdate
      if (result && result.success) {
        toast.success(`🎯 נשמר! ${result.minutesToAdd} דקות נוספו. סה"כ: ${result.newTimeSpent} דקות`, {
          duration: 4000,
          icon: '💾'
        });
      }
    }
    
    // ניקוי מ-localStorage
    if (currentTask?.id) {
      localStorage.removeItem(timerStorageKey);
      // ✅ ניקוי ממנהל ההתראות
      clearTimerFromNotificationManager(currentTask.id);
    }
    
    setElapsedSeconds(0);
    setStartTime(null);
  };
  
  const resetTimer = () => {
    setIsRunning(false);
    setElapsedSeconds(0);
    setHasReachedTarget(false);
    setStartTime(null);
    setOriginalStartTime(null); // גם מאפסים את הזמן המקורי
    
    // ניקוי מ-localStorage
    if (currentTask?.id) {
      localStorage.removeItem(timerStorageKey);
      localStorage.removeItem(`${timerStorageKey}_original`);
      // ✅ ניקוי ממנהל ההתראות
      clearTimerFromNotificationManager(currentTask.id);
    }
  };

  const saveProgress = async (reset = false, skipUpdate = false) => {
    // מניעת שמירות כפולות - נשתמש ב-Promise במקום דגל בוליאני
    // שמירה פשוטה - בלי race conditions
    const savePromise = (async () => {
      // חישוב זמן מדויק לפי startTime אם קיים
      let actualElapsedSeconds = elapsedSeconds;
      if (startTime) {
        const now = new Date();
        actualElapsedSeconds = Math.floor((now - startTime) / 1000);
        // עדכון ה-state עם הזמן המדויק
        if (actualElapsedSeconds !== elapsedSeconds) {
          setElapsedSeconds(actualElapsedSeconds);
        }
      }
      
      const minutesToAdd = Math.floor(actualElapsedSeconds / 60);
      if (minutesToAdd > 0 && currentTask && currentTask.id) {
        // שימוש במשימה העדכנית מה-TaskContext - טעינה מחדש מה-context
        const latestTask = tasks.find(t => t.id === currentTask.id) || currentTask;
        const currentTimeSpent = (latestTask.time_spent) ? parseInt(latestTask.time_spent) : 0;
        const newTimeSpent = currentTimeSpent + minutesToAdd;
        
        // עדכון פשוט - רק state, לא DB
        await updateTaskTime(latestTask.id, newTimeSpent);
        
        // אם יש subtask_id, עדכן גם את ה-subtask table
        if (latestTask.subtask_id) {
          await updateSubtaskProgress(latestTask.subtask_id, newTimeSpent);
        }
        
        // אחרי שמירה, מאפסים את startTime לזמן הנוכחי כדי שלא נספור כפול
        // אבל רק אם זה לא reset מלא (אז אנחנו ממשיכים לעבוד)
        // חשוב: originalStartTime לא מתאפס - הוא נשאר כדי שנוכל לבדוק הגעה ליעד
        if (!reset && startTime) {
          const now = new Date();
          setStartTime(now);
          // עדכון localStorage
          if (currentTask?.id) {
            localStorage.setItem(timerStorageKey, now.toISOString());
            // ✅ תיקון: סנכרון timer_v2_ אחרי שמירה אוטומטית
            // מנהל ההתראות משתמש בנתונים האלה לחישוב זמן שנותר
            syncTimerToNotificationManager(currentTask.id, true, now, 0);
          }
          // מאפסים את elapsedSeconds כי הזמן כבר נשמר
          setElapsedSeconds(0);
        }
        
        if (reset) {
          setElapsedSeconds(0);
        }
        
        // אם יש onUpdate callback, נקרא לו
        if (onUpdate && !skipUpdate) {
          await onUpdate();
        }
        
        return { success: true, minutesToAdd, newTimeSpent };
      } else if (minutesToAdd === 0) {
        toast('עבדת פחות מדקה - לא נשמר', { icon: '⏱️' });
        return { success: false, reason: 'less_than_minute' };
      }
      return { success: false, reason: 'no_time_to_save' };
    })();
    
    // הרצה פשוטה - בלי timeouts
    return await savePromise;
  };

  // שמירת הפונקציה ב-ref כדי שה-useEffect יוכל לקרוא לה
  saveProgressRef.current = saveProgress;
  
  // ✅ שמירה אוטומטית כשעוברים למשימה אחרת או כשהקומפוננטה מתפרקת
  const previousTaskIdRef = useRef(currentTask?.id);
  const elapsedSecondsRef = useRef(elapsedSeconds);
  const isRunningRef = useRef(isRunning);
  
  // עדכון refs
  useEffect(() => {
    elapsedSecondsRef.current = elapsedSeconds;
    isRunningRef.current = isRunning;
  }, [elapsedSeconds, isRunning]);
  
  // שמירה כשעוברים משימה
  useEffect(() => {
    const prevId = previousTaskIdRef.current;
    const newId = currentTask?.id;
    
    // אם עברנו למשימה אחרת וטיימר היה רץ
    if (prevId && prevId !== newId && isRunningRef.current && elapsedSecondsRef.current >= 60) {
      if (saveProgressRef.current) {
        saveProgressRef.current(true, true).catch(err => {
          console.warn('⚠️ שמירה בעת מעבר משימה נכשלה:', err);
        });
      }
      
      // איפוס הטיימר
      setIsRunning(false);
      setElapsedSeconds(0);
      setStartTime(null);
    }
    
    previousTaskIdRef.current = newId;
  }, [currentTask?.id]);
  
  // ✅ שמירה כשהקומפוננטה מתפרקת
  useEffect(() => {
    return () => {
      // cleanup - שמור אם יש זמן
      if (isRunningRef.current && elapsedSecondsRef.current >= 60 && saveProgressRef.current) {
        saveProgressRef.current(true, true).catch(err => {
          console.warn('⚠️ שמירה לפני unmount נכשלה:', err);
        });
      }
    };
  }, []); // רק פעם אחת - cleanup בסוף
  
  // שמירה אוטומטית לפני שהדף נסגר
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      // אם יש זמן שצבר, נשמור אותו
      if (isRunning && elapsedSeconds > 0 && saveProgressRef.current) {
        // נשתמש ב-sendBeacon אם אפשר, אחרת ננסה לשמור רגיל
        const minutesToSave = Math.floor(elapsedSeconds / 60);
        if (minutesToSave > 0) {
          // ננסה לשמור - אבל לא נחכה כי הדף עומד להיסגר
          saveProgressRef.current(false, true).catch(err => {
            console.warn('⚠️ שמירה לפני סגירה נכשלה:', err);
          });
        }
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isRunning, elapsedSeconds]);

  const continueAfterTarget = () => {
    // לא מאפסים את הזמן - ממשיכים מהזמן הנוכחי!
    setHasReachedTarget(false);
    setIsRunning(true);
    
    // ✅ סנכרון עם מנהל ההתראות - טיימר ממשיך לרוץ
    syncTimerToNotificationManager(currentTask?.id, true, startTime, elapsedSeconds * 1000);
    
    toast.success('ממשיכים לעבוד מעבר ליעד!');
  };
  
  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };
  
  // ✅ פונקציות טיפול בפופאפ סיום זמן
  const handleDialogComplete = async () => {
    // סיום מלא של המשימה
    setShowEndDialog(false);
    try {
      const result = await saveProgress(true, true);
      if (result && result.success) {
        resetTimer();
        toast.success('✅ מעולה! המשימה הושלמה', { duration: 3000 });
        if (onComplete) {
          onComplete();
        }
      }
    } catch (err) {
      console.error('שגיאה בסיום משימה:', err);
      toast.error('שגיאה בשמירה');
    }
  };
  
  const handleDialogExtend = (extraMinutes) => {
    // הוספת זמן נוסף
    setShowEndDialog(false);
    setTargetMinutes(prev => prev + extraMinutes);
    setHasReachedTarget(false);
    setIsRunning(true);
    
    // ✅ סנכרון עם מנהל ההתראות - טיימר ממשיך לרוץ
    syncTimerToNotificationManager(currentTask?.id, true, startTime, elapsedSeconds * 1000);
    
    toast.success(`⏱️ נוספו ${extraMinutes} דקות. המשך לעבוד!`, { duration: 3000 });
  };
  
  const handleDialogPartial = async (progressPercent) => {
    // התקדמות חלקית - שומר ועוצר
    setShowEndDialog(false);
    try {
      const result = await saveProgress(true, true);
      if (result && result.success) {
        resetTimer();
        toast.success(`📊 נשמר! התקדמת ${progressPercent}%`, { duration: 3000 });
      }
    } catch (err) {
      console.error('שגיאה בשמירה:', err);
      toast.error('שגיאה בשמירה');
    }
  };
  
  const handleDialogStuck = async () => {
    // נתקע - שומר את הזמן ועוצר
    setShowEndDialog(false);
    try {
      const result = await saveProgress(true, true);
      if (result && result.success) {
        resetTimer();
        toast('😵 קורה! קח הפסקה או עבור למשימה אחרת', { 
          duration: 4000,
          icon: '💪'
        });
      }
    } catch (err) {
      console.error('שגיאה בשמירה:', err);
    }
  };
  
  const handleDialogDismiss = () => {
    // סגירה בלי פעולה - ממשיך לעבוד
    setShowEndDialog(false);
    setHasReachedTarget(false);
    setIsRunning(true);
    
    // ✅ סנכרון עם מנהל ההתראות - טיימר ממשיך לרוץ
    syncTimerToNotificationManager(currentTask?.id, true, startTime, elapsedSeconds * 1000);
    
    toast('ממשיכים לעבוד...', { duration: 2000 });
  };
  
  const displayTime = isTargetReached ? elapsedSeconds : (targetMinutes * 60 - elapsedSeconds);
  
  return (
    <div className={`p-4 rounded-lg border-2 ${
      hasReachedTarget
        ? 'bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-300 dark:border-green-700 animate-pulse'
        : 'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          ⏱️ טיימר עבודה
        </h3>
        {hasReachedTarget && (
          <span className="text-xs font-bold text-green-600 dark:text-green-400 animate-bounce">
            🎉 הושלם!
          </span>
        )}
      </div>
      
      {/* הגדרת זמן יעד */}
      {!isRunning && !hasReachedTarget && (
        <div className="mb-3">
          <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">
            זמן יעד (דקות):
          </label>
          <input
            type="number"
            value={targetMinutes}
            onChange={(e) => setTargetMinutes(parseInt(e.target.value) || 30)}
            min="1"
            max="240"
            className="text-sm px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 w-full"
            placeholder="30"
          />
        </div>
      )}
      
      {/* תצוגת זמן */}
      <div className="text-center mb-4">
        <div className={`text-5xl font-bold mb-1 ${
          hasReachedTarget
            ? 'text-green-600 dark:text-green-400'
            : remainingMinutes <= 5 && isRunning
            ? 'text-red-600 dark:text-red-400'
            : 'text-gray-900 dark:text-white'
        }`}>
          {formatTime(Math.abs(displayTime))}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
          {isRunning && (
            <div>
              {hasReachedTarget ? (
                <span className="text-green-600 dark:text-green-400 font-bold">
                  🎉 הגעת ליעד! ממשיכים לעבוד... (+{Math.floor((elapsedSeconds - targetMinutes * 60) / 60)} דקות מעבר ליעד)
                </span>
              ) : remainingMinutes > 0 ? (
                <span className="text-orange-600 dark:text-orange-400 font-medium">
                  נותרו {remainingMinutes} דקות
                </span>
              ) : (
                <span className="text-red-600 dark:text-red-400 font-bold">
                  עברת את היעד!
                </span>
              )}
            </div>
          )}
          <div>
            <span className="font-medium">סה"כ עבדת: {totalSpent} דקות</span>
            {estimated > 0 && (
              <span className="mr-2">• משוער: {estimated} דקות</span>
            )}
          </div>
          {currentSessionMinutes > 0 && (
            <div>
              <span>הסשן הנוכחי: {currentSessionMinutes} דקות</span>
            </div>
          )}
        </div>
      </div>
      
      {/* פס התקדמות */}
      {targetMinutes > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-600 dark:text-gray-400">התקדמות ליעד</span>
            <span className={`font-medium ${
              progress >= 100
                ? 'text-green-600 dark:text-green-400'
                : progress >= 75
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-600 dark:text-gray-400'
            }`}>
              {progress}%
            </span>
          </div>
          <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                progress >= 100 
                  ? 'bg-green-500' 
                  : progress >= 75 
                  ? 'bg-blue-500' 
                  : progress >= 50 
                  ? 'bg-yellow-500' 
                  : 'bg-orange-500'
              }`}
              style={{ width: `${Math.min(100, progress)}%` }}
            />
          </div>
        </div>
      )}
      
      {/* כפתורי שליטה */}
      <div className="space-y-2">
        {hasReachedTarget ? (
          <div className="space-y-2">
            <div className="text-center p-3 bg-green-100 dark:bg-green-900/30 rounded-lg border-2 border-green-300 dark:border-green-700">
              <p className="text-sm font-bold text-green-700 dark:text-green-300 mb-2">
                🎉 הגעת ליעד של {targetMinutes} דקות!
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                סה"כ עבדת: {totalSpent} דקות
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={continueAfterTarget}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
              >
                ▶ המשך לעבוד
              </Button>
              <Button
                onClick={async () => {
                  try {
                    const result = await saveProgress(true, true); // reset + skipUpdate
                    if (result && result.success) {
                      resetTimer();
                      toast.success('✅ התקדמות נשמרה וטיימר אופס');
                    } else {
                      toast.error('שגיאה בשמירה - נסי שוב', { duration: 3000 });
                    }
                  } catch (err) {
                    console.error('❌ שגיאה בשמירה:', err);
                    toast.error('שגיאה בשמירה - נסי שוב', { duration: 3000 });
                  }
                }}
                className="flex-1 bg-green-500 hover:bg-green-600 text-white"
              >
                💾 שמור וסיים
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {/* כפתורים עיקריים */}
            <div className="flex gap-2">
              {!isRunning ? (
                <Button
                  onClick={startTimer}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                >
                  ▶ התחל עבודה
                </Button>
              ) : (
                <>
                  <Button
                    onClick={pauseTimer}
                    className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white"
                    title="השהה את הטיימר בלי לשמור - תוכל לעבור למשימה אחרת"
                  >
                    ⏸ השהה
                  </Button>
                  <Button
                    onClick={stopTimer}
                    className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                    title="עצור ושמור את הזמן שעבדת"
                  >
                    ⏹ עצור ושמור
                  </Button>
                  {/* כפתור הפרעה */}
                  <InterruptionButton
                    taskId={currentTask?.id}
                    taskTitle={currentTask?.title}
                    small
                  />
                </>
              )}
            </div>
            
            {/* כפתורים משניים - כשמושהה */}
            {elapsedSeconds > 0 && !isRunning && (
              <div className="space-y-2">
                {/* כפתור המשך עבודה - בולט */}
                <Button
                  onClick={() => {
                    setIsRunning(true);
                    // ✅ תיקון: סנכרון עם מנהל ההתראות כשחוזרים מהשהייה
                    const timerStartTime = startTime || new Date();
                    syncTimerToNotificationManager(currentTask?.id, true, timerStartTime, elapsedSeconds * 1000);
                    toast.success('▶ ממשיכה לעבוד!');
                  }}
                  className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold shadow-lg text-lg py-3"
                >
                  ▶ המשך עבודה
                </Button>
                
                {/* קו הפרדה */}
                <div className="text-center text-xs text-gray-500 dark:text-gray-400">
                  או
                </div>
                
                {/* כפתור מהיר - שומר ומסמן כהושלם */}
                <Button
                  onClick={async () => {
                    
                    try {
                      // שמירה עם retry במקרה של timeout
                      let result = null;
                      let attempts = 0;
                      const maxAttempts = 3;
                      
                      while (attempts < maxAttempts && (!result || !result.success)) {
                        attempts++;
                        
                        try {
                          result = await saveProgress(true, true);
                          if (result && result.success) {
                            break;
                          }
                        } catch (err) {
                          console.warn(`⚠️ ניסיון ${attempts} נכשל:`, err);
                          if (attempts < maxAttempts) {
                            // נמתין קצת לפני ניסיון נוסף
                            await new Promise(resolve => setTimeout(resolve, 2000));
                          }
                        }
                      }
                      
                      if (result && result.success) {
                        resetTimer();
                        
                        // 📊 שמירה במערכת הלמידה
                        try {
                          saveCompletedTask({
                            ...currentTask,
                            time_spent: result.totalMinutes || currentTask.time_spent,
                            actual_start_time: originalStartTime?.toTimeString()?.slice(0, 5)
                          });
                        } catch (learnErr) {
                          console.warn('שגיאה בשמירה למערכת למידה:', learnErr);
                        }
                        
                        if (onComplete) {
                          // סימון המשימה כהושלמה - זה יעדכן הכל
                          try {
                            await onComplete();
                            toast.success('🎉 המשימה הושלמה! הזמן נשמר והמערכת למדה ממנה', {
                              duration: 4000
                            });
                          } catch (err) {
                            console.error('❌ שגיאה בסימון משימה כהושלמה:', err);
                            toast.success('✅ הזמן נשמר! (אבל הייתה שגיאה בסימון כהושלם)', {
                              duration: 3000
                            });
                          }
                        } else {
                          console.warn('⚠️ אין onComplete callback');
                          toast.success('✅ הזמן נשמר!', {
                            duration: 3000
                          });
                        }
                      } else {
                        console.error('❌ השמירה נכשלה אחרי כל הניסיונות:', result);
                        if (result && result.reason !== 'less_than_minute') {
                          toast.error('שגיאה בשמירת הזמן - נסי שוב או בדקי את החיבור לאינטרנט', {
                            duration: 5000
                          });
                        }
                      }
                    } catch (err) {
                      console.error('❌ שגיאה כללית בשמירה:', err);
                      toast.error('שגיאה בשמירת הזמן - נסי שוב', {
                        duration: 5000
                      });
                    }
                  }}
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold shadow-lg"
                >
                  ✅ שמור וסמן כהושלם
                </Button>
                
                {/* כפתורים נוספים */}
                <div className="flex gap-2">
                  <Button
                    onClick={async () => {
                      const result = await saveProgress(true, true); // reset + skipUpdate
                      if (result && result.success) {
                        resetTimer();
                        toast.success(`💾 נשמר! ${result.minutesToAdd} דקות נוספו. סה"כ: ${result.newTimeSpent} דקות`, {
                          duration: 3000
                        });
                      }
                    }}
                    className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
                  >
                    💾 רק שמור
                  </Button>
                  <Button
                    onClick={resetTimer}
                    className="bg-gray-500 hover:bg-gray-600 text-white"
                    title="מחק את הזמן הנוכחי בלי לשמור"
                  >
                    🔄 איפוס
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      
      {isRunning && (
        <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-2">
          💡 לחץ "השהה" לעבור למשימה אחרת • שמירה אוטומטית כל 5 דקות
        </p>
      )}
      {elapsedSeconds > 0 && !isRunning && (
        <p className="text-xs text-center text-blue-600 dark:text-blue-400 mt-2">
          💡 הטיימר מושהה - תוכל לחזור או לעבור למשימה אחרת
        </p>
      )}
      
      {/* ✅ פופאפ סיום זמן */}
      <TimerEndDialog
        isOpen={showEndDialog}
        task={currentTask}
        elapsedTime={currentSessionMinutes}
        onComplete={handleDialogComplete}
        onExtend={handleDialogExtend}
        onPartial={handleDialogPartial}
        onStuck={handleDialogStuck}
        onDismiss={handleDialogDismiss}
      />
    </div>
  );
}

export default TaskTimer;

