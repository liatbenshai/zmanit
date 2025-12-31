import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTasks } from '../../hooks/useTasks';
import { useAuth } from '../../hooks/useAuth';
import { smartScheduleWeek } from '../../utils/smartScheduler';
import SimpleTaskForm from './SimpleTaskForm';
import DailyTaskCard from './DailyTaskCard';
import RescheduleModal from './RescheduleModal';
import Modal from '../UI/Modal';
import Button from '../UI/Button';
import { sortTasksByOrder, saveTaskOrder } from '../../utils/taskOrder';
import { calculateAutoReschedule, executeAutoReschedule } from '../../utils/autoRescheduleDaily';
import toast from 'react-hot-toast';

// ===============================
// Drag & Drop State
// ===============================
let draggedTaskData = null;

/**
 * סוגי משימות מוגדרים - כולם לפי זמן
 */
export const TASK_TYPES = {
  transcription: { 
    id: 'transcription', 
    name: 'תמלול', 
    icon: '🎙️',
    defaultDuration: 60,
    category: 'work'
  },
  proofreading: { 
    id: 'proofreading', 
    name: 'הגהה', 
    icon: '📝',
    defaultDuration: 45,
    category: 'work'
  },
  email: { 
    id: 'email', 
    name: 'מיילים', 
    icon: '📧',
    defaultDuration: 25,
    category: 'work'
  },
  course: { 
    id: 'course', 
    name: 'קורס התמלול', 
    icon: '📚',
    defaultDuration: 90,
    category: 'venture'
  },
  client_communication: { 
    id: 'client_communication', 
    name: 'לקוחות', 
    icon: '💬',
    defaultDuration: 30,
    category: 'work'
  },
  management: { 
    id: 'management', 
    name: 'ניהול', 
    icon: '👔',
    defaultDuration: 45,
    category: 'work'
  },
  family: { 
    id: 'family', 
    name: 'משפחה', 
    icon: '👨‍👩‍👧‍👦',
    defaultDuration: 60,
    category: 'family'
  },
  kids: { 
    id: 'kids', 
    name: 'ילדים', 
    icon: '🧒',
    defaultDuration: 30,
    category: 'family'
  },
  personal: { 
    id: 'personal', 
    name: 'זמן אישי', 
    icon: '🧘',
    defaultDuration: 30,
    category: 'personal'
  },
  unexpected: { 
    id: 'unexpected', 
    name: 'בלת"מים', 
    icon: '⚡',
    defaultDuration: 30,
    category: 'work'
  },
  other: { 
    id: 'other', 
    name: 'אחר', 
    icon: '📋',
    defaultDuration: 30,
    category: 'work'
  }
};

/**
 * שעות עבודה קבועות
 */
const WORK_HOURS = {
  start: 8.5, // 08:30
  end: 16.25,  // 16:15
  totalMinutes: 7.75 * 60 // 465 דקות
};

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

/**
 * תצוגת יום עבודה - מסך ראשי חדש
 * ✅ כולל גרירה לשינוי סדר משימות
 */
