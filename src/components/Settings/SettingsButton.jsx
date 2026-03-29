import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SettingsPage from './SettingsPage';

/**
 * כפתור גישה מהירה להגדרות
 * מציג מודל עם דף ההגדרות
 */
function SettingsButton({ className = '' }) {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowSettings(true)}
        className={`
          p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 
          transition-colors text-gray-600 dark:text-gray-400
          hover:text-gray-900 dark:hover:text-white
          ${className}
        `}
        title="הגדרות"
      >
        <span className="text-xl">⚙️</span>
      </button>

      {/* מודל הגדרות */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 overflow-auto"
            onClick={(e) => e.target === e.currentTarget && setShowSettings(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="min-h-screen"
            >
              <SettingsPage onClose={() => setShowSettings(false)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default SettingsButton;
