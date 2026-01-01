import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettings } from '../../context/SettingsContext';
import TaskTypesSettings from './TaskTypesSettings';
import CategoriesSettings from './CategoriesSettings';
import WorkScheduleSettings from './WorkScheduleSettings';
import NotificationsSettings from './NotificationsSettings';
import DisplaySettings from './DisplaySettings';
import TimerSettings from './TimerSettings';

/**
 * דף הגדרות ראשי
 * מאפשר ניווט בין כל סקציות ההגדרות
 */
function SettingsPage({ onClose }) {
  const { loading, saving } = useSettings();
  const [activeSection, setActiveSection] = useState('task-types');

  const sections = [
    { id: 'task-types', name: 'סוגי משימות', icon: '🏷️', component: TaskTypesSettings },
    { id: 'categories', name: 'קטגוריות', icon: '📁', component: CategoriesSettings },
    { id: 'work-schedule', name: 'לוח זמנים', icon: '📅', component: WorkScheduleSettings },
    { id: 'notifications', name: 'התראות', icon: '🔔', component: NotificationsSettings },
    { id: 'display', name: 'תצוגה', icon: '🎨', component: DisplaySettings },
    { id: 'timer', name: 'טיימר', icon: '⏱️', component: TimerSettings },
  ];

  const ActiveComponent = sections.find(s => s.id === activeSection)?.component || TaskTypesSettings;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚙️</span>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                הגדרות
              </h1>
              {saving && (
                <span className="text-sm text-blue-600 dark:text-blue-400 animate-pulse">
                  שומר...
                </span>
              )}
            </div>
            
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <span className="text-xl">✕</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* תפריט צד */}
          <div className="w-48 flex-shrink-0">
            <nav className="space-y-1 sticky top-24">
              {sections.map(section => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3 rounded-lg text-right
                    transition-all duration-200
                    ${activeSection === section.id
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }
                  `}
                >
                  <span className="text-xl">{section.icon}</span>
                  <span>{section.name}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* תוכן */}
          <div className="flex-1">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSection}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
              >
                <ActiveComponent />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;
