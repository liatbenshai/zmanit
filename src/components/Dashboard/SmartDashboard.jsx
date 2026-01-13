/**
 * SmartDashboard - דשבורד מסונכרן עם כל המערכת
 * ==============================================
 * משתמש בקומפוננטות הקיימות:
 * - DailyTaskCard (אותו כרטיס כמו בתצוגה יומית)
 * - DailySummaryCard (סיכום יומי)
 * - WeeklySummaryCard (סיכום שבועי)
 * - WorkPaceInsights (תובנות קצב עבודה)
 * - SmartRecommendationsPanel (המלצות חכמות)
 * - LearningInsightsPanel (תובנות למידה)
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useTasks } from '../../hooks/useTasks';
import { useAuth } from '../../hooks/useAuth';

// קומפוננטות קיימות מהמערכת
import DailyTaskCard from '../DailyView/DailyTaskCard';
import SimpleTaskForm from '../DailyView/SimpleTaskForm';
import DailySummaryCard from './DailySummaryCard';
import WeeklySummaryCard from './WeeklySummaryCard';
import WorkPaceInsights from './WorkPaceInsights';
import SmartRecommendationsPanel from './SmartRecommendationsPanel';
import LearningInsightsPanel from '../Learning/LearningInsightsPanel';
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

const HEBREW_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

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
  const [showInsights, setShowInsights] = useState(false);
  const [activeTab, setActiveTab] = useState('today'); // today, week, insights
  
  const today = new Date();
  const todayISO = today.toISOString().split('T')[0];
  const currentMinutes = today.getHours() * 60 + today.getMinutes();

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

  // משימות היום (לא הושלמו)
  const todayTasksRemaining = useMemo(() => {
    if (!tasks) return [];
    return tasks.filter(t => 
      t.due_date === todayISO && !t.deleted_at && !t.is_completed
    ).sort((a, b) => {
      if (a.priority === 'urgent' && b.priority !== 'urgent') return -1;
      if (b.priority === 'urgent' && a.priority !== 'urgent') return 1;
      if (a.due_time && b.due_time) return a.due_time.localeCompare(b.due_time);
      if (a.due_time) return -1;
      return 0;
    });
  }, [tasks, todayISO]);

  // משימות שהושלמו היום
  const todayTasksCompleted = useMemo(() => {
    if (!tasks) return [];
    return tasks.filter(t => 
      t.due_date === todayISO && !t.deleted_at && t.is_completed
    );
  }, [tasks, todayISO]);

  // סטטיסטיקות היום
  const dailyStats = useMemo(() => {
    const allToday = [...todayTasksRemaining, ...todayTasksCompleted];
    const completed = todayTasksCompleted.length;
    const total = allToday.length;
    const remaining = todayTasksRemaining.length;
    const minutesLeft = todayTasksRemaining.reduce((sum, t) => sum + (t.estimated_duration || 30), 0);
    const timeSpentToday = allToday.reduce((sum, t) => sum + (t.time_spent || 0), 0);
    
    return {
      total,
      completed,
      remaining,
      minutesLeft,
      timeSpentToday,
      overdue: overdueTasks.length,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0
    };
  }, [todayTasksRemaining, todayTasksCompleted, overdueTasks]);

  // סטטיסטיקות שבוע
  const weeklyStats = useMemo(() => {
    if (!tasks) return { totalTasks: 0, completedTasks: 0, totalMinutes: 0, startOfWeek: null, endOfWeek: null };
    
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    
    const startISO = startOfWeek.toISOString().split('T')[0];
    const endISO = endOfWeek.toISOString().split('T')[0];
    
    const weekTasks = tasks.filter(t => 
      !t.deleted_at && t.due_date >= startISO && t.due_date <= endISO
    );
    
    const completedTasks = weekTasks.filter(t => t.is_completed).length;
    const totalMinutes = weekTasks.reduce((sum, t) => sum + (t.time_spent || 0), 0);
    
    // חישוב לפי יום
    const byDay = {};
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      const dateISO = date.toISOString().split('T')[0];
      const dayTasks = weekTasks.filter(t => t.due_date === dateISO);
      byDay[dateISO] = {
        total: dayTasks.length,
        completed: dayTasks.filter(t => t.is_completed).length,
        minutes: dayTasks.reduce((sum, t) => sum + (t.time_spent || 0), 0)
      };
    }
    
    return {
      totalTasks: weekTasks.length,
      completedTasks,
      totalMinutes,
      startOfWeek,
      endOfWeek,
      byDay
    };
  }, [tasks, today]);

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
      toast.error('שגיאה בהעברת משימות');
    }
  }, [overdueTasks, editTask, todayISO, loadTasks]);

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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-24" dir="rtl">
      
      {/* === טיימר פעיל (sticky) === */}
      {activeTimer && (
        <div className="sticky top-0 z-40 bg-gradient-to-l from-green-500 to-emerald-600 text-white shadow-lg">
          <div className="max-w-7xl mx-auto px-4 py-3">
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
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl font-medium"
                >
                  📺 מסך מיקוד
                </button>
                <button 
                  onClick={() => { localStorage.removeItem('zmanit_active_timer'); setActiveTimer(null); }} 
                  className="px-3 py-2 bg-white/20 hover:bg-white/30 rounded-xl"
                >
                  ⏹️
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-6">
        
        {/* === כותרת + כפתורים === */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {getGreeting()}, {user?.user_metadata?.full_name?.split(' ')[0] || 'שלום'} 👋
            </h1>
            <p className="text-gray-500 mt-1">
              יום {HEBREW_DAYS[today.getDay()]}, {today.toLocaleDateString('he-IL')}
            </p>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={() => { setEditingTask(null); setShowTaskForm(true); }}
              className="px-5 py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl shadow-md transition-all flex items-center gap-2"
            >
              <span className="text-xl">➕</span>
              משימה חדשה
            </button>
            <button
              onClick={() => { 
                setEditingTask({ priority: 'urgent', due_date: todayISO }); 
                setShowTaskForm(true); 
              }}
              className="px-5 py-3 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white font-bold rounded-xl shadow-md transition-all flex items-center gap-2"
            >
              <span className="text-xl">🚨</span>
              בלת״ם
            </button>
          </div>
        </div>

        {/* === ציטוט === */}
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 bg-gradient-to-l from-indigo-500 via-purple-500 to-pink-500 rounded-2xl p-4 text-white shadow-lg"
        >
          <div className="flex items-start gap-3">
            <span className="text-3xl">"</span>
            <div>
              <p className="text-lg leading-relaxed">{getDailyQuote().text}</p>
              <p className="text-white/70 mt-1">— {getDailyQuote().author}</p>
            </div>
          </div>
        </motion.div>

        {/* === סטטוס מהיר === */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
            <div className="text-3xl font-bold text-blue-600">{dailyStats.remaining}</div>
            <div className="text-sm text-gray-500">משימות נותרו</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
            <div className="text-3xl font-bold text-green-600">{dailyStats.completed}</div>
            <div className="text-sm text-gray-500">הושלמו היום</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
            <div className="text-3xl font-bold text-purple-600">{formatMinutes(dailyStats.timeSpentToday)}</div>
            <div className="text-sm text-gray-500">עבדת היום</div>
          </div>
          {dailyStats.overdue > 0 ? (
            <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 shadow-sm border border-red-200 dark:border-red-800">
              <div className="text-3xl font-bold text-red-600">{dailyStats.overdue}</div>
              <div className="text-sm text-red-500">באיחור!</div>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
              <div className="text-3xl font-bold text-orange-600">{formatMinutes(dailyStats.minutesLeft)}</div>
              <div className="text-sm text-gray-500">עבודה נותרה</div>
            </div>
          )}
        </div>

        {/* === פס התקדמות === */}
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-500 mb-2">
            <span>התקדמות היום</span>
            <span>{dailyStats.completionRate}%</span>
          </div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${dailyStats.completionRate}%` }}
              transition={{ duration: 0.5 }}
              className="h-full bg-gradient-to-l from-green-500 to-emerald-500 rounded-full"
            />
          </div>
        </div>

        {/* === טאבים === */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          <button
            onClick={() => setActiveTab('today')}
            className={`px-4 py-2 rounded-xl font-medium transition-all whitespace-nowrap ${
              activeTab === 'today' 
                ? 'bg-blue-500 text-white shadow-md' 
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100'
            }`}
          >
            📋 היום ({dailyStats.remaining + dailyStats.completed})
          </button>
          <button
            onClick={() => setActiveTab('week')}
            className={`px-4 py-2 rounded-xl font-medium transition-all whitespace-nowrap ${
              activeTab === 'week' 
                ? 'bg-blue-500 text-white shadow-md' 
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100'
            }`}
          >
            🗓️ השבוע ({weeklyStats.totalTasks})
          </button>
          <button
            onClick={() => setActiveTab('insights')}
            className={`px-4 py-2 rounded-xl font-medium transition-all whitespace-nowrap ${
              activeTab === 'insights' 
                ? 'bg-blue-500 text-white shadow-md' 
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100'
            }`}
          >
            📊 תובנות
          </button>
          <button
            onClick={() => setActiveTab('recommendations')}
            className={`px-4 py-2 rounded-xl font-medium transition-all whitespace-nowrap ${
              activeTab === 'recommendations' 
                ? 'bg-blue-500 text-white shadow-md' 
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100'
            }`}
          >
            💡 המלצות
          </button>
        </div>

        {/* === תוכן לפי טאב === */}
        <AnimatePresence mode="wait">
          
          {/* טאב היום */}
          {activeTab === 'today' && (
            <motion.div
              key="today"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* משימות באיחור */}
              {overdueTasks.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-5 border border-red-200 dark:border-red-800">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-red-700 dark:text-red-400 flex items-center gap-2">
                      🔥 משימות באיחור ({overdueTasks.length})
                    </h2>
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
                        onStartFocus={handleStartFocus}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* משימות היום */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                    📋 משימות להיום ({todayTasksRemaining.length})
                  </h2>
                  <Link to="/daily" className="text-blue-500 hover:underline text-sm">
                    תצוגה מלאה →
                  </Link>
                </div>
                
                {todayTasksRemaining.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-5xl mb-3">🎉</div>
                    <p className="text-gray-500 text-lg">סיימת את כל המשימות להיום!</p>
                    <button
                      onClick={() => { setEditingTask(null); setShowTaskForm(true); }}
                      className="mt-4 px-6 py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl"
                    >
                      ➕ הוסיפי משימה חדשה
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {todayTasksRemaining.map(task => (
                      <DailyTaskCard
                        key={task.id}
                        task={task}
                        onEdit={handleEditTask}
                        onStartFocus={handleStartFocus}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* משימות שהושלמו */}
              {todayTasksCompleted.length > 0 && (
                <div className="bg-green-50 dark:bg-green-900/20 rounded-2xl p-5">
                  <h2 className="text-lg font-bold text-green-700 dark:text-green-400 mb-4">
                    ✅ הושלמו היום ({todayTasksCompleted.length})
                  </h2>
                  <div className="space-y-3 opacity-70">
                    {todayTasksCompleted.slice(0, 5).map(task => (
                      <DailyTaskCard
                        key={task.id}
                        task={task}
                        onEdit={handleEditTask}
                      />
                    ))}
                    {todayTasksCompleted.length > 5 && (
                      <Link to="/daily" className="block text-center text-green-600 hover:underline">
                        עוד {todayTasksCompleted.length - 5} משימות...
                      </Link>
                    )}
                  </div>
                </div>
              )}

              {/* סיכום יומי */}
              <DailySummaryCard 
                tasks={tasks} 
                stats={dailyStats} 
                date={todayISO} 
              />
            </motion.div>
          )}

          {/* טאב השבוע */}
          {activeTab === 'week' && (
            <motion.div
              key="week"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <WeeklySummaryCard 
                stats={weeklyStats} 
                startOfWeek={weeklyStats.startOfWeek} 
                endOfWeek={weeklyStats.endOfWeek} 
              />
              
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                    🗓️ תצוגת שבוע
                  </h2>
                  <Link to="/weekly" className="text-blue-500 hover:underline text-sm">
                    תכנון שבועי →
                  </Link>
                </div>
                
                <div className="grid grid-cols-7 gap-2">
                  {Object.entries(weeklyStats.byDay || {}).map(([date, data]) => {
                    const dayDate = new Date(date);
                    const isToday = date === todayISO;
                    const isPast = date < todayISO;
                    const allDone = data.total > 0 && data.completed === data.total;
                    
                    return (
                      <div
                        key={date}
                        className={`text-center p-3 rounded-xl transition-all ${
                          isToday 
                            ? 'bg-blue-100 dark:bg-blue-900/50 ring-2 ring-blue-500' 
                            : allDone
                              ? 'bg-green-100 dark:bg-green-900/30'
                              : isPast && data.total > data.completed
                                ? 'bg-red-50 dark:bg-red-900/20'
                                : 'bg-gray-50 dark:bg-gray-700/50'
                        }`}
                      >
                        <div className="text-xs text-gray-500 font-medium">
                          {HEBREW_DAYS[dayDate.getDay()]}
                        </div>
                        <div className="text-sm text-gray-400">
                          {dayDate.getDate()}/{dayDate.getMonth() + 1}
                        </div>
                        <div className={`text-2xl font-bold mt-1 ${
                          allDone ? 'text-green-500' 
                          : data.total === 0 ? 'text-gray-300'
                          : isToday ? 'text-blue-600'
                          : 'text-gray-700 dark:text-gray-300'
                        }`}>
                          {data.total === 0 ? '-' : allDone ? '✓' : data.total}
                        </div>
                        {data.total > 0 && !allDone && (
                          <div className="text-xs text-gray-400">
                            {data.completed}/{data.total}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* טאב תובנות */}
          {activeTab === 'insights' && (
            <motion.div
              key="insights"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <WorkPaceInsights tasks={tasks} />
              <LearningInsightsPanel tasks={tasks} />
            </motion.div>
          )}

          {/* טאב המלצות */}
          {activeTab === 'recommendations' && (
            <motion.div
              key="recommendations"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <SmartRecommendationsPanel 
                tasks={tasks} 
                onUpdateTask={editTask}
                onAddTask={addTask}
                onRefresh={loadTasks}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* === ניווט מהיר === */}
        <div className="fixed bottom-4 left-4 right-4 md:relative md:bottom-auto md:left-auto md:right-auto md:mt-8">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-2 flex justify-around max-w-md mx-auto">
            <Link to="/daily" className="flex flex-col items-center p-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <span className="text-2xl">📋</span>
              <span className="text-xs text-gray-500 mt-1">יומי</span>
            </Link>
            <Link to="/weekly" className="flex flex-col items-center p-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <span className="text-2xl">🗓️</span>
              <span className="text-xs text-gray-500 mt-1">שבועי</span>
            </Link>
            <Link to="/focus" className="flex flex-col items-center p-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <span className="text-2xl">🎯</span>
              <span className="text-xs text-gray-500 mt-1">מיקוד</span>
            </Link>
            <Link to="/insights" className="flex flex-col items-center p-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <span className="text-2xl">📊</span>
              <span className="text-xs text-gray-500 mt-1">תובנות</span>
            </Link>
            <Link to="/settings" className="flex flex-col items-center p-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <span className="text-2xl">⚙️</span>
              <span className="text-xs text-gray-500 mt-1">הגדרות</span>
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
