import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * מערכת בלת"מים חכמה
 * ==================
 * 
 * כשמגיע בלת"ם:
 * 1. הטיימר הנוכחי נעצר
 * 2. כל המשימות הנותרות נדחות
 * 3. אם לא נכנסות - מוצע להעביר למחר
 */

/**
 * מודל בלת"ם - קופץ כשלוחצים על "הפרעה"
 */
function InterruptionModal({
  isOpen,
  onClose,
  currentTask,           // המשימה שעבדו עליה
  remainingBlocks,       // כל הבלוקים שנשארו היום
  currentMinutes,        // השעה הנוכחית (בדקות מ-00:00)
  endOfDayMinutes = 960, // סוף יום העבודה (16:00 = 960)
  onApplyInterruption    // callback עם התוצאה
}) {
  const [interruptionDuration, setInterruptionDuration] = useState(30);
  const [selectedAction, setSelectedAction] = useState('push'); // push | moveAll | selectMove
  const [tasksToMove, setTasksToMove] = useState([]);
  
  if (!isOpen) return null;
  
  // חישוב מה יקרה
  const minutesLeftToday = endOfDayMinutes - currentMinutes;
  const totalRemainingWork = remainingBlocks.reduce((sum, b) => sum + (b.duration || 30), 0);
  const minutesAfterInterruption = minutesLeftToday - interruptionDuration;
  const willOverflow = totalRemainingWork > minutesAfterInterruption;
  const overflowMinutes = totalRemainingWork - minutesAfterInterruption;
  
  // פורמט דקות
  const formatTime = (minutes) => {
    if (minutes < 60) return `${minutes} דק'`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}:${String(mins).padStart(2, '0')}` : `${hours} שעות`;
  };
  
  // חישוב כמה משימות להעביר למחר
  const calculateTasksToMove = () => {
    if (!willOverflow) return [];
    
    // מתחילים מהסוף - משימות עם עדיפות נמוכה יותר קודם
    const sorted = [...remainingBlocks].sort((a, b) => {
      const priorityOrder = { urgent: 3, high: 2, normal: 1 };
      return (priorityOrder[a.priority] || 1) - (priorityOrder[b.priority] || 1);
    });
    
    let minutesToFree = overflowMinutes;
    const toMove = [];
    
    for (const block of sorted) {
      if (minutesToFree <= 0) break;
      toMove.push(block);
      minutesToFree -= (block.duration || 30);
    }
    
    return toMove;
  };
  
  // הפעלת הבלת"ם
  const handleApply = () => {
    const result = {
      interruptionDuration,
      action: selectedAction,
      tasksToMove: selectedAction === 'push' 
        ? [] 
        : selectedAction === 'moveAll'
          ? calculateTasksToMove()
          : tasksToMove
    };
    
    onApplyInterruption(result);
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
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full shadow-xl"
        >
          {/* כותרת */}
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">⚡</span>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                בלת"ם!
              </h3>
              <p className="text-sm text-gray-500">
                {currentTask ? `עוצר את "${currentTask.title}"` : 'הפרעה בזמן העבודה'}
              </p>
            </div>
          </div>
          
          {/* משך הבלת"ם */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              כמה זמן ייקח?
            </label>
            <div className="flex gap-2">
              {[15, 30, 45, 60, 90].map(mins => (
                <button
                  key={mins}
                  onClick={() => setInterruptionDuration(mins)}
                  className={`
                    flex-1 py-2 rounded-lg text-sm font-medium transition-colors
                    ${interruptionDuration === mins
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }
                  `}
                >
                  {mins < 60 ? `${mins}'` : `${mins/60}ש'`}
                </button>
              ))}
            </div>
            
            {/* קלט חופשי */}
            <div className="flex items-center gap-2 mt-2">
              <span className="text-sm text-gray-500">או:</span>
              <input
                type="number"
                value={interruptionDuration}
                onChange={(e) => setInterruptionDuration(parseInt(e.target.value) || 15)}
                className="w-20 px-2 py-1 border rounded text-center dark:bg-gray-700 dark:border-gray-600"
                min="5"
                max="240"
              />
              <span className="text-sm text-gray-500">דקות</span>
            </div>
          </div>
          
          {/* תוצאה צפויה */}
          <div className={`p-4 rounded-xl mb-4 ${
            willOverflow 
              ? 'bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800'
              : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
          }`}>
            <div className="flex items-start gap-2">
              <span className="text-xl">{willOverflow ? '⚠️' : '✅'}</span>
              <div>
                {willOverflow ? (
                  <>
                    <p className="font-medium text-orange-700 dark:text-orange-300">
                      לא יספיק! חסרות {formatTime(overflowMinutes)}
                    </p>
                    <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">
                      נשארו {formatTime(minutesAfterInterruption)} ויש עבודה של {formatTime(totalRemainingWork)}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-medium text-green-700 dark:text-green-300">
                      הכל ייכנס!
                    </p>
                    <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                      נשארו {formatTime(minutesAfterInterruption)} ויש עבודה של {formatTime(totalRemainingWork)}
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
          
          {/* אפשרויות אם יש גלישה */}
          {willOverflow && (
            <div className="space-y-2 mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                מה לעשות?
              </label>
              
              <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
                <input
                  type="radio"
                  name="action"
                  value="push"
                  checked={selectedAction === 'push'}
                  onChange={() => setSelectedAction('push')}
                  className="mt-1"
                />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">דחוף הכל</p>
                  <p className="text-sm text-gray-500">המשימות יידחו וחלקן יגלשו מעבר ל-16:00</p>
                </div>
              </label>
              
              <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
                <input
                  type="radio"
                  name="action"
                  value="moveAll"
                  checked={selectedAction === 'moveAll'}
                  onChange={() => setSelectedAction('moveAll')}
                  className="mt-1"
                />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">העבר אוטומטית למחר</p>
                  <p className="text-sm text-gray-500">
                    {calculateTasksToMove().length} משימות יועברו למחר (לפי עדיפות נמוכה)
                  </p>
                </div>
              </label>
              
              <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
                <input
                  type="radio"
                  name="action"
                  value="selectMove"
                  checked={selectedAction === 'selectMove'}
                  onChange={() => setSelectedAction('selectMove')}
                  className="mt-1"
                />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">אני אבחר מה להעביר</p>
                  <p className="text-sm text-gray-500">בחרי אילו משימות להעביר למחר</p>
                </div>
              </label>
            </div>
          )}
          
          {/* בחירת משימות להעברה */}
          {selectedAction === 'selectMove' && willOverflow && (
            <div className="mb-4 max-h-40 overflow-y-auto border rounded-lg dark:border-gray-700">
              {remainingBlocks.map(block => (
                <label 
                  key={block.id || block.taskId}
                  className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer border-b dark:border-gray-700 last:border-b-0"
                >
                  <input
                    type="checkbox"
                    checked={tasksToMove.some(t => (t.id || t.taskId) === (block.id || block.taskId))}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setTasksToMove([...tasksToMove, block]);
                      } else {
                        setTasksToMove(tasksToMove.filter(t => 
                          (t.id || t.taskId) !== (block.id || block.taskId)
                        ));
                      }
                    }}
                  />
                  <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">
                    {block.title}
                  </span>
                  <span className="text-xs text-gray-400">
                    {block.duration || 30} דק'
                  </span>
                </label>
              ))}
            </div>
          )}
          
          {/* כפתורים */}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              ביטול
            </button>
            <button
              onClick={handleApply}
              className="flex-1 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium"
            >
              ⚡ הפעל בלת"ם
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * כפתור בלת"ם קטן (לכרטיס משימה)
 */
export function InterruptionButton({ onClick, small = false }) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-1 text-orange-600 hover:text-orange-700 
        dark:text-orange-400 dark:hover:text-orange-300 transition-colors
        ${small ? 'text-xs' : 'text-sm'}
      `}
      title="בלת״ם / הפרעה"
    >
      <span>⚡</span>
      {!small && <span>הפרעה</span>}
    </button>
  );
}

export default InterruptionModal;
