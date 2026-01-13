/**
 * SmartDashboard - דשבורד חכם ומורחב
 * =====================================
 * ✅ סטטוס יום + פס התקדמות
 * ✅ ציטוט יומי
 * ✅ טיימר פעיל
 * ✅ משימה הבאה + כפתור התחל
 * ✅ תצוגת שבוע מיני
 * ✅ המלצות חכמות
 * ✅ פתקים מהירים
 * ✅ כפתור בלת"ם
 * ✅ סיכום שעות
 * ✅ גיימיפיקציה + תובנות
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
import SmartReminders, { InsightsPanel, GamificationPanel } from '../Productivity/SmartReminders';

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

// ציטוטים מוטיבציוניים
const QUOTES = [
  { text: "הדרך להתחיל היא להפסיק לדבר ולהתחיל לעשות.", author: "וולט דיסני" },
  { text: "כל מה שאת יכולה לדמיין - את יכולה להשיג.", author: "נפוליאון היל" },
  { text: "ההצלחה היא לא סופית, הכישלון אינו קטלני: האומץ להמשיך הוא מה שחשוב.", author: "וינסטון צ'רצ'יל" },
  { text: "אל תמתיני להזדמנות. צרי אותה.", author: "ג'ורג' ברנרד שו" },
  { text: "העתיד שייך לאלה שמאמינים ביופי החלומות שלהם.", author: "אלינור רוזוולט" },
  { text: "התחילי מאיפה שאת נמצאת. השתמשי במה שיש לך. עשי מה שאת יכולה.", author: "ארתור אש" },
  { text: "הדרך היחידה לעשות עבודה נהדרת היא לאהוב את מה שאת עושה.", author: "סטיב ג'ובס" },
  { text: "בין גירוי לתגובה יש מרחב. במרחב הזה טמונה הבחירה שלנו.", author: "ויקטור פרנקל" },
  { text: "את מפספסת 100% מהזריקות שאת לא יורה.", author: "וויין גרצקי" },
  { text: "זה לא משנה כמה לאט את הולכת, כל עוד את לא עוצרת.", author: "קונפוציוס" },
  { text: "כל יום הוא הזדמנות חדשה להיות גרסה טובה יותר של עצמך.", author: "אנונימי" },
  { text: "אל תספרי את הימים - גרמי לימים לספור.", author: "מוחמד עלי" },
  { text: "ההבדל בין רגיל למיוחד הוא אותו 'קצת יותר'.", author: "ג'ימי ג'ונסון" },
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
  const { tasks, loading, toggleComplete, editTask, addTask, loadTasks } = useTasks();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // State
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [showFocus, setShowFocus] = useState(false);
  const [focusTask, setFocusTask] = useState(null);
  const [activeTimer, setActiveTimer] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showUrgentForm, setShowUrgentForm] = useState(false);
  const [quickNote, setQuickNote] = useState('');
  const [notes, setNotes] = useState([]);
  const [showAllNotes, setShowAllNotes] = useState(false);
  
  const today = new Date();
  const todayISO = today.toISOString().split('T')[0];
  const currentMinutes = today.getHours() * 60 + today.getMinutes();

  // טעינת פתקים
  useEffect(() => {
    const saved = localStorage.getItem('zmanit_quick_notes');
    if (saved) {
      try {
        setNotes(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  // ========================================
  // חישובים
  // ========================================

  // המשימה הבאה
  const nextTask = useMemo(() => {
    if (!tasks || tasks.length === 0) return null;
    
    const overdueTasks = tasks.filter(t => 
      !t.is_completed && !t.deleted_at && t.due_date && t.due_date < todayISO
    );
    
    const todayTasks = tasks.filter(t => 
      !t.is_completed && !t.deleted_at && t.due_date === todayISO
    );
    
    const lateTodayTasks = todayTasks.filter(t => {
      if (!t.due_time) return false;
      const [h, m] = t.due_time.split(':').map(Number);
      return (h * 60 + (m || 0)) < currentMinutes;
    });
    
    const upcomingTasks = todayTasks.filter(t => {
      if (!t.due_time) return true;
      const [h, m] = t.due_time.split(':').map(Number);
      return (h * 60 + (m || 0)) >= currentMinutes;
    });
    
    const sortTasks = (list) => list.sort((a, b) => {
      if (a.priority === 'urgent' && b.priority !== 'urgent') return -1;
      if (b.priority === 'urgent' && a.priority !== 'urgent') return 1;
      if (a.due_time && b.due_time) return a.due_time.localeCompare(b.due_time);
      if (a.due_time) return -1;
      return 0;
    });
    
    return sortTasks([...overdueTasks])[0] || 
           sortTasks([...lateTodayTasks])[0] || 
           sortTasks([...upcomingTasks])[0] || 
           null;
  }, [tasks, todayISO, currentMinutes]);

  // סטטיסטיקות היום
  const stats = useMemo(() => {
    if (!tasks) return { total: 0, completed: 0, remaining: 0, minutesLeft: 0, overdue: 0, timeSpentToday: 0 };
    
    const todayTasks = tasks.filter(t => t.due_date === todayISO && !t.deleted_at);
    const completed = todayTasks.filter(t => t.is_completed);
    const remaining = todayTasks.filter(t => !t.is_completed);
    const overdue = tasks.filter(t => 
      !t.is_completed && !t.deleted_at && t.due_date && t.due_date < todayISO
    );
    
    const minutesLeft = remaining.reduce((sum, t) => sum + (t.estimated_duration || 30), 0);
    const timeSpentToday = todayTasks.reduce((sum, t) => sum + (t.time_spent || 0), 0);
    
    return {
      total: todayTasks.length,
      completed: completed.length,
      remaining: remaining.length,
      minutesLeft,
      overdue: overdue.length,
      timeSpentToday,
      tasks: remaining.slice(0, 6)
    };
  }, [tasks, todayISO]);

  // סטטיסטיקות שבוע
  const weekStats = useMemo(() => {
    if (!tasks) return { totalTasks: 0, completedTasks: 0, totalTime: 0, days: [] };
    
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    
    const days = [];
    let totalTasks = 0;
    let completedTasks = 0;
    let totalTime = 0;
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      const dateISO = date.toISOString().split('T')[0];
      
      const dayTasks = tasks.filter(t => t.due_date === dateISO && !t.deleted_at);
      const dayCompleted = dayTasks.filter(t => t.is_completed);
      const dayTime = dayTasks.reduce((sum, t) => sum + (t.time_spent || 0), 0);
      
      totalTasks += dayTasks.length;
      completedTasks += dayCompleted.length;
      totalTime += dayTime;
      
      days.push({
        date: dateISO,
        dayName: HEBREW_DAYS[date.getDay()],
        total: dayTasks.length,
        completed: dayCompleted.length,
        isToday: dateISO === todayISO,
        isPast: dateISO < todayISO
      });
    }
    
    return { totalTasks, completedTasks, totalTime, days };
  }, [tasks, today, todayISO]);

  // המלצות חכמות
  const recommendations = useMemo(() => {
    if (!tasks) return [];
    const recs = [];
    
    // משימות ארוכות לפיצול
    const longTasks = tasks.filter(t => 
      !t.is_completed && !t.deleted_at && 
      t.due_date === todayISO && 
      (t.estimated_duration || 30) > 90
    );
    if (longTasks.length > 0) {
      recs.push({
        id: 'split',
        icon: '✂️',
        text: `"${longTasks[0].title}" ארוכה (${longTasks[0].estimated_duration} דק׳) - שווה לפצל?`,
        action: () => navigate('/daily'),
        taskId: longTasks[0].id
      });
    }
    
    // עומס יתר
    if (stats.minutesLeft > 480) {
      recs.push({
        id: 'overload',
        icon: '⚠️',
        text: `יש לך ${formatMinutes(stats.minutesLeft)} עבודה היום - אולי לדחות משהו?`,
        action: () => navigate('/daily')
      });
    }
    
    // משימות באיחור
    if (stats.overdue > 2) {
      recs.push({
        id: 'overdue',
        icon: '🔥',
        text: `${stats.overdue} משימות באיחור - בואי נטפל בהן!`,
        action: () => navigate('/daily')
      });
    }
    
    // יום ריק
    if (stats.total === 0) {
      recs.push({
        id: 'empty',
        icon: '📋',
        text: 'אין משימות להיום - רוצה לתכנן?',
        action: () => setShowTaskForm(true)
      });
    }
    
    // הצלחה!
    if (stats.total > 0 && stats.completed === stats.total) {
      recs.push({
        id: 'done',
        icon: '🎉',
        text: 'סיימת הכל להיום! מדהים!',
        action: null
      });
    }
    
    return recs.slice(0, 2);
  }, [tasks, stats, todayISO, navigate]);

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
                const elapsed = Math.floor((Date.now() - data.startTime) / 1000);
                setElapsedSeconds(elapsed);
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

  const handleStartNow = useCallback(() => {
    if (nextTask) {
      setFocusTask(nextTask);
      setShowFocus(true);
    } else {
      toast('אין משימות להיום! 🎉');
    }
  }, [nextTask]);

  const handleStartTask = useCallback((task) => {
    setFocusTask(task);
    setShowFocus(true);
  }, []);

  const handleComplete = useCallback(async (taskId) => {
    try {
      await toggleComplete(taskId);
      toast.success('✅ כל הכבוד!');
    } catch (e) {
      toast.error('שגיאה');
    }
  }, [toggleComplete]);

  const handleTimeUpdate = useCallback(async (minutes) => {
    if (!focusTask) return;
    try {
      const newTimeSpent = (focusTask.time_spent || 0) + minutes;
      await editTask(focusTask.id, { time_spent: newTimeSpent });
      setFocusTask(prev => prev ? { ...prev, time_spent: newTimeSpent } : null);
    } catch (err) {
      console.error('שגיאה בעדכון זמן:', err);
    }
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
        user_id: user.id,
        type: data.type,
        description: data.description,
        task_id: data.task_id,
        duration: data.duration || 0
      });
    } catch (e) {}
  }, [user?.id]);

  // פתקים
  const saveNote = useCallback(() => {
    if (!quickNote.trim()) return;
    const newNote = {
      id: Date.now(),
      text: quickNote.trim(),
      createdAt: new Date().toISOString()
    };
    const newNotes = [newNote, ...notes].slice(0, 10);
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

  // בלת"ם
  const handleAddUrgent = useCallback(async (taskData) => {
    try {
      await addTask({
        ...taskData,
        priority: 'urgent',
        due_date: todayISO,
        due_time: new Date().toTimeString().slice(0, 5)
      });
      setShowUrgentForm(false);
      toast.success('🚨 בלת"ם נוסף!');
      loadTasks();
    } catch (e) {
      toast.error('שגיאה');
    }
  }, [addTask, todayISO, loadTasks]);

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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 pb-24" dir="rtl">
      <div className="max-w-2xl mx-auto space-y-4">
        
        {/* === טיימר פעיל === */}
        {activeTimer && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-l from-green-500 to-emerald-600 rounded-2xl p-4 text-white shadow-lg"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="text-sm opacity-80">עובדת עכשיו על:</div>
                <div className="font-bold text-lg truncate">{activeTimer.title}</div>
              </div>
              <div className="text-3xl font-mono font-bold">
                {formatTime(elapsedSeconds)}
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => handleStartTask(activeTimer)}
                className="flex-1 py-2 bg-white/20 hover:bg-white/30 rounded-xl font-medium transition-colors"
              >
                📺 פתח מסך מיקוד
              </button>
              <button
                onClick={() => {
                  localStorage.removeItem('zmanit_active_timer');
                  setActiveTimer(null);
                  toast('⏹️ טיימר נעצר');
                }}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl transition-colors"
              >
                ⏹️
              </button>
            </div>
          </motion.div>
        )}

        {/* === כותרת + סטטוס === */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center pt-2"
        >
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {getGreeting()} 👋
          </h1>
          
          <div className="flex justify-center gap-4 mt-2 text-sm flex-wrap">
            <span className="text-gray-600 dark:text-gray-400">
              ✅ {stats.completed}/{stats.total} הושלמו
            </span>
            <span className="text-gray-600 dark:text-gray-400">
              ⏱️ {formatMinutes(stats.minutesLeft)} נותרו
            </span>
            {stats.overdue > 0 && (
              <span className="text-red-500 font-medium">
                🔥 {stats.overdue} באיחור
              </span>
            )}
          </div>
          
          {/* פס התקדמות */}
          <div className="mt-3 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden max-w-md mx-auto">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${stats.total > 0 ? (stats.completed / stats.total) * 100 : 0}%` }}
              className="h-full bg-gradient-to-l from-green-500 to-emerald-500 rounded-full"
            />
          </div>
          
          {/* ציטוט יומי */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-4"
          >
            <div className="relative bg-gradient-to-l from-indigo-500 via-purple-500 to-pink-500 rounded-2xl p-4 shadow-md">
              <div className="absolute top-2 right-3 text-white/20 text-4xl font-serif">"</div>
              <div className="relative z-10">
                <p className="text-white text-sm leading-relaxed pr-5">
                  {getDailyQuote().text}
                </p>
                <p className="text-white/70 text-xs mt-2">
                  — {getDailyQuote().author}
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* === המשימה הבאה === */}
        {!activeTimer && nextTask && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-lg border-2 border-blue-200 dark:border-blue-800"
          >
            <div className="text-sm text-blue-600 dark:text-blue-400 font-medium mb-1">
              {nextTask.due_date < todayISO ? '🔥 באיחור!' : 
               nextTask.priority === 'urgent' ? '🚨 דחוף!' : '📌 הבא בתור:'}
            </div>
            
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              {nextTask.title}
            </h2>
            
            <div className="flex items-center gap-3 text-sm text-gray-500 mb-4">
              {nextTask.due_time && <span>🕐 {nextTask.due_time}</span>}
              <span>⏱️ {nextTask.estimated_duration || 30} דק׳</span>
              {nextTask.time_spent > 0 && (
                <span className="text-green-600">✓ {nextTask.time_spent} דק׳ בוצעו</span>
              )}
            </div>
            
            <button
              onClick={handleStartNow}
              className="w-full py-4 bg-gradient-to-l from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white text-xl font-bold rounded-xl shadow-lg transition-all transform hover:scale-[1.02] active:scale-[0.98]"
            >
              🚀 להתחיל עכשיו!
            </button>
          </motion.div>
        )}

        {/* === אין משימות === */}
        {!activeTimer && !nextTask && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-2xl p-8 text-center"
          >
            <div className="text-5xl mb-3">🎉</div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              אין משימות!
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              סיימת הכל או שלא תכננת להיום
            </p>
            <button
              onClick={() => setShowTaskForm(true)}
              className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl transition-colors"
            >
              ➕ הוסיפי משימה
            </button>
          </motion.div>
        )}

        {/* === משימות נוספות === */}
        {stats.tasks.length > 1 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-900 dark:text-white">
                📋 עוד להיום ({stats.remaining})
              </h3>
              <Link to="/daily" className="text-blue-500 text-sm hover:underline">
                הכל →
              </Link>
            </div>
            
            <div className="space-y-2">
              {stats.tasks.slice(1, 5).map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl group"
                >
                  <button
                    onClick={() => handleComplete(task.id)}
                    className="w-6 h-6 rounded-full border-2 border-gray-300 dark:border-gray-600 hover:border-green-500 hover:bg-green-50 transition-colors flex-shrink-0"
                  />
                  
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 dark:text-white truncate">
                      {task.priority === 'urgent' && '🔥 '}
                      {task.title}
                    </div>
                    <div className="text-xs text-gray-500">
                      {task.due_time && `${task.due_time} • `}
                      {task.estimated_duration || 30} דק׳
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleStartTask(task)}
                    className="px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ▶️
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* === תצוגת שבוע מיני === */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-900 dark:text-white">🗓️ השבוע</h3>
            <Link to="/weekly" className="text-blue-500 text-sm hover:underline">
              תכנון →
            </Link>
          </div>
          
          <div className="grid grid-cols-7 gap-1">
            {weekStats.days.map((day) => (
              <div
                key={day.date}
                className={`text-center p-2 rounded-lg transition-colors ${
                  day.isToday 
                    ? 'bg-blue-100 dark:bg-blue-900/50 ring-2 ring-blue-500' 
                    : day.isPast 
                      ? 'bg-gray-100 dark:bg-gray-700/50' 
                      : 'bg-gray-50 dark:bg-gray-700/30'
                }`}
              >
                <div className={`text-xs font-medium ${
                  day.isToday ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500'
                }`}>
                  {day.dayName}
                </div>
                <div className={`text-lg font-bold ${
                  day.total === 0 
                    ? 'text-gray-300 dark:text-gray-600' 
                    : day.completed === day.total && day.total > 0
                      ? 'text-green-500'
                      : day.isToday 
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-gray-700 dark:text-gray-300'
                }`}>
                  {day.total === 0 ? '-' : day.completed === day.total ? '✓' : day.total}
                </div>
                {day.total > 0 && day.completed < day.total && (
                  <div className="text-[10px] text-gray-400">
                    {day.completed}/{day.total}
                  </div>
                )}
              </div>
            ))}
          </div>
          
          {/* סיכום שבועי */}
          <div className="flex justify-around mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 text-sm">
            <div className="text-center">
              <div className="text-gray-500">משימות</div>
              <div className="font-bold text-gray-900 dark:text-white">
                {weekStats.completedTasks}/{weekStats.totalTasks}
              </div>
            </div>
            <div className="text-center">
              <div className="text-gray-500">שעות עבודה</div>
              <div className="font-bold text-gray-900 dark:text-white">
                {formatMinutes(weekStats.totalTime)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-gray-500">היום</div>
              <div className="font-bold text-gray-900 dark:text-white">
                {formatMinutes(stats.timeSpentToday)}
              </div>
            </div>
          </div>
        </motion.div>

        {/* === המלצות חכמות === */}
        {recommendations.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-l from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-2xl p-4"
          >
            <h3 className="font-bold text-gray-900 dark:text-white mb-2">💡 המלצות</h3>
            <div className="space-y-2">
              {recommendations.map((rec) => (
                <div
                  key={rec.id}
                  className="flex items-center gap-3 p-3 bg-white/60 dark:bg-gray-800/60 rounded-xl"
                >
                  <span className="text-xl">{rec.icon}</span>
                  <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">{rec.text}</span>
                  {rec.action && (
                    <button
                      onClick={rec.action}
                      className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium rounded-lg transition-colors"
                    >
                      טפלי
                    </button>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* === פתקים מהירים === */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm"
        >
          <h3 className="font-bold text-gray-900 dark:text-white mb-3">📝 פתק מהיר</h3>
          
          <div className="flex gap-2">
            <input
              type="text"
              value={quickNote}
              onChange={(e) => setQuickNote(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && saveNote()}
              placeholder="רשמי משהו..."
              className="flex-1 px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={saveNote}
              disabled={!quickNote.trim()}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white font-medium rounded-xl transition-colors"
            >
              💾
            </button>
          </div>
          
          {notes.length > 0 && (
            <div className="mt-3 space-y-2">
              {(showAllNotes ? notes : notes.slice(0, 3)).map((note) => (
                <div
                  key={note.id}
                  className="flex items-start gap-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg group"
                >
                  <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">
                    {note.text}
                  </span>
                  <button
                    onClick={() => deleteNote(note.id)}
                    className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {notes.length > 3 && (
                <button
                  onClick={() => setShowAllNotes(!showAllNotes)}
                  className="text-sm text-blue-500 hover:underline"
                >
                  {showAllNotes ? 'הסתר' : `עוד ${notes.length - 3} פתקים...`}
                </button>
              )}
            </div>
          )}
        </motion.div>

        {/* === כפתורי פעולה === */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-3 gap-2"
        >
          <button
            onClick={() => setShowTaskForm(true)}
            className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-all text-center"
          >
            <span className="text-2xl block mb-1">➕</span>
            <span className="text-xs text-gray-600 dark:text-gray-400">משימה</span>
          </button>
          
          <button
            onClick={() => setShowUrgentForm(true)}
            className="p-4 bg-gradient-to-br from-red-500 to-orange-500 rounded-xl shadow-sm hover:shadow-md transition-all text-center text-white"
          >
            <span className="text-2xl block mb-1">🚨</span>
            <span className="text-xs">בלת"ם</span>
          </button>
          
          <Link
            to="/focus"
            className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-all text-center"
          >
            <span className="text-2xl block mb-1">🎯</span>
            <span className="text-xs text-gray-600 dark:text-gray-400">מיקוד</span>
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-3 gap-2"
        >
          <Link
            to="/daily"
            className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-all text-center"
          >
            <span className="text-2xl block mb-1">📋</span>
            <span className="text-xs text-gray-600 dark:text-gray-400">יומי</span>
          </Link>
          
          <Link
            to="/weekly"
            className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-all text-center"
          >
            <span className="text-2xl block mb-1">🗓️</span>
            <span className="text-xs text-gray-600 dark:text-gray-400">שבועי</span>
          </Link>
          
          <Link
            to="/insights"
            className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-all text-center"
          >
            <span className="text-2xl block mb-1">📊</span>
            <span className="text-xs text-gray-600 dark:text-gray-400">תובנות</span>
          </Link>
        </motion.div>

        {/* === גיימיפיקציה + תובנות === */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <GamificationPanel tasks={tasks} />
          <InsightsPanel tasks={tasks} />
        </div>

        {/* === הגדרות === */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex justify-center pt-4"
        >
          <Link 
            to="/settings" 
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            ⚙️ הגדרות
          </Link>
        </motion.div>

      </div>

      {/* === מודלים === */}
      
      {/* טופס משימה */}
      <Modal
        isOpen={showTaskForm}
        onClose={() => {
          setShowTaskForm(false);
          setEditingTask(null);
        }}
        title={editingTask ? 'עריכת משימה' : 'משימה חדשה'}
        maxWidth="max-w-lg"
      >
        <SimpleTaskForm
          task={editingTask}
          onSave={async (taskData) => {
            if (editingTask) {
              await editTask(editingTask.id, taskData);
            } else {
              await addTask(taskData);
            }
            setShowTaskForm(false);
            setEditingTask(null);
            loadTasks();
          }}
          onCancel={() => {
            setShowTaskForm(false);
            setEditingTask(null);
          }}
        />
      </Modal>

      {/* טופס בלת"ם */}
      <Modal
        isOpen={showUrgentForm}
        onClose={() => setShowUrgentForm(false)}
        title="🚨 הוספת בלת״ם"
        maxWidth="max-w-lg"
      >
        <SimpleTaskForm
          task={{ priority: 'urgent', due_date: todayISO }}
          onSave={handleAddUrgent}
          onCancel={() => setShowUrgentForm(false)}
        />
      </Modal>

      {/* מסך מיקוד */}
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

      {/* תזכורות חכמות */}
      <SmartReminders 
        tasks={tasks}
        onDeferTask={editTask}
        onStartTask={(task) => {
          setFocusTask(task);
          setShowFocus(true);
        }}
      />
    </div>
  );
}

export default SmartDashboard;
