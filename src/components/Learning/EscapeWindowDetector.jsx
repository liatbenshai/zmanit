/**
 * EscapeWindowDetector - זיהוי "חלון בריחה"
 * ==========================================
 * לומד מתי את עוצרת טיימרים באמצע משימה
 * מזהה שעות/ימים/סוגי משימות בעייתיים
 * מציע פתרונות מותאמים
 */

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';

const STORAGE_KEY = 'escape_window_data';

/**
 * רישום עצירת טיימר באמצע
 */
export function logTimerStop(taskId, taskTitle, taskType, elapsedMinutes, estimatedMinutes, completed = false) {
  // רק אם עצרו באמצע (לא סיימו)
  if (completed) return;
  
  // רק אם עבדו לפחות דקה אבל לא יותר מ-80% מהזמן
  const percentComplete = estimatedMinutes > 0 ? (elapsedMinutes / estimatedMinutes) * 100 : 0;
  if (elapsedMinutes < 1 || percentComplete > 80) return;
  
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"stops": []}');
    const now = new Date();
    
    data.stops.push({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      taskId,
      taskTitle,
      taskType,
      elapsedMinutes,
      estimatedMinutes,
      percentComplete: Math.round(percentComplete),
      timestamp: now.toISOString(),
      dayOfWeek: now.getDay(),
      hour: now.getHours(),
      dayName: ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'][now.getDay()]
    });
    
    // שמירת 90 יום
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    data.stops = data.stops.filter(s => new Date(s.timestamp) > ninetyDaysAgo);
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('שגיאה ברישום עצירה:', e);
  }
}

/**
 * ניתוח דפוסי בריחה
 */
export function analyzeEscapePatterns() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"stops": []}');
    
    if (data.stops.length < 5) {
      return null; // לא מספיק נתונים
    }
    
    const stops = data.stops;
    
    // ניתוח לפי שעה
    const byHour = {};
    stops.forEach(s => {
      const hourGroup = s.hour < 10 ? 'בוקר מוקדם (עד 10)' 
                      : s.hour < 13 ? 'בוקר (10-13)' 
                      : s.hour < 16 ? 'צהריים (13-16)' 
                      : s.hour < 19 ? 'אחה"צ (16-19)'
                      : 'ערב (19+)';
      byHour[hourGroup] = (byHour[hourGroup] || 0) + 1;
    });
    
    // ניתוח לפי יום
    const byDay = {};
    stops.forEach(s => {
      byDay[s.dayName] = (byDay[s.dayName] || 0) + 1;
    });
    
    // ניתוח לפי סוג משימה
    const byTaskType = {};
    stops.forEach(s => {
      const type = s.taskType || 'אחר';
      byTaskType[type] = (byTaskType[type] || 0) + 1;
    });
    
    // ניתוח לפי אחוז השלמה בעצירה
    const avgPercentAtStop = Math.round(
      stops.reduce((sum, s) => sum + s.percentComplete, 0) / stops.length
    );
    
    // מציאת דפוסים בולטים
    const patterns = [];
    
    // שעה בעייתית
    const worstHour = Object.entries(byHour).sort((a, b) => b[1] - a[1])[0];
    if (worstHour && worstHour[1] >= 3) {
      patterns.push({
        type: 'hour',
        label: worstHour[0],
        count: worstHour[1],
        percent: Math.round((worstHour[1] / stops.length) * 100),
        suggestion: getSuggestionForHour(worstHour[0])
      });
    }
    
    // יום בעייתי
    const worstDay = Object.entries(byDay).sort((a, b) => b[1] - a[1])[0];
    if (worstDay && worstDay[1] >= 3) {
      patterns.push({
        type: 'day',
        label: `יום ${worstDay[0]}`,
        count: worstDay[1],
        percent: Math.round((worstDay[1] / stops.length) * 100),
        suggestion: getSuggestionForDay(worstDay[0])
      });
    }
    
    // סוג משימה בעייתי
    const worstType = Object.entries(byTaskType).sort((a, b) => b[1] - a[1])[0];
    if (worstType && worstType[1] >= 3) {
      patterns.push({
        type: 'taskType',
        label: `משימות מסוג "${worstType[0]}"`,
        count: worstType[1],
        percent: Math.round((worstType[1] / stops.length) * 100),
        suggestion: getSuggestionForTaskType(worstType[0])
      });
    }
    
    return {
      totalStops: stops.length,
      avgPercentAtStop,
      byHour,
      byDay,
      byTaskType,
      patterns,
      recentStops: stops.slice(-5).reverse()
    };
  } catch (e) {
    return null;
  }
}

/**
 * הצעות לפי שעה
 */
function getSuggestionForHour(hourGroup) {
  const suggestions = {
    'בוקר מוקדם (עד 10)': 'נסי לתזמן משימות קלות יותר בבוקר מוקדם, או לוודא שאכלת ארוחת בוקר טובה.',
    'בוקר (10-13)': 'זו בדרך כלל שעת שיא! אולי יש הפרעות חיצוניות? נסי מצב "נא לא להפריע".',
    'צהריים (13-16)': 'אחרי הצהריים יש עייפות טבעית. נסי הפסקה קצרה לפני משימות באזור הזה.',
    'אחה"צ (16-19)': 'סוף יום עבודה = פחות אנרגיה. שמרי משימות קלות לשעות האלה.',
    'ערב (19+)': 'עבודה בערב דורשת יותר מוטיבציה. האם את באמת צריכה לעבוד עכשיו?'
  };
  return suggestions[hourGroup] || 'נסי לזהות מה מפריע בשעות האלה';
}

/**
 * הצעות לפי יום
 */
