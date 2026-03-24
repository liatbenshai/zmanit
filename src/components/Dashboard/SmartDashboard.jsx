/**
 * SmartDashboard - דשבורד חדש מעוצב
 * =================================
 * עיצוב צבעוני וכיפי עם:
 * - סיכום יומי עם אחוז התקדמות
 * - הוספת משימה + הערות זה ליד זה
 * - שתי משימות הבאות זה ליד זה
 * - גרף שבועי צבעוני עם תאריכים
 * - ניווט תחתון עם 5 אייקונים
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useTasks } from '../../hooks/useTasks';
import { useAuth } from '../../hooks/useAuth';
import SimpleTaskForm from '../DailyView/SimpleTaskForm';
import Modal from '../UI/Modal';
import AutoScheduler from '../SmartScheduler/AutoScheduler';
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
  const { tasks, loading, editTask, addTask, dataVersion } = useTasks();
  const { user } = useAuth();
  
  // State
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [showAutoScheduler, setShowAutoScheduler] = useState(false);
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
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
    const timeSpent = todayTasks.all.reduce((sum, t) => sum + (t.time_spent || 0), 0);
    
    return { total, completed, progress, timeSpent };
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
      let barColor = 'bg-white/30';
      
      if (dateISO === todayISO) {
        status = 'today';
        emoji = '🔄';
        barColor = 'bg-purple-500';
      } else if (dateISO < todayISO) {
        if (progress >= 80) {
          status = 'great';
          emoji = '✅';
          barColor = 'bg-emerald-400';
        } else if (progress >= 50) {
          status = 'ok';
          emoji = '😐';
          barColor = 'bg-yellow-400';
        } else if (total > 0) {
          status = 'low';
          emoji = '😅';
          barColor = 'bg-red-400';
        } else {
          status = 'empty';
          emoji = '➖';
          barColor = 'bg-white/30';
        }
      } else {
        if (date.getDay() === 6) emoji = '🌙';
      }
      
      // תאריך בפורמט יום/חודש
      const dateStr = `${date.getDate()}/${date.getMonth() + 1}`;
      
      days.push({
        date: dateISO,
        dateStr,
        dayName: HEBREW_DAYS[date.getDay()],
        total,
        completed,
        progress,
        status,
        emoji,
        barColor,
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
    checkDate.setDate(checkDate.getDate() - 1);
    
    while (true) {
      const dateISO = checkDate.toISOString().split('T')[0];
      const dayTasks = tasks.filter(t => t.due_date === dateISO && !t.deleted_at);
      const completed = dayTasks.filter(t => t.is_completed).length;
      const total = dayTasks.length;
      
      if (total === 0 || (completed / total) < 0.5) break;
      
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
      
      if (currentStreak > 365) break;
    }
    
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

  // שתי המשימות הבאות
  const nextTasks = useMemo(() => {
    const first = todayTasks.remaining[0] || null;
    const second = todayTasks.remaining[1] || null;
    return { first, second };
  }, [todayTasks]);

  // "מה עכשיו" - בחירה חכמה של המשימה הבאה לביצוע
  const nowTask = useMemo(() => {
    if (!todayTasks.remaining.length) return null;
    const urgent = todayTasks.remaining.find(t => t.priority === 'urgent' || t.quadrant === 1);
    if (urgent) return urgent;
    return todayTasks.remaining[0];
  }, [todayTasks]);

  // מד "איך היום עובר"
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

  // אמינות תכנון: כמה עמדנו בהתחייבות הזמן/דדליין
  const reliability = useMemo(() => {
    if (!tasks) return { score: 0, onTime: 0, delayed: 0, label: 'אין נתונים' };

    const completedToday = tasks.filter(t => t.is_completed && t.due_date === todayISO);
    if (completedToday.length === 0) {
      return { score: 0, onTime: 0, delayed: 0, label: 'אין נתונים להיום' };
    }

    let onTime = 0;
    let delayed = 0;

    completedToday.forEach(t => {
      if (!t.due_time || !t.completed_at) {
        onTime += 1;
        return;
      }

      const dueAt = new Date(`${t.due_date}T${t.due_time}:00`);
      const completedAt = new Date(t.completed_at);
      if (!Number.isNaN(dueAt.getTime()) && completedAt <= dueAt) {
        onTime += 1;
      } else {
        delayed += 1;
      }
    });

    const score = Math.round((onTime / completedToday.length) * 100);
    const label = score >= 85 ? 'מצוין' : score >= 60 ? 'טוב' : 'דורש שיפור';

    return { score, onTime, delayed, label };
  }, [tasks, todayISO]);

  // ========================================
  // פעולות
  // ========================================

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
            <div className="text-white">
              <div className="text-lg opacity-90 mb-1">היום השלמת</div>
              <div className="text-5xl font-bold mb-2">
                {stats.completed} 
                <span className="text-2xl font-normal opacity-80"> מתוך {stats.total}</span>
              </div>
              <div className="text-sm opacity-80">משימות 🎯</div>
            </div>
            
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
          
          <Link 
            to="/daily"
            className="mt-4 w-full py-3 bg-white/20 hover:bg-white/30 rounded-xl text-white font-medium backdrop-blur transition-all flex items-center justify-center gap-2"
          >
            📅 לתצוגה היומית
          </Link>
        </motion.div>
        
        {/* ===== הוספת משימה והערות - זה ליד זה ===== */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5"
        >
          <button 
            onClick={() => { setEditingTask(null); setShowTaskForm(true); }}
            className="bg-gradient-to-r from-emerald-400 to-teal-500 rounded-2xl p-5 shadow-lg text-right hover:shadow-xl transition-shadow"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">➕</span>
              <span className="text-white font-bold text-lg">הוספת משימה</span>
            </div>
            <p className="text-white/80 text-sm">לחצי להוספת משימה חדשה עם פרטים מלאים</p>
          </button>
          
          <div className="bg-white/80 backdrop-blur rounded-2xl p-5 shadow-md">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">📝</span>
              <span className="text-gray-700 font-medium">הערות להיום</span>
            </div>
            <textarea 
              value={dailyNotes}
              onChange={(e) => setDailyNotes(e.target.value)}
              onBlur={handleSaveNotes}
              placeholder="כתבי כאן הערות..." 
              className="w-full bg-purple-50 rounded-xl p-3 text-gray-700 placeholder-gray-400 outline-none focus:ring-2 focus:ring-purple-300 resize-none text-sm"
              rows="2"
            />
          </div>
        </motion.div>
        
        {/* ===== שתי משימות הבאות ===== */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5"
        >
          {/* משימה ראשונה - הבאה בתור */}
          {nextTasks.first ? (
            <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl p-5 shadow-lg text-white">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs bg-white/20 px-2 py-1 rounded-full">▶️ הבאה בתור</span>
                <span className="text-sm opacity-80">{nextTasks.first.due_time?.slice(0,5) || 'גמיש'}</span>
              </div>
              <div className="text-xl font-bold mb-1 truncate">{nextTasks.first.title}</div>
              <div className="text-sm opacity-80 mb-4">⏱️ {nextTasks.first.estimated_duration || 30} דק׳</div>
              <Link 
                to="/daily"
                className="block w-full py-2.5 bg-white text-purple-600 rounded-xl font-bold hover:bg-purple-50 transition-colors text-center"
              >
                התחל עכשיו
              </Link>
            </div>
          ) : (
            <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl p-5 shadow-lg text-white flex flex-col items-center justify-center">
              <div className="text-4xl mb-2">🎉</div>
              <div className="font-bold">סיימת הכל!</div>
              <div className="text-sm opacity-80">כל הכבוד</div>
            </div>
          )}
          
          {/* משימה שנייה - אחר כך */}
          {nextTasks.second ? (
            <div className="bg-white/80 backdrop-blur rounded-2xl p-5 shadow-md border-2 border-purple-200">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs bg-purple-100 text-purple-600 px-2 py-1 rounded-full">⏭️ אחר כך</span>
                <span className="text-sm text-gray-500">{nextTasks.second.due_time?.slice(0,5) || 'גמיש'}</span>
              </div>
              <div className="text-xl font-bold text-gray-800 mb-1 truncate">{nextTasks.second.title}</div>
              <div className="text-sm text-gray-500 mb-4">⏱️ {nextTasks.second.estimated_duration || 30} דק׳</div>
              <Link 
                to="/daily"
                className="block w-full py-2.5 bg-purple-100 text-purple-600 rounded-xl font-medium hover:bg-purple-200 transition-colors text-center"
              >
                פרטים
              </Link>
            </div>
          ) : nextTasks.first ? (
            <div className="bg-white/80 backdrop-blur rounded-2xl p-5 shadow-md border-2 border-purple-200 flex flex-col items-center justify-center text-gray-400">
              <div className="text-3xl mb-2">📭</div>
              <div className="text-sm">אין משימות נוספות</div>
            </div>
          ) : (
            <button 
              onClick={() => { setEditingTask(null); setShowTaskForm(true); }}
              className="bg-white/80 backdrop-blur rounded-2xl p-5 shadow-md border-2 border-dashed border-purple-300 flex flex-col items-center justify-center text-purple-500 hover:bg-purple-50 transition-colors"
            >
              <div className="text-3xl mb-2">➕</div>
              <div className="font-medium">הוסיפי משימה</div>
            </button>
          )}
        </motion.div>

        {/* ===== מה עכשיו - CTA אחד ברור ===== */}
        {nowTask && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            className="bg-gradient-to-l from-blue-600 to-indigo-700 rounded-2xl p-5 mb-5 text-white shadow-lg"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm opacity-85">מה עכשיו?</div>
                <div className="text-xl font-bold mt-1">{nowTask.title}</div>
                <div className="text-sm opacity-85 mt-1">
                  {nowTask.due_time ? `🕐 ${nowTask.due_time}` : '🕐 להתחיל עכשיו'} | ⏱️ {nowTask.estimated_duration || 30} דק׳
                </div>
              </div>
              {(nowTask.priority === 'urgent' || nowTask.quadrant === 1) && (
                <span className="text-xs bg-red-500/90 px-2 py-1 rounded-full">דחוף</span>
              )}
            </div>
            <button
              onClick={() => {
                localStorage.setItem('start_task_id', nowTask.id);
                window.location.href = '/daily';
              }}
              className="w-full mt-4 py-3 bg-white text-indigo-700 rounded-xl font-bold hover:bg-indigo-50 transition-colors"
            >
              ▶️ התחילי עכשיו
            </button>
          </motion.div>
        )}
        
        {/* ===== שורת סטטיסטיקות ===== */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-3 gap-3 mb-5"
        >
          <div className="bg-white/80 backdrop-blur rounded-2xl p-4 text-center shadow-md hover:shadow-lg transition-shadow">
            <div className="text-3xl mb-1">⏱️</div>
            <div className="text-2xl font-bold text-gray-800">{formatHoursMinutes(stats.timeSpent)}</div>
            <div className="text-xs text-purple-600">שעות עבודה</div>
          </div>
          
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
          
          <div className="bg-white/80 backdrop-blur rounded-2xl p-4 text-center shadow-md hover:shadow-lg transition-shadow">
            <div className="text-3xl mb-1">⭐</div>
            <div className="text-2xl font-bold text-gray-800">{weeklyAverage}%</div>
            <div className="text-xs text-purple-600">ממוצע שבועי</div>
          </div>
        </motion.div>

        {/* ===== אמינות תכנון + שיבוץ אוטומטי ===== */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-white/85 backdrop-blur rounded-2xl p-5 mb-5 shadow-md border border-purple-100"
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm text-gray-500">אמינות תכנון היום</div>
              <div className="text-2xl font-bold text-gray-800">{reliability.score}%</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium text-purple-600">{reliability.label}</div>
              <div className="text-xs text-gray-500">
                בזמן: {reliability.onTime} | איחור: {reliability.delayed}
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowAutoScheduler(true)}
            className="w-full py-3 bg-gradient-to-l from-indigo-500 to-purple-600 text-white rounded-xl font-medium hover:from-indigo-600 hover:to-purple-700 transition-colors"
          >
            🤖 סדר לי את היום בלחיצה
          </button>
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
              className="absolute top-1/2 -translate-y-1/2 w-6 h-6 bg-white rounded-full shadow-lg border-2 border-gray-200"
            />
          </div>
          
          <div className="flex justify-between mt-2 text-xs">
            <span className="text-emerald-600 font-medium">מצוין! 🚀</span>
            <span className="text-yellow-600">בסדר 👍</span>
            <span className="text-red-500">דחיינות 😅</span>
          </div>
        </motion.div>
        
        {/* ===== גרף שבועי משופר ===== */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-2xl p-5 mb-5 shadow-lg text-white"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="font-bold text-lg">📊 השבוע שלי</span>
            <span className="text-sm bg-white/20 px-3 py-1 rounded-full">ממוצע: {weeklyAverage}%</span>
          </div>
          
          {/* 7 כרטיסי ימים */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {weekData.map((day, index) => (
              <motion.div 
                key={day.date}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + index * 0.05 }}
                className={`rounded-xl p-1.5 sm:p-2 text-center ${
                  day.isToday 
                    ? 'bg-white text-purple-600 shadow-lg ring-2 ring-white' 
                    : day.isFuture 
                      ? 'bg-white/10 opacity-60' 
                      : 'bg-white/10'
                }`}
              >
                <div className={`text-xs ${day.isToday ? 'font-bold' : 'opacity-70'} mb-0.5`}>{day.dayName}</div>
                <div className={`text-xs ${day.isToday ? 'font-medium' : 'opacity-50'} mb-1 sm:mb-2`}>{day.dateStr}</div>
                
                {/* עמודה */}
                <div className="h-12 sm:h-16 flex items-end justify-center mb-1 sm:mb-2">
                  <div 
                    className={`w-3 sm:w-4 ${day.isToday ? 'bg-purple-500' : day.barColor} rounded-t-md`}
                    style={{ height: `${day.isFuture ? 20 : Math.max(10, day.progress)}%` }}
                  />
                </div>
                
                <div className={`text-base sm:text-xl font-bold ${day.isToday ? '' : ''}`}>
                  {day.isFuture ? '-' : `${day.progress}%`}
                </div>
                <div className="text-sm sm:text-lg my-0.5">{day.emoji}</div>
                <div className={`text-xs ${day.isToday ? 'font-medium' : 'opacity-70'}`}>
                  {day.isFuture ? (day.total > 0 ? day.total : '-') : `${day.completed}/${day.total}`}
                </div>
              </motion.div>
            ))}
          </div>
          
          {/* כפתור לתצוגה שבועית */}
          <Link 
            to="/weekly"
            className="mt-4 w-full py-3 bg-white/20 hover:bg-white/30 rounded-xl font-medium backdrop-blur transition-all flex items-center justify-center gap-2"
          >
            📆 לתצוגה השבועית המלאה
          </Link>
        </motion.div>
        
      </div>
      
      {/* ===== ניווט תחתון - 5 אייקונים ===== */}
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
          <Link to="/weekly" className="flex flex-col items-center text-gray-400 hover:text-purple-500 transition-colors">
            <span className="text-xl">📆</span>
            <span className="text-xs mt-1">שבועי</span>
          </Link>
          <Link to="/daily" className="flex flex-col items-center text-gray-400 hover:text-purple-500 transition-colors">
            <span className="text-xl">📋</span>
            <span className="text-xs mt-1">משימות</span>
          </Link>
          <Link to="/settings" className="flex flex-col items-center text-gray-400 hover:text-purple-500 transition-colors">
            <span className="text-xl">⚙️</span>
            <span className="text-xs mt-1">הגדרות</span>
          </Link>
        </div>
      </div>
      
      {/* ===== מודל הוספת משימה ===== */}
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

      {/* ===== מודל שיבוץ אוטומטי ===== */}
      <Modal
        isOpen={showAutoScheduler}
        onClose={() => setShowAutoScheduler(false)}
        title="🤖 שיבוץ אוטומטי חכם"
      >
        <AutoScheduler />
      </Modal>
      
    </div>
  );
}

export default SmartDashboard;
