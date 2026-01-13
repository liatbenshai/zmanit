/**
 * SmartDashboard - דשבורד רחב ופונקציונלי
 * ==========================================
 * ✅ רוחב מלא - לא ממורכז
 * ✅ כל המשימות של היום
 * ✅ פעולות מלאות על כל משימה
 * ✅ סיידבר עם סטטיסטיקות ופתקים
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { useTasks } from '../../hooks/useTasks';
import { useAuth } from '../../hooks/useAuth';
import SimpleTaskForm from '../DailyView/SimpleTaskForm';
import FullScreenFocus from '../ADHD/FullScreenFocus';
import Modal from '../UI/Modal';
import toast from 'react-hot-toast';
import { supabase } from '../../services/supabase';

// ========================================
// עזרים
// ========================================

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

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'בוקר טוב';
  if (hour < 17) return 'צהריים טובים';
  if (hour < 21) return 'ערב טוב';
  return 'לילה טוב';
}

const QUOTES = [
  { text: "הדרך להתחיל היא להפסיק לדבר ולהתחיל לעשות.", author: "וולט דיסני" },
  { text: "כל מה שאת יכולה לדמיין - את יכולה להשיג.", author: "נפוליאון היל" },
  { text: "אל תמתיני להזדמנות. צרי אותה.", author: "ג'ורג' ברנרד שו" },
  { text: "התחילי מאיפה שאת נמצאת. השתמשי במה שיש לך. עשי מה שאת יכולה.", author: "ארתור אש" },
  { text: "הדרך היחידה לעשות עבודה נהדרת היא לאהוב את מה שאת עושה.", author: "סטיב ג'ובס" },
  { text: "זה לא משנה כמה לאט את הולכת, כל עוד את לא עוצרת.", author: "קונפוציוס" },
  { text: "הכי קשה זה להתחיל. אחרי זה הכל זורם.", author: "אנונימי" },
];

function getDailyQuote() {
  const today = new Date();
  const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
  return QUOTES[dayOfYear % QUOTES.length];
}

const HEBREW_DAYS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

// ========================================
// קומפוננטה ראשית
// ========================================

function SmartDashboard() {
  const { tasks, loading, toggleComplete, editTask, addTask, removeTask, loadTasks } = useTasks();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // State
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [showFocus, setShowFocus] = useState(false);
  const [focusTask, setFocusTask] = useState(null);
  const [activeTimer, setActiveTimer] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [quickNote, setQuickNote] = useState('');
  const [notes, setNotes] = useState([]);
  const [showAllNotes, setShowAllNotes] = useState(false);
  const [taskMenuOpen, setTaskMenuOpen] = useState(null);
  
  const today = new Date();
  const todayISO = today.toISOString().split('T')[0];
  const tomorrowISO = new Date(today.getTime() + 86400000).toISOString().split('T')[0];
  const currentMinutes = today.getHours() * 60 + today.getMinutes();

  // טעינת פתקים
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
  const todayTasks = useMemo(() => {
    if (!tasks) return [];
    return tasks.filter(t => 
      t.due_date === todayISO && !t.deleted_at
    ).sort((a, b) => {
      // הושלמו בסוף
      if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1;
      // דחופים קודם
      if (a.priority === 'urgent' && b.priority !== 'urgent') return -1;
      if (b.priority === 'urgent' && a.priority !== 'urgent') return 1;
      // לפי שעה
      if (a.due_time && b.due_time) return a.due_time.localeCompare(b.due_time);
      if (a.due_time) return -1;
      return 0;
    });
  }, [tasks, todayISO]);

  // סטטיסטיקות היום
  const stats = useMemo(() => {
    const completed = todayTasks.filter(t => t.is_completed);
    const remaining = todayTasks.filter(t => !t.is_completed);
    const minutesLeft = remaining.reduce((sum, t) => sum + (t.estimated_duration || 30), 0);
    const timeSpentToday = todayTasks.reduce((sum, t) => sum + (t.time_spent || 0), 0);
    
    return {
      total: todayTasks.length,
      completed: completed.length,
      remaining: remaining.length,
      minutesLeft,
      timeSpentToday,
      overdue: overdueTasks.length
    };
  }, [todayTasks, overdueTasks]);

  // סטטיסטיקות שבוע
  const weekStats = useMemo(() => {
    if (!tasks) return { days: [], totalTime: 0 };
    
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    
    const days = [];
    let totalTime = 0;
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      const dateISO = date.toISOString().split('T')[0];
      
      const dayTasks = tasks.filter(t => t.due_date === dateISO && !t.deleted_at);
      const dayCompleted = dayTasks.filter(t => t.is_completed);
      const dayTime = dayTasks.reduce((sum, t) => sum + (t.time_spent || 0), 0);
      totalTime += dayTime;
      
      days.push({
        date: dateISO,
        dayName: HEBREW_DAYS[date.getDay()],
        total: dayTasks.length,
        completed: dayCompleted.length,
        isToday: dateISO === todayISO
      });
    }
    
    return { days, totalTime };
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
          const timerKey = `timer_v2_${activeTaskId}`;
          try {
            const saved = localStorage.getItem(timerKey);
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
  // פעולות על משימות
  // ========================================

  const handleComplete = useCallback(async (taskId) => {
    try {
      await toggleComplete(taskId);
      toast.success('✅ כל הכבוד!');
    } catch (e) {
      toast.error('שגיאה');
    }
  }, [toggleComplete]);

  const handleStartTask = useCallback((task) => {
    setFocusTask(task);
    setShowFocus(true);
    setTaskMenuOpen(null);
  }, []);

  const handleEditTask = useCallback((task) => {
    setEditingTask(task);
    setShowTaskForm(true);
    setTaskMenuOpen(null);
  }, []);

  const handleDeleteTask = useCallback(async (taskId) => {
    if (window.confirm('למחוק את המשימה?')) {
      try {
        await removeTask(taskId);
        toast.success('🗑️ נמחק');
      } catch (e) {
        toast.error('שגיאה');
      }
    }
    setTaskMenuOpen(null);
  }, [removeTask]);

  const handleDeferToTomorrow = useCallback(async (task) => {
    try {
      await editTask(task.id, { due_date: tomorrowISO, due_time: null });
      toast.success('➡️ נדחה למחר');
    } catch (e) {
      toast.error('שגיאה');
    }
    setTaskMenuOpen(null);
  }, [editTask, tomorrowISO]);

  const handleSetUrgent = useCallback(async (task) => {
    try {
      await editTask(task.id, { priority: task.priority === 'urgent' ? 'normal' : 'urgent' });
      toast.success(task.priority === 'urgent' ? '📌 רגיל' : '🚨 דחוף!');
    } catch (e) {
      toast.error('שגיאה');
    }
    setTaskMenuOpen(null);
  }, [editTask]);

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

  // פתקים
  const saveNote = useCallback(() => {
    if (!quickNote.trim()) return;
    const newNote = { id: Date.now(), text: quickNote.trim(), createdAt: new Date().toISOString() };
    const newNotes = [newNote, ...notes].slice(0, 20);
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">⏳</div>
          <p className="text-gray-500">טוען...</p>
        </div>
      </div>
    );
  }

  // קומפוננטת משימה
  const TaskRow = ({ task, isOverdue = false }) => (
    <div
      className={`flex items-center gap-3 p-3 rounded-xl transition-all group ${
        task.is_completed 
          ? 'bg-green-50 dark:bg-green-900/20 opacity-60' 
          : isOverdue
            ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
            : task.priority === 'urgent'
              ? 'bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800'
              : 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700'
      }`}
    >
      {/* כפתור השלמה */}
      <button
        onClick={() => handleComplete(task.id)}
        className={`w-7 h-7 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
          task.is_completed 
            ? 'bg-green-500 border-green-500 text-white' 
            : 'border-gray-300 dark:border-gray-600 hover:border-green-500 hover:bg-green-50'
        }`}
      >
        {task.is_completed && '✓'}
      </button>

      {/* תוכן המשימה */}
      <div className="flex-1 min-w-0">
        <div className={`font-medium truncate ${task.is_completed ? 'line-through text-gray-400' : 'text-gray-900 dark:text-white'}`}>
          {task.priority === 'urgent' && !task.is_completed && <span className="text-red-500">🔥 </span>}
          {isOverdue && !task.is_completed && <span className="text-red-500 text-xs">[{task.due_date}] </span>}
          {task.title}
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          {task.due_time && <span>🕐 {task.due_time}</span>}
          <span>⏱️ {task.estimated_duration || 30} דק׳</span>
          {task.time_spent > 0 && <span className="text-green-600">✓ {task.time_spent} דק׳</span>}
          {task.task_type && <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">{task.task_type}</span>}
        </div>
      </div>

      {/* כפתורי פעולה */}
      {!task.is_completed && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => handleStartTask(task)}
            className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors"
            title="התחל"
          >
            ▶️
          </button>
          <button
            onClick={() => handleEditTask(task)}
            className="p-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-200 transition-colors"
            title="ערוך"
          >
            ✏️
          </button>
          <button
            onClick={() => handleDeferToTomorrow(task)}
            className="p-2 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 rounded-lg hover:bg-yellow-200 transition-colors"
            title="דחה למחר"
          >
            ➡️
          </button>
          <button
            onClick={() => handleSetUrgent(task)}
            className={`p-2 rounded-lg transition-colors ${
              task.priority === 'urgent' 
                ? 'bg-red-100 text-red-600 hover:bg-red-200' 
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 hover:bg-gray-200'
            }`}
            title={task.priority === 'urgent' ? 'הסר דחיפות' : 'סמן כדחוף'}
          >
            🔥
          </button>
          <button
            onClick={() => handleDeleteTask(task.id)}
            className="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
            title="מחק"
          >
            🗑️
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 pb-24" dir="rtl">
      <div className="max-w-7xl mx-auto">
        
        {/* === טיימר פעיל === */}
        {activeTimer && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 bg-gradient-to-l from-green-500 to-emerald-600 rounded-2xl p-4 text-white shadow-lg"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="text-sm opacity-80">עובדת עכשיו על:</div>
                <div className="font-bold text-lg">{activeTimer.title}</div>
              </div>
              <div className="text-3xl font-mono font-bold">{formatTime(elapsedSeconds)}</div>
              <div className="flex gap-2 mr-4">
                <button onClick={() => handleStartTask(activeTimer)} className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl">
                  📺 מסך מיקוד
                </button>
                <button onClick={() => { localStorage.removeItem('zmanit_active_timer'); setActiveTimer(null); }} className="px-3 py-2 bg-white/20 hover:bg-white/30 rounded-xl">
                  ⏹️
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* === לייאאוט ראשי === */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          
          {/* === עמודה ראשית - משימות === */}
          <div className="lg:col-span-3 space-y-4">
            
            {/* כותרת + כפתורים */}
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {getGreeting()} 👋
                </h1>
                <p className="text-gray-500 mt-1">
                  ✅ {stats.completed}/{stats.total} הושלמו • ⏱️ {formatMinutes(stats.minutesLeft)} נותרו
                  {stats.overdue > 0 && <span className="text-red-500 font-medium"> • 🔥 {stats.overdue} באיחור</span>}
                </p>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => { setEditingTask(null); setShowTaskForm(true); }}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-xl transition-colors flex items-center gap-2"
                >
                  ➕ משימה חדשה
                </button>
                <button
                  onClick={() => { 
                    setEditingTask({ priority: 'urgent', due_date: todayISO }); 
                    setShowTaskForm(true); 
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-red-500 to-orange-500 text-white font-medium rounded-xl transition-colors flex items-center gap-2"
                >
                  🚨 בלת״ם
                </button>
              </div>
            </div>

            {/* פס התקדמות */}
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${stats.total > 0 ? (stats.completed / stats.total) * 100 : 0}%` }}
                className="h-full bg-gradient-to-l from-green-500 to-emerald-500 rounded-full"
              />
            </div>

            {/* משימות באיחור */}
            {overdueTasks.length > 0 && (
              <div className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-4 border border-red-200 dark:border-red-800">
                <h2 className="font-bold text-red-700 dark:text-red-400 mb-3 flex items-center gap-2">
                  🔥 באיחור ({overdueTasks.length})
                  <button
                    onClick={async () => {
                      for (const task of overdueTasks) {
                        await editTask(task.id, { due_date: todayISO });
                      }
                      toast.success('כל המשימות הועברו להיום');
                    }}
                    className="mr-auto text-xs bg-red-200 dark:bg-red-800 px-3 py-1 rounded-lg hover:bg-red-300"
                  >
                    העבר הכל להיום
                  </button>
                </h2>
                <div className="space-y-2">
                  {overdueTasks.map(task => <TaskRow key={task.id} task={task} isOverdue />)}
                </div>
              </div>
            )}

            {/* משימות היום */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-gray-900 dark:text-white text-lg">
                  📋 היום ({todayTasks.length})
                </h2>
                <Link to="/daily" className="text-blue-500 text-sm hover:underline">
                  תצוגה מלאה →
                </Link>
              </div>
              
              {todayTasks.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-3">🎉</div>
                  <p className="text-gray-500">אין משימות להיום!</p>
                  <button
                    onClick={() => { setEditingTask(null); setShowTaskForm(true); }}
                    className="mt-4 px-6 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl"
                  >
                    ➕ הוסיפי משימה
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {todayTasks.map(task => <TaskRow key={task.id} task={task} />)}
                </div>
              )}
            </div>

            {/* ניווט מהיר */}
            <div className="grid grid-cols-4 gap-3">
              <Link to="/daily" className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-all text-center">
                <span className="text-2xl block mb-1">📋</span>
                <span className="text-sm text-gray-600 dark:text-gray-400">יומי</span>
              </Link>
              <Link to="/weekly" className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-all text-center">
                <span className="text-2xl block mb-1">🗓️</span>
                <span className="text-sm text-gray-600 dark:text-gray-400">שבועי</span>
              </Link>
              <Link to="/focus" className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-all text-center">
                <span className="text-2xl block mb-1">🎯</span>
                <span className="text-sm text-gray-600 dark:text-gray-400">מיקוד</span>
              </Link>
              <Link to="/insights" className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-all text-center">
                <span className="text-2xl block mb-1">📊</span>
                <span className="text-sm text-gray-600 dark:text-gray-400">תובנות</span>
              </Link>
            </div>
          </div>

          {/* === סיידבר === */}
          <div className="space-y-4">
            
            {/* ציטוט */}
            <div className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-2xl p-4 text-white shadow-md">
              <div className="text-2xl mb-2">"</div>
              <p className="text-sm leading-relaxed">{getDailyQuote().text}</p>
              <p className="text-white/70 text-xs mt-2">— {getDailyQuote().author}</p>
            </div>

            {/* סטטיסטיקות */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm">
              <h3 className="font-bold text-gray-900 dark:text-white mb-3">📊 סטטיסטיקות</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">עבדת היום:</span>
                  <span className="font-bold text-gray-900 dark:text-white">{formatMinutes(stats.timeSpentToday)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">עבדת השבוע:</span>
                  <span className="font-bold text-gray-900 dark:text-white">{formatMinutes(weekStats.totalTime)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">נותר להיום:</span>
                  <span className="font-bold text-gray-900 dark:text-white">{formatMinutes(stats.minutesLeft)}</span>
                </div>
              </div>
            </div>

            {/* תצוגת שבוע מיני */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm">
              <h3 className="font-bold text-gray-900 dark:text-white mb-3">🗓️ השבוע</h3>
              <div className="grid grid-cols-7 gap-1">
                {weekStats.days.map((day) => (
                  <div
                    key={day.date}
                    className={`text-center p-2 rounded-lg ${
                      day.isToday 
                        ? 'bg-blue-100 dark:bg-blue-900/50 ring-2 ring-blue-500' 
                        : 'bg-gray-50 dark:bg-gray-700/50'
                    }`}
                  >
                    <div className="text-[10px] text-gray-500">{day.dayName}</div>
                    <div className={`text-sm font-bold ${
                      day.total === 0 ? 'text-gray-300' 
                      : day.completed === day.total ? 'text-green-500' 
                      : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      {day.total === 0 ? '-' : day.completed === day.total ? '✓' : day.total}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* פתקים מהירים */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm">
              <h3 className="font-bold text-gray-900 dark:text-white mb-3">📝 פתקים</h3>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={quickNote}
                  onChange={(e) => setQuickNote(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && saveNote()}
                  placeholder="רשמי משהו..."
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <button onClick={saveNote} disabled={!quickNote.trim()} className="px-3 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white rounded-lg">
                  💾
                </button>
              </div>
              {notes.length > 0 && (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {(showAllNotes ? notes : notes.slice(0, 5)).map((note) => (
                    <div key={note.id} className="flex items-start gap-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-sm group">
                      <span className="flex-1 text-gray-700 dark:text-gray-300">{note.text}</span>
                      <button onClick={() => deleteNote(note.id)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100">✕</button>
                    </div>
                  ))}
                  {notes.length > 5 && (
                    <button onClick={() => setShowAllNotes(!showAllNotes)} className="text-xs text-blue-500 hover:underline">
                      {showAllNotes ? 'הסתר' : `עוד ${notes.length - 5}...`}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* הגדרות */}
            <Link to="/settings" className="block p-4 bg-white dark:bg-gray-800 rounded-2xl shadow-sm hover:shadow-md transition-all text-center">
              <span className="text-gray-500">⚙️ הגדרות</span>
            </Link>
          </div>
        </div>
      </div>

      {/* === מודלים === */}
      <Modal
        isOpen={showTaskForm}
        onClose={() => { setShowTaskForm(false); setEditingTask(null); }}
        title={editingTask?.id ? 'עריכת משימה' : editingTask?.priority === 'urgent' ? '🚨 בלת״ם חדש' : 'משימה חדשה'}
        maxWidth="max-w-lg"
      >
        <SimpleTaskForm
          task={editingTask}
          onSave={async (taskData) => {
            if (editingTask?.id) {
              await editTask(editingTask.id, taskData);
            } else {
              await addTask(taskData);
            }
            setShowTaskForm(false);
            setEditingTask(null);
            loadTasks();
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
