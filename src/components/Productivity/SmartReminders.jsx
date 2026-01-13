/**
 * SmartReminders - תזכורות חכמות
 * ================================
 * 1. תזכורת סוף יום (15:30)
 * 2. סקירת בוקר
 * 3. תובנות ולמידה
 * 4. גיימיפיקציה - רצפים והישגים
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTasks } from '../../hooks/useTasks';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';

// ========================================
// קונפיגורציה
// ========================================

const CONFIG = {
  END_OF_DAY_HOUR: 15,
  END_OF_DAY_MINUTE: 30,
  MORNING_START_HOUR: 7,
  MORNING_END_HOUR: 10,
};

// הישגים אפשריים
const ACHIEVEMENTS = {
  first_task: { icon: '🎯', title: 'צעד ראשון', description: 'השלמת את המשימה הראשונה!' },
  five_tasks: { icon: '✋', title: 'חמישייה', description: 'השלמת 5 משימות ביום אחד' },
  ten_tasks: { icon: '🔟', title: 'עשירייה', description: 'השלמת 10 משימות ביום אחד' },
  streak_3: { icon: '🔥', title: 'רצף 3', description: '3 ימים רצופים של עמידה ביעדים' },
  streak_7: { icon: '🔥🔥', title: 'שבוע מושלם', description: 'שבוע שלם של עמידה ביעדים!' },
  streak_30: { icon: '👑', title: 'מלכת החודש', description: 'חודש שלם של רצף!' },
  early_bird: { icon: '🐦', title: 'ציפור מקדימה', description: 'התחלת לעבוד לפני 8:00' },
  on_time: { icon: '⏰', title: 'דייקנית', description: 'סיימת את כל המשימות בזמן' },
  focused: { icon: '🧘', title: 'ממוקדת', description: 'יום שלם בלי הפרעות' },
  productive_hour: { icon: '⚡', title: 'שעת שיא', description: 'שעה עם 100% פרודוקטיביות' },
};

// ========================================
// הוקים
// ========================================

/**
 * הוק לניהול רצפים
 */
function useStreaks(userId) {
  const [streakData, setStreakData] = useState({
    currentStreak: 0,
    longestStreak: 0,
    lastActiveDate: null,
    achievements: []
  });

  useEffect(() => {
    if (!userId) return;
    
    const loadStreaks = () => {
      try {
        const saved = localStorage.getItem(`zmanit_streaks_${userId}`);
        if (saved) {
          setStreakData(JSON.parse(saved));
        }
      } catch (e) {}
    };
    
    loadStreaks();
  }, [userId]);

  const updateStreak = useCallback((completedToday, totalToday) => {
    if (!userId) return;
    
    const today = new Date().toISOString().split('T')[0];
    const goalMet = completedToday >= Math.min(totalToday, 3); // לפחות 3 משימות או כל מה שהיה
    
    setStreakData(prev => {
      let newStreak = prev.currentStreak;
      let newLongest = prev.longestStreak;
      const newAchievements = [...prev.achievements];
      
      if (prev.lastActiveDate === today) {
        // כבר עודכן היום
        return prev;
      }
      
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayISO = yesterday.toISOString().split('T')[0];
      
      if (goalMet) {
        if (prev.lastActiveDate === yesterdayISO) {
          // המשך רצף
          newStreak = prev.currentStreak + 1;
        } else if (!prev.lastActiveDate || prev.lastActiveDate < yesterdayISO) {
          // התחלת רצף חדש
          newStreak = 1;
        }
        
        newLongest = Math.max(newLongest, newStreak);
        
        // בדיקת הישגים
        if (newStreak === 3 && !newAchievements.includes('streak_3')) {
          newAchievements.push('streak_3');
          toast.success('🔥 הישג חדש: רצף 3 ימים!');
        }
        if (newStreak === 7 && !newAchievements.includes('streak_7')) {
          newAchievements.push('streak_7');
          toast.success('🔥🔥 הישג חדש: שבוע מושלם!');
        }
        if (newStreak === 30 && !newAchievements.includes('streak_30')) {
          newAchievements.push('streak_30');
          toast.success('👑 הישג חדש: מלכת החודש!');
        }
      } else {
        // איפוס רצף
        newStreak = 0;
      }
      
      const newData = {
        currentStreak: newStreak,
        longestStreak: newLongest,
        lastActiveDate: today,
        achievements: newAchievements
      };
      
      localStorage.setItem(`zmanit_streaks_${userId}`, JSON.stringify(newData));
      return newData;
    });
  }, [userId]);

  return { streakData, updateStreak };
}

