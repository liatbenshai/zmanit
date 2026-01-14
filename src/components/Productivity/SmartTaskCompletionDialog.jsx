import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TASK_TYPES } from '../../config/taskTypes';
import toast from 'react-hot-toast';

/**
 * דיאלוג סיום משימה חכם
 * - אפשרות להארכת 20% (פעם אחת!)
 * - משוב על הספק
 * - המערכת לומדת
 */

const EXTENSION_STORAGE_KEY = 'zmanit_task_extensions';
const COMPLETION_FEEDBACK_KEY = 'zmanit_completion_feedback';

// שמירת נתוני הארכות ומשוב ללמידה
function saveExtensionData(taskId, extended) {
  try {
    const data = JSON.parse(localStorage.getItem(EXTENSION_STORAGE_KEY) || '{}');
    data[taskId] = { extended, timestamp: new Date().toISOString() };
    localStorage.setItem(EXTENSION_STORAGE_KEY, JSON.stringify(data));
  } catch (e) {}
}

function wasTaskExtended(taskId) {
  try {
    const data = JSON.parse(localStorage.getItem(EXTENSION_STORAGE_KEY) || '{}');
    return data[taskId]?.extended || false;
  } catch (e) {
    return false;
  }
}

function saveCompletionFeedback(taskId, feedback, actualDuration, estimatedDuration) {
  try {
    const data = JSON.parse(localStorage.getItem(COMPLETION_FEEDBACK_KEY) || '[]');
    data.push({
      taskId,
      feedback,
      actualDuration,
      estimatedDuration,
      ratio: actualDuration / estimatedDuration,
      timestamp: new Date().toISOString()
    });
    // שומרים רק 100 אחרונים
    if (data.length > 100) data.shift();
    localStorage.setItem(COMPLETION_FEEDBACK_KEY, JSON.stringify(data));
  } catch (e) {}
}

// קבלת סטטיסטיקות למידה
export function getCompletionStats() {
  try {
    const data = JSON.parse(localStorage.getItem(COMPLETION_FEEDBACK_KEY) || '[]');
    if (data.length === 0) return null;
    
    const stats = {
      total: data.length,
      completedAll: data.filter(d => d.feedback === 'completed_all').length,
      completedPartial: data.filter(d => d.feedback === 'completed_partial').length,
      didNotFinish: data.filter(d => d.feedback === 'did_not_finish').length,
      averageRatio: data.reduce((sum, d) => sum + d.ratio, 0) / data.length,
      needsMoreTime: data.filter(d => d.ratio > 1.1).length / data.length > 0.3
    };
    
    return stats;
  } catch (e) {
    return null;
  }
}

/**
 * הדיאלוג עצמו
 */
