import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDuration } from '../../config/workSchedule';

/**
 * 🏁 TimerEndDialog - מודאל בסיום טיימר
 * 
 * במקום לסמן את המשימה כהושלמה אוטומטית,
 * שואל את המשתמשת מה קרה
 */

const OPTIONS = [
  { 
    id: 'completed', 
    icon: '✅', 
    label: 'סיימתי את המשימה!',
    color: 'bg-green-500 hover:bg-green-600',
    action: 'complete'
  },
  { 
    id: 'need_more', 
    icon: '🔄', 
    label: 'צריכה עוד זמן',
    color: 'bg-blue-500 hover:bg-blue-600',
    action: 'extend'
  },
  { 
    id: 'partial', 
    icon: '📊', 
    label: 'התקדמתי חלקית',
    color: 'bg-orange-500 hover:bg-orange-600',
    action: 'partial'
  },
  { 
    id: 'stuck', 
    icon: '😵', 
    label: 'נתקעתי / לא התקדמתי',
    color: 'bg-red-500 hover:bg-red-600',
    action: 'stuck'
  },
];

const EXTEND_OPTIONS = [
  { minutes: 5, label: '5 דקות' },
  { minutes: 15, label: '15 דקות' },
  { minutes: 30, label: '30 דקות' },
  { minutes: 45, label: '45 דקות' },
];

function TimerEndDialog({ 
  isOpen, 
  task, 
  elapsedTime, // זמן שעבר בדקות
  onComplete,  // סיום מלא
  onExtend,    // הארכה
  onPartial,   // התקדמות חלקית
  onStuck,     // נתקע
  onDismiss 
}) {
  const [showExtendOptions, setShowExtendOptions] = useState(false);
  const [showPartialInput, setShowPartialInput] = useState(false);
  const [progressPercent, setProgressPercent] = useState(50);

  if (!isOpen || !task) return null;

  const handleOptionClick = (option) => {
    switch (option.action) {
      case 'complete':
        onComplete?.();
        break;
      case 'extend':
        setShowExtendOptions(true);
        break;
      case 'partial':
        setShowPartialInput(true);
        break;
      case 'stuck':
        onStuck?.();
        break;
    }
  };

  const handleExtend = (minutes) => {
    onExtend?.(minutes);
  };

  const handlePartialSubmit = () => {
    onPartial?.(progressPercent);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      >
        <motion.div
          initial={{ scale: 0.8, y: 50 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.8, y: 50 }}
          className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden"
        >
          {/* כותרת */}
          <div className="p-6 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-center">
            <div className="text-5xl mb-3">⏱️</div>
            <h2 className="text-xl font-bold">הזמן נגמר!</h2>
            <p className="text-purple-100 text-sm mt-1">{task.title}</p>
            <div className="mt-2 text-lg font-medium">
              עבדת {formatDuration(elapsedTime)}
            </div>
          </div>

          {/* תוכן */}
          <div className="p-6">
            {/* מסך ראשי - בחירת אופציה */}
            {!showExtendOptions && !showPartialInput && (
              <>
                <p className="text-center text-gray-600 dark:text-gray-400 mb-4">
                  איך הלך?
                </p>
                
                <div className="space-y-3">
                  {OPTIONS.map(option => (
                    <button
                      key={option.id}
                      onClick={() => handleOptionClick(option)}
                      className={`w-full p-4 ${option.color} text-white rounded-xl flex items-center gap-3 transition-all transform hover:scale-[1.02]`}
                    >
                      <span className="text-2xl">{option.icon}</span>
                      <span className="flex-1 text-right font-medium">{option.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* מסך הארכה */}
            {showExtendOptions && (
              <>
                <button
                  onClick={() => setShowExtendOptions(false)}
                  className="mb-4 text-gray-500 hover:text-gray-700 flex items-center gap-1"
                >
                  → חזרה
                </button>
                
                <p className="text-center text-gray-600 dark:text-gray-400 mb-4">
                  כמה זמן נוסף?
                </p>
                
                <div className="grid grid-cols-2 gap-3">
                  {EXTEND_OPTIONS.map(opt => (
                    <button
                      key={opt.minutes}
                      onClick={() => handleExtend(opt.minutes)}
                      className="p-4 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-xl font-medium transition-colors"
                    >
                      +{opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* מסך התקדמות חלקית */}
            {showPartialInput && (
              <>
                <button
                  onClick={() => setShowPartialInput(false)}
                  className="mb-4 text-gray-500 hover:text-gray-700 flex items-center gap-1"
                >
                  → חזרה
                </button>
                
                <p className="text-center text-gray-600 dark:text-gray-400 mb-4">
                  כמה אחוז השלמת?
                </p>
                
                <div className="mb-6">
                  <input
                    type="range"
                    min="10"
                    max="90"
                    step="10"
                    value={progressPercent}
                    onChange={(e) => setProgressPercent(Number(e.target.value))}
                    className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="text-center text-3xl font-bold text-orange-500 mt-2">
                    {progressPercent}%
                  </div>
                </div>
                
                <button
                  onClick={handlePartialSubmit}
                  className="w-full p-4 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium"
                >
                  שמור התקדמות
                </button>
              </>
            )}

            {/* כפתור סגירה */}
            {!showExtendOptions && !showPartialInput && (
              <button
                onClick={onDismiss}
                className="w-full mt-4 py-2 text-gray-400 text-sm"
              >
                סגור בלי לשמור
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default TimerEndDialog;
