/**
 * RealEndOfDay - סוף יום אמיתי
 * ==============================
 * השוואת מתוכנן vs בפועל בסוף היום
 * לומד מהפערים ומציע שיפורים
 */

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const STORAGE_KEY = 'real_end_of_day_data';
const SETTINGS_KEY = 'real_end_of_day_settings';

/**
 * טעינת הגדרות
 */
function loadSettings() {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return {
    enabled: true,
    reminderHour: 17, // שעה לתזכורת סיכום
    autoShow: true // הצג אוטומטית בסוף יום
  };
}

/**
 * שמירת הגדרות
 */
function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

/**
 * חישוב סיכום יומי
 */
export function calculateDailySummary(tasks, date = new Date()) {
  const dateStr = date.toISOString().split('T')[0];
  
  // משימות של היום
  const todayTasks = tasks.filter(t => t.due_date === dateStr);
  
  // מתוכנן
  const planned = {
    count: todayTasks.length,
    totalMinutes: todayTasks.reduce((sum, t) => sum + (t.estimated_duration || 30), 0)
  };
  
  // הושלם
  const completed = todayTasks.filter(t => t.is_completed);
  const actual = {
    count: completed.length,
    totalMinutes: completed.reduce((sum, t) => sum + (t.time_spent || t.estimated_duration || 30), 0)
  };
  
  // נדחה
  const postponed = todayTasks.filter(t => !t.is_completed);
  
  // חישוב פערים
  const completionRate = planned.count > 0 
    ? Math.round((actual.count / planned.count) * 100) 
    : 0;
  
  // הערכות זמן - מתוכנן vs בפועל
  const timeAccuracy = completed.map(t => {
    const estimated = t.estimated_duration || 30;
    const actual = t.time_spent || estimated;
    return {
      taskId: t.id,
      title: t.title,
      estimated,
      actual,
      diff: actual - estimated,
      percentDiff: Math.round(((actual - estimated) / estimated) * 100)
    };
  });
  
  const avgTimeAccuracy = timeAccuracy.length > 0
    ? Math.round(timeAccuracy.reduce((sum, t) => sum + t.percentDiff, 0) / timeAccuracy.length)
    : 0;
  
  return {
    date: dateStr,
    planned,
    actual,
    postponed: postponed.map(t => ({ id: t.id, title: t.title, type: t.task_type })),
    completionRate,
    timeAccuracy,
    avgTimeAccuracy,
    overestimated: timeAccuracy.filter(t => t.diff < -5).length,
    underestimated: timeAccuracy.filter(t => t.diff > 5).length
  };
}

/**
 * שמירת סיכום יומי להיסטוריה
 */
export function saveDailySummary(summary) {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"days": []}');
    
    // בדיקה שלא כבר נשמר
    if (data.days.find(d => d.date === summary.date)) {
      // עדכון במקום הוספה
      data.days = data.days.map(d => d.date === summary.date ? summary : d);
    } else {
      data.days.push(summary);
    }
    
    // שמירת 90 יום
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    data.days = data.days.filter(d => new Date(d.date) > ninetyDaysAgo);
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {}
}

/**
 * קבלת היסטוריה
 */
export function getDailyHistory(days = 30) {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"days": []}');
    return data.days.slice(-days);
  } catch (e) {
    return [];
  }
}

/**
 * ניתוח מגמות
 */