/**
 * הוק לתובנות ולמידה
 */
function useInsights(tasks, userId) {
  const insights = useMemo(() => {
    if (!tasks || tasks.length === 0) return [];
    
    const result = [];
    const now = new Date();
    const thisWeek = new Date(now);
    thisWeek.setDate(thisWeek.getDate() - 7);
    const thisWeekISO = thisWeek.toISOString().split('T')[0];
    
    // משימות שהושלמו השבוע
    const completedThisWeek = tasks.filter(t => 
      t.is_completed && 
      t.completed_at && 
      t.completed_at >= thisWeekISO
    );
    
    if (completedThisWeek.length === 0) return result;
    
    // ניתוח שעות פרודוקטיביות
    const hourStats = {};
    completedThisWeek.forEach(t => {
      if (t.completed_at) {
        const hour = new Date(t.completed_at).getHours();
        hourStats[hour] = (hourStats[hour] || 0) + 1;
      }
    });
    
    const bestHour = Object.entries(hourStats)
      .sort((a, b) => b[1] - a[1])[0];
    
    if (bestHour && bestHour[1] >= 3) {
      result.push({
        type: 'productive_hour',
        icon: '⏰',
        text: `השעה הכי פרודוקטיבית שלך היא ${bestHour[0]}:00`,
        tip: `נסי לתזמן משימות חשובות לשעה הזו`
      });
    }
    
    // ניתוח דיוק הערכות
    const withEstimates = completedThisWeek.filter(t => 
      t.estimated_duration && t.time_spent
    );
    
    if (withEstimates.length >= 5) {
      const totalEstimated = withEstimates.reduce((sum, t) => sum + t.estimated_duration, 0);
      const totalActual = withEstimates.reduce((sum, t) => sum + t.time_spent, 0);
      const ratio = totalActual / totalEstimated;
      
      if (ratio > 1.2) {
        result.push({
          type: 'underestimate',
          icon: '📊',
          text: `משימות לוקחות לך ${Math.round((ratio - 1) * 100)}% יותר מההערכה`,
          tip: 'נסי להוסיף 20% לזמן המוערך'
        });
      } else if (ratio < 0.8) {
        result.push({
          type: 'overestimate',
          icon: '🚀',
          text: 'את מסיימת מהר יותר מהצפוי!',
          tip: 'אולי אפשר לקחת עוד משימות'
        });
      }
    }
    
    // ניתוח סוגי משימות
    const byType = {};
    completedThisWeek.forEach(t => {
      const type = t.task_type || 'other';
      if (!byType[type]) byType[type] = { count: 0, time: 0 };
      byType[type].count++;
      byType[type].time += t.time_spent || t.estimated_duration || 30;
    });
    
    const topType = Object.entries(byType)
      .sort((a, b) => b[1].time - a[1].time)[0];
    
    if (topType && topType[1].time > 120) {
      const typeNames = {
        transcription: 'תמלול',
        translation: 'תרגום',
        admin: 'אדמיניסטרציה',
        meeting: 'פגישות',
        email: 'מיילים',
        other: 'כללי'
      };
      result.push({
        type: 'top_activity',
        icon: '📈',
        text: `רוב הזמן שלך השבוע הלך על ${typeNames[topType[0]] || topType[0]}`,
        tip: `${Math.round(topType[1].time / 60)} שעות`
      });
    }
    
    // בדיקת הפרעות
    const interruptionsKey = `idle_log_${userId}_${now.toISOString().split('T')[0]}`;
    try {
      const todayInterruptions = JSON.parse(localStorage.getItem(interruptionsKey) || '[]');
      if (todayInterruptions.length === 0) {
        result.push({
          type: 'no_interruptions',
          icon: '🧘',
          text: 'יום מצוין! אפס הפרעות עד עכשיו',
          tip: 'המשיכי ככה!'
        });
      } else if (todayInterruptions.length > 5) {
        const mainReason = todayInterruptions
          .reduce((acc, i) => {
            acc[i.reason] = (acc[i.reason] || 0) + 1;
            return acc;
          }, {});
        const topReason = Object.entries(mainReason).sort((a, b) => b[1] - a[1])[0];
        result.push({
          type: 'many_interruptions',
          icon: '⚠️',
          text: `היו ${todayInterruptions.length} הפרעות היום`,
          tip: topReason ? `רוב ההפרעות: ${topReason[0]}` : ''
        });
      }
    } catch (e) {}
    
    return result;
  }, [tasks, userId]);
  
  return insights;
}

