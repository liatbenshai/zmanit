import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { recordTaskCompletion, correctActualTime } from '../../utils/taskLearning';

/**
 * מודל משוב בסיום משימה
 * ======================
 * 
 * קופץ כשמשימה מסתיימת ומאפשר:
 * 1. לאשר שהזמן נכון
 * 2. לתקן את הזמן אם לא מדויק
 * 
 * הנתונים נשמרים למערכת הלמידה.
 */
function CompletionFeedbackModal({ 
  isOpen, 
  onClose, 
  task,
  actualMinutes,  // מה שנמדד
  onTimeConfirmed 
}) {
  const [correctedMinutes, setCorrectedMinutes] = useState(actualMinutes);
  const [showCorrection, setShowCorrection] = useState(false);
  
  if (!isOpen || !task) return null;
  
  const estimatedMinutes = task.estimated_duration || 0;
  const diff = actualMinutes - estimatedMinutes;
  const diffPercent = estimatedMinutes > 0 ? Math.round((diff / estimatedMinutes) * 100) : 0;
  
  // פורמט דקות לתצוגה
  const formatTime = (minutes) => {
    if (minutes < 60) return `${minutes} דק'`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return `${hours} שעות`;
    return `${hours}:${String(mins).padStart(2, '0')}`;
  };
  
  // אישור הזמן
  const handleConfirm = () => {
    // שמירה למערכת הלמידה
    if (task.task_type && estimatedMinutes > 0) {
      recordTaskCompletion(
        task.task_type,
        estimatedMinutes,
        correctedMinutes,
        task.title
      );
    }
    
    if (onTimeConfirmed) {
      onTimeConfirmed(correctedMinutes);
    }
    
    onClose();
  };
  
  // תיקון הזמן
  const handleCorrect = () => {
    if (correctedMinutes !== actualMinutes && task.task_type) {
      correctActualTime(task.task_type, actualMinutes, correctedMinutes);
    }
    handleConfirm();
  };
  
  // דילוג (לא שומר נתונים)
  const handleSkip = () => {
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && handleSkip()}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-xl"
          >
            {/* כותרת */}
            <div className="text-center mb-4">
              <span className="text-4xl mb-2 block">✅</span>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                סיימת את "{task.title}"!
              </h3>
            </div>
            
            {/* השוואה */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-600 dark:text-gray-400">הערכה:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {formatTime(estimatedMinutes)}
                </span>
              </div>
              
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-600 dark:text-gray-400">בפועל:</span>
                <span className={`font-bold ${
                  diff > 0 ? 'text-orange-600' : diff < 0 ? 'text-green-600' : 'text-blue-600'
                }`}>
                  {formatTime(actualMinutes)}
                </span>
              </div>
              
              {/* הפרש */}
              {estimatedMinutes > 0 && diff !== 0 && (
                <div className={`text-center mt-3 py-2 rounded-lg ${
                  diff > 0 
                    ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                    : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                }`}>
                  {diff > 0 ? (
                    <span>לקח {formatTime(Math.abs(diff))} יותר ({diffPercent}%+)</span>
                  ) : (
                    <span>סיימת {formatTime(Math.abs(diff))} מהר יותר! 🎉</span>
                  )}
                </div>
              )}
            </div>
            
            {/* תיקון ידני */}
            {showCorrection ? (
              <div className="mb-4">
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                  תקני את הזמן האמיתי:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={correctedMinutes}
                    onChange={(e) => setCorrectedMinutes(parseInt(e.target.value) || 0)}
                    className="flex-1 px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-center text-lg"
                    min="1"
                  />
                  <span className="text-gray-500">דקות</span>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowCorrection(true)}
                className="w-full text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 mb-4"
              >
                ✏️ הזמן לא מדויק? לחצי לתקן
              </button>
            )}
            
            {/* כפתורים */}
            <div className="flex gap-2">
              <button
                onClick={handleSkip}
                className="flex-1 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                דלג
              </button>
              <button
                onClick={showCorrection ? handleCorrect : handleConfirm}
                className="flex-1 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
              >
                {showCorrection ? 'שמור תיקון' : 'אישור ✓'}
              </button>
            </div>
            
            {/* הסבר */}
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-3">
              💡 הנתונים עוזרים למערכת ללמוד ולהציע הערכות מדויקות יותר
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default CompletionFeedbackModal;