export function analyzeTrends() {
  const history = getDailyHistory(30);
  
  if (history.length < 7) {
    return null; // לא מספיק נתונים
  }
  
  // ממוצע השלמה
  const avgCompletion = Math.round(
    history.reduce((sum, d) => sum + d.completionRate, 0) / history.length
  );
  
  // מגמה - השוואת שבוע אחרון לשבוע קודם
  const lastWeek = history.slice(-7);
  const prevWeek = history.slice(-14, -7);
  
  const lastWeekAvg = lastWeek.reduce((sum, d) => sum + d.completionRate, 0) / lastWeek.length;
  const prevWeekAvg = prevWeek.length > 0 
    ? prevWeek.reduce((sum, d) => sum + d.completionRate, 0) / prevWeek.length
    : lastWeekAvg;
  
  const trend = lastWeekAvg - prevWeekAvg;
  
  // דיוק הערכות זמן
  const avgTimeAccuracy = Math.round(
    history.reduce((sum, d) => sum + (d.avgTimeAccuracy || 0), 0) / history.length
  );
  
  // הסוג הכי נדחה
  const postponedTypes = {};
  history.forEach(d => {
    d.postponed?.forEach(p => {
      const type = p.type || 'other';
      postponedTypes[type] = (postponedTypes[type] || 0) + 1;
    });
  });
  
  const mostPostponedType = Object.entries(postponedTypes)
    .sort((a, b) => b[1] - a[1])[0];
  
  return {
    daysAnalyzed: history.length,
    avgCompletionRate: avgCompletion,
    trend: Math.round(trend),
    trendDirection: trend > 2 ? 'up' : trend < -2 ? 'down' : 'stable',
    avgTimeAccuracy,
    mostPostponedType: mostPostponedType ? {
      type: mostPostponedType[0],
      count: mostPostponedType[1]
    } : null
  };
}

/**
 * יצירת המלצות מותאמות
 */
function generateRecommendations(summary, trends) {
  const recommendations = [];
  
  // לפי אחוז השלמה
  if (summary.completionRate < 50) {
    recommendations.push({
      icon: '📋',
      text: 'נסי לתכנן פחות משימות - איכות על כמות',
      priority: 'high'
    });
  } else if (summary.completionRate >= 90) {
    recommendations.push({
      icon: '🌟',
      text: 'מעולה! אולי יש מקום לאתגר נוסף?',
      priority: 'low'
    });
  }
  
  // לפי דיוק הערכות
  if (summary.avgTimeAccuracy > 20) {
    recommendations.push({
      icon: '⏱️',
      text: 'הערכות הזמן שלך אופטימיות מדי - נסי להוסיף 20% לכל הערכה',
      priority: 'medium'
    });
  } else if (summary.avgTimeAccuracy < -20) {
    recommendations.push({
      icon: '🎯',
      text: 'את מסיימת מהר מהצפוי - אפשר לתכנן יותר!',
      priority: 'low'
    });
  }
  
  // לפי משימות שנדחו
  if (summary.postponed.length > 3) {
    recommendations.push({
      icon: '🔄',
      text: `${summary.postponed.length} משימות נדחו - אולי הן לא באמת חשובות?`,
      priority: 'medium'
    });
  }
  
  // לפי מגמות
  if (trends?.trendDirection === 'down') {
    recommendations.push({
      icon: '📉',
      text: 'יש ירידה באחוז ההשלמה - מה השתנה השבוע?',
      priority: 'high'
    });
  }
  
  return recommendations;
}

/**
 * מודל סיכום סוף יום
 */
