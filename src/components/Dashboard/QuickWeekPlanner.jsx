/**
 * QuickWeekPlanner - תכנון שבועי מהיר בדשבורד
 * ============================================
 * מאפשר להכניס משימות לשבוע הקרוב בקלות
 * האפליקציה משבצת אוטומטית לפי דחיפות וסוג
 * 
 * כללים:
 * - משימות עבודה: ראשון-חמישי 8:00-17:00
 * - משימות בית/משפחה: ראשון-חמישי 17:00-21:00, שישי-שבת גמיש
 * - דחוף = קודם, חשוב = אחרי הדחוף, רגיל = מה שנשאר
 * - משימות עם שעה קבועה לא זזות
 */

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTasks } from '../../hooks/useTasks';
import { smartScheduleWeekV4 } from '../../utils/smartSchedulerV4';
import { TASK_TYPES, getTaskType } from '../../config/taskTypes';
import toast from 'react-hot-toast';

// =============================================
// קונפיגורציה
// =============================================

const URGENCY_LEVELS = [
  { value: 1, label: 'דחוף וחשוב', emoji: '🔴', color: 'red', quadrant: 1 },
  { value: 2, label: 'חשוב', emoji: '🟠', color: 'orange', quadrant: 2 },
  { value: 3, label: 'דחוף', emoji: '🟡', color: 'yellow', quadrant: 3 },
  { value: 4, label: 'רגיל', emoji: '🟢', color: 'green', quadrant: 4 }
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
  { value: 15, label: '15 דק\'' },
  { value: 30, label: '30 דק\'' },
  { value: 45, label: '45 דק\'' },
  { value: 60, label: 'שעה' },
  { value: 90, label: 'שעה וחצי' },
  { value: 120, label: 'שעתיים' }
];

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

// =============================================
// פונקציות עזר
// =============================================

function formatDuration(minutes) {
  if (!minutes) return '';
  if (minutes < 60) return `${minutes} דק'`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}:${String(mins).padStart(2, '0')}` : `${hours} שע'`;
}

function getWeekDays() {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - dayOfWeek);
  
  const days = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    days.push({
      date: date.toISOString().split('T')[0],
      dayName: DAY_NAMES[i],
      dayOfWeek: i,
      isWeekend: i === 5 || i === 6,
      isToday: date.toDateString() === today.toDateString(),
      isPast: date < new Date(today.setHours(0,0,0,0))
    });
  }
  return days;
}

// =============================================
// קומפוננטה ראשית
// =============================================

