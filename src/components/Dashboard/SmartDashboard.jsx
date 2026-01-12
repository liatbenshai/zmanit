import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useTasks } from '../../hooks/useTasks';
import { useAuth } from '../../hooks/useAuth';
import { getTaskType, getAllTaskTypes } from '../../config/taskTypes';
import { getLearningStats } from '../../utils/taskLearning';
import SimpleTaskForm from '../DailyView/SimpleTaskForm';
import DailySummary from '../Analytics/DailySummary';
import WeeklyReview from '../Analytics/WeeklyReview';
import AdminSettings from '../Admin/AdminSettings';
import InterruptionsTracker from './InterruptionsTracker';
import SmartRecommendationsPanel from './SmartRecommendationsPanel';
import MiniTimer from './MiniTimer';
import QuickWeekPlanner from './QuickWeekPlanner'; // ✅ תכנון שבועי מהיר
import BlockerInsights from '../Learning/BlockerInsights';
import { EmergencyBufferCard } from '../Learning/EmergencyBuffer';
import { EscapeWindowCard, EscapeWindowInsights } from '../Learning/EscapeWindowDetector';
import RealEndOfDay, { EndOfDayButton } from '../Learning/RealEndOfDay';
import { DeadlineConflictBanner } from '../Notifications/DeadlineConflictModal';
import FullScreenFocus from '../ADHD/FullScreenFocus'; // ✅ תצוגה ממוקדת
import Modal from '../UI/Modal';
import Button from '../UI/Button';
import toast from 'react-hot-toast';
import { supabase } from '../../services/supabase'; // ✅ לתיעוד הפרעות

// 🧠 קומפוננטות ADHD - הועברו לתצוגה ממוקדת
// import { AddWeekTaskButton, PanicButton } from '../ADHD';

// ציטוטים מוטיבציוניים
const MOTIVATIONAL_QUOTES = [
  { text: "הדרך הטובה ביותר לחזות את העתיד היא ליצור אותו", author: "פיטר דרוקר" },
  { text: "אל תספרי את הימים, עשי שהימים יספרו", author: "מוחמד עלי" },
  { text: "ההצלחה היא סכום של מאמצים קטנים שחוזרים על עצמם יום אחרי יום", author: "רוברט קולייר" },
  { text: "התחילי מאיפה שאת, השתמשי במה שיש לך, עשי מה שאת יכולה", author: "ארתור אש" },
  { text: "הזמן שלך מוגבל, אל תבזבזי אותו בחיים של מישהו אחר", author: "סטיב ג'ובס" },
  { text: "לא מדובר בזמן, מדובר בעדיפויות", author: "אלכס בנאיין" },
  { text: "עבודה קשה מנצחת כישרון כשהכישרון לא עובד קשה", author: "טים נוטקה" },
  { text: "כל משימה גדולה מתחילה בצעד קטן", author: "לאו דזה" },
  { text: "אני לא מודדת את ההצלחה שלי במה שהשגתי, אלא במכשולים שהתגברתי עליהם", author: "בוקר טי וושינגטון" },
  { text: "היום הכי פרודוקטיבי שלך מחכה לך", author: "זמנית 💜" }
];

/**
 * דשבורד חכם - עמוד הבית
 * ✅ משודרג עם מוטיבציה, סטריק, ועיצוב מרהיב
 * ✅ הוספת משימות לכל השבוע (לא רק להיום)
 * ✅ כפתור הוספת עבודה חדשה
 * ✅ ניתוח הפרעות
 * ✅ סנכרון עם dataVersion
 */
