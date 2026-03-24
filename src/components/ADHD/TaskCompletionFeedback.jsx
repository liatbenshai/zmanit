import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TASK_TYPES } from '../../config/taskTypes';

/**
 * 📝 משוב "איך הלך?" - לומד הערכות זמן
 * 
 * מופיע בסיום כל משימה ולומד:
 * - האם ההערכה הייתה נכונה?
 * - למה לקח יותר/פחות זמן?
 * - מה ההערכה המומלצת לפעם הבאה?
 */

const STORAGE_KEY = 'zmanit_time_learning';

/**
 * סיבות לחריגה בזמן
 */
const OVERRUN_REASONS = [
  { id: 'harder', icon: '😓', label: 'המשימה הייתה קשה יותר מהצפוי' },
  { id: 'interruptions', icon: '📞', label: 'היו הפרעות' },
  { id: 'bad_estimate', icon: '🤔', label: 'הערכתי לא נכון' },
  { id: 'scope_creep', icon: '📈', label: 'התברר שיש יותר עבודה' },
  { id: 'technical', icon: '🔧', label: 'בעיות טכניות' },
  { id: 'other', icon: '📝', label: 'סיבה אחרת' }
];

/**
 * סיבות לסיום מוקדם
 */
const UNDERRUN_REASONS = [
  { id: 'easier', icon: '😊', label: 'המשימה הייתה קלה יותר' },
  { id: 'focused', icon: '🎯', label: 'הייתי ממוקדת במיוחד' },
  { id: 'over_estimate', icon: '📊', label: 'הערכתי יותר מדי זמן' },
  { id: 'experience', icon: '💪', label: 'כבר יש לי ניסיון בזה' },
  { id: 'tools', icon: '🛠️', label: 'השתמשתי בכלים יעילים' }
];

/**
 * טעינת היסטוריית למידה
 */
function loadLearningData() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : { tasks: {}, overall: { totalTasks: 0, accurateEstimates: 0 } };
  } catch {
    return { tasks: {}, overall: { totalTasks: 0, accurateEstimates: 0 } };
  }
}

/**
 * שמירת היסטוריית למידה
 */
function saveLearningData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

/**
 * חישוב הערכה מומלצת לפי היסטוריה
 */
function getSuggestedDuration(taskType, estimatedDuration, learningData) {
  const typeData = learningData.tasks[taskType];
  if (!typeData || typeData.samples.length < 3) {
    // אין מספיק נתונים - הצע את הממוצע של מה שקרה
    return null;
  }

  // ממוצע משוקלל של הזמנים האמיתיים
  const avgActual = typeData.samples.reduce((sum, s) => sum + s.actual, 0) / typeData.samples.length;
  const avgEstimated = typeData.samples.reduce((sum, s) => sum + s.estimated, 0) / typeData.samples.length;
  
  // יחס תיקון
  const correctionRatio = avgActual / avgEstimated;
  
  // הצעה מתוקנת
  return Math.round(estimatedDuration * correctionRatio / 5) * 5; // עיגול ל-5 דקות
}

/**
 * פורמט זמן
 */
function formatDuration(minutes) {
  if (!minutes) return '0 דקות';
  if (minutes < 60) return `${minutes} דקות`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return hours === 1 ? 'שעה' : `${hours} שעות`;
  return `${hours}:${mins.toString().padStart(2, '0')}`;
}

/**
 * חישוב אחוז דיוק
 */
function getAccuracyPercent(estimated, actual) {
  if (!estimated || !actual) return 0;
  const ratio = Math.min(estimated, actual) / Math.max(estimated, actual);
  return Math.round(ratio * 100);
}

