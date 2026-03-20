import { useState } from 'react';
import { motion } from 'framer-motion';
import { useTasks } from '../../hooks/useTasks';
import { getRelativeDate, formatTime } from '../../utils/dateTimeHelpers';
import { isTaskOverdue, isTaskDueToday } from '../../utils/taskHelpers';
import { detectTaskCategory } from '../../utils/taskCategories';
import toast from 'react-hot-toast';
import TaskTimerWithInterruptions from './TaskTimerWithInterruptions';

// פונקציה לבדיקה אם שלב באיחור או היום
const isSubtaskOverdue = (subtask) => {
  if (!subtask.due_date || subtask.is_completed) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(subtask.due_date);
  return dueDate < today;
};

const isSubtaskDueToday = (subtask) => {
  if (!subtask.due_date || subtask.is_completed) return false;
  const today = new Date().toISOString().split('T')[0];
  return subtask.due_date === today;
};

/**
 * כרטיס משימה
 */
function TaskCard({ 
  task, 
  quadrantId,
  onEdit, 
  onDragStart, 
  onDragEnd 
}) {
  const { toggleComplete, removeTask, loadTasks, tasks } = useTasks();
  const [showActions, setShowActions] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  // קבלת המשימה העדכנית מה-TaskContext במקום מה-prop
  const currentTask = tasks.find(t => t.id === task.id) || task;

  // סימון כהושלם
  const handleToggleComplete = async (e) => {
    e.stopPropagation();
    try {
      await toggleComplete(currentTask.id);
      toast.success(currentTask.is_completed ? 'המשימה סומנה כפעילה' : 'המשימה הושלמה!');
    } catch (err) {
      toast.error('שגיאה בעדכון המשימה');
    }
  };

  // מחיקת משימה
  const handleDelete = async (e) => {
    e.stopPropagation();
    setDeleting(true);
    try {
      await removeTask(currentTask.id);
      toast.success('המשימה נמחקה');
    } catch (err) {
      toast.error('שגיאה במחיקת המשימה');
      setDeleting(false);
    }
  };

  // בדיקת סטטוס - שימוש במשימה העדכנית
  const isOverdue = isTaskOverdue(currentTask);
  const isDueToday = isTaskDueToday(currentTask);
  const isProject = currentTask.is_project;
  const isSubtask = !!currentTask.parent_task_id; // משימה שהיא שלב של פרויקט
  const subtasks = currentTask.subtasks || [];
  const [showTimer, setShowTimer] = useState(false);
  
  // זיהוי קטגוריה - שימוש במשימה העדכנית
  const { category } = detectTaskCategory(currentTask);
  
  // חישוב התקדמות פרויקט - לפי שלבים שהושלמו
  const projectProgressByCompletion = isProject && subtasks.length > 0
    ? Math.round((subtasks.filter(st => st.is_completed).length / subtasks.length) * 100)
    : null;
  
  // חישוב התקדמות פרויקט - לפי זמן
  const projectProgressByTime = isProject && subtasks.length > 0
    ? (() => {
        const totalEstimated = subtasks.reduce((sum, st) => sum + (st.estimated_duration || 0), 0);
        const totalSpent = subtasks.reduce((sum, st) => sum + (st.time_spent || 0), 0);
        return totalEstimated > 0 ? Math.min(100, Math.round((totalSpent / totalEstimated) * 100)) : 0;
      })()
    : null;
  
  // התקדמות משולבת (ממוצע של שני המדדים)
  const projectProgress = isProject && subtasks.length > 0
    ? Math.round((projectProgressByCompletion + projectProgressByTime) / 2)
    : null;
  
  // התקדמות למשימה רגילה
  const regularTaskProgress = !isProject && !isSubtask && currentTask.estimated_duration
    ? Math.min(100, Math.round((((currentTask.time_spent || 0) / currentTask.estimated_duration) * 100)))
    : null;
  
  // שלבים קרובים (היום או באיחור)
  const upcomingSubtasks = subtasks.filter(st => 
    !st.is_completed && (isSubtaskDueToday(st) || isSubtaskOverdue(st))
  ).slice(0, 3);

  return (
    <motion.div
      layout
      draggable
      onDragStart={() => onDragStart(currentTask)}
      onDragEnd={onDragEnd}
      onClick={onEdit}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      className={`
        bg-white dark:bg-gray-800/90
        rounded-xl p-3.5
        border border-gray-100 dark:border-gray-700/60
        cursor-pointer
        transition-all duration-200
        hover:shadow-card-hover hover:border-blue-200 dark:hover:border-blue-700
        ${currentTask.is_completed ? 'opacity-50' : ''}
        ${deleting ? 'opacity-30 scale-95' : ''}
      `}
    >
      <div className="flex items-start gap-3">
        {/* כפתור סימון */}
        <button
          onClick={handleToggleComplete}
          className={`
            flex-shrink-0 w-6 h-6 mt-0.5 rounded-md border-2
            transition-all duration-200 flex items-center justify-center
            ${currentTask.is_completed
              ? 'bg-green-500 border-green-500 text-white'
              : 'border-gray-300 dark:border-gray-600 hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-900/20'
            }
          `}
        >
          {currentTask.is_completed && (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        {/* תוכן */}
        <div className="flex-1 min-w-0">
          {/* כותרת */}
          <p className={`
            font-medium text-gray-900 dark:text-white text-sm leading-snug
            ${currentTask.is_completed ? 'line-through text-gray-400 dark:text-gray-500' : ''}
          `}>
            {currentTask.title}
          </p>

          {/* תגיות */}
          <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
            {currentTask.priority === 'urgent' && (
              <span className="badge bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300 text-[10px]">
                דחוף
              </span>
            )}
            {currentTask.priority === 'high' && (
              <span className="badge bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300 text-[10px]">
                בינוני
              </span>
            )}
            {isProject && (
              <span className="badge bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 text-[10px]">
                פרויקט
              </span>
            )}
            {isSubtask && (
              <span className="badge bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 text-[10px]">
                שלב
              </span>
            )}
            <span className="badge bg-gray-100 dark:bg-gray-700/60 text-gray-500 dark:text-gray-400 text-[10px]">
              {category.icon} {category.name}
            </span>
          </div>

          {/* תיאור */}
          {currentTask.description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
              {currentTask.description}
            </p>
          )}

          {/* כפתור טיימר לכל משימה */}
          {!currentTask.is_completed && (
            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowTimer(!showTimer);
                }}
                className="badge bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors text-[11px]"
              >
                ⏱️ {showTimer ? 'הסתר' : 'טיימר'}
              </button>
              {currentTask.time_spent > 0 && (
                <span className="text-[11px] text-gray-400 dark:text-gray-500">
                  {currentTask.time_spent} דק'
                </span>
              )}
            </div>
          )}

          {/* התקדמות למשימה רגילה */}
          {!isProject && !isSubtask && currentTask.estimated_duration && regularTaskProgress !== null && (
            <div className="mt-2.5">
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="text-gray-500 dark:text-gray-400">התקדמות</span>
                <span className={`font-medium ${
                  regularTaskProgress >= 100
                    ? 'text-red-500 dark:text-red-400'
                    : 'text-blue-500 dark:text-blue-400'
                }`}>
                  {regularTaskProgress >= 100
                    ? `+${(currentTask.time_spent || 0) - currentTask.estimated_duration} דק' חריגה`
                    : `${currentTask.estimated_duration - (currentTask.time_spent || 0)} דק' נותרו`
                  }
                </span>
              </div>
              <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    regularTaskProgress >= 100
                      ? 'bg-red-500'
                      : regularTaskProgress >= 75
                      ? 'bg-amber-500'
                      : 'bg-blue-500'
                  }`}
                  style={{ width: `${Math.min(100, regularTaskProgress)}%` }}
                />
              </div>
            </div>
          )}
          
          {/* סטטוס פרויקט */}
          {isProject && (
            <div className="mt-2.5 space-y-2">
              {/* התקדמות */}
              {projectProgress !== null && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-gray-500 dark:text-gray-400">
                      התקדמות פרויקט
                    </span>
                    <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400">
                      {projectProgress}%
                    </span>
                  </div>
                  <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        projectProgress >= 100
                          ? 'bg-green-500'
                          : projectProgress >= 75
                          ? 'bg-blue-500'
                          : 'bg-amber-500'
                      }`}
                      style={{ width: `${projectProgress}%` }}
                    />
                  </div>
                  {projectProgressByTime !== null && projectProgressByCompletion !== null && (
                    <div className="flex items-center gap-3 text-[10px] text-gray-400 dark:text-gray-500">
                      <span>זמן: {projectProgressByTime}%</span>
                      <span>שלבים: {projectProgressByCompletion}%</span>
                    </div>
                  )}
                </div>
              )}

              {/* שלבים קרובים */}
              {upcomingSubtasks.length > 0 && (
                <div className="space-y-1">
                  {upcomingSubtasks.map((st, idx) => (
                    <div
                      key={idx}
                      className={`
                        text-[11px] px-2.5 py-1.5 rounded-lg
                        ${isSubtaskOverdue(st)
                          ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                          : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'}
                      `}
                    >
                      <span className="font-medium">{st.title}</span>
                      {st.due_date && (
                        <span className="mr-1 opacity-75"> • {getRelativeDate(st.due_date)}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* מספר שלבים */}
              {subtasks.length > 0 && (
                <div className="text-[11px] text-gray-400 dark:text-gray-500">
                  {subtasks.filter(st => st.is_completed).length}/{subtasks.length} שלבים
                </div>
              )}
            </div>
          )}

          {/* תאריך יעד */}
          {currentTask.due_date && (
            <div className={`
              flex items-center gap-1.5 mt-2 text-[11px]
              ${isOverdue ? 'text-red-500 dark:text-red-400' :
                isDueToday ? 'text-amber-500 dark:text-amber-400' :
                'text-gray-400 dark:text-gray-500'}
            `}>
              <span>📅</span>
              <span>{getRelativeDate(currentTask.due_date)}</span>
              {currentTask.due_time && (
                <span>• {formatTime(currentTask.due_time)}</span>
              )}
              {isOverdue && <span className="font-semibold">(באיחור)</span>}
            </div>
          )}
        </div>

        {/* כפתורי פעולה */}
        <div className={`
          flex gap-0.5 transition-opacity duration-200
          ${showActions ? 'opacity-100' : 'opacity-0 md:opacity-0'}
        `}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            title="ערוך"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={handleDelete}
            className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors"
            title="מחק"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
      
      {/* טיימר - עם תמיכה בהפרעות */}
      {showTimer && !currentTask.is_completed && (
        <div 
          onClick={(e) => e.stopPropagation()} 
          className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700"
        >
          <TaskTimerWithInterruptions
            task={currentTask}
            onUpdate={async () => {
              // עדכון המשימה ברשימה בלי לפתוח את הטופס
              await loadTasks();
            }}
            onComplete={async () => {
              // סימון המשימה כהושלמה
              await handleToggleComplete({ stopPropagation: () => {} });
            }}
          />
        </div>
      )}
    </motion.div>
  );
}

export default TaskCard;