function getSuggestionForDay(dayName) {
  const suggestions = {
    'ראשון': 'תחילת שבוע יכולה להיות מכריעה. נסי לתכנן יום ראשון קליל יותר.',
    'שני': 'יום שני עמוס? אולי יש ישיבות רבות? נסי לפזר אותן.',
    'שלישי': 'אמצע השבוע - בדקי אם יש דפוס של עייפות מצטברת.',
    'רביעי': 'האם יש משהו קבוע ביום רביעי שמפריע?',
    'חמישי': 'לקראת סוף שבוע - אולי כבר "עם הראש" בסוף השבוע?',
    'שישי': 'יום קצר ולחוץ. תכנני פחות משימות ליום שישי.',
    'שבת': 'שבת היא לנוח! אם את עובדת - וודאי שזה באמת הכרחי.'
  };
  return suggestions[dayName] || 'נסי להבין מה מיוחד ביום הזה';
}

/**
 * הצעות לפי סוג משימה
 */
function getSuggestionForTaskType(taskType) {
  const suggestions = {
    'work': 'משימות עבודה גדולות? נסי לחלק אותן לחלקים קטנים יותר.',
    'admin': 'משימות אדמיניסטרטיביות משעממות? נסי לעשות אותן בזמן "מת" בין משימות.',
    'personal': 'משימות אישיות נדחות? אולי הן לא מספיק חשובות, או שפשוט לא מתאימות ללוח הזמנים.',
    'home': 'משימות בית? אולי עדיף לעשות אותן בזמן אחר ולא באמצע יום עבודה.',
    'health': 'בריאות חשובה! אם את עוצרת - אולי לתזמן לזמן נוח יותר?',
    'learning': 'למידה דורשת ריכוז. נסי ללמוד בשעות שיא של האנרגיה שלך.',
    'creative': 'עבודה יצירתית רגישה להפרעות. מצאי זמן שקט ומוגן.'
  };
  return suggestions[taskType] || 'נסי להבין מה קשה במשימות מסוג זה';
}

/**
 * כרטיס תובנות חלון בריחה
 */
export function EscapeWindowInsights({ isOpen, onClose }) {
  const analysis = useMemo(() => analyzeEscapePatterns(), [isOpen]);
  
  if (!isOpen) return null;
  
  // אין מספיק נתונים
  if (!analysis) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full"
          onClick={e => e.stopPropagation()}
        >
          <div className="text-center py-8">
            <span className="text-6xl block mb-4">🔍</span>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              עוד אין מספיק נתונים
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              המערכת לומדת מתי את עוצרת משימות באמצע. ככל שתשתמשי יותר, התובנות ישתפרו.
            </p>
            <button
              onClick={onClose}
              className="mt-6 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              הבנתי
            </button>
          </div>
        </motion.div>
      </motion.div>
    );
  }
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-lg w-full my-8"
        onClick={e => e.stopPropagation()}
      >
        {/* כותרת */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span>🚪</span> חלונות בריחה
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              מבוסס על {analysis.totalStops} עצירות באמצע משימה
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            ✕
          </button>
        </div>
        
        {/* נתון מרכזי */}
        <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl mb-6 text-center">
          <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
            {analysis.avgPercentAtStop}%
          </div>
          <div className="text-sm text-purple-700 dark:text-purple-300">
            ממוצע השלמה בעת עצירה
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            💡 רוב העצירות קורות באמצע - לא בהתחלה ולא לקראת הסוף
          </p>
        </div>
        
        {/* דפוסים בולטים */}
        {analysis.patterns.length > 0 && (
          <div className="mb-6">
            <h4 className="font-medium text-gray-900 dark:text-white mb-3">
              🎯 דפוסים שזיהיתי
            </h4>
            <div className="space-y-3">
              {analysis.patterns.map((pattern, idx) => (
                <div 
                  key={idx}
                  className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-amber-800 dark:text-amber-200">
                      {pattern.label}
                    </span>
                    <span className="text-sm text-amber-600 dark:text-amber-400">
                      {pattern.percent}% מהעצירות
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    💡 {pattern.suggestion}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* התפלגות לפי שעה */}
        <div className="mb-6">
          <h4 className="font-medium text-gray-900 dark:text-white mb-3">
            ⏰ לפי שעה
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(analysis.byHour)
              .sort((a, b) => b[1] - a[1])
              .map(([hour, count]) => (
                <div 
                  key={hour}
                  className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg flex justify-between text-sm"
                >
                  <span className="text-gray-600 dark:text-gray-300">{hour}</span>
                  <span className="font-medium text-gray-900 dark:text-white">{count}</span>
                </div>
              ))}
          </div>
        </div>
        
        {/* כפתור סגירה */}
        <button
          onClick={onClose}
          className="w-full py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 font-medium"
        >
          סגור
        </button>
      </motion.div>
    </motion.div>
  );
}

/**
 * כרטיס קטן לדשבורד
 */
export function EscapeWindowCard({ onClick }) {
  const analysis = analyzeEscapePatterns();
  
  if (!analysis || analysis.totalStops < 3) {
    return null; // לא מציג אם אין מספיק נתונים
  }
  
  const topPattern = analysis.patterns[0];
  
  return (
    <motion.button
      onClick={onClick}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-700 text-right hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">🚪</span>
        <span className="text-xs text-purple-600 dark:text-purple-400">
          {analysis.totalStops} עצירות
        </span>
      </div>
      
      <h4 className="font-medium text-gray-900 dark:text-white mb-1">
        חלונות בריחה
      </h4>
      
      {topPattern && (
        <p className="text-sm text-purple-700 dark:text-purple-300">
          הכי הרבה עצירות: {topPattern.label}
        </p>
      )}
      
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
        לחצי לפרטים והצעות →
      </p>
    </motion.button>
  );
}

export default EscapeWindowInsights;
