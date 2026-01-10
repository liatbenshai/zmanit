/**
 * QuickWeekPlanner - תכנון שבועי מהיר בדשבורד
 * ============================================
 * מאפשר להכניס משימות לשבוע הנוכחי או הבא
 * האפליקציה משבצת אוטומטית לפי דחיפות וסוג
 */

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useTasks } from '../../hooks/useTasks';
import { smartScheduleWeekV4 } from '../../utils/smartSchedulerV4';
import toast from 'react-hot-toast';

// =============================================
// קונפיגורציה
// =============================================

const URGENCY_LEVELS = [
  { value: 1, label: 'דחוף וחשוב', emoji: '🔴', quadrant: 1 },
  { value: 2, label: 'חשוב', emoji: '🟠', quadrant: 2 },
  { value: 3, label: 'דחוף', emoji: '🟡', quadrant: 3 },
  { value: 4, label: 'רגיל', emoji: '🟢', quadrant: 4 }
];

const TASK_CATEGORIES = [
  { value: 'work', label: 'עבודה', emoji: '💼', isWork: true },
  { value: 'deep_work', label: 'עבודה מרוכזת', emoji: '🎯', isWork: true },
  { value: 'admin', label: 'אדמיניסטרציה', emoji: '📋', isWork: true },
  { value: 'home', label: 'בית', emoji: '🏠', isWork: false },
  { value: 'family', label: 'משפחה', emoji: '👨‍👩‍👧', isWork: false },
  { value: 'personal', label: 'אישי', emoji: '🧘', isWork: false },
  { value: 'health', label: 'בריאות', emoji: '💪', isWork: false }
];

const DURATION_PRESETS = [
  { value: 15, label: "15 דק'" },
  { value: 30, label: "30 דק'" },
  { value: 45, label: "45 דק'" },
  { value: 60, label: 'שעה' },
  { value: 90, label: 'שעה וחצי' },
  { value: 120, label: 'שעתיים' }
];

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

// =============================================
// פונקציות עזר
// =============================================

function getWeekDays(weekOffset = 0) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayOfWeek = today.getDay();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - dayOfWeek + (weekOffset * 7));
  
  const days = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    
    days.push({
      date: date.toISOString().split('T')[0],
      dayName: DAY_NAMES[i],
      dayNumber: date.getDate(),
      dayOfWeek: i,
      isWeekend: i === 5 || i === 6,
      isToday: date.getTime() === todayDate.getTime(),
      isPast: date < todayDate
    });
  }
  return days;
}

function getWeekLabel(weekOffset) {
  if (weekOffset === 0) return 'השבוע';
  if (weekOffset === 1) return 'שבוע הבא';
  if (weekOffset === 2) return 'עוד שבוע';
  return `עוד ${weekOffset} שבועות`;
}

function getWeekDateRange(weekOffset = 0) {
  const days = getWeekDays(weekOffset);
  const start = new Date(days[0].date);
  const end = new Date(days[6].date);
  
  const formatDate = (d) => d.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
  return `${formatDate(start)} - ${formatDate(end)}`;
}

// =============================================
// קומפוננטה ראשית
// =============================================

