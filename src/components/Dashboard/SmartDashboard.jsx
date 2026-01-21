/**
 * SmartDashboard - מרכז הפיקוד
 * ==============================
 * הדשבורד הוא המקום המרכזי לניהול:
 * - ראיית משימות היום + פעולות מלאות
 * - תצוגת שבוע עם מספרים ברורים
 * - המלצות AI
 * - תכנון ושינויים
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useTasks } from '../../hooks/useTasks';
import { useAuth } from '../../hooks/useAuth';
import SimpleTaskForm from '../DailyView/SimpleTaskForm';
import SmartRecommendationsPanel from './SmartRecommendationsPanel';
import DailyProgressCard from './DailyProgressCard';
import Modal from '../UI/Modal';
import toast from 'react-hot-toast';
import { supabase } from '../../services/supabase';

// ========================================
// עזרים
// ========================================

const QUOTES = [
  { text: "הדרך להתחיל היא להפסיק לדבר ולהתחיל לעשות.", author: "וולט דיסני" },
  { text: "כל מה שאת יכולה לדמיין - את יכולה להשיג.", author: "נפוליאון היל" },
  { text: "אל תמתיני להזדמנות. צרי אותה.", author: "ג'ורג' ברנרד שו" },
  { text: "התחילי מאיפה שאת נמצאת. עשי מה שאת יכולה.", author: "ארתור אש" },
  { text: "הכי קשה זה להתחיל. אחרי זה הכל זורם.", author: "אנונימי" },
];

function getDailyQuote() {
  const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  return QUOTES[dayOfYear % QUOTES.length];
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'בוקר טוב';
  if (hour < 17) return 'צהריים טובים';
  if (hour < 21) return 'ערב טוב';
  return 'לילה טוב';
}

function formatMinutes(minutes) {
  if (!minutes || minutes === 0) return '0 דק׳';
  if (minutes < 60) return `${minutes} דק׳`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}:${mins.toString().padStart(2, '0')}` : `${hours} שע׳`;
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

const HEBREW_DAYS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
const HEBREW_DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

// ========================================
// קומפוננטת משימה לדשבורד - עם כפתורים בולטים
// ========================================

function DashboardTaskCard({ task, onEdit, onComplete, onDefer, onDelete, isOverdue = false }) {
  const isCompleted = task.is_completed;
  const isUrgent = task.priority === 'urgent';
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl p-4 transition-all ${
        isCompleted 
          ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' 
          : isOverdue
            ? 'bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-700'
            : isUrgent
              ? 'bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-300 dark:border-orange-700'
              : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
      }`}
    >
      {/* שורה עליונה - תוכן המשימה */}
      <div className="flex items-start gap-3 mb-3">
        {/* צ'קבוקס */}
        <button
          onClick={() => onComplete(task.id)}
          className={`mt-1 w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
            isCompleted 
              ? 'bg-green-500 border-green-500 text-white' 
              : 'border-gray-300 dark:border-gray-500 hover:border-green-500 hover:bg-green-50'
          }`}
        >
          {isCompleted && '✓'}
        </button>
        
        {/* תוכן */}
        <div className="flex-1 min-w-0">
          <div className={`font-medium ${isCompleted ? 'line-through text-gray-400' : 'text-gray-900 dark:text-white'}`}>
            {isUrgent && !isCompleted && <span className="text-red-500">🔥 </span>}
            {isOverdue && !isCompleted && <span className="text-red-500 text-sm">[{task.due_date}] </span>}
            {task.title}
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-500 mt-1 flex-wrap">
            {task.due_time && <span>🕐 {task.due_time}</span>}
            <span>⏱️ {task.estimated_duration || 30} דק׳</span>
            {task.time_spent > 0 && (
              <span className="text-green-600">✓ עבדת {task.time_spent} דק׳</span>
            )}
            {task.task_type && (
              <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">{task.task_type}</span>
            )}
          </div>
        </div>
      </div>
      
      {/* שורה תחתונה - כפתורי פעולה (תמיד נראים!) */}
      {!isCompleted && (
        <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
          <Link
            to="/daily"
            className="flex-1 py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <span>▶️</span>
            <span>לתצוגה יומית</span>
          </Link>
          <button
            onClick={() => onEdit(task)}
            className="px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
            title="ערכי"
          >
            ✏️
          </button>
          <button
            onClick={() => onDefer(task)}
            className="px-4 py-2.5 bg-yellow-100 dark:bg-yellow-900/30 hover:bg-yellow-200 dark:hover:bg-yellow-800/30 text-yellow-700 dark:text-yellow-400 rounded-lg transition-colors"
            title="דחי למחר"
          >
            ➡️
          </button>
          <button
            onClick={() => onDelete(task.id)}
            className="px-4 py-2.5 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-800/30 text-red-600 rounded-lg transition-colors"
            title="מחקי"
          >
            🗑️
          </button>
        </div>
      )}
    </motion.div>
  );
}

