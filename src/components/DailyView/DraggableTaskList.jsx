import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DailyTaskCard from './DailyTaskCard';
import { reorderTasks } from '../../utils/taskOrder';
import toast from 'react-hot-toast';

/**
 * רשימת משימות עם גרירה לשינוי סדר
 */
function DraggableTaskList({ 
  tasks, 
  dateISO,
  onEdit, 
  onUpdate,
  onOrderChange,
  showTime = true 
}) {
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // התחלת גרירה
  const handleDragStart = useCallback((e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
    
    // הוספת אפקט ויזואלי
    if (e.target) {
      e.target.style.opacity = '0.5';
    }
  }, []);

  // סיום גרירה
  const handleDragEnd = useCallback((e) => {
    setDraggedIndex(null);
    setDragOverIndex(null);
    
    if (e.target) {
      e.target.style.opacity = '1';
    }
  }, []);

  // גרירה מעל משימה אחרת
  const handleDragOver = useCallback((e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    if (index !== draggedIndex) {
      setDragOverIndex(index);
    }
  }, [draggedIndex]);

  // יציאה מהגרירה
  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null);
  }, []);

  // שחרור - ביצוע ההחלפה
  const handleDrop = useCallback((e, toIndex) => {
    e.preventDefault();
    
    const fromIndex = draggedIndex;
    
    if (fromIndex === null || fromIndex === toIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    // יצירת סדר חדש
    const currentOrder = tasks.map(t => t.id || t.taskId);
    const newOrder = reorderTasks(dateISO, currentOrder, fromIndex, toIndex);
    
    // עדכון ה-parent
    if (onOrderChange) {
      onOrderChange(newOrder);
    }
    
    toast.success('🔄 הסדר עודכן');
    
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, [draggedIndex, tasks, dateISO, onOrderChange]);

  if (!tasks || tasks.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <AnimatePresence mode="popLayout">
        {tasks.map((task, index) => (
          <motion.div
            key={task.id || task.taskId || `task-${index}`}
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ 
              opacity: 1, 
              y: 0,
              scale: dragOverIndex === index ? 1.02 : 1,
              borderColor: dragOverIndex === index ? '#3b82f6' : 'transparent'
            }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className={`
              relative
              ${draggedIndex === index ? 'opacity-50' : ''}
              ${dragOverIndex === index ? 'border-2 border-blue-500 border-dashed rounded-xl' : ''}
            `}
          >
            {/* אינדיקטור מיקום יעד */}
            {dragOverIndex === index && draggedIndex !== null && draggedIndex < index && (
              <div className="absolute -top-1 left-0 right-0 h-1 bg-blue-500 rounded-full" />
            )}
            {dragOverIndex === index && draggedIndex !== null && draggedIndex > index && (
              <div className="absolute -bottom-1 left-0 right-0 h-1 bg-blue-500 rounded-full" />
            )}

            {/* עטיפה לגרירה */}
            <div
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              className="cursor-grab active:cursor-grabbing"
            >
              {/* ידית גרירה */}
              <div className="absolute right-2 top-1/2 -translate-y-1/2 z-10 opacity-30 hover:opacity-100 transition-opacity">
                <div className="flex flex-col gap-0.5 p-2">
                  <div className="w-4 h-0.5 bg-gray-400 rounded"></div>
                  <div className="w-4 h-0.5 bg-gray-400 rounded"></div>
                  <div className="w-4 h-0.5 bg-gray-400 rounded"></div>
                </div>
              </div>

              {/* כרטיס המשימה */}
              <DailyTaskCard
                task={{
                  id: task.taskId || task.id,
                  title: task.title,
                  estimated_duration: task.duration || task.estimated_duration,
                  time_spent: task.timeSpent || task.time_spent || 0,
                  is_completed: task.isCompleted || task.is_completed,
                  task_type: task.taskType || task.task_type,
                  due_time: task.startTime || task.due_time,
                  priority: task.priority || 'normal',
                  blockIndex: task.blockIndex,
                  totalBlocks: task.totalBlocks,
                  startTime: task.startTime,
                  endTime: task.endTime,
                  isPostponed: task.isPostponed,
                  isRescheduled: task.isRescheduled
                }}
                onEdit={() => onEdit(task)}
                onUpdate={onUpdate}
                showTime={showTime}
                draggable={false} // מטופל ברמת הרשימה
              />
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
      
      {/* הסבר קצר */}
      {tasks.length > 1 && (
        <p className="text-xs text-gray-400 text-center mt-2">
          💡 גררי משימה כדי לשנות את הסדר
        </p>
      )}
    </div>
  );
}

export default DraggableTaskList;
