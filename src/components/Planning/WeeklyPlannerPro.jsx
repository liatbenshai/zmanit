/**
 * תצוגה שבועית מקצועית - WeeklyPlannerPro v3
 * ============================================
 * 
 * חדש:
 * - תמיכה מלאה בנייד (תצוגת יום בודד עם החלקה)
 * - קטגוריות מותאמות אישית
 * - שמירת הצעות נדחות
 */

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTasks } from '../../hooks/useTasks';
import { smartScheduleWeekV4 } from '../../utils/smartSchedulerV4';
import { getCategory, getCategoriesArray } from '../../config/taskCategories';
import SimpleTaskForm from '../DailyView/SimpleTaskForm';
import TaskTimerWithInterruptions from '../Tasks/TaskTimerWithInterruptions';
import Modal from '../UI/Modal';
import toast from 'react-hot-toast';
import { supabase } from '../../services/supabase';

// ============================================
// Hook לזיהוי גודל מסך
// ============================================

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  return isMobile;
}

// ============================================
// פונקציית עזר לקטגוריה
// ============================================

const getTaskCategory = (taskType) => {
  return getCategory(taskType) || { icon: '📋', name: 'אחר', color: 'gray' };
};

const formatDuration = (minutes) => {
  if (!minutes || minutes <= 0) return '0 דק\'';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} דק'`;
  if (mins === 0) return `${hours} שעות`;
  return `${hours}:${String(mins).padStart(2, '0')}`;
};

// ============================================
// קומפוננטה ראשית
// ============================================