function SmartTaskCompletionDialog({ 
  isOpen, 
  onClose, 
  task, 
  elapsedMinutes,
  onExtend,
  onComplete 
}) {
  const [alreadyExtended, setAlreadyExtended] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  
  const taskType = task ? (TASK_TYPES[task.task_type] || TASK_TYPES.other) : null;
  const estimatedDuration = task?.estimated_duration || 30;
  const extensionMinutes = Math.ceil(estimatedDuration * 0.2); // 20%
  
  // בדיקה אם כבר הוארכה
  useEffect(() => {
    if (task?.id) {
      setAlreadyExtended(wasTaskExtended(task.id));
    }
  }, [task?.id]);

  if (!isOpen || !task) return null;

  // הארכת 20%
  const handleExtend = () => {
    saveExtensionData(task.id, true);
    setAlreadyExtended(true);
    onExtend?.(extensionMinutes);
    toast.success(`⏰ נוספו ${extensionMinutes} דקות`);
    onClose();
  };

  // סיום עם משוב
  const handleComplete = (feedback) => {
    saveCompletionFeedback(task.id, feedback, elapsedMinutes, estimatedDuration);
    
    const messages = {
      completed_all: '🎉 מעולה! סיימת הכל!',
      completed_partial: '👍 טוב! סיימת חלק',
      did_not_finish: '📝 נרשם - נלמד מזה'
    };
    
    toast.success(messages[feedback]);
    onComplete?.(feedback);
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={e => e.stopPropagation()}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
          dir="rtl"
        >
          {/* כותרת */}
          <div className={`p-6 ${taskType?.bgLight || 'bg-blue-50'}`}>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-4xl">{taskType?.icon || '📋'}</span>
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">⏰ נגמר הזמן!</div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {task.title}
                </h2>
              </div>
            </div>
            
            {/* סטטיסטיקה */}
            <div className="flex gap-4 text-sm">
              <div className="bg-white/50 dark:bg-gray-700/50 rounded-lg px-3 py-2">
                <div className="text-gray-500">תוכנן</div>
                <div className="font-bold">{estimatedDuration} דק'</div>
              </div>
              <div className="bg-white/50 dark:bg-gray-700/50 rounded-lg px-3 py-2">
                <div className="text-gray-500">בפועל</div>
                <div className="font-bold">{elapsedMinutes} דק'</div>
              </div>
              <div className="bg-white/50 dark:bg-gray-700/50 rounded-lg px-3 py-2">
                <div className="text-gray-500">הפרש</div>
                <div className={`font-bold ${elapsedMinutes > estimatedDuration ? 'text-red-500' : 'text-green-500'}`}>
                  {elapsedMinutes > estimatedDuration ? '+' : ''}{elapsedMinutes - estimatedDuration} דק'
                </div>
              </div>
            </div>
          </div>

          {/* תוכן */}
          <div className="p-6 space-y-4">
            {!showFeedback ? (
              <>
                {/* כפתור הארכה - רק אם לא הוארכה */}
                {!alreadyExtended && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleExtend}
                    className="w-full p-4 bg-gradient-to-r from-orange-400 to-amber-500 text-white rounded-xl font-medium shadow-lg shadow-orange-500/30 flex items-center justify-center gap-3"
                  >
                    <span className="text-2xl">⏱️</span>
                    <div>
                      <div className="font-bold">עוד {extensionMinutes} דקות</div>
                      <div className="text-sm opacity-90">הארכה של 20% (פעם אחת)</div>
                    </div>
                  </motion.button>
                )}
                
                {alreadyExtended && (
                  <div className="text-center p-4 bg-gray-100 dark:bg-gray-700 rounded-xl text-gray-500">
                    ⚠️ כבר השתמשת בהארכה למשימה זו
                  </div>
                )}

                {/* כפתור סיום */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowFeedback(true)}
                  className="w-full p-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-medium shadow-lg shadow-green-500/30 flex items-center justify-center gap-3"
                >
                  <span className="text-2xl">✓</span>
                  <span>סיימתי - תני משוב</span>
                </motion.button>
              </>
            ) : (
              /* משוב על הספק */
              <div className="space-y-3">
                <h3 className="text-center font-medium text-gray-700 dark:text-gray-300 mb-4">
                  איך הרגשת עם ההספק?
                </h3>
                
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleComplete('completed_all')}
                  className="w-full p-4 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-xl font-medium flex items-center gap-3 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                >
                  <span className="text-2xl">😊</span>
                  <div className="text-right">
                    <div className="font-bold">סיימתי הכל!</div>
                    <div className="text-sm opacity-75">עשיתי את כל מה שרציתי</div>
                  </div>
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleComplete('completed_partial')}
                  className="w-full p-4 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded-xl font-medium flex items-center gap-3 hover:bg-yellow-200 dark:hover:bg-yellow-900/50 transition-colors"
                >
                  <span className="text-2xl">😐</span>
                  <div className="text-right">
                    <div className="font-bold">סיימתי חלקית</div>
                    <div className="text-sm opacity-75">עשיתי את הרוב אבל לא הכל</div>
                  </div>
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleComplete('did_not_finish')}
                  className="w-full p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-xl font-medium flex items-center gap-3 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                >
                  <span className="text-2xl">😓</span>
                  <div className="text-right">
                    <div className="font-bold">לא הספקתי</div>
                    <div className="text-sm opacity-75">צריך יותר זמן בפעם הבאה</div>
                  </div>
                </motion.button>
                
                <button
                  onClick={() => setShowFeedback(false)}
                  className="w-full p-2 text-gray-500 hover:text-gray-700 text-sm"
                >
                  ← חזרה
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default SmartTaskCompletionDialog;
