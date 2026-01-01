import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';

/**
 * מעקב פרודוקטיביות - לומד מתי המשתמש הכי יעיל
 * 
 * עוקב אחרי:
 * - באיזה שעות הושלמו הכי הרבה משימות
 * - באיזה שעות היו הכי פחות הפרעות
 * - באיזה שעות היחס בין הערכה לביצוע הכי טוב
 */

const STORAGE_KEY_PREFIX = 'productivity_log_';

// שמירת נתון פרודוקטיביות
export function logProductivity(userId, data) {
  if (!userId) return;
  
  const today = new Date().toISOString().split('T')[0];
  const hour = new Date().getHours();
  const key = `${STORAGE_KEY_PREFIX}${userId}`;
  
  try {
    const existing = JSON.parse(localStorage.getItem(key) || '{}');
    
    if (!existing[today]) {
      existing[today] = {};
    }
    
    if (!existing[today][hour]) {
      existing[today][hour] = {
        tasksCompleted: 0,
        minutesWorked: 0,
        minutesEstimated: 0,
        interruptions: 0,
        distractions: 0
      };
    }
    
    // עדכון הנתונים
    const hourData = existing[today][hour];
    if (data.taskCompleted) hourData.tasksCompleted++;
    if (data.minutesWorked) hourData.minutesWorked += data.minutesWorked;
    if (data.minutesEstimated) hourData.minutesEstimated += data.minutesEstimated;
    if (data.interruption) hourData.interruptions++;
    if (data.distraction) hourData.distractions++;
    
    localStorage.setItem(key, JSON.stringify(existing));
    
    // ניקוי נתונים ישנים (שומר 30 יום)
    cleanOldData(key, 30);
  } catch (e) {
    console.error('Error logging productivity:', e);
  }
}

// ניקוי נתונים ישנים
function cleanOldData(key, daysToKeep) {
  try {
    const data = JSON.parse(localStorage.getItem(key) || '{}');
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];
    
    let changed = false;
    for (const date of Object.keys(data)) {
      if (date < cutoffStr) {
        delete data[date];
        changed = true;
      }
    }
    
    if (changed) {
      localStorage.setItem(key, JSON.stringify(data));
    }
  } catch (e) {}
}

// קבלת ניתוח פרודוקטיביות
export function getProductivityAnalysis(userId) {
  if (!userId) return null;
  
  const key = `${STORAGE_KEY_PREFIX}${userId}`;
  
  try {
    const data = JSON.parse(localStorage.getItem(key) || '{}');
    
    // אגירת נתונים לפי שעה
    const hourlyStats = {};
    for (let h = 0; h < 24; h++) {
      hourlyStats[h] = {
        tasksCompleted: 0,
        minutesWorked: 0,
        minutesEstimated: 0,
        interruptions: 0,
        distractions: 0,
        daysWithData: 0
      };
    }
    
    // עיבוד כל הימים
    for (const [date, dayData] of Object.entries(data)) {
      for (const [hour, stats] of Object.entries(dayData)) {
        const h = parseInt(hour);
        hourlyStats[h].tasksCompleted += stats.tasksCompleted || 0;
        hourlyStats[h].minutesWorked += stats.minutesWorked || 0;
        hourlyStats[h].minutesEstimated += stats.minutesEstimated || 0;
        hourlyStats[h].interruptions += stats.interruptions || 0;
        hourlyStats[h].distractions += stats.distractions || 0;
        if (stats.minutesWorked > 0) {
          hourlyStats[h].daysWithData++;
        }
      }
    }
    
    // חישוב ציון פרודוקטיביות לכל שעה
    const hourlyScores = [];
    for (let h = 0; h < 24; h++) {
      const stats = hourlyStats[h];
      if (stats.daysWithData === 0) {
        hourlyScores.push({ hour: h, score: 0, hasData: false });
        continue;
      }
      
      // ציון מבוסס על:
      // - כמות משימות שהושלמו (משקל 40%)
      // - יחס עבודה/הערכה - קרוב ל-1 זה טוב (משקל 30%)
      // - מעט הפרעות (משקל 30%)
      
      const avgTasks = stats.tasksCompleted / stats.daysWithData;
      const ratio = stats.minutesEstimated > 0 
        ? stats.minutesWorked / stats.minutesEstimated 
        : 1;
      const ratioScore = ratio > 0 ? Math.max(0, 1 - Math.abs(1 - ratio)) : 0;
      const avgInterruptions = (stats.interruptions + stats.distractions) / stats.daysWithData;
      const interruptionScore = Math.max(0, 1 - (avgInterruptions / 5)); // עד 5 הפרעות = ציון 0
      
      const score = (avgTasks * 0.4) + (ratioScore * 0.3) + (interruptionScore * 0.3);
      
      hourlyScores.push({
        hour: h,
        score: Math.round(score * 100) / 100,
        hasData: true,
        stats: {
          avgTasks: Math.round(avgTasks * 10) / 10,
          ratio: Math.round(ratio * 100) / 100,
          avgInterruptions: Math.round(avgInterruptions * 10) / 10
        }
      });
    }
    
    // מציאת השעות הכי טובות
    const sortedHours = hourlyScores
      .filter(h => h.hasData)
      .sort((a, b) => b.score - a.score);
    
    const bestHours = sortedHours.slice(0, 3).map(h => h.hour);
    const worstHours = sortedHours.slice(-3).map(h => h.hour);
    
    // המלצות
    const recommendations = [];
    
    if (bestHours.length > 0) {
      const bestRange = formatHourRange(bestHours);
      recommendations.push({
        type: 'best_hours',
        icon: '🌟',
        title: 'השעות הכי טובות שלך',
        message: `את הכי פרודוקטיבית ב-${bestRange}. נסי לשים שם את עבודות הלקוח.`
      });
    }
    
    // בדיקת הפרעות
    const highInterruptionHours = hourlyScores
      .filter(h => h.hasData && h.stats?.avgInterruptions > 2)
      .map(h => h.hour);
    
    if (highInterruptionHours.length > 0) {
      const interruptRange = formatHourRange(highInterruptionHours);
      recommendations.push({
        type: 'interruptions',
        icon: '📞',
        title: 'שעות עם הרבה הפרעות',
        message: `ב-${interruptRange} יש לך הרבה הפרעות. אולי לתכנן שם משימות קצרות?`
      });
    }
    
    return {
      hourlyScores,
      bestHours,
      worstHours,
      recommendations,
      totalDaysAnalyzed: Object.keys(data).length
    };
  } catch (e) {
    console.error('Error analyzing productivity:', e);
    return null;
  }
}

