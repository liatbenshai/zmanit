import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { useTasks } from '../../hooks/useTasks';
import { useAuth } from '../../hooks/useAuth';
import { getTaskType, getAllTaskTypes } from '../../config/taskTypes';
import { getLearningStats } from '../../utils/taskLearning';
import { smartScheduleWeekV4 } from '../../utils/smartSchedulerV4';
import SimpleTaskForm from '../DailyView/SimpleTaskForm';
import DailySummary from '../Analytics/DailySummary';
import WeeklyReview from '../Analytics/WeeklyReview';
import AdminSettings from '../Admin/AdminSettings';
import InterruptionsTracker from './InterruptionsTracker';
import FullScreenFocus from '../ADHD/FullScreenFocus';
import Modal from '../UI/Modal';
import Button from '../UI/Button';
import toast from 'react-hot-toast';
import { supabase } from '../../services/supabase';

/**
 * דשבורד חכם - גרסה משופרת
 * =====================================
 * ✅ ניווט ברור לכל העמודים
 * ✅ סיכום משימות להיום
 * ✅ המלצות אישיות
 * ✅ תצוגת שבוע מהירה
 * ✅ ציטוט מוטיבציה יומי
 */

// ציטוטים מוטיבציוניים
const MOTIVATIONAL_QUOTES = [
  { text: "הדרך הטובה ביותר לחזות את העתיד היא ליצור אותו", author: "פיטר דרוקר" },
  { text: "כל משימה גדולה מתחילה בצעד קטן", author: "לאו דזה" },
  { text: "ההצלחה היא סכום של מאמצים קטנים, שחוזרים על עצמם יום אחר יום", author: "רוברט קולייר" },
  { text: "אל תמתיני להזדמנות. צרי אותה", author: "ג'ורג' ברנרד שו" },
  { text: "העתיד שייך לאלה שמאמינים ביופי החלומות שלהם", author: "אלינור רוזוולט" },
  { text: "הדרך היחידה לעשות עבודה נהדרת היא לאהוב את מה שאת עושה", author: "סטיב ג'ובס" },
  { text: "קודם את משנה את ההרגלים שלך, ואז ההרגלים משנים אותך", author: "ג'ים רון" },
  { text: "התחילי מהמקום בו את נמצאת. השתמשי במה שיש לך. עשי מה שאת יכולה", author: "ארתור אש" },
  { text: "אין זמן טוב יותר מעכשיו", author: "ישן" },
  { text: "המסע של אלף מיל מתחיל בצעד אחד", author: "לאו דזה" },
];