function DailyView() {
  const { user } = useAuth();
  const { tasks, loading, error, loadTasks, editTask } = useTasks();
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [dragOverTime, setDragOverTime] = useState(null);
  const [taskOrder, setTaskOrder] = useState([]); // ✅ סדר משימות מותאם
  const timelineRef = useRef(null);
  
  // ✅ גרירה לשינוי סדר
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  
  // שעה נוכחית
  const [currentTime, setCurrentTime] = useState(() => {
    const now = new Date();
    return {
      minutes: now.getHours() * 60 + now.getMinutes(),
      dateISO: getDateISO(now)
    };
  });
  
  // ✅ דחייה אוטומטית
  const [rescheduleInfo, setRescheduleInfo] = useState(null);
  const [isAutoRescheduling, setIsAutoRescheduling] = useState(false);
  
  // עדכון השעה כל דקה
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setCurrentTime({
        minutes: now.getHours() * 60 + now.getMinutes(),
        dateISO: getDateISO(now)
      });
    }, 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  // ✅ חישוב דחייה אוטומטית
  useEffect(() => {
    if (!tasks || tasks.length === 0) {
      setRescheduleInfo(null);
      return;
    }
    
    // רק אם צופים בהיום
    const todayISO = getDateISO(new Date());
    if (getDateISO(selectedDate) !== todayISO) {
      setRescheduleInfo(null);
      return;
    }
    
    const info = calculateAutoReschedule(tasks, editTask);
    setRescheduleInfo(info);
    
    console.log('📊 Auto-reschedule info:', {
      remainingToday: info.remainingToday,
      timeNeededToday: info.timeNeededToday,
      freeTimeToday: info.freeTimeToday,
      toMoveToTomorrow: info.tasksToMoveToTomorrow.length,
      toMoveToToday: info.tasksToMoveToToday.length
    });
  }, [tasks, selectedDate, currentTime.minutes]);

  // ✅ ביצוע דחייה אוטומטית
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

  // ניווט בין ימים
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

  // חישוב תוכנית שבועית עם smartScheduler
  const weekPlan = useMemo(() => {
    if (!tasks || tasks.length === 0) return null;
    const weekStart = getWeekStart(selectedDate);
    console.log('📅 DailyView: Computing week plan from', getDateISO(weekStart));
    return smartScheduleWeek(weekStart, tasks);
  }, [tasks, selectedDate]);

  // קבלת הבלוקים ליום הנבחר מתוך התוכנית השבועית
  const selectedDayData = useMemo(() => {
    if (!weekPlan) return { blocks: [], tasks: [] };
    
    const dateISO = getDateISO(selectedDate);
    const dayPlan = weekPlan.days.find(d => d.date === dateISO);
    
    if (!dayPlan) {
      console.log('📅 No plan found for', dateISO);
      return { blocks: [], tasks: [] };
    }
    
    console.log('📅 Day plan for', dateISO, ':', dayPlan.blocks?.length || 0, 'blocks');
    return {
      blocks: dayPlan.blocks || [],
      usagePercent: dayPlan.usagePercent || 0,
      plannedMinutes: dayPlan.plannedMinutes || 0,
      completedMinutes: dayPlan.completedMinutes || 0
    };
  }, [weekPlan, selectedDate]);

  // חישוב זמנים
  const isViewingToday = getDateISO(selectedDate) === currentTime.dateISO;
  
  const timeStats = useMemo(() => {
    const blocks = selectedDayData.blocks || [];
    
    // ✅ בדיקה אם יש טיימר פעיל
    const checkTimerRunning = (block) => {
      const taskId = block.taskId || block.task?.id || block.id;
      if (!taskId) return false;
      try {
        const timerData = localStorage.getItem(`timer_v2_${taskId}`);
        if (timerData) {
          const parsed = JSON.parse(timerData);
          return parsed.isRunning && !parsed.isInterrupted;
        }
      } catch (e) {}
      return false;
    };
    
    const blockHasPassed = (block) => {
      if (!isViewingToday) return false;
      if (!block.endTime) return false;
      // ✅ אם טיימר פעיל - לא עבר!
      if (checkTimerRunning(block)) return false;
      const [hour, min] = block.endTime.split(':').map(Number);
      return (hour * 60 + (min || 0)) < currentTime.minutes;
    };
    
    const completedMinutes = blocks
      .filter(b => b.isCompleted)
      .reduce((sum, b) => sum + (b.duration || 0), 0);
    
    const pendingMinutes = blocks
      .filter(b => !b.isCompleted)
      .reduce((sum, b) => sum + (b.duration || 0), 0);
    
    // ✅ משימות באיחור - לא כולל משימות עם טיימר פעיל!
    const overdueMinutes = blocks
      .filter(b => !b.isCompleted && blockHasPassed(b))
      .reduce((sum, b) => sum + (b.duration || 0), 0);
    
    const inProgressMinutes = blocks
      .filter(b => !b.isCompleted && b.timeSpent > 0)
      .reduce((sum, b) => sum + (b.timeSpent || 0), 0);
    
    const endOfDayMinutes = WORK_HOURS.end * 60;
    const minutesLeftInDay = isViewingToday 
      ? Math.max(0, endOfDayMinutes - currentTime.minutes)
      : WORK_HOURS.totalMinutes;
    
    const freeMinutes = Math.max(0, minutesLeftInDay - pendingMinutes + inProgressMinutes);
    
    return {
      completed: completedMinutes,
      pending: pendingMinutes,
      overdue: overdueMinutes,
      inProgress: inProgressMinutes,
      remaining: freeMinutes,
      minutesLeftInDay: minutesLeftInDay,
      total: WORK_HOURS.totalMinutes,
      usedPercent: Math.round((completedMinutes / WORK_HOURS.totalMinutes) * 100),
      canFitAll: pendingMinutes <= minutesLeftInDay
    };
  }, [selectedDayData, isViewingToday, currentTime.minutes]);

  // handlers
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

  // ===============================
  // Drag & Drop to Timeline (קיים)
  // ===============================
  
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
      await editTask(draggedTaskData.id, {
        due_time: dragOverTime,
        due_date: getDateISO(selectedDate)
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

  // ===============================
  // ✅ Drag & Drop לשינוי סדר (חדש!)
  // ===============================
  
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

  const handleReorderDrop = (e, toIndex, blocksArray) => {
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
    
    // שמירה ב-localStorage
    const dateISO = getDateISO(selectedDate);
    saveTaskOrder(dateISO, newOrder);
    setTaskOrder(newOrder);
    
    toast.success('🔄 הסדר עודכן');
    
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // טעינה
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // שגיאה
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

  // === סינון וחישוב מחדש של זמנים ===
  
  // ✅ בדיקה אם יש טיימר פעיל על משימה
  const isTimerRunning = (taskId) => {
    if (!taskId) return false;
    try {
      const timerData = localStorage.getItem(`timer_v2_${taskId}`);
      if (timerData) {
        const parsed = JSON.parse(timerData);
        return parsed.isRunning && !parsed.isInterrupted;
      }
    } catch (e) {}
    return false;
  };
  
  // ✅ תיקון: משימה עם טיימר פעיל לא נחשבת "באיחור"!
  const isBlockPast = (block) => {
    if (!isViewingToday) return false;
    
    // ✅ אם יש טיימר פעיל - זה לא איחור, זו עבודה!
    const taskId = block.taskId || block.task?.id || block.id;
    if (isTimerRunning(taskId)) return false;
    
    // רק אם יש למשימה המקורית due_time ספציפי
    const task = block.task;
    if (!task?.due_time) return false;
    
    const [hour, min] = task.due_time.split(':').map(Number);
    const taskDueMinutes = hour * 60 + (min || 0);
    return taskDueMinutes < currentTime.minutes;
  };
  
  const minutesToTime = (totalMinutes) => {
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  };
  
  // מיון בלוקים
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
  
  // משימה עם טיימר פעיל נשארת ראשונה
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
  
  // ✅ מיון לפי סדר שמור (אם יש)
  const dateISO = getDateISO(selectedDate);
  activeBlocks = sortTasksByOrder(activeBlocks.map(b => ({
    ...b,
    id: b.taskId || b.id,
    isRunning: isTimerRunning(b.taskId || b.task?.id || b.id) // ✅ סימון משימה פעילה
  })), dateISO);
  
  // חישוב זמנים מחדש
  let nextStartMinutes = isViewingToday ? currentTime.minutes : WORK_HOURS.start * 60;
  
  const rescheduledBlocks = activeBlocks.map(block => {
    const duration = block.duration || 30;
    const startMinutes = nextStartMinutes;
    const endMinutes = startMinutes + duration;
    const wasPostponed = isBlockPast(block);
    nextStartMinutes = endMinutes + 5;
    
    return {
      ...block,
      originalStartTime: block.startTime,
      originalEndTime: block.endTime,
      startTime: minutesToTime(startMinutes),
      endTime: minutesToTime(endMinutes),
      isPostponed: wasPostponed,
      isRescheduled: wasPostponed
    };
  });
  
  const overdueBlocks = rescheduledBlocks.filter(b => b.isPostponed);
  const upcomingBlocks = rescheduledBlocks.filter(b => !b.isPostponed);

  // ===============================
  // רנדור כרטיס עם גרירה
  // ===============================
  const renderDraggableCard = (block, index, blocksArray) => (
    <motion.div
      key={block.id || block.taskId || `block-${index}`}
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
      `}
      draggable
      onDragStart={(e) => handleReorderDragStart(e, index)}
      onDragEnd={handleReorderDragEnd}
      onDragOver={(e) => handleReorderDragOver(e, index)}
      onDrop={(e) => handleReorderDrop(e, index, blocksArray)}
    >
      {/* אינדיקטור מיקום */}
      {dragOverIndex === index && draggedIndex !== null && draggedIndex < index && (
        <div className="absolute -top-1 left-0 right-0 h-1 bg-blue-500 rounded-full z-10" />
      )}
      {dragOverIndex === index && draggedIndex !== null && draggedIndex > index && (
        <div className="absolute -bottom-1 left-0 right-0 h-1 bg-blue-500 rounded-full z-10" />
      )}

      {/* ידית גרירה */}
      <div className="absolute right-1 top-1/2 -translate-y-1/2 z-20 opacity-30 hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing p-1">
        <div className="flex flex-col gap-0.5">
          <div className="w-4 h-0.5 bg-gray-400 rounded"></div>
          <div className="w-4 h-0.5 bg-gray-400 rounded"></div>
          <div className="w-4 h-0.5 bg-gray-400 rounded"></div>
        </div>
      </div>

      <DailyTaskCard 
        task={{
          id: block.taskId || block.id,
          title: block.title,
          estimated_duration: block.duration,
          time_spent: block.timeSpent || 0,
          is_completed: block.isCompleted,
          task_type: block.taskType,
          due_time: block.startTime,
          priority: block.priority || 'normal',
          blockIndex: block.blockIndex,
          totalBlocks: block.totalBlocks,
          startTime: block.startTime,
          endTime: block.endTime,
          originalStartTime: block.originalStartTime,
          originalEndTime: block.originalEndTime,
          isPostponed: block.isPostponed,
          isRescheduled: block.isRescheduled,
          isRunning: block.isRunning // ✅ טיימר פעיל
        }} 
        onEdit={() => handleEditTask(block)}
        onUpdate={loadTasks}
        showTime={true}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        draggable={false}
      />
    </motion.div>
  );

  return (
    <div className="max-w-4xl mx-auto p-4">
      {/* כותרת עם ניווט */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        {/* כותרת */}
        <div className="flex items-center justify-between mb-4">
          <div></div>
          
          {!isToday(selectedDate) && (
            <button
              onClick={goToToday}
              className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              חזרה להיום
            </button>
          )}
        </div>

        {/* ניווט בין ימים */}
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
        
        <p className="text-center text-gray-500 dark:text-gray-400 mt-2 text-sm">
          שעות עבודה: 08:30 - 16:15
        </p>
      </motion.div>

      {/* סרגל זמן */}
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
        
        {/* סרגל התקדמות */}
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
        
        {/* מקרא */}
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

        {/* אזהרה אם לא יספיק + דחייה אוטומטית */}
        {rescheduleInfo && rescheduleInfo.tasksToMoveToTomorrow.length > 0 && (
          <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-700">
            <div className="text-red-700 dark:text-red-400 text-sm font-medium mb-2">
              ⚠️ לא יספיק! צריך {formatMinutes(rescheduleInfo.timeNeededToday + rescheduleInfo.tasksToMoveToTomorrow.reduce((sum, t) => sum + (t.estimated_duration || 30), 0))} אבל נשארו רק {formatMinutes(rescheduleInfo.remainingToday)} עד 16:15
            </div>
            
            {/* רשימת משימות שיידחו */}
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
            
            {/* כפתורי פעולה */}
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

        {/* הודעה על משיכת משימות ממחר */}
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

      {/* כפתור הוספת משימה */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mb-4"
      >
        <Button onClick={handleAddTask} className="w-full py-3 text-lg">
          + משימה חדשה
        </Button>
      </motion.div>

      {/* רשימת משימות */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="flex gap-4"
      >
        {/* ציר זמן לגרירה לשעה ספציפית */}
        {allBlocks.length > 0 && (
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
              <span className="text-center">08:30</span>
              <span className="text-center">10:00</span>
              <span className="text-center">12:00</span>
              <span className="text-center">14:00</span>
              <span className="text-center">16:15</span>
            </div>
            
            {dragOverTime && (
              <div className="absolute left-0 right-0 bg-blue-500 text-white text-xs py-1 px-2 rounded text-center font-medium">
                {dragOverTime}
              </div>
            )}
          </div>
        )}

        {/* רשימת משימות */}
        <div className="flex-1 space-y-3">
        {allBlocks.length === 0 ? (
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
            {/* משימות שנדחו */}
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

            {/* משימות עתידיות */}
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
                
                {/* הסבר גרירה */}
                {upcomingBlocks.length > 1 && (
                  <p className="text-xs text-gray-400 text-center mt-3">
                    💡 גררי משימה כדי לשנות את הסדר
                  </p>
                )}
              </div>
            )}
            
            {/* משימות שהושלמו */}
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
                        due_time: block.startTime,
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

      {/* מודל טופס */}
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
      
      {/* מודל ארגון מחדש */}
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
    </div>
  );
}

export default DailyView;