function SmartDashboard() {
  const { tasks, loading, toggleComplete, loadTasks, editTask, addTask, dataVersion } = useTasks(); // ✅ הוספת dataVersion
  const { user } = useAuth();
  
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [selectedDateForNewTask, setSelectedDateForNewTask] = useState(null);
  const [dailyQuote, setDailyQuote] = useState(null);
  const [streak, setStreak] = useState(0);
  const [learningStats, setLearningStats] = useState(null);
  const [showDailySummary, setShowDailySummary] = useState(false);
  const [showWeeklySummary, setShowWeeklySummary] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showInterruptions, setShowInterruptions] = useState(false);
  const [showBlockerInsights, setShowBlockerInsights] = useState(false);
  const [showEscapeInsights, setShowEscapeInsights] = useState(false); // ✅ חלונות בריחה
  const [showEndOfDay, setShowEndOfDay] = useState(false); // ✅ סיכום סוף יום
  
  // ✅ תצוגה ממוקדת
  const [focusTask, setFocusTask] = useState(null);
  const [showFocus, setShowFocus] = useState(false);

  // תאריכים
  const today = new Date();
  const todayISO = today.toISOString().split('T')[0];
  const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  const todayName = dayNames[today.getDay()];

  // ✅ חישוב ימי השבוע הקרוב - תלוי ב-dataVersion לסנכרון
  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateISO = `${year}-${month}-${day}`;
      
      // ספירת משימות ליום זה
      const dayTasks = tasks.filter(t => {
        if (t.is_completed) return false;
        return t.due_date === dateISO || t.start_date === dateISO;
      });
      
      const totalMinutes = dayTasks.reduce((sum, t) => sum + (t.estimated_duration || 0), 0);
      
      days.push({
        date,
        dateISO,
        dayName: dayNames[date.getDay()],
        dayNumber: date.getDate(),
        isToday: i === 0,
        isTomorrow: i === 1,
        taskCount: dayTasks.length,
        totalMinutes,
        isFull: totalMinutes >= 400 // יותר מ-6.5 שעות
      });
    }
    return days;
  }, [today, tasks, dataVersion]); // ✅ הוספת dataVersion

  // טעינת ציטוט יומי (קבוע ליום)
  useEffect(() => {
    const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
    const quoteIndex = dayOfYear % MOTIVATIONAL_QUOTES.length;
    setDailyQuote(MOTIVATIONAL_QUOTES[quoteIndex]);
  }, []);

  // חישוב סטריק
  useEffect(() => {
    calculateStreak();
  }, [tasks]);

  // טעינת סטטיסטיקות למידה
  useEffect(() => {
    setLearningStats(getLearningStats());
  }, []);

  const calculateStreak = () => {
    if (!tasks.length) {
      setStreak(0);
      return;
    }

    // קבלת ימים עם משימות שהושלמו
    const completedDates = new Set();
    tasks.forEach(t => {
      if (t.is_completed && t.completed_at) {
        completedDates.add(t.completed_at.split('T')[0]);
      }
    });

    // ספירת ימים רצופים אחורה מהיום
    let currentStreak = 0;
    let checkDate = new Date(today);
    
    // אם היום עוד לא סיימנו משימות, נתחיל מאתמול
    if (!completedDates.has(todayISO)) {
      checkDate.setDate(checkDate.getDate() - 1);
    }

    while (true) {
      const dateStr = checkDate.toISOString().split('T')[0];
      if (completedDates.has(dateStr)) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
      // מקסימום 365 ימים לבדיקה
      if (currentStreak > 365) break;
    }

    setStreak(currentStreak);
  };

  // ברכה לפי שעה
  const getGreeting = () => {
    const hour = today.getHours();
    if (hour < 12) return 'בוקר טוב';
    if (hour < 17) return 'צהריים טובים';
    if (hour < 21) return 'ערב טוב';
    return 'לילה טוב';
  };

  // אימוג'י לפי שעה
  const getTimeEmoji = () => {
    const hour = today.getHours();
    if (hour < 6) return '🌙';
    if (hour < 12) return '☀️';
    if (hour < 17) return '🌤️';
    if (hour < 21) return '🌅';
    return '🌙';
  };

  // שם המשתמש
  const userName = user?.profile?.full_name?.split(' ')[0] || 'שלום';

  // === סטטיסטיקות ===
  const stats = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(todayISO);
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekStartISO = weekStart.toISOString().split('T')[0];

    // משימות להיום - פילטר אחיד
    const todayTasks = tasks.filter(t => {
      if (t.is_completed) return false;
      if (t.deleted_at) return false;
      
      // משימות עם תאריך היום
      if (t.due_date === todayISO) return true;
      if (t.start_date === todayISO && !t.due_date) return true;
      
      // משימות באיחור (due_date בעבר)
      if (t.due_date && t.due_date < todayISO) return true;
      
      return false;
    }).sort((a, b) => {
      // משימות באיחור קודם
      const aOverdue = a.due_date && a.due_date < todayISO;
      const bOverdue = b.due_date && b.due_date < todayISO;
      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;
      
      // לפי שעה
      if (a.due_time && b.due_time) {
        return a.due_time.localeCompare(b.due_time);
      }
      if (a.due_time) return -1;
      if (b.due_time) return 1;
      
      // לפי עדיפות
      const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
      return (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2);
    });

    // משימות שהושלמו היום
    const completedToday = tasks.filter(t => 
      t.is_completed && t.completed_at?.startsWith(todayISO)
    );

    // משימות שהושלמו השבוע
    const completedThisWeek = tasks.filter(t => 
      t.is_completed && t.completed_at >= weekStartISO
    );

    // זמן עבודה היום
    const workedToday = completedToday.reduce((sum, t) => sum + (t.time_spent || 0), 0);
    
    // זמן עבודה השבוע
    const workedThisWeek = completedThisWeek.reduce((sum, t) => sum + (t.time_spent || 0), 0);

    // זמן מתוכנן להיום
    const plannedToday = todayTasks.reduce((sum, t) => sum + (t.estimated_duration || 0), 0);

    // משימות דחופות
    const urgentTasks = todayTasks.filter(t => t.priority === 'urgent');

    // משימה הבאה (הכי דחופה או הראשונה)
    const nextTask = urgentTasks[0] || todayTasks[0];

    // התפלגות לפי סוג משימה (השבוע)
    const byType = {};
    completedThisWeek.forEach(t => {
      const type = t.task_type || 'other';
      if (!byType[type]) byType[type] = { count: 0, minutes: 0 };
      byType[type].count++;
      byType[type].minutes += t.time_spent || 0;
    });

    // חישוב אחוז היום "מלא"
    const workDayMinutes = 8 * 60;
    const dayFullness = Math.min(100, Math.round((plannedToday / workDayMinutes) * 100));

    // אחוז השלמה היום
    const totalTodayTasks = todayTasks.length + completedToday.length;
    const completionPercent = totalTodayTasks > 0 
      ? Math.round((completedToday.length / totalTodayTasks) * 100) 
      : 0;

    return {
      todayTasks,
      completedToday,
      completedThisWeek,
      workedToday,
      workedThisWeek,
      plannedToday,
      urgentTasks,
      nextTask,
      byType,
      dayFullness,
      completionPercent,
      totalTodayTasks
    };
  }, [tasks, todayISO]);

  // פורמט דקות
  function formatMinutes(minutes) {
    if (!minutes || minutes <= 0) return '0 דק\'';
    if (minutes < 60) return `${minutes} דק'`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return `${hours} שעות`;
    return `${hours}:${mins.toString().padStart(2, '0')}`;
  }

  // ✅ פורמט תאריך לכותרת
  function formatDateForTitle(dateISO, weekDays) {
    const day = weekDays.find(d => d.dateISO === dateISO);
    if (day) {
      if (day.isToday) return 'היום';
      if (day.isTomorrow) return 'מחר';
      return `יום ${day.dayName} (${day.dayNumber})`;
    }
    return dateISO;
  }

  // השלמת משימה מהדשבורד
  const handleComplete = async (taskId) => {
    try {
      await toggleComplete(taskId);
      toast.success('✅ משימה הושלמה!');
    } catch (err) {
      toast.error('שגיאה');
    }
  };

  // ✅ התחלת עבודה על משימה - פתיחת תצוגה ממוקדת
  const handleStartTask = (task) => {
    setFocusTask(task);
    setShowFocus(true);
  };

  // ✅ עדכון זמן עבודה
  const handleTimeUpdate = async (minutes) => {
    if (!focusTask) return;
    try {
      const newTimeSpent = (focusTask.time_spent || 0) + minutes;
      await editTask(focusTask.id, { time_spent: newTimeSpent });
    } catch (err) {
      console.error('שגיאה בעדכון זמן:', err);
    }
  };

  // ✅ סיום משימה מתצוגה ממוקדת
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

  // ✅ תיעוד הפרעה
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="smart-dashboard p-4 max-w-6xl mx-auto">
      {/* === Hero Section - ברכה + ציטוט === */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-purple-600 to-pink-500 p-6 mb-6 text-white"
      >
        {/* רקע דקורטיבי */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-40 h-40 bg-white rounded-full -translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute bottom-0 right-0 w-60 h-60 bg-white rounded-full translate-x-1/3 translate-y-1/3"></div>
        </div>

        <div className="relative z-10">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold mb-1">
                {getGreeting()}, {userName}! {getTimeEmoji()}
              </h1>
              <p className="text-white/80">
                יום {todayName}, {today.toLocaleDateString('he-IL')}
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              {/* ✅ כפתור הגדרות */}
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowSettings(true)}
                className="bg-white/20 backdrop-blur-sm rounded-xl p-2 hover:bg-white/30 transition-colors"
                title="הגדרות מערכת"
              >
                <span className="text-2xl">⚙️</span>
              </motion.button>

              {/* סטריק */}
              {streak > 0 && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="flex flex-col items-center bg-white/20 backdrop-blur-sm rounded-2xl px-4 py-2"
                >
                  <span className="text-3xl">🔥</span>
                  <span className="text-2xl font-bold">{streak}</span>
                  <span className="text-xs text-white/80">ימים רצופים</span>
                </motion.div>
              )}
            </div>
          </div>

          {/* ציטוט יומי */}
          {dailyQuote && (
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 mt-4">
              <p className="text-lg italic">"{dailyQuote.text}"</p>
              <p className="text-sm text-white/70 mt-1">— {dailyQuote.author}</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* === ✅ התראות התנגשות דדליין === */}
      <div className="mb-6">
        <DeadlineConflictBanner />
      </div>

      {/* === Progress Ring + Quick Stats === */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* טבעת התקדמות */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center"
        >
          <ProgressRing 
            percent={stats.completionPercent} 
            size={120}
            strokeWidth={10}
          />
          <div className="text-center mt-3">
            <p className="text-sm text-gray-500 dark:text-gray-400">התקדמות היום</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              {stats.completedToday.length} / {stats.totalTodayTasks} משימות
            </p>
          </div>
        </motion.div>

        {/* סטטיסטיקות מהירות */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700"
        >
          <h3 className="font-bold text-gray-700 dark:text-gray-300 mb-3 text-sm">📊 היום</h3>
          <div className="space-y-3">
            <StatRow icon="⏱️" label="זמן עבודה" value={formatMinutes(stats.workedToday)} />
            <StatRow icon="📋" label="מתוכנן" value={formatMinutes(stats.plannedToday)} />
            <StatRow 
              icon="🔴" 
              label="דחופות" 
              value={stats.urgentTasks.length}
              highlight={stats.urgentTasks.length > 0}
            />
          </div>
        </motion.div>

        {/* סטטיסטיקות שבועיות */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700"
        >
          <h3 className="font-bold text-gray-700 dark:text-gray-300 mb-3 text-sm">📈 השבוע</h3>
          <div className="space-y-3">
            <StatRow icon="✅" label="הושלמו" value={`${stats.completedThisWeek.length} משימות`} />
            <StatRow icon="⏰" label="שעות עבודה" value={formatMinutes(stats.workedThisWeek)} />
            <StatRow 
              icon="🎯" 
              label="יעילות" 
              value={learningStats ? getEfficiencyText(learningStats) : '---'}
            />
          </div>
        </motion.div>
      </div>

      {/* === 🔥 טיימר מהיר - התחל לעבוד! === */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="mb-6"
      >
        <MiniTimer 
          task={stats.nextTask} 
          onComplete={async (task) => {
            await handleComplete(task.id);
          }}
        />
      </motion.div>

      {/* ✅ כפתור הוספת עבודה חדשה */}
      <motion.button
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.22 }}
        onClick={() => {
          setSelectedDateForNewTask(todayISO);
          setEditingTask(null);
          setShowTaskForm(true);
        }}
        className="w-full mb-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl p-4 shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 font-medium"
      >
        <span className="text-xl">📥</span>
        <span>הוסף עבודה חדשה</span>
      </motion.button>

      {/* ✅ תכנון השבוע - עם שיבוץ אוטומטי */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="mb-6"
      >
        <QuickWeekPlanner />
      </motion.div>

      {/* === שתי עמודות: משימות + התפלגות === */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* משימות להיום */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
              📋 עוד להיום
              <span className="text-sm font-normal text-gray-500">
                ({stats.todayTasks.length})
              </span>
            </h2>
            <Link to="/daily">
              <Button size="sm" variant="secondary">
                לתצוגה יומית →
              </Button>
            </Link>
          </div>

          {stats.todayTasks.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-5xl mb-3">🎉</div>
              <p className="text-gray-600 dark:text-gray-400 font-medium">סיימת הכל להיום!</p>
              <p className="text-sm text-gray-400 mt-1">מגיע לך מנוחה 💜</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {stats.todayTasks.slice(0, 6).map((task, index) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  index={index}
                  onComplete={() => handleComplete(task.id)}
                  onEdit={() => {
                    setEditingTask(task);
                    setShowTaskForm(true);
                  }}
                  onStart={() => handleStartTask(task)}
                />
              ))}
              {stats.todayTasks.length > 6 && (
                <Link
                  to="/daily"
                  className="block text-center text-blue-500 hover:underline text-sm py-2"
                >
                  + עוד {stats.todayTasks.length - 6} משימות
                </Link>
              )}
            </div>
          )}
        </motion.div>

        {/* התפלגות השבוע */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700"
        >
          <h2 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            📊 איפה הזמן שלי?
            <span className="text-xs font-normal text-gray-400">(השבוע)</span>
          </h2>

          {Object.keys(stats.byType).length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">📈</div>
              <p className="text-gray-500">עוד אין נתונים</p>
              <p className="text-sm text-gray-400">סיימי משימות כדי לראות סטטיסטיקות</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(stats.byType)
                .sort((a, b) => b[1].minutes - a[1].minutes)
                .slice(0, 5)
                .map(([type, data], index) => {
                  const taskType = getTaskType(type);
                  const totalMinutes = Object.values(stats.byType).reduce((sum, d) => sum + d.minutes, 0);
                  const percent = totalMinutes > 0 ? Math.round((data.minutes / totalMinutes) * 100) : 0;
                  
                  const colors = [
                    'from-blue-500 to-blue-600',
                    'from-purple-500 to-purple-600',
                    'from-pink-500 to-pink-600',
                    'from-orange-500 to-orange-600',
                    'from-green-500 to-green-600'
                  ];
                  
                  return (
                    <div key={type}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="flex items-center gap-2">
                          <span className="text-lg">{taskType.icon}</span>
                          <span className="text-gray-700 dark:text-gray-300 font-medium">
                            {taskType.name}
                          </span>
                        </span>
                        <span className="text-gray-500">
                          {formatMinutes(data.minutes)}
                        </span>
                      </div>
                      <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${percent}%` }}
                          transition={{ duration: 0.8, delay: index * 0.1 }}
                          className={`h-full bg-gradient-to-r ${colors[index % colors.length]} rounded-full`}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          <Link
            to="/insights"
            className="block text-center text-blue-500 hover:underline text-sm mt-4 pt-4 border-t border-gray-100 dark:border-gray-700"
          >
            לתובנות מלאות →
          </Link>
        </motion.div>
      </div>

      {/* === Quick Actions === */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3"
      >
        <QuickActionCard 
          icon="📋" 
          label="תצוגה יומית" 
          link="/daily" 
          color="blue"
        />
        <QuickActionCard 
          icon="🗓️" 
          label="תצוגה שבועית" 
          link="/weekly" 
          color="purple"
        />
        <QuickActionCard 
          icon="📊" 
          label="תובנות" 
          link="/insights" 
          color="green"
        />
        <QuickActionCard 
          icon="⚙️" 
          label="הגדרות" 
          link="/settings" 
          color="gray"
        />
      </motion.div>

      {/* === סיכומים === */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="mt-4 grid grid-cols-3 gap-3"
      >
        <button
          onClick={() => setShowDailySummary(true)}
          className="flex items-center justify-center gap-2 p-4 bg-gradient-to-l from-blue-500 to-indigo-600 text-white rounded-xl font-medium hover:from-blue-600 hover:to-indigo-700 transition-all shadow-sm"
        >
          <span className="text-xl">📊</span>
          <span>סיכום היום</span>
        </button>
        <button
          onClick={() => setShowWeeklySummary(true)}
          className="flex items-center justify-center gap-2 p-4 bg-gradient-to-l from-purple-500 to-pink-600 text-white rounded-xl font-medium hover:from-purple-600 hover:to-pink-700 transition-all shadow-sm"
        >
          <span className="text-xl">📈</span>
          <span>סיכום השבוע</span>
        </button>
        {/* ✅ כפתור ניתוח הפרעות */}
        <button
          onClick={() => setShowInterruptions(true)}
          className="flex items-center justify-center gap-2 p-4 bg-gradient-to-l from-orange-500 to-red-600 text-white rounded-xl font-medium hover:from-orange-600 hover:to-red-700 transition-all shadow-sm"
        >
          <span className="text-xl">⏸️</span>
          <span>ניתוח הפרעות</span>
        </button>
        {/* ✅ כפתור תובנות דחיינות */}
        <button
          onClick={() => setShowBlockerInsights(true)}
          className="flex items-center justify-center gap-2 p-4 bg-gradient-to-l from-indigo-500 to-purple-600 text-white rounded-xl font-medium hover:from-indigo-600 hover:to-purple-700 transition-all shadow-sm"
        >
          <span className="text-xl">🔍</span>
          <span>הדפוסים שלי</span>
        </button>
        {/* ✅ כפתור חלונות בריחה */}
        <EscapeWindowCard onClick={() => setShowEscapeInsights(true)} />
        {/* ✅ כפתור סיכום סוף יום */}
        <EndOfDayButton onClick={() => setShowEndOfDay(true)} tasks={tasks} />
      </motion.div>

      {/* ✅ כרטיס חלון בלת"מים */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-6"
      >
        <EmergencyBufferCard />
      </motion.div>

      {/* ✅ פאנל המלצות חכמות */}
      <SmartRecommendationsPanel 
        tasks={tasks}
        onUpdateTask={async (taskId, updates) => {
          try {
            await editTask(taskId, updates);
            toast.success('המשימה עודכנה');
            loadTasks();
          } catch (err) {
            toast.error('שגיאה בעדכון המשימה');
          }
        }}
        onAddTask={async (taskData) => {
          try {
            await addTask(taskData);
            toast.success('משימה נוספה');
            loadTasks();
          } catch (err) {
            toast.error('שגיאה בהוספת המשימה');
          }
        }}
        onRefresh={loadTasks}
      />

      {/* מודל טופס */}
      <Modal
        isOpen={showTaskForm}
        onClose={() => { setShowTaskForm(false); setEditingTask(null); setSelectedDateForNewTask(null); }}
        title={
          editingTask?.id 
            ? 'עריכת משימה' 
            : selectedDateForNewTask 
              ? `משימה חדשה ל-${formatDateForTitle(selectedDateForNewTask, weekDays)}`
              : 'משימה חדשה'
        }
      >
        <SimpleTaskForm
          task={editingTask}
          onClose={() => { 
            setShowTaskForm(false); 
            setEditingTask(null); 
            setSelectedDateForNewTask(null);
            loadTasks(); 
          }}
          defaultDate={selectedDateForNewTask || todayISO}
        />
      </Modal>

      {/* מודל סיכום יומי */}
      <AnimatePresence>
        {showDailySummary && (
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
        )}
      </AnimatePresence>

      {/* מודל סיכום שבועי */}
      <AnimatePresence>
        {showWeeklySummary && (
          <Modal
            isOpen={showWeeklySummary}
            onClose={() => setShowWeeklySummary(false)}
            title="📊 סיכום השבוע"
            maxWidth="max-w-2xl"
          >
            <WeeklyReview onClose={() => setShowWeeklySummary(false)} />
          </Modal>
        )}
      </AnimatePresence>

      {/* ✅ מודל הגדרות מערכת */}
      <AnimatePresence>
        {showSettings && (
          <Modal
            isOpen={showSettings}
            onClose={() => setShowSettings(false)}
            title="⚙️ הגדרות מערכת"
            maxWidth="max-w-4xl"
          >
            <AdminSettings onClose={() => setShowSettings(false)} />
          </Modal>
        )}
      </AnimatePresence>

      {/* ✅ מודל ניתוח הפרעות */}
      <AnimatePresence>
        {showInterruptions && (
          <Modal
            isOpen={showInterruptions}
            onClose={() => setShowInterruptions(false)}
            title="⏸️ ניתוח הפרעות"
            maxWidth="max-w-2xl"
          >
            <InterruptionsTracker />
          </Modal>
        )}
      </AnimatePresence>
      
      {/* ✅ תובנות דחיינות */}
      <BlockerInsights
        isOpen={showBlockerInsights}
        onClose={() => setShowBlockerInsights(false)}
      />
      
      {/* ✅ חלונות בריחה */}
      <EscapeWindowInsights
        isOpen={showEscapeInsights}
        onClose={() => setShowEscapeInsights(false)}
      />
      
      {/* ✅ סיכום סוף יום */}
      <RealEndOfDay
        isOpen={showEndOfDay}
        onClose={() => setShowEndOfDay(false)}
        tasks={tasks}
      />

      {/* ✅ תצוגה ממוקדת */}
      <FullScreenFocus
        isOpen={showFocus}
        task={focusTask}
        onClose={() => {
          setShowFocus(false);
          // לא מנקים את focusTask כדי שהטיימר ימשיך ברקע
        }}
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
 * טבעת התקדמות
 */
function ProgressRing({ percent, size = 100, strokeWidth = 8 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percent / 100) * circumference;

  const getColor = () => {
    if (percent >= 100) return '#22c55e'; // green
    if (percent >= 75) return '#3b82f6';  // blue
    if (percent >= 50) return '#f59e0b';  // yellow
    return '#ef4444'; // red
  };

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* רקע */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-gray-200 dark:text-gray-700"
        />
        {/* התקדמות */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={getColor()}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </svg>
      {/* טקסט במרכז */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-gray-900 dark:text-white">
          {percent}%
        </span>
      </div>
    </div>
  );
}

/**
 * שורת סטטיסטיקה
 */
function StatRow({ icon, label, value, highlight = false }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-gray-600 dark:text-gray-400 text-sm">
        <span>{icon}</span>
        <span>{label}</span>
      </span>
      <span className={`font-bold ${highlight ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>
        {value}
      </span>
    </div>
  );
}

/**
 * כרטיס משימה בוערת
 */
function FocusTaskCard({ task, onComplete }) {
  const taskType = getTaskType(task.task_type);
  
  return (
    <div className="relative overflow-hidden bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl p-5 text-white">
      <div className="absolute top-0 right-0 text-8xl opacity-10">🔥</div>
      
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs bg-white/20 px-2 py-1 rounded-full">
            {task.priority === 'urgent' ? '🔴 דחוף' : '⏰ הבא בתור'}
          </span>
        </div>
        
        <div className="flex items-center gap-3">
          <span className="text-3xl">{taskType.icon}</span>
          <div className="flex-1">
            <h3 className="text-xl font-bold">{task.title}</h3>
            <p className="text-white/80 text-sm">
              {task.estimated_duration ? `${task.estimated_duration} דקות` : 'ללא הערכה'}
            </p>
          </div>
          <button
            onClick={onComplete}
            className="bg-white/20 hover:bg-white/30 rounded-full p-3 transition-colors"
          >
            <span className="text-2xl">✓</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * שורת משימה משודרגת עם כפתור התחל
 */
function TaskRow({ task, index, onComplete, onEdit, onStart }) {
  const taskType = getTaskType(task.task_type);
  const isOverdue = task.due_date && task.due_date < new Date().toISOString().split('T')[0];
  const hasTime = task.due_time;
  
  // בדיקה אם יש טיימר פעיל למשימה זו
  const [hasActiveTimer, setHasActiveTimer] = useState(false);
  
  useEffect(() => {
    const checkTimer = () => {
      try {
        const timerData = localStorage.getItem(`timer_v2_${task.id}`);
        if (timerData) {
          const parsed = JSON.parse(timerData);
          setHasActiveTimer(parsed.isRunning || parsed.isPaused || parsed.isInterrupted);
        } else {
          setHasActiveTimer(false);
        }
      } catch (e) {
        setHasActiveTimer(false);
      }
    };
    checkTimer();
    const interval = setInterval(checkTimer, 3000);
    return () => clearInterval(interval);
  }, [task.id]);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`flex items-center gap-3 p-3 rounded-xl transition-all group ${
        isOverdue 
          ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800' 
          : hasActiveTimer
            ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
            : 'bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700/50'
      }`}
    >
      {/* כפתור השלמה */}
      <button
        onClick={onComplete}
        className={`w-6 h-6 rounded-full border-2 flex-shrink-0 transition-all flex items-center justify-center ${
          isOverdue 
            ? 'border-red-400 hover:border-red-500 hover:bg-red-500' 
            : 'border-gray-300 dark:border-gray-600 hover:border-green-500 hover:bg-green-500'
        }`}
      >
        <span className="text-white text-xs opacity-0 group-hover:opacity-100">✓</span>
      </button>

      {/* אייקון סוג */}
      <span className="text-xl">{taskType.icon}</span>

      {/* תוכן המשימה */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`font-medium truncate text-sm ${
            isOverdue ? 'text-red-700 dark:text-red-300' : 'text-gray-900 dark:text-white'
          }`}>
            {task.title}
          </span>
          {task.priority === 'urgent' && (
            <span className="text-xs px-1.5 py-0.5 bg-red-500 text-white rounded font-medium">
              דחוף
            </span>
          )}
          {isOverdue && (
            <span className="text-xs px-1.5 py-0.5 bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded">
              באיחור
            </span>
          )}
          {hasActiveTimer && (
            <span className="text-xs px-1.5 py-0.5 bg-green-500 text-white rounded animate-pulse">
              ▶️ פעיל
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {hasTime && (
            <span className="flex items-center gap-0.5">
              🕐 {task.due_time}
            </span>
          )}
          {task.estimated_duration && (
            <span className="flex items-center gap-0.5">
              ⏱️ {task.estimated_duration} דק'
            </span>
          )}
          {task.client_name && (
            <span className="text-blue-500 dark:text-blue-400">
              👤 {task.client_name}
            </span>
          )}
        </div>
      </div>

      {/* כפתורי פעולה */}
      <div className="flex items-center gap-1">
        {/* כפתור התחל */}
        {onStart && !hasActiveTimer && (
          <button
            onClick={onStart}
            className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            ▶️ התחל
          </button>
        )}
        
        {/* כפתור עריכה */}
        <button
          onClick={onEdit}
          className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
        >
          ✏️
        </button>
      </div>
    </motion.div>
  );
}

/**
 * כרטיס פעולה מהירה
 */
function QuickActionCard({ icon, label, link, color }) {
  const colors = {
    blue: 'hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300',
    purple: 'hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:border-purple-300',
    green: 'hover:bg-green-50 dark:hover:bg-green-900/20 hover:border-green-300',
    gray: 'hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300'
  };

  return (
    <Link to={link}>
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={`bg-white dark:bg-gray-800 rounded-xl p-4 text-center border border-gray-100 dark:border-gray-700 transition-colors ${colors[color]}`}
      >
        <span className="text-2xl mb-1 block">{icon}</span>
        <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
      </motion.div>
    </Link>
  );
}

/**
 * טקסט יעילות מנתוני למידה
 */
function getEfficiencyText(stats) {
  if (!stats || Object.keys(stats).length === 0) return '---';
  
  const ratios = Object.values(stats).map(s => s.ratio);
  const avgRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  
  if (avgRatio <= 1.05) return '🎯 מעולה!';
  if (avgRatio <= 1.15) return '👍 טוב';
  if (avgRatio <= 1.3) return '📈 משתפר';
  return '💪 יש מקום';
}

export default SmartDashboard;
