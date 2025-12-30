import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  sortTasksByOrder, 
  setDayTaskOrder, 
  reorderTask,
  initializeDayOrder 
} from '../../utils/taskReorder';

/**
 * רשימת משימות עם גרירה
 * =====================
 * 
 * עוטף את DailyTaskCard ומוסיף תמיכה בגרירה לשינוי סדר.
 */
function DraggableTaskList({ 
  blocks,          // בלוקי משימות
  date,            // תאריך (YYYY-MM-DD)
  renderTask,      // פונקציה לרנדור כל משימה
  onReorder,       // callback כשמשנים סדר
  onMoveToDay,     // callback כשמעבירים ליום אחר
  className = ''
}) {
  const [items, setItems] = useState([]);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const draggedItemRef = useRef(null);
  
  // אתחול ומיון לפי סדר שמור
  useEffect(() => {
    if (blocks && blocks.length > 0) {
      // אתחול סדר אם אין
      initializeDayOrder(date, blocks);
      // מיון לפי סדר שמור
      const sorted = sortTasksByOrder(blocks, date);
      setItems(sorted);
    } else {
      setItems([]);
    }
  }, [blocks, date]);
  
  // התחלת גרירה
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    draggedItemRef.current = items[index];
    
    // אפקט גרירה
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', items[index].id || items[index].taskId);
    
    // עיכוב קטן לאנימציה חלקה
    setTimeout(() => {
      e.target.style.opacity = '0.5';
    }, 0);
  };
  
  // גרירה מעל פריט
  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    if (index !== dragOverIndex) {
      setDragOverIndex(index);
    }
  };
  
  // עזיבת אזור גרירה
  const handleDragLeave = (e) => {
    // רק אם עוזבים לגמרי (לא נכנסים לילד)
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverIndex(null);
    }
  };
  
  // סיום גרירה
  const handleDragEnd = (e) => {
    e.target.style.opacity = '1';
    setDraggedIndex(null);
    setDragOverIndex(null);
    draggedItemRef.current = null;
  };
  
  // שחרור (drop)
  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      handleDragEnd(e);
      return;
    }
    
    // עדכון הרשימה המקומית
    const newItems = [...items];
    const [draggedItem] = newItems.splice(draggedIndex, 1);
    newItems.splice(dropIndex, 0, draggedItem);
    setItems(newItems);
    
    // שמירת הסדר החדש
    const taskIds = newItems.map(item => item.id || item.taskId).filter(Boolean);
    setDayTaskOrder(date, taskIds);
    
    // callback
    if (onReorder) {
      onReorder(newItems, draggedIndex, dropIndex);
    }
    
    console.log(`📋 סדר עודכן: משימה הועברה מ-${draggedIndex} ל-${dropIndex}`);
    
    handleDragEnd(e);
  };
  
  if (items.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <AnimatePresence mode="popLayout">
        {items.map((item, index) => (
          <motion.div
            key={item.id || item.taskId || `item-${index}`}
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ 
              opacity: 1, 
              y: 0,
              scale: draggedIndex === index ? 1.02 : 1,
              zIndex: draggedIndex === index ? 10 : 1
            }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragLeave={handleDragLeave}
            onDragEnd={handleDragEnd}
            onDrop={(e) => handleDrop(e, index)}
            className={`
              relative cursor-grab active:cursor-grabbing
              ${draggedIndex === index ? 'opacity-50' : ''}
              ${dragOverIndex === index && draggedIndex !== index ? 'transform translate-y-2' : ''}
            `}
          >
            {/* אינדיקטור מיקום */}
            {dragOverIndex === index && draggedIndex !== index && draggedIndex !== null && (
              <div className="absolute -top-1 left-0 right-0 h-1 bg-blue-500 rounded-full" />
            )}
            
            {/* ידית גרירה */}
            <div className="absolute right-0 top-0 bottom-0 w-8 flex items-center justify-center opacity-30 hover:opacity-60 transition-opacity">
              <span className="text-gray-400 text-lg select-none">⋮⋮</span>
            </div>
            
            {/* תוכן המשימה */}
            <div className="pr-6">
              {renderTask(item, index)}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/**
 * רכיב בחירת יום להעברת משימה
 */
export function DaySelector({ currentDate, onSelectDay, onClose }) {
  // יצירת 7 ימים קדימה
  const days = [];
  const today = new Date();
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    const dateISO = date.toISOString().split('T')[0];
    
    const dayNames = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
    const dayName = dayNames[date.getDay()];
    
    days.push({
      date: dateISO,
      dayName,
      dayNum: date.getDate(),
      isToday: i === 0,
      isCurrent: dateISO === currentDate
    });
  }
  
  return (
    <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-2 z-50">
      <div className="text-xs text-gray-500 mb-2 px-2">העבר ליום:</div>
      <div className="flex gap-1">
        {days.map(day => (
          <button
            key={day.date}
            onClick={() => {
              onSelectDay(day.date);
              onClose();
            }}
            disabled={day.isCurrent}
            className={`
              w-10 h-12 rounded-lg flex flex-col items-center justify-center text-xs
              transition-colors
              ${day.isCurrent 
                ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                : 'hover:bg-blue-100 dark:hover:bg-blue-900/30 text-gray-700 dark:text-gray-300'
              }
              ${day.isToday && !day.isCurrent ? 'ring-2 ring-blue-400' : ''}
            `}
          >
            <span className="font-medium">{day.dayNum}</span>
            <span className="text-gray-400">{day.dayName}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * כפתור "העבר למחר"
 */
export function MoveToTomorrowButton({ taskId, currentDate, onMove }) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowISO = tomorrow.toISOString().split('T')[0];
  
  return (
    <button
      onClick={() => onMove(taskId, currentDate, tomorrowISO)}
      className="text-xs text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
      title="העבר למחר"
    >
      📅 מחר
    </button>
  );
}

export default DraggableTaskList;
