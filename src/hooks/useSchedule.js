/**
 * Hook מרכזי לשיבוץ חכם - useSchedule
 * =====================================
 * 
 * פותר את בעיית הסנכרון בין התצוגות!
 * 
 * הבעיה: DailyView ו-WeeklyPlanner מחשבות את השיבוץ בנפרד,
 * מה שגורם לאי-התאמות.
 * 
 * הפתרון: Hook מרכזי שמחשב את השיבוץ פעם אחת,
 * וכל התצוגות משתמשות באותו מקור אמת.
 */

import { useMemo, useState, useCallback, useEffect } from 'react';
import { useTasks } from './useTasks';
import { smartScheduleWeekV4 } from '../utils/smartSchedulerV4';

/**
 * המרת תאריך לפורמט ISO מקומי
 */
function toLocalISODate(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * חישוב תחילת השבוע (יום ראשון)
 */
function getWeekStart(date) {
  const d = new Date(date);
  const dayOfWeek = d.getDay();
  d.setDate(d.getDate() - dayOfWeek);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Hook מרכזי לשיבוץ
 */
export function useSchedule() {
  const { tasks, loading, loadTasks, dataVersion, lastUpdated, forceRefresh } = useTasks();
  
  // תאריך נבחר (ניתן לשינוי מכל קומפוננטה)
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  // זמן נוכחי - מתעדכן כל דקה
  const [currentTime, setCurrentTime] = useState(() => {
    const now = new Date();
    return {
      minutes: now.getHours() * 60 + now.getMinutes(),
      dateISO: toLocalISODate(now)
    };
  });
  
  // עדכון זמן נוכחי כל דקה
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setCurrentTime({
        minutes: now.getHours() * 60 + now.getMinutes(),
        dateISO: toLocalISODate(now)
      });
    }, 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  // חישוב תחילת השבוע
  const weekStart = useMemo(() => {
    return getWeekStart(selectedDate);
  }, [selectedDate]);
  
  // ✅ חישוב השיבוץ השבועי - מרכזי!
  const weekPlan = useMemo(() => {
    if (!tasks || tasks.length === 0) {
      return null;
    }
    
    console.log('📅 useSchedule: מחשב שיבוץ שבועי', {
      tasksCount: tasks.length,
      weekStart: toLocalISODate(weekStart),
      dataVersion: dataVersion
    });
    
    return smartScheduleWeekV4(weekStart, tasks);
  }, [tasks, weekStart, dataVersion]);
  
  // ✅ קבלת נתוני יום ספציפי
  const getDaySchedule = useCallback((date) => {
    if (!weekPlan) {
      return { blocks: [], tasks: [], isEmpty: true };
    }
    
    const dateISO = toLocalISODate(date);
    const dayPlan = weekPlan?.days?.find(d => d.date === dateISO);
    
    if (!dayPlan) {
      return { blocks: [], tasks: [], isEmpty: true };
    }
    
    return {
      date: dateISO,
      blocks: dayPlan.blocks || [],
      usagePercent: dayPlan.usagePercent || 0,
      plannedMinutes: dayPlan.plannedMinutes || 0,
      completedMinutes: dayPlan.completedMinutes || 0,
      availableMinutes: dayPlan.availableMinutes || 0,
      isEmpty: (dayPlan.blocks || []).length === 0
    };
  }, [weekPlan]);
  
  // ✅ קבלת נתוני היום הנבחר
  const selectedDaySchedule = useMemo(() => {
    return getDaySchedule(selectedDate);
  }, [getDaySchedule, selectedDate]);
  
  // ✅ קבלת נתוני היום הנוכחי (תמיד)
  const todaySchedule = useMemo(() => {
    return getDaySchedule(new Date());
  }, [getDaySchedule]);
  
  // ✅ בדיקה אם צופים בהיום
  const isViewingToday = useMemo(() => {
    return toLocalISODate(selectedDate) === currentTime.dateISO;
  }, [selectedDate, currentTime.dateISO]);
  
  // ניווט בתאריכים
  const goToPreviousDay = useCallback(() => {
    setSelectedDate(prev => {
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() - 1);
      return newDate;
    });
  }, []);
  
  const goToNextDay = useCallback(() => {
    setSelectedDate(prev => {
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() + 1);
      return newDate;
    });
  }, []);
  
  const goToToday = useCallback(() => {
    setSelectedDate(new Date());
  }, []);
  
  // ניווט שבועי
  const goToPreviousWeek = useCallback(() => {
    setSelectedDate(prev => {
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() - 7);
      return newDate;
    });
  }, []);
  
  const goToNextWeek = useCallback(() => {
    setSelectedDate(prev => {
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() + 7);
      return newDate;
    });
  }, []);
  
  // ✅ קבלת המשימה הבאה להיום
  const getNextTask = useCallback(() => {
    if (!todaySchedule.blocks || todaySchedule.blocks.length === 0) {
      return null;
    }
    
    const now = currentTime.minutes;
    
    // מצא את הבלוק הבא שלא הושלם ועוד לא עבר
    const nextBlock = todaySchedule.blocks.find(block => {
      if (block.isCompleted) return false;
      
      // המרת זמן התחלה לדקות
      if (!block.startTime) return false;
      const [hour, min] = block.startTime.split(':').map(Number);
      const blockStart = hour * 60 + (min || 0);
      
      // הבלוק עדיין לא התחיל או בתהליך
      return blockStart >= now - 30; // עד 30 דקות אחרי ההתחלה
    });
    
    return nextBlock || null;
  }, [todaySchedule, currentTime.minutes]);
  
  // ✅ סטטיסטיקות יומיות
  const getDayStats = useCallback((date) => {
    const daySchedule = getDaySchedule(date);
    const blocks = daySchedule.blocks || [];
    
    const completedMinutes = blocks
      .filter(b => b.isCompleted)
      .reduce((sum, b) => sum + (b.duration || 0), 0);
    
    const pendingMinutes = blocks
      .filter(b => !b.isCompleted)
      .reduce((sum, b) => sum + (b.duration || 0), 0);
    
    const totalMinutes = completedMinutes + pendingMinutes;
    
    return {
      completed: completedMinutes,
      pending: pendingMinutes,
      total: totalMinutes,
      completedCount: blocks.filter(b => b.isCompleted).length,
      pendingCount: blocks.filter(b => !b.isCompleted).length,
      usagePercent: daySchedule.usagePercent || 0
    };
  }, [getDaySchedule]);
  
  return {
    // נתונים
    tasks,
    loading,
    weekPlan,
    selectedDate,
    currentTime,
    isViewingToday,
    dataVersion,
    lastUpdated,
    
    // נתוני יום
    selectedDaySchedule,
    todaySchedule,
    getDaySchedule,
    getDayStats,
    getNextTask,
    
    // ניווט
    setSelectedDate,
    goToPreviousDay,
    goToNextDay,
    goToToday,
    goToPreviousWeek,
    goToNextWeek,
    
    // פעולות
    forceRefresh,
    loadTasks
  };
}

export default useSchedule;
