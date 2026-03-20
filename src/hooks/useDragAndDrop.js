import { useState, useCallback, useRef } from 'react';
import { useTasks } from './useTasks';
import toast from 'react-hot-toast';

/**
 * Hook לטיפול בגרירה ושחרור של משימות
 * ✅ תיקון: הוספת תמיכה בגרירה לזמנים ותאריכים
 */
export function useDragAndDrop() {
  const { changeQuadrant, editTask } = useTasks();
  const [draggedTask, setDraggedTask] = useState(null);
  const [dragOverQuadrant, setDragOverQuadrant] = useState(null);
  const [dragOverTime, setDragOverTime] = useState(null); // ✅ חדש: שעה שמעליה גוררים
  const [dragOverDate, setDragOverDate] = useState(null); // ✅ חדש: תאריך שמעליו גוררים
  
  // מניעת עדכונים כפולים
  const isUpdatingRef = useRef(false);

  // התחלת גרירה
  const handleDragStart = useCallback((task, event) => {
    setDraggedTask(task);
    
    // הגדרת אפקט גרירה
    if (event?.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', task.id);
    }
  }, []);

  // סיום גרירה
  const handleDragEnd = useCallback(() => {
    setDraggedTask(null);
    setDragOverQuadrant(null);
    setDragOverTime(null);
    setDragOverDate(null);
  }, []);

  // גרירה מעל רבע
  const handleDragOver = useCallback((e, quadrant) => {
    e.preventDefault();
    setDragOverQuadrant(quadrant);
  }, []);

  // ✅ חדש: גרירה מעל שעה מסוימת
  const handleDragOverTime = useCallback((e, time, date = null) => {
    e.preventDefault();
    setDragOverTime(time);
    if (date) setDragOverDate(date);
  }, []);

  // עזיבת רבע
  const handleDragLeave = useCallback(() => {
    setDragOverQuadrant(null);
  }, []);

  // ✅ חדש: עזיבת אזור זמן
  const handleDragLeaveTime = useCallback(() => {
    setDragOverTime(null);
    setDragOverDate(null);
  }, []);

  // שחרור ברבע
  const handleDrop = useCallback(async (e, targetQuadrant) => {
    e.preventDefault();
    
    if (!draggedTask || isUpdatingRef.current) return;
    
    // אם אותו רבע - לא לעשות כלום
    if (draggedTask.quadrant === targetQuadrant) {
      handleDragEnd();
      return;
    }

    isUpdatingRef.current = true;

    try {
      await changeQuadrant(draggedTask.id, targetQuadrant);
      
      const quadrantNames = {
        1: 'דחוף וחשוב',
        2: 'חשוב',
        3: 'דחוף',
        4: 'לא דחוף'
      };
      
      toast.success(`המשימה הועברה ל"${quadrantNames[targetQuadrant]}"`);
    } catch (err) {
      toast.error('שגיאה בהעברת המשימה');
    } finally {
      isUpdatingRef.current = false;
      handleDragEnd();
    }
  }, [draggedTask, changeQuadrant, handleDragEnd]);

  // ✅ חדש: שחרור בשעה מסוימת
  const handleDropOnTime = useCallback(async (e, targetTime, targetDate = null) => {
    e.preventDefault();
    
    if (!draggedTask || isUpdatingRef.current) return;
    
    // אם אותה שעה ותאריך - לא לעשות כלום
    if (draggedTask.due_time === targetTime && 
        (!targetDate || draggedTask.due_date === targetDate)) {
      handleDragEnd();
      return;
    }

    isUpdatingRef.current = true;

    try {
      const updates = {
        due_time: targetTime
      };
      
      if (targetDate) {
        updates.due_date = targetDate;
      }
      
      await editTask(draggedTask.id, updates);
      
      const timeStr = targetTime.slice(0, 5);
      const message = targetDate 
        ? `המשימה הועברה ל-${timeStr} ביום ${targetDate}`
        : `המשימה הועברה לשעה ${timeStr}`;
      
      toast.success(message);
    } catch (err) {
      console.error('שגיאה בהעברת משימה:', err);
      toast.error('שגיאה בהעברת המשימה');
    } finally {
      isUpdatingRef.current = false;
      handleDragEnd();
    }
  }, [draggedTask, editTask, handleDragEnd]);

  // ✅ חדש: שחרור בתאריך אחר (ללא שינוי שעה)
  const handleDropOnDate = useCallback(async (e, targetDate) => {
    e.preventDefault();
    
    if (!draggedTask || isUpdatingRef.current) return;
    
    // אם אותו תאריך - לא לעשות כלום
    if (draggedTask.due_date === targetDate) {
      handleDragEnd();
      return;
    }

    isUpdatingRef.current = true;

    try {
      await editTask(draggedTask.id, {
        due_date: targetDate
      });
      
      toast.success(`המשימה הועברה ליום ${targetDate}`);
    } catch (err) {
      console.error('שגיאה בהעברת משימה:', err);
      toast.error('שגיאה בהעברת המשימה');
    } finally {
      isUpdatingRef.current = false;
      handleDragEnd();
    }
  }, [draggedTask, editTask, handleDragEnd]);

  // ✅ חדש: חישוב שעה מתוך מיקום העכבר בתוך אלמנט
  const calculateTimeFromPosition = useCallback((e, containerRef, dayStartHour = 8, dayEndHour = 16) => {
    if (!containerRef?.current) return null;
    
    const rect = containerRef.current.getBoundingClientRect();
    const relativeY = e.clientY - rect.top;
    const containerHeight = rect.height;
    
    // חישוב אחוז מהגובה
    const percentage = Math.max(0, Math.min(1, relativeY / containerHeight));
    
    // המרה לדקות ביום
    const totalMinutes = (dayEndHour - dayStartHour) * 60;
    const minutesFromStart = Math.round(percentage * totalMinutes);
    
    // עיגול ל-15 דקות
    const roundedMinutes = Math.round(minutesFromStart / 15) * 15;
    
    // המרה לשעה ודקות
    const hour = dayStartHour + Math.floor(roundedMinutes / 60);
    const minutes = roundedMinutes % 60;
    
    return `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }, []);

  return {
    // מצב
    draggedTask,
    dragOverQuadrant,
    dragOverTime,
    dragOverDate,
    isDragging: !!draggedTask,
    
    // גרירה בסיסית (רבעים)
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    
    // ✅ חדש: גרירה לזמנים
    handleDragOverTime,
    handleDragLeaveTime,
    handleDropOnTime,
    handleDropOnDate,
    
    // ✅ חדש: עזר
    calculateTimeFromPosition
  };
}

export default useDragAndDrop;
