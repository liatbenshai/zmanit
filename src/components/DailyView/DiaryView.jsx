import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTasks } from '../../hooks/useTasks';
import TaskTimerWithInterruptions from '../Tasks/TaskTimerWithInterruptions';
import toast from 'react-hot-toast';
import { TASK_TYPES, getTaskType } from '../../config/taskTypes';

const WORK_HOURS = { start: 8, end: 17 };
const HOUR_HEIGHT = 80; // גובה בפיקסלים לכל שעה
const BREAK_DURATION = 5; // דקות הפסקה בין משימות

/**
 * צבעים לפי סוג משימה
 */
const TASK_COLORS = {
  transcription: { bg: 'bg-purple-100 dark:bg-purple-900/40', border: 'border-purple-500', text: 'text-purple-700 dark:text-purple-300' },
  proofreading: { bg: 'bg-blue-100 dark:bg-blue-900/40', border: 'border-blue-500', text: 'text-blue-700 dark:text-blue-300' },
  admin: { bg: 'bg-gray-100 dark:bg-gray-700/40', border: 'border-gray-500', text: 'text-gray-700 dark:text-gray-300' },
  email: { bg: 'bg-green-100 dark:bg-green-900/40', border: 'border-green-500', text: 'text-green-700 dark:text-green-300' },
  meeting: { bg: 'bg-orange-100 dark:bg-orange-900/40', border: 'border-orange-500', text: 'text-orange-700 dark:text-orange-300' },
  course: { bg: 'bg-indigo-100 dark:bg-indigo-900/40', border: 'border-indigo-500', text: 'text-indigo-700 dark:text-indigo-300' },
  client_communication: { bg: 'bg-teal-100 dark:bg-teal-900/40', border: 'border-teal-500', text: 'text-teal-700 dark:text-teal-300' },
  management: { bg: 'bg-rose-100 dark:bg-rose-900/40', border: 'border-rose-500', text: 'text-rose-700 dark:text-rose-300' },
  default: { bg: 'bg-slate-100 dark:bg-slate-700/40', border: 'border-slate-500', text: 'text-slate-700 dark:text-slate-300' }
};

/**
 * פורמט דקות
 */
