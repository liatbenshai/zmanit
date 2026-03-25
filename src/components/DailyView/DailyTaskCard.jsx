import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTasks } from '../../hooks/useTasks';
import toast from 'react-hot-toast';
import TaskTimerWithInterruptions from '../Tasks/TaskTimerWithInterruptions';
import { getTaskType, getAllTaskTypes } from '../../config/taskTypes';
import { recordTaskCompletion } from '../../utils/taskLearning';
import ConfirmDialog from '../UI/ConfirmDialog';
import BlockerLogModal from '../Learning/BlockerLogModal'; // ✅ לוג חסמים
import { useNavigate } from 'react-router-dom';

// קבלת TASK_TYPES מ-config (לתאימות לאחור)
const TASK_TYPES = getAllTaskTypes();

/**
 * בדיקה אם ID הוא UUID תקין
 */
function isValidUUID(id) {
  if (!id || typeof id !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * בדיקה אם זה בלוק וירטואלי (לא משימה אמיתית ב-DB)
 */
function isVirtualBlock(id) {
  return !isValidUUID(id);
}

/**
 * קבלת מפתח localStorage להשלמת בלוק וירטואלי
 */
function getVirtualBlockKey(id, date) {
  const dateStr = date || new Date().toISOString().split('T')[0];
  return `virtual_block_completed_${id}_${dateStr}`;
}

/**
 * קבלת תאריך מחר בפורמט ISO
 */
function getTomorrowISO() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const year = tomorrow.getFullYear();
  const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const day = String(tomorrow.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * מודל משוב בסיום משימה
 */
function CompletionFeedbackModal({ isOpen, onClose, task, actualMinutes, onConfirm }) {
  const [correctedMinutes, setCorrectedMinutes] = useState(actualMinutes);
  const [showCorrection, setShowCorrection] = useState(false);
  
  useEffect(() => {
    setCorrectedMinutes(actualMinutes);
    setShowCorrection(false);
  }, [actualMinutes, isOpen]);
  
  if (!isOpen || !task) return null;
  
  const estimatedMinutes = task.estimated_duration || 0;
  const diff = actualMinutes - estimatedMinutes;
  const diffPercent = estimatedMinutes > 0 ? Math.round((diff / estimatedMinutes) * 100) : 0;
  
  const formatTime = (minutes) => {
    if (minutes < 60) return `${minutes} דק'`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return `${hours} שעות`;
    return `${hours}:${String(mins).padStart(2, '0')}`;
  };
  
  const handleConfirm = () => {
    if (task.task_type && estimatedMinutes > 0) {
      recordTaskCompletion(
        task.task_type,
        estimatedMinutes,
        showCorrection ? correctedMinutes : actualMinutes,
        task.title
      );
    }
    onConfirm(showCorrection ? correctedMinutes : actualMinutes);
    onClose();
  };
  
  const handleSkip = () => {
    onConfirm(actualMinutes);
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
            <div className="text-center mb-4">
              <span className="text-4xl mb-2 block">✅</span>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                סיימת את "{task.title}"!
              </h3>
            </div>
            
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
              
              {estimatedMinutes > 0 && diff !== 0 && (
                <div className={`text-center mt-3 py-2 rounded-lg ${
                  diff > 0 
                    ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                    : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                }`}>
                  {diff > 0 ? (
                    <span>לקח {formatTime(Math.abs(diff))} יותר (+{diffPercent}%)</span>
                  ) : (
                    <span>סיימת {formatTime(Math.abs(diff))} מהר יותר! 🎉</span>
                  )}
                </div>
              )}
            </div>
            
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
            
            <div className="flex gap-2">
              <button
                onClick={handleSkip}
                className="flex-1 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                דלג
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
              >
                {showCorrection ? 'שמור תיקון' : 'אישור ✓'}
              </button>
            </div>
            
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-3">
              💡 הנתונים עוזרים למערכת ללמוד ולהציע הערכות מדויקות יותר
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * כרטיס משימה לתצוגה יומית
 * ✅ עם תמיכה בגרירה, משוב בסיום, והעברה למחר
 * ✅ כפתור התחל במיקוד
 */
function DailyTaskCard({ task, onEdit, onUpdate, onDragStart, onDragEnd, draggable = false }) {
  const { toggleComplete, removeTask, editTask, tasks } = useTasks();
  const navigate = useNavigate();
  const [showTimer, setShowTimer] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [liveSpent, setLiveSpent] = useState(task.time_spent || 0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [virtualCompleted, setVirtualCompleted] = useState(false);
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const [showBlockerModal, setShowBlockerModal] = useState(false); // ✅ לוג חסמים
  const [pendingMove, setPendingMove] = useState(null); // ✅ פעולה ממתינה
  const [showTimeEdit, setShowTimeEdit] = useState(false); // ✅ עריכת שעה מהירה
  const [editingTime, setEditingTime] = useState(task.due_time || ''); // ✅ שעה בעריכה

  const currentTask = task;
  const isVirtual = isVirtualBlock(currentTask.id);
  const originalTask = tasks.find(t => t.id === task.id);
  
  // קבלת סוג המשימה מהקונפיג המשודרג
  const taskType = getTaskType(currentTask.task_type) || { icon: '📋', name: 'אחר' };
  const isBlock = currentTask.blockIndex !== undefined && currentTask.totalBlocks > 1;
  const timerStorageKey = currentTask.id ? `timer_v2_${currentTask.id}` : null;
  
  useEffect(() => {
    if (isVirtual) {
      const key = getVirtualBlockKey(currentTask.id);
      const saved = localStorage.getItem(key);
      setVirtualCompleted(saved === 'true');
    }
  }, [isVirtual, currentTask.id]);

  useEffect(() => {
    setLiveSpent(task.time_spent || 0);
  }, [task.time_spent]);

  useEffect(() => {
    if (!timerStorageKey) return;

    const checkTimerState = () => {
      try {
        const saved = localStorage.getItem(timerStorageKey);
        if (saved) {
          const data = JSON.parse(saved);
          if (data.isRunning && data.startTime && !data.isInterrupted) {
            const startTime = new Date(data.startTime);
            const now = new Date();
            const elapsedSeconds = Math.floor((now - startTime) / 1000) - (data.totalInterruptionSeconds || 0);
            const elapsedMinutes = Math.floor(Math.max(0, elapsedSeconds) / 60);
            const baseTimeSpent = task.time_spent || 0;
            
            setLiveSpent(baseTimeSpent + elapsedMinutes);
            setIsTimerRunning(true);
          } else {
            setIsTimerRunning(false);
          }
        }
      } catch (e) {
        console.error('Error reading timer state:', e);
      }
    };

    checkTimerState();
    const interval = setInterval(checkTimerState, 1000);
    return () => clearInterval(interval);
  }, [timerStorageKey, task.time_spent]);

  const handleTimerUpdate = useCallback((newSpent, running) => {
    setLiveSpent(newSpent);
    setIsTimerRunning(running);
  }, []);

  const formatMinutes = (minutes) => {
    if (minutes < 60) return `${minutes} דק'`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}:${mins.toString().padStart(2, '0')}` : `${hours} שעות`;
  };

  // ✅ העברה למחר - עם שאלת חסמים
  const handleMoveToTomorrow = async () => {
    if (isVirtual) {
      toast.error('לא ניתן להעביר בלוק קבוע');
      return;
    }
    
    // הצגת מודל חסמים לפני ההעברה
    setPendingMove({ type: 'tomorrow' });
    setShowBlockerModal(true);
    setShowMoveMenu(false);
  };
  
  // ✅ ביצוע ההעברה בפועל (אחרי מודל החסמים)
  const executeMoveToTomorrow = async () => {
    try {
      await editTask(currentTask.id, {
        due_date: getTomorrowISO(),
        due_time: null // איפוס השעה - יתוזמן מחדש
      });
      toast.success('📅 המשימה הועברה למחר');
      if (onUpdate) onUpdate();
    } catch (err) {
      toast.error('שגיאה בהעברת המשימה');
    }
  };
  
  // ✅ סגירת מודל חסמים וביצוע הפעולה
  const handleBlockerModalClose = () => {
    setShowBlockerModal(false);
    if (pendingMove?.type === 'tomorrow') {
      executeMoveToTomorrow();
    } else if (pendingMove?.type === 'date') {
      executeMoveToDate(pendingMove.days);
    }
    setPendingMove(null);
  };

  // ✅ העברה לתאריך ספציפי - עם שאלת חסמים
  const handleMoveToDate = (daysFromNow) => {
    if (isVirtual) return;
    
    // הצגת מודל חסמים לפני ההעברה
    setPendingMove({ type: 'date', days: daysFromNow });
    setShowBlockerModal(true);
    setShowMoveMenu(false);
  };
  
  // ✅ ביצוע העברה לתאריך בפועל
  const executeMoveToDate = async (daysFromNow) => {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysFromNow);
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const dateISO = `${year}-${month}-${day}`;
    
    try {
      await editTask(currentTask.id, {
        due_date: dateISO,
        due_time: null
      });
      toast.success(`📅 המשימה הועברה ל-${day}/${month}`);
      if (onUpdate) onUpdate();
    } catch (err) {
      toast.error('שגיאה בהעברת המשימה');
    }
  };

  const handleToggleComplete = async (e) => {
    if (e) e.stopPropagation();
    
    if (isVirtual) {
      const newCompleted = !virtualCompleted;
      setVirtualCompleted(newCompleted);
      const key = getVirtualBlockKey(currentTask.id);
      localStorage.setItem(key, newCompleted.toString());
      if (newCompleted) {
        toast.success('✅ הבלוק הושלם!');
      } else {
        toast.success('הבלוק הוחזר לפעיל');
      }
      if (onUpdate) onUpdate();
      return;
    }
    
    if (currentTask.is_completed) {
      try {
        await toggleComplete(currentTask.id);
        toast.success('המשימה הוחזרה לפעילה');
        if (onUpdate) onUpdate();
      } catch (err) {
        toast.error('שגיאה בעדכון');
      }
      return;
    }
    
    const hasEstimate = currentTask.estimated_duration && currentTask.estimated_duration > 0;
    const hasTimeSpent = liveSpent > 0;
    
    if (hasEstimate && hasTimeSpent) {
      setShowFeedback(true);
    } else {
      await completeTask();
    }
  };
  
  const completeTask = async (finalTimeSpent) => {
    try {
      await toggleComplete(currentTask.id);
      
      const timeUsed = finalTimeSpent || liveSpent;
      const estimated = currentTask.estimated_duration || 0;
      
      if (timeUsed < estimated && estimated > 0) {
        const saved = estimated - timeUsed;
        toast.success(
          `🎉 סיימת מוקדם! חסכת ${formatMinutes(saved)}`,
          { duration: 4000 }
        );
      } else if (timeUsed > estimated * 1.2 && estimated > 0) {
        const extra = timeUsed - estimated;
        toast(
          `✅ הושלם! לקח ${formatMinutes(extra)} יותר מהצפוי`,
          { icon: '⏰', duration: 4000 }
        );
      } else {
        toast.success('✅ המשימה הושלמה!');
      }
      
      if (onUpdate) onUpdate();
    } catch (err) {
      toast.error('שגיאה בעדכון');
    }
  };

  const handleDelete = async (e) => {
    e.stopPropagation();
    
    if (isVirtual) {
      toast.error('לא ניתן למחוק בלוק קבוע');
      return;
    }
    
    setShowDeleteConfirm(true);
  };
  
  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await removeTask(currentTask.id);
      toast.success('המשימה נמחקה');
      setShowDeleteConfirm(false);
    } catch (err) {
      toast.error('שגיאה במחיקה');
      setDeleting(false);
    }
  };

  const estimated = currentTask.estimated_duration || 0;
  const spent = liveSpent;
  const progress = estimated > 0 ? Math.min(100, Math.round((spent / estimated) * 100)) : 0;
  const isOverTime = spent > estimated && estimated > 0;
  const isCompleted = isVirtual ? virtualCompleted : currentTask.is_completed;

  const displayTitle = (isBlock && !currentTask.title.includes('/'))
    ? `${currentTask.title} (${currentTask.blockIndex}/${currentTask.totalBlocks})`
    : currentTask.title;

  return (
    <>
      <motion.div
        layout
        draggable={draggable && !isCompleted}
        onDragStart={(e) => {
          if (draggable && onDragStart && !isCompleted) {
            onDragStart(currentTask, e);
          }
        }}
        onDragEnd={() => {
          if (draggable && onDragEnd) {
            onDragEnd();
          }
        }}
        className={`
          card p-4 transition-all duration-200 relative
          ${isCompleted ? 'opacity-60' : ''}
          ${deleting ? 'opacity-50 scale-95' : ''}
          ${isOverTime ? 'border-l-4 border-l-red-500' : ''}
          ${draggable && !isCompleted ? 'cursor-grab active:cursor-grabbing hover:shadow-lg' : ''}
        `}
      >
        <div className="flex items-start gap-3">
          {/* כפתור סימון */}
          <button
            onClick={handleToggleComplete}
            className={`
              flex-shrink-0 w-6 h-6 rounded-full border-2 mt-0.5
              transition-all duration-200 flex items-center justify-center
              ${isCompleted 
                ? 'bg-green-500 border-green-500 text-white' 
                : 'border-gray-300 dark:border-gray-600 hover:border-green-500'
              }
            `}
          >
            {isCompleted && (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>

          {/* תוכן */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-lg">{taskType.icon}</span>
              <h3 className={`
                font-medium text-gray-900 dark:text-white
                ${isCompleted ? 'line-through text-gray-500' : ''}
              `}>
                {displayTitle}
              </h3>
              {currentTask.isPostponed && (
                <span className="text-xs px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-full">
                  🔄 נדחה
                </span>
              )}
              {currentTask.priority === 'urgent' && !currentTask.isPostponed && (
                <span className="text-xs px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full">
                  🔴 דחוף
                </span>
              )}
              {currentTask.priority === 'high' && (
                <span className="text-xs px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded-full">
                  🟠 גבוה
                </span>
              )}
              
              {/* ✅ תצוגת/עריכת שעה - לחיצה לעריכה */}
              {(currentTask.startTime || currentTask.due_time) && !showTimeEdit && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingTime(currentTask.due_time || currentTask.startTime || '');
                    setShowTimeEdit(true);
                  }}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 px-2 py-0.5 rounded transition-colors"
                  dir="ltr"
                  title="לחצי לשינוי השעה"
                >
                  🕐 {currentTask.startTime && currentTask.endTime 
                    ? `${currentTask.startTime} - ${currentTask.endTime}`
                    : currentTask.due_time}
                </button>
              )}
              
              {/* ✅ עריכת שעה מהירה */}
              {showTimeEdit && (
                <div className="flex items-center gap-1 bg-white dark:bg-gray-800 border border-blue-300 dark:border-blue-600 rounded-lg p-1 shadow-lg">
                  <input
                    type="time"
                    value={editingTime}
                    onChange={(e) => setEditingTime(e.target.value)}
                    className="px-2 py-1 text-sm border-0 bg-transparent focus:outline-none"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      try {
                        await editTask(currentTask.id, { due_time: editingTime || null });
                        toast.success(editingTime ? `⏰ השעה עודכנה ל-${editingTime}` : '🔓 השעה הוסרה');
                        setShowTimeEdit(false);
                        if (onUpdate) onUpdate();
                      } catch (err) {
                        toast.error('שגיאה בעדכון');
                      }
                    }}
                    className="p-1 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded"
                    title="שמור"
                  >
                    ✓
                  </button>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      try {
                        await editTask(currentTask.id, { due_time: null });
                        toast.success('🔓 השעה הוסרה - המשימה גמישה');
                        setShowTimeEdit(false);
                        if (onUpdate) onUpdate();
                      } catch (err) {
                        toast.error('שגיאה');
                      }
                    }}
                    className="p-1 text-purple-600 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded"
                    title="הסר שעה"
                  >
                    🔓
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowTimeEdit(false);
                    }}
                    className="p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                    title="ביטול"
                  >
                    ✕
                  </button>
                </div>
              )}
              
              {/* ✅ כפתור להוספת שעה אם אין */}
              {!currentTask.startTime && !currentTask.due_time && !showTimeEdit && !isCompleted && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingTime('09:00');
                    setShowTimeEdit(true);
                  }}
                  className="text-xs text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 px-2 py-0.5 rounded transition-colors"
                  title="הוסף שעה"
                >
                  + שעה
                </button>
              )}
            </div>

            {/* בר התקדמות */}
            {!isCompleted && estimated > 0 && (
              <div className="mt-2 flex items-center gap-3">
                <div className={`text-lg transition-transform duration-500 ${
                  isTimerRunning ? 'animate-spin' : ''
                }`} style={{ animationDuration: '3s' }}>
                  {isTimerRunning ? '⏳' : progress === 0 ? '⏳' : progress < 100 ? '⌛' : '✅'}
                </div>
                
                <div className="flex-1 h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden relative">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, progress)}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className={`h-full rounded-full ${
                      isOverTime ? 'bg-red-500' :
                      progress >= 80 ? 'bg-orange-500' :
                      progress >= 50 ? 'bg-yellow-500' :
                      progress > 0 ? 'bg-blue-500' :
                      'bg-gray-300'
                    }`}
                  />
                  {isTimerRunning && (
                    <div className="absolute inset-0 bg-white/30 animate-pulse rounded-full" />
                  )}
                </div>
                
                <span className={`text-sm font-medium whitespace-nowrap ${
                  isOverTime ? 'text-red-600 dark:text-red-400' : 
                  isTimerRunning ? 'text-green-600 dark:text-green-400' :
                  progress > 0 ? 'text-blue-600 dark:text-blue-400' :
                  'text-gray-500 dark:text-gray-400'
                }`}>
                  {spent > 0 && `${formatMinutes(spent)} / `}{formatMinutes(estimated)}
                  {isTimerRunning && ' 🔴'}
                </span>
              </div>
            )}

            {!isCompleted && showTimer && isOverTime && (
              <div className="mt-2 text-sm text-red-600 dark:text-red-400 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                ⚠️ עברת את הזמן המתוכנן ב-{formatMinutes(spent - estimated)}
              </div>
            )}

            {currentTask.description && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {currentTask.description}
              </p>
            )}

            {isCompleted && estimated > 0 && (
              <div className="mt-2 text-sm">
                {spent > estimated ? (
                  <span className="text-orange-600 dark:text-orange-400">
                    הערכת {formatMinutes(estimated)} → לקח {formatMinutes(spent)} (פי {(spent/estimated).toFixed(1)})
                  </span>
                ) : (
                  <span className="text-green-600 dark:text-green-400">
                    הערכת {formatMinutes(estimated)} → לקח {formatMinutes(spent)} 👍
                  </span>
                )}
              </div>
            )}
          </div>

          {/* כפתורי פעולה */}
          <div className="flex items-center gap-1">
            {/* כפתור טיימר */}
            {!isCompleted && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowTimer(!showTimer);
                }}
                className={`
                  p-2 rounded-lg transition-colors
                  ${showTimer 
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' 
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500'
                  }
                `}
                title={showTimer ? 'הסתר טיימר' : 'הצג טיימר'}
              >
                ⏱️
              </button>
            )}

            {/* מסך מיקוד - מפעיל את /focus עבור המשימה הנוכחית */}
            {!isCompleted && !isVirtual && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  try {
                    localStorage.setItem('start_task_id', currentTask.id);
                    // ניקוי pause של פוקוס אם יש - כדי לא להיתקע במצב מושהה ישן
                    localStorage.removeItem('zmanit_focus_paused');
                  } catch (_) {}
                  navigate('/focus');
                }}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
                title="🎯 מסך מיקוד"
              >
                🎯
              </button>
            )}
            
            {/* ✅ כפתור העברה - חדש! */}
            {!isCompleted && !isVirtual && (
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMoveMenu(!showMoveMenu);
                  }}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
                  title="העבר ליום אחר"
                >
                  📅
                </button>
                
                {/* תפריט העברה */}
                {showMoveMenu && (
                  <div className="absolute left-0 top-full mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-20 min-w-[160px]">
                    <button
                      onClick={handleMoveToTomorrow}
                      className="w-full px-3 py-2 text-right text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                    >
                      <span>📅</span>
                      <span>מחר</span>
                    </button>
                    <button
                      onClick={() => handleMoveToDate(2)}
                      className="w-full px-3 py-2 text-right text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                    >
                      <span>📆</span>
                      <span>עוד יומיים</span>
                    </button>
                    <button
                      onClick={() => handleMoveToDate(7)}
                      className="w-full px-3 py-2 text-right text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                    >
                      <span>🗓️</span>
                      <span>עוד שבוע</span>
                    </button>
                    
                    {/* אפשרות לשחרר שעה קבועה */}
                    {currentTask.due_time && (
                      <>
                        <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              await editTask(currentTask.id, { 
                                due_time: null,
                                is_fixed_time: false 
                              });
                              toast.success('🔓 השעה שוחררה - המשימה גמישה עכשיו');
                              setShowMoveMenu(false);
                              if (onUpdate) onUpdate();
                            } catch (err) {
                              toast.error('שגיאה בשחרור השעה');
                            }
                          }}
                          className="w-full px-3 py-2 text-right text-sm hover:bg-purple-100 dark:hover:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center gap-2"
                        >
                          <span>🔓</span>
                          <span>שחרר שעה קבועה</span>
                        </button>
                      </>
                    )}
                    
                    <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
                    <button
                      onClick={() => setShowMoveMenu(false)}
                      className="w-full px-3 py-2 text-right text-sm text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      ביטול
                    </button>
                  </div>
                )}
              </div>
            )}
            
            {/* כפתור עריכה */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
              title="ערוך"
            >
              ✏️
            </button>
            
            {/* כפתור מחיקה */}
            <button
              onClick={handleDelete}
              className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-500 hover:text-red-600"
              title="מחק"
            >
              🗑️
            </button>
          </div>
        </div>

        {/* טיימר */}
        {showTimer && !isCompleted && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <TaskTimerWithInterruptions
              task={currentTask}
              onUpdate={onUpdate}
              onComplete={handleToggleComplete}
              onTimeUpdate={handleTimerUpdate}
            />
          </div>
        )}
        
        {/* סגירת תפריט בלחיצה בחוץ */}
        {showMoveMenu && (
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setShowMoveMenu(false)}
          />
        )}
      </motion.div>
      
      {/* מודל משוב */}
      <CompletionFeedbackModal
        isOpen={showFeedback}
        onClose={() => setShowFeedback(false)}
        task={currentTask}
        actualMinutes={liveSpent}
        onConfirm={completeTask}
      />
      
      {/* דיאלוג אישור מחיקה */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDelete}
        title="למחוק את המשימה?"
        message={`"${currentTask.title}" תימחק לצמיתות`}
        confirmText="מחק"
        cancelText="ביטול"
        type="danger"
        loading={deleting}
      />
      
      {/* ✅ מודל לוג חסמים - מה עצר אותך? */}
      <BlockerLogModal
        isOpen={showBlockerModal}
        onClose={handleBlockerModalClose}
        task={currentTask}
        onSkip={handleBlockerModalClose}
      />
    </>
  );
}

export default DailyTaskCard;