function WeeklyPlannerPro() {
  const { tasks, loading, loadTasks, toggleComplete, editTask } = useTasks();
  const [weekOffset, setWeekOffset] = useState(0);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedDayForDetail, setSelectedDayForDetail] = useState(null);
  const [timerTask, setTimerTask] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [isBalancing, setIsBalancing] = useState(false);
  
  // ✅ תמיכה בנייד
  const isMobile = useIsMobile();
  const [mobileDayIndex, setMobileDayIndex] = useState(0); // אינדקס היום המוצג בנייד (0-4)
  
  // ✅ טעינת הצעות נדחות מ-localStorage (נשמרות גם אחרי רענון!)
  const [dismissedSuggestions, setDismissedSuggestions] = useState(() => {
    try {
      const saved = localStorage.getItem('zmanit_dismissed_suggestions');
      if (saved) {
        const parsed = JSON.parse(saved);
        // ניקוי הצעות ישנות (יותר משבוע)
        const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        const filtered = parsed.filter(item => item.timestamp > oneWeekAgo);
        return filtered.map(item => item.id);
      }
    } catch (e) {}
    return [];
  });
  
  // ✅ שמירת סיבות דחייה ללמידה
  const [dismissalReasons, setDismissalReasons] = useState(() => {
    try {
      const saved = localStorage.getItem('zmanit_dismissal_reasons');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  
  // גרירה (רק בדסקטופ)
  const [draggedTask, setDraggedTask] = useState(null);
  const [dragOverDay, setDragOverDay] = useState(null);
  
  // ✅ עדכון אינדקס היום בנייד להיום הנוכחי
  useEffect(() => {
    if (isMobile && weekOffset === 0) {
      const today = new Date().getDay(); // 0=ראשון
      if (today >= 0 && today <= 4) {
        setMobileDayIndex(today);
      }
    }
  }, [isMobile, weekOffset]);

  // חישוב תחילת השבוע
  const weekStart = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const date = new Date(today);
    date.setDate(today.getDate() - dayOfWeek + (weekOffset * 7));
    date.setHours(0, 0, 0, 0);
    return date;
  }, [weekOffset]);

  const todayStr = new Date().toISOString().split('T')[0];

  // תכנון שבועי
  const plan = useMemo(() => {
    if (!tasks) return null;
    return smartScheduleWeekV4(weekStart, tasks);
  }, [tasks, weekStart]);

  // יצירת הצעות חכמות עם אפשרויות
  const smartSuggestions = useMemo(() => {
    if (!plan) return [];
    return generateInteractiveSuggestions(plan, tasks, dismissedSuggestions);
  }, [plan, tasks, dismissedSuggestions]);

  // ניווט
  const goToPrevWeek = () => setWeekOffset(w => w - 1);
  const goToNextWeek = () => setWeekOffset(w => w + 1);
  const goToThisWeek = () => setWeekOffset(0);
  const isToday = (dateStr) => dateStr === todayStr;

  // ============================================
  // גרירה והעברה
  // ============================================
  
  const handleDragStart = (task, block) => {
    if (block?.isGoogleEvent || block?.isFixed) {
      toast.error('❌ אירועי גוגל לא ניתנים להזזה');
      return;
    }
    setDraggedTask({ task, block });
  };

  const handleDragOver = (e, dayDate) => {
    e.preventDefault();
    if (draggedTask) {
      // ✅ בדיקה אם היום אחרי הדדליין
      const task = draggedTask.task;
      if (task?.due_date && dayDate > task.due_date) {
        e.dataTransfer.dropEffect = 'none'; // לא ניתן לשחרר
      } else {
        e.dataTransfer.dropEffect = 'move';
      }
      setDragOverDay(dayDate);
    }
  };

  const handleDragLeave = () => {
    setDragOverDay(null);
  };

  const handleDrop = async (targetDayDate) => {
    if (!draggedTask) return;
    
    const { task } = draggedTask;
    
    if (task.due_date === targetDayDate) {
      toast('המשימה כבר ביום הזה', { icon: 'ℹ️' });
      setDraggedTask(null);
      setDragOverDay(null);
      return;
    }
    
    // ✅ בדיקת דדליין - אזהרה אם גוררים לאחר הדדליין
    if (task.due_date && targetDayDate > task.due_date) {
      const targetDay = plan.days.find(d => d.date === targetDayDate);
      const dueDate = new Date(task.due_date + 'T12:00:00').toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
      
      toast.error(`⚠️ אי אפשר להעביר ל-${targetDay?.dayName || targetDayDate} - הדדליין הוא ${dueDate}!`, {
        duration: 4000
      });
      setDraggedTask(null);
      setDragOverDay(null);
      return;
    }
    
    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          due_date: targetDayDate,
          due_time: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', task.id);
      
      if (error) throw error;
      
      const targetDay = plan.days.find(d => d.date === targetDayDate);
      toast.success(`✅ "${task.title}" הועבר ליום ${targetDay?.dayName || targetDayDate}`);
      loadTasks();
    } catch (err) {
      toast.error('שגיאה בהעברת המשימה');
    } finally {
      setDraggedTask(null);
      setDragOverDay(null);
    }
  };

  // ============================================
  // יישום אפשרות מהצעה
  // ============================================
  
  const applyOption = async (suggestion, option) => {
    try {
      if (option.type === 'move') {
        const { error } = await supabase
          .from('tasks')
          .update({
            due_date: option.toDate,
            due_time: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', option.taskId);
        
        if (error) throw error;
        toast.success(`✅ "${option.taskTitle}" הועבר ליום ${option.toDayName}`);
        
      } else if (option.type === 'split') {
        // פיצול משימה - כאן יהיה לוגיקה מורכבת יותר
        toast.success('המשימה פוצלה');
        
      } else if (option.type === 'extend_day') {
        toast('⚙️ ניתן לשנות שעות עבודה בהגדרות', { duration: 4000 });
        return;
      }
      
      loadTasks();
    } catch (err) {
      toast.error('שגיאה ביישום השינוי');
    }
  };

  const dismissSuggestion = (suggestionId, reason = null) => {
    // ✅ שמירה עם timestamp ל-localStorage
    const newDismissed = [...dismissedSuggestions, suggestionId];
    setDismissedSuggestions(newDismissed);
    
    try {
      const savedData = JSON.parse(localStorage.getItem('zmanit_dismissed_suggestions') || '[]');
      savedData.push({ id: suggestionId, timestamp: Date.now() });
      localStorage.setItem('zmanit_dismissed_suggestions', JSON.stringify(savedData));
    } catch (e) {}
    
    // ✅ שמירת סיבת דחייה ללמידה
    if (reason) {
      const newReasons = [...dismissalReasons, { 
        id: suggestionId, 
        reason, 
        timestamp: Date.now(),
        weekStart: plan?.weekStart 
      }];
      setDismissalReasons(newReasons);
      
      try {
        localStorage.setItem('zmanit_dismissal_reasons', JSON.stringify(newReasons));
      } catch (e) {}
      
      toast('תודה על המשוב! המערכת תלמד מזה 📝', { duration: 2000 });
    } else {
      toast('ההצעה נדחתה ולא תופיע שוב השבוע', { duration: 2000 });
    }
  };

  // ============================================
  // איזון אוטומטי
  // ============================================
  
  const handleAutoBalance = async () => {
    if (!plan) return;
    
    setIsBalancing(true);
    
    try {
      const moves = calculateAutoBalance(plan, tasks);
      
      if (moves.length === 0) {
        toast.success('✨ לוח הזמנים כבר מאוזן!');
        setIsBalancing(false);
        return;
      }
      
      for (const move of moves) {
        await supabase
          .from('tasks')
          .update({
            due_date: move.toDate,
            due_time: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', move.taskId);
      }
      
      toast.success(`⚖️ ${moves.length} משימות אוזנו בהצלחה!`);
      loadTasks();
    } catch (err) {
      toast.error('שגיאה באיזון אוטומטי');
    } finally {
      setIsBalancing(false);
    }
  };

  // ============================================
  // טיפול במשימות
  // ============================================
  
  const handleAddTask = (date = null) => {
    setEditingTask(null);
    setSelectedDate(date);
    setShowTaskForm(true);
  };

  const handleEditTask = (task) => {
    setEditingTask(task);
    setShowTaskForm(true);
  };

  const handleCloseForm = () => {
    setShowTaskForm(false);
    setEditingTask(null);
    setSelectedDate(null);
    loadTasks();
  };

  const handleComplete = async (task) => {
    try {
      await toggleComplete(task.id);
      toast.success('✅ משימה הושלמה!');
    } catch (err) {
      toast.error('שגיאה בעדכון');
    }
  };

  const handleStartTimer = (task) => {
    if (!task) return;
    setTimerTask(task);
  };

  const handleCloseTimer = () => {
    setTimerTask(null);
    loadTasks();
  };

  const formatWeekTitle = () => {
    const endDate = new Date(weekStart);
    endDate.setDate(endDate.getDate() + 6);
    const options = { day: 'numeric', month: 'short' };
    return `${weekStart.toLocaleDateString('he-IL', options)} - ${endDate.toLocaleDateString('he-IL', options)}`;
  };

  // ============================================
  // טעינה
  // ============================================
  
  if (loading || !plan) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  // ============================================
  // רנדור
  // ============================================
  
  return (
    <div className="weekly-planner-pro p-2 md:p-4 max-w-7xl mx-auto">
      
      {/* ===== כותרת וניווט ===== */}
      <div className="mb-4 md:mb-6">
        <div className="flex items-center justify-between mb-3 md:mb-4">
          <h1 className="text-lg md:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            📊 {isMobile ? 'תכנון שבועי' : 'תכנון שבועי חכם'}
          </h1>
          
          <div className="flex items-center gap-1 md:gap-2">
            {/* כפתור איזון - רק בדסקטופ */}
            {!isMobile && (
              <button
                onClick={handleAutoBalance}
                disabled={isBalancing}
                className="px-3 md:px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:from-purple-600 hover:to-blue-600 flex items-center gap-2 disabled:opacity-50 shadow-md text-sm md:text-base"
              >
                {isBalancing ? (
                  <><span className="animate-spin">⏳</span> מאזן...</>
                ) : (
                  <>⚖️ איזון</>
                )}
              </button>
            )}
            
            <button
              onClick={() => setShowSuggestions(!showSuggestions)}
              className={`px-2 md:px-3 py-2 rounded-lg flex items-center gap-1 md:gap-2 transition-colors text-sm ${
                showSuggestions 
                  ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' 
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600'
              }`}
            >
              💡 {!isMobile && 'הצעות'}
              {smartSuggestions.length > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {smartSuggestions.length}
                </span>
              )}
            </button>
            
            {/* כפתור לאיפוס הצעות נדחות */}
            {dismissedSuggestions.length > 0 && !isMobile && (
              <button
                onClick={() => {
                  setDismissedSuggestions([]);
                  localStorage.removeItem('zmanit_dismissed_suggestions');
                  toast.success('ההצעות הנדחות אופסו');
                }}
                className="px-2 py-2 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                title={`${dismissedSuggestions.length} הצעות נדחו`}
              >
                🔄 ({dismissedSuggestions.length})
              </button>
            )}
          </div>
        </div>

        {/* ניווט שבועות */}
        <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-xl p-3 md:p-4 shadow-sm">
          <button onClick={goToPrevWeek} className="p-2 md:p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-lg md:text-xl">▶</button>
          
          <div className="flex items-center gap-2 md:gap-4">
            <span className="font-bold text-base md:text-xl text-gray-900 dark:text-white">{formatWeekTitle()}</span>
            {weekOffset !== 0 && (
              <button onClick={goToThisWeek} className="px-2 md:px-3 py-1 text-xs md:text-sm bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-lg">
                🏠 {isMobile ? '' : 'השבוע'}
              </button>
            )}
          </div>
          
          <button onClick={goToNextWeek} className="p-2 md:p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-lg md:text-xl">◀</button>
        </div>
      </div>

      {/* ===== ניתוח שבועי - מוקטן בנייד ===== */}
      {!isMobile && <WeeklyAnalysis plan={plan} />}
      
      {/* סיכום מהיר בנייד */}
      {isMobile && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-blue-500 text-white rounded-lg p-2 text-center">
            <div className="text-lg font-bold">{plan.summary?.usagePercent || 0}%</div>
            <div className="text-xs text-blue-100">ניצולת</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-2 text-center border">
            <div className="text-lg font-bold text-gray-900 dark:text-white">{formatDuration(plan.summary?.totalScheduledMinutes || 0)}</div>
            <div className="text-xs text-gray-500">מתוכנן</div>
          </div>
          <div className={`rounded-lg p-2 text-center border ${(plan.summary?.unscheduledCount || 0) > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
            <div className={`text-lg font-bold ${(plan.summary?.unscheduledCount || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {plan.summary?.unscheduledCount || 0}
            </div>
            <div className="text-xs text-gray-500">לא משובצות</div>
          </div>
        </div>
      )}

      {/* ===== פאנל הצעות אינטראקטיביות ===== */}
      <AnimatePresence>
        {showSuggestions && smartSuggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 md:mb-6"
          >
            <InteractiveSuggestionsPanel 
              suggestions={smartSuggestions}
              onApplyOption={applyOption}
              onDismiss={dismissSuggestion}
              isMobile={isMobile}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== מקרא - רק בדסקטופ ===== */}
      {!isMobile && (
        <div className="flex items-center gap-6 mb-4 text-sm bg-white dark:bg-gray-800 rounded-lg p-3">
          <span className="flex items-center gap-2">
            <span className="w-4 h-4 rounded bg-purple-500"></span>
            📅 גוגל (קבוע)
          </span>
          <span className="flex items-center gap-2">
            <span className="w-4 h-4 rounded bg-blue-500"></span>
            📝 משימה (ניתן לגרור)
          </span>
          <span className="flex items-center gap-2">
            <span className="w-4 h-4 rounded bg-red-500"></span>
            🔴 דחוף
          </span>
          <span className="flex items-center gap-2">
            <span className="w-4 h-4 rounded bg-green-500"></span>
            ✅ הושלם
          </span>
        </div>
      )}

      {/* ===== תצוגת שבוע ===== */}
      {selectedDayForDetail ? (
        <DayDetailPanel
          day={selectedDayForDetail}
          allDays={plan.days.filter(d => d.dayOfWeek >= 0 && d.dayOfWeek <= 4)}
          onBack={() => setSelectedDayForDetail(null)}
          onAddTask={handleAddTask}
          onEditTask={handleEditTask}
          onComplete={handleComplete}
          onStartTimer={handleStartTimer}
          onSelectDay={setSelectedDayForDetail}
          onDragStart={handleDragStart}
          isMobile={isMobile}
        />
      ) : isMobile ? (
        /* ========== תצוגת נייד - יום בודד עם ניווט ========== */
        <MobileDayView
          days={plan.days.filter(d => d.dayOfWeek >= 0 && d.dayOfWeek <= 4)}
          currentIndex={mobileDayIndex}
          onChangeDay={setMobileDayIndex}
          todayStr={todayStr}
          onAddTask={handleAddTask}
          onEditTask={handleEditTask}
          onComplete={handleComplete}
          onStartTimer={handleStartTimer}
          onSelectDay={setSelectedDayForDetail}
        />
      ) : (
        /* ========== תצוגת דסקטופ - 5 עמודות ========== */
        <div className="grid grid-cols-5 gap-4">
          {plan.days
            .filter(d => d.dayOfWeek >= 0 && d.dayOfWeek <= 4)
            .map((day) => (
            <DayColumn
              key={day.date}
              day={day}
              isToday={isToday(day.date)}
              isDragOver={dragOverDay === day.date}
              draggedTask={draggedTask}
              onAddTask={() => handleAddTask(day.date)}
              onEditTask={handleEditTask}
              onComplete={handleComplete}
              onStartTimer={handleStartTimer}
              onDragStart={handleDragStart}
              onDragOver={(e) => handleDragOver(e, day.date)}
              onDragLeave={handleDragLeave}
              onDrop={() => handleDrop(day.date)}
              onSelectDay={() => setSelectedDayForDetail(day)}
            />
          ))}
        </div>
      )}

      {/* ===== מודלים ===== */}
      <Modal isOpen={showTaskForm} onClose={handleCloseForm} title={editingTask ? 'עריכת משימה' : 'משימה חדשה'}>
        <SimpleTaskForm task={editingTask} onClose={handleCloseForm} defaultDate={selectedDate} />
      </Modal>

      <Modal isOpen={!!timerTask} onClose={handleCloseTimer} title={`⏱️ ${timerTask?.title || 'טיימר'}`} size="lg">
        {timerTask && (
          <TaskTimerWithInterruptions
            task={timerTask}
            onComplete={() => { handleComplete(timerTask); handleCloseTimer(); }}
          />
        )}
      </Modal>
    </div>
  );
}

// ============================================
// ניתוח שבועי
// ============================================

function WeeklyAnalysis({ plan }) {
  // ✅ רק ראשון עד חמישי
  const workDays = plan.days.filter(d => d.isWorkDay && d.dayOfWeek >= 0 && d.dayOfWeek <= 4);
  
  const maxDay = workDays.reduce((max, d) => 
    (d.usagePercent || 0) > (max?.usagePercent || 0) ? d : max, null);
  const minDay = workDays.filter(d => d.usagePercent > 0).reduce((min, d) => 
    (d.usagePercent || 100) < (min?.usagePercent || 100) ? d : min, null);

  return (
    <div className="grid grid-cols-6 gap-4 mb-6">
      <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl p-4 shadow-md">
        <div className="text-3xl font-bold">{plan.summary?.usagePercent || 0}%</div>
        <div className="text-blue-100 text-sm">ניצולת שבועית</div>
        <div className="mt-2 h-2 bg-blue-400 rounded-full overflow-hidden">
          <div className="h-full bg-white rounded-full" style={{ width: `${plan.summary?.usagePercent || 0}%` }} />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="text-2xl font-bold text-gray-900 dark:text-white">
          {formatDuration(plan.summary?.totalScheduledMinutes || 0)}
        </div>
        <div className="text-gray-500 text-sm">זמן מתוכנן</div>
        <div className="mt-1 text-xs text-purple-600">
          📅 {formatDuration(plan.summary?.totalFixedMinutes || 0)} קבוע
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="text-2xl font-bold text-green-600">
          {formatDuration((plan.summary?.totalAvailableMinutes || 0) - (plan.summary?.totalScheduledMinutes || 0))}
        </div>
        <div className="text-gray-500 text-sm">זמן פנוי</div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="text-2xl font-bold text-orange-600">{maxDay?.dayName || '-'}</div>
        <div className="text-gray-500 text-sm">היום העמוס</div>
        <div className="text-xs text-orange-500">{maxDay?.usagePercent || 0}%</div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="text-2xl font-bold text-green-600">{minDay?.dayName || '-'}</div>
        <div className="text-gray-500 text-sm">היום הפנוי</div>
        <div className="text-xs text-green-500">{minDay?.usagePercent || 0}%</div>
      </div>

      <div className={`rounded-xl p-4 shadow-sm border ${
        (plan.summary?.unscheduledCount || 0) > 0 
          ? 'bg-red-50 dark:bg-red-900/20 border-red-200'
          : 'bg-green-50 dark:bg-green-900/20 border-green-200'
      }`}>
        <div className={`text-2xl font-bold ${(plan.summary?.unscheduledCount || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
          {plan.summary?.unscheduledCount || 0}
        </div>
        <div className="text-gray-500 text-sm">לא משובצות</div>
      </div>
    </div>
  );
}

// ============================================
// פאנל הצעות אינטראקטיביות
// ============================================

function InteractiveSuggestionsPanel({ suggestions, onApplyOption, onDismiss, isMobile = false }) {
  const [showRejectReason, setShowRejectReason] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const handleReject = (suggestionId) => {
    if (rejectReason.trim()) {
      onDismiss(suggestionId, rejectReason);
    } else {
      onDismiss(suggestionId);
    }
    setShowRejectReason(null);
    setRejectReason('');
  };

  return (
    <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl p-3 md:p-4 border border-blue-200 dark:border-blue-800">
      <div className="flex items-center justify-between mb-3 md:mb-4">
        <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 text-sm md:text-base">
          💡 הצעות ({suggestions.length})
        </h3>
        <span className="text-xs text-gray-500 hidden md:block">בחרי אפשרות או דחי</span>
      </div>
      
      <div className="space-y-3 md:space-y-4">
        {suggestions.map((suggestion) => (
          <motion.div
            key={suggestion.id}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-800 rounded-xl p-3 md:p-4 shadow-sm"
          >
            {/* כותרת ההצעה */}
            <div className="flex items-start gap-2 md:gap-3 mb-3 md:mb-4">
              <span className="text-2xl md:text-3xl">{suggestion.icon}</span>
              <div className="flex-1">
                <div className="font-bold text-gray-900 dark:text-white text-sm md:text-lg">
                  {suggestion.title}
                </div>
                <div className="text-gray-600 dark:text-gray-400 text-xs md:text-base">
                  {suggestion.description}
                </div>
              </div>
            </div>
            
            {/* אפשרויות לבחירה */}
            <div className="space-y-2 mb-3 md:mb-4">
              {suggestion.options.slice(0, isMobile ? 2 : 4).map((option, idx) => (
                <button
                  key={idx}
                  onClick={() => onApplyOption(suggestion, option)}
                  className={`w-full text-right p-2 md:p-3 rounded-lg border-2 transition-all hover:shadow-md text-sm ${
                    option.recommended 
                      ? 'border-green-400 bg-green-50 dark:bg-green-900/20 hover:border-green-500'
                      : 'border-gray-200 dark:border-gray-600 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg md:text-xl">{option.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 dark:text-white truncate">
                        {option.label}
                        {option.recommended && (
                          <span className="mr-2 px-2 py-0.5 bg-green-500 text-white text-xs rounded-full">
                            מומלץ
                          </span>
                        )}
                      </div>
                      {option.impact && !isMobile && (
                        <div className="text-xs md:text-sm text-gray-500 truncate">{option.impact}</div>
                      )}
                    </div>
                    <span className="text-gray-400">←</span>
                  </div>
                </button>
              ))}
            </div>
            
            {/* כפתור דחייה */}
            {showRejectReason === suggestion.id ? (
              <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 p-2 md:p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <input
                  type="text"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="למה לא מתאים?"
                  className="flex-1 px-3 py-2 border rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleReject(suggestion.id)}
                    className="flex-1 md:flex-none px-3 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg text-sm"
                  >
                    דחה
                  </button>
                  <button
                    onClick={() => { setShowRejectReason(null); setRejectReason(''); }}
                    className="flex-1 md:flex-none px-3 py-2 text-gray-500 text-sm"
                  >
                    ביטול
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowRejectReason(suggestion.id)}
                className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                ❌ לא עכשיו
              </button>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// עמודת יום
// ============================================

function DayColumn({ 
  day, 
  isToday, 
  isDragOver,
  draggedTask,
  onAddTask, 
  onEditTask, 
  onComplete, 
  onStartTimer,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onSelectDay 
}) {
  const blocks = day.blocks || [];
  const googleBlocks = blocks.filter(b => b.isGoogleEvent);
  const regularBlocks = blocks.filter(b => !b.isGoogleEvent && !b.isCompleted);
  const completedBlocks = blocks.filter(b => b.isCompleted);

  // ✅ בדיקה אם הגרירה חוקית (לפני הדדליין)
  const isValidDropTarget = !draggedTask || 
    !draggedTask.task?.due_date || 
    day.date <= draggedTask.task.due_date;

  const getLoadColor = () => {
    if (!day.isWorkDay) return 'bg-gray-100 dark:bg-gray-800/50';
    if (day.usagePercent >= 90) return 'bg-red-50 dark:bg-red-900/10';
    if (day.usagePercent >= 70) return 'bg-yellow-50 dark:bg-yellow-900/10';
    return 'bg-white dark:bg-gray-800';
  };

  return (
    <motion.div
      className={`
        rounded-xl overflow-hidden shadow-sm border-2 transition-all min-h-[400px] flex flex-col
        ${isToday ? 'ring-2 ring-blue-500 border-blue-300' : 'border-gray-200 dark:border-gray-700'}
        ${isDragOver && isValidDropTarget ? 'ring-2 ring-green-500 border-green-300 scale-[1.02]' : ''}
        ${isDragOver && !isValidDropTarget ? 'ring-2 ring-red-500 border-red-300 opacity-60' : ''}
        ${getLoadColor()}
      `}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={(e) => { e.preventDefault(); onDrop(); }}
    >
      {/* כותרת יום */}
      <div 
        className={`p-3 text-center cursor-pointer border-b ${
          isToday ? 'bg-blue-500 text-white border-blue-400' : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'
        }`}
        onClick={onSelectDay}
      >
        <div className="font-bold">{day.dayName}</div>
        <div className={`text-sm ${isToday ? 'text-blue-100' : 'text-gray-500'}`}>
          {new Date(day.date + 'T12:00:00').getDate()}
        </div>
        {day.isWorkDay && (
          <div className="mt-1">
            <div className="h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all ${
                  day.usagePercent >= 90 ? 'bg-red-500' :
                  day.usagePercent >= 70 ? 'bg-yellow-500' :
                  day.usagePercent >= 50 ? 'bg-blue-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(day.usagePercent, 100)}%` }}
              />
            </div>
            <div className={`text-xs mt-1 ${isToday ? 'text-blue-100' : 'text-gray-400'}`}>
              {day.usagePercent}%
            </div>
          </div>
        )}
      </div>

      {/* תוכן */}
      <div className="flex-1 p-2 overflow-y-auto space-y-1">
        {!day.isWorkDay && blocks.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <div className="text-2xl mb-2">🌴</div>
            <div className="text-xs">סוף שבוע</div>
          </div>
        ) : blocks.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <div className="text-2xl mb-2">📭</div>
            <div className="text-xs">אין משימות</div>
          </div>
        ) : (
          <>
            {/* אירועי גוגל */}
            {googleBlocks.map((block, idx) => (
              <TaskBlock
                key={block.id || `google-${idx}`}
                block={block}
                onEdit={() => block.task && onEditTask(block.task)}
                compact
              />
            ))}
            
            {/* משימות רגילות */}
            {regularBlocks.map((block, idx) => (
              <TaskBlock
                key={block.id || `regular-${idx}`}
                block={block}
                onEdit={() => block.task && onEditTask(block.task)}
                onComplete={() => block.task && onComplete(block.task)}
                onStartTimer={() => block.task && onStartTimer(block.task)}
                onDragStart={() => block.task && onDragStart(block.task, block)}
                draggable
                compact
              />
            ))}
            
            {/* הושלמו */}
            {completedBlocks.length > 0 && (
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700 mt-2">
                <div className="text-xs text-gray-400 mb-1">✅ הושלמו ({completedBlocks.length})</div>
                {completedBlocks.slice(0, 2).map((block, idx) => (
                  <TaskBlock key={block.id || `completed-${idx}`} block={block} compact faded />
                ))}
                {completedBlocks.length > 2 && (
                  <div className="text-xs text-gray-400 text-center">+{completedBlocks.length - 2} נוספות</div>
                )}
              </div>
            )}
          </>
        )}
        
        {isDragOver && isValidDropTarget && (
          <div className="p-3 border-2 border-dashed border-green-400 rounded-lg text-center text-green-600 text-sm animate-pulse">
            שחרר כאן ✓
          </div>
        )}
        
        {isDragOver && !isValidDropTarget && (
          <div className="p-3 border-2 border-dashed border-red-400 rounded-lg text-center text-red-600 text-sm">
            ❌ אחרי הדדליין!
          </div>
        )}
      </div>

      <button
        onClick={onAddTask}
        className="p-2 text-center text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 border-t border-gray-200 dark:border-gray-700 transition-colors text-sm"
      >
        + הוסף משימה
      </button>
    </motion.div>
  );
}

// ============================================
// בלוק משימה - עם תיקון הזמנים!
// ============================================

function TaskBlock({ 
  block, 
  onEdit, 
  onComplete, 
  onStartTimer,
  onDragStart,
  draggable = false,
  compact = false,
  faded = false
}) {
  const task = block.task || block;
  const category = getTaskCategory(task?.task_type);

  // ✅ תיקון: קריאה נכונה של הזמנים
  const startTime = block.startTime || (block.startMinute ? minutesToTimeStr(block.startMinute) : '??:??');
  const endTime = block.endTime || (block.endMinute ? minutesToTimeStr(block.endMinute) : '??:??');

  const getBlockColor = () => {
    if (block.isCompleted || faded) return 'border-r-green-400 bg-green-50/50 dark:bg-green-900/10';
    if (block.isGoogleEvent) return 'border-r-purple-500 bg-purple-50 dark:bg-purple-900/20';
    if (task?.priority === 'urgent') return 'border-r-red-500 bg-red-50 dark:bg-red-900/20';
    if (task?.priority === 'high') return 'border-r-orange-500 bg-orange-50 dark:bg-orange-900/20';
    return 'border-r-blue-500 bg-blue-50 dark:bg-blue-900/20';
  };

  return (
    <motion.div
      layout
      draggable={draggable && !block.isGoogleEvent}
      onDragStart={(e) => {
        if (draggable && onDragStart) {
          e.dataTransfer.effectAllowed = 'move';
          onDragStart();
        }
      }}
      className={`
        ${getBlockColor()} rounded-lg border-r-4 p-2 
        ${draggable && !block.isGoogleEvent ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}
        ${faded ? 'opacity-50' : ''}
        hover:shadow-md transition-all
      `}
      onClick={onEdit}
    >
      <div className="flex items-start gap-2">
        <span className="text-sm">{block.isGoogleEvent ? '📅' : category.icon}</span>
        
        <div className="flex-1 min-w-0">
          <div className={`font-medium text-gray-900 dark:text-white truncate ${compact ? 'text-xs' : 'text-sm'}`}>
            {block.title || task?.title}
          </div>
          
          {/* ✅ תיקון: הצגת זמנים נכונה */}
          <div className="text-xs text-gray-500">
            {startTime} - {endTime}
            {block.duration && <span className="mr-1">({block.duration} דק')</span>}
          </div>
          
          <div className="flex gap-1 mt-1 flex-wrap">
            {block.isGoogleEvent && (
              <span className="px-1.5 py-0.5 bg-purple-100 dark:bg-purple-800 text-purple-700 dark:text-purple-200 text-xs rounded">
                קבוע
              </span>
            )}
            {task?.priority === 'urgent' && (
              <span className="px-1.5 py-0.5 bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-200 text-xs rounded">
                דחוף
              </span>
            )}
            {task?.priority === 'high' && (
              <span className="px-1.5 py-0.5 bg-orange-100 dark:bg-orange-800 text-orange-700 dark:text-orange-200 text-xs rounded">
                גבוה
              </span>
            )}
            {task?.due_date && task.due_date !== block.dayDate && (
              <span className={`px-1.5 py-0.5 text-xs rounded ${
                task.due_date < block.dayDate 
                  ? 'bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-200'
                  : 'bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200'
              }`}>
                📅 {new Date(task.due_date + 'T12:00:00').toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })}
              </span>
            )}
          </div>
        </div>

        {!block.isGoogleEvent && !block.isCompleted && !faded && (
          <div className="flex flex-col gap-1">
            {onStartTimer && (
              <button
                onClick={(e) => { e.stopPropagation(); onStartTimer(); }}
                className="p-1 rounded hover:bg-blue-100 text-gray-400 hover:text-blue-600 text-xs"
              >
                ▶
              </button>
            )}
            {onComplete && (
              <button
                onClick={(e) => { e.stopPropagation(); onComplete(); }}
                className="p-1 rounded hover:bg-green-100 text-gray-400 hover:text-green-600 text-xs"
              >
                ✓
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ============================================
// תצוגת נייד - יום בודד עם החלקה
// ============================================

function MobileDayView({
  days,
  currentIndex,
  onChangeDay,
  todayStr,
  onAddTask,
  onEditTask,
  onComplete,
  onStartTimer,
  onSelectDay
}) {
  const currentDay = days[currentIndex];
  if (!currentDay) return null;
  
  const isToday = currentDay.date === todayStr;
  const blocks = currentDay.blocks || [];
  const googleBlocks = blocks.filter(b => b.isGoogleEvent);
  const regularBlocks = blocks.filter(b => !b.isGoogleEvent && !b.isCompleted);
  const completedBlocks = blocks.filter(b => b.isCompleted);

  // החלקה בנייד
  const handleSwipe = (direction) => {
    if (direction === 'left' && currentIndex < days.length - 1) {
      onChangeDay(currentIndex + 1);
    } else if (direction === 'right' && currentIndex > 0) {
      onChangeDay(currentIndex - 1);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
      {/* כותרת היום עם ניווט */}
      <div className={`p-4 ${isToday ? 'bg-blue-500 text-white' : 'bg-gray-50 dark:bg-gray-700'}`}>
        <div className="flex items-center justify-between">
          <button
            onClick={() => onChangeDay(Math.max(0, currentIndex - 1))}
            disabled={currentIndex === 0}
            className={`p-2 rounded-lg ${currentIndex === 0 ? 'opacity-30' : 'hover:bg-white/20'}`}
          >
            ▶
          </button>
          
          <div className="text-center">
            <div className="text-xl font-bold">יום {currentDay.dayName}</div>
            <div className={`text-sm ${isToday ? 'text-blue-100' : 'text-gray-500'}`}>
              {new Date(currentDay.date + 'T12:00:00').toLocaleDateString('he-IL', { day: 'numeric', month: 'long' })}
            </div>
          </div>
          
          <button
            onClick={() => onChangeDay(Math.min(days.length - 1, currentIndex + 1))}
            disabled={currentIndex === days.length - 1}
            className={`p-2 rounded-lg ${currentIndex === days.length - 1 ? 'opacity-30' : 'hover:bg-white/20'}`}
          >
            ◀
          </button>
        </div>
        
        {/* מידע על היום */}
        <div className="flex justify-center gap-4 mt-3 text-sm">
          <div className={`px-3 py-1 rounded-full ${isToday ? 'bg-white/20' : 'bg-gray-200 dark:bg-gray-600'}`}>
            {currentDay.usagePercent}% תפוס
          </div>
          <div className={`px-3 py-1 rounded-full ${isToday ? 'bg-white/20' : 'bg-gray-200 dark:bg-gray-600'}`}>
            {formatDuration(currentDay.freeMinutes || 0)} פנוי
          </div>
        </div>
        
        {/* נקודות ניווט */}
        <div className="flex justify-center gap-2 mt-3">
          {days.map((_, idx) => (
            <button
              key={idx}
              onClick={() => onChangeDay(idx)}
              className={`w-2 h-2 rounded-full transition-colors ${
                idx === currentIndex 
                  ? (isToday ? 'bg-white' : 'bg-blue-500')
                  : (isToday ? 'bg-white/30' : 'bg-gray-300 dark:bg-gray-600')
              }`}
            />
          ))}
        </div>
      </div>

      {/* רשימת משימות */}
      <div 
        className="p-4 space-y-3 max-h-[60vh] overflow-y-auto"
        onTouchStart={(e) => {
          const touch = e.touches[0];
          e.currentTarget.dataset.startX = touch.clientX;
        }}
        onTouchEnd={(e) => {
          const startX = parseFloat(e.currentTarget.dataset.startX);
          const endX = e.changedTouches[0].clientX;
          const diff = startX - endX;
          if (Math.abs(diff) > 50) {
            handleSwipe(diff > 0 ? 'left' : 'right');
          }
        }}
      >
        {blocks.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-4xl mb-3">📭</div>
            <div>אין משימות ליום הזה</div>
          </div>
        ) : (
          <>
            {/* אירועי גוגל */}
            {googleBlocks.length > 0 && (
              <div className="mb-4">
                <div className="text-xs text-purple-600 font-medium mb-2">📅 אירועים קבועים</div>
                {googleBlocks.map((block, idx) => (
                  <MobileTaskBlock
                    key={block.id || `google-${idx}`}
                    block={block}
                    onEdit={() => block.task && onEditTask(block.task)}
                  />
                ))}
              </div>
            )}
            
            {/* משימות */}
            {regularBlocks.length > 0 && (
              <div className="mb-4">
                <div className="text-xs text-blue-600 font-medium mb-2">📝 משימות ({regularBlocks.length})</div>
                {regularBlocks.map((block, idx) => (
                  <MobileTaskBlock
                    key={block.id || `task-${idx}`}
                    block={block}
                    onEdit={() => block.task && onEditTask(block.task)}
                    onComplete={() => block.task && onComplete(block.task)}
                    onStartTimer={() => block.task && onStartTimer(block.task)}
                  />
                ))}
              </div>
            )}
            
            {/* הושלמו */}
            {completedBlocks.length > 0 && (
              <div>
                <div className="text-xs text-green-600 font-medium mb-2">✅ הושלמו ({completedBlocks.length})</div>
                {completedBlocks.slice(0, 3).map((block, idx) => (
                  <MobileTaskBlock
                    key={block.id || `completed-${idx}`}
                    block={block}
                    faded
                  />
                ))}
                {completedBlocks.length > 3 && (
                  <div className="text-center text-gray-400 text-sm py-2">
                    +{completedBlocks.length - 3} משימות נוספות
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* כפתור הוספה */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={() => onAddTask(currentDay.date)}
          className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 active:scale-[0.98] transition-transform"
        >
          + הוסף משימה ליום {currentDay.dayName}
        </button>
      </div>
    </div>
  );
}

// ============================================
// בלוק משימה לנייד
// ============================================

function MobileTaskBlock({ block, onEdit, onComplete, onStartTimer, faded = false }) {
  const task = block.task || block;
  const category = getTaskCategory(task?.task_type);

  const startTime = block.startTime || '??:??';
  const endTime = block.endTime || '??:??';

  return (
    <motion.div
      layout
      className={`
        bg-white dark:bg-gray-700 rounded-xl p-4 mb-2 shadow-sm border-r-4
        ${block.isGoogleEvent ? 'border-r-purple-500' : 
          task?.priority === 'urgent' ? 'border-r-red-500' :
          task?.priority === 'high' ? 'border-r-orange-500' : 'border-r-blue-500'}
        ${faded ? 'opacity-50' : ''}
      `}
      onClick={onEdit}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl">{block.isGoogleEvent ? '📅' : category.icon}</span>
        
        <div className="flex-1 min-w-0">
          <div className="font-medium text-gray-900 dark:text-white">
            {block.title || task?.title}
          </div>
          
          <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
            <span>🕐 {startTime} - {endTime}</span>
            {block.duration && <span>({block.duration} דק')</span>}
          </div>
          
          <div className="flex flex-wrap gap-1 mt-2">
            {block.isGoogleEvent && (
              <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-800 text-purple-700 dark:text-purple-200 text-xs rounded-full">
                קבוע
              </span>
            )}
            {task?.priority === 'urgent' && (
              <span className="px-2 py-0.5 bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-200 text-xs rounded-full">
                דחוף
              </span>
            )}
            {task?.priority === 'high' && (
              <span className="px-2 py-0.5 bg-orange-100 dark:bg-orange-800 text-orange-700 dark:text-orange-200 text-xs rounded-full">
                גבוה
              </span>
            )}
          </div>
        </div>

        {/* כפתורי פעולה */}
        {!block.isGoogleEvent && !block.isCompleted && !faded && (
          <div className="flex gap-2">
            {onStartTimer && (
              <button
                onClick={(e) => { e.stopPropagation(); onStartTimer(); }}
                className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 flex items-center justify-center text-lg"
              >
                ▶
              </button>
            )}
            {onComplete && (
              <button
                onClick={(e) => { e.stopPropagation(); onComplete(); }}
                className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900 text-green-600 flex items-center justify-center text-lg"
              >
                ✓
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ============================================
// תצוגת יום מפורטת
// ============================================

function DayDetailPanel({ 
  day, 
  allDays, 
  onBack, 
  onAddTask, 
  onEditTask, 
  onComplete, 
  onStartTimer,
  onSelectDay,
  onDragStart,
  isMobile = false
}) {
  const hours = Array.from({ length: 10 }, (_, i) => i + 8);
  const blocks = day.blocks || [];
  
  const currentDayIndex = allDays.findIndex(d => d.date === day.date);
  const prevDay = currentDayIndex > 0 ? allDays[currentDayIndex - 1] : null;
  const nextDay = currentDayIndex < allDays.length - 1 ? allDays[currentDayIndex + 1] : null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
      <div className={`p-3 md:p-4 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600`}>
        <div className="flex items-center justify-between mb-3">
          <button onClick={onBack} className="px-3 py-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg text-sm md:text-base">
            ← חזרה {isMobile ? '' : 'לשבוע'}
          </button>
          <button onClick={onAddTask} className="px-3 md:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm md:text-base">
            + משימה {isMobile ? '' : 'חדשה'}
          </button>
        </div>
        
        <div className="flex items-center justify-between">
          <button
            onClick={() => nextDay && onSelectDay(nextDay)}
            disabled={!nextDay}
            className={`px-2 md:px-3 py-2 rounded-lg text-sm ${nextDay ? 'hover:bg-gray-200 dark:hover:bg-gray-600' : 'opacity-30 cursor-not-allowed'}`}
          >
            {isMobile ? '▶' : `${nextDay?.dayName || ''} ▶`}
          </button>
          
          <div className="text-center">
            <div className="text-lg md:text-2xl font-bold text-gray-900 dark:text-white">יום {day.dayName}</div>
            <div className="text-gray-500 text-sm">
              {new Date(day.date + 'T12:00:00').toLocaleDateString('he-IL', { day: 'numeric', month: 'long' })}
            </div>
            <div className="text-xs md:text-sm text-gray-400 mt-1">
              {day.usagePercent}% תפוס | {formatDuration(day.freeMinutes || 0)} פנוי
            </div>
          </div>
          
          <button
            onClick={() => prevDay && onSelectDay(prevDay)}
            disabled={!prevDay}
            className={`px-2 md:px-3 py-2 rounded-lg text-sm ${prevDay ? 'hover:bg-gray-200 dark:hover:bg-gray-600' : 'opacity-30 cursor-not-allowed'}`}
          >
            {isMobile ? '◀' : `◀ ${prevDay?.dayName || ''}`}
          </button>
        </div>
      </div>

      <div className="p-2 md:p-4">
        {!day.isWorkDay && blocks.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-4xl mb-3">🌴</div>
            <div>סוף שבוע</div>
          </div>
        ) : (
          <div className="space-y-1">
            {hours.map(hour => {
              const blocksAtHour = blocks.filter(b => {
                const startHour = Math.floor((b.startMinute || 0) / 60);
                return startHour === hour;
              });

              return (
                <div key={hour} className="flex border-b border-gray-100 dark:border-gray-700 min-h-[50px] md:min-h-[60px]">
                  <div className="w-14 md:w-20 py-2 text-xs md:text-sm text-gray-500 flex-shrink-0 text-left">
                    {String(hour).padStart(2, '0')}:00
                  </div>
                  <div className="flex-1 py-1 space-y-1">
                    {blocksAtHour.map((block, idx) => (
                      isMobile ? (
                        <MobileTaskBlock
                          key={block.id || `hour-${hour}-${idx}`}
                          block={block}
                          onEdit={() => block.task && onEditTask(block.task)}
                          onComplete={() => block.task && onComplete(block.task)}
                          onStartTimer={() => block.task && onStartTimer(block.task)}
                        />
                      ) : (
                        <TaskBlock
                          key={block.id || `hour-${hour}-${idx}`}
                          block={block}
                          onEdit={() => block.task && onEditTask(block.task)}
                          onComplete={() => block.task && onComplete(block.task)}
                          onStartTimer={() => block.task && onStartTimer(block.task)}
                          onDragStart={() => block.task && onDragStart(block.task, block)}
                          draggable={!block.isGoogleEvent}
                        />
                      )
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// פונקציות עזר
// ============================================

function minutesToTimeStr(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

// ============================================
// יצירת הצעות אינטראקטיביות
// ============================================

function generateInteractiveSuggestions(plan, tasks, dismissedSuggestions) {
  const suggestions = [];
  const workDays = plan.days.filter(d => d.isWorkDay && d.dayOfWeek >= 0 && d.dayOfWeek <= 4);
  
  if (workDays.length === 0) return suggestions;
  
  // ✅ שינוי הלוגיקה: יום נחשב "עמוס" רק אם:
  // 1. יש פחות מ-30 דקות פנויות, או
  // 2. יש משימות שלא נכנסות ליום הזה
  const MIN_FREE_TIME = 30; // דקות - מתחת לזה נחשב עמוס
  
  const trulyOverloadedDays = workDays.filter(d => {
    const freeMinutes = d.freeMinutes || (d.availableMinutes - d.scheduledMinutes) || 0;
    return freeMinutes < MIN_FREE_TIME && d.usagePercent > 70;
  });
  
  const lightDays = workDays.filter(d => {
    const freeMinutes = d.freeMinutes || (d.availableMinutes - d.scheduledMinutes) || 0;
    return freeMinutes >= 60; // יום "קל" = יש לפחות שעה פנויה
  });
  
  for (const overloadedDay of trulyOverloadedDays) {
    const suggestionId = `overload-${overloadedDay.date}`;
    if (dismissedSuggestions.includes(suggestionId)) continue;
    
    // ✅ רק משימות רגילות - לא דחופות ולא גוגל!
    const movableBlocks = (overloadedDay.blocks || []).filter(b => 
      !b.isGoogleEvent && 
      !b.isFixed && 
      !b.isCompleted && 
      b.task &&
      b.task.priority !== 'urgent' && // ❌ לא דחופות
      b.task.priority !== 'high'      // ❌ לא גבוהות
    );
    
    if (movableBlocks.length === 0 || lightDays.length === 0) continue;
    
    const options = [];
    
    // אפשרויות להעברת משימות רגילות בלבד
    for (const block of movableBlocks.slice(0, 3)) {
      const taskDueDate = block.task?.due_date;
      
      for (const lightDay of lightDays.slice(0, 2)) {
        if (lightDay.date === overloadedDay.date) continue;
        
        // ✅ בדיקת דדליין - לא להציע העברה לאחר הדדליין!
        if (taskDueDate && lightDay.date > taskDueDate) {
          continue; // דילוג - היום המוצע אחרי הדדליין
        }
        
        options.push({
          type: 'move',
          icon: '📦',
          label: `העבר "${block.title}" ליום ${lightDay.dayName}`,
          impact: taskDueDate 
            ? `יפנה ${block.duration} דק' (דדליין: ${formatDateShort(taskDueDate)})`
            : `יפנה ${block.duration} דק' מיום ${overloadedDay.dayName}`,
          taskId: block.taskId,
          taskTitle: block.title,
          toDate: lightDay.date,
          toDayName: lightDay.dayName,
          recommended: (lightDay.freeMinutes || 0) > 120 // מומלץ אם יש 2+ שעות פנויות
        });
      }
    }
    
    // אם אין משימות שאפשר להעביר (כולן דחופות או עם דדליין קרוב)
    if (options.length === 0) {
      const urgentCount = (overloadedDay.blocks || []).filter(b => 
        b.task?.priority === 'urgent' || b.task?.priority === 'high'
      ).length;
      
      const deadlineCount = movableBlocks.filter(b => 
        b.task?.due_date && b.task.due_date <= overloadedDay.date
      ).length;
      
      let reason = '';
      if (urgentCount > 0 && deadlineCount > 0) {
        reason = `יש ${urgentCount} משימות דחופות ו-${deadlineCount} משימות עם דדליין היום`;
      } else if (urgentCount > 0) {
        reason = `יש ${urgentCount} משימות דחופות שאי אפשר להזיז`;
      } else if (deadlineCount > 0) {
        reason = `יש ${deadlineCount} משימות עם דדליין היום`;
      }
      
      options.push({
        type: 'extend_day',
        icon: '⏰',
        label: 'הארך את יום העבודה',
        impact: reason || 'תוכלי להוסיף עוד משימות',
        recommended: true
      });
    } else {
      // אפשרות להארכת יום
      options.push({
        type: 'extend_day',
        icon: '⏰',
        label: 'הארך את יום העבודה',
        impact: 'תוכלי להוסיף עוד משימות',
        recommended: false
      });
    }
    
    const freeMinutes = overloadedDay.freeMinutes || 0;
    
    if (options.length > 0) {
      suggestions.push({
        id: suggestionId,
        type: 'overloaded_day',
        icon: '⚠️',
        title: `יום ${overloadedDay.dayName} כמעט מלא (${freeMinutes} דק' פנויות)`,
        description: options.some(o => o.type === 'move') 
          ? 'יש משימות שאפשר להעביר (לפני הדדליין שלהן). משימות דחופות נשארות במקום!'
          : 'כל המשימות דחופות או עם דדליין היום - אי אפשר להזיז אותן.',
        options
      });
    }
  }
  
  // 2. משימות לא משובצות - רק אם באמת יש כאלה!
  if ((plan.summary?.unscheduledCount || 0) > 0 && !dismissedSuggestions.includes('unscheduled')) {
    const unscheduledTasks = plan.unscheduledTasks || [];
    
    // הפרדה בין דחופות לרגילות
    const urgentUnscheduled = unscheduledTasks.filter(t => t.priority === 'urgent' || t.priority === 'high');
    const regularUnscheduled = unscheduledTasks.filter(t => t.priority !== 'urgent' && t.priority !== 'high');
    
    // ✅ בדיקה אם יש משימות עם דדליין השבוע
    const weekEnd = workDays[workDays.length - 1]?.date;
    const withDeadlineThisWeek = unscheduledTasks.filter(t => t.due_date && t.due_date <= weekEnd);
    
    const options = [];
    
    if (withDeadlineThisWeek.length > 0) {
      options.push({
        type: 'extend_week',
        icon: '🚨',
        label: `הארכי ימי עבודה (${withDeadlineThisWeek.length} משימות עם דדליין השבוע!)`,
        impact: 'משימות עם דדליין חייבות להיכנס לפני התאריך',
        recommended: true
      });
    }
    
    if (urgentUnscheduled.length > 0 && withDeadlineThisWeek.length === 0) {
      options.push({
        type: 'extend_week',
        icon: '⏰',
        label: `הארכי ימי עבודה (${urgentUnscheduled.length} משימות דחופות!)`,
        impact: 'משימות דחופות חייבות להיכנס השבוע',
        recommended: true
      });
    }
    
    // ✅ רק משימות בלי דדליין השבוע אפשר לדחות
    const canDefer = regularUnscheduled.filter(t => !t.due_date || t.due_date > weekEnd);
    if (canDefer.length > 0) {
      options.push({
        type: 'defer_regular',
        icon: '📅',
        label: `דחי ${canDefer.length} משימות (ללא דדליין קרוב) לשבוע הבא`,
        impact: 'יפנה מקום למשימות הדחופות',
        recommended: urgentUnscheduled.length > 0 || withDeadlineThisWeek.length > 0
      });
    }
    
    options.push({
      type: 'prioritize',
      icon: '🎯',
      label: 'הראי לי מה לבטל',
      impact: 'נבחר יחד מה פחות חשוב',
      recommended: false
    });
    
    suggestions.push({
      id: 'unscheduled',
      type: 'unscheduled',
      icon: '📭',
      title: `${plan.summary.unscheduledCount} משימות לא נכנסות ללוח`,
      description: withDeadlineThisWeek.length > 0 
        ? `🚨 ${withDeadlineThisWeek.length} מתוכן עם דדליין השבוע!`
        : urgentUnscheduled.length > 0 
          ? `⚠️ ${urgentUnscheduled.length} מתוכן דחופות!`
          : 'אין מספיק זמן בשבוע למשימות האלה',
      options
    });
  }
  
  return suggestions;
}

// פונקציית עזר לפורמט תאריך קצר
function formatDateShort(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
}

// ============================================
// חישוב איזון אוטומטי
// ============================================

function calculateAutoBalance(plan, tasks) {
  const moves = [];
  const workDays = plan.days.filter(d => d.isWorkDay && d.dayOfWeek >= 0 && d.dayOfWeek <= 4);
  
  if (workDays.length < 2) return moves;
  
  // ✅ שינוי: רק ימים שבאמת עמוסים (פחות מ-30 דקות פנויות)
  const trulyOverloaded = workDays.filter(d => {
    const freeMinutes = d.freeMinutes || (d.availableMinutes - d.scheduledMinutes) || 0;
    return freeMinutes < 30;
  });
  
  // ימים עם הרבה מקום פנוי (שעה+)
  const lightDays = workDays.filter(d => {
    const freeMinutes = d.freeMinutes || (d.availableMinutes - d.scheduledMinutes) || 0;
    return freeMinutes >= 60;
  });
  
  if (trulyOverloaded.length === 0 || lightDays.length === 0) return moves;
  
  for (const overloadedDay of trulyOverloaded) {
    // ✅ רק משימות רגילות - לא דחופות!
    const movableBlocks = (overloadedDay.blocks || []).filter(b => 
      !b.isGoogleEvent && 
      !b.isFixed && 
      !b.isCompleted && 
      b.task &&
      b.task.priority !== 'urgent' &&
      b.task.priority !== 'high'
    );
    
    for (const block of movableBlocks) {
      // מצא יום קל שמתאים (לפני הדדליין)
      const suitableDay = lightDays.find(d => 
        d.date !== overloadedDay.date &&
        (!block.task.due_date || d.date <= block.task.due_date)
      );
      
      if (suitableDay) {
        moves.push({
          taskId: block.taskId,
          taskTitle: block.title,
          fromDate: overloadedDay.date,
          toDate: suitableDay.date
        });
        break; // רק משימה אחת מכל יום עמוס
      }
    }
  }
  
  return moves;
}

export default WeeklyPlannerPro;
