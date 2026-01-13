/**
 * SmartDashboard - דשבורד נקי ופונקציונלי
 * =========================================
 * מסונכרן עם כל המערכת דרך:
 * - useTasks hook
 * - DailyTaskCard (אותו כרטיס כמו בתצוגה יומית)
 * - SimpleTaskForm (אותו טופס)
 * - FullScreenFocus (אותו מסך מיקוד)
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useTasks } from '../../hooks/useTasks';
import { useAuth } from '../../hooks/useAuth';
import DailyTaskCard from '../DailyView/DailyTaskCard';
import SimpleTaskForm from '../DailyView/SimpleTaskForm';
import FullScreenFocus from '../ADHD/FullScreenFocus';
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
  { text: "הדרך היחידה לעשות עבודה נהדרת היא לאהוב את מה שאת עושה.", author: "סטיב ג'ובס" },
  { text: "זה לא משנה כמה לאט את הולכת, כל עוד את לא עוצרת.", author: "קונפוציוס" },
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
// קומפוננטה ראשית
// ========================================

function SmartDashboard() {
  const { tasks, loading, toggleComplete, editTask, addTask, removeTask, loadTasks } = useTasks();
  const { user } = useAuth();
  
  // State
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [showFocus, setShowFocus] = useState(false);
  const [focusTask, setFocusTask] = useState(null);
  const [activeTimer, setActiveTimer] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [quickNote, setQuickNote] = useState('');
  const [notes, setNotes] = useState([]);
  
  const today = new Date();
  const todayISO = today.toISOString().split('T')[0];

  // טעינת פתקים מ-localStorage
  useEffect(() => {
    const saved = localStorage.getItem('zmanit_quick_notes');
    if (saved) {
      try { setNotes(JSON.parse(saved)); } catch (e) {}
    }
  }, []);

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
  const todayAllTasks = useMemo(() => {
    if (!tasks) return [];
    return tasks.filter(t => t.due_date === todayISO && !t.deleted_at);
  }, [tasks, todayISO]);

  const todayRemaining = useMemo(() => {
    return todayAllTasks.filter(t => !t.is_completed).sort((a, b) => {
      if (a.priority === 'urgent' && b.priority !== 'urgent') return -1;
      if (b.priority === 'urgent' && a.priority !== 'urgent') return 1;
      if (a.due_time && b.due_time) return a.due_time.localeCompare(b.due_time);
      if (a.due_time) return -1;
      return 0;
    });
  }, [todayAllTasks]);

  const todayCompleted = useMemo(() => {
    return todayAllTasks.filter(t => t.is_completed);
  }, [todayAllTasks]);

  // המשימה הבאה
  const nextTask = useMemo(() => {
    if (overdueTasks.length > 0) return overdueTasks[0];
    return todayRemaining[0] || null;
  }, [overdueTasks, todayRemaining]);

  // סטטיסטיקות
  const stats = useMemo(() => {
    const completed = todayCompleted.length;
    const total = todayAllTasks.length;
    const remaining = todayRemaining.length;
    const minutesLeft = todayRemaining.reduce((sum, t) => sum + (t.estimated_duration || 30), 0);
    const timeSpentToday = todayAllTasks.reduce((sum, t) => sum + (t.time_spent || 0), 0);
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    return { completed, total, remaining, minutesLeft, timeSpentToday, progress, overdue: overdueTasks.length };
  }, [todayAllTasks, todayCompleted, todayRemaining, overdueTasks]);

  // סטטיסטיקות שבוע
  const weekStats = useMemo(() => {
    if (!tasks) return { days: [], streak: 0, totalCompleted: 0, totalTasks: 0, totalMinutes: 0, mostProductiveDay: null };
    
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    
    const days = [];
    let totalCompleted = 0;
    let totalTasks = 0;
    let totalMinutes = 0;
    let maxCompleted = 0;
    let mostProductiveDay = null;
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      const dateISO = date.toISOString().split('T')[0];
      
      const dayTasks = tasks.filter(t => t.due_date === dateISO && !t.deleted_at);
      const completed = dayTasks.filter(t => t.is_completed).length;
      const minutes = dayTasks.reduce((sum, t) => sum + (t.time_spent || 0), 0);
      
      totalCompleted += completed;
      totalTasks += dayTasks.length;
      totalMinutes += minutes;
      
      if (completed > maxCompleted) {
        maxCompleted = completed;
        mostProductiveDay = HEBREW_DAY_NAMES[date.getDay()];
      }
      
      days.push({
        day: HEBREW_DAYS[date.getDay()],
        dayName: HEBREW_DAY_NAMES[date.getDay()],
        date: dateISO,
        dateNum: date.getDate(),
        completed,
        total: dayTasks.length,
        minutes,
        isToday: dateISO === todayISO,
        isPast: dateISO < todayISO
      });
    }
    
    // חישוב streak
    let streak = 0;
    const checkDate = new Date(today);
    while (streak < 100) {
      const dateISO = checkDate.toISOString().split('T')[0];
      const dayTasks = tasks.filter(t => t.due_date === dateISO && !t.deleted_at);
      const dayCompleted = dayTasks.filter(t => t.is_completed).length;
      
      if (dayTasks.length > 0 && dayCompleted === dayTasks.length) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else if (dateISO === todayISO && dayTasks.length > 0) {
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
    
    return { days, streak, totalCompleted, totalTasks, totalMinutes, mostProductiveDay };
  }, [tasks, today, todayISO]);

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
                setElapsedSeconds(Math.floor((Date.now() - data.startTime) / 1000));
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

  const handleEditTask = useCallback((task) => {
    setEditingTask(task);
    setShowTaskForm(true);
  }, []);

  const handleStartFocus = useCallback((task) => {
    setFocusTask(task);
    setShowFocus(true);
  }, []);

  const handleTimeUpdate = useCallback(async (minutes) => {
    if (!focusTask) return;
    try {
      const newTimeSpent = (focusTask.time_spent || 0) + minutes;
      await editTask(focusTask.id, { time_spent: newTimeSpent });
      setFocusTask(prev => prev ? { ...prev, time_spent: newTimeSpent } : null);
    } catch (err) {}
  }, [focusTask, editTask]);

  const handleFocusComplete = useCallback(async () => {
    if (!focusTask) return;
    try {
      await toggleComplete(focusTask.id);
      setShowFocus(false);
      setFocusTask(null);
      toast.success('🎉 משימה הושלמה!');
      loadTasks();
    } catch (e) {
      toast.error('שגיאה');
    }
  }, [focusTask, toggleComplete, loadTasks]);

  const handleLogInterruption = useCallback(async (data) => {
    if (!user?.id) return;
    try {
      await supabase.from('interruptions').insert({
        user_id: user.id, type: data.type, description: data.description,
        task_id: data.task_id, duration: data.duration || 0
      });
    } catch (e) {}
  }, [user?.id]);

  const handleMoveAllOverdueToToday = useCallback(async () => {
    try {
      for (const task of overdueTasks) {
        await editTask(task.id, { due_date: todayISO });
      }
      toast.success(`${overdueTasks.length} משימות הועברו להיום`);
      loadTasks();
    } catch (e) {
      toast.error('שגיאה');
    }
  }, [overdueTasks, editTask, todayISO, loadTasks]);

  // פתקים
  const saveNote = useCallback(() => {
    if (!quickNote.trim()) return;
    const newNotes = [{ id: Date.now(), text: quickNote.trim() }, ...notes].slice(0, 10);
    setNotes(newNotes);
    localStorage.setItem('zmanit_quick_notes', JSON.stringify(newNotes));
    setQuickNote('');
    toast.success('📝 נשמר!');
  }, [quickNote, notes]);

  const deleteNote = useCallback((id) => {
    const newNotes = notes.filter(n => n.id !== id);
    setNotes(newNotes);
    localStorage.setItem('zmanit_quick_notes', JSON.stringify(newNotes));
  }, [notes]);

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
  const userName = user?.user_metadata?.full_name?.split(' ')[0] || 'שלום';

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6 pb-24">
      <div className="max-w-4xl mx-auto space-y-5">
        
        {/* ===== טיימר פעיל (Sticky) ===== */}
        {activeTimer && (
          <div className="sticky top-0 z-50 bg-emerald-600 rounded-2xl p-4 text-white shadow-lg -mx-4 md:mx-0">
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
                  onClick={() => handleStartFocus(activeTimer)}
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl font-medium transition-colors"
                >
                  📺 מסך מיקוד
                </button>
                <button 
                  onClick={() => { localStorage.removeItem('zmanit_active_timer'); setActiveTimer(null); toast('⏹️ טיימר נעצר'); }}
                  className="px-3 py-2 bg-white/20 hover:bg-white/30 rounded-xl transition-colors"
                >
                  ⏹️
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===== Header + Greeting ===== */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
                {getGreeting()}, {userName}! 👋
              </h1>
              <p className="text-gray-500 text-sm mt-1">
                יום {HEBREW_DAY_NAMES[today.getDay()]}, {today.toLocaleDateString('he-IL', { day: 'numeric', month: 'long' })}
              </p>
            </div>
            {weekStats.streak > 0 && (
              <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/30 px-4 py-2 rounded-xl border border-amber-200 dark:border-amber-700">
                <span className="text-2xl">🔥</span>
                <div className="text-right">
                  <div className="text-xl font-bold text-amber-600 dark:text-amber-400">{weekStats.streak}</div>
                  <div className="text-xs text-amber-700 dark:text-amber-500">ימים רצופים</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ===== Daily Quote ===== */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-5 text-white shadow-md">
          <div className="flex items-start gap-3">
            <span className="text-3xl">💡</span>
            <div>
              <p className="text-lg font-medium leading-relaxed">"{quote.text}"</p>
              <p className="text-indigo-200 text-sm mt-2">— {quote.author}</p>
            </div>
          </div>
        </div>

        {/* ===== Quick Stats ===== */}
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm text-center">
            <div className="text-3xl font-bold text-emerald-600">{stats.completed}</div>
            <div className="text-gray-500 dark:text-gray-400 text-sm">הושלמו ✓</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm text-center">
            <div className="text-3xl font-bold text-blue-600">{stats.remaining}</div>
            <div className="text-gray-500 dark:text-gray-400 text-sm">נותרו</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm text-center">
            <div className="text-3xl font-bold text-purple-600">{formatMinutes(stats.minutesLeft)}</div>
            <div className="text-gray-500 dark:text-gray-400 text-sm">זמן עבודה</div>
          </div>
          {stats.overdue > 0 ? (
            <div className="bg-red-50 dark:bg-red-900/30 rounded-xl p-4 shadow-sm text-center border border-red-200 dark:border-red-800">
              <div className="text-3xl font-bold text-red-600">{stats.overdue}</div>
              <div className="text-red-500 text-sm">באיחור!</div>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm text-center">
              <div className="text-3xl font-bold text-orange-600">{formatMinutes(stats.timeSpentToday)}</div>
              <div className="text-gray-500 dark:text-gray-400 text-sm">עבדת היום</div>
            </div>
          )}
        </div>

        {/* ===== Progress Bar ===== */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-600 dark:text-gray-400 font-medium">התקדמות היום</span>
            <span className="font-bold text-indigo-600">{stats.progress}%</span>
          </div>
          <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${stats.progress}%` }}
              transition={{ duration: 0.5 }}
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
            />
          </div>
        </div>

        {/* ===== Next Task ===== */}
        {nextTask && !activeTimer && (
          <div className={`bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border-r-4 ${
            nextTask.due_date < todayISO ? 'border-red-500' : 
            nextTask.priority === 'urgent' ? 'border-orange-500' : 'border-indigo-500'
          }`}>
            <div className={`flex items-center gap-2 text-sm font-medium mb-2 ${
              nextTask.due_date < todayISO ? 'text-red-500' : 
              nextTask.priority === 'urgent' ? 'text-orange-500' : 'text-indigo-500'
            }`}>
              <span className="w-2 h-2 bg-current rounded-full animate-pulse"></span>
              {nextTask.due_date < todayISO ? '⚠️ באיחור!' : 'המשימה הבאה שלך'}
            </div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-3">{nextTask.title}</h2>
            <div className="flex items-center gap-4 text-sm text-gray-500 mb-4 flex-wrap">
              {nextTask.due_time && <span>🕐 {nextTask.due_time}</span>}
              <span>⏱️ {nextTask.estimated_duration || 30} דקות</span>
              {nextTask.priority === 'urgent' && (
                <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-600 rounded text-xs font-medium">דחוף</span>
              )}
              {nextTask.due_date < todayISO && (
                <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-600 rounded text-xs font-medium">מ-{nextTask.due_date}</span>
              )}
            </div>
            <div className="flex gap-3 flex-wrap">
              <button 
                onClick={() => handleStartFocus(nextTask)}
                className="flex-1 min-w-[150px] bg-indigo-600 hover:bg-indigo-700 text-white py-3 px-6 rounded-xl font-medium transition-colors"
              >
                ▶️ התחילי עכשיו
              </button>
              <button 
                onClick={() => handleEditTask(nextTask)}
                className="px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                ✏️ ערכי
              </button>
            </div>
          </div>
        )}

        {/* ===== Navigation - Quick Actions ===== */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm">
          <h3 className="font-bold text-gray-800 dark:text-white mb-4">🧭 פעולות מהירות</h3>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            <button
              onClick={() => { setEditingTask(null); setShowTaskForm(true); }}
              className="bg-blue-500 hover:bg-blue-600 text-white p-4 rounded-xl text-center transition-all hover:scale-105"
            >
              <div className="text-2xl mb-1">➕</div>
              <div className="text-xs font-medium">משימה</div>
            </button>
            <button
              onClick={() => { setEditingTask({ priority: 'urgent', due_date: todayISO }); setShowTaskForm(true); }}
              className="bg-red-500 hover:bg-red-600 text-white p-4 rounded-xl text-center transition-all hover:scale-105"
            >
              <div className="text-2xl mb-1">🚨</div>
              <div className="text-xs font-medium">בלת"ם</div>
            </button>
            <Link to="/daily" className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 p-4 rounded-xl text-center transition-all hover:scale-105">
              <div className="text-2xl mb-1">📋</div>
              <div className="text-xs font-medium">יומי</div>
            </Link>
            <Link to="/weekly" className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 p-4 rounded-xl text-center transition-all hover:scale-105">
              <div className="text-2xl mb-1">🗓️</div>
              <div className="text-xs font-medium">שבועי</div>
            </Link>
            <Link to="/focus" className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 p-4 rounded-xl text-center transition-all hover:scale-105">
              <div className="text-2xl mb-1">🎯</div>
              <div className="text-xs font-medium">מיקוד</div>
            </Link>
            <Link to="/insights" className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 p-4 rounded-xl text-center transition-all hover:scale-105">
              <div className="text-2xl mb-1">📊</div>
              <div className="text-xs font-medium">תובנות</div>
            </Link>
          </div>
        </div>

        {/* ===== Overdue Tasks ===== */}
        {overdueTasks.length > 0 && (
          <div className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-5 border border-red-200 dark:border-red-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-red-700 dark:text-red-400 flex items-center gap-2">
                🔥 משימות באיחור ({overdueTasks.length})
              </h3>
              <button
                onClick={handleMoveAllOverdueToToday}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-xl transition-colors"
              >
                העבר הכל להיום
              </button>
            </div>
            <div className="space-y-3">
              {overdueTasks.map(task => (
                <DailyTaskCard
                  key={task.id}
                  task={task}
                  onEdit={handleEditTask}
                  onUpdate={loadTasks}
                  onStartFocus={handleStartFocus}
                />
              ))}
            </div>
          </div>
        )}

        {/* ===== Today's Tasks ===== */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800 dark:text-white">📋 המשימות להיום ({todayAllTasks.length})</h3>
            <Link to="/daily" className="text-indigo-500 text-sm hover:underline">צפי בהכל →</Link>
          </div>
          
          {todayRemaining.length === 0 && todayCompleted.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-5xl mb-3">📭</div>
              <p className="text-gray-500 mb-4">אין משימות להיום</p>
              <button
                onClick={() => { setEditingTask(null); setShowTaskForm(true); }}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors"
              >
                ➕ הוסיפי משימה
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* משימות שנותרו */}
              {todayRemaining.map(task => (
                <DailyTaskCard
                  key={task.id}
                  task={task}
                  onEdit={handleEditTask}
                  onUpdate={loadTasks}
                  onStartFocus={handleStartFocus}
                />
              ))}
              
              {/* משימות שהושלמו */}
              {todayCompleted.length > 0 && (
                <>
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mt-3">
                    <div className="text-sm text-gray-500 mb-2">✅ הושלמו ({todayCompleted.length})</div>
                  </div>
                  {todayCompleted.slice(0, 3).map(task => (
                    <DailyTaskCard
                      key={task.id}
                      task={task}
                      onEdit={handleEditTask}
                      onUpdate={loadTasks}
                    />
                  ))}
                  {todayCompleted.length > 3 && (
                    <Link to="/daily" className="block text-center text-indigo-500 hover:underline text-sm py-2">
                      עוד {todayCompleted.length - 3} משימות שהושלמו...
                    </Link>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* ===== Week Overview ===== */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800 dark:text-white">📊 סקירת השבוע</h3>
            <Link to="/weekly" className="text-indigo-500 text-sm hover:underline">לתכנון שבועי →</Link>
          </div>
          
          {/* סיכום שבועי */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-indigo-50 dark:bg-indigo-900/30 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                {weekStats.totalCompleted}/{weekStats.totalTasks}
              </div>
              <div className="text-xs text-indigo-700 dark:text-indigo-300">משימות השבוע</div>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/30 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {formatMinutes(weekStats.totalMinutes)}
              </div>
              <div className="text-xs text-purple-700 dark:text-purple-300">שעות עבודה</div>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/30 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {weekStats.mostProductiveDay || '-'}
              </div>
              <div className="text-xs text-amber-700 dark:text-amber-300">יום הכי פרודוקטיבי</div>
            </div>
          </div>
          
          {/* ימי השבוע */}
          <div className="grid grid-cols-7 gap-2">
            {weekStats.days.map((day, i) => {
              const allDone = day.total > 0 && day.completed === day.total;
              const hasIncomplete = day.total > 0 && day.completed < day.total;
              const progress = day.total > 0 ? (day.completed / day.total) * 100 : 0;
              
              return (
                <div 
                  key={i}
                  className={`text-center p-2 rounded-xl transition-all ${
                    day.isToday 
                      ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-300' 
                      : allDone
                        ? 'bg-emerald-100 dark:bg-emerald-900/30'
                        : day.isPast && hasIncomplete
                          ? 'bg-red-50 dark:bg-red-900/20'
                          : 'bg-gray-50 dark:bg-gray-700'
                  }`}
                >
                  <div className={`text-xs font-medium ${day.isToday ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                    {day.day}
                  </div>
                  <div className={`text-xs ${day.isToday ? 'text-indigo-200' : 'text-gray-400'}`}>
                    {day.dateNum}
                  </div>
                  
                  {/* מעגל התקדמות */}
                  <div className="relative w-10 h-10 mx-auto mt-1">
                    <svg className="w-10 h-10 transform -rotate-90">
                      <circle
                        cx="20" cy="20" r="16"
                        className={`fill-none stroke-current ${day.isToday ? 'text-indigo-400' : 'text-gray-200 dark:text-gray-600'}`}
                        strokeWidth="3"
                      />
                      {day.total > 0 && (
                        <circle
                          cx="20" cy="20" r="16"
                          className={`fill-none stroke-current ${
                            day.isToday ? 'text-white' : 
                            allDone ? 'text-emerald-500' : 
                            day.isPast ? 'text-red-400' : 'text-indigo-500'
                          }`}
                          strokeWidth="3"
                          strokeDasharray={`${progress} 100`}
                          strokeLinecap="round"
                        />
                      )}
                    </svg>
                    <div className={`absolute inset-0 flex items-center justify-center text-xs font-bold ${
                      day.isToday ? 'text-white' : 
                      allDone ? 'text-emerald-600' : 
                      day.total === 0 ? 'text-gray-300' : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      {day.total === 0 ? '-' : allDone ? '✓' : day.completed}
                    </div>
                  </div>
                  
                  {/* שעות עבודה */}
                  {day.minutes > 0 && (
                    <div className={`text-[10px] mt-1 ${day.isToday ? 'text-indigo-200' : 'text-gray-400'}`}>
                      {formatMinutes(day.minutes)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          
          {/* תובנה מהירה */}
          {weekStats.totalTasks > 0 && (
            <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-xl text-sm text-gray-600 dark:text-gray-300">
              💡 השבוע השלמת <span className="font-bold text-indigo-600">{Math.round((weekStats.totalCompleted / weekStats.totalTasks) * 100)}%</span> מהמשימות
              {weekStats.mostProductiveDay && (
                <span> • היום הכי טוב שלך: <span className="font-bold">{weekStats.mostProductiveDay}</span></span>
              )}
            </div>
          )}
        </div>

        {/* ===== Quick Note ===== */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm">
          <h3 className="font-bold text-gray-800 dark:text-white mb-3">📝 פתק מהיר</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={quickNote}
              onChange={(e) => setQuickNote(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && saveNote()}
              placeholder="רשמי משהו..."
              className="flex-1 px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <button
              onClick={saveNote}
              disabled={!quickNote.trim()}
              className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white font-medium rounded-xl transition-colors"
            >
              💾
            </button>
          </div>
          {notes.length > 0 && (
            <div className="mt-3 space-y-2">
              {notes.slice(0, 5).map((note) => (
                <div key={note.id} className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-sm text-gray-700 dark:text-gray-300 border border-yellow-100 dark:border-yellow-800 group">
                  <span className="flex-1">{note.text}</span>
                  <button
                    onClick={() => deleteNote(note.id)}
                    className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ===== Footer - Settings ===== */}
        <div className="flex justify-center pt-2 pb-4">
          <Link to="/settings" className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            ⚙️ הגדרות
          </Link>
        </div>

      </div>

      {/* ===== Modals ===== */}
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

      <FullScreenFocus
        isOpen={showFocus}
        onClose={() => setShowFocus(false)}
        task={focusTask}
        onComplete={handleFocusComplete}
        onPause={handleTimeUpdate}
        onTimeUpdate={handleTimeUpdate}
        onAddTask={addTask}
        onLogInterruption={handleLogInterruption}
      />
    </div>
  );
}

export default SmartDashboard;
