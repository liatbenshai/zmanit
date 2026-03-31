import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTasks } from '../../hooks/useTasks';
import { useAuth } from '../../hooks/useAuth';
import { useGoogleCalendar } from '../../hooks/useGoogleCalendar';
import { useSchedule } from '../../hooks/useSchedule'; // ✅ לקבלת currentTime
import { useSettings } from '../../context/SettingsContext'; // ✅ לקבלת שעות עבודה
import { smartScheduleWeekV4 } from '../../utils/smartSchedulerV4'; // ✅ חישוב מקומי
import { TASK_TYPES } from '../../config/taskTypes';
import SimpleTaskForm from './SimpleTaskForm';
import DailyTaskCard from './DailyTaskCard';
import RescheduleModal from './RescheduleModal';
import DayOverrideButton, { getEffectiveHoursForDate } from './DayOverrideButton'; // ✅ דריסות יום
import Modal from '../UI/Modal';
import Button from '../UI/Button';
import { sortTasksByOrder, saveTaskOrder } from '../../utils/taskOrder';
import { calculateAutoReschedule, executeAutoReschedule } from '../../utils/autoRescheduleDaily';
import toast from 'react-hot-toast';
import { supabase } from '../../services/supabase'; // ✅ לתיעוד הפרעות

// ===============================
// Drag & Drop State
// ===============================
let draggedTaskData = null;

/**
 * סוגי משימות - מיובאים עכשיו מ-config/taskTypes.js
 * הקוד הישן הוסר למניעת כפילות
 */

/**
 * ערכי ברירת מחדל לשעות עבודה (ישמשו רק אם אין הגדרות)
 */
const DEFAULT_WORK_HOURS = {
  start: 8.5, // 08:30
  end: 16.25,  // 16:15
  totalMinutes: 7.75 * 60 // 465 דקות
};

/**
 * שעות בית/משפחה - ברירת מחדל
 */
const DEFAULT_HOME_HOURS = {
  start: 17, // 17:00
  end: 21,   // 21:00
  totalMinutes: 4 * 60 // 240 דקות
};

/**
 * שעות בית בסופ"ש (גמיש) - ברירת מחדל
 */
const DEFAULT_WEEKEND_HOME_HOURS = {
  start: 8,  // 08:00
  end: 22,   // 22:00
  totalMinutes: 14 * 60 // 840 דקות
};

/**
 * המרת דקות משעת חצות לשעה עשרונית (510 -> 8.5)
 */
function minutesToDecimalHour(minutes) {
  return minutes / 60;
}

/**
 * המרת דקות משעת חצות למחרוזת שעה (510 -> "08:30")
 */