function formatMinutes(minutes) {
  if (!minutes) return '0 דק\'';
  if (minutes < 60) return `${minutes} דק'`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}:${mins.toString().padStart(2, '0')}` : `${hours} שעות`;
}

/**
 * המרת שעה לדקות
 */
function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + (m || 0);
}

/**
 * המרת דקות לשעה
 */
function minutesToTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/**
 * האם זה היום?
 */
function isToday(date) {
  const today = new Date();
  const d = date instanceof Date ? date : new Date(date);
  return d.toDateString() === today.toDateString();
}

/**
 * קבלת צבע לפי סוג משימה
 */
function getTaskColors(taskType) {
  return TASK_COLORS[taskType] || TASK_COLORS.default;
}

/**
 * תצוגת יומן יומי ויזואלית - בלוקים גרפיים על ציר זמן
 */
function DiaryView({ date, tasks, onEditTask, onAddTask, onUpdate }) {
  const { toggleComplete, editTask } = useTasks();
  const [expandedTask, setExpandedTask] = useState(null);

  // המרת בלוקים מ-smartScheduler לפורמט משימות
  const dayTasks = useMemo(() => {
    if (!tasks || tasks.length === 0) return [];
    
    const isSmartBlocks = tasks[0]?.startTime !== undefined;
    
    if (isSmartBlocks) {
      return tasks.map(block => ({
        id: block.taskId || block.id,
        title: block.title,
        estimated_duration: block.duration,
        time_spent: block.timeSpent || 0,
        is_completed: block.isCompleted || false,
        task_type: block.taskType,
        startTime: block.startTime,
        endTime: block.endTime,
        priority: block.priority,
        blockIndex: block.blockIndex,
        totalBlocks: block.totalBlocks,
        notes: block.notes
      }));
    }
    
    // תאימות אחורה
    const dateISO = date instanceof Date 
      ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      : date;
    return tasks.filter(t => t.due_date === dateISO).map(t => ({
      ...t,
      startTime: t.due_time,
      endTime: t.due_time ? minutesToTime(timeToMinutes(t.due_time) + (t.estimated_duration || 30)) : null
    }));
  }, [tasks, date]);

  // משימות ממוינות לפי שעת התחלה
  const sortedTasks = useMemo(() => {
    return [...dayTasks]
      .filter(t => t.startTime)
      .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  }, [dayTasks]);

  // משימות ללא שעה
  const unscheduledTasks = useMemo(() => {
    return dayTasks.filter(t => !t.startTime && !t.is_completed);
  }, [dayTasks]);

  // משימות שהושלמו
  const completedTasks = useMemo(() => {
    return dayTasks.filter(t => t.is_completed);
  }, [dayTasks]);

  // סטטיסטיקות
  const stats = useMemo(() => {
    const active = dayTasks.filter(t => !t.is_completed);
    const totalPlanned = active.reduce((sum, t) => sum + (t.estimated_duration || 30), 0);
    const done = dayTasks.filter(t => t.is_completed).length;
    return { active: active.length, totalPlanned, done };
  }, [dayTasks]);

  // שעות לתצוגה
  const hours = useMemo(() => {
    const arr = [];
    for (let h = WORK_HOURS.start; h <= WORK_HOURS.end; h++) {
      arr.push(h);
    }
    return arr;
  }, []);

  // זמן נוכחי
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const isTodayView = isToday(date);

  // חישוב מיקום בפיקסלים מדקות
  const minutesToPosition = (minutes) => {
    const startOfDay = WORK_HOURS.start * 60;
    return ((minutes - startOfDay) / 60) * HOUR_HEIGHT;
  };

  // חישוב גובה בפיקסלים ממשך
  const durationToHeight = (duration) => {
    return (duration / 60) * HOUR_HEIGHT;
  };

  // פעולות
  const handleComplete = useCallback(async (task, e) => {
    if (e) e.stopPropagation();
    try {
      await toggleComplete(task.id);
      toast.success('✅ הושלם!');
      if (onUpdate) onUpdate();
    } catch {
      toast.error('שגיאה');
    }
  }, [toggleComplete, onUpdate]);

  // רכיב בלוק משימה על הציר
  const TaskBlock = ({ task }) => {
    const colors = getTaskColors(task.task_type);
    const taskTypeInfo = TASK_TYPES[task.task_type] || TASK_TYPES.other || { icon: '📋', name: 'אחר' };
    const startMinutes = timeToMinutes(task.startTime);
    const duration = task.estimated_duration || 30;
    const top = minutesToPosition(startMinutes);
    const height = durationToHeight(duration);
    const isExpanded = expandedTask === task.id;
    
    // בדיקת מצב זמן
    const endMinutes = startMinutes + duration;
    const isNow = isTodayView && currentMinutes >= startMinutes && currentMinutes < endMinutes;
    const isPast = isTodayView && currentMinutes >= endMinutes;

    // שם תצוגה עם אינדקס בלוק
    const displayTitle = task.totalBlocks > 1 
      ? `${task.title} (${task.blockIndex}/${task.totalBlocks})`
      : task.title;

    return (
      <motion.div
        layout
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className={`
          absolute right-20 left-2 rounded-lg border-r-4 cursor-pointer
          transition-all duration-200 overflow-hidden
          ${colors.bg} ${colors.border}
          ${isNow ? 'ring-2 ring-blue-500 shadow-lg z-20' : ''}
          ${isPast ? 'opacity-60' : 'shadow-md hover:shadow-lg'}
          ${task.is_completed ? 'opacity-50' : ''}
        `}
        style={{ 
          top: `${top}px`, 
          height: `${Math.max(height, 30)}px`,
          minHeight: '30px'
        }}
        onClick={() => setExpandedTask(isExpanded ? null : task.id)}
      >
        <div className="p-2 h-full flex flex-col">
          {/* שורה ראשית */}
          <div className="flex items-center gap-2">
            <span className="text-lg flex-shrink-0">{taskTypeInfo.icon}</span>
            <span className={`font-medium truncate flex-1 ${colors.text} ${task.is_completed ? 'line-through' : ''}`}>
              {displayTitle}
            </span>
            {!task.is_completed && (
              <button
                onClick={(e) => handleComplete(task, e)}
                className="w-5 h-5 rounded-full border-2 border-current opacity-50 hover:opacity-100 flex-shrink-0"
              />
            )}
            {task.is_completed && (
              <span className="text-green-500 flex-shrink-0">✓</span>
            )}
          </div>
          
          {/* זמנים */}
          {height >= 50 && (
            <div className="flex items-center gap-2 mt-1 text-xs opacity-70" dir="ltr">
              <span>{task.startTime}</span>
              <span>→</span>
              <span>{task.endTime}</span>
              <span className="mr-auto">{duration} דק'</span>
            </div>
          )}

          {/* התקדמות */}
          {height >= 70 && task.time_spent > 0 && (
            <div className="mt-1">
              <div className="h-1 bg-black/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-green-500 rounded-full"
                  style={{ width: `${Math.min(100, (task.time_spent / duration) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* פאנל מורחב */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t border-black/10 bg-white/50 dark:bg-black/20 p-3"
            >
              <div className="flex gap-2 mb-3">
                <button
                  onClick={(e) => { e.stopPropagation(); onEditTask(task); }}
                  className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  ✏️ עריכה
                </button>
                {!task.is_completed && (
                  <button
                    onClick={(e) => handleComplete(task, e)}
                    className="px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
                  >
                    ✓ סיום
                  </button>
                )}
              </div>
              
              <TaskTimerWithInterruptions
                task={task}
                onUpdate={onUpdate}
                onComplete={() => handleComplete(task)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  // רכיב הפסקה בין משימות
  const BreakIndicator = ({ startTime, endTime }) => {
    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);
    const duration = endMinutes - startMinutes;
    
    if (duration < 3) return null; // לא מציג הפסקות קצרות מדי
    
    const top = minutesToPosition(startMinutes);
    const height = durationToHeight(duration);

    return (
      <div
        className="absolute right-20 left-2 flex items-center justify-center"
        style={{ top: `${top}px`, height: `${height}px` }}
      >
        <div className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-xs rounded-full">
          ☕ {duration} דק' הפסקה
        </div>
      </div>
    );
  };

  // גובה כולל של הציר
  const totalHeight = (WORK_HOURS.end - WORK_HOURS.start + 1) * HOUR_HEIGHT;

  // קו השעה הנוכחית
  const currentTimePosition = isTodayView ? minutesToPosition(currentMinutes) : null;

  // חישוב הפסקות בין משימות
  const breaks = useMemo(() => {
    const result = [];
    for (let i = 0; i < sortedTasks.length - 1; i++) {
      const current = sortedTasks[i];
      const next = sortedTasks[i + 1];
      const currentEnd = timeToMinutes(current.endTime || current.startTime) + (current.estimated_duration || 0);
      const nextStart = timeToMinutes(next.startTime);
      
      if (nextStart > currentEnd + 2) { // הפסקה של לפחות 3 דקות
        result.push({
          startTime: minutesToTime(currentEnd),
          endTime: next.startTime
        });
      }
    }
    return result;
  }, [sortedTasks]);

  return (
    <div className="diary-view space-y-4">
      {/* סטטיסטיקות */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-l from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
        <div className="flex items-center gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.active}</div>
            <div className="text-xs text-gray-500">משימות</div>
          </div>
          <div className="w-px h-8 bg-blue-200 dark:bg-blue-700" />
          <div className="text-center">
            <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{formatMinutes(stats.totalPlanned)}</div>
            <div className="text-xs text-gray-500">זמן מתוכנן</div>
          </div>
          {stats.done > 0 && (
            <>
              <div className="w-px h-8 bg-blue-200 dark:bg-blue-700" />
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.done}</div>
                <div className="text-xs text-gray-500">הושלמו ✓</div>
              </div>
            </>
          )}
        </div>
        
        <button
          onClick={() => onAddTask()}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <span>+</span>
          <span>משימה</span>
        </button>
      </div>

      {/* משימות ללא שעה */}
      {unscheduledTasks.length > 0 && (
        <div className="p-3 rounded-xl border-2 border-dashed border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-sm font-medium mb-2">
            <span>📌</span>
            <span>ללא שעה קבועה ({unscheduledTasks.length})</span>
          </div>
          <div className="space-y-2">
            {unscheduledTasks.map(task => {
              const colors = getTaskColors(task.task_type);
              const taskTypeInfo = TASK_TYPES[task.task_type] || { icon: '📋' };
              return (
                <div 
                  key={task.id}
                  onClick={() => onEditTask(task)}
                  className={`p-3 rounded-lg border-r-4 cursor-pointer ${colors.bg} ${colors.border} hover:shadow-md transition-shadow`}
                >
                  <div className="flex items-center gap-2">
                    <span>{taskTypeInfo.icon}</span>
                    <span className={`font-medium ${colors.text}`}>{task.title}</span>
                    <span className="text-xs opacity-60 mr-auto">{task.estimated_duration || 30} דק'</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ציר הזמן הויזואלי */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="relative" style={{ height: `${totalHeight}px` }}>
          {/* קווי שעות */}
          {hours.map(hour => {
            const top = (hour - WORK_HOURS.start) * HOUR_HEIGHT;
            const isCurrentHour = isTodayView && now.getHours() === hour;
            
            return (
              <div key={hour} className="absolute w-full" style={{ top: `${top}px` }}>
                {/* קו מפריד */}
                <div className={`border-t ${isCurrentHour ? 'border-blue-300' : 'border-gray-200 dark:border-gray-700'}`} />
                
                {/* תווית שעה */}
                <div className={`
                  absolute right-0 w-16 h-full flex items-start justify-center pt-2
                  border-l border-gray-200 dark:border-gray-700
                  ${isCurrentHour ? 'bg-blue-50 dark:bg-blue-900/30' : 'bg-gray-50 dark:bg-gray-900/30'}
                `}>
                  <span className={`text-sm font-mono ${isCurrentHour ? 'text-blue-600 font-bold' : 'text-gray-500'}`}>
                    {hour.toString().padStart(2, '0')}:00
                  </span>
                </div>
              </div>
            );
          })}

          {/* קו השעה הנוכחית */}
          {currentTimePosition !== null && currentTimePosition >= 0 && currentTimePosition <= totalHeight && (
            <div 
              className="absolute left-0 right-16 h-0.5 bg-red-500 z-30"
              style={{ top: `${currentTimePosition}px` }}
            >
              <div className="absolute left-0 -top-2 w-4 h-4 bg-red-500 rounded-full" />
              <span className="absolute left-5 -top-2 text-xs text-red-500 font-bold">
                {minutesToTime(currentMinutes)}
              </span>
            </div>
          )}

          {/* הפסקות */}
          {breaks.map((brk, i) => (
            <BreakIndicator key={i} startTime={brk.startTime} endTime={brk.endTime} />
          ))}

          {/* בלוקי משימות */}
          {sortedTasks.filter(t => !t.is_completed).map(task => (
            <TaskBlock key={task.id} task={task} />
          ))}
        </div>
      </div>

      {/* משימות שהושלמו */}
      {completedTasks.length > 0 && (
        <div className="p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-400 text-sm font-medium mb-2">
            <span>✅</span>
            <span>הושלמו ({completedTasks.length})</span>
          </div>
          <div className="space-y-2">
            {completedTasks.map(task => {
              const colors = getTaskColors(task.task_type);
              const taskTypeInfo = TASK_TYPES[task.task_type] || { icon: '📋' };
              return (
                <div 
                  key={task.id}
                  className={`p-2 rounded-lg border-r-4 opacity-60 ${colors.bg} ${colors.border}`}
                >
                  <div className="flex items-center gap-2">
                    <span>{taskTypeInfo.icon}</span>
                    <span className={`line-through ${colors.text}`}>{task.title}</span>
                    {task.time_spent > 0 && (
                      <span className="text-xs text-green-600 mr-auto">
                        {formatMinutes(task.time_spent)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default DiaryView;
