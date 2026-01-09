/**
 * BlockerInsights - תובנות על דפוסי דחיינות
 * ==========================================
 * מציג סטטיסטיקות, דפוסים וטיפים מותאמים אישית
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getBlockerStats, BLOCKER_TYPES } from './BlockerLogModal';

/**
 * כרטיס תובנה בודד
 */
function InsightCard({ emoji, title, text, highlight = false }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-4 rounded-xl ${
        highlight 
          ? 'bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/30 dark:to-blue-900/30 border border-purple-200 dark:border-purple-700'
          : 'bg-gray-50 dark:bg-gray-700/50'
      }`}
    >
      <div className="flex gap-3">
        <span className="text-2xl">{emoji}</span>
        <div>
          <h4 className="font-bold text-gray-900 dark:text-white text-sm">{title}</h4>
          <p className="text-gray-600 dark:text-gray-300 text-sm mt-1">{text}</p>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * גרף עמודות פשוט
 */
function SimpleBarChart({ data, maxValue }) {
  return (
    <div className="space-y-2">
      {data.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <span className="text-lg w-8">{item.emoji}</span>
          <div className="flex-1 h-6 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(item.count / maxValue) * 100}%` }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              className="h-full bg-gradient-to-r from-blue-400 to-purple-500 rounded-full"
            />
          </div>
          <span className="text-sm text-gray-600 dark:text-gray-400 w-12 text-left">
            {item.percent}%
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * הקומפוננטה הראשית
 */
export default function BlockerInsights({ isOpen, onClose }) {
  const stats = useMemo(() => getBlockerStats(), [isOpen]);
  
  if (!isOpen) return null;
  
  // אין נתונים
  if (!stats || stats.totalLogs === 0) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full"
            onClick={e => e.stopPropagation()}
          >
            <div className="text-center py-8">
              <span className="text-6xl block mb-4">📊</span>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                עוד אין מספיק נתונים
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                ככל שתשתמשי במערכת, אאסוף נתונים על הדפוסים שלך ואציג לך תובנות מותאמות אישית.
              </p>
              <button
                onClick={onClose}
                className="mt-6 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                הבנתי
              </button>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  }
  
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-lg w-full my-8 shadow-xl"
          onClick={e => e.stopPropagation()}
        >
          {/* כותרת */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <span>🔍</span> הדפוסים שלך
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                מבוסס על {stats.totalLogs} דחיות
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              ✕
            </button>
          </div>
          
          {/* החסם המוביל */}
          {stats.topBlocker && (
            <div className="mb-6 p-4 bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-xl border border-orange-200 dark:border-orange-800">
              <div className="flex items-center gap-3">
                <span className="text-4xl">{stats.topBlocker.emoji}</span>
                <div>
                  <div className="text-sm text-orange-600 dark:text-orange-400">החסם המוביל שלך</div>
                  <div className="font-bold text-gray-900 dark:text-white text-lg">
                    {stats.topBlocker.label}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    {stats.topBlocker.percent}% מהדחיות שלך
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* התפלגות חסמים */}
          <div className="mb-6">
            <h4 className="font-medium text-gray-900 dark:text-white mb-3">
              התפלגות חסמים
            </h4>
            <SimpleBarChart 
              data={stats.byType.slice(0, 5)} 
              maxValue={Math.max(...stats.byType.map(t => t.count))}
            />
          </div>
          
          {/* ניתוח זמנים */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {/* לפי שעה */}
            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                ⏰ לפי שעה
              </h5>
              <div className="space-y-1 text-sm">
                {Object.entries(stats.byHour)
                  .sort((a, b) => b[1] - a[1])
                  .map(([time, count]) => (
                    <div key={time} className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">{time}</span>
                      <span className="font-medium text-gray-900 dark:text-white">{count}</span>
                    </div>
                  ))}
              </div>
            </div>
            
            {/* לפי יום */}
            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                📅 לפי יום
              </h5>
              <div className="space-y-1 text-sm">
                {Object.entries(stats.byDay)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 3)
                  .map(([day, count]) => (
                    <div key={day} className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">יום {day}</span>
                      <span className="font-medium text-gray-900 dark:text-white">{count}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
          
          {/* טיפים מותאמים */}
          {stats.tips && stats.tips.length > 0 && (
            <div className="mb-6">
              <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <span>💡</span> טיפים עבורך
              </h4>
              <div className="space-y-3">
                {stats.tips.map((tip, index) => (
                  <InsightCard
                    key={index}
                    emoji={tip.emoji}
                    title={tip.title}
                    text={tip.text}
                    highlight={index === 0}
                  />
                ))}
              </div>
            </div>
          )}
          
          {/* כפתור סגירה */}
          <button
            onClick={onClose}
            className="w-full py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium"
          >
            סגור
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