function TaskCompletionFeedback({ 
  task, 
  actualMinutes,
  onClose, 
  onSave,
  addPoints 
}) {
  const [step, setStep] = useState(1); // 1 = השוואה, 2 = סיבה, 3 = סיכום
  const [selectedReason, setSelectedReason] = useState(null);
  const [customReason, setCustomReason] = useState('');
  const [adjustedEstimate, setAdjustedEstimate] = useState(actualMinutes);
  const [learningData, setLearningData] = useState(loadLearningData);

  const estimatedMinutes = task.estimated_duration || 30;
  const diff = actualMinutes - estimatedMinutes;
  const diffPercent = Math.round((diff / estimatedMinutes) * 100);
  const isOverrun = diff > 5; // יותר מ-5 דקות מעל ההערכה
  const isUnderrun = diff < -5; // יותר מ-5 דקות מתחת להערכה
  const isAccurate = !isOverrun && !isUnderrun;
  const accuracyPercent = getAccuracyPercent(estimatedMinutes, actualMinutes);

  const taskType = task.task_type || 'other';
  const taskTypeInfo = TASK_TYPES?.[taskType] || { icon: '📌', name: 'משימה' };

  // הצעה מהמערכת
  const suggestedDuration = getSuggestedDuration(taskType, estimatedMinutes, learningData);

  // שמירת הנתונים
  const handleSave = () => {
    const newLearningData = { ...learningData };
    
    // עדכון נתוני סוג המשימה
    if (!newLearningData.tasks[taskType]) {
      newLearningData.tasks[taskType] = { samples: [], avgRatio: 1 };
    }
    
    newLearningData.tasks[taskType].samples.push({
      estimated: estimatedMinutes,
      actual: actualMinutes,
      reason: selectedReason,
      date: new Date().toISOString(),
      taskTitle: task.title
    });

    // שמור רק 20 דגימות אחרונות
    if (newLearningData.tasks[taskType].samples.length > 20) {
      newLearningData.tasks[taskType].samples = 
        newLearningData.tasks[taskType].samples.slice(-20);
    }

    // עדכון סטטיסטיקות כלליות
    newLearningData.overall.totalTasks++;
    if (isAccurate) {
      newLearningData.overall.accurateEstimates++;
    }

    saveLearningData(newLearningData);
    setLearningData(newLearningData);

    // נקודות על דיוק
    if (isAccurate && addPoints) {
      addPoints(10, 'הערכת זמן מדויקת');
    }

    // העברת הנתונים הלאה
    onSave?.({
      taskId: task.id,
      estimated: estimatedMinutes,
      actual: actualMinutes,
      reason: selectedReason,
      customReason,
      suggestedNext: adjustedEstimate,
      isAccurate
    });

    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        >
          {/* כותרת */}
          <div className={`p-6 text-center ${
            isAccurate ? 'bg-green-50 dark:bg-green-900/30' :
            isOverrun ? 'bg-orange-50 dark:bg-orange-900/30' :
            'bg-blue-50 dark:bg-blue-900/30'
          }`}>
            <div className="text-4xl mb-2">
              {isAccurate ? '🎯' : isOverrun ? '⏰' : '⚡'}
            </div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-white">
              {isAccurate ? 'הערכה מדויקת!' : isOverrun ? 'לקח יותר זמן' : 'סיימת מהר!'}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {task.title}
            </p>
          </div>

          {/* תוכן */}
          <div className="p-6 space-y-6">
            {/* שלב 1: השוואת זמנים */}
            {step === 1 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                {/* השוואה ויזואלית */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">תכננת</div>
                    <div className="text-2xl font-bold text-gray-800 dark:text-white">
                      {formatDuration(estimatedMinutes)}
                    </div>
                  </div>
                  <div className={`text-center p-4 rounded-xl ${
                    isAccurate ? 'bg-green-50 dark:bg-green-900/30' :
                    isOverrun ? 'bg-orange-50 dark:bg-orange-900/30' :
                    'bg-blue-50 dark:bg-blue-900/30'
                  }`}>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">בפועל</div>
                    <div className={`text-2xl font-bold ${
                      isAccurate ? 'text-green-600 dark:text-green-400' :
                      isOverrun ? 'text-orange-600 dark:text-orange-400' :
                      'text-blue-600 dark:text-blue-400'
                    }`}>
                      {formatDuration(actualMinutes)}
                    </div>
                  </div>
                </div>

                {/* הפרש */}
                {!isAccurate && (
                  <div className="text-center py-2">
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
                      isOverrun 
                        ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' 
                        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                    }`}>
                      {isOverrun ? '📈' : '📉'} {isOverrun ? '+' : ''}{diff} דקות ({diffPercent > 0 ? '+' : ''}{diffPercent}%)
                    </span>
                  </div>
                )}

                {/* דיוק */}
                <div className="text-center">
                  <div className="text-sm text-gray-500 mb-2">דיוק ההערכה</div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                    <div 
                      className={`h-3 rounded-full transition-all ${
                        accuracyPercent >= 80 ? 'bg-green-500' :
                        accuracyPercent >= 60 ? 'bg-yellow-500' :
                        'bg-orange-500'
                      }`}
                      style={{ width: `${accuracyPercent}%` }}
                    />
                  </div>
                  <div className="text-lg font-bold mt-1">{accuracyPercent}%</div>
                </div>

                <button
                  onClick={() => isAccurate ? handleSave() : setStep(2)}
                  className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
                >
                  {isAccurate ? '✅ מעולה! סגור' : '➡️ המשך'}
                </button>
              </motion.div>
            )}

            {/* שלב 2: סיבה */}
            {step === 2 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                <h3 className="font-medium text-gray-700 dark:text-gray-300 text-center">
                  {isOverrun ? 'למה לקח יותר זמן?' : 'למה סיימת מוקדם?'}
                </h3>

                <div className="grid grid-cols-1 gap-2">
                  {(isOverrun ? OVERRUN_REASONS : UNDERRUN_REASONS).map(reason => (
                    <button
                      key={reason.id}
                      onClick={() => setSelectedReason(reason.id)}
                      className={`p-3 rounded-xl text-right flex items-center gap-3 transition-all ${
                        selectedReason === reason.id
                          ? 'bg-indigo-100 dark:bg-indigo-900/30 border-2 border-indigo-500'
                          : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border-2 border-transparent'
                      }`}
                    >
                      <span className="text-xl">{reason.icon}</span>
                      <span className="text-sm">{reason.label}</span>
                    </button>
                  ))}
                </div>

                {selectedReason === 'other' && (
                  <input
                    type="text"
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder="פרטי..."
                    className="w-full p-3 border rounded-xl dark:bg-gray-700 dark:border-gray-600"
                    autoFocus
                  />
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => setStep(1)}
                    className="flex-1 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  >
                    ← חזרה
                  </button>
                  <button
                    onClick={() => setStep(3)}
                    disabled={!selectedReason}
                    className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  >
                    ➡️ המשך
                  </button>
                </div>
              </motion.div>
            )}

            {/* שלב 3: סיכום והצעה */}
            {step === 3 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                <div className="p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl text-center">
                  <div className="text-sm text-indigo-600 dark:text-indigo-400 mb-2">
                    💡 למדתי מהמשימה הזו
                  </div>
                  <p className="text-gray-700 dark:text-gray-300">
                    בפעם הבאה, {taskTypeInfo.name} דומה יקח כנראה:
                  </p>
                  <div className="flex items-center justify-center gap-2 mt-3">
                    <button
                      onClick={() => setAdjustedEstimate(Math.max(5, adjustedEstimate - 5))}
                      className="w-10 h-10 rounded-full bg-white dark:bg-gray-700 shadow hover:bg-gray-100 dark:hover:bg-gray-600"
                    >
                      -
                    </button>
                    <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 w-24 text-center">
                      {formatDuration(adjustedEstimate)}
                    </span>
                    <button
                      onClick={() => setAdjustedEstimate(adjustedEstimate + 5)}
                      className="w-10 h-10 rounded-full bg-white dark:bg-gray-700 shadow hover:bg-gray-100 dark:hover:bg-gray-600"
                    >
                      +
                    </button>
                  </div>
                  {suggestedDuration && suggestedDuration !== adjustedEstimate && (
                    <button
                      onClick={() => setAdjustedEstimate(suggestedDuration)}
                      className="mt-2 text-xs text-indigo-500 hover:underline"
                    >
                      המערכת מציעה: {formatDuration(suggestedDuration)}
                    </button>
                  )}
                </div>

                {/* סטטיסטיקת דיוק כללית */}
                {learningData.overall.totalTasks > 0 && (
                  <div className="text-center text-sm text-gray-500 dark:text-gray-400">
                    📊 הדיוק הכללי שלך: {Math.round((learningData.overall.accurateEstimates / learningData.overall.totalTasks) * 100)}%
                    <span className="text-xs block">({learningData.overall.accurateEstimates}/{learningData.overall.totalTasks} הערכות מדויקות)</span>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => setStep(2)}
                    className="flex-1 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  >
                    ← חזרה
                  </button>
                  <button
                    onClick={handleSave}
                    className="flex-1 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors"
                  >
                    ✅ שמור וסגור
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default TaskCompletionFeedback;