// ========================================
// קומפוננטות
// ========================================

/**
 * תזכורת סוף יום
 */
export function EndOfDayReminder({ tasks, onDeferTask }) {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  
  const today = new Date().toISOString().split('T')[0];
  
  const remainingTasks = useMemo(() => {
    if (!tasks) return [];
    return tasks.filter(t => 
      !t.is_completed && 
      !t.deleted_at &&
      t.due_date === today
    );
  }, [tasks, today]);
  
  // בדיקת שעה
  useEffect(() => {
    const checkTime = () => {
      const now = new Date();
      const hour = now.getHours();
      const minute = now.getMinutes();
      
      if (hour === CONFIG.END_OF_DAY_HOUR && 
          minute >= CONFIG.END_OF_DAY_MINUTE && 
          minute < CONFIG.END_OF_DAY_MINUTE + 5 &&
          !dismissed &&
          remainingTasks.length > 0) {
        setShow(true);
      }
    };
    
    checkTime();
    const interval = setInterval(checkTime, 60000);
    return () => clearInterval(interval);
  }, [dismissed, remainingTasks.length]);
  
  const handleDeferAll = async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowISO = tomorrow.toISOString().split('T')[0];
    
    for (const task of remainingTasks) {
      if (onDeferTask) {
        await onDeferTask(task.id, { due_date: tomorrowISO });
      }
    }
    
    toast.success(`${remainingTasks.length} משימות הועברו למחר`);
    setShow(false);
    setDismissed(true);
  };
  
  if (!show) return null;
  
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={() => setShow(false)}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          onClick={e => e.stopPropagation()}
          className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full shadow-xl"
          dir="rtl"
        >
          <div className="text-center mb-4">
            <span className="text-4xl">🌅</span>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mt-2">
              היום מסתיים...
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              נשארו {remainingTasks.length} משימות לא גמורות
            </p>
          </div>
          
          <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
            {remainingTasks.slice(0, 5).map(task => (
              <div 
                key={task.id}
                className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <span className={task.priority === 'urgent' ? 'text-red-500' : ''}>
                  {task.priority === 'urgent' ? '🔥' : '📋'}
                </span>
                <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1">
                  {task.title}
                </span>
              </div>
            ))}
            {remainingTasks.length > 5 && (
              <p className="text-xs text-gray-400 text-center">
                + עוד {remainingTasks.length - 5} משימות
              </p>
            )}
          </div>
          
          <div className="space-y-2">
            <button
              onClick={handleDeferAll}
              className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl transition-colors"
            >
              📅 העבר הכל למחר
            </button>
            <button
              onClick={() => { setShow(false); setDismissed(true); }}
              className="w-full py-2 text-gray-500 hover:text-gray-700 text-sm"
            >
              אני אסיים עוד קצת
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * סקירת בוקר
 */