function SmartDashboard() {
  const navigate = useNavigate();
  const { tasks, loading, toggleComplete, loadTasks, editTask, addTask, dataVersion } = useTasks();
  const { user } = useAuth();
  
  // States
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [showDailySummary, setShowDailySummary] = useState(false);
  const [showWeeklySummary, setShowWeeklySummary] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showInterruptions, setShowInterruptions] = useState(false);
  const [focusTask, setFocusTask] = useState(null);
  const [showFocus, setShowFocus] = useState(false);
  
  // ציטוט יומי
  const [dailyQuote, setDailyQuote] = useState(null);
  
  // טעינת ציטוט יומי
  useEffect(() => {
    const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
    const quoteIndex = dayOfYear % MOTIVATIONAL_QUOTES.length;
    setDailyQuote(MOTIVATIONAL_QUOTES[quoteIndex]);
  }, []);

  // תאריכים
  const today = new Date();
  const todayISO = today.toISOString().split('T')[0];
  const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  const todayName = dayNames[today.getDay()];

  // חישוב שבוע
  const weekStart = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const weekPlan = useMemo(() => {
    if (!tasks || tasks.length === 0) return null;
    return smartScheduleWeekV4(weekStart, tasks);
  }, [tasks, weekStart, dataVersion]);

  // סטטיסטיקות
  const stats = useMemo(() => {
    if (!tasks) return {
      todayTasks: [],
      completedToday: [],
      urgentTasks: [],
      overdueTasks: [],
      weekDays: []
    };

    // משימות להיום
    const todayTasks = tasks.filter(t => {
      if (t.is_completed || t.deleted_at) return false;
      if (t.due_date === todayISO) return true;
      if (t.start_date === todayISO && !t.due_date) return true;
      return false;
    }).sort((a, b) => {
      if (a.priority === 'urgent' && b.priority !== 'urgent') return -1;
      if (b.priority === 'urgent' && a.priority !== 'urgent') return 1;
      if (a.due_time && b.due_time) return a.due_time.localeCompare(b.due_time);
      return 0;
    });

    // משימות שהושלמו היום
    const completedToday = tasks.filter(t => 
      t.is_completed && t.completed_at?.startsWith(todayISO)
    );

    // משימות דחופות
    const urgentTasks = todayTasks.filter(t => t.priority === 'urgent');

    // משימות באיחור
    const overdueTasks = tasks.filter(t => 
      !t.is_completed && !t.deleted_at && t.due_date && t.due_date < todayISO
    );

    // ימי השבוע הקרוב
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dateISO = date.toISOString().split('T')[0];
      
      const dayTasks = tasks.filter(t => {
        if (t.is_completed || t.deleted_at) return false;
        return t.due_date === dateISO || t.start_date === dateISO;
      });
      
      const totalMinutes = dayTasks.reduce((sum, t) => sum + (t.estimated_duration || 0), 0);
      
      weekDays.push({
        date,
        dateISO,
        dayName: dayNames[date.getDay()],
        dayNumber: date.getDate(),
        isToday: i === 0,
        taskCount: dayTasks.length,
        totalMinutes,
        urgentCount: dayTasks.filter(t => t.priority === 'urgent').length
      });
    }

    // זמנים
    const plannedToday = todayTasks.reduce((sum, t) => sum + (t.estimated_duration || 0), 0);
    const workedToday = completedToday.reduce((sum, t) => sum + (t.time_spent || 0), 0);

    return {
      todayTasks,
      completedToday,
      urgentTasks,
      overdueTasks,
      weekDays,
      plannedToday,
      workedToday,
      totalToday: todayTasks.length + completedToday.length
    };
  }, [tasks, todayISO, dataVersion]);

  // המלצות יומיות
  const recommendations = useMemo(() => {
    const recs = [];
    
    // משימות באיחור
    if (stats.overdueTasks.length > 0) {
      recs.push({
        id: 'overdue',
        icon: '⚠️',
        title: `${stats.overdueTasks.length} משימות באיחור`,
        description: 'כדאי לטפל בהן או להעביר לתאריך חדש',
        action: () => navigate('/daily'),
        priority: 'high'
      });
    }

    // יום עמוס
    if (stats.plannedToday > 480) {
      recs.push({
        id: 'overloaded',
        icon: '📊',
        title: 'היום עמוס מדי',
        description: `${Math.round(stats.plannedToday / 60)} שעות מתוכננות - שקלי להעביר משימות`,
        action: () => navigate('/daily'),
        priority: 'medium'
      });
    }

    // אין משימות להיום
    if (stats.todayTasks.length === 0 && stats.completedToday.length === 0) {
      recs.push({
        id: 'empty-day',
        icon: '📝',
        title: 'אין משימות להיום',
        description: 'הוסיפי משימות או בדקי את התכנון השבועי',
        action: () => setShowTaskForm(true),
        priority: 'low'
      });
    }

    // הרבה משימות דחופות
    if (stats.urgentTasks.length >= 3) {
      recs.push({
        id: 'too-urgent',
        icon: '🔥',
        title: `${stats.urgentTasks.length} משימות דחופות`,
        description: 'אולי כדאי לבדוק אם כולן באמת דחופות',
        action: () => navigate('/daily'),
        priority: 'medium'
      });
    }

    return recs.sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.priority] - order[b.priority];
    });
  }, [stats, navigate]);

  // פונקציות
  const handleComplete = async (taskId) => {
    try {
      await toggleComplete(taskId);
      toast.success('✅ משימה הושלמה!');
    } catch (err) {
      toast.error('שגיאה');
    }
  };

  const handleStartTask = (task) => {
    setFocusTask(task);
    setShowFocus(true);
  };

  const handleTimeUpdate = async (minutes) => {
    if (!focusTask) return;
    try {
      const newTimeSpent = (focusTask.time_spent || 0) + minutes;
      await editTask(focusTask.id, { time_spent: newTimeSpent });
      
      // ✅ עדכון focusTask מקומית כדי שהזמן יישמר
      setFocusTask(prev => prev ? { ...prev, time_spent: newTimeSpent } : null);
      
      console.log('💾 SmartDashboard - זמן עודכן:', newTimeSpent, 'דקות');
    } catch (err) {
      console.error('שגיאה בעדכון זמן:', err);
    }
  };

  const handleFocusComplete = async () => {
    if (!focusTask) return;
    try {
      await toggleComplete(focusTask.id);
      setShowFocus(false);
      setFocusTask(null);
      toast.success('✅ כל הכבוד!');
    } catch (err) {
      toast.error('שגיאה');
    }
  };

  const handleLogInterruption = async (interruption) => {
    if (!user) return;
    try {
      await supabase.from('interruptions').insert({
        user_id: user.id,
        type: interruption.type,
        description: interruption.description,
        task_id: interruption.task_id,
        started_at: new Date().toISOString()
      });
    } catch (err) {
      console.error('שגיאה בתיעוד הפרעה:', err);
    }
  };

  const formatMinutes = (minutes) => {
    if (!minutes || minutes <= 0) return '0 דק\'';
    if (minutes < 60) return `${minutes} דק'`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return `${hours} שעות`;
    return `${hours}:${mins.toString().padStart(2, '0')}`;
  };

  const getGreeting = () => {
    const hour = today.getHours();
    if (hour < 12) return 'בוקר טוב';
    if (hour < 17) return 'צהריים טובים';
    if (hour < 21) return 'ערב טוב';
    return 'לילה טוב';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="smart-dashboard p-4 max-w-5xl mx-auto" dir="rtl">
      
      {/* === כותרת === */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {getGreeting()}! 👋
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          יום {todayName}, {today.toLocaleDateString('he-IL')}
        </p>
        
        {/* ציטוט יומי - מעוצב */}
        {dailyQuote && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-5 relative overflow-hidden"
          >
            {/* כרטיס הציטוט */}
            <div className="relative bg-gradient-to-l from-indigo-500 via-purple-500 to-pink-500 rounded-2xl p-5 shadow-lg">
              {/* עיגולים דקורטיביים */}
              <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
              <div className="absolute bottom-0 left-0 w-16 h-16 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2"></div>
              
              {/* אייקון ציטוט */}
              <div className="absolute top-3 right-3 text-white/20 text-5xl font-serif">"</div>
              
              {/* תוכן */}
              <div className="relative z-10">
                <p className="text-white text-lg font-medium leading-relaxed pr-6">
                  {dailyQuote.text}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <div className="w-8 h-0.5 bg-white/40 rounded-full"></div>
                  <p className="text-white/80 text-sm font-light">
                    {dailyQuote.author}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* === ניווט מהיר === */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-4 gap-3 mb-6"
      >
        <NavCard icon="📋" label="יומי" link="/daily" color="blue" />
        <NavCard icon="🗓️" label="שבועי" link="/weekly" color="purple" />
        <NavCard icon="🎯" label="ממוקד" link="/focus" color="green" />
        <NavCard icon="📊" label="תובנות" link="/insights" color="orange" />
      </motion.div>

      {/* === המלצות === */}
      {recommendations.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mb-6 space-y-2"
        >
          {recommendations.slice(0, 2).map((rec) => (
            <button
              key={rec.id}
              onClick={rec.action}
              className={`w-full text-right p-4 rounded-xl border transition-all flex items-center gap-3 ${
                rec.priority === 'high' 
                  ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 hover:bg-red-100'
                  : rec.priority === 'medium'
                    ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 hover:bg-orange-100'
                    : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 hover:bg-blue-100'
              }`}
            >
              <span className="text-2xl">{rec.icon}</span>
              <div className="flex-1">
                <p className="font-medium text-gray-900 dark:text-white">{rec.title}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{rec.description}</p>
              </div>
              <span className="text-gray-400">→</span>
            </button>
          ))}
        </motion.div>
      )}

      {/* === סיכום היום === */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-200 dark:border-gray-700 mb-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            📋 היום
          </h2>
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span>✅ {stats.completedToday.length}/{stats.totalToday}</span>
            <span>⏱️ {formatMinutes(stats.plannedToday)}</span>
          </div>
        </div>

        {/* פס התקדמות */}
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full mb-4 overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all"
            style={{ 
              width: `${stats.totalToday > 0 ? (stats.completedToday.length / stats.totalToday) * 100 : 0}%` 
            }}
          />
        </div>

        {/* משימות */}
        {stats.todayTasks.length === 0 ? (
          <div className="text-center py-6">
            <div className="text-4xl mb-2">🎉</div>
            <p className="text-gray-600 dark:text-gray-400">סיימת הכל להיום!</p>
            <button
              onClick={() => setShowTaskForm(true)}
              className="mt-3 text-blue-500 hover:underline text-sm"
            >
              + הוסיפי משימה חדשה
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {stats.todayTasks.slice(0, 5).map((task, index) => (
              <TaskRow
                key={task.id}
                task={task}
                onComplete={() => handleComplete(task.id)}
                onStart={() => handleStartTask(task)}
                onEdit={() => {
                  setEditingTask(task);
                  setShowTaskForm(true);
                }}
              />
            ))}
            {stats.todayTasks.length > 5 && (
              <Link 
                to="/daily"
                className="block text-center text-blue-500 hover:underline text-sm py-2"
              >
                + עוד {stats.todayTasks.length - 5} משימות
              </Link>
            )}
          </div>
        )}

        {/* כפתורי פעולה */}
        <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setShowTaskForm(true)}
            className="flex-1 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
          >
            ➕ הוסף משימה
          </button>
          <Link
            to="/daily"
            className="flex-1 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors text-center"
          >
            צפייה מלאה →
          </Link>
        </div>
      </motion.div>

      {/* === תצוגת שבוע === */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-200 dark:border-gray-700 mb-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            🗓️ השבוע הקרוב
          </h2>
          <Link to="/weekly" className="text-blue-500 hover:underline text-sm">
            צפייה מלאה →
          </Link>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {stats.weekDays.map((day) => (
            <Link
              key={day.dateISO}
              to={`/daily?date=${day.dateISO}`}
              className={`p-3 rounded-xl text-center transition-all ${
                day.isToday 
                  ? 'bg-blue-500 text-white' 
                  : day.taskCount > 0
                    ? 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                    : 'bg-gray-50 dark:bg-gray-800 text-gray-400'
              }`}
            >
              <div className="text-xs font-medium">{day.dayName}</div>
              <div className="text-lg font-bold">{day.dayNumber}</div>
              {day.taskCount > 0 && (
                <div className={`text-xs mt-1 ${day.isToday ? 'text-white/80' : 'text-gray-500'}`}>
                  {day.taskCount} משימות
                  {day.urgentCount > 0 && <span className="text-red-500 mr-1">🔥</span>}
                </div>
              )}
            </Link>
          ))}
        </div>
      </motion.div>

      {/* === כפתורי פעולה נוספים === */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="grid grid-cols-3 gap-3 mb-6"
      >
        <button
          onClick={() => setShowDailySummary(true)}
          className="p-4 bg-gradient-to-l from-blue-500 to-indigo-600 text-white rounded-xl font-medium hover:opacity-90 transition-all text-center"
        >
          <span className="text-xl block mb-1">📊</span>
          <span className="text-sm">סיכום היום</span>
        </button>
        <button
          onClick={() => setShowWeeklySummary(true)}
          className="p-4 bg-gradient-to-l from-purple-500 to-pink-600 text-white rounded-xl font-medium hover:opacity-90 transition-all text-center"
        >
          <span className="text-xl block mb-1">📈</span>
          <span className="text-sm">סיכום השבוע</span>
        </button>
        <button
          onClick={() => setShowInterruptions(true)}
          className="p-4 bg-gradient-to-l from-orange-500 to-red-600 text-white rounded-xl font-medium hover:opacity-90 transition-all text-center"
        >
          <span className="text-xl block mb-1">⏸️</span>
          <span className="text-sm">הפרעות</span>
        </button>
      </motion.div>

      {/* === הגדרות === */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="flex justify-center"
      >
        <button
          onClick={() => setShowSettings(true)}
          className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-sm flex items-center gap-2"
        >
          ⚙️ הגדרות מערכת
        </button>
      </motion.div>

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
          initialData={editingTask}
          onClose={() => {
            setShowTaskForm(false);
            setEditingTask(null);
            loadTasks();
          }}
        />
      </Modal>

      {/* סיכום יומי */}
      <Modal
        isOpen={showDailySummary}
        onClose={() => setShowDailySummary(false)}
        title=""
        maxWidth="max-w-lg"
        hideHeader
      >
        <DailySummary 
          tasks={tasks}
          date={today}
          onClose={() => setShowDailySummary(false)}
          onMoveTasks={async (tasksToMove, targetDate) => {
            try {
              for (const taskId of tasksToMove) {
                await editTask(taskId, { due_date: targetDate, was_deferred: true });
              }
              toast.success(`${tasksToMove.length} משימות הועברו`);
              loadTasks();
              setShowDailySummary(false);
            } catch (err) {
              toast.error('שגיאה בהעברת המשימות');
            }
          }}
        />
      </Modal>

      {/* סיכום שבועי */}
      <Modal
        isOpen={showWeeklySummary}
        onClose={() => setShowWeeklySummary(false)}
        title="📊 סיכום השבוע"
        maxWidth="max-w-2xl"
      >
        <WeeklyReview onClose={() => setShowWeeklySummary(false)} />
      </Modal>

      {/* הגדרות */}
      <Modal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        title="⚙️ הגדרות מערכת"
        maxWidth="max-w-4xl"
      >
        <AdminSettings onClose={() => setShowSettings(false)} />
      </Modal>

      {/* הפרעות */}
      <Modal
        isOpen={showInterruptions}
        onClose={() => setShowInterruptions(false)}
        title="⏸️ ניתוח הפרעות"
        maxWidth="max-w-2xl"
      >
        <InterruptionsTracker />
      </Modal>

      {/* תצוגה ממוקדת */}
      <FullScreenFocus
        isOpen={showFocus}
        task={focusTask}
        onClose={() => setShowFocus(false)}
        onComplete={handleFocusComplete}
        onPause={handleTimeUpdate}
        onTimeUpdate={handleTimeUpdate}
        onAddTask={async (newTask) => {
          await addTask(newTask);
          loadTasks();
        }}
        onLogInterruption={handleLogInterruption}
      />
    </div>
  );
}

/**
 * כרטיס ניווט
 */
function NavCard({ icon, label, link, color }) {
  const colors = {
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200',
    purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 hover:bg-purple-200',
    green: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-200',
    orange: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 hover:bg-orange-200',
    gray: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
  };

  return (
    <Link to={link}>
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={`rounded-xl p-4 text-center transition-colors ${colors[color]}`}
      >
        <span className="text-2xl block mb-1">{icon}</span>
        <span className="text-sm font-medium">{label}</span>
      </motion.div>
    </Link>
  );
}

/**
 * שורת משימה
 */
function TaskRow({ task, onComplete, onStart, onEdit }) {
  const taskType = getTaskType(task.task_type);
  const isUrgent = task.priority === 'urgent';

  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl transition-all group ${
      isUrgent 
        ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800' 
        : 'bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700'
    }`}>
      {/* כפתור השלמה */}
      <button
        onClick={onComplete}
        className="w-6 h-6 rounded-full border-2 border-gray-300 dark:border-gray-600 hover:border-green-500 hover:bg-green-500 flex-shrink-0 transition-all flex items-center justify-center"
      >
        <span className="text-white text-xs opacity-0 group-hover:opacity-100">✓</span>
      </button>

      {/* אייקון */}
      <span className="text-xl">{taskType.icon}</span>

      {/* תוכן */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900 dark:text-white truncate text-sm">
            {task.title}
          </span>
          {isUrgent && (
            <span className="text-xs px-1.5 py-0.5 bg-red-500 text-white rounded">
              דחוף
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          {task.due_time && <span>🕐 {task.due_time}</span>}
          {task.estimated_duration && <span>⏱️ {task.estimated_duration} דק'</span>}
        </div>
      </div>

      {/* כפתורים */}
      <div className="flex items-center gap-1">
        <button
          onClick={onStart}
          className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors"
        >
          ▶️
        </button>
        <button
          onClick={onEdit}
          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
        >
          ✏️
        </button>
      </div>
    </div>
  );
}

export default SmartDashboard;
