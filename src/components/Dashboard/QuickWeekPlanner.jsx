/**
 * QuickWeekPlanner - תכנון שבועי מהיר בדשבורד
 * ============================================
 * מציג סקירת שבוע ומאפשר הוספת משימות דרך SimpleTaskForm הרגיל
 * ✅ חדש: כפתור לאשף תכנון שבועי אינטראקטיבי
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useTasks } from '../../hooks/useTasks';
import { smartScheduleWeekV4 } from '../../utils/smartSchedulerV4';
import SimpleTaskForm from '../DailyView/SimpleTaskForm';
import Modal from '../UI/Modal';
import WeeklyPlanningWizard from '../ADHD/WeeklyPlanningWizard'; // 🆕 אשף תכנון

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
      monthName: date.toLocaleDateString('he-IL', { month: 'short' }),
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
  const [weekOffset, setWeekOffset] = useState(0);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [showPlanningWizard, setShowPlanningWizard] = useState(false); // 🆕 אשף תכנון
  
  // חישוב השבוע לפי offset
  const weekDays = useMemo(() => getWeekDays(weekOffset), [weekOffset]);
  
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
      const completed = dayTasks.filter(b => b.isCompleted).length;
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
  
  // פתיחת טופס הוספה
  const handleAddTask = (date) => {
    setSelectedDate(date);
    setShowTaskForm(true);
  };
  
  // סגירת טופס
  const handleCloseForm = () => {
    setShowTaskForm(false);
    setSelectedDate(null);
    loadTasks();
  };
  
  // =============================================
  // רנדור
  // =============================================
  
  return (
    <>
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
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-lg">תכנון שבועי</h3>
                  {/* 🆕 כפתור אשף תכנון */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowPlanningWizard(true);
                    }}
                    className="px-2 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-medium transition-colors"
                  >
                    ✨ אשף תכנון
                  </button>
                </div>
                <p className="text-white/80 text-sm">
                  {weekPlan?.summary?.totalTasks || 0} משימות
                  {(weekPlan?.summary?.unscheduledCount || 0) > 0 && 
                    ` • ${weekPlan.summary.unscheduledCount} ממתינות`
                  }
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
              
              {/* תצוגת שבוע - כרטיסיות ימים */}
              <div className="p-4">
                <div className="grid grid-cols-7 gap-2">
                  {weekDays.map(day => {
                    const summary = daySummaries[day.date] || {};
                    const isOverloaded = summary.isOverloaded;
                    const hasSpace = (summary.freeMinutes || 480) > 60;
                    const completedPercent = summary.total > 0 
                      ? Math.round((summary.completed / summary.total) * 100) 
                      : 0;
                    
                    return (
                      <button
                        key={day.date}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!day.isPast) {
                            handleAddTask(day.date);
                          }
                        }}
                        disabled={day.isPast}
                        className={`
                          relative p-2 rounded-xl text-center transition-all
                          ${day.isPast 
                            ? 'opacity-40 cursor-not-allowed bg-gray-100 dark:bg-gray-800' 
                            : 'hover:scale-105 hover:shadow-md cursor-pointer'
                          }
                          ${day.isToday 
                            ? 'bg-indigo-100 dark:bg-indigo-900/40 ring-2 ring-indigo-500' 
                            : isOverloaded
                              ? 'bg-red-50 dark:bg-red-900/20'
                              : hasSpace
                                ? 'bg-green-50 dark:bg-green-900/20'
                                : 'bg-gray-50 dark:bg-gray-700/50'
                          }
                        `}
                      >
                        {/* שם היום */}
                        <div className={`text-xs font-bold ${
                          day.isToday ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-600 dark:text-gray-300'
                        }`}>
                          {day.isToday ? 'היום' : day.dayName.slice(0, 2)}
                        </div>
                        
                        {/* תאריך */}
                        <div className={`text-lg font-bold ${
                          day.isToday ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-800 dark:text-white'
                        }`}>
                          {day.dayNumber}
                        </div>
                        
                        {/* מספר משימות */}
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {summary.total || 0} משימות
                        </div>
                        
                        {/* אינדיקטורים */}
                        {!day.isPast && (
                          <div className="mt-1 flex justify-center gap-1">
                            {isOverloaded && <span className="text-xs">⚠️</span>}
                            {hasSpace && <span className="text-xs text-green-500">✓</span>}
                          </div>
                        )}
                        
                        {/* פס התקדמות (רק לימים שעברו או היום) */}
                        {(day.isPast || day.isToday) && summary.total > 0 && (
                          <div className="mt-1 h-1 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-green-500"
                              style={{ width: `${completedPercent}%` }}
                            />
                          </div>
                        )}
                        
                        {/* כפתור הוספה (רק על hover) */}
                        {!day.isPast && (
                          <div className="absolute inset-0 bg-indigo-500/80 rounded-xl opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="text-white text-2xl">+</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
                
                {/* הסבר */}
                <p className="text-xs text-gray-400 text-center mt-3">
                  💡 לחצי על יום להוספת משימה
                </p>
              </div>
              
              {/* כפתור הוספה כללי */}
              <div className="px-4 pb-4">
                <button
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    // מציאת היום הראשון שלא עבר
                    const firstAvailable = weekDays.find(d => !d.isPast);
                    if (firstAvailable) {
                      handleAddTask(firstAvailable.date);
                    }
                  }}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <span className="text-xl">➕</span>
                  <span>הוסף משימה ל{getWeekLabel(weekOffset)}</span>
                </button>
              </div>
              
              {/* קישור לתצוגה מלאה */}
              <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700">
                <Link
                  to="/weekly"
                  className="flex items-center justify-center gap-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 font-medium"
                  onClick={(e) => e.stopPropagation()}
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
      
      {/* מודאל הוספת משימה - משתמש בטופס הרגיל */}
      <Modal
        isOpen={showTaskForm}
        onClose={handleCloseForm}
        title="הוספת משימה חדשה"
      >
        <SimpleTaskForm
          selectedDate={selectedDate}
          onClose={handleCloseForm}
          onSuccess={handleCloseForm}
        />
      </Modal>

      {/* 🆕 אשף תכנון שבועי אינטראקטיבי */}
      {showPlanningWizard && (
        <WeeklyPlanningWizard
          existingTasks={tasks}
          onSave={(newTasks) => {
            // שמירת המשימות החדשות
            newTasks.forEach(task => {
              addTask(task);
            });
            setShowPlanningWizard(false);
          }}
          onClose={() => setShowPlanningWizard(false)}
        />
      )}
    </>
  );
}
