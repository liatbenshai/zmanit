/**
 * FiveMinuteRule - כלל 5 הדקות
 * =============================
 * "התחייבי רק ל-5 דקות" - מנטרל את הפחד מהתחלה
 * אחרי 5 דקות: "רוצה להמשיך?" - רוב הפעמים התשובה כן!
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

/**
 * שמירת סטטיסטיקות של כלל 5 הדקות
 */
function saveFiveMinuteStats(continued, taskId) {
  const stats = JSON.parse(localStorage.getItem('five_minute_stats') || '{}');
  
  if (!stats.sessions) stats.sessions = [];
  
  stats.sessions.push({
    taskId,
    continued,
    timestamp: new Date().toISOString()
  });
  
  // שמירת רק 90 יום אחורה
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  stats.sessions = stats.sessions.filter(s => new Date(s.timestamp) > ninetyDaysAgo);
  
  // חישוב סטטיסטיקות
  stats.totalSessions = stats.sessions.length;
  stats.continuedCount = stats.sessions.filter(s => s.continued).length;
  stats.continuedPercent = stats.totalSessions > 0 
    ? Math.round((stats.continuedCount / stats.totalSessions) * 100) 
    : 0;
  
  localStorage.setItem('five_minute_stats', JSON.stringify(stats));
  return stats;
}

/**
 * קבלת סטטיסטיקות
 */
export function getFiveMinuteStats() {
  return JSON.parse(localStorage.getItem('five_minute_stats') || '{"totalSessions": 0, "continuedCount": 0, "continuedPercent": 0}');
}

/**
 * מודל "רוצה להמשיך?" - קופץ אחרי 5 דקות
 */
