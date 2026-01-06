import { useState, useEffect } from 'react';
import { getSuggestedEstimate, getLearningStats } from '../../utils/taskLearning';

/**
 * רכיב הצעת הערכה חכמה
 * =====================
 * 
 * מוצג בטופס יצירת משימה ומציע הערכה מבוססת היסטוריה.
 */
function EstimateSuggestion({ taskType, currentEstimate, onAcceptSuggestion }) {
  const [suggestion, setSuggestion] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  
  useEffect(() => {
    if (taskType && currentEstimate > 0) {
      const result = getSuggestedEstimate(taskType, currentEstimate);
      setSuggestion(result);
      setDismissed(false); // איפוס כשמשתנה סוג המשימה
    } else {
      setSuggestion(null);
    }
  }, [taskType, currentEstimate]);
  
  // אם אין הצעה, או שההערכה זהה, או שהמשתמש סגר
  if (!suggestion || !suggestion.hasData || dismissed) {
    return null;
  }
  
  // אם ההבדל קטן מ-10% - לא מציגים
  const diffPercent = Math.abs(suggestion.ratio - 1) * 100;
  if (diffPercent < 10) {
    return null;
  }
  
  const isOverEstimate = suggestion.ratio > 1; // לוקח יותר מהצפוי
  
  return (
    <div className={`mt-2 p-3 rounded-lg border ${
      isOverEstimate 
        ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
        : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <p className={`text-sm font-medium ${
            isOverEstimate 
              ? 'text-orange-700 dark:text-orange-300'
              : 'text-green-700 dark:text-green-300'
          }`}>
            💡 {suggestion.message}
          </p>
          
          {suggestion.suggestedMinutes !== currentEstimate && (
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              הערכה מומלצת: <strong>{suggestion.suggestedMinutes} דק'</strong>
              {' '}(במקום {currentEstimate} דק')
              <span className="text-gray-400 mr-1">
                • מבוסס על {suggestion.sampleSize} משימות
              </span>
            </p>
          )}
        </div>
        
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-gray-400 hover:text-gray-600 text-lg"
          title="סגור"
        >
          ×
        </button>
      </div>
      
      {/* כפתור קבלת ההצעה */}
      {suggestion.suggestedMinutes !== currentEstimate && onAcceptSuggestion && (
        <button
          type="button"
          onClick={() => {
            onAcceptSuggestion(suggestion.suggestedMinutes);
            setDismissed(true);
          }}
          className={`mt-2 w-full py-1.5 text-sm rounded-lg font-medium transition-colors ${
            isOverEstimate
              ? 'bg-orange-500 hover:bg-orange-600 text-white'
              : 'bg-green-500 hover:bg-green-600 text-white'
          }`}
        >
          עדכן ל-{suggestion.suggestedMinutes} דק'
        </button>
      )}
    </div>
  );
}

/**
 * רכיב סטטיסטיקות למידה (לדף הגדרות או דשבורד)
 */
export function LearningStatsPanel() {
  const [stats, setStats] = useState({});
  
  useEffect(() => {
    setStats(getLearningStats());
  }, []);
  
  const taskTypes = Object.entries(stats);
  
  if (taskTypes.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <span className="text-3xl mb-2 block">📊</span>
        <p>אין עדיין נתוני למידה</p>
        <p className="text-sm">השלימי כמה משימות והמערכת תתחיל ללמוד</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white">
        📊 נתוני למידה
      </h3>
      
      <div className="grid gap-3">
        {taskTypes.map(([type, data]) => (
          <div 
            key={type}
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white">
                  {data.name}
                </h4>
                <p className="text-xs text-gray-500">
                  {data.count} משימות
                </p>
              </div>
              
              {/* יחס */}
              <div className={`text-lg font-bold ${
                data.ratio > 1.1 
                  ? 'text-orange-600' 
                  : data.ratio < 0.9 
                    ? 'text-green-600' 
                    : 'text-blue-600'
              }`}>
                {data.ratioPercent}%
              </div>
            </div>
            
            {/* סרגל השוואה */}
            <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
              <span>הערכה: {data.avgEstimated} דק'</span>
              <span>•</span>
              <span>בפועל: {data.avgActual} דק'</span>
              
              {data.trend === 'improving' && (
                <span className="text-green-600 mr-auto">📈 משתפרת!</span>
              )}
              {data.trend === 'declining' && (
                <span className="text-orange-600 mr-auto">📉 נסי לשפר</span>
              )}
            </div>
          </div>
        ))}
      </div>
      
      {/* הסבר */}
      <p className="text-xs text-gray-400 text-center">
        💡 100% = ההערכות מדויקות | מעל 100% = לוקח יותר מהצפוי | מתחת ל-100% = מסיימת מהר יותר
      </p>
    </div>
  );
}

export default EstimateSuggestion;