// פורמט טווח שעות
function formatHourRange(hours) {
  if (hours.length === 0) return '';
  if (hours.length === 1) return `${hours[0]}:00`;
  
  hours.sort((a, b) => a - b);
  
  // בדיקה אם רצופות
  let isConsecutive = true;
  for (let i = 1; i < hours.length; i++) {
    if (hours[i] - hours[i-1] !== 1) {
      isConsecutive = false;
      break;
    }
  }
  
  if (isConsecutive) {
    return `${hours[0]}:00-${hours[hours.length-1] + 1}:00`;
  }
  
  return hours.map(h => `${h}:00`).join(', ');
}

/**
 * Hook לשימוש בניתוח פרודוקטיביות
 */
export function useProductivityInsights() {
  const { user } = useAuth();
  const [analysis, setAnalysis] = useState(null);
  
  useEffect(() => {
    if (user?.id) {
      setAnalysis(getProductivityAnalysis(user.id));
    }
  }, [user?.id]);
  
  const logEvent = useCallback((data) => {
    if (user?.id) {
      logProductivity(user.id, data);
      // רענון הניתוח
      setTimeout(() => {
        setAnalysis(getProductivityAnalysis(user.id));
      }, 100);
    }
  }, [user?.id]);
  
  return { analysis, logEvent };
}

/**
 * רכיב תצוגת המלצות פרודוקטיביות
 */
export function ProductivityInsights() {
  const { analysis } = useProductivityInsights();
  
  if (!analysis || analysis.recommendations.length === 0) {
    return null;
  }
  
  return (
    <div className="space-y-2">
      {analysis.recommendations.map((rec, idx) => (
        <div 
          key={idx}
          className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg"
        >
          <div className="flex items-start gap-2">
            <span className="text-xl">{rec.icon}</span>
            <div>
              <div className="font-medium text-purple-800 dark:text-purple-200">
                {rec.title}
              </div>
              <div className="text-sm text-purple-600 dark:text-purple-300 mt-1">
                {rec.message}
              </div>
            </div>
          </div>
        </div>
      ))}
      
      {analysis.totalDaysAnalyzed < 5 && (
        <div className="text-xs text-gray-500 text-center">
          💡 ככל שתשתמשי יותר, ההמלצות יהיו מדויקות יותר
          <br />
          (מבוסס על {analysis.totalDaysAnalyzed} ימים)
        </div>
      )}
    </div>
  );
}

export default ProductivityInsights;
