import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { getAverageBufferTime, getDelayStats } from '../../utils/delayStats';
import { getCompletionStats } from '../Productivity/SmartTaskCompletionDialog';

/**
 * כרטיס התקדמות יומית
 * - מציג התקדמות בולטת
 * - המלצות בזמן אמת לפי קצב
 * - מידע על בלת"מים
 */

function DailyProgressCard({ tasks, currentTime }) {
  const [recommendation, setRecommendation] = useState(null);
  
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  
  // שעות עבודה (ברירת מחדל)
  const WORK_START = 8.5 * 60; // 08:30
  const WORK_END = 16.25 * 60; // 16:15
  const TOTAL_WORK_MINUTES = WORK_END - WORK_START; // 465 דקות
  
  // סטטיסטיקות היום
  const stats = useMemo(() => {
    // ✅ תיקון: מסננים משימות הוריות (is_project) - סופרים רק אינטרוולים
    // כדי למנוע ספירה כפולה (הורה + ילדים)
    const todayTasks = tasks.filter(t => {
      if (t.deleted_at) return false;
      if (t.due_date !== today) return false;
      // לא סופרים משימות הוריות - האינטרוולים שלהן ייספרו בנפרד
      if (t.is_project && tasks.some(child => child.parent_task_id === t.id)) return false;
      return true;
    });
    const completed = todayTasks.filter(t => t.is_completed);
    const pending = todayTasks.filter(t => !t.is_completed);

    // ✅ תיקון: חישוב זמן רק עבור אינטרוולים של היום
    // time_spent הוא הזמן שהושקע באינטרוול הספציפי, לא במשימה השלמה
    const plannedMinutes = pending.reduce((sum, t) => {
      const estimated = t.estimated_duration || 30;
      const spent = t.time_spent || 0;
      // מה שנותר לעשות באינטרוול הזה
      return sum + Math.max(0, estimated - spent);
    }, 0);
    const completedMinutes = completed.reduce((sum, t) => sum + (t.time_spent || t.estimated_duration || 30), 0);
    
    // זמן שנשאר ביום
    const minutesLeftInDay = Math.max(0, WORK_END - currentMinutes);
    
    // זמן בלת"מים מחושב
    const bufferTime = getAverageBufferTime();
    
    // זמן אפקטיבי שנשאר
    const effectiveMinutesLeft = Math.max(0, minutesLeftInDay - bufferTime);
    
    // אחוז התקדמות (לפי משימות)
    const totalTasks = todayTasks.length;
    const progressPercent = totalTasks > 0 
      ? Math.round((completed.length / totalTasks) * 100)
      : 0;
    
    // אחוז התקדמות לפי זמן ביום
    const dayProgressPercent = Math.min(100, Math.round(
      ((currentMinutes - WORK_START) / TOTAL_WORK_MINUTES) * 100
    ));
    
    // האם בקצב?
    const expectedProgress = dayProgressPercent;
    const actualProgress = progressPercent;
    const pace = actualProgress - expectedProgress; // חיובי = מקדימים, שלילי = מאחרים
    
    // האם יש עומס יתר?
    const isOverloaded = plannedMinutes > effectiveMinutesLeft;
    
    return {
      completed: completed.length,
      pending: pending.length,
      total: totalTasks,
      progressPercent,
      dayProgressPercent,
      pace,
      plannedMinutes,
      completedMinutes,
      minutesLeftInDay,
      effectiveMinutesLeft,
      bufferTime,
      isOverloaded,
      completedTasks: completed,
      pendingTasks: pending
    };
  }, [tasks, today, currentMinutes]);

  // המלצות בזמן אמת
  useEffect(() => {
    const completionStats = getCompletionStats();
    const delayStats = getDelayStats();
    
    let newRecommendation = null;
    
    // בדיקת מצבים
    if (stats.isOverloaded) {
      const overloadMinutes = stats.plannedMinutes - stats.effectiveMinutesLeft;
      newRecommendation = {
        type: 'warning',
        icon: '⚠️',
        title: 'עומס יתר',
        message: `יש לך ${Math.round(overloadMinutes)} דקות יותר מדי. שקלי להעביר משימה למחר.`,
        action: 'העבירי משימה'
      };
    } else if (stats.pace < -20) {
      newRecommendation = {
        type: 'behind',
        icon: '🏃',
        title: 'קצת מאחרת',
        message: 'בואי נתמקד! נסי לסיים משימה קטנה כדי לתפוס תאוצה.',
        action: 'התחילי משימה'
      };
    } else if (stats.pace > 20) {
      newRecommendation = {
        type: 'ahead',
        icon: '🌟',
        title: 'מעולה!',
        message: 'את מקדימה! יש לך זמן לקחת הפסקה או להתחיל משימה מהשבוע.',
        action: null
      };
    } else if (completionStats?.needsMoreTime) {
      newRecommendation = {
        type: 'learning',
        icon: '📊',
        title: 'תובנה מהלמידה',
        message: 'שמתי לב שלעתים קרובות את צריכה יותר זמן. אולי להגדיל הערכות ב-10%?',
        action: 'עדכני הערכות'
      };
    } else if (stats.completed > 0 && stats.pending === 0) {
      newRecommendation = {
        type: 'done',
        icon: '🎉',
        title: 'סיימת הכל!',
        message: 'כל הכבוד! סיימת את כל המשימות להיום.',
        action: null
      };
    }
    
    setRecommendation(newRecommendation);
  }, [stats]);

  // צבע לפס התקדמות
  const getProgressColor = () => {
    if (stats.progressPercent >= 80) return 'from-green-400 to-emerald-500';
    if (stats.progressPercent >= 50) return 'from-blue-400 to-cyan-500';
    if (stats.progressPercent >= 25) return 'from-yellow-400 to-orange-500';
    return 'from-gray-300 to-gray-400';
  };

  // צבע לפי קצב
  const getPaceColor = () => {
    if (stats.pace > 10) return 'text-green-500';
    if (stats.pace < -10) return 'text-red-500';
    return 'text-blue-500';
  };

  const getPaceText = () => {
    if (stats.pace > 10) return 'מקדימה! 🚀';
    if (stats.pace < -10) return 'מאחרת קצת';
    return 'בדיוק בזמן ✓';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 rounded-2xl shadow-card border border-gray-100 dark:border-gray-700/60 overflow-hidden"
    >
      {/* כותרת עם אחוז גדול */}
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
            <span>📊</span> ההתקדמות שלך היום
          </h2>
          <div className={`text-xs font-medium px-2.5 py-1 rounded-full ${
            stats.pace > 10 ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400' :
            stats.pace < -10 ? 'bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400' :
            'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
          }`}>
            {getPaceText()}
          </div>
        </div>

        {/* אחוז גדול */}
        <div className="flex items-end gap-3 mb-4">
          <div className="text-5xl font-bold text-gradient leading-none">
            {stats.progressPercent}%
          </div>
          <div className="text-gray-400 dark:text-gray-500 pb-1 text-sm">
            {stats.completed}/{stats.total} משימות
          </div>
        </div>

        {/* פס התקדמות משימות */}
        <div className="relative h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden mb-1.5">
          <motion.div
            className={`absolute top-0 right-0 h-full rounded-full bg-gradient-to-l ${getProgressColor()}`}
            initial={{ width: 0 }}
            animate={{ width: `${stats.progressPercent}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
          {/* סמן התקדמות צפויה */}
          <div
            className="absolute top-0 h-full w-0.5 bg-gray-400/50 dark:bg-gray-500/50"
            style={{ right: `${stats.dayProgressPercent}%` }}
            title={`התקדמות צפויה: ${stats.dayProgressPercent}%`}
          />
        </div>

        <div className="flex justify-between text-[10px] text-gray-400 dark:text-gray-500">
          <span>התקדמות במשימות</span>
          <span>הקו = איפה צריך להיות</span>
        </div>
      </div>

      {/* סטטיסטיקות */}
      <div className="grid grid-cols-4 gap-px bg-gray-100 dark:bg-gray-700/50">
        <div className="stat-card rounded-none bg-white dark:bg-gray-800 py-3">
          <div className="stat-value text-green-500">{stats.completed}</div>
          <div className="stat-label">הושלמו</div>
        </div>
        <div className="stat-card rounded-none bg-white dark:bg-gray-800 py-3">
          <div className="stat-value text-blue-500">{stats.pending}</div>
          <div className="stat-label">ממתינות</div>
        </div>
        <div className="stat-card rounded-none bg-white dark:bg-gray-800 py-3">
          <div className="stat-value text-purple-500">{Math.round(stats.effectiveMinutesLeft)}</div>
          <div className="stat-label">דק' נשארו</div>
        </div>
        <div className="stat-card rounded-none bg-white dark:bg-gray-800 py-3">
          <div className="stat-value text-amber-500">{stats.bufferTime}</div>
          <div className="stat-label">דק' בלת"ם</div>
        </div>
      </div>

      {/* המלצה בזמן אמת */}
      {recommendation && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className={`p-4 border-t ${
            recommendation.type === 'warning' ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-800/30' :
            recommendation.type === 'behind' ? 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-800/30' :
            recommendation.type === 'ahead' ? 'bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-800/30' :
            recommendation.type === 'done' ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-800/30' :
            'bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-800/30'
          }`}
        >
          <div className="flex items-start gap-3">
            <span className="text-xl">{recommendation.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm text-gray-800 dark:text-white">
                {recommendation.title}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-300 mt-0.5 leading-relaxed">
                {recommendation.message}
              </div>
            </div>
            {recommendation.action && (
              <button className="flex-shrink-0 px-3 py-1.5 bg-white dark:bg-gray-700 rounded-lg text-xs font-medium shadow-sm hover:shadow transition-shadow border border-gray-100 dark:border-gray-600">
                {recommendation.action}
              </button>
            )}
          </div>
        </motion.div>
      )}

      {/* מידע על בלת"מים */}
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900/30 border-t border-gray-100 dark:border-gray-700/60">
        <div className="flex items-center justify-between text-[11px] text-gray-400 dark:text-gray-500">
          <span>💡 ~{stats.bufferTime} דק' ביום לבלת"מים (לפי הלמידה)</span>
          <button className="text-blue-500 hover:text-blue-600 font-medium">פרטים</button>
        </div>
      </div>
    </motion.div>
  );
}

export default DailyProgressCard;