function ContinueModal({ isOpen, onContinue, onStop, taskTitle, elapsedSeconds }) {
  if (!isOpen) return null;
  
  const minutes = Math.floor(elapsedSeconds / 60);
  
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-xl text-center"
        >
          {/* כותרת */}
          <div className="mb-4">
            <span className="text-5xl block mb-3">🎉</span>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              מעולה! עברו {minutes} דקות!
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mt-2">
              עבדת על "{taskTitle}"
            </p>
          </div>
          
          {/* שאלה */}
          <p className="text-lg text-gray-700 dark:text-gray-300 mb-6">
            רוצה להמשיך? 💪
          </p>
          
          {/* סטטיסטיקה מעודדת */}
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 mb-6">
            <p className="text-sm text-green-700 dark:text-green-300">
              💡 טיפ: רוב האנשים שמתחילים - ממשיכים!
              <br />
              <span className="font-medium">ההתחלה היא החלק הקשה.</span>
            </p>
          </div>
          
          {/* כפתורים */}
          <div className="space-y-3">
            <button
              onClick={onContinue}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white text-lg font-bold shadow-lg hover:shadow-xl transition-all"
            >
              ▶️ ממשיכה!
            </button>
            <button
              onClick={onStop}
              className="w-full py-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              ⏸️ מספיק לעכשיו
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * כפתור "רק 5 דקות" - להפעלה מהירה
 */
export function FiveMinuteButton({ task, onStart, className = '' }) {
  if (!task) return null;
  
  return (
    <button
      onClick={() => onStart(task, true)}
      className={`
        flex items-center gap-2 px-4 py-2 rounded-xl
        bg-gradient-to-r from-amber-400 to-orange-500 
        hover:from-amber-500 hover:to-orange-600
        text-white font-medium shadow-md hover:shadow-lg 
        transition-all transform hover:scale-105
        ${className}
      `}
    >
      <span>5️⃣</span>
      <span>רק 5 דקות!</span>
    </button>
  );
}

/**
 * Hook לניהול כלל 5 הדקות
 */
export function useFiveMinuteRule(taskId, onTimerStop) {
  const [isFiveMinuteMode, setIsFiveMinuteMode] = useState(false);
  const [showContinueModal, setShowContinueModal] = useState(false);
  const [fiveMinuteElapsed, setFiveMinuteElapsed] = useState(0);
  const fiveMinuteTimerRef = useRef(null);
  const hasShownModalRef = useRef(false);
  
  // בדיקה אם הגיעו 5 דקות
  useEffect(() => {
    if (isFiveMinuteMode && fiveMinuteElapsed >= 300 && !hasShownModalRef.current) {
      // 5 דקות = 300 שניות
      hasShownModalRef.current = true;
      setShowContinueModal(true);
      
      // עצירת הטיימר הפנימי (לא הטיימר הראשי)
      if (fiveMinuteTimerRef.current) {
        clearInterval(fiveMinuteTimerRef.current);
      }
    }
  }, [isFiveMinuteMode, fiveMinuteElapsed]);
  
  // התחלת מצב 5 דקות
  const startFiveMinuteMode = useCallback(() => {
    setIsFiveMinuteMode(true);
    setFiveMinuteElapsed(0);
    hasShownModalRef.current = false;
    
    // טיימר פנימי למעקב
    fiveMinuteTimerRef.current = setInterval(() => {
      setFiveMinuteElapsed(prev => prev + 1);
    }, 1000);
    
    toast('⏱️ התחייבת ל-5 דקות בלבד. אפשר לעשות את זה!', {
      icon: '5️⃣',
      duration: 3000
    });
  }, []);
  
  // המשך עבודה
  const handleContinue = useCallback(() => {
    setShowContinueModal(false);
    setIsFiveMinuteMode(false);
    
    saveFiveMinuteStats(true, taskId);
    
    toast.success('🚀 מעולה! ההתחלה היא החלק הקשה - ועכשיו את בפנים!');
  }, [taskId]);
  
  // עצירה
  const handleStop = useCallback(() => {
    setShowContinueModal(false);
    setIsFiveMinuteMode(false);
    
    saveFiveMinuteStats(false, taskId);
    
    // עצירת הטיימר הראשי
    if (onTimerStop) {
      onTimerStop();
    }
    
    toast('👍 5 דקות זה יותר מ-0! כל התקדמות חשובה.', {
      icon: '✨',
      duration: 3000
    });
  }, [taskId, onTimerStop]);
  
  // ניקוי
  useEffect(() => {
    return () => {
      if (fiveMinuteTimerRef.current) {
        clearInterval(fiveMinuteTimerRef.current);
      }
    };
  }, []);
  
  return {
    isFiveMinuteMode,
    showContinueModal,
    fiveMinuteElapsed,
    startFiveMinuteMode,
    handleContinue,
    handleStop,
    ContinueModal: (props) => (
      <ContinueModal 
        {...props}
        isOpen={showContinueModal}
        onContinue={handleContinue}
        onStop={handleStop}
        elapsedSeconds={fiveMinuteElapsed}
      />
    )
  };
}

/**
 * תצוגת סטטיסטיקות 5 דקות
 */
export function FiveMinuteStats() {
  const stats = getFiveMinuteStats();
  
  if (stats.totalSessions === 0) {
    return null;
  }
  
  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4">
      <h4 className="font-bold text-amber-800 dark:text-amber-200 mb-2 flex items-center gap-2">
        <span>5️⃣</span>
        כלל 5 הדקות
      </h4>
      
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <div className="text-2xl font-bold text-amber-600">
            {stats.totalSessions}
          </div>
          <div className="text-xs text-amber-700 dark:text-amber-300">פעמים</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-green-600">
            {stats.continuedCount}
          </div>
          <div className="text-xs text-amber-700 dark:text-amber-300">המשכת</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-purple-600">
            {stats.continuedPercent}%
          </div>
          <div className="text-xs text-amber-700 dark:text-amber-300">הצלחה</div>
        </div>
      </div>
      
      {stats.continuedPercent >= 70 && (
        <p className="text-sm text-amber-700 dark:text-amber-300 mt-3 text-center">
          🌟 את מוכיחה שההתחלה היא החלק הקשה!
        </p>
      )}
    </div>
  );
}

export default FiveMinuteButton;
