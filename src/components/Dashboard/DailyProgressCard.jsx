import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { getAverageBufferTime, getDelayStats } from './WhyNotStartedDetector';
import { getCompletionStats } from './SmartTaskCompletionDialog';

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
    const todayTasks = tasks.filter(t => t.due_date === today && !t.deleted_at);
    const completed = todayTasks.filter(t => t.is_completed);
    const pending = todayTasks.filter(t => !t.is_completed);
    
    const plannedMinutes = pending.reduce((sum, t) => sum + (t.estimated_duration || 30), 0);
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
      className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden"
    >
      {/* כותרת עם אחוז גדול */}
      <div className="p-5 bg-gradient-to-r from-slate-50 to-blue-50 dark:from-gray-800 dark:to-slate-800">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white">
            📊 ההתקדמות שלך היום
          </h2>
          <div className={`text-sm font-medium ${getPaceColor()}`}>
            {getPaceText()}
          </div>
        </div>
        
        {/* אחוז גדול */}
        <div className="flex items-end gap-4 mb-4">
          <div className="text-6xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            {stats.progressPercent}%
          </div>
          <div className="text-gray-500 dark:text-gray-400 pb-2">
            {stats.completed}/{stats.total} משימות
          </div>
        </div>
        
        {/* פס התקדמות משימות */}
        <div className="relative h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-2">
          <motion.div
            className={`absolute top-0 right-0 h-full rounded-full bg-gradient-to-l ${getProgressColor()}`}
            initial={{ width: 0 }}
            animate={{ width: `${stats.progressPercent}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
          {/* סמן התקדמות צפויה */}
          <div 
            className="absolute top-0 h-full w-0.5 bg-gray-400 dark:bg-gray-500"
            style={{ right: `${stats.dayProgressPercent}%` }}
            title={`התקדמות צפויה: ${stats.dayProgressPercent}%`}
          />
        </div>
        
        <div className="flex justify-between text-xs text-gray-500">
          <span>התקדמות במשימות</span>
          <span>הקו = איפה צריך להיות לפי השעה</span>
        </div>
      </div>

      {/* סטטיסטיקות */}
      <div className="grid grid-cols-4 gap-2 p-4 border-t border-gray-100 dark:border-gray-700">
        <div className="text-center p-2">
          <div className="text-2xl font-bold text-green-500">{stats.completed}</div>
          <div className="text-xs text-gray-500">הושלמו</div>
        </div>
        <div className="text-center p-2">
          <div className="text-2xl font-bold text-blue-500">{stats.pending}</div>
          <div className="text-xs text-gray-500">ממתינות</div>
        </div>
        <div className="text-center p-2">
          <div className="text-2xl font-bold text-purple-500">{Math.round(stats.effectiveMinutesLeft)}</div>
          <div className="text-xs text-gray-500">דק' נשארו</div>
        </div>
        <div className="text-center p-2">
          <div className="text-2xl font-bold text-orange-500">{stats.bufferTime}</div>
          <div className="text-xs text-gray-500">דק' בלת"ם</div>
        </div>
      </div>

      {/* המלצה בזמן אמת */}
      {recommendation && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className={`p-4 border-t ${
            recommendation.type === 'warning' ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200' :
            recommendation.type === 'behind' ? 'bg-red-50 dark:bg-red-900/20 border-red-200' :
            recommendation.type === 'ahead' ? 'bg-green-50 dark:bg-green-900/20 border-green-200' :
            recommendation.type === 'done' ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200' :
            'bg-blue-50 dark:bg-blue-900/20 border-blue-200'
          }`}
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl">{recommendation.icon}</span>
            <div className="flex-1">
              <div className="font-medium text-gray-800 dark:text-white">
                {recommendation.title}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300">
                {recommendation.message}
              </div>
            </div>
            {recommendation.action && (
              <button className="px-3 py-1 bg-white dark:bg-gray-700 rounded-lg text-sm font-medium shadow-sm hover:shadow transition-shadow">
                {recommendation.action}
              </button>
            )}
          </div>
        </motion.div>
      )}

      {/* מידע על בלת"מים */}
      <div className="p-3 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>💡 המערכת למדה שאת צריכה ~{stats.bufferTime} דק' ביום לבלת"מים</span>
          <button className="text-blue-500 hover:underline">פרטים</button>
        </div>
      </div>
    </motion.div>
  );
}

export default DailyProgressCard;
