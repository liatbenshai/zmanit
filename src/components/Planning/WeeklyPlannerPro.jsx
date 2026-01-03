/**
 * תצוגה שבועית מקצועית - WeeklyPlannerPro
 * ==========================================
 * 
 * 🆕 פיצ'רים:
 * 1. ניתוח שבועי חכם עם גרפים
 * 2. הצעות אקטיביות להזזת משימות
 * 3. גרירה בין ימים
 * 4. סימון ברור קבוע vs גמיש
 * 5. כפתור איזון אוטומטי
 * 6. Timeline ויזואלי
 * 7. סיכום יומי ושבועי
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTasks } from '../../hooks/useTasks';
import { smartScheduleWeekV4 } from '../../utils/smartSchedulerV4';
import SimpleTaskForm from '../DailyView/SimpleTaskForm';
import TaskTimerWithInterruptions from '../Tasks/TaskTimerWithInterruptions';
import Modal from '../UI/Modal';
import toast from 'react-hot-toast';
import { supabase } from '../../services/supabase';

// ============================================
// קונפיגורציה - סוגי משימות
// ============================================
const TASK_TYPES = {
  transcription: { id: 'transcription', name: 'תמלול', icon: '🎙️', defaultDuration: 60, category: 'work' },
  proofreading: { id: 'proofreading', name: 'הגהה', icon: '📝', defaultDuration: 45, category: 'work' },
  email: { id: 'email', name: 'מיילים', icon: '📧', defaultDuration: 25, category: 'work' },
  course: { id: 'course', name: 'קורס התמלול', icon: '📚', defaultDuration: 90, category: 'venture' },
  client_communication: { id: 'client_communication', name: 'לקוחות', icon: '💬', defaultDuration: 30, category: 'work' },
  management: { id: 'management', name: 'ניהול', icon: '👔', defaultDuration: 45, category: 'work' },
  family: { id: 'family', name: 'משפחה', icon: '👨‍👩‍👧‍👦', defaultDuration: 60, category: 'family' },
  kids: { id: 'kids', name: 'ילדים', icon: '🧒', defaultDuration: 30, category: 'family' },
  personal: { id: 'personal', name: 'זמן אישי', icon: '🧘', defaultDuration: 30, category: 'personal' },
  unexpected: { id: 'unexpected', name: 'בלת"מים', icon: '⚡', defaultDuration: 30, category: 'work' },
  other: { id: 'other', name: 'אחר', icon: '📋', defaultDuration: 30, category: 'work' }
};

// פורמט דקות לטקסט
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
  
  // גרירה
  const [draggedTask, setDraggedTask] = useState(null);
  const [dragOverDay, setDragOverDay] = useState(null);

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
    console.log('📅 WeeklyPlannerPro: חישוב תכנון שבועי');
    return smartScheduleWeekV4(weekStart, tasks);
  }, [tasks, weekStart]);

  // יצירת הצעות חכמות
  const smartSuggestions = useMemo(() => {
    if (!plan) return [];
    return generateSmartSuggestions(plan, tasks);
  }, [plan, tasks]);

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
    
    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          due_date: targetDayDate,
          due_time: null, // איפוס שעה - יתוזמן מחדש
          updated_at: new Date().toISOString()
        })
        .eq('id', task.id);
      
      if (error) throw error;
      
      const targetDay = plan.days.find(d => d.date === targetDayDate);
      toast.success(`✅ "${task.title}" הועבר ליום ${targetDay?.dayName || targetDayDate}`);
      loadTasks();
    } catch (err) {
      console.error('שגיאה בהעברה:', err);
      toast.error('שגיאה בהעברת המשימה');
    } finally {
      setDraggedTask(null);
      setDragOverDay(null);
    }
  };

  // ============================================
  // יישום הצעה
  // ============================================
  
  const applySuggestion = async (suggestion) => {
    try {
      if (suggestion.type === 'move_task') {
        const { error } = await supabase
          .from('tasks')
          .update({
            due_date: suggestion.toDate,
            due_time: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', suggestion.taskId);
        
        if (error) throw error;
        toast.success(`✅ ${suggestion.actionLabel}`);
        
      } else if (suggestion.type === 'balance') {
        // העברת מספר משימות
        for (const move of suggestion.moves) {
          await supabase
            .from('tasks')
            .update({
              due_date: move.toDate,
              due_time: null,
              updated_at: new Date().toISOString()
            })
            .eq('id', move.taskId);
        }
        toast.success(`✅ ${suggestion.moves.length} משימות אוזנו`);
      }
      
      loadTasks();
    } catch (err) {
      console.error('שגיאה ביישום הצעה:', err);
      toast.error('שגיאה ביישום ההצעה');
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
      console.error('שגיאה באיזון:', err);
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

  // פורמט כותרת שבוע
  const formatWeekTitle = () => {
    const endDate = new Date(weekStart);
    endDate.setDate(endDate.getDate() + 6);
    
    const options = { day: 'numeric', month: 'short' };
    const startStr = weekStart.toLocaleDateString('he-IL', options);
    const endStr = endDate.toLocaleDateString('he-IL', options);
    
    return `${startStr} - ${endStr}`;
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
    <div className="weekly-planner-pro p-4 max-w-7xl mx-auto">
      
      {/* ===== כותרת וניווט ===== */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            📊 תכנון שבועי חכם
          </h1>
          
          <div className="flex items-center gap-2">
            {/* כפתור איזון */}
            <button
              onClick={handleAutoBalance}
              disabled={isBalancing}
              className="px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:from-purple-600 hover:to-blue-600 flex items-center gap-2 disabled:opacity-50 shadow-md"
            >
              {isBalancing ? (
                <>
                  <span className="animate-spin">⏳</span>
                  מאזן...
                </>
              ) : (
                <>
                  ⚖️ איזון אוטומטי
                </>
              )}
            </button>
            
            {/* כפתור הצעות */}
            <button
              onClick={() => setShowSuggestions(!showSuggestions)}
              className={`px-3 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                showSuggestions 
                  ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' 
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600'
              }`}
            >
              💡 הצעות
              {smartSuggestions.length > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {smartSuggestions.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ניווט שבועות */}
        <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <button
            onClick={goToPrevWeek}
            className="p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-xl"
          >
            ▶
          </button>
          
          <div className="flex items-center gap-4">
            <span className="font-bold text-xl text-gray-900 dark:text-white">
              {formatWeekTitle()}
            </span>
            {weekOffset !== 0 && (
              <button
                onClick={goToThisWeek}
                className="px-3 py-1 text-sm bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-lg"
              >
                🏠 השבוע
              </button>
            )}
          </div>
          
          <button
            onClick={goToNextWeek}
            className="p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-xl"
          >
            ◀
          </button>
        </div>
      </div>

      {/* ===== ניתוח שבועי ===== */}
      <WeeklyAnalysis plan={plan} />

      {/* ===== פאנל הצעות ===== */}
      <AnimatePresence>
        {showSuggestions && smartSuggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6"
          >
            <SuggestionsPanel 
              suggestions={smartSuggestions}
              onApply={applySuggestion}
              onDismiss={(idx) => {
                // אפשר להוסיף לוגיקה לדחיית הצעות
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== מקרא ===== */}
      <div className="flex items-center gap-6 mb-4 text-sm bg-white dark:bg-gray-800 rounded-lg p-3">
        <span className="flex items-center gap-2">
          <span className="w-4 h-4 rounded bg-purple-500"></span>
          📅 אירוע גוגל (קבוע)
        </span>
        <span className="flex items-center gap-2">
          <span className="w-4 h-4 rounded bg-blue-500"></span>
          📝 משימה (גמישה - ניתן לגרור)
        </span>
        <span className="flex items-center gap-2">
          <span className="w-4 h-4 rounded bg-green-500"></span>
          ✅ הושלם
        </span>
        <span className="flex items-center gap-2">
          <span className="w-4 h-4 rounded bg-red-500"></span>
          🔴 דחוף
        </span>
      </div>

      {/* ===== תצוגת שבוע ===== */}
      {selectedDayForDetail ? (
        <DayDetailPanel
          day={selectedDayForDetail}
          allDays={plan.days}
          onBack={() => setSelectedDayForDetail(null)}
          onAddTask={handleAddTask}
          onEditTask={handleEditTask}
          onComplete={handleComplete}
          onStartTimer={handleStartTimer}
          onSelectDay={setSelectedDayForDetail}
          onDragStart={handleDragStart}
        />
      ) : (
        <div className="grid grid-cols-7 gap-3">
          {plan.days.map((day) => (
            <DayColumn
              key={day.date}
              day={day}
              isToday={isToday(day.date)}
              isDragOver={dragOverDay === day.date}
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

      {/* ===== אזהרות ===== */}
      {plan.warnings?.length > 0 && (
        <WarningsPanel warnings={plan.warnings} />
      )}

      {/* ===== מודלים ===== */}
      <Modal
        isOpen={showTaskForm}
        onClose={handleCloseForm}
        title={editingTask ? 'עריכת משימה' : 'משימה חדשה'}
      >
        <SimpleTaskForm
          task={editingTask}
          onClose={handleCloseForm}
          taskTypes={TASK_TYPES}
          defaultDate={selectedDate}
        />
      </Modal>

      <Modal
        isOpen={!!timerTask}
        onClose={handleCloseTimer}
        title={`⏱️ ${timerTask?.title || 'טיימר'}`}
        size="lg"
      >
        {timerTask && (
          <TaskTimerWithInterruptions
            task={timerTask}
            onComplete={() => {
              handleComplete(timerTask);
              handleCloseTimer();
            }}
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
  const workDays = plan.days.filter(d => d.isWorkDay);
  const avgUsage = workDays.length > 0 
    ? Math.round(workDays.reduce((sum, d) => sum + (d.usagePercent || 0), 0) / workDays.length)
    : 0;
  
  const maxDay = workDays.reduce((max, d) => 
    (d.usagePercent || 0) > (max?.usagePercent || 0) ? d : max, null);
  const minDay = workDays.reduce((min, d) => 
    (d.usagePercent || 0) < (min?.usagePercent || Infinity) ? d : min, null);

  return (
    <div className="grid grid-cols-6 gap-4 mb-6">
      {/* ניצולת כללית */}
      <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl p-4 shadow-md">
        <div className="text-3xl font-bold">{plan.summary?.usagePercent || 0}%</div>
        <div className="text-blue-100 text-sm">ניצולת שבועית</div>
        <div className="mt-2 h-2 bg-blue-400 rounded-full overflow-hidden">
          <div 
            className="h-full bg-white rounded-full transition-all"
            style={{ width: `${plan.summary?.usagePercent || 0}%` }}
          />
        </div>
      </div>

      {/* זמן מתוכנן */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="text-2xl font-bold text-gray-900 dark:text-white">
          {formatDuration(plan.summary?.totalScheduledMinutes || 0)}
        </div>
        <div className="text-gray-500 text-sm">זמן מתוכנן</div>
        <div className="mt-2 flex items-center gap-2 text-xs">
          <span className="text-purple-600">📅 {formatDuration(plan.summary?.totalFixedMinutes || 0)} קבוע</span>
        </div>
      </div>

      {/* זמן פנוי */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="text-2xl font-bold text-green-600">
          {formatDuration((plan.summary?.totalAvailableMinutes || 0) - (plan.summary?.totalScheduledMinutes || 0))}
        </div>
        <div className="text-gray-500 text-sm">זמן פנוי</div>
      </div>

      {/* יום עמוס ביותר */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="text-2xl font-bold text-orange-600">
          {maxDay?.dayName || '-'}
        </div>
        <div className="text-gray-500 text-sm">היום העמוס ביותר</div>
        <div className="text-xs text-orange-500 mt-1">{maxDay?.usagePercent || 0}% תפוס</div>
      </div>

      {/* יום פנוי ביותר */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="text-2xl font-bold text-green-600">
          {minDay?.dayName || '-'}
        </div>
        <div className="text-gray-500 text-sm">היום הפנוי ביותר</div>
        <div className="text-xs text-green-500 mt-1">{minDay?.usagePercent || 0}% תפוס</div>
      </div>

      {/* משימות לא משובצות */}
      <div className={`rounded-xl p-4 shadow-sm border ${
        (plan.summary?.unscheduledCount || 0) > 0 
          ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
          : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
      }`}>
        <div className={`text-2xl font-bold ${
          (plan.summary?.unscheduledCount || 0) > 0 ? 'text-red-600' : 'text-green-600'
        }`}>
          {plan.summary?.unscheduledCount || 0}
        </div>
        <div className="text-gray-500 text-sm">לא משובצות</div>
      </div>
    </div>
  );
}

// ============================================
// פאנל הצעות
// ============================================

function SuggestionsPanel({ suggestions, onApply, onDismiss }) {
  return (
    <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
          💡 הצעות לשיפור ({suggestions.length})
        </h3>
      </div>
      
      <div className="space-y-3">
        {suggestions.map((suggestion, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm flex items-center gap-4"
          >
            <span className="text-3xl">{suggestion.icon}</span>
            
            <div className="flex-1">
              <div className="font-medium text-gray-900 dark:text-white">
                {suggestion.title}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {suggestion.description}
              </div>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => onApply(suggestion)}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center gap-1"
              >
                ✓ קבל
              </button>
              <button
                onClick={() => onDismiss(idx)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                ✗ דחה
              </button>
            </div>
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

  // צבע רקע לפי עומס
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
        ${isDragOver ? 'ring-2 ring-green-500 border-green-300 scale-[1.02]' : ''}
        ${getLoadColor()}
      `}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={(e) => { e.preventDefault(); onDrop(); }}
    >
      {/* כותרת יום */}
      <div 
        className={`
          p-3 text-center cursor-pointer border-b
          ${isToday 
            ? 'bg-blue-500 text-white border-blue-400' 
            : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'
          }
        `}
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
                  <TaskBlock
                    key={block.id || `completed-${idx}`}
                    block={block}
                    compact
                    faded
                  />
                ))}
                {completedBlocks.length > 2 && (
                  <div className="text-xs text-gray-400 text-center">
                    +{completedBlocks.length - 2} נוספות
                  </div>
                )}
              </div>
            )}
          </>
        )}
        
        {/* אזור גרירה */}
        {isDragOver && (
          <div className="p-3 border-2 border-dashed border-green-400 rounded-lg text-center text-green-600 text-sm animate-pulse">
            שחרר כאן
          </div>
        )}
      </div>

      {/* כפתור הוספה */}
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
// בלוק משימה
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
  const taskType = TASK_TYPES[task?.task_type] || TASK_TYPES.other;

  // צבע לפי סוג
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
        <span className="text-sm">{block.isGoogleEvent ? '📅' : taskType.icon}</span>
        
        <div className="flex-1 min-w-0">
          <div className={`font-medium text-gray-900 dark:text-white truncate ${compact ? 'text-xs' : 'text-sm'}`}>
            {block.title || task?.title}
          </div>
          <div className="text-xs text-gray-500">
            {block.startTime} - {block.endTime}
          </div>
          
          {/* תגיות */}
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
          </div>
        </div>

        {/* כפתורים */}
        {!block.isGoogleEvent && !block.isCompleted && !faded && (
          <div className="flex flex-col gap-1">
            {onStartTimer && (
              <button
                onClick={(e) => { e.stopPropagation(); onStartTimer(); }}
                className="p-1 rounded hover:bg-blue-100 text-gray-400 hover:text-blue-600 text-xs"
                title="הפעל טיימר"
              >
                ▶
              </button>
            )}
            {onComplete && (
              <button
                onClick={(e) => { e.stopPropagation(); onComplete(); }}
                className="p-1 rounded hover:bg-green-100 text-gray-400 hover:text-green-600 text-xs"
                title="סמן כהושלם"
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
  onDragStart
}) {
  const hours = Array.from({ length: 10 }, (_, i) => i + 8); // 08:00 - 17:00
  const blocks = day.blocks || [];
  
  const currentDayIndex = allDays.findIndex(d => d.date === day.date);
  const prevDay = currentDayIndex > 0 ? allDays[currentDayIndex - 1] : null;
  const nextDay = currentDayIndex < allDays.length - 1 ? allDays[currentDayIndex + 1] : null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
      {/* כותרת */}
      <div className="p-4 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={onBack}
            className="px-3 py-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
          >
            ← חזרה לשבוע
          </button>
          
          <button
            onClick={onAddTask}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            + משימה חדשה
          </button>
        </div>
        
        {/* ניווט בין ימים */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => nextDay && onSelectDay(nextDay)}
            disabled={!nextDay}
            className={`px-3 py-2 rounded-lg ${nextDay ? 'hover:bg-gray-200 dark:hover:bg-gray-600' : 'opacity-30 cursor-not-allowed'}`}
          >
            {nextDay?.dayName || ''} ▶
          </button>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              יום {day.dayName}
            </div>
            <div className="text-gray-500">
              {new Date(day.date + 'T12:00:00').toLocaleDateString('he-IL', { day: 'numeric', month: 'long' })}
            </div>
            <div className="text-sm text-gray-400 mt-1">
              {day.usagePercent}% תפוס | {formatDuration(day.freeMinutes || 0)} פנוי
            </div>
          </div>
          
          <button
            onClick={() => prevDay && onSelectDay(prevDay)}
            disabled={!prevDay}
            className={`px-3 py-2 rounded-lg ${prevDay ? 'hover:bg-gray-200 dark:hover:bg-gray-600' : 'opacity-30 cursor-not-allowed'}`}
          >
            ◀ {prevDay?.dayName || ''}
          </button>
        </div>
      </div>

      {/* ציר זמן */}
      <div className="p-4">
        {!day.isWorkDay && blocks.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-4xl mb-3">🌴</div>
            <div>סוף שבוע - אין משימות מתוזמנות</div>
          </div>
        ) : (
          <div className="space-y-1">
            {hours.map(hour => {
              const blocksAtHour = blocks.filter(b => {
                const startHour = Math.floor((b.startMinute || 0) / 60);
                return startHour === hour;
              });

              return (
                <div 
                  key={hour} 
                  className="flex border-b border-gray-100 dark:border-gray-700 min-h-[60px]"
                >
                  <div className="w-20 py-2 text-sm text-gray-500 flex-shrink-0 text-left">
                    {String(hour).padStart(2, '0')}:00
                  </div>
                  
                  <div className="flex-1 py-1 space-y-1">
                    {blocksAtHour.map((block, idx) => (
                      <TaskBlock
                        key={block.id || `hour-${hour}-${idx}`}
                        block={block}
                        onEdit={() => block.task && onEditTask(block.task)}
                        onComplete={() => block.task && onComplete(block.task)}
                        onStartTimer={() => block.task && onStartTimer(block.task)}
                        onDragStart={() => block.task && onDragStart(block.task, block)}
                        draggable={!block.isGoogleEvent}
                      />
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
// פאנל אזהרות
// ============================================

function WarningsPanel({ warnings }) {
  if (!warnings || warnings.length === 0) return null;

  return (
    <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-200 dark:border-yellow-800">
      <h3 className="font-bold text-yellow-800 dark:text-yellow-200 mb-3 flex items-center gap-2">
        ⚠️ {warnings.length} בעיות שדורשות התייחסות
      </h3>
      <div className="space-y-2">
        {warnings.slice(0, 5).map((warning, idx) => (
          <div key={idx} className="p-3 bg-white dark:bg-gray-800 rounded-lg text-sm">
            <span className="text-yellow-600">⚠️</span>{' '}
            <span className="font-medium">{warning.taskTitle || 'משימה'}</span>
            <span className="text-gray-500 mr-2">- {warning.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// פונקציות עזר - יצירת הצעות חכמות
// ============================================

function generateSmartSuggestions(plan, tasks) {
  const suggestions = [];
  const workDays = plan.days.filter(d => d.isWorkDay);
  
  if (workDays.length === 0) return suggestions;
  
  // חישוב ממוצע
  const avgUsage = workDays.reduce((sum, d) => sum + (d.usagePercent || 0), 0) / workDays.length;
  
  // 1. מציאת ימים עמוסים וריקים
  const overloadedDays = workDays.filter(d => d.usagePercent > avgUsage * 1.3);
  const lightDays = workDays.filter(d => d.usagePercent < avgUsage * 0.7 && d.usagePercent > 0);
  
  // הצעה לאיזון
  if (overloadedDays.length > 0 && lightDays.length > 0) {
    const fromDay = overloadedDays[0];
    const toDay = lightDays[0];
    
    // מציאת משימה גמישה להעברה
    const movableTask = (fromDay.blocks || []).find(b => 
      !b.isGoogleEvent && !b.isFixed && !b.isCompleted && b.task
    );
    
    if (movableTask) {
      suggestions.push({
        type: 'move_task',
        icon: '⚖️',
        title: `איזון עומסים`,
        description: `יום ${fromDay.dayName} עמוס (${fromDay.usagePercent}%). הצעה: העבר "${movableTask.title}" ליום ${toDay.dayName} (${toDay.usagePercent}%)`,
        actionLabel: `העבר ליום ${toDay.dayName}`,
        taskId: movableTask.taskId,
        fromDate: fromDay.date,
        toDate: toDay.date
      });
    }
  }
  
  // 2. משימות דחופות ביום עמוס
  for (const day of workDays) {
    const urgentBlocks = (day.blocks || []).filter(b => 
      b.task?.priority === 'urgent' && !b.isCompleted
    );
    
    if (urgentBlocks.length > 2 && day.usagePercent > 80) {
      suggestions.push({
        type: 'warning',
        icon: '🔴',
        title: `יום ${day.dayName} עמוס במשימות דחופות`,
        description: `יש ${urgentBlocks.length} משימות דחופות ביום אחד. שקול לדחות משימות לא-דחופות`,
        actionLabel: 'הצג אפשרויות'
      });
    }
  }
  
  // 3. הפסקות
  for (const day of workDays) {
    const totalMinutes = (day.blocks || [])
      .filter(b => !b.isCompleted)
      .reduce((sum, b) => sum + (b.duration || 0), 0);
    
    if (totalMinutes > 300 && day.usagePercent > 70) { // יותר מ-5 שעות
      suggestions.push({
        type: 'break',
        icon: '☕',
        title: `הפסקה מומלצת ביום ${day.dayName}`,
        description: `${Math.round(totalMinutes / 60)} שעות עבודה מתוכננות. מומלץ לתכנן הפסקות`,
        actionLabel: 'הוסף הפסקה'
      });
      break; // רק הצעה אחת
    }
  }
  
  // 4. משימות לא משובצות
  if ((plan.summary?.unscheduledCount || 0) > 0) {
    suggestions.push({
      type: 'unscheduled',
      icon: '📭',
      title: `${plan.summary.unscheduledCount} משימות לא משובצות`,
      description: 'יש משימות שלא נכנסות ללוח הזמנים. שקול להאריך ימי עבודה או לדחות משימות',
      actionLabel: 'הצג משימות'
    });
  }
  
  return suggestions;
}

// ============================================
// חישוב איזון אוטומטי
// ============================================

function calculateAutoBalance(plan, tasks) {
  const moves = [];
  const workDays = plan.days.filter(d => d.isWorkDay);
  
  if (workDays.length < 2) return moves;
  
  // חישוב ממוצע
  const avgUsage = workDays.reduce((sum, d) => sum + (d.usagePercent || 0), 0) / workDays.length;
  
  // מיון ימים לפי עומס
  const sortedDays = [...workDays].sort((a, b) => (b.usagePercent || 0) - (a.usagePercent || 0));
  
  // העברה מימים עמוסים לימים ריקים
  for (let i = 0; i < sortedDays.length / 2; i++) {
    const overloadedDay = sortedDays[i];
    const lightDay = sortedDays[sortedDays.length - 1 - i];
    
    if ((overloadedDay.usagePercent || 0) <= avgUsage * 1.2) break;
    if ((lightDay.usagePercent || 0) >= avgUsage * 0.8) break;
    
    // מציאת משימה גמישה להעברה
    const movableBlocks = (overloadedDay.blocks || []).filter(b => 
      !b.isGoogleEvent && !b.isFixed && !b.isCompleted && b.task
    );
    
    if (movableBlocks.length > 0) {
      // העבר משימה אחת
      const taskToMove = movableBlocks[movableBlocks.length - 1]; // האחרונה
      moves.push({
        taskId: taskToMove.taskId,
        taskTitle: taskToMove.title,
        fromDate: overloadedDay.date,
        toDate: lightDay.date
      });
    }
  }
  
  return moves;
}

export default WeeklyPlannerPro;
