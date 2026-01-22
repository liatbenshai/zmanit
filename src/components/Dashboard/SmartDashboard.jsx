/**
 * SmartDashboard - דשבורד חדש מעוצב
 * =================================
 * עיצוב צבעוני וכיפי עם:
 * - סיכום יומי עם אחוז התקדמות
 * - הוספת משימה בולטת
 * - גרף שבועי מפורט
 * - הערות יומיות
 * - משפט מוטיבציה
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useTasks } from '../../hooks/useTasks';
import { useAuth } from '../../hooks/useAuth';
import SimpleTaskForm from '../DailyView/SimpleTaskForm';
import Modal from '../UI/Modal';
import toast from 'react-hot-toast';

// ========================================
// עזרים
// ========================================

const MOTIVATION_QUOTES = [
  "את יכולה לעשות את זה! יום אחד בכל פעם",
  "כל משימה שמסיימים היא צעד קדימה",
  "התחילי קטן, חלמי גדול",
  "היום הוא הזדמנות חדשה להצליח",
  "את חזקה יותר ממה שאת חושבת",
  "צעד אחד בכל פעם - ככה מגיעים רחוק",
  "אל תוותרי - ההצלחה ממש מעבר לפינה",
  "כל יום הוא התחלה חדשה",
];

function getDailyQuote() {
  const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  return MOTIVATION_QUOTES[dayOfYear % MOTIVATION_QUOTES.length];
}

function formatHoursMinutes(minutes) {
  if (!minutes || minutes === 0) return '0:00';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}:${mins.toString().padStart(2, '0')}`;
}

const HEBREW_DAYS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
const HEBREW_DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

// ========================================
// קומפוננטה ראשית
// ========================================

function SmartDashboard() {
  const { tasks, loading, toggleComplete, editTask, addTask, removeTask, loadTasks, dataVersion } = useTasks();
  const { user } = useAuth();
  
  // State
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [dailyNotes, setDailyNotes] = useState('');
  const [streak, setStreak] = useState(0);
  
  const today = new Date();
  const todayISO = today.toISOString().split('T')[0];

  // טעינת הערות מ-localStorage
  useEffect(() => {
    const savedNotes = localStorage.getItem(`zmanit_notes_${todayISO}`);
    if (savedNotes) setDailyNotes(savedNotes);
  }, [todayISO]);

  // ========================================
  // חישובים
  // ========================================

  // משימות היום
  const todayTasks = useMemo(() => {
    if (!tasks) return { remaining: [], completed: [], all: [] };
    const all = tasks.filter(t => t.due_date === todayISO && !t.deleted_at);
    return {
      all,
      remaining: all.filter(t => !t.is_completed).sort((a, b) => {
        if (a.priority === 'urgent' && b.priority !== 'urgent') return -1;
        if (b.priority === 'urgent' && a.priority !== 'urgent') return 1;
        if (a.due_time && b.due_time) return a.due_time.localeCompare(b.due_time);
        return 0;
      }),
      completed: all.filter(t => t.is_completed)
    };
  }, [tasks, todayISO]);

  // סטטיסטיקות היום
  const stats = useMemo(() => {
    const total = todayTasks.all.length;
    const completed = todayTasks.completed.length;
    const remaining = todayTasks.remaining.length;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
    const timeSpent = todayTasks.all.reduce((sum, t) => sum + (t.time_spent || 0), 0);
    
    return { total, completed, remaining, progress, timeSpent };
  }, [todayTasks, dataVersion]);

  // נתוני שבוע
  const weekData = useMemo(() => {
    if (!tasks) return [];
    
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    
    const days = [];
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      const dateISO = date.toISOString().split('T')[0];
      
      const dayTasks = tasks.filter(t => t.due_date === dateISO && !t.deleted_at);
      const completed = dayTasks.filter(t => t.is_completed).length;
      const total = dayTasks.length;
      const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
      
      // קביעת סטטוס
      let status = 'future';
      let emoji = '📅';
      
      if (dateISO === todayISO) {
        status = 'today';
        emoji = '🔄';
      } else if (dateISO < todayISO) {
        if (progress >= 80) {
          status = 'great';
          emoji = '✅';
        } else if (progress >= 50) {
          status = 'ok';
          emoji = '😐';
        } else if (total > 0) {
          status = 'low';
          emoji = '😅';
        } else {
          status = 'empty';
          emoji = '➖';
        }
      } else {
        // עתיד
        if (date.getDay() === 6) { // שבת
          emoji = '🌙';
        }
      }
      
      days.push({
        date: dateISO,
        dayName: HEBREW_DAYS[date.getDay()],
        total,
        completed,
        progress,
        status,
        emoji,
        isToday: dateISO === todayISO,
        isPast: dateISO < todayISO,
        isFuture: dateISO > todayISO
      });
    }
    
    return days;
  }, [tasks, today, todayISO]);

  // חישוב רצף ימים
  useEffect(() => {
    if (!tasks) return;
    
    let currentStreak = 0;
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() - 1); // מתחילים מאתמול
    
    while (true) {
      const dateISO = checkDate.toISOString().split('T')[0];
      const dayTasks = tasks.filter(t => t.due_date === dateISO && !t.deleted_at);
      const completed = dayTasks.filter(t => t.is_completed).length;
      const total = dayTasks.length;
      
      if (total === 0 || (completed / total) < 0.5) break;
      
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
      
      if (currentStreak > 365) break; // הגנה מפני לולאה אינסופית
    }
    
    // אם היום גם סיימנו מספיק, נוסיף את היום
    if (stats.total > 0 && stats.progress >= 50) {
      currentStreak++;
    }
    
    setStreak(currentStreak);
  }, [tasks, today, stats]);

  // ממוצע שבועי
  const weeklyAverage = useMemo(() => {
    const pastDays = weekData.filter(d => d.isPast && d.total > 0);
    if (pastDays.length === 0) return 0;
    return Math.round(pastDays.reduce((sum, d) => sum + d.progress, 0) / pastDays.length);
  }, [weekData]);

  // המשימה הבאה
  const nextTask = useMemo(() => {
    return todayTasks.remaining[0] || null;
  }, [todayTasks]);

  // מד "איך היום עובר" - מבוסס על התקדמות ושעה ביום
  const dayMood = useMemo(() => {
    const hour = new Date().getHours();
    const expectedProgress = Math.min(100, Math.max(0, ((hour - 8) / 10) * 100));
    const actualProgress = stats.progress;
    const diff = actualProgress - expectedProgress;
    
    if (diff >= 10) return { emoji: '😊', position: 25 };
    if (diff >= -10) return { emoji: '🙂', position: 45 };
    if (diff >= -30) return { emoji: '😐', position: 60 };
    return { emoji: '😅', position: 80 };
  }, [stats.progress]);

  // ========================================
  // פעולות
  // ========================================

  const handleQuickAddTask = useCallback(async () => {
    if (!newTaskTitle.trim()) return;
    
    try {
      await addTask({
        title: newTaskTitle.trim(),
        due_date: todayISO,
        estimated_duration: 30,
        priority: 'medium'
      });
      setNewTaskTitle('');
      toast.success('✅ משימה נוספה!');
    } catch (e) {
      toast.error('שגיאה בהוספת משימה');
    }
  }, [newTaskTitle, addTask, todayISO]);

  const handleSaveNotes = useCallback(() => {
    localStorage.setItem(`zmanit_notes_${todayISO}`, dailyNotes);
    toast.success('📝 הערות נשמרו');
  }, [dailyNotes, todayISO]);

  // ========================================
  // רינדור
  // ========================================

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-100 via-purple-100 to-slate-200">
        <div className="text-center">
          <div className="animate-spin text-5xl mb-4">✨</div>
          <p className="text-purple-600 font-medium">טוען...</p>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-slate-100 via-purple-100 to-slate-200">
      
      <div className="w-full px-4 pb-24">
        
        {/* ===== כותרת עם תאריך ומשפט מוטיבציה ===== */}
        <div className="text-center pt-6 pb-4">
          <h1 className="text-2xl font-bold text-gray-800">
            {HEBREW_DAY_NAMES[today.getDay()]}, {today.toLocaleDateString('he-IL', { day: 'numeric', month: 'long' })}
          </h1>
          <p className="text-purple-600 mt-1">✨ {getDailyQuote()} ✨</p>
        </div>
        
        {/* ===== כרטיס ראשי - סיכום היום ===== */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 rounded-3xl p-6 mb-5 shadow-xl"
          style={{ boxShadow: '0 10px 40px rgba(139, 92, 246, 0.3)' }}
        >
          <div className="flex items-center justify-between">
            
            {/* צד שמאל - טקסט */}
            <div className="text-white">
              <div className="text-lg opacity-90 mb-1">היום השלמת</div>
              <div className="text-5xl font-bold mb-2">
                {stats.completed} 
                <span className="text-2xl font-normal opacity-80"> מתוך {stats.total}</span>
              </div>
              <div className="text-sm opacity-80">משימות 🎯</div>
            </div>
            
            {/* צד ימין - עיגול התקדמות */}
            <div className="relative">
              <svg className="w-28 h-28" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="8"/>
                <circle 
                  cx="50" cy="50" r="40" fill="none" stroke="white" strokeWidth="8" 
                  strokeLinecap="round"
                  style={{ 
                    transform: 'rotate(-90deg)', 
                    transformOrigin: '50% 50%',
                    strokeDasharray: 251.2,
                    strokeDashoffset: 251.2 - (251.2 * stats.progress / 100)
                  }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-3xl font-bold text-white">{stats.progress}%</span>
              </div>
            </div>
          </div>
          
          {/* כפתור לתצוגה יומית */}
          <Link 
            to="/daily"
            className="mt-4 w-full py-3 bg-white/20 hover:bg-white/30 rounded-xl text-white font-medium backdrop-blur transition-all flex items-center justify-center gap-2"
          >
            📅 לתצוגה היומית
          </Link>
        </motion.div>
        
        {/* ===== הוספת משימה - בולט! ===== */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-r from-emerald-400 to-teal-500 rounded-2xl p-5 mb-5 shadow-lg"
        >
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">➕</span>
            <span className="text-white font-bold text-lg">הוספת משימה חדשה</span>
          </div>
          <div className="flex gap-2">
            <input 
              type="text" 
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleQuickAddTask()}
              placeholder="מה צריך לעשות?" 
              className="flex-1 bg-white/90 rounded-xl px-4 py-3 text-gray-700 placeholder-gray-400 outline-none focus:ring-2 focus:ring-white"
            />
            <button 
              onClick={handleQuickAddTask}
              className="px-6 py-3 bg-white text-emerald-600 rounded-xl font-bold hover:bg-emerald-50 transition-colors shadow"
            >
              הוסף
            </button>
          </div>
          <button 
            onClick={() => { setEditingTask(null); setShowTaskForm(true); }}
            className="mt-2 text-white/80 hover:text-white text-sm underline"
          >
            + הוספה מפורטת עם שעה ומשך
          </button>
        </motion.div>
        
        {/* ===== שורת סטטיסטיקות ===== */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-3 gap-3 mb-5"
        >
          
          {/* זמן עבודה */}
          <div className="bg-white/80 backdrop-blur rounded-2xl p-4 text-center shadow-md hover:shadow-lg transition-shadow">
            <div className="text-3xl mb-1">⏱️</div>
            <div className="text-2xl font-bold text-gray-800">{formatHoursMinutes(stats.timeSpent)}</div>
            <div className="text-xs text-purple-600">שעות עבודה</div>
          </div>
          
          {/* רצף ימים */}
          <div className="bg-gradient-to-br from-orange-400 to-pink-500 rounded-2xl p-4 text-center shadow-lg">
            <motion.div 
              animate={{ y: [0, -5, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-3xl mb-1"
            >
              🔥
            </motion.div>
            <div className="text-2xl font-bold text-white">{streak}</div>
            <div className="text-xs text-white/90">ימים ברצף!</div>
          </div>
          
          {/* ממוצע שבועי */}
          <div className="bg-white/80 backdrop-blur rounded-2xl p-4 text-center shadow-md hover:shadow-lg transition-shadow">
            <div className="text-3xl mb-1">⭐</div>
            <div className="text-2xl font-bold text-gray-800">{weeklyAverage}%</div>
            <div className="text-xs text-purple-600">ממוצע שבועי</div>
          </div>
          
        </motion.div>
        
        {/* ===== מד דחיינות vs התקדמות ===== */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white/80 backdrop-blur rounded-2xl p-5 mb-5 shadow-md"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-700 font-medium">איך היום עובר?</span>
            <span className="text-2xl">{dayMood.emoji}</span>
          </div>
          
          <div className="relative h-4 bg-gradient-to-r from-emerald-400 via-yellow-400 to-red-400 rounded-full overflow-hidden">
            <motion.div 
              initial={{ left: '50%' }}
              animate={{ left: `${dayMood.position}%` }}
              className="absolute top-1/2 -translate-y-1/2 w-6 h-6 bg-white rounded-full shadow-lg border-2 border-gray-200 flex items-center justify-center"
            >
              <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
            </motion.div>
          </div>
          
          <div className="flex justify-between mt-2 text-xs">
            <span className="text-emerald-600 font-medium">מצוין! 🚀</span>
            <span className="text-yellow-600">בסדר 👍</span>
            <span className="text-red-500">דחיינות 😅</span>
          </div>
        </motion.div>
        
        {/* ===== גרף שבועי ===== */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white/80 backdrop-blur rounded-2xl p-5 mb-5 shadow-md"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-gray-700 font-medium">📊 השבוע שלי</span>
            <span className="text-sm text-purple-500">ממוצע: {weeklyAverage}%</span>
          </div>
          
          {/* גרף עמודות */}
          <div className="flex items-end justify-between gap-2 mb-3" style={{ height: '120px' }}>
            {weekData.map((day, index) => {
              let bgColor = 'bg-slate-200';
              if (day.isToday) bgColor = 'bg-gradient-to-t from-purple-500 to-fuchsia-400';
              else if (day.status === 'great') bgColor = 'bg-gradient-to-t from-emerald-500 to-emerald-400';
              else if (day.status === 'ok') bgColor = 'bg-gradient-to-t from-yellow-500 to-yellow-400';
              else if (day.status === 'low') bgColor = 'bg-gradient-to-t from-red-400 to-red-300';
              
              const height = day.isFuture ? (day.total > 0 ? 25 : 10) : Math.max(10, day.progress);
              
              return (
                <div key={day.date} className="flex-1 flex flex-col items-center">
                  <motion.div 
                    initial={{ height: 0 }}
                    animate={{ height: `${height}%` }}
                    transition={{ delay: 0.5 + index * 0.05 }}
                    className={`w-full ${bgColor} rounded-t-lg ${day.isToday ? 'ring-2 ring-purple-300 ring-offset-2' : ''}`}
                  />
                </div>
              );
            })}
          </div>
          
          {/* פרטי ימים מתחת לגרף */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center border-t border-gray-200 pt-3">
            {weekData.map((day) => (
              <div key={day.date} className={`${day.isToday ? 'bg-purple-100 rounded-lg py-1' : ''}`}>
                <div className={`text-xs font-medium ${day.isToday ? 'text-purple-600' : day.isFuture ? 'text-gray-400' : 'text-gray-600'}`}>
                  {day.dayName}
                </div>
                <div className={`text-base sm:text-lg ${day.isFuture ? 'opacity-40' : ''}`}>{day.emoji}</div>
                <div className={`text-xs font-bold ${
                  day.isToday ? 'text-purple-600' : 
                  day.status === 'great' ? 'text-emerald-600' : 
                  day.status === 'ok' ? 'text-yellow-600' : 
                  day.status === 'low' ? 'text-red-500' : 
                  'text-gray-400'
                }`}>
                  {day.isFuture ? '-' : `${day.progress}%`}
                </div>
                <div className={`text-xs ${day.isToday ? 'text-purple-500' : 'text-gray-400'}`}>
                  {day.isFuture ? (day.total > 0 ? day.total : '-') : `${day.completed}/${day.total}`}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
        
        {/* ===== הערות ===== */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white/80 backdrop-blur rounded-2xl p-5 mb-5 shadow-md"
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">📝</span>
            <span className="text-gray-700 font-medium">הערות להיום</span>
          </div>
          <textarea 
            value={dailyNotes}
            onChange={(e) => setDailyNotes(e.target.value)}
            placeholder="כתבי כאן הערות, תזכורות, או מחשבות..." 
            className="w-full bg-purple-50 rounded-xl p-4 text-gray-700 placeholder-gray-400 outline-none focus:ring-2 focus:ring-purple-300 resize-none"
            rows="3"
          />
          <div className="flex justify-end mt-2">
            <button 
              onClick={handleSaveNotes}
              className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              שמור
            </button>
          </div>
        </motion.div>
        
        {/* ===== המשימה הבאה ===== */}
        {nextTask && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-white/80 backdrop-blur rounded-2xl p-5 shadow-md"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center text-2xl shadow-md flex-shrink-0">
                ▶️
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-purple-500 mb-1">הבאה בתור</div>
                <div className="text-gray-800 font-medium truncate">{nextTask.title}</div>
                <div className="text-sm text-gray-500">
                  {nextTask.due_time ? nextTask.due_time.slice(0, 5) : 'גמיש'} • {nextTask.estimated_duration || 30} דק׳
                </div>
              </div>
              <Link 
                to="/daily"
                className="px-4 sm:px-5 py-2.5 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white rounded-xl font-medium transition-all shadow-md flex-shrink-0"
              >
                התחל
              </Link>
            </div>
          </motion.div>
        )}
        
      </div>
      
      {/* ===== ניווט תחתון ===== */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur border-t border-purple-200 shadow-lg z-50">
        <div className="flex justify-around py-3">
          <Link to="/" className="flex flex-col items-center text-purple-600">
            <span className="text-xl">🏠</span>
            <span className="text-xs mt-1 font-medium">ראשי</span>
          </Link>
          <Link to="/daily" className="flex flex-col items-center text-gray-400 hover:text-purple-500 transition-colors">
            <span className="text-xl">📅</span>
            <span className="text-xs mt-1">יומי</span>
          </Link>
          <Link to="/tasks" className="flex flex-col items-center text-gray-400 hover:text-purple-500 transition-colors">
            <span className="text-xl">📋</span>
            <span className="text-xs mt-1">משימות</span>
          </Link>
          <Link to="/settings" className="flex flex-col items-center text-gray-400 hover:text-purple-500 transition-colors">
            <span className="text-xl">⚙️</span>
            <span className="text-xs mt-1">הגדרות</span>
          </Link>
        </div>
      </div>
      
      {/* ===== מודל הוספת משימה מפורטת ===== */}
      <Modal isOpen={showTaskForm} onClose={() => setShowTaskForm(false)}>
        <SimpleTaskForm
          task={editingTask}
          onSave={async (taskData) => {
            try {
              if (editingTask) {
                await editTask(editingTask.id, taskData);
                toast.success('✅ משימה עודכנה');
              } else {
                await addTask({ ...taskData, due_date: taskData.due_date || todayISO });
                toast.success('✅ משימה נוספה');
              }
              setShowTaskForm(false);
              setEditingTask(null);
            } catch (e) {
              toast.error('שגיאה');
            }
          }}
          onCancel={() => { setShowTaskForm(false); setEditingTask(null); }}
        />
      </Modal>
      
    </div>
  );
}

export default SmartDashboard;
