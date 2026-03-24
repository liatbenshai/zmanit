import { useState } from 'react';
import { motion } from 'framer-motion';
import { useDragAndDrop } from '../../hooks/useDragAndDrop';
import Quadrant from './Quadrant';

/**
 * מטריצת אייזנהאואר - 4 רבעים
 */
function Matrix({ onAddTask, onEditTask }) {
  const { 
    draggedTask, 
    dragOverQuadrant,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDragLeave,
    handleDrop
  } = useDragAndDrop();

  // תצוגת נייד - טאבים
  const [mobileActiveQuadrant, setMobileActiveQuadrant] = useState(1);

  // הגדרות הרבעים
  const quadrants = [
    {
      id: 1,
      title: 'דחוף וחשוב',
      subtitle: 'עשה עכשיו',
      icon: '🔴',
      colorClass: 'quadrant-1',
      borderColor: 'border-red-300 dark:border-red-700'
    },
    {
      id: 2,
      title: 'חשוב אך לא דחוף',
      subtitle: 'תכנן',
      icon: '🔵',
      colorClass: 'quadrant-2',
      borderColor: 'border-blue-300 dark:border-blue-700'
    },
    {
      id: 3,
      title: 'דחוף אך לא חשוב',
      subtitle: 'האצל',
      icon: '🟠',
      colorClass: 'quadrant-3',
      borderColor: 'border-orange-300 dark:border-orange-700'
    },
    {
      id: 4,
      title: 'לא דחוף ולא חשוב',
      subtitle: 'בטל',
      icon: '⚫',
      colorClass: 'quadrant-4',
      borderColor: 'border-gray-300 dark:border-gray-600'
    }
  ];

  return (
    <>
      {/* תצוגת דסקטופ - גריד 2x2 */}
      <div className="hidden md:grid grid-cols-2 gap-4">
        {quadrants.map((quadrant, index) => (
          <motion.div
            key={quadrant.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Quadrant
              {...quadrant}
              isDropTarget={dragOverQuadrant === quadrant.id}
              isDragging={!!draggedTask}
              onAddTask={() => onAddTask(quadrant.id)}
              onEditTask={onEditTask}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleDragOver(e, quadrant.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, quadrant.id)}
            />
          </motion.div>
        ))}
      </div>

      {/* תצוגת נייד - טאבים */}
      <div className="md:hidden">
        {/* טאבי הרבעים */}
        <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1 scrollbar-hide">
          {quadrants.map(quadrant => {
            const isActive = mobileActiveQuadrant === quadrant.id;
            return (
              <button
                key={quadrant.id}
                onClick={() => setMobileActiveQuadrant(quadrant.id)}
                className={`
                  flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl whitespace-nowrap
                  transition-all duration-200 text-sm font-medium
                  ${isActive
                    ? `${quadrant.colorClass} border-2 ${quadrant.borderColor} shadow-sm`
                    : 'bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'
                  }
                `}
              >
                <span>{quadrant.icon}</span>
                <span>{quadrant.title}</span>
              </button>
            );
          })}
        </div>

        {/* הרבע הנבחר */}
        {quadrants.map(quadrant => (
          quadrant.id === mobileActiveQuadrant && (
            <motion.div
              key={quadrant.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Quadrant
                {...quadrant}
                isMobile
                onAddTask={() => onAddTask(quadrant.id)}
                onEditTask={onEditTask}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              />
            </motion.div>
          )
        ))}
      </div>
    </>
  );
}

export default Matrix;