export default function RealEndOfDay({ isOpen, onClose, tasks }) {
  const [settings] = useState(loadSettings);
  
  const summary = useMemo(() => {
    if (!tasks) return null;
    return calculateDailySummary(tasks);
  }, [tasks]);
  
  const trends = useMemo(() => analyzeTrends(), []);
  
  const recommendations = useMemo(() => {
    if (!summary) return [];
    return generateRecommendations(summary, trends);
  }, [summary, trends]);
  
  // שמירה אוטומטית בפתיחה
  useEffect(() => {
    if (isOpen && summary) {
      saveDailySummary(summary);
    }
  }, [isOpen, summary]);
  
  if (!isOpen || !summary) return null;
  
  const getCompletionColor = (rate) => {
    if (rate >= 80) return 'text-green-600 dark:text-green-400';
    if (rate >= 50) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };
  
  const getCompletionEmoji = (rate) => {
    if (rate >= 90) return '🏆';
    if (rate >= 70) return '👏';
    if (rate >= 50) return '👍';
    return '💪';
  };
  
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-lg w-full my-8 shadow-xl"
          onClick={e => e.stopPropagation()}
        >
          {/* כותרת */}
          <div className="text-center mb-6">
            <span className="text-5xl block mb-2">{getCompletionEmoji(summary.completionRate)}</span>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              סיכום היום
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {new Date().toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          
          {/* סטטיסטיקות ראשיות */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-center">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {summary.planned.count}
              </div>
              <div className="text-xs text-blue-700 dark:text-blue-300">תוכנן</div>
            </div>
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-xl text-center">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {summary.actual.count}
              </div>
              <div className="text-xs text-green-700 dark:text-green-300">הושלם</div>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl text-center">
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {summary.postponed.length}
              </div>
              <div className="text-xs text-amber-700 dark:text-amber-300">נדחה</div>
            </div>
          </div>
          
          {/* אחוז השלמה */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">אחוז השלמה</span>
              <span className={`text-lg font-bold ${getCompletionColor(summary.completionRate)}`}>
                {summary.completionRate}%
              </span>
            </div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${summary.completionRate}%` }}
                transition={{ duration: 0.5 }}
                className={`h-full rounded-full ${
                  summary.completionRate >= 80 ? 'bg-green-500' 
                  : summary.completionRate >= 50 ? 'bg-amber-500' 
                  : 'bg-red-500'
                }`}
              />
            </div>
          </div>
          
          {/* דיוק הערכות זמן */}
          {summary.timeAccuracy.length > 0 && (
            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                ⏱️ דיוק הערכות זמן
              </h4>
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-gray-600 dark:text-gray-400">ממוצע:</span>
                <span className={`font-medium ${
                  Math.abs(summary.avgTimeAccuracy) <= 10 
                    ? 'text-green-600' 
                    : 'text-amber-600'
                }`}>
                  {summary.avgTimeAccuracy > 0 ? '+' : ''}{summary.avgTimeAccuracy}%
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">הערכת יתר:</span>
                  <span className="text-red-600">{summary.underestimated}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">הערכת חסר:</span>
                  <span className="text-blue-600">{summary.overestimated}</span>
                </div>
              </div>
            </div>
          )}
          
          {/* המלצות */}
          {recommendations.length > 0 && (
            <div className="mb-6">
              <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                💡 המלצות
              </h4>
              <div className="space-y-2">
                {recommendations.map((rec, idx) => (
                  <div 
                    key={idx}
                    className={`p-3 rounded-lg flex items-start gap-2 ${
                      rec.priority === 'high' 
                        ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                        : rec.priority === 'medium'
                        ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
                        : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                    }`}
                  >
                    <span className="text-xl">{rec.icon}</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">{rec.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* מגמות */}
          {trends && (
            <div className="mb-6 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                <span>📊</span> מגמות ({trends.daysAnalyzed} ימים)
              </h4>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-600 dark:text-gray-400">ממוצע השלמה:</span>
                <span className="font-medium text-purple-600 dark:text-purple-400">
                  {trends.avgCompletionRate}%
                </span>
                {trends.trendDirection === 'up' && <span className="text-green-500">↑</span>}
                {trends.trendDirection === 'down' && <span className="text-red-500">↓</span>}
              </div>
            </div>
          )}
          
          {/* משימות שנדחו */}
          {summary.postponed.length > 0 && (
            <div className="mb-6">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                🔄 נדחה למחר ({summary.postponed.length})
              </h4>
              <div className="space-y-1 max-h-24 overflow-y-auto">
                {summary.postponed.slice(0, 5).map(task => (
                  <div 
                    key={task.id}
                    className="text-sm text-gray-600 dark:text-gray-400 truncate"
                  >
                    • {task.title}
                  </div>
                ))}
                {summary.postponed.length > 5 && (
                  <div className="text-xs text-gray-500">
                    ועוד {summary.postponed.length - 5}...
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* כפתור סגירה */}
          <button
            onClick={onClose}
            className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl font-medium shadow-lg"
          >
            סיימתי להיום! 🌙
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * כפתור קטן לסיכום יום
 */
export function EndOfDayButton({ onClick, tasks }) {
  const summary = useMemo(() => {
    if (!tasks) return null;
    return calculateDailySummary(tasks);
  }, [tasks]);
  
  if (!summary) return null;
  
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl font-medium shadow-md hover:shadow-lg transition-all"
    >
      <span>🌙</span>
      <span>סיכום היום</span>
      <span className="bg-white/20 px-2 py-0.5 rounded-full text-sm">
        {summary.completionRate}%
      </span>
    </button>
  );
}
