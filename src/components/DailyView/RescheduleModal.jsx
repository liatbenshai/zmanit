import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTasks } from '../../hooks/useTasks';
import toast from 'react-hot-toast';

/**
 * מודל לארגון מחדש של משימות
 * מאפשר להעביר משימות באיחור ליום אחר
 */
function RescheduleModal({ isOpen, onClose, overdueBlocks, allBlocks, selectedDate }) {
  const { editTask } = useTasks();
  
  // משימות שנבחרו להעברה
  const [selectedTasks, setSelectedTasks] = useState(new Set());
  
  // תאריך יעד
  const [targetDate, setTargetDate] = useState('tomorrow');
  const [customDate, setCustomDate] = useState('');
  
  // מצב עיבוד
  const [processing, setProcessing] = useState(false);
  
  // חישוב תאריך מחר
  const tomorrow = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    // דילוג על סופ"ש
    while (date.getDay() === 5 || date.getDay() === 6) {
      date.setDate(date.getDate() + 1);
    }
    return date.toISOString().split('T')[0];
  }, []);
  
  // חישוב מחרתיים
  const dayAfterTomorrow = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + 2);
    while (date.getDay() === 5 || date.getDay() === 6) {
      date.setDate(date.getDate() + 1);
    }
    return date.toISOString().split('T')[0];
  }, []);
  
  // סיכום זמן נבחר
  const selectedMinutes = useMemo(() => {
    return overdueBlocks
      .filter(b => selectedTasks.has(b.taskId || b.id))
      .reduce((sum, b) => sum + (b.duration || 0), 0);
  }, [overdueBlocks, selectedTasks]);
  
  // פורמט דקות
  const formatMinutes = (minutes) => {
    if (minutes < 60) return `${minutes} דק'`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}:${mins.toString().padStart(2, '0')}` : `${hours} שעות`;
  };
  
  // פורמט תאריך
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('he-IL', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'short' 
    });
  };
  
  // בחירת/ביטול משימה
  const toggleTask = (taskId) => {
    setSelectedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };
  
  // בחירת הכל
  const selectAll = () => {
    const allIds = overdueBlocks.map(b => b.taskId || b.id);
    setSelectedTasks(new Set(allIds));
  };
  
  // ביטול הכל
  const selectNone = () => {
    setSelectedTasks(new Set());
  };
  
  // חישוב תאריך היעד בפועל
  const getActualTargetDate = () => {
    switch (targetDate) {
      case 'tomorrow': return tomorrow;
      case 'dayAfter': return dayAfterTomorrow;
      case 'custom': return customDate;
      default: return tomorrow;
    }
  };
  
  // ביצוע ההעברה
  const handleReschedule = async () => {
    if (selectedTasks.size === 0) {
      toast.error('בחרי לפחות משימה אחת');
      return;
    }
    
    const actualDate = getActualTargetDate();
    if (!actualDate) {
      toast.error('בחרי תאריך יעד');
      return;
    }
    
    console.log('🔄 Starting reschedule to date:', actualDate);
    setProcessing(true);
    
    try {
      // איסוף ID-ים ייחודיים של משימות (לא בלוקים)
      const uniqueTaskIds = new Set();
      overdueBlocks
        .filter(b => selectedTasks.has(b.taskId || b.id))
        .forEach(b => {
          // אם זה בלוק של משימה - לוקחים את ה-taskId
          // אם זה משימה רגילה - לוקחים את ה-id
          const taskId = b.taskId || b.id;
          // מסננים IDs וירטואליים
          if (taskId && typeof taskId === 'string' && !taskId.includes('block') && !taskId.includes('admin')) {
            uniqueTaskIds.add(taskId);
          }
        });
      
      console.log('📋 Tasks to reschedule:', [...uniqueTaskIds]);
      
      // עדכון כל משימה
      let successCount = 0;
      const errors = [];
      
      for (const taskId of uniqueTaskIds) {
        try {
          console.log(`📝 Rescheduling task ${taskId} to ${actualDate}`);
          await editTask(taskId, {
            due_date: actualDate,
            start_date: actualDate,
            due_time: null // השעה תחושב מחדש
          });
          successCount++;
          console.log(`✅ Task ${taskId} rescheduled successfully`);
        } catch (err) {
          console.error(`❌ Error rescheduling task ${taskId}:`, err);
          errors.push({ taskId, error: err.message });
        }
      }
      
      if (successCount > 0) {
        toast.success(`🎉 ${successCount} משימות הועברו ל-${formatDate(actualDate)}`);
        if (errors.length > 0) {
          console.warn('⚠️ Some tasks failed to reschedule:', errors);
          toast.error(`${errors.length} משימות נכשלו`);
        }
        onClose();
      } else {
        toast.error('לא הצלחתי להעביר משימות');
        console.error('❌ All tasks failed to reschedule:', errors);
      }
      
    } catch (err) {
      console.error('שגיאה בהעברת משימות:', err);
      toast.error('שגיאה בהעברת משימות');
    } finally {
      setProcessing(false);
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* רקע כהה */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50"
          onClick={onClose}
        />
        
        {/* המודל */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden"
          dir="rtl"
        >
          {/* כותרת */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-l from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              📅 ארגון מחדש של המשימות
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              בחרי אילו משימות להעביר ולאן
            </p>
          </div>
          
          {/* תוכן */}
          <div className="p-4 overflow-y-auto max-h-[50vh]">
            
            {/* כפתורי בחירה מהירה */}
            <div className="flex gap-2 mb-3">
              <button
                onClick={selectAll}
                className="text-xs px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full hover:bg-blue-200 transition-colors"
              >
                ✓ בחר הכל
              </button>
              <button
                onClick={selectNone}
                className="text-xs px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full hover:bg-gray-200 transition-colors"
              >
                ✗ נקה בחירה
              </button>
            </div>
            
            {/* רשימת משימות */}
            <div className="space-y-2 mb-4">
              {overdueBlocks.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                  אין משימות באיחור 🎉
                </p>
              ) : (
                overdueBlocks.map((block, index) => {
                  const taskId = block.taskId || block.id;
                  const isSelected = selectedTasks.has(taskId);
                  const isVirtual = taskId?.includes('admin') || taskId?.includes('block');
                  
                  return (
                    <div
                      key={taskId || index}
                      onClick={() => !isVirtual && toggleTask(taskId)}
                      className={`
                        p-3 rounded-lg border-2 transition-all cursor-pointer
                        ${isVirtual 
                          ? 'opacity-50 cursor-not-allowed border-gray-200 dark:border-gray-700'
                          : isSelected
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'
                        }
                      `}
                    >
                      <div className="flex items-center gap-3">
                        {/* צ'קבוקס */}
                        <div className={`
                          w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0
                          ${isVirtual 
                            ? 'border-gray-300 bg-gray-100'
                            : isSelected
                              ? 'border-blue-500 bg-blue-500 text-white'
                              : 'border-gray-300'
                          }
                        `}>
                          {isSelected && !isVirtual && (
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        
                        {/* פרטי המשימה */}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 dark:text-white truncate">
                            {block.title}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {block.duration} דק' • {block.originalStartTime || block.startTime}
                            {isVirtual && ' • בלוק קבוע'}
                          </p>
                        </div>
                        
                        {/* תגית עדיפות */}
                        {block.priority === 'urgent' && !isVirtual && (
                          <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full">
                            דחוף
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            
            {/* בחירת תאריך יעד */}
            {overdueBlocks.length > 0 && (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  להעביר לאיזה יום?
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                    <input
                      type="radio"
                      name="targetDate"
                      value="tomorrow"
                      checked={targetDate === 'tomorrow'}
                      onChange={(e) => setTargetDate(e.target.value)}
                      className="text-blue-500"
                    />
                    <span>מחר ({formatDate(tomorrow)})</span>
                  </label>
                  
                  <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                    <input
                      type="radio"
                      name="targetDate"
                      value="dayAfter"
                      checked={targetDate === 'dayAfter'}
                      onChange={(e) => setTargetDate(e.target.value)}
                      className="text-blue-500"
                    />
                    <span>מחרתיים ({formatDate(dayAfterTomorrow)})</span>
                  </label>
                  
                  <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                    <input
                      type="radio"
                      name="targetDate"
                      value="custom"
                      checked={targetDate === 'custom'}
                      onChange={(e) => setTargetDate(e.target.value)}
                      className="text-blue-500"
                    />
                    <span>תאריך אחר:</span>
                    <input
                      type="date"
                      value={customDate}
                      onChange={(e) => {
                        setCustomDate(e.target.value);
                        setTargetDate('custom');
                      }}
                      min={tomorrow}
                      className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-sm"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>
          
          {/* סיכום וכפתורים */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            {/* סיכום */}
            {selectedTasks.size > 0 && (
              <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm">
                <span className="text-blue-700 dark:text-blue-300">
                  ✓ נבחרו {selectedTasks.size} משימות ({formatMinutes(selectedMinutes)})
                </span>
              </div>
            )}
            
            {/* כפתורים */}
            <div className="flex gap-3">
              <button
                onClick={handleReschedule}
                disabled={processing || selectedTasks.size === 0}
                className={`
                  flex-1 py-2.5 px-4 rounded-lg font-medium transition-all
                  ${processing || selectedTasks.size === 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                  }
                `}
              >
                {processing ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    מעביר...
                  </span>
                ) : (
                  `📅 העבר ${selectedTasks.size > 0 ? selectedTasks.size + ' משימות' : ''}`
                )}
              </button>
              
              <button
                onClick={onClose}
                className="py-2.5 px-4 rounded-lg font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-all"
              >
                ביטול
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default RescheduleModal;