export default function QuickWeekPlanner() {
  const { tasks, addTask, loadTasks } = useTasks();
  
  // State
  const [isExpanded, setIsExpanded] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0); // 0 = השבוע, 1 = שבוע הבא
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    urgency: 2,
    category: 'work',
    duration: 30,
    preferredDay: null,
    deadline: null
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // חישוב השבוע לפי offset
  const weekDays = useMemo(() => getWeekDays(weekOffset), [weekOffset]);
  const todayStr = new Date().toISOString().split('T')[0];
  
  // תכנון שבועי
  const weekPlan = useMemo(() => {
    if (!tasks) return null;
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + (weekOffset * 7));
    return smartScheduleWeekV4(weekStart, tasks);
  }, [tasks, weekOffset]);
  
  // סיכום יומי
  const daySummaries = useMemo(() => {
    if (!weekPlan) return {};
    const summaries = {};
    
    weekPlan.days.forEach(day => {
      const dayTasks = (day.blocks || []).filter(b => !b.isGoogleEvent);
      const total = dayTasks.length;
      const freeMinutes = day.freeMinutes || 0;
      
      summaries[day.date] = {
        total,
        freeMinutes,
        usagePercent: day.usagePercent || 0,
        isOverloaded: freeMinutes < 30 && day.usagePercent > 80
      };
    });
    
    return summaries;
  }, [weekPlan]);
  
  // הוספת משימה
  const handleAddTask = useCallback(async () => {
    if (!newTask.title.trim()) {
      toast.error('הכניסי שם למשימה');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const urgencyLevel = URGENCY_LEVELS.find(u => u.value === newTask.urgency);
      const category = TASK_CATEGORIES.find(c => c.value === newTask.category);
      
      let suggestedDate = newTask.preferredDay;
      
      if (!suggestedDate) {
        suggestedDate = findBestDay(
          weekDays,
          daySummaries,
          newTask.urgency,
          category?.isWork ?? true,
          newTask.duration,
          newTask.deadline
        );
      }
      
      const taskData = {
        title: newTask.title.trim(),
        quadrant: urgencyLevel?.quadrant || 2,
        task_type: newTask.category,
        estimated_duration: newTask.duration,
        due_date: newTask.deadline || suggestedDate,
        priority: newTask.urgency === 1 ? 'urgent' : newTask.urgency === 2 ? 'high' : 'normal'
      };
      
      await addTask(taskData);
      
      const dayName = weekDays.find(d => d.date === suggestedDate)?.dayName || suggestedDate;
      toast.success(`✅ "${newTask.title}" נוסף ליום ${dayName}`);
      
      setNewTask({
        title: '',
        urgency: 2,
        category: 'work',
        duration: 30,
        preferredDay: null,
        deadline: null
      });
      setShowAddForm(false);
      loadTasks();
      
    } catch (error) {
      console.error('שגיאה בהוספת משימה:', error);
      toast.error('שגיאה בהוספת המשימה');
    } finally {
      setIsSubmitting(false);
    }
  }, [newTask, weekDays, daySummaries, addTask, loadTasks]);
  
  // =============================================
  // רנדור
  // =============================================
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden"
    >
      {/* כותרת */}
      <div 
        className="p-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📅</span>
            <div>
              <h3 className="font-bold text-lg">תכנון שבועי</h3>
              <p className="text-white/80 text-sm">
                {weekPlan?.summary?.totalTasks || 0} משימות
              </p>
            </div>
          </div>
          <motion.span
            animate={{ rotate: isExpanded ? 180 : 0 }}
            className="text-xl"
          >
            ▼
          </motion.span>
        </div>
      </div>
      
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            {/* ניווט בין שבועות */}
            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <button
                  onClick={(e) => { e.stopPropagation(); setWeekOffset(w => Math.max(-1, w - 1)); }}
                  className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                  disabled={weekOffset <= -1}
                >
                  <span className="text-lg">→</span>
                </button>
                
                <div className="text-center flex-1">
                  <div className="flex items-center justify-center gap-2 flex-wrap">
                    {[0, 1, 2].map(offset => (
                      <button
                        key={offset}
                        onClick={(e) => { e.stopPropagation(); setWeekOffset(offset); }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          weekOffset === offset
                            ? 'bg-indigo-500 text-white'
                            : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                        }`}
                      >
                        {getWeekLabel(offset)}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {getWeekDateRange(weekOffset)}
                  </p>
                </div>
                
                <button
                  onClick={(e) => { e.stopPropagation(); setWeekOffset(w => w + 1); }}
                  className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                >
                  <span className="text-lg">←</span>
                </button>
              </div>
            </div>
            
            {/* תצוגת שבוע */}
            <div className="p-4 border-b border-gray-100 dark:border-gray-700">
              <div className="grid grid-cols-7 gap-1">
                {weekDays.map(day => {
                  const summary = daySummaries[day.date] || {};
                  const isOverloaded = summary.isOverloaded;
                  const hasSpace = (summary.freeMinutes || 480) > 60;
                  
                  return (
                    <button
                      key={day.date}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!day.isPast) {
                          setNewTask(prev => ({ ...prev, preferredDay: day.date }));
                          setShowAddForm(true);
                        }
                      }}
                      disabled={day.isPast}
                      className={`p-2 rounded-lg text-center text-xs transition-all hover:scale-105 ${
                        day.isToday 
                          ? 'bg-indigo-100 dark:bg-indigo-900/30 ring-2 ring-indigo-500' 
                          : day.isPast
                            ? 'bg-gray-100 dark:bg-gray-800 opacity-50 cursor-not-allowed'
                            : isOverloaded
                              ? 'bg-red-50 dark:bg-red-900/20 hover:bg-red-100'
                              : hasSpace
                                ? 'bg-green-50 dark:bg-green-900/20 hover:bg-green-100'
                                : 'bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100'
                      }`}
                    >
                      <div className={`font-bold ${day.isToday ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-700 dark:text-gray-300'}`}>
                        {day.dayName.slice(0, 2)}
                      </div>
                      <div className="text-gray-600 dark:text-gray-400 font-medium">
                        {day.dayNumber}
                      </div>
                      <div className="text-gray-400 mt-0.5">
                        {summary.total || 0}
                      </div>
                      {isOverloaded && <span className="text-red-500 text-xs">⚠️</span>}
                      {hasSpace && !day.isPast && <span className="text-green-500 text-xs">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
            
            {/* כפתור הוספה */}
            {!showAddForm ? (
              <div className="p-4">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowAddForm(true); }}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <span className="text-xl">➕</span>
                  <span>הוסף משימה ל{getWeekLabel(weekOffset)}</span>
                </button>
              </div>
            ) : (
              /* טופס הוספה */
              <div className="p-4 space-y-4" onClick={e => e.stopPropagation()}>
                {/* שם המשימה */}
                <input
                  type="text"
                  value={newTask.title}
                  onChange={e => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="מה צריך לעשות?"
                  className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:border-indigo-500 outline-none text-lg dark:bg-gray-700 dark:text-white"
                  autoFocus
                />
                
                {/* רמת דחיפות */}
                <div>
                  <label className="text-sm text-gray-600 dark:text-gray-400 block mb-2">רמת דחיפות</label>
                  <div className="grid grid-cols-4 gap-2">
                    {URGENCY_LEVELS.map(level => (
                      <button
                        key={level.value}
                        onClick={() => setNewTask(prev => ({ ...prev, urgency: level.value }))}
                        className={`p-2 rounded-lg text-center transition-all text-sm ${
                          newTask.urgency === level.value
                            ? 'bg-indigo-100 dark:bg-indigo-900/30 ring-2 ring-indigo-500 font-bold'
                            : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <span className="block text-lg">{level.emoji}</span>
                        <span className="text-xs">{level.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* קטגוריה */}
                <div>
                  <label className="text-sm text-gray-600 dark:text-gray-400 block mb-2">סוג משימה</label>
                  <div className="flex flex-wrap gap-2">
                    {TASK_CATEGORIES.map(cat => (
                      <button
                        key={cat.value}
                        onClick={() => setNewTask(prev => ({ ...prev, category: cat.value }))}
                        className={`px-3 py-2 rounded-lg flex items-center gap-1 transition-all text-sm ${
                          newTask.category === cat.value
                            ? 'bg-indigo-100 dark:bg-indigo-900/30 ring-2 ring-indigo-500 font-bold'
                            : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <span>{cat.emoji}</span>
                        <span>{cat.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* משך זמן */}
                <div>
                  <label className="text-sm text-gray-600 dark:text-gray-400 block mb-2">משך זמן</label>
                  <div className="flex flex-wrap gap-2">
                    {DURATION_PRESETS.map(dur => (
                      <button
                        key={dur.value}
                        onClick={() => setNewTask(prev => ({ ...prev, duration: dur.value }))}
                        className={`px-3 py-2 rounded-lg transition-all text-sm ${
                          newTask.duration === dur.value
                            ? 'bg-indigo-100 dark:bg-indigo-900/30 ring-2 ring-indigo-500 font-bold'
                            : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        {dur.label}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* יום מועדף */}
                <div>
                  <label className="text-sm text-gray-600 dark:text-gray-400 block mb-2">יום (או אוטומטי)</label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setNewTask(prev => ({ ...prev, preferredDay: null }))}
                      className={`px-3 py-2 rounded-lg transition-all text-sm ${
                        newTask.preferredDay === null
                          ? 'bg-purple-100 dark:bg-purple-900/30 ring-2 ring-purple-500 font-bold'
                          : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      🤖 אוטומטי
                    </button>
                    {weekDays.filter(d => !d.isPast).map(day => (
                      <button
                        key={day.date}
                        onClick={() => setNewTask(prev => ({ ...prev, preferredDay: day.date }))}
                        className={`px-3 py-2 rounded-lg transition-all text-sm ${
                          newTask.preferredDay === day.date
                            ? 'bg-indigo-100 dark:bg-indigo-900/30 ring-2 ring-indigo-500 font-bold'
                            : day.isToday
                              ? 'bg-blue-50 dark:bg-blue-900/20'
                              : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        {day.dayName}{day.isToday && ' (היום)'}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* כפתורי פעולה */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowAddForm(false)}
                    className="flex-1 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-200 transition-colors"
                  >
                    ביטול
                  </button>
                  <button
                    onClick={handleAddTask}
                    disabled={isSubmitting || !newTask.title.trim()}
                    className={`flex-1 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                      isSubmitting || !newTask.title.trim()
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-md'
                    }`}
                  >
                    {isSubmitting ? '⏳ מוסיף...' : '✅ הוסף משימה'}
                  </button>
                </div>
              </div>
            )}
            
            {/* קישור לתצוגה מלאה */}
            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700">
              <Link
                to="/weekly"
                className="flex items-center justify-center gap-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 font-medium"
              >
                <span>📊</span>
                <span>לתצוגת שבוע מלאה</span>
                <span>←</span>
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// =============================================
// פונקציה למציאת היום הטוב ביותר
// =============================================

function findBestDay(weekDays, daySummaries, urgency, isWorkTask, duration, deadline) {
  const today = new Date().toISOString().split('T')[0];
  
  const availableDays = weekDays.filter(day => {
    if (day.isPast) return false;
    if (deadline && day.date > deadline) return false;
    if (isWorkTask && day.isWeekend) return false;
    return true;
  });
  
  if (availableDays.length === 0) {
    const firstFuture = weekDays.find(d => !d.isPast);
    return firstFuture?.date || today;
  }
  
  const scoredDays = availableDays.map(day => {
    const summary = daySummaries[day.date] || { freeMinutes: 480, usagePercent: 0 };
    let score = 0;
    
    if (summary.freeMinutes >= duration) score += 50;
    if (summary.freeMinutes >= duration * 2) score += 20;
    score -= summary.usagePercent / 2;
    
    if (urgency === 1) {
      if (day.isToday) score += 100;
      else score += 80 - (availableDays.indexOf(day) * 10);
    } else if (urgency === 2) {
      score += 50 - (availableDays.indexOf(day) * 5);
    }
    
    if (day.dayOfWeek >= 1 && day.dayOfWeek <= 3) score += 10;
    
    return { ...day, score };
  });
  
  scoredDays.sort((a, b) => b.score - a.score);
  return scoredDays[0]?.date || today;
}