// ========================================
// קומפוננטה ראשית
// ========================================

function SmartDashboard() {
  const { tasks, loading, toggleComplete, editTask, addTask, removeTask, loadTasks, dataVersion, updateTaskTime } = useTasks();
  const { user } = useAuth();
  
  // State
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [activeTimer, setActiveTimer] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [selectedDay, setSelectedDay] = useState(null); // לתצוגת משימות של יום ספציפי
  const [showRecommendations, setShowRecommendations] = useState(false);
  
  const today = new Date();
  const todayISO = today.toISOString().split('T')[0];
  const tomorrowISO = new Date(today.getTime() + 86400000).toISOString().split('T')[0];

  // ========================================
  // חישובים
  // ========================================

  // משימות באיחור
  const overdueTasks = useMemo(() => {
    if (!tasks) return [];
    return tasks.filter(t => 
      !t.is_completed && !t.deleted_at && t.due_date && t.due_date < todayISO
    ).sort((a, b) => a.due_date.localeCompare(b.due_date));
  }, [tasks, todayISO]);

  // משימות היום
  const todayTasks = useMemo(() => {
    if (!tasks) return { remaining: [], completed: [] };
    const all = tasks.filter(t => t.due_date === todayISO && !t.deleted_at);
    return {
      remaining: all.filter(t => !t.is_completed).sort((a, b) => {
        if (a.priority === 'urgent' && b.priority !== 'urgent') return -1;
        if (b.priority === 'urgent' && a.priority !== 'urgent') return 1;
        if (a.due_time && b.due_time) return a.due_time.localeCompare(b.due_time);
        return 0;
      }),
      completed: all.filter(t => t.is_completed)
    };
  }, [tasks, todayISO]);

  // סטטיסטיקות
  const stats = useMemo(() => {
    const total = todayTasks.remaining.length + todayTasks.completed.length;
    const completed = todayTasks.completed.length;
    const minutesLeft = todayTasks.remaining.reduce((sum, t) => sum + (t.estimated_duration || 30), 0);
    const timeSpent = [...todayTasks.remaining, ...todayTasks.completed].reduce((sum, t) => sum + (t.time_spent || 0), 0);
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    return { total, completed, remaining: todayTasks.remaining.length, minutesLeft, timeSpent, progress, overdue: overdueTasks.length };
  }, [todayTasks, overdueTasks, dataVersion]); // 🔧 תיקון: תלוי ב-dataVersion לסנכרון

  // נתוני שבוע
  const weekData = useMemo(() => {
    if (!tasks) return { days: [], totalCompleted: 0, totalTasks: 0, totalMinutes: 0 };
    
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    
    const days = [];
    let totalCompleted = 0;
    let totalTasks = 0;
    let totalMinutes = 0;
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      const dateISO = date.toISOString().split('T')[0];
      
      const dayTasks = tasks.filter(t => t.due_date === dateISO && !t.deleted_at);
      const completed = dayTasks.filter(t => t.is_completed).length;
      const total = dayTasks.length;
      const minutes = dayTasks.reduce((sum, t) => sum + (t.time_spent || 0), 0);
      
      totalCompleted += completed;
      totalTasks += total;
      totalMinutes += minutes;
      
      days.push({
        date: dateISO,
        dateNum: date.getDate(),
        dayName: HEBREW_DAYS[date.getDay()],
        dayFullName: HEBREW_DAY_NAMES[date.getDay()],
        total,
        completed,
        remaining: total - completed,
        minutes,
        isToday: dateISO === todayISO,
        isPast: dateISO < todayISO,
        tasks: dayTasks
      });
    }
    
    return { days, totalCompleted, totalTasks, totalMinutes };
  }, [tasks, today, todayISO]);

  // משימות של יום נבחר
  const selectedDayTasks = useMemo(() => {
    if (!selectedDay) return null;
    const day = weekData.days.find(d => d.date === selectedDay);
    if (!day) return null;
    return {
      ...day,
      remaining: day.tasks.filter(t => !t.is_completed),
      completed: day.tasks.filter(t => t.is_completed)
    };
  }, [selectedDay, weekData]);

  // ========================================
  // טיימר פעיל
  // ========================================

  useEffect(() => {
    const checkActiveTimer = () => {
      const activeTaskId = localStorage.getItem('zmanit_active_timer');
      if (activeTaskId && tasks) {
        const task = tasks.find(t => t.id === activeTaskId);
        if (task) {
          setActiveTimer(task);
          try {
            const saved = localStorage.getItem(`timer_v2_${activeTaskId}`);
            if (saved) {
              const data = JSON.parse(saved);
              if (data.isRunning && data.startTime) {
                // 🔧 תיקון: המרה נכונה של startTime מ-string ל-Date
                const startTime = new Date(data.startTime).getTime();
                const totalInterruption = (data.totalInterruptionSeconds || 0) * 1000;
                setElapsedSeconds(Math.floor((Date.now() - startTime - totalInterruption) / 1000));
              }
            }
          } catch (e) {}
        } else {
          setActiveTimer(null);
        }
      } else {
        setActiveTimer(null);
      }
    };
    
    checkActiveTimer();
    const interval = setInterval(checkActiveTimer, 1000);
    return () => clearInterval(interval);
  }, [tasks]);

  // ========================================
  // פעולות
  // ========================================

  const handleComplete = useCallback(async (taskId) => {
    try {
      await toggleComplete(taskId);
      toast.success('✅ כל הכבוד!');
    } catch (e) {
      toast.error('שגיאה');
    }
  }, [toggleComplete]);

  const handleEdit = useCallback((task) => {
    setEditingTask(task);
    setShowTaskForm(true);
  }, []);

  const handleDefer = useCallback(async (task) => {
    try {
      await editTask(task.id, { due_date: tomorrowISO, due_time: null });
      toast.success('➡️ נדחה למחר');
    } catch (e) {
      toast.error('שגיאה');
    }
  }, [editTask, tomorrowISO]);

  const handleDelete = useCallback(async (taskId) => {
    if (window.confirm('למחוק את המשימה?')) {
      try {
        await removeTask(taskId);
        toast.success('🗑️ נמחק');
      } catch (e) {
        toast.error('שגיאה');
      }
    }
  }, [removeTask]);

  const handleMoveAllOverdueToToday = useCallback(async () => {
    try {
      for (const task of overdueTasks) {
        await editTask(task.id, { due_date: todayISO });
      }
      toast.success(`${overdueTasks.length} משימות הועברו להיום`);
    } catch (e) {
      toast.error('שגיאה');
    }
  }, [overdueTasks, editTask, todayISO]);

  // ========================================
  // רינדור
  // ========================================

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">⏳</div>
          <p className="text-gray-500">טוען...</p>
        </div>
      </div>
    );
  }

  const quote = getDailyQuote();
  const userName = user?.user_metadata?.full_name?.split(' ')[0] || '';

  return (
    <div dir="rtl" className="min-h-screen bg-gray-100 dark:bg-gray-900">
      
      {/* ===== טיימר פעיל (Sticky) ===== */}
      {activeTimer && (
        <div className="sticky top-0 z-50 bg-emerald-600 text-white shadow-lg">
          <div className="max-w-6xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="text-3xl font-mono font-bold">{formatTime(elapsedSeconds)}</div>
                <div>
                  <div className="text-sm opacity-80">עובדת על:</div>
                  <div className="font-bold">{activeTimer.title}</div>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => { localStorage.removeItem('zmanit_active_timer'); setActiveTimer(null); toast('⏹️ טיימר נעצר'); }}
                  className="px-3 py-2 bg-white/20 hover:bg-white/30 rounded-xl transition-colors"
                >
                  ⏹️
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 py-6">
        
        {/* ===== Header ===== */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
              {getGreeting()}{userName ? `, ${userName}` : ''}! 👋
            </h1>
            <p className="text-gray-500 mt-1">
              יום {HEBREW_DAY_NAMES[today.getDay()]}, {today.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          
          {/* כפתורי פעולה מהירים */}
          <div className="flex gap-2">
            <button
              onClick={() => { setEditingTask(null); setShowTaskForm(true); }}
              className="px-5 py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl shadow-md transition-all flex items-center gap-2"
            >
              ➕ משימה חדשה
            </button>
            <button
              onClick={() => { setEditingTask({ priority: 'urgent', due_date: todayISO }); setShowTaskForm(true); }}
              className="px-5 py-3 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white font-bold rounded-xl shadow-md transition-all flex items-center gap-2"
            >
              🚨 בלת״ם
            </button>
          </div>
        </div>

        {/* ===== ציטוט ===== */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-4 text-white shadow-md mb-6">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💡</span>
            <div>
              <p className="font-medium">"{quote.text}"</p>
              <p className="text-indigo-200 text-sm mt-1">— {quote.author}</p>
            </div>
          </div>
        </div>

        {/* ===== Layout ראשי ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* ===== עמודה שמאלית - משימות היום ===== */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* ✅ כרטיס התקדמות יומית חדש */}
            <DailyProgressCard tasks={tasks} currentTime={new Date().toTimeString().slice(0,5)} />

            {/* משימות באיחור */}
            {overdueTasks.length > 0 && (
              <div className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-5 border-2 border-red-200 dark:border-red-800">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-red-700 dark:text-red-400">
                    🔥 באיחור ({overdueTasks.length})
                  </h2>
                  <button
                    onClick={handleMoveAllOverdueToToday}
                    className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-xl"
                  >
                    העבר הכל להיום
                  </button>
                </div>
                <div className="space-y-3">
                  {overdueTasks.map(task => (
                    <DashboardTaskCard
                      key={task.id}
                      task={task}
                      isOverdue={true}
                      onEdit={handleEdit}
                      onComplete={handleComplete}
                      onDefer={handleDefer}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* משימות היום */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-800 dark:text-white">
                  📋 המשימות להיום ({stats.total})
                </h2>
                <Link to="/daily" className="text-indigo-500 text-sm hover:underline">
                  תצוגה מלאה →
                </Link>
              </div>
              
              {todayTasks.remaining.length === 0 && todayTasks.completed.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-5xl mb-3">📭</div>
                  <p className="text-gray-500 mb-4">אין משימות להיום</p>
                  <button
                    onClick={() => { setEditingTask(null); setShowTaskForm(true); }}
                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl"
                  >
                    ➕ הוסיפי משימה
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {todayTasks.remaining.map(task => (
                    <DashboardTaskCard
                      key={task.id}
                      task={task}
                      onEdit={handleEdit}
                      onComplete={handleComplete}
                      onDefer={handleDefer}
                      onDelete={handleDelete}
                    />
                  ))}
                  
                  {todayTasks.completed.length > 0 && (
                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                      <div className="text-sm text-gray-500 mb-3">✅ הושלמו ({todayTasks.completed.length})</div>
                      {todayTasks.completed.slice(0, 3).map(task => (
                        <DashboardTaskCard
                          key={task.id}
                          task={task}
                          onEdit={handleEdit}
                          onComplete={handleComplete}
                          onDefer={handleDefer}
                          onDelete={handleDelete}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ===== עמודה ימנית - שבוע + המלצות ===== */}
          <div className="space-y-6">
            
            {/* תצוגת שבוע */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-800 dark:text-white">🗓️ השבוע</h2>
                <Link to="/weekly" className="text-indigo-500 text-sm hover:underline">תכנון →</Link>
              </div>
              
              {/* סיכום שבועי */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="bg-indigo-50 dark:bg-indigo-900/30 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-indigo-600">{weekData.totalCompleted}/{weekData.totalTasks}</div>
                  <div className="text-xs text-indigo-700 dark:text-indigo-300">משימות</div>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/30 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-purple-600">{formatMinutes(weekData.totalMinutes)}</div>
                  <div className="text-xs text-purple-700 dark:text-purple-300">עבודה</div>
                </div>
              </div>
              
              {/* ימי השבוע */}
              <div className="space-y-2">
                {weekData.days.map(day => (
                  <button
                    key={day.date}
                    onClick={() => setSelectedDay(selectedDay === day.date ? null : day.date)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                      day.isToday 
                        ? 'bg-indigo-100 dark:bg-indigo-900/50 border-2 border-indigo-400' 
                        : selectedDay === day.date
                          ? 'bg-gray-100 dark:bg-gray-700 border-2 border-gray-300'
                          : 'bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                        day.isToday 
                          ? 'bg-indigo-500 text-white' 
                          : day.total > 0 && day.completed === day.total
                            ? 'bg-green-500 text-white'
                            : day.isPast && day.remaining > 0
                              ? 'bg-red-100 text-red-600'
                              : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                      }`}>
                        {day.dateNum}
                      </div>
                      <div className="text-right">
                        <div className={`font-medium ${day.isToday ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-700 dark:text-gray-300'}`}>
                          {day.dayFullName}
                        </div>
                        <div className="text-xs text-gray-500">
                          {day.minutes > 0 && `${formatMinutes(day.minutes)} עבודה`}
                        </div>
                      </div>
                    </div>
                    
                    {/* מספרי משימות */}
                    <div className="flex items-center gap-2">
                      {day.total === 0 ? (
                        <span className="text-gray-400 text-sm">—</span>
                      ) : day.completed === day.total ? (
                        <span className="text-green-500 font-bold">✓ {day.total}</span>
                      ) : (
                        <>
                          <span className={`px-2 py-1 rounded text-sm font-medium ${
                            day.remaining > 0 && day.isPast 
                              ? 'bg-red-100 text-red-600' 
                              : 'bg-blue-100 text-blue-600'
                          }`}>
                            {day.remaining} נותרו
                          </span>
                          {day.completed > 0 && (
                            <span className="text-green-500 text-sm">✓{day.completed}</span>
                          )}
                        </>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* משימות של יום נבחר */}
            <AnimatePresence>
              {selectedDayTasks && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm"
                >
                  <h3 className="font-bold text-gray-800 dark:text-white mb-3">
                    📋 {selectedDayTasks.dayFullName} ({selectedDayTasks.total} משימות)
                  </h3>
                  {selectedDayTasks.remaining.length === 0 && selectedDayTasks.completed.length === 0 ? (
                    <p className="text-gray-500 text-sm">אין משימות ביום זה</p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {selectedDayTasks.remaining.map(task => (
                        <div key={task.id} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm">
                          <span className="text-blue-500">○</span>
                          <span className="flex-1 truncate">{task.title}</span>
                          <button onClick={() => handleEdit(task)} className="text-gray-400 hover:text-gray-600">✏️</button>
                        </div>
                      ))}
                      {selectedDayTasks.completed.map(task => (
                        <div key={task.id} className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg text-sm opacity-60">
                          <span className="text-green-500">✓</span>
                          <span className="flex-1 truncate line-through">{task.title}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* המלצות AI */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-gray-800 dark:text-white">💡 המלצות</h2>
                <button 
                  onClick={() => setShowRecommendations(true)}
                  className="text-indigo-500 text-sm hover:underline"
                >
                  הכל →
                </button>
              </div>
              
              {/* המלצות מהירות */}
              <div className="space-y-2">
                {stats.overdue > 0 && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-sm">
                    <span>🔥</span>
                    <span className="flex-1">יש לך {stats.overdue} משימות באיחור</span>
                    <button onClick={handleMoveAllOverdueToToday} className="text-red-600 font-medium">טפלי</button>
                  </div>
                )}
                {stats.minutesLeft > 480 && (
                  <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-sm">
                    <span>⚠️</span>
                    <span className="flex-1">יותר מ-8 שעות עבודה היום - אולי לדחות?</span>
                    <Link to="/daily" className="text-yellow-600 font-medium">צפי</Link>
                  </div>
                )}
                {stats.progress === 100 && stats.total > 0 && (
                  <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-sm">
                    <span>🎉</span>
                    <span className="flex-1">סיימת הכל להיום! מדהים!</span>
                  </div>
                )}
              </div>
            </div>

            {/* ניווט מהיר */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm">
              <div className="grid grid-cols-3 gap-2">
                <Link to="/daily" className="p-3 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-xl text-center transition-colors">
                  <span className="text-xl block">📋</span>
                  <span className="text-xs text-gray-600 dark:text-gray-400">יומי</span>
                </Link>
                <Link to="/weekly" className="p-3 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-xl text-center transition-colors">
                  <span className="text-xl block">🗓️</span>
                  <span className="text-xs text-gray-600 dark:text-gray-400">שבועי</span>
                </Link>
                <Link to="/focus" className="p-3 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-xl text-center transition-colors">
                  <span className="text-xl block">🎯</span>
                  <span className="text-xs text-gray-600 dark:text-gray-400">מיקוד</span>
                </Link>
                <Link to="/insights" className="p-3 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-xl text-center transition-colors">
                  <span className="text-xl block">📊</span>
                  <span className="text-xs text-gray-600 dark:text-gray-400">תובנות</span>
                </Link>
                <Link to="/settings" className="p-3 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-xl text-center transition-colors">
                  <span className="text-xl block">⚙️</span>
                  <span className="text-xs text-gray-600 dark:text-gray-400">הגדרות</span>
                </Link>
                <button 
                  onClick={() => setShowRecommendations(true)}
                  className="p-3 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-xl text-center transition-colors"
                >
                  <span className="text-xl block">💡</span>
                  <span className="text-xs text-gray-600 dark:text-gray-400">AI</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== מודלים ===== */}
      
      {/* טופס משימה */}
      <Modal
        isOpen={showTaskForm}
        onClose={() => { setShowTaskForm(false); setEditingTask(null); }}
        title={editingTask?.id ? 'עריכת משימה' : editingTask?.priority === 'urgent' ? '🚨 בלת״ם חדש' : 'משימה חדשה'}
        maxWidth="max-w-lg"
      >
        <SimpleTaskForm
          task={editingTask}
          onSave={async (taskData) => {
            try {
              if (editingTask?.id) {
                await editTask(editingTask.id, taskData);
                toast.success('✅ משימה עודכנה');
              } else {
                await addTask(taskData);
                toast.success('✅ משימה נוספה');
              }
              setShowTaskForm(false);
              setEditingTask(null);
              loadTasks();
            } catch (e) {
              toast.error('שגיאה');
            }
          }}
          onCancel={() => { setShowTaskForm(false); setEditingTask(null); }}
        />
      </Modal>

      {/* המלצות מלאות */}
      <Modal
        isOpen={showRecommendations}
        onClose={() => setShowRecommendations(false)}
        title="💡 המלצות חכמות"
        maxWidth="max-w-2xl"
      >
        <SmartRecommendationsPanel 
          tasks={tasks}
          onUpdateTask={editTask}
          onAddTask={addTask}
          onRefresh={loadTasks}
        />
      </Modal>
    </div>
  );
}

export default SmartDashboard;
