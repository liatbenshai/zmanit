/**
 * PreTaskCheckin - רגע האמת / צ'ק-אין לפני משימה
 * ================================================
 * לפני התחלת משימה: "מה עלול להפריע לך עכשיו?"
 * יוצר "ריטואל התחלה" שעוזר להיכנס למצב ריכוז
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// פריטי צ'קליסט ברירת מחדל
const DEFAULT_CHECKLIST = [
  { id: 'phone', emoji: '📱', label: 'טלפון במצב שקט', tip: 'התראות מפריעות לריכוז' },
  { id: 'tabs', emoji: '🌐', label: 'סגרתי טאבים מיותרים', tip: 'פחות פיתויים = יותר מיקוד' },
  { id: 'water', emoji: '💧', label: 'יש לי מים/קפה', tip: 'צמא מסיח דעת' },
  { id: 'notify', emoji: '🚪', label: 'הודעתי שאני עסוקה', tip: 'מניעת הפרעות' },
  { id: 'clear', emoji: '🧹', label: 'שולחן נקי', tip: 'סביבה מסודרת = מוח מסודר' }
];

const STORAGE_KEY = 'pretask_checkin_settings';
const STATS_KEY = 'pretask_checkin_stats';

/**
 * טעינת הגדרות
 */
function loadSettings() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {}
  return {
    enabled: true,
    showForAllTasks: false, // רק למשימות ארוכות
    minDurationMinutes: 30, // הצג רק למשימות של 30+ דקות
    checklist: DEFAULT_CHECKLIST,
    customItems: []
  };
}

/**
 * שמירת הגדרות
 */
function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

/**
 * שמירת סטטיסטיקות
 */