function minutesToTimeStr(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * קבלת שעות היום לפי תאריך - עם תמיכה בהגדרות משתמש
 */
function getDaySchedule(date, workDays = null, workHours = null) {
  const dayOfWeek = date.getDay();
  const isWeekend = dayOfWeek === 5 || dayOfWeek === 6; // שישי או שבת
  
  // אם יש הגדרות משתמש - נשתמש בהן
  if (workDays && workHours) {
    const daySettings = workDays[dayOfWeek];
    
    // אם היום לא מופעל - זה יום בית
    if (!daySettings?.enabled) {
      return {
        type: 'home',
        label: 'שעות בית',
        hours: DEFAULT_WEEKEND_HOME_HOURS,
        startStr: '08:00',
        endStr: '22:00',
        isWorkDay: false,
        isHomeDay: true
      };
    }
    
    // יום עבודה עם הגדרות מהמשתמש
    const startMinutes = daySettings.hours?.start || workHours.dayStart || 510;
    const endMinutes = daySettings.hours?.end || workHours.dayEnd || 975;
    
    const customWorkHours = {
      start: minutesToDecimalHour(startMinutes),
      end: minutesToDecimalHour(endMinutes),
      totalMinutes: endMinutes - startMinutes
    };
    
    return {
      type: 'work',
      label: 'שעות עבודה',
      hours: customWorkHours,
      startStr: minutesToTimeStr(startMinutes),
      endStr: minutesToTimeStr(endMinutes),
      isWorkDay: true,
      isHomeDay: true,
      homeHours: DEFAULT_HOME_HOURS
    };
  }
  
  // ברירת מחדל - ללא הגדרות
  if (isWeekend) {
    return {
      type: 'home',
      label: 'שעות בית',
      hours: DEFAULT_WEEKEND_HOME_HOURS,
      startStr: '08:00',
      endStr: '22:00',
      isWorkDay: false,
      isHomeDay: true
    };
  }
  
  // ימים א'-ה' - יש גם עבודה וגם בית
  return {
    type: 'work',
    label: 'שעות עבודה',
    hours: DEFAULT_WORK_HOURS,
    startStr: '08:30',
    endStr: '16:15',
    isWorkDay: true,
    isHomeDay: true,
    homeHours: DEFAULT_HOME_HOURS
  };
}

/**
 * המרה לתאריך עברי
 */
function getHebrewDate(date) {
  try {
    const formatter = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    return formatter.format(date);
  } catch (e) {
    return '';
  }
}

/**
 * קבלת התאריך בפורמט ישראלי
 */
function getDateHebrew(date) {
  const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  const months = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 
                  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
  const dayName = days[date.getDay()];
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return {
    full: `יום ${dayName}, ${day} ב${month} ${year}`,
    short: `${day}/${date.getMonth() + 1}`,
    dayName
  };
}

/**
 * ✅ תיקון: קבלת תאריך בפורמט ISO מקומי (לא UTC!)
 */
function getDateISO(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * בדיקה אם התאריך הוא היום
 */
function isToday(date) {
  const today = new Date();
  return date.toDateString() === today.toDateString();
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
 * פורמט דקות לשעות:דקות
 */
function formatMinutes(minutes) {
  if (!minutes || minutes <= 0) return '0 דק\'';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} דק'`;
  if (mins === 0) return `${hours} שעות`;
  return `${hours}:${String(mins).padStart(2, '0')} שעות`;
}

// =====================================
// Google Icon Component
// =====================================
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

/**
 * תצוגת יום עבודה - מסך ראשי חדש
 * ✅ כולל גרירה לשינוי סדר משימות
 * ✅ כולל סנכרון יומן גוגל
 */
function DailyView() {
  const { user } = useAuth();
  const { tasks, loading, error, loadTasks, editTask, toggleComplete, addTask, dataVersion } = useTasks();
  
  // ✅ שימוש ב-useSettings לקבלת שעות עבודה מהגדרות המשתמש
  const { workDays, workHours } = useSettings();
  
  // ✅ פונקציה עוזרת לקבלת לוח זמנים עם הגדרות המשתמש
  const getScheduleForDate = (date) => getDaySchedule(date, workDays, workHours);
  
  // ✅ שימוש ב-useSchedule רק לקבלת currentTime
  const { 
    currentTime,
    forceRefresh 
  } = useSchedule();
  
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [dragOverTime, setDragOverTime] = useState(null);
  const [taskOrder, setTaskOrder] = useState([]);
  const [highlightedTaskId, setHighlightedTaskId] = useState(null); // ✅ משימה מודגשת
  const timelineRef = useRef(null);
  
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  
  // ✅ חדש: מעקב אחרי טיימרים פעילים
  const [activeTimers, setActiveTimers] = useState({});
  
  // ✅ רענון לוח זמנים אחרי דריסה
  const [scheduleRefresh, setScheduleRefresh] = useState(0);
  
  // ✅ חדש: בדיקת טיימרים כל 5 שניות
  useEffect(() => {
    const checkTimers = () => {
      const timers = {};
      tasks.forEach(task => {
        try {
          const timerData = localStorage.getItem(`timer_v2_${task.id}`);
          if (timerData) {
            const parsed = JSON.parse(timerData);
            // ✅ תיקון: גם isInterrupted נחשב כטיימר פעיל
            if (parsed.isRunning || parsed.isPaused || (parsed.isInterrupted && parsed.startTime)) {
              timers[task.id] = parsed;
            }
          }
        } catch (e) {}
      });
      setActiveTimers(timers);
    };
    
    checkTimers(); // בדיקה ראשונית
    const interval = setInterval(checkTimers, 5000); // כל 5 שניות
    
    // האזנה לשינויים ב-localStorage
    const handleStorage = (e) => {
      if (e.key?.startsWith('timer_v2_')) {
        checkTimers();
      }
    };
    window.addEventListener('storage', handleStorage);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorage);
    };
  }, [tasks]);
  
  const { 
    isConnected: isGoogleConnected, 
    isLoading: isGoogleLoading,
    isSyncing: isGoogleSyncing,
    syncGoogleEvents,
    exportTasks: exportToGoogle,
  } = useGoogleCalendar();
  
  const [showGoogleMenu, setShowGoogleMenu] = useState(false);
  
  // ✅ בדיקה אם יש משימה להפעלה מהתראה
  useEffect(() => {
    const startTaskId = localStorage.getItem('start_task_id');
    if (startTaskId) {
      setHighlightedTaskId(startTaskId);
      localStorage.removeItem('start_task_id');
      toast.success('🎯 משימה נבחרה - לחצי על ▶️ להתחיל!');
      
      // גלילה למשימה אחרי טעינה
      setTimeout(() => {
        const taskElement = document.getElementById(`task-${startTaskId}`);
        if (taskElement) {
          taskElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 500);
      
      // הסרת ההדגשה אחרי 5 שניות
      setTimeout(() => setHighlightedTaskId(null), 5000);
    }
  }, []);
  
  useEffect(() => {
    const syncGoogleForDate = async () => {
      if (!isGoogleConnected || isGoogleLoading || !user?.id) return;
      
      try {
        const result = await syncGoogleEvents(selectedDate, user.id, null, tasks);
        if (result.imported > 0 || result.updated > 0) {
          await loadTasks();
        }
      } catch (err) {
        console.error('שגיאה בסנכרון גוגל:', err);
      }
    };
    
    syncGoogleForDate();
  }, [selectedDate, isGoogleConnected, isGoogleLoading, user?.id]);
  
  // ✅ currentTime מגיע עכשיו מ-useSchedule - לא צריך state מקומי
  
  const [rescheduleInfo, setRescheduleInfo] = useState(null);
  const [isAutoRescheduling, setIsAutoRescheduling] = useState(false);

  useEffect(() => {
    if (!tasks || tasks.length === 0) {
      setRescheduleInfo(null);
      return;
    }
    
    const todayISO = getDateISO(new Date());
    if (getDateISO(selectedDate) !== todayISO) {
      setRescheduleInfo(null);
      return;
    }
    
    const info = calculateAutoReschedule(tasks, editTask);
    setRescheduleInfo(info);
  }, [tasks, selectedDate, currentTime.minutes]);

  const handleAutoReschedule = async () => {
    if (!rescheduleInfo) return;
    
    setIsAutoRescheduling(true);
    
    try {
      const result = await executeAutoReschedule(editTask, rescheduleInfo);
      
      if (result.movedToTomorrow > 0) {
        toast.success(`📅 ${result.movedToTomorrow} משימות הועברו למחר`);
      }
      if (result.movedToToday > 0) {
        toast.success(`✨ ${result.movedToToday} משימות נמשכו להיום`);
      }
      
      loadTasks();
    } catch (err) {
      console.error('Error in auto-reschedule:', err);
      toast.error('שגיאה בדחיית משימות');
    } finally {
      setIsAutoRescheduling(false);
    }
  };

  const goToPreviousDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    setSelectedDate(newDate);
  };

  const goToNextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    setSelectedDate(newDate);
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  // ✅ חדש: כללי שיבוץ חכמים
  const SMART_SCHEDULING_RULES = {
    morningTasks: ['transcription'],
    afternoonTasks: ['proofreading', 'translation', 'admin', 'email'],
    workHours: {
      start: 8.5 * 60,      // 08:30 בדקות
      morningEnd: 14 * 60,  // 14:00
      end: 16.25 * 60       // 16:15
    },
    bufferPercentage: 0.20  // 20% רזרבה לבלת"מים
  };

  // ✅ חדש: state לסידור מחדש
  const [isRescheduling, setIsRescheduling] = useState(false);

  // ✅ חדש: פונקציה לסידור מחדש של משימות לפי הכללים
  const handleSmartReschedule = async () => {
    const dateISO = getDateISO(selectedDate);
    
    // סינון משימות היום שלא הושלמו
    const todayTasks = tasks.filter(t => 
      t.due_date === dateISO && 
      !t.is_completed && 
      t.due_time &&
      !t.is_project
    );
    
    if (todayTasks.length === 0) {
      toast('אין משימות לסדר מחדש', { icon: '📋' });
      return;
    }
    
    // חלוקה לפי סוג משימה
    const morningTasks = todayTasks.filter(t => 
      SMART_SCHEDULING_RULES.morningTasks.includes(t.task_type)
    );
    const afternoonTasks = todayTasks.filter(t => 
      SMART_SCHEDULING_RULES.afternoonTasks.includes(t.task_type)
    );
    const otherTasks = todayTasks.filter(t => 
      !SMART_SCHEDULING_RULES.morningTasks.includes(t.task_type) &&
      !SMART_SCHEDULING_RULES.afternoonTasks.includes(t.task_type)
    );
    
    // חישוב רזרבה לבלת"מים
    const totalDayMinutes = SMART_SCHEDULING_RULES.workHours.end - SMART_SCHEDULING_RULES.workHours.start;
    const bufferMinutes = Math.round(totalDayMinutes * SMART_SCHEDULING_RULES.bufferPercentage);
    const effectiveEnd = SMART_SCHEDULING_RULES.workHours.end - bufferMinutes;
    
    setIsRescheduling(true);
    
    try {
      const updates = [];
      
      // אם אנחנו מארגנות את "היום" בזמן אמת - לא משבצים לאחור לשעות שכבר עברו.
      const isTodayReschedule = dateISO === currentTime?.dateISO;
      const roundUpToStep = (minutes, stepMinutes = 5) =>
        Math.ceil(minutes / stepMinutes) * stepMinutes;

      const nowPlusBuffer = isTodayReschedule
        ? roundUpToStep((currentTime?.minutes || 0) + 5, 5)
        : null;

      let currentMorning = SMART_SCHEDULING_RULES.workHours.start;
      let currentAfternoon = SMART_SCHEDULING_RULES.workHours.morningEnd;
      
      if (isTodayReschedule && typeof nowPlusBuffer === 'number') {
        currentMorning = Math.max(currentMorning, nowPlusBuffer);
        currentAfternoon = Math.max(currentAfternoon, nowPlusBuffer);
      }
      
      // מיון לפי עדיפות (דחוף קודם)
      const priorityOrder = { urgent: 0, high: 1, normal: 2 };
      
      // שיבוץ משימות בוקר (תמלול)
      morningTasks
        .sort((a, b) => (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2))
        .forEach(task => {
          const duration = task.estimated_duration || 30;
          const endTime = currentMorning + duration;
          
          // אם חורג מהבוקר, ממשיך בזמן הזמין
          if (endTime <= SMART_SCHEDULING_RULES.workHours.morningEnd) {
            const newTime = minutesToTimeStr(currentMorning);
            if (task.due_time !== newTime) {
              updates.push({ id: task.id, due_time: newTime, title: task.title });
            }
            currentMorning = endTime + 5; // 5 דקות מרווח
          } else {
            // אין מספיק מקום בבוקר - שים באחה"צ
            const newTime = minutesToTimeStr(currentAfternoon);
            if (task.due_time !== newTime) {
              updates.push({ id: task.id, due_time: newTime, title: task.title });
            }
            currentAfternoon = currentAfternoon + duration + 5;
          }
        });
      
      // שיבוץ משימות אחה"צ (הגהות, תרגום, וכו')
      afternoonTasks
        .sort((a, b) => (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2))
        .forEach(task => {
          const duration = task.estimated_duration || 30;
          const endTime = currentAfternoon + duration;
          
          // בדיקה שלא חורגים מסוף היום (עם רזרבה)
          if (endTime <= effectiveEnd) {
            const newTime = minutesToTimeStr(currentAfternoon);
            if (task.due_time !== newTime) {
              updates.push({ id: task.id, due_time: newTime, title: task.title });
            }
            currentAfternoon = endTime + 5;
          }
        });
      
      // שיבוץ שאר המשימות בזמן הפנוי
      // קודם למלא את הבוקר, אח"כ את האחה"צ
      otherTasks
        .sort((a, b) => (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2))
        .forEach(task => {
          const duration = task.estimated_duration || 30;
          
          // נסה בבוקר
          if (currentMorning + duration <= SMART_SCHEDULING_RULES.workHours.morningEnd) {
            const newTime = minutesToTimeStr(currentMorning);
            if (task.due_time !== newTime) {
              updates.push({ id: task.id, due_time: newTime, title: task.title });
            }
            currentMorning = currentMorning + duration + 5;
          }
          // אם לא נכנס לבוקר, שים באחה"צ
          else if (currentAfternoon + duration <= effectiveEnd) {
            const newTime = minutesToTimeStr(currentAfternoon);
            if (task.due_time !== newTime) {
              updates.push({ id: task.id, due_time: newTime, title: task.title });
            }
            currentAfternoon = currentAfternoon + duration + 5;
          }
        });
      
      // ביצוע העדכונים
      if (updates.length === 0) {
        toast.success('המשימות כבר מסודרות נכון! ✅');
        setIsRescheduling(false);
        return;
      }
      
      for (const update of updates) {
        await editTask(update.id, { due_time: update.due_time });
      }
      
      await loadTasks();
      
      toast.success(
        `✅ ${updates.length} משימות סודרו מחדש!\n` +
        `🌅 תמלול: בוקר\n` +
        `🌆 הגהות: אחה"צ\n` +
        `⏰ ${bufferMinutes} דק' רזרבה לבלת"מים`,
        { duration: 5000 }
      );
      
    } catch (error) {
      console.error('שגיאה בסידור מחדש:', error);
      toast.error('שגיאה בסידור מחדש של המשימות');
    } finally {
      setIsRescheduling(false);
    }
  };

  // ✅ חישוב weekPlan מקומי - תלוי ב-selectedDate של DailyView
  const weekPlan = useMemo(() => {
    if (!tasks || tasks.length === 0) return null;
    const weekStart = getWeekStart(selectedDate);
    console.log('📆 DailyView: מחשב weekPlan, dataVersion:', dataVersion);
    return smartScheduleWeekV4(weekStart, tasks);
  }, [tasks, selectedDate, dataVersion]);
  
  const selectedDayData = useMemo(() => {
    if (!weekPlan) return { blocks: [], tasks: [] };
    
    const dateISO = getDateISO(selectedDate);
    const dayPlan = weekPlan?.days?.find(d => d.date === dateISO);
    
    if (!dayPlan) {
      return { blocks: [], tasks: [] };
    }
    
    return {
      blocks: dayPlan.blocks || [],
      usagePercent: dayPlan.usagePercent || 0,
      plannedMinutes: dayPlan.plannedMinutes || 0,
      completedMinutes: dayPlan.completedMinutes || 0
    };
  }, [weekPlan, selectedDate, dataVersion]); // ✅ תלוי גם ב-dataVersion לסנכרון

  const isViewingToday = getDateISO(selectedDate) === currentTime.dateISO;
  
  // ✅ בדיקת בעיות בלוח הזמנים (חפיפות, חריגות)
  const scheduleWarnings = useMemo(() => {
    if (!tasks || tasks.length === 0) return { overlaps: [], overflows: [] };
    
    const dateISO = getDateISO(selectedDate);
    // ✅ תיקון: מסננים משימות הוריות (is_project=true) כי הן רק "מטריה" לאינטרוולים
    const todayTasks = tasks.filter(t => 
      t.due_date === dateISO && 
      !t.is_completed && 
      t.due_time &&
      !t.is_project  // ✅ לא כוללים משימות הוריות
    );
    
    if (todayTasks.length < 2) return { overlaps: [], overflows: [] };
    
    // בדיקת חפיפות
    const overlaps = [];
    for (let i = 0; i < todayTasks.length; i++) {
      for (let j = i + 1; j < todayTasks.length; j++) {
        const task1 = todayTasks[i];
        const task2 = todayTasks[j];
        
        const [h1, m1] = task1.due_time.split(':').map(Number);
        const [h2, m2] = task2.due_time.split(':').map(Number);
        
        const start1 = h1 * 60 + (m1 || 0);
        const end1 = start1 + (task1.estimated_duration || 30);
        const start2 = h2 * 60 + (m2 || 0);
        const end2 = start2 + (task2.estimated_duration || 30);
        
        // בדיקת חפיפה
        if (start1 < end2 && end1 > start2) {
          overlaps.push({
            task1: task1.title,
            task2: task2.title,
            time: task1.due_time === task2.due_time ? task1.due_time : `${task1.due_time}/${task2.due_time}`
          });
        }
      }
    }
    
    // בדיקת חריגה מסוף היום (גם כאן מסננים משימות הוריות)
    const daySchedule = getDaySchedule(selectedDate, workDays, workHours);
    const dayEndMinutes = daySchedule.hours.end * 60;
    
    const overflows = todayTasks.filter(task => {
      const [h, m] = task.due_time.split(':').map(Number);
      const endMinutes = h * 60 + (m || 0) + (task.estimated_duration || 30);
      return endMinutes > dayEndMinutes;
    }).map(task => ({
      title: task.title,
      overflowMinutes: (() => {
        const [h, m] = task.due_time.split(':').map(Number);
        const endMinutes = h * 60 + (m || 0) + (task.estimated_duration || 30);
        return endMinutes - dayEndMinutes;
      })()
    }));
    
    return { overlaps, overflows };
  }, [tasks, selectedDate, workDays, workHours]);
  
  const timeStats = useMemo(() => {
    const blocks = selectedDayData.blocks || [];
    
    // ✅ תיקון: שימוש ב-activeTimers state במקום לקרוא מ-localStorage
    const checkTimerRunning = (block) => {
      const taskId = block.taskId || block.task?.id || block.id;
      if (!taskId) return false;
      return activeTimers[taskId]?.isRunning && !activeTimers[taskId]?.isInterrupted;
    };
    
    const blockHasPassed = (block) => {
      if (!isViewingToday) return false;
      if (!block.endTime) return false;
      if (checkTimerRunning(block)) return false; // ✅ לא באיחור אם טיימר רץ
      const [hour, min] = block.endTime.split(':').map(Number);
      return (hour * 60 + (min || 0)) < currentTime.minutes;
    };
    
    const completedMinutes = blocks
      .filter(b => b.isCompleted)
      .reduce((sum, b) => sum + (b.duration || 0), 0);
    
    // ✅ תיקון: חישוב הזמן שנותר (duration - time_spent) ולא הזמן המוערך המקורי
    const pendingMinutes = blocks
      .filter(b => !b.isCompleted)
      .reduce((sum, b) => {
        const estimated = b.duration || 0;
        const spent = b.task?.time_spent || b.timeSpent || 0;
        const remaining = Math.max(0, estimated - spent);
        return sum + remaining;
      }, 0);
    
    // ✅ תיקון: חישוב הזמן שנותר גם למשימות באיחור
    const overdueMinutes = blocks
      .filter(b => !b.isCompleted && blockHasPassed(b))
      .reduce((sum, b) => {
        const estimated = b.duration || 0;
        const spent = b.task?.time_spent || b.timeSpent || 0;
        const remaining = Math.max(0, estimated - spent);
        return sum + remaining;
      }, 0);
    
    // ✅ תיקון: גישה נכונה ל-time_spent דרך המשימה
    const inProgressMinutes = blocks
      .filter(b => !b.isCompleted && (b.task?.time_spent || b.timeSpent || 0) > 0)
      .reduce((sum, b) => sum + (b.task?.time_spent || b.timeSpent || 0), 0);
    
    // ✅ תיקון: שימוש בשעות דינמיות לפי היום
    const daySchedule = getScheduleForDate(selectedDate);
    const dayHours = daySchedule.hours;
    
    const endOfDayMinutes = dayHours.end * 60;
    const minutesLeftInDay = isViewingToday 
      ? Math.max(0, endOfDayMinutes - currentTime.minutes)
      : dayHours.totalMinutes;
    
    // ✅ תיקון: אחרי שתיקנו את pendingMinutes לחשב זמן שנותר, החישוב פשוט יותר
    // pendingMinutes כבר מכיל את הזמן שנותר (estimated - spent), לא צריך להוסיף inProgressMinutes
    const freeMinutes = Math.max(0, minutesLeftInDay - pendingMinutes);
    
    return {
      completed: completedMinutes,
      pending: pendingMinutes,
      overdue: overdueMinutes,
      inProgress: inProgressMinutes,
      remaining: freeMinutes,
      minutesLeftInDay: minutesLeftInDay,
      total: dayHours.totalMinutes,
      usedPercent: Math.round((completedMinutes / dayHours.totalMinutes) * 100),
      canFitAll: pendingMinutes <= minutesLeftInDay
    };
  }, [selectedDayData, isViewingToday, currentTime.minutes, selectedDate, activeTimers]);

  const handleAddTask = () => {
    setEditingTask(null);
    setShowTaskForm(true);
  };

  const handleEditTask = (task) => {
    const originalTask = tasks.find(t => t.id === task.taskId || t.id === task.id);
    setEditingTask(originalTask || task);
    setShowTaskForm(true);
  };

  const handleCloseForm = () => {
    setShowTaskForm(false);
    setEditingTask(null);
    loadTasks();
  };

  const handleSyncWithGoogle = async () => {
    if (!isGoogleConnected || !user?.id) return;
    
    try {
      const result = await syncGoogleEvents(selectedDate, user.id, null, tasks);
      if (result.imported > 0 || result.updated > 0) {
        await loadTasks();
      }
    } catch (err) {
      console.error('שגיאה בסנכרון:', err);
    }
  };

  const handleDragStart = (task, e) => {
    draggedTaskData = task;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', task.id);
  };

  const handleDragEnd = () => {
    draggedTaskData = null;
    setDragOverTime(null);
  };

  const handleDragOverTimeline = (e) => {
    e.preventDefault();
    if (!timelineRef.current || !draggedTaskData) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const relativeY = e.clientY - rect.top;
    const percentage = Math.max(0, Math.min(1, relativeY / rect.height));
    
    const totalMinutes = 8 * 60;
    const minutesFromStart = Math.round(percentage * totalMinutes);
    const roundedMinutes = Math.round(minutesFromStart / 15) * 15;
    
    const hour = 8 + Math.floor(roundedMinutes / 60);
    const minutes = roundedMinutes % 60;
    const timeStr = `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    
    setDragOverTime(timeStr);
  };

  const handleDropOnTimeline = async (e) => {
    e.preventDefault();
    
    if (!draggedTaskData || !dragOverTime) {
      handleDragEnd();
      return;
    }

    try {
      // ✅ בדיקת חפיפות עם משימות אחרות
      const draggedTaskId = draggedTaskData.id || draggedTaskData.taskId;
      const draggedTask = tasks.find(t => t.id === draggedTaskId);
      const duration = draggedTask?.estimated_duration || draggedTaskData.duration || 30;
      
      const [dropHour, dropMin] = dragOverTime.split(':').map(Number);
      const dropStartMinutes = dropHour * 60 + dropMin;
      const dropEndMinutes = dropStartMinutes + duration;
      
      // בדיקת חפיפה עם משימות אחרות באותו יום
      const dateISO = getDateISO(selectedDate);
      const otherTasksToday = tasks.filter(t => 
        t.due_date === dateISO && 
        t.id !== draggedTaskId && 
        !t.is_completed &&
        t.due_time
      );
      
      const conflicts = [];
      for (const task of otherTasksToday) {
        const [h, m] = task.due_time.split(':').map(Number);
        const taskStart = h * 60 + (m || 0);
        const taskEnd = taskStart + (task.estimated_duration || 30);
        
        // בדיקת חפיפה
        if (dropStartMinutes < taskEnd && dropEndMinutes > taskStart) {
          conflicts.push(task.title);
        }
      }
      
      if (conflicts.length > 0) {
        toast.error(`⚠️ חפיפה עם: ${conflicts.slice(0, 2).join(', ')}${conflicts.length > 2 ? '...' : ''}`, {
          duration: 4000
        });
      }
      
      // בדיקה אם חורג מסוף היום
      const daySchedule = getScheduleForDate(selectedDate);
      const dayEndMinutes = daySchedule.hours.end * 60;
      
      if (dropEndMinutes > dayEndMinutes) {
        const overflowMinutes = dropEndMinutes - dayEndMinutes;
        toast.error(`⚠️ המשימה תסתיים ${overflowMinutes} דק' אחרי סוף היום!`, {
          duration: 4000
        });
      }
      
      // ✅ עדכון רק due_time ו-due_date - לא משנים שום דבר אחר!
      await editTask(draggedTaskId, {
        due_time: dragOverTime,
        due_date: dateISO
      });
      
      toast.success(`המשימה הועברה לשעה ${dragOverTime}`);
      loadTasks();
    } catch (err) {
      console.error('שגיאה בהעברת משימה:', err);
      toast.error('שגיאה בהעברת המשימה');
    } finally {
      handleDragEnd();
    }
  };

  const handleReorderDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
    e.target.style.opacity = '0.5';
  };

  const handleReorderDragEnd = (e) => {
    setDraggedIndex(null);
    setDragOverIndex(null);
    if (e.target) {
      e.target.style.opacity = '1';
    }
  };

  const handleReorderDragOver = (e, index) => {
    e.preventDefault();
    e.stopPropagation();
    if (index !== draggedIndex) {
      setDragOverIndex(index);
    }
  };

  // ✅ תיקון: עדכון due_time בדאטאבייס אחרי שינוי סדר - כדי שההתראות יעבדו נכון!
  // ⚠️ חשוב: מעדכנים רק את due_time, לא משנים estimated_duration או task_type!
  const handleReorderDrop = async (e, toIndex, blocksArray) => {
    e.preventDefault();
    e.stopPropagation();
    
    const fromIndex = draggedIndex;
    
    if (fromIndex === null || fromIndex === toIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    // יצירת סדר חדש
    const currentOrder = blocksArray.map(b => b.taskId || b.id);
    const newOrder = [...currentOrder];
    const [movedItem] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, movedItem);
    
    const dateISO = getDateISO(selectedDate);
    saveTaskOrder(dateISO, newOrder);
    setTaskOrder(newOrder);
    
    // ✅ חדש: עדכון due_time בדאטאבייס לכל משימה לפי הסדר החדש
    try {
      // חישוב זמנים חסומים מאירועי גוגל (כדי לדלג עליהם)
      const googleBlocks = blocksArray.filter(b => 
        b.isFromGoogle || b.is_from_google || b.isGoogleEvent
      );
      const blockedTimes = googleBlocks.map(block => {
        const startTime = (block.startTime || '00:00').split(':').map(Number);
        const endTime = (block.endTime || '00:00').split(':').map(Number);
        return {
          start: startTime[0] * 60 + (startTime[1] || 0),
          end: endTime[0] * 60 + (endTime[1] || 0)
        };
      }).sort((a, b) => a.start - b.start);
      
      // פונקציה למציאת סלוט פנוי (דילוג על אירועי גוגל)
      const findFreeSlot = (startFrom, duration) => {
        let proposedStart = startFrom;
        for (const blocked of blockedTimes) {
          const proposedEnd = proposedStart + duration;
          if (proposedStart < blocked.end && proposedEnd > blocked.start) {
            proposedStart = blocked.end + 5; // 5 דקות אחרי אירוע גוגל
          }
        }
        return proposedStart;
      };
      
      // סינון רק משימות רגילות (לא גוגל) בסדר החדש
      const regularBlocksInNewOrder = newOrder
        .map(id => blocksArray.find(b => (b.taskId || b.id) === id))
        .filter(block => block && !block.isFromGoogle && !block.is_from_google && !block.isGoogleEvent);
      
      // חישוב זמנים חדשים
      const daySchedule = getScheduleForDate(selectedDate);
      const dayEndMinutes = daySchedule.hours.end * 60;
      let nextStartMinutes = isViewingToday 
        ? currentTime.minutes 
        : daySchedule.hours.start * 60;
      
      // ✅ חדש: בדיקת בעיות בלוח הזמנים
      const scheduleProblems = [];
      let totalScheduledMinutes = 0;
      
      // עדכון כל משימה עם הזמן החדש שלה
      for (const block of regularBlocksInNewOrder) {
        // ✅ תיקון: קבלת duration מהמשימה המקורית ב-DB
        const taskId = block.taskId || block.id;
        const originalTask = tasks.find(t => t.id === taskId);
        const duration = originalTask?.estimated_duration || block.duration || block.estimated_duration || 30;
        
        const startMinutes = findFreeSlot(nextStartMinutes, duration);
        const endMinutes = startMinutes + duration;
        const hours = Math.floor(startMinutes / 60);
        const mins = startMinutes % 60;
        const newDueTime = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
        
        // ✅ בדיקה אם המשימה חורגת מסוף היום
        if (endMinutes > dayEndMinutes) {
          const overflowMinutes = endMinutes - dayEndMinutes;
          scheduleProblems.push({
            taskId,
            title: block.title,
            type: 'overflow',
            overflowMinutes,
            suggestedTime: newDueTime
          });
        }
        
        // ✅ עדכון רק due_time - לא משנים שום דבר אחר!
        await editTask(taskId, { due_time: newDueTime });
        
        totalScheduledMinutes += duration;
        nextStartMinutes = endMinutes + 5; // 5 דקות הפסקה
      }
      
      // ✅ התראות על בעיות בלוח הזמנים
      if (scheduleProblems.length > 0) {
        const overflowTasks = scheduleProblems.filter(p => p.type === 'overflow');
        if (overflowTasks.length === 1) {
          toast.error(`⚠️ "${overflowTasks[0].title}" חורגת מסוף היום ב-${overflowTasks[0].overflowMinutes} דק'`, {
            duration: 5000
          });
        } else if (overflowTasks.length > 1) {
          toast.error(`⚠️ ${overflowTasks.length} משימות חורגות מסוף היום!`, {
            duration: 5000
          });
        }
      } else {
        toast.success('🔄 הסדר והזמנים עודכנו');
      }
      
      await loadTasks(); // רענון הנתונים
    } catch (err) {
      console.error('שגיאה בעדכון זמנים:', err);
      toast.error('שגיאה בעדכון הזמנים');
    }
    
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-6 text-center text-red-600">
        <p>שגיאה בטעינת משימות: {error}</p>
        <button onClick={loadTasks} className="mt-4 btn btn-primary">
          נסי שוב
        </button>
      </div>
    );
  }

  // ✅ תיקון: שימוש ב-activeTimers state
  const isTimerRunning = (taskId) => {
    if (!taskId) return false;
    return activeTimers[taskId]?.isRunning && !activeTimers[taskId]?.isInterrupted;
  };
  
  // ✅ תיקון: גם isPaused וגם isInterrupted נחשבים כ"עובד עליה"
  const isTimerActive = (taskId) => {
    if (!taskId) return false;
    const timer = activeTimers[taskId];
    if (!timer) return false;
    return timer.isRunning || timer.isPaused || (timer.isInterrupted && timer.startTime);
  };
  
  const isBlockPast = (block) => {
    if (!isViewingToday) return false;
    
    const taskId = block.taskId || block.task?.id || block.id;
    // ✅ תיקון: לא באיחור אם טיימר רץ או מושהה
    if (isTimerActive(taskId)) return false;
    
    // ✅ תיקון: בדיקת endTime (זמן סיום) במקום due_time (זמן התחלה)
    const endTime = block.endTime || block.task?.endTime;
    if (!endTime) {
      // fallback ל-due_time + duration
      const dueTime = block.startTime || block.task?.due_time;
      if (!dueTime) return false;
      const [hour, min] = dueTime.split(':').map(Number);
      const duration = block.duration || block.task?.estimated_duration || 30;
      const endMinutes = hour * 60 + (min || 0) + duration;
      return endMinutes < currentTime.minutes;
    }
    
    const [hour, min] = endTime.split(':').map(Number);
    const endMinutes = hour * 60 + (min || 0);
    return endMinutes < currentTime.minutes;
  };
  
  const minutesToTime = (totalMinutes) => {
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  };
  
  const allBlocks = [...(selectedDayData.blocks || [])].sort((a, b) => {
    if (a.startTime && b.startTime) {
      const aTime = a.startTime.split(':').map(Number);
      const bTime = b.startTime.split(':').map(Number);
      const aMinutes = aTime[0] * 60 + (aTime[1] || 0);
      const bMinutes = bTime[0] * 60 + (bTime[1] || 0);
      if (aMinutes !== bMinutes) return aMinutes - bMinutes;
    }
    if (a.blockIndex && b.blockIndex) {
      return a.blockIndex - b.blockIndex;
    }
    return 0;
  });
  
  const completedBlocks = allBlocks.filter(b => b.isCompleted);
  let activeBlocks = allBlocks.filter(b => !b.isCompleted);
  
  const getRunningTaskId = () => {
    for (const block of activeBlocks) {
      const taskId = block.taskId || block.task?.id;
      if (taskId) {
        try {
          const timerData = localStorage.getItem(`timer_v2_${taskId}`);
          if (timerData) {
            const parsed = JSON.parse(timerData);
            if (parsed.isRunning && !parsed.isInterrupted) {
              return taskId;
            }
          }
        } catch (e) {}
      }
    }
    return null;
  };
  
  const runningTaskId = getRunningTaskId();
  
  if (runningTaskId) {
    const runningIndex = activeBlocks.findIndex(b => 
      (b.taskId || b.task?.id) === runningTaskId
    );
    if (runningIndex > 0) {
      const [runningBlock] = activeBlocks.splice(runningIndex, 1);
      activeBlocks.unshift(runningBlock);
    }
  }
  
  const dateISO = getDateISO(selectedDate);
  
  const googleTasks = activeBlocks.filter(b => b.is_from_google || b.task?.is_from_google || b.isGoogleEvent);
  const regularBlocks = activeBlocks.filter(b => !b.is_from_google && !b.task?.is_from_google && !b.isGoogleEvent);
  
  let sortedRegularBlocks = sortTasksByOrder(regularBlocks.map(b => ({
    ...b,
    id: b.taskId || b.id,
    parentId: b.parentId || b.task?.parent_task_id,
    blockIndex: b.blockIndex,
    isRunning: isTimerRunning(b.taskId || b.task?.id || b.id)
  })), dateISO);
  
  // ✅ יצירת רשימת זמנים חסומים מאירועי גוגל
  const googleBlockedTimes = googleTasks.map(block => {
    const startTime = block.startTime?.split(':').map(Number) || [0, 0];
    const endTime = block.endTime?.split(':').map(Number) || [0, 0];
    return {
      start: startTime[0] * 60 + startTime[1],
      end: endTime[0] * 60 + endTime[1]
    };
  }).sort((a, b) => a.start - b.start);
  
  // ✅ פונקציה שמוצאת את הזמן הפנוי הבא (דילוג על אירועי גוגל)
  const findNextFreeSlot = (startFrom, duration) => {
    let proposedStart = startFrom;
    
    for (const blocked of googleBlockedTimes) {
      const proposedEnd = proposedStart + duration;
      
      // בדיקת חפיפה - אם המשימה המוצעת חופפת לאירוע גוגל
      if (proposedStart < blocked.end && proposedEnd > blocked.start) {
        // יש חפיפה - נתחיל אחרי האירוע הזה
        proposedStart = blocked.end + 5; // 5 דקות הפסקה אחרי אירוע גוגל
      }
    }
    
    return proposedStart;
  };
  
  // ✅ תיקון: שימוש בשעות דינמיות לפי היום
  const currentDaySchedule = getScheduleForDate(selectedDate);
  let nextStartMinutes = isViewingToday ? currentTime.minutes : currentDaySchedule.hours.start * 60;
  
  const rescheduledRegularBlocks = sortedRegularBlocks.map(block => {
    // ✅ תיקון: קבלת duration מהמשימה המקורית ב-DB
    const taskId = block.taskId || block.task?.id || block.id;
    const originalTask = tasks.find(t => t.id === taskId);
    const duration = originalTask?.estimated_duration || block.duration || 30;
    
    // ✅ תיקון מלא: בדיקת due_time מהמשימה המקורית
    const taskDueTime = originalTask?.due_time || block.task?.due_time;
    const hasFixedTime = taskDueTime && taskDueTime !== '';
    
    // אם יש טיימר רץ על המשימה - גם לא משנים
    const hasActiveTimer = isTimerRunning(taskId);
    
    let startMinutes, endMinutes;
    
    if (hasFixedTime) {
      // ✅ שומרים על הזמן המקורי מה-due_time
      const [h, m] = taskDueTime.split(':').map(Number);
      startMinutes = h * 60 + (m || 0);
      endMinutes = startMinutes + duration;
    } else if (hasActiveTimer) {
      // טיימר רץ - שומרים על הזמן הנוכחי
      const originalStart = block.startTime?.split(':').map(Number) || [0, 0];
      startMinutes = originalStart[0] * 60 + (originalStart[1] || 0);
      endMinutes = startMinutes + duration;
    } else {
      // משימות גמישות - מתזמנים מחדש
      startMinutes = findNextFreeSlot(nextStartMinutes, duration);
      endMinutes = startMinutes + duration;
      nextStartMinutes = endMinutes + 5;
    }
    
    const wasPostponed = isBlockPast(block);
    
    return {
      ...block,
      originalStartTime: block.startTime,
      originalEndTime: block.endTime,
      startTime: minutesToTime(startMinutes),
      endTime: minutesToTime(endMinutes),
      isPostponed: wasPostponed,
      isRescheduled: wasPostponed && !hasFixedTime && !hasActiveTimer
    };
  });
  
  const googleTasksWithTimes = googleTasks.map(block => ({
    ...block,
    isPostponed: false,
    isRescheduled: false,
    isFromGoogle: true
  }));
  
  let rescheduledBlocks = [...rescheduledRegularBlocks, ...googleTasksWithTimes].sort((a, b) => {
    const aTime = a.startTime?.split(':').map(Number) || [0, 0];
    const bTime = b.startTime?.split(':').map(Number) || [0, 0];
    return (aTime[0] * 60 + aTime[1]) - (bTime[0] * 60 + bTime[1]);
  });

  // Fallback: אם מנוע השיבוץ החזיר 0 בלוקים (למשל בגלל weekPlan לא תקין),
  // נציג את המשימות מה-DB כבלוקים "ארעיים" כדי שלא ייראה כאילו הן נמחקו.
  if (rescheduledBlocks.length === 0 && tasks?.length > 0) {
    const fallbackDateISO = getDateISO(selectedDate);
    const normalizeTaskDateISO = (value) => {
      if (!value) return null;
      if (typeof value === 'string') return value;
      try {
        const d = new Date(value);
        return isNaN(d.getTime()) ? null : getDateISO(d);
      } catch {
        return null;
      }
    };
    const dayTasks = tasks
      .filter(t => {
        if (!t || t.is_completed || t.deleted_at || t.is_project) return false;
        const dueISO = normalizeTaskDateISO(t.due_date || t.dueDate);
        const startISO = normalizeTaskDateISO(t.start_date || t.startDate);
        return dueISO === fallbackDateISO || startISO === fallbackDateISO;
      })
      .sort((a, b) => {
        const priorityOrder = { urgent: 0, high: 1, normal: 2 };
        const p = (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2);
        if (p !== 0) return p;
        if (a.due_time && b.due_time) return a.due_time.localeCompare(b.due_time);
        return 0;
      });

    const daySchedule = getScheduleForDate(selectedDate);
    const dayStartMinutes = daySchedule?.hours?.start != null ? daySchedule.hours.start * 60 : 8.5 * 60;

    const cursorStart = (() => {
      const base = isViewingToday
        ? Math.max(dayStartMinutes, (currentTime?.minutes || dayStartMinutes) + 5)
        : dayStartMinutes;
      return Math.ceil(base / 5) * 5;
    })();

    let cursor = cursorStart;
    const currentMinutes = currentTime?.minutes ?? dayStartMinutes;

    rescheduledBlocks = dayTasks.map((t, idx) => {
      const duration = t.estimated_duration || 30;
      const startMinutes = cursor;
      const endMinutes = startMinutes + duration;
      cursor = endMinutes + 5;

      return {
        id: `${t.id}-fallback-block-${idx + 1}`,
        taskId: t.id,
        task: t,
        taskType: t.task_type || t.taskType,
        priority: t.priority || 'normal',
        quadrant: t.quadrant,
        title: t.title,
        duration,
        startTime: minutesToTimeStr(startMinutes),
        endTime: minutesToTimeStr(endMinutes),
        startMinute: startMinutes,
        endMinute: endMinutes,
        totalBlocks: 1,
        blockIndex: idx + 1,
        isRunning: isTimerRunning?.(t.id) || false,
        // אם הבלוק נסגר לפני הזמן הנוכחי – נשים אותו ב"נדחו"
        isPostponed: endMinutes < currentMinutes,
        isRescheduled: false,
        isCompleted: false,
        isFromGoogle: false
      };
    });
  }
  
  const overdueBlocks = rescheduledBlocks.filter(b => b.isPostponed);
  const upcomingBlocks = rescheduledBlocks.filter(b => !b.isPostponed);

  const renderDraggableCard = (block, index, blocksArray) => {
    const isFromGoogle = block.isFromGoogle || block.is_from_google || block.task?.is_from_google || block.isGoogleEvent;
    const isBreakBlock = block.isBreak || block.blockType === 'break' || block.taskType === 'break';

    if (isBreakBlock) {
      return (
        <motion.div
          key={block.id || `break-${index}`}
          layout
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-3"
        >
          <div className="flex items-center justify-between">
            <div className="font-medium text-amber-800 dark:text-amber-200">☕ הפסקה</div>
            <div className="text-sm text-amber-700 dark:text-amber-300">
              {block.startTime} - {block.endTime} ({block.duration || 5} דק׳)
            </div>
          </div>
        </motion.div>
      );
    }
    
    return (
    <motion.div
      key={block.id || block.taskId || `block-${index}`}
      id={`task-${block.taskId || block.id}`}
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ 
        opacity: draggedIndex === index ? 0.5 : 1, 
        y: 0,
        scale: dragOverIndex === index ? 1.02 : 1
      }}
      className={`
        relative
        ${dragOverIndex === index ? 'ring-2 ring-blue-500 ring-dashed rounded-xl' : ''}
        ${isFromGoogle ? 'ring-1 ring-purple-400 bg-purple-50 dark:bg-purple-900/20' : ''}
        ${highlightedTaskId === (block.taskId || block.id) ? 'ring-2 ring-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 animate-pulse' : ''}
      `}
      draggable={!isFromGoogle}
      onDragStart={(e) => !isFromGoogle && handleReorderDragStart(e, index)}
      onDragEnd={handleReorderDragEnd}
      onDragOver={(e) => handleReorderDragOver(e, index)}
      onDrop={(e) => handleReorderDrop(e, index, blocksArray)}
    >
      {dragOverIndex === index && draggedIndex !== null && draggedIndex < index && (
        <div className="absolute -top-1 left-0 right-0 h-1 bg-blue-500 rounded-full z-10" />
      )}
      {dragOverIndex === index && draggedIndex !== null && draggedIndex > index && (
        <div className="absolute -bottom-1 left-0 right-0 h-1 bg-blue-500 rounded-full z-10" />
      )}

      {isFromGoogle && (
        <div className="absolute left-2 top-2 z-20">
          <span className="text-xs bg-purple-200 dark:bg-purple-700 text-purple-700 dark:text-purple-200 px-1.5 py-0.5 rounded-full font-medium">
            📅 גוגל (קבוע)
          </span>
        </div>
      )}

      {!isFromGoogle && (
      <div className="absolute right-1 top-1/2 -translate-y-1/2 z-20 opacity-30 hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing p-1">
        <div className="flex flex-col gap-0.5">
          <div className="w-4 h-0.5 bg-gray-400 rounded"></div>
          <div className="w-4 h-0.5 bg-gray-400 rounded"></div>
          <div className="w-4 h-0.5 bg-gray-400 rounded"></div>
        </div>
      </div>
      )}

      <DailyTaskCard 
        task={(() => {
          // ✅ תיקון מלא: קבלת כל הנתונים מהמשימה המקורית ב-DB
          const taskId = block.taskId || block.id;
          const originalTask = tasks.find(t => t.id === taskId);
          
          return {
            id: taskId,
            title: originalTask?.title || block.title,
            estimated_duration: originalTask?.estimated_duration || block.duration || block.estimated_duration,
            time_spent: originalTask?.time_spent || block.timeSpent || 0,
            is_completed: originalTask?.is_completed || block.isCompleted,
            task_type: originalTask?.task_type || block.taskType || block.task?.task_type,
            due_time: originalTask?.due_time || block.task?.due_time,
            due_date: originalTask?.due_date || block.task?.due_date,
            priority: originalTask?.priority || block.priority || 'normal',
            quadrant: originalTask?.quadrant || block.quadrant,
            description: originalTask?.description || block.description,
            parent_task_id: originalTask?.parent_task_id || block.parentId,
            // נתוני התצוגה (מחושבים)
            blockIndex: block.blockIndex,
            totalBlocks: block.totalBlocks,
            startTime: block.startTime,
            endTime: block.endTime,
            originalStartTime: block.originalStartTime,
            originalEndTime: block.originalEndTime,
            isPostponed: block.isPostponed,
            isRescheduled: block.isRescheduled,
            isRunning: block.isRunning
          };
        })()} 
        onEdit={() => handleEditTask(block)}
        onUpdate={loadTasks}
        showTime={true}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        draggable={false}
      />
    </motion.div>
  );
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-2 sm:px-4 overflow-x-hidden">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div className="flex items-center justify-between mb-4">
          {isGoogleConnected && (
            <div className="flex items-center gap-2 px-3 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg text-sm">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <span>יומן מסונכרן</span>
              {isGoogleSyncing && (
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-green-600" />
              )}
            </div>
          )}
          
          {!isToday(selectedDate) && (
            <button
              onClick={goToToday}
              className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              חזרה להיום
            </button>
          )}
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={goToPreviousDay}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-2xl"
            title="היום הקודם"
          >
            ▶
          </button>
          
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {getDateHebrew(selectedDate).full}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {getHebrewDate(selectedDate)}
            </p>
            {isToday(selectedDate) && (
              <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded-full">
                היום
              </span>
            )}
          </div>
          
          <button
            onClick={goToNextDay}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-2xl"
            title="היום הבא"
          >
            ◀
          </button>
        </div>
        
        <div className="flex items-center justify-center gap-2 mt-2">
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {(() => {
              const schedule = getScheduleForDate(selectedDate);
              const effective = getEffectiveHoursForDate(selectedDate, schedule);
              return (
                <>
                  {schedule.label}: {effective.startStr || schedule.startStr} - {effective.endStr || schedule.endStr}
                  {effective.hasOverride && (
                    <span className="text-purple-500 mr-1"> (מותאם)</span>
                  )}
                </>
              );
            })()}
          </p>
          <DayOverrideButton 
            date={selectedDate}
            currentSchedule={getScheduleForDate(selectedDate)}
            onScheduleChange={() => {
              setScheduleRefresh(prev => prev + 1);
              loadTasks();
            }}
          />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card p-4 mb-6"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⏱️</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {isToday(selectedDate) ? 'זמן פנוי' : 'זמן מתוכנן'}: {formatMinutes(timeStats.remaining)}
            </span>
          </div>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {isViewingToday && `נותרו ${formatMinutes(timeStats.minutesLeftInDay)} עד סוף היום`}
          </span>
        </div>
        
        <div className="w-full h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div className="h-full flex">
            <div 
              className="bg-green-500 transition-all duration-500"
              style={{ width: `${(timeStats.completed / timeStats.total) * 100}%` }}
              title={`הושלם: ${formatMinutes(timeStats.completed)}`}
            />
            <div 
              className="bg-orange-500 transition-all duration-500"
              style={{ width: `${(timeStats.pending / timeStats.total) * 100}%` }}
              title={`ממתין: ${formatMinutes(timeStats.pending)}`}
            />
          </div>
        </div>
        
        <div className="flex items-center gap-4 mt-2 text-xs text-gray-600 dark:text-gray-400 flex-wrap">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span>הושלם ({formatMinutes(timeStats.completed)})</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-orange-500 rounded"></div>
            <span>ממתין ({formatMinutes(timeStats.pending)})</span>
          </div>
          {timeStats.overdue > 0 && (
            <div className="flex items-center gap-1 text-orange-600">
              <span>🔄 נדחה: {formatMinutes(timeStats.overdue)}</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-gray-300 dark:bg-gray-600 rounded"></div>
            <span>פנוי ({formatMinutes(timeStats.remaining)})</span>
          </div>
        </div>

        {rescheduleInfo && rescheduleInfo.tasksToMoveToTomorrow.length > 0 && (
          <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-700">
            <div className="text-red-700 dark:text-red-400 text-sm font-medium mb-2">
              ⚠️ לא יספיק! צריך {formatMinutes(rescheduleInfo.timeNeededToday + rescheduleInfo.tasksToMoveToTomorrow.reduce((sum, t) => sum + (t.estimated_duration || 30), 0))} אבל נשארו רק {formatMinutes(rescheduleInfo.remainingWorkToday)} ב{getScheduleForDate(selectedDate).label}
            </div>
            
            <div className="text-xs text-red-600 dark:text-red-300 mb-2">
              <p className="font-medium mb-1">📋 משימות שיועברו למחר:</p>
              <ul className="list-disc list-inside space-y-1 mr-2">
                {rescheduleInfo.tasksToMoveToTomorrow.slice(0, 3).map(task => (
                  <li key={task.id}>{task.title} ({task.estimated_duration || 30} דק')</li>
                ))}
                {rescheduleInfo.tasksToMoveToTomorrow.length > 3 && (
                  <li>ועוד {rescheduleInfo.tasksToMoveToTomorrow.length - 3} משימות...</li>
                )}
              </ul>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={handleAutoReschedule}
                disabled={isAutoRescheduling}
                className="flex-1 py-2 text-sm font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isAutoRescheduling ? (
                  <>⏳ מעביר...</>
                ) : (
                  <>🚀 העבר אוטומטית למחר ({rescheduleInfo.tasksToMoveToTomorrow.length})</>
                )}
              </button>
              <button
                onClick={() => setShowRescheduleModal(true)}
                className="px-3 py-2 text-sm font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                בחירה ידנית
              </button>
            </div>
          </div>
        )}
        
        {/* ✅ חדש: התראה על משימות שחורגות מסוף היום */}
        {rescheduleInfo && rescheduleInfo.tasksOverflowingEndOfDay && rescheduleInfo.tasksOverflowingEndOfDay.length > 0 && (
          <div className="mt-3 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-700">
            <div className="text-orange-700 dark:text-orange-400 text-sm font-medium mb-2">
              ⏰ {rescheduleInfo.tasksOverflowingEndOfDay.length} משימות חורגות מ-{getScheduleForDate(selectedDate).endStr}!
            </div>
            
            <div className="text-xs text-orange-600 dark:text-orange-300 mb-2">
              <ul className="space-y-1">
                {rescheduleInfo.tasksOverflowingEndOfDay.map(task => (
                  <li key={task.id} className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded text-xs ${
                      task.priority === 'urgent' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {task.priority === 'urgent' ? 'דחוף' : 'רגיל'}
                    </span>
                    <span>{task.title}</span>
                    <span className="text-orange-500">
                      (+{task.overflowMinutes} דק' אחרי {getScheduleForDate(selectedDate).endStr})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="text-xs text-orange-500 dark:text-orange-400 mt-2">
              💡 אפשרויות: לעבוד שעות נוספות, להעביר למחר, או לבטל משימה
            </div>
          </div>
        )}

        {rescheduleInfo && rescheduleInfo.tasksToMoveToToday.length > 0 && rescheduleInfo.tasksToMoveToTomorrow.length === 0 && (
          <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-700">
            <div className="text-green-700 dark:text-green-400 text-sm font-medium mb-2">
              ✨ יש מקום! {formatMinutes(rescheduleInfo.freeTimeToday)} פנויות - אפשר למשוך משימות ממחר
            </div>
            
            <div className="text-xs text-green-600 dark:text-green-300 mb-2">
              <p className="font-medium mb-1">📋 משימות שאפשר להקדים:</p>
              <ul className="list-disc list-inside space-y-1 mr-2">
                {rescheduleInfo.tasksToMoveToToday.slice(0, 3).map(task => (
                  <li key={task.id}>{task.title} ({task.estimated_duration || 30} דק')</li>
                ))}
              </ul>
            </div>
            
            <button
              onClick={handleAutoReschedule}
              disabled={isAutoRescheduling}
              className="w-full py-2 text-sm font-medium bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isAutoRescheduling ? (
                <>⏳ מושך...</>
              ) : (
                <>📥 משוך להיום ({rescheduleInfo.tasksToMoveToToday.length})</>
              )}
            </button>
          </div>
        )}
      </motion.div>

      {/* ⚠️ התראות על בעיות בלוח הזמנים */}
      {(scheduleWarnings.overlaps.length > 0 || scheduleWarnings.overflows.length > 0) && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-4 space-y-2"
        >
          {/* התראה על חפיפות */}
          {scheduleWarnings.overlaps.length > 0 && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-700">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-medium text-sm mb-2">
                <span>⚠️</span>
                <span>
                  {scheduleWarnings.overlaps.length === 1 
                    ? 'נמצאה חפיפה בין משימות!' 
                    : `נמצאו ${scheduleWarnings.overlaps.length} חפיפות בין משימות!`
                  }
                </span>
              </div>
              <div className="text-xs text-red-600 dark:text-red-300 space-y-1">
                {scheduleWarnings.overlaps.slice(0, 3).map((overlap, i) => (
                  <div key={i}>
                    • "{overlap.task1}" ו-"{overlap.task2}" ({overlap.time})
                  </div>
                ))}
                {scheduleWarnings.overlaps.length > 3 && (
                  <div className="text-red-500">...ועוד {scheduleWarnings.overlaps.length - 3}</div>
                )}
              </div>
              <p className="text-xs text-red-500 dark:text-red-400 mt-2">
                💡 גררי משימות כדי לשנות את הסדר
              </p>
            </div>
          )}
          
          {/* התראה על חריגות מסוף היום */}
          {scheduleWarnings.overflows.length > 0 && (
            <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-700">
              <div className="flex items-center gap-2 text-orange-700 dark:text-orange-400 font-medium text-sm mb-2">
                <span>⏰</span>
                <span>
                  {scheduleWarnings.overflows.length === 1 
                    ? 'משימה אחת חורגת מסוף היום!' 
                    : `${scheduleWarnings.overflows.length} משימות חורגות מסוף היום!`
                  }
                </span>
              </div>
              <div className="text-xs text-orange-600 dark:text-orange-300 space-y-1">
                {scheduleWarnings.overflows.slice(0, 3).map((overflow, i) => (
                  <div key={i}>
                    • "{overflow.title}" (+{overflow.overflowMinutes} דק')
                  </div>
                ))}
              </div>
              <p className="text-xs text-orange-500 dark:text-orange-400 mt-2">
                💡 העבירי משימות למחר או הארכי את יום העבודה
              </p>
            </div>
          )}
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mb-4 space-y-2"
      >
        <Button onClick={handleAddTask} className="w-full py-3 text-lg">
          + משימה חדשה
        </Button>
        
        {/* ✅ חדש: כפתור סידור חכם */}
        {rescheduledBlocks.length > 0 && (
          <Button 
            onClick={handleSmartReschedule}
            loading={isRescheduling}
            variant="secondary"
            className="w-full py-2 text-sm"
          >
            🎯 סדר משימות חכם (תמלול=בוקר, הגהות=אחה"צ)
          </Button>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="flex gap-4"
      >
        {rescheduledBlocks.length > 0 && (
          <div 
            ref={timelineRef}
            className={`
              w-16 flex-shrink-0 rounded-lg border-2 border-dashed transition-all
              ${dragOverTime 
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50'
              }
            `}
            onDragOver={handleDragOverTimeline}
            onDragLeave={() => setDragOverTime(null)}
            onDrop={handleDropOnTimeline}
          >
            <div className="h-full flex flex-col justify-between py-2 text-xs text-gray-500 dark:text-gray-400">
              {(() => {
                const schedule = getScheduleForDate(selectedDate);
                const startHour = schedule.hours.start;
                const endHour = schedule.hours.end;
                const totalHours = endHour - startHour;
                const step = totalHours / 4; // 4 נקודות ביניים
                const times = [];
                for (let i = 0; i <= 4; i++) {
                  const hour = startHour + (step * i);
                  const h = Math.floor(hour);
                  const m = Math.round((hour - h) * 60);
                  times.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
                }
                return times.map((time, i) => (
                  <span key={i} className="text-center">{time}</span>
                ));
              })()}
            </div>
            
            {dragOverTime && (
              <div className="absolute left-0 right-0 bg-blue-500 text-white text-xs py-1 px-2 rounded text-center font-medium">
                {dragOverTime}
              </div>
            )}
          </div>
        )}

        <div className="flex-1 space-y-3">
        {rescheduledBlocks.length === 0 ? (
          <div className="card p-8 text-center">
            <span className="text-4xl mb-4 block">📝</span>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              אין משימות ל{isToday(selectedDate) ? 'היום' : 'תאריך זה'}
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              הוסיפי משימה חדשה להתחיל
            </p>
          </div>
        ) : (
          <>
            {overdueBlocks.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-orange-600 dark:text-orange-400 mb-2 flex items-center gap-2">
                  🔄 נדחו ({overdueBlocks.length}) - זמנים מעודכנים
                </h3>
                <div className="space-y-2 border-r-4 border-orange-400 pr-2">
                  {overdueBlocks.map((block, index) => renderDraggableCard(block, index, overdueBlocks))}
                </div>
              </div>
            )}

            {upcomingBlocks.length > 0 && (
              <div className="mb-4">
                {overdueBlocks.length > 0 && (
                  <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                    📋 ממתינות ({upcomingBlocks.length})
                  </h3>
                )}
                <div className="space-y-2">
                  {upcomingBlocks.map((block, index) => renderDraggableCard(block, index, upcomingBlocks))}
                </div>
                
                {upcomingBlocks.length > 1 && (
                  <p className="text-xs text-gray-400 text-center mt-3">
                    💡 גררי משימה כדי לשנות את הסדר
                  </p>
                )}
              </div>
            )}
            
            {completedBlocks.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                  ✅ הושלמו ({completedBlocks.length})
                </h3>
                <div className="space-y-2 opacity-60">
                  {completedBlocks.map((block, index) => (
                    <DailyTaskCard 
                      key={block.id || `completed-${index}`} 
                      task={{
                        id: block.taskId || block.id,
                        title: block.title,
                        estimated_duration: block.duration,
                        time_spent: block.timeSpent || 0,
                        is_completed: true,
                        task_type: block.taskType,
                        due_time: block.task?.due_time || block.startTime, // 🔧 תיקון
                        startTime: block.startTime,
                        endTime: block.endTime
                      }} 
                      onEdit={() => handleEditTask(block)}
                      onUpdate={loadTasks}
                      showTime={true}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        </div>
      </motion.div>

      <Modal
        isOpen={showTaskForm}
        onClose={handleCloseForm}
        title={editingTask ? 'עריכת משימה' : 'משימה חדשה'}
      >
        <SimpleTaskForm
          key={editingTask?.id || 'new-task'}
          task={editingTask}
          onClose={handleCloseForm}
          taskTypes={TASK_TYPES}
          defaultDate={getDateISO(selectedDate)}
        />
      </Modal>
      
      <RescheduleModal
        isOpen={showRescheduleModal}
        onClose={() => {
          setShowRescheduleModal(false);
          loadTasks();
        }}
        overdueBlocks={overdueBlocks}
        allBlocks={rescheduledBlocks}
        selectedDate={selectedDate}
      />
      
      {showGoogleMenu && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowGoogleMenu(false)}
        />
      )}
    </div>
  );
}

export default DailyView;