export default function QuickWeekPlanner() {
  const { tasks, addTask, editTask, loadTasks } = useTasks();
  
  // State
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    urgency: 2, // ברירת מחדל: חשוב
    category: 'work',
    duration: 30,
    preferredDay: null, // null = שיבוץ אוטומטי
    deadline: null
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // חישוב השבוע
  const weekDays = useMemo(() => getWeekDays(), []);
  const todayStr = new Date().toISOString().split('T')[0];
  
  // תכנון שבועי
  const weekPlan = useMemo(() => {
    if (!tasks) return null;
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    return smartScheduleWeekV4(weekStart, tasks);
  }, [tasks]);
  
  // סיכום יומי
  const daySummaries = useMemo(() => {
    if (!weekPlan) return {};
    const summaries = {};
    
    weekPlan.days.forEach(day => {
      const dayTasks = (day.blocks || []).filter(b => !b.isGoogleEvent);
      const completed = dayTasks.filter(b => b.isCompleted).length;
      const total = dayTasks.length;
      const totalMinutes = dayTasks.reduce((sum, b) => sum + (b.duration || 0), 0);
      const freeMinutes = day.freeMinutes || 0;
      
      summaries[day.date] = {
        total,
        completed,
        totalMinutes,
        freeMinutes,
        usagePercent: day.usagePercent || 0,
        isOverloaded: freeMinutes < 30 && day.usagePercent > 80
      };
    });
    
    return summaries;
  }, [weekPlan]);
  
  // הוספת משימה עם שיבוץ אוטומטי
  const handleAddTask = useCallback(async () => {
    if (!newTask.title.trim()) {
      toast.error('הכניסי שם למשימה');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const urgencyLevel = URGENCY_LEVELS.find(u => u.value === newTask.urgency);
      const category = TASK_CATEGORIES.find(c => c.value === newTask.category);
      
      // חישוב תאריך מומלץ
      let suggestedDate = newTask.preferredDay;
      
      if (!suggestedDate) {
        // שיבוץ אוטומטי
        suggestedDate = findBestDay(
          weekDays,
          daySummaries,
          newTask.urgency,
          category?.isWork ?? true,
          newTask.duration,
          newTask.deadline
        );
      }
      
      // יצירת המשימה
      const taskData = {
        title: newTask.title.trim(),
        quadrant: urgencyLevel?.quadrant || 2,
        task_type: newTask.category,
        estimated_duration: newTask.duration,
        due_date: suggestedDate,
        priority: newTask.urgency === 1 ? 'urgent' : newTask.urgency === 2 ? 'high' : 'normal'
      };
      
      // הוספת דדליין אם יש
      if (newTask.deadline) {
        taskData.due_date = newTask.deadline;
      }
      
      await addTask(taskData);
      
      const dayName = weekDays.find(d => d.date === suggestedDate)?.dayName || suggestedDate;
      toast.success(`✅ "${newTask.title}" נוסף ליום ${dayName}`);
      
      // איפוס הטופס
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
              <h3 className="font-bold text-lg">תכנון השבוע</h3>
              <p className="text-white/80 text-sm">
                {weekPlan?.summary?.totalTasks || 0} משימות, {weekPlan?.summary?.unscheduledCount || 0} ממתינות
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
            {/* תצוגת שבוע מיניאטורית */}
            <div className="p-4 border-b border-gray-100 dark:border-gray-700">
              <div className="grid grid-cols-7 gap-1">
                {weekDays.map(day => {
                  const summary = daySummaries[day.date] || {};
                  const isOverloaded = summary.isOverloaded;
                  const hasSpace = summary.freeMinutes > 60;
                  
                  return (
                    <div
                      key={day.date}
                      className={`
                        p-2 rounded-lg text-center text-xs transition-all
                        ${day.isToday 
                          ? 'bg-indigo-100 dark:bg-indigo-900/30 ring-2 ring-indigo-500' 
                          : day.isPast
                            ? 'bg-gray-50 dark:bg-gray-800 opacity-50'
                            : isOverloaded
                              ? 'bg-red-50 dark:bg-red-900/20'
                              : hasSpace
                                ? 'bg-green-50 dark:bg-green-900/20'
                                : 'bg-gray-50 dark:bg-gray-700/50'
                        }
                      `}
                    >
                      <div className={`font-bold ${day.isToday ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-700 dark:text-gray-300'}`}>
                        {day.dayName.slice(0, 3)}
                      </div>
                      <div className="text-gray-500 dark:text-gray-400 mt-1">
                        {summary.total || 0}
                      </div>
                      {isOverloaded && <span className="text-red-500">⚠️</span>}
                      {hasSpace && !day.isPast && <span className="text-green-500">✓</span>}
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* כפתור הוספה מהירה */}
            {!showAddForm ? (
              <div className="p-4">
                <button
                  onClick={() => setShowAddForm(true)}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <span className="text-xl">➕</span>
                  <span>הוסף משימה לשבוע</span>
                </button>
              </div>
            ) : (
              /* טופס הוספה מהירה */
              <div className="p-4 space-y-4">
                {/* שם המשימה */}
                <div>
                  <input
                    type="text"
                    value={newTask.title}
                    onChange={e => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="מה צריך לעשות?"
                    className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:border-indigo-500 dark:focus:border-indigo-400 outline-none text-lg dark:bg-gray-700 dark:text-white"
                    autoFocus
                  />
                </div>
                
                {/* רמת דחיפות */}
                <div>
                  <label className="text-sm text-gray-600 dark:text-gray-400 block mb-2">
                    רמת דחיפות
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {URGENCY_LEVELS.map(level => (
                      <button
                        key={level.value}
                        onClick={() => setNewTask(prev => ({ ...prev, urgency: level.value }))}
                        className={`
                          p-2 rounded-lg text-center transition-all text-sm
                          ${newTask.urgency === level.value
                            ? `bg-${level.color}-100 dark:bg-${level.color}-900/30 ring-2 ring-${level.color}-500 font-bold`
                            : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'
                          }
                        `}
                      >
                        <span className="block text-lg">{level.emoji}</span>
                        <span className="text-xs text-gray-600 dark:text-gray-300">{level.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* קטגוריה */}
                <div>
                  <label className="text-sm text-gray-600 dark:text-gray-400 block mb-2">
                    סוג משימה
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {TASK_CATEGORIES.map(cat => (
                      <button
                        key={cat.value}
                        onClick={() => setNewTask(prev => ({ ...prev, category: cat.value }))}
                        className={`
                          px-3 py-2 rounded-lg flex items-center gap-1 transition-all text-sm
                          ${newTask.category === cat.value
                            ? 'bg-indigo-100 dark:bg-indigo-900/30 ring-2 ring-indigo-500 font-bold'
                            : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'
                          }
                        `}
                      >
                        <span>{cat.emoji}</span>
                        <span>{cat.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* משך זמן */}
                <div>
                  <label className="text-sm text-gray-600 dark:text-gray-400 block mb-2">
                    משך זמן משוער
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {DURATION_PRESETS.map(dur => (
                      <button
                        key={dur.value}
                        onClick={() => setNewTask(prev => ({ ...prev, duration: dur.value }))}
                        className={`
                          px-3 py-2 rounded-lg transition-all text-sm
                          ${newTask.duration === dur.value
                            ? 'bg-indigo-100 dark:bg-indigo-900/30 ring-2 ring-indigo-500 font-bold'
                            : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'
                          }
                        `}
                      >
                        {dur.label}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* יום מועדף (אופציונלי) */}
                <div>
                  <label className="text-sm text-gray-600 dark:text-gray-400 block mb-2">
                    יום מועדף (אופציונלי - אחרת שיבוץ אוטומטי)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setNewTask(prev => ({ ...prev, preferredDay: null }))}
                      className={`
                        px-3 py-2 rounded-lg transition-all text-sm
                        ${newTask.preferredDay === null
                          ? 'bg-purple-100 dark:bg-purple-900/30 ring-2 ring-purple-500 font-bold'
                          : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'
                        }
                      `}
                    >
                      🤖 אוטומטי
                    </button>
                    {weekDays.filter(d => !d.isPast).map(day => (
                      <button
                        key={day.date}
                        onClick={() => setNewTask(prev => ({ ...prev, preferredDay: day.date }))}
                        className={`
                          px-3 py-2 rounded-lg transition-all text-sm
                          ${newTask.preferredDay === day.date
                            ? 'bg-indigo-100 dark:bg-indigo-900/30 ring-2 ring-indigo-500 font-bold'
                            : day.isToday
                              ? 'bg-blue-50 dark:bg-blue-900/20'
                              : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'
                          }
                        `}
                      >
                        {day.dayName}
                        {day.isToday && ' (היום)'}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* דדליין (אופציונלי) */}
                <div>
                  <label className="text-sm text-gray-600 dark:text-gray-400 block mb-2">
                    דדליין (אופציונלי)
                  </label>
                  <input
                    type="date"
                    value={newTask.deadline || ''}
                    onChange={e => setNewTask(prev => ({ ...prev, deadline: e.target.value || null }))}
                    min={todayStr}
                    className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
                
                {/* כפתורי פעולה */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowAddForm(false)}
                    className="flex-1 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    ביטול
                  </button>
                  <button
                    onClick={handleAddTask}
                    disabled={isSubmitting || !newTask.title.trim()}
                    className={`
                      flex-1 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2
                      ${isSubmitting || !newTask.title.trim()
                        ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 cursor-not-allowed'
                        : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-md hover:shadow-lg'
                      }
                    `}
                  >
                    {isSubmitting ? (
                      <>
                        <span className="animate-spin">⏳</span>
                        <span>מוסיף...</span>
                      </>
                    ) : (
                      <>
                        <span>✅</span>
                        <span>הוסף משימה</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
            
            {/* קישור לתכנון מלא */}
            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700">
              <a
                href="/planner"
                className="flex items-center justify-center gap-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium"
              >
                <span>📊</span>
                <span>לתצוגת שבוע מלאה</span>
                <span>→</span>
              </a>
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
  
  // סינון ימים אפשריים
  const availableDays = weekDays.filter(day => {
    // לא ימים שעברו
    if (day.isPast) return false;
    
    // אם יש דדליין, רק ימים לפניו
    if (deadline && day.date > deadline) return false;
    
    // משימות עבודה לא בסוף שבוע
    if (isWorkTask && day.isWeekend) return false;
    
    return true;
  });
  
  if (availableDays.length === 0) {
    return today; // ברירת מחדל
  }
  
  // דירוג הימים
  const scoredDays = availableDays.map(day => {
    const summary = daySummaries[day.date] || { freeMinutes: 480, usagePercent: 0 };
    let score = 0;
    
    // עדיפות לימים עם מקום פנוי
    if (summary.freeMinutes >= duration) {
      score += 50;
    }
    if (summary.freeMinutes >= duration * 2) {
      score += 20; // בונוס ליום עם הרבה מקום
    }
    
    // עדיפות לימים פחות עמוסים
    score -= summary.usagePercent / 2;
    
    // עדיפות לפי דחיפות
    if (urgency === 1) {
      // דחוף וחשוב - היום או מחר
      if (day.isToday) score += 100;
      else if (day.date === getNextDay(today)) score += 80;
    } else if (urgency === 2) {
      // חשוב - מחר או מחרתיים
      if (day.date === getNextDay(today)) score += 50;
      else if (day.date === getNextDay(getNextDay(today))) score += 40;
    } else if (urgency === 3) {
      // דחוף לא חשוב - היום
      if (day.isToday) score += 60;
    }
    // רגיל - לא משנה, לפי מקום פנוי
    
    // עדיפות לאמצע השבוע (פחות עומס בקצוות)
    if (day.dayOfWeek >= 1 && day.dayOfWeek <= 3) {
      score += 10;
    }
    
    return { ...day, score };
  });
  
  // מיון לפי ציון
  scoredDays.sort((a, b) => b.score - a.score);
  
  return scoredDays[0]?.date || today;
}

function getNextDay(dateStr) {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + 1);
  return date.toISOString().split('T')[0];
}