function saveCheckinStats(checkedItems, skipped = false) {
  try {
    const stats = JSON.parse(localStorage.getItem(STATS_KEY) || '{"sessions": []}');
    
    stats.sessions.push({
      timestamp: new Date().toISOString(),
      checkedItems,
      skipped,
      itemCount: checkedItems.length
    });
    
    // שמירת 90 יום
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    stats.sessions = stats.sessions.filter(s => new Date(s.timestamp) > ninetyDaysAgo);
    
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch (e) {}
}

/**
 * קבלת סטטיסטיקות
 */
export function getCheckinStats() {
  try {
    const stats = JSON.parse(localStorage.getItem(STATS_KEY) || '{"sessions": []}');
    
    if (stats.sessions.length === 0) return null;
    
    const total = stats.sessions.length;
    const completed = stats.sessions.filter(s => !s.skipped).length;
    const skipped = stats.sessions.filter(s => s.skipped).length;
    
    // הפריט הכי פופולרי
    const itemCounts = {};
    stats.sessions.forEach(s => {
      s.checkedItems?.forEach(item => {
        itemCounts[item] = (itemCounts[item] || 0) + 1;
      });
    });
    
    const mostChecked = Object.entries(itemCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    
    return {
      totalSessions: total,
      completedSessions: completed,
      skippedSessions: skipped,
      completionRate: Math.round((completed / total) * 100),
      mostCheckedItems: mostChecked
    };
  } catch (e) {
    return null;
  }
}

/**
 * מודל צ'ק-אין
 */
export default function PreTaskCheckin({ 
  isOpen, 
  onClose, 
  onStart, 
  taskTitle, 
  taskDuration 
}) {
  const [settings] = useState(loadSettings);
  const [checkedItems, setCheckedItems] = useState([]);
  const [showTip, setShowTip] = useState(null);
  
  // איפוס בפתיחה
  useEffect(() => {
    if (isOpen) {
      setCheckedItems([]);
      setShowTip(null);
    }
  }, [isOpen]);
  
  if (!isOpen) return null;
  
  const allItems = [...settings.checklist, ...settings.customItems];
  const allChecked = checkedItems.length === allItems.length;
  
  const toggleItem = (itemId) => {
    setCheckedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };
  
  const handleStart = () => {
    saveCheckinStats(checkedItems, false);
    onStart();
    onClose();
  };
  
  const handleSkip = () => {
    saveCheckinStats([], true);
    onStart();
    onClose();
  };
  
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full shadow-xl"
        >
          {/* כותרת */}
          <div className="text-center mb-6">
            <span className="text-4xl block mb-2">🎯</span>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              רגע לפני שמתחילים...
            </h3>
            {taskTitle && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                "{taskTitle}" {taskDuration && `(${taskDuration} דק')`}
              </p>
            )}
          </div>
          
          {/* צ'קליסט */}
          <div className="space-y-2 mb-6">
            {allItems.map(item => (
              <motion.button
                key={item.id}
                onClick={() => toggleItem(item.id)}
                onMouseEnter={() => setShowTip(item.id)}
                onMouseLeave={() => setShowTip(null)}
                className={`w-full p-3 rounded-xl flex items-center gap-3 transition-all ${
                  checkedItems.includes(item.id)
                    ? 'bg-green-100 dark:bg-green-900/30 border-2 border-green-500'
                    : 'bg-gray-50 dark:bg-gray-700 border-2 border-transparent hover:border-gray-300 dark:hover:border-gray-600'
                }`}
                whileTap={{ scale: 0.98 }}
              >
                <span className="text-2xl">{item.emoji}</span>
                <span className="flex-1 text-right text-gray-700 dark:text-gray-200">
                  {item.label}
                </span>
                <span className={`text-xl transition-transform ${
                  checkedItems.includes(item.id) ? 'scale-100' : 'scale-0'
                }`}>
                  ✓
                </span>
              </motion.button>
            ))}
          </div>
          
          {/* טיפ */}
          <AnimatePresence>
            {showTip && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-700 dark:text-blue-300"
              >
                💡 {allItems.find(i => i.id === showTip)?.tip}
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* הודעת עידוד */}
          {allChecked && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-center"
            >
              <span className="text-green-700 dark:text-green-300">
                🌟 מעולה! את מוכנה למיקוד מלא!
              </span>
            </motion.div>
          )}
          
          {/* כפתורים */}
          <div className="space-y-2">
            <button
              onClick={handleStart}
              className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
                checkedItems.length > 0
                  ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg'
                  : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white'
              }`}
            >
              {allChecked ? '🚀 מוכנה! בואי נתחיל!' : '▶️ התחל לעבוד'}
            </button>
            
            <button
              onClick={handleSkip}
              className="w-full py-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm"
            >
              דלג על הצ'קליסט
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * הגדרות צ'ק-אין
 */
export function PreTaskCheckinSettings() {
  const [settings, setSettings] = useState(loadSettings);
  const [newItem, setNewItem] = useState('');
  const stats = getCheckinStats();
  
  const updateSettings = (updates) => {
    const updated = { ...settings, ...updates };
    setSettings(updated);
    saveSettings(updated);
  };
  
  const addCustomItem = () => {
    if (newItem.trim()) {
      const item = {
        id: `custom_${Date.now()}`,
        emoji: '✨',
        label: newItem.trim(),
        tip: 'פריט מותאם אישית'
      };
      updateSettings({
        customItems: [...settings.customItems, item]
      });
      setNewItem('');
    }
  };
  
  const removeCustomItem = (id) => {
    updateSettings({
      customItems: settings.customItems.filter(i => i.id !== id)
    });
  };
  
  return (
    <div className="space-y-4">
      <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
        <span>🎯</span>
        הגדרות צ'ק-אין לפני משימה
      </h3>
      
      {/* הפעלה */}
      <label className="flex items-center justify-between">
        <span className="text-gray-700 dark:text-gray-300">הפעל צ'ק-אין</span>
        <input
          type="checkbox"
          checked={settings.enabled}
          onChange={e => updateSettings({ enabled: e.target.checked })}
          className="w-5 h-5 rounded"
        />
      </label>
      
      {settings.enabled && (
        <>
          {/* הגבלת זמן */}
          <div>
            <label className="text-sm text-gray-600 dark:text-gray-400 block mb-1">
              הצג רק למשימות של (דקות ומעלה):
            </label>
            <input
              type="number"
              value={settings.minDurationMinutes}
              onChange={e => updateSettings({ minDurationMinutes: parseInt(e.target.value) || 0 })}
              className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              min="0"
              max="120"
            />
            <p className="text-xs text-gray-500 mt-1">
              0 = הצג לכל המשימות
            </p>
          </div>
          
          {/* פריטים מותאמים */}
          <div>
            <label className="text-sm text-gray-600 dark:text-gray-400 block mb-2">
              פריטים מותאמים אישית:
            </label>
            
            {settings.customItems.length > 0 && (
              <div className="space-y-2 mb-3">
                {settings.customItems.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {item.emoji} {item.label}
                    </span>
                    <button
                      onClick={() => removeCustomItem(item.id)}
                      className="text-red-500 hover:text-red-600 text-sm"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            <div className="flex gap-2">
              <input
                type="text"
                value={newItem}
                onChange={e => setNewItem(e.target.value)}
                placeholder="הוסף פריט חדש..."
                className="flex-1 p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                onKeyPress={e => e.key === 'Enter' && addCustomItem()}
              />
              <button
                onClick={addCustomItem}
                className="px-3 py-2 bg-blue-500 text-white rounded-lg text-sm"
              >
                +
              </button>
            </div>
          </div>
          
          {/* סטטיסטיקות */}
          {stats && (
            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">סטטיסטיקות:</div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-500">סשנים:</span>
                  <span className="font-medium mr-1">{stats.totalSessions}</span>
                </div>
                <div>
                  <span className="text-gray-500">השלמה:</span>
                  <span className="font-medium mr-1">{stats.completionRate}%</span>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
