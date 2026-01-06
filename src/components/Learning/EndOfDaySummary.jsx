/**
 * סיכום יומי אוטומטי - זמנית
 * ==========================
 * מוצג בסוף יום העבודה עם סיכום והמלצות
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { generateDailySummary, analyzeEstimationAccuracy } from '../../utils/learningEngine';

/**
 * רכיב שמנהל הצגת סיכום בסוף היום
 */
function EndOfDaySummary({ tasks = [], workEndHour = 16 }) {
  const [showSummary, setShowSummary] = useState(false);
  const [summary, setSummary] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  
  // בדיקה אם הגיע הזמן להציג סיכום
  useEffect(() => {
    const checkTime = () => {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const today = now.toISOString().split('T')[0];
      
      // בדיקה אם כבר הוצג היום
      const lastShown = localStorage.getItem('daily_summary_last_shown');
      if (lastShown === today) {
        return;
      }
      
      // הצגה בין 16:00 ל-16:30 (או שעת סיום מותאמת)
      if (currentHour === workEndHour && currentMinute >= 0 && currentMinute <= 30 && !dismissed) {
        // יצירת סיכום
        const dailySummary = generateDailySummary(tasks);
        if (dailySummary) {
          setSummary(dailySummary);
          setShowSummary(true);
        }
      }
    };
    
    // בדיקה ראשונית
    checkTime();
    
    // בדיקה כל 5 דקות
    const interval = setInterval(checkTime, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [tasks, workEndHour, dismissed]);
  
  const handleDismiss = () => {
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem('daily_summary_last_shown', today);
    setShowSummary(false);
    setDismissed(true);
  };
  
  // אפשרות להציג ידנית
  const showManually = () => {
    const dailySummary = generateDailySummary(tasks);
    if (dailySummary) {
      setSummary(dailySummary);
      setShowSummary(true);
    }
  };
  
  return (
    <>
      {/* כפתור להצגה ידנית */}
      <button
        onClick={showManually}
        className="hidden" // מוסתר - ייקרא מבחוץ
        id="show-daily-summary"
      />
      
      <AnimatePresence>
        {showSummary && summary && (
          <DailySummaryModal
            summary={summary}
            onClose={handleDismiss}
          />
        )}
      </AnimatePresence>
    </>
  );
}

/**
 * מודל הסיכום היומי
 */
function DailySummaryModal({ summary, onClose }) {
  const accuracy = analyzeEstimationAccuracy();
  
  // צבעים לפי ציון
  const getScoreColor = (score) => {
    if (score >= 80) return 'from-green-500 to-emerald-600';
    if (score >= 60) return 'from-yellow-500 to-orange-500';
    return 'from-red-500 to-pink-500';
  };
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0, y: 50 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.8, opacity: 0, y: 50 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* כותרת עם ציון */}
        <div className={`bg-gradient-to-r ${getScoreColor(summary.productivityScore)} p-6 text-white text-center`}>
          <div className="text-6xl mb-2">{summary.grade?.emoji}</div>
          <h2 className="text-2xl font-bold">סיכום היום</h2>
          <p className="text-white/80">{summary.grade?.text}</p>
          
          {/* ציון גדול */}
          <div className="mt-4 inline-flex items-center justify-center w-24 h-24 rounded-full bg-white/20 backdrop-blur">
            <div>
              <div className="text-4xl font-bold">{summary.productivityScore}</div>
              <div className="text-xs text-white/80">מתוך 100</div>
            </div>
          </div>
        </div>
        
        {/* סטטיסטיקות */}
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {/* משימות */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 text-center">
              <div className="text-3xl mb-1">
                {summary.completedTasks === summary.plannedTasks ? '✅' : '📋'}
              </div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {summary.completedTasks}/{summary.plannedTasks}
              </div>
              <div className="text-xs text-gray-500">משימות הושלמו</div>
            </div>
            
            {/* זמן */}
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-3 text-center">
              <div className="text-3xl mb-1">⏱️</div>
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {Math.round(summary.actualMinutes / 60 * 10) / 10}
              </div>
              <div className="text-xs text-gray-500">שעות עבודה</div>
            </div>
            
            {/* איחורים */}
            <div className={`rounded-xl p-3 text-center ${
              summary.lateStarts === 0 
                ? 'bg-green-50 dark:bg-green-900/20' 
                : 'bg-orange-50 dark:bg-orange-900/20'
            }`}>
              <div className="text-3xl mb-1">{summary.lateStarts === 0 ? '🎯' : '⏰'}</div>
              <div className={`text-2xl font-bold ${
                summary.lateStarts === 0 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-orange-600 dark:text-orange-400'
              }`}>
                {summary.lateStarts}
              </div>
              <div className="text-xs text-gray-500">התחלות באיחור</div>
            </div>
            
            {/* הפרעות */}
            <div className={`rounded-xl p-3 text-center ${
              summary.interruptions <= 3 
                ? 'bg-green-50 dark:bg-green-900/20' 
                : 'bg-red-50 dark:bg-red-900/20'
            }`}>
              <div className="text-3xl mb-1">{summary.interruptions === 0 ? '🎯' : '📵'}</div>
              <div className={`text-2xl font-bold ${
                summary.interruptions <= 3 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {summary.interruptions}
              </div>
              <div className="text-xs text-gray-500">הפרעות</div>
            </div>
          </div>
          
          {/* תובנות */}
          {summary.insights && summary.insights.length > 0 && (
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
              <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">📝 תובנות</h4>
              <ul className="space-y-1">
                {summary.insights.map((insight, i) => (
                  <li key={i} className="text-sm text-gray-600 dark:text-gray-400">
                    {insight}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {/* המלצה מדיוק הערכות */}
          {accuracy.hasEnoughData && accuracy.recommendations?.[0] && (
            <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-4 border border-indigo-200 dark:border-indigo-700">
              <div className="flex items-start gap-2">
                <span className="text-xl">{accuracy.recommendations[0].icon}</span>
                <div>
                  <div className="font-medium text-indigo-700 dark:text-indigo-300">
                    {accuracy.recommendations[0].title}
                  </div>
                  <div className="text-sm text-indigo-600 dark:text-indigo-400">
                    {accuracy.recommendations[0].suggestion}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* השוואה לאתמול */}
          <CompareToYesterday summary={summary} />
        </div>
        
        {/* כפתורים */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            סגור
          </button>
          <button
            onClick={() => {
              // פתיחת מסך תובנות מלא
              document.getElementById('open-learning-insights')?.click();
              onClose();
            }}
            className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-medium hover:from-purple-600 hover:to-indigo-700 transition-colors"
          >
            🧠 תובנות מלאות
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/**
 * השוואה לאתמול
 */
function CompareToYesterday({ summary }) {
  const [yesterday, setYesterday] = useState(null);
  
  useEffect(() => {
    try {
      const summaries = JSON.parse(localStorage.getItem('daily_summaries') || '[]');
      const yesterdayDate = new Date();
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const yesterdayStr = yesterdayDate.toISOString().split('T')[0];
      
      const found = summaries.find(s => s.date === yesterdayStr);
      setYesterday(found);
    } catch (e) {
      console.error('שגיאה בטעינת אתמול:', e);
    }
  }, []);
  
  if (!yesterday) return null;
  
  const scoreDiff = summary.productivityScore - yesterday.productivityScore;
  const tasksDiff = summary.completedTasks - yesterday.completedTasks;
  
  return (
    <div className="flex items-center justify-center gap-4 text-sm">
      <div className="flex items-center gap-1">
        <span className={scoreDiff >= 0 ? 'text-green-500' : 'text-red-500'}>
          {scoreDiff >= 0 ? '📈' : '📉'}
        </span>
        <span className={scoreDiff >= 0 ? 'text-green-600' : 'text-red-600'}>
          {scoreDiff >= 0 ? '+' : ''}{scoreDiff} מאתמול
        </span>
      </div>
      <div className="text-gray-400">|</div>
      <div className="flex items-center gap-1">
        <span className={tasksDiff >= 0 ? 'text-green-500' : 'text-red-500'}>
          {tasksDiff >= 0 ? '⬆️' : '⬇️'}
        </span>
        <span className="text-gray-600 dark:text-gray-400">
          {tasksDiff >= 0 ? '+' : ''}{tasksDiff} משימות
        </span>
      </div>
    </div>
  );
}

export default EndOfDaySummary;

/**
 * Hook לשימוש בסיכום יומי
 */
export function useDailySummary(tasks) {
  const [isOpen, setIsOpen] = useState(false);
  const [summary, setSummary] = useState(null);
  
  const showSummary = () => {
    const dailySummary = generateDailySummary(tasks);
    setSummary(dailySummary);
    setIsOpen(true);
  };
  
  const hideSummary = () => {
    setIsOpen(false);
  };
  
  return {
    isOpen,
    summary,
    showSummary,
    hideSummary
  };
}