export function MorningBriefing({ tasks, onStartTask }) {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const { user } = useAuth();
  
  const today = new Date().toISOString().split('T')[0];
  
  const todayStats = useMemo(() => {
    if (!tasks) return null;
    
    const todayTasks = tasks.filter(t => 
      !t.is_completed && 
      !t.deleted_at &&
      t.due_date === today
    );
    
    const urgent = todayTasks.filter(t => t.priority === 'urgent');
    const withTime = todayTasks.filter(t => t.due_time).sort((a, b) => 
      a.due_time.localeCompare(b.due_time)
    );
    const firstTask = withTime[0] || todayTasks[0];
    const totalMinutes = todayTasks.reduce((sum, t) => sum + (t.estimated_duration || 30), 0);
    
    return {
      total: todayTasks.length,
      urgent: urgent.length,
      firstTask,
      totalMinutes,
      totalHours: Math.round(totalMinutes / 60 * 10) / 10
    };
  }, [tasks, today]);
  
  // בדיקת שעה
  useEffect(() => {
    const checkMorning = () => {
      const now = new Date();
      const hour = now.getHours();
      const todayKey = `zmanit_morning_${user?.id}_${today}`;
      const alreadyShown = sessionStorage.getItem(todayKey);
      
      if (hour >= CONFIG.MORNING_START_HOUR && 
          hour < CONFIG.MORNING_END_HOUR && 
          !alreadyShown &&
          !dismissed &&
          todayStats?.total > 0) {
        setShow(true);
        sessionStorage.setItem(todayKey, 'true');
      }
    };
    
    // בדיקה אחרי 2 שניות (לתת לדף להיטען)
    const timeout = setTimeout(checkMorning, 2000);
    return () => clearTimeout(timeout);
  }, [user?.id, today, dismissed, todayStats?.total]);
  
  if (!show || !todayStats) return null;
  
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  let timeUntilFirst = null;
  
  if (todayStats.firstTask?.due_time) {
    const [h, m] = todayStats.firstTask.due_time.split(':').map(Number);
    timeUntilFirst = (h * 60 + (m || 0)) - currentMinutes;
  }
  
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={() => setShow(false)}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          onClick={e => e.stopPropagation()}
          className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl p-6 max-w-md w-full shadow-xl"
          dir="rtl"
        >
          <div className="text-center mb-4">
            <span className="text-4xl">☀️</span>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mt-2">
              בוקר טוב!
            </h2>
          </div>
          
          <div className="space-y-3 mb-4">
            <div className="flex justify-between items-center p-3 bg-white/50 dark:bg-gray-700/50 rounded-xl">
              <span className="text-gray-600 dark:text-gray-300">משימות להיום</span>
              <span className="font-bold text-lg">{todayStats.total}</span>
            </div>
            
            {todayStats.urgent > 0 && (
              <div className="flex justify-between items-center p-3 bg-red-100/50 dark:bg-red-900/30 rounded-xl">
                <span className="text-red-600 dark:text-red-400">🔥 דחופות</span>
                <span className="font-bold text-lg text-red-600">{todayStats.urgent}</span>
              </div>
            )}
            
            <div className="flex justify-between items-center p-3 bg-white/50 dark:bg-gray-700/50 rounded-xl">
              <span className="text-gray-600 dark:text-gray-300">זמן מוערך</span>
              <span className="font-bold">{todayStats.totalHours} שעות</span>
            </div>
            
            {todayStats.firstTask && (
              <div className="p-3 bg-blue-100/50 dark:bg-blue-900/30 rounded-xl">
                <div className="text-sm text-blue-600 dark:text-blue-400 mb-1">
                  המשימה הראשונה:
                </div>
                <div className="font-medium text-gray-900 dark:text-white">
                  {todayStats.firstTask.title}
                </div>
                {timeUntilFirst !== null && timeUntilFirst > 0 && (
                  <div className="text-xs text-blue-500 mt-1">
                    בעוד {timeUntilFirst} דקות
                  </div>
                )}
              </div>
            )}
          </div>
          
          <div className="space-y-2">
            {todayStats.firstTask && (
              <button
                onClick={() => {
                  setShow(false);
                  if (onStartTask) onStartTask(todayStats.firstTask);
                }}
                className="w-full py-3 bg-gradient-to-l from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold rounded-xl transition-colors"
              >
                🚀 להתחיל!
              </button>
            )}
            <button
              onClick={() => setShow(false)}
              className="w-full py-2 text-gray-500 hover:text-gray-700 text-sm"
            >
              אני צריכה קפה קודם ☕
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * פאנל תובנות
 */
export function InsightsPanel({ tasks }) {
  const { user } = useAuth();
  const insights = useInsights(tasks, user?.id);
  
  if (insights.length === 0) return null;
  
  return (
    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-xl p-4">
      <h3 className="font-bold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
        <span>💡</span> למדתי עלייך
      </h3>
      <div className="space-y-2">
        {insights.map((insight, i) => (
          <div 
            key={i}
            className="flex items-start gap-3 p-2 bg-white/50 dark:bg-gray-800/50 rounded-lg"
          >
            <span className="text-xl">{insight.icon}</span>
            <div className="flex-1">
              <p className="text-sm text-gray-700 dark:text-gray-300">{insight.text}</p>
              {insight.tip && (
                <p className="text-xs text-gray-500 mt-1">💡 {insight.tip}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * פאנל גיימיפיקציה - רצפים והישגים
 */
export function GamificationPanel({ tasks }) {
  const { user } = useAuth();
  const { streakData, updateStreak } = useStreaks(user?.id);
  
  const today = new Date().toISOString().split('T')[0];
  
  const todayStats = useMemo(() => {
    if (!tasks) return { completed: 0, total: 0 };
    
    const todayTasks = tasks.filter(t => t.due_date === today && !t.deleted_at);
    const completed = todayTasks.filter(t => t.is_completed).length;
    
    return { completed, total: todayTasks.length };
  }, [tasks, today]);
  
  // עדכון רצף
  useEffect(() => {
    if (todayStats.total > 0) {
      updateStreak(todayStats.completed, todayStats.total);
    }
  }, [todayStats.completed, todayStats.total, updateStreak]);
  
  const progressPercent = todayStats.total > 0 
    ? Math.round((todayStats.completed / todayStats.total) * 100)
    : 0;
  
  return (
    <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
          <span>🏆</span> ההתקדמות שלך
        </h3>
        {streakData.currentStreak > 0 && (
          <div className="flex items-center gap-1 bg-orange-500 text-white px-2 py-1 rounded-full text-sm">
            <span>🔥</span>
            <span>{streakData.currentStreak}</span>
          </div>
        )}
      </div>
      
      {/* התקדמות היום */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-600 dark:text-gray-400">היום</span>
          <span className="font-medium">{todayStats.completed}/{todayStats.total}</span>
        </div>
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            className="h-full bg-gradient-to-l from-green-500 to-emerald-500 rounded-full"
          />
        </div>
        <div className="text-left text-xs text-gray-500 mt-1">{progressPercent}%</div>
      </div>
      
      {/* סטטיסטיקות */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="text-center p-2 bg-white/50 dark:bg-gray-800/50 rounded-lg">
          <div className="text-2xl font-bold text-orange-500">{streakData.currentStreak}</div>
          <div className="text-xs text-gray-500">רצף נוכחי</div>
        </div>
        <div className="text-center p-2 bg-white/50 dark:bg-gray-800/50 rounded-lg">
          <div className="text-2xl font-bold text-purple-500">{streakData.longestStreak}</div>
          <div className="text-xs text-gray-500">שיא רצף</div>
        </div>
      </div>
      
      {/* הישגים אחרונים */}
      {streakData.achievements.length > 0 && (
        <div>
          <div className="text-xs text-gray-500 mb-2">הישגים:</div>
          <div className="flex flex-wrap gap-1">
            {streakData.achievements.slice(-5).map(achievementId => {
              const achievement = ACHIEVEMENTS[achievementId];
              if (!achievement) return null;
              return (
                <div 
                  key={achievementId}
                  className="flex items-center gap-1 bg-yellow-100 dark:bg-yellow-900/30 px-2 py-1 rounded-full text-xs"
                  title={achievement.description}
                >
                  <span>{achievement.icon}</span>
                  <span className="text-yellow-800 dark:text-yellow-200">{achievement.title}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * קומפוננטה מאוחדת
 */
export default function SmartReminders({ tasks, onDeferTask, onStartTask }) {
  const { editTask } = useTasks();
  
  return (
    <>
      <EndOfDayReminder 
        tasks={tasks} 
        onDeferTask={onDeferTask || editTask} 
      />
      <MorningBriefing 
        tasks={tasks}
        onStartTask={onStartTask}
      />
    </>
  );
}
