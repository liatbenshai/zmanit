/**
 * EmergencyBuffer - חלון בלת"מים מתוכנן
 * =====================================
 * המערכת שומרת 60-90 דקות ביום לדברים לא צפויים
 * אם אין בלת"מים - הזמן מתפנה למשימות שנדחו
 */

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// הגדרות ברירת מחדל
const DEFAULT_BUFFER_MINUTES = 60;
const STORAGE_KEY = 'emergency_buffer_settings';
const USAGE_KEY = 'emergency_buffer_usage';

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
    dailyBufferMinutes: DEFAULT_BUFFER_MINUTES,
    preferredTime: 'afternoon', // morning, afternoon, evening
    autoRelease: true, // שחרור אוטומטי בסוף היום
    releaseHour: 16 // שעה לשחרור הזמן שלא נוצל
  };
}

/**
 * שמירת הגדרות
 */
function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

/**
 * טעינת שימוש יומי
 */
function loadTodayUsage() {
  try {
    const saved = localStorage.getItem(USAGE_KEY);
    if (saved) {
      const data = JSON.parse(saved);
      const today = new Date().toISOString().split('T')[0];
      if (data.date === today) {
        return data;
      }
    }
  } catch (e) {}
  return {
    date: new Date().toISOString().split('T')[0],
    usedMinutes: 0,
    emergencies: [],
    released: false
  };
}

/**
 * שמירת שימוש יומי
 */
function saveTodayUsage(usage) {
  localStorage.setItem(USAGE_KEY, JSON.stringify(usage));
}

/**
 * רישום בלת"ם
 */
export function logEmergency(description, minutesUsed) {
  const usage = loadTodayUsage();
  usage.emergencies.push({
    id: Date.now(),
    description,
    minutes: minutesUsed,
    timestamp: new Date().toISOString()
  });
  usage.usedMinutes += minutesUsed;
  saveTodayUsage(usage);
  return usage;
}

/**
 * שחרור זמן שלא נוצל
 */
export function releaseUnusedBuffer() {
  const usage = loadTodayUsage();
  const settings = loadSettings();
  
  if (!usage.released) {
    const unusedMinutes = settings.dailyBufferMinutes - usage.usedMinutes;
    usage.released = true;
    usage.releasedMinutes = Math.max(0, unusedMinutes);
    usage.releasedAt = new Date().toISOString();
    saveTodayUsage(usage);
    return unusedMinutes;
  }
  return 0;
}

/**
 * קבלת סטטיסטיקות היסטוריות
 */
export function getBufferStats() {
  try {
    const history = JSON.parse(localStorage.getItem('emergency_buffer_history') || '[]');
    
    if (history.length === 0) {
      return null;
    }
    
    const totalDays = history.length;
    const daysWithEmergencies = history.filter(d => d.usedMinutes > 0).length;
    const avgUsed = Math.round(history.reduce((sum, d) => sum + d.usedMinutes, 0) / totalDays);
    const avgReleased = Math.round(history.reduce((sum, d) => sum + (d.releasedMinutes || 0), 0) / totalDays);
    
    return {
      totalDays,
      daysWithEmergencies,
      percentWithEmergencies: Math.round((daysWithEmergencies / totalDays) * 100),
      avgUsedMinutes: avgUsed,
      avgReleasedMinutes: avgReleased
    };
  } catch (e) {
    return null;
  }
}

/**
 * שמירה להיסטוריה (נקרא בסוף יום)
 */
export function saveToHistory() {
  const usage = loadTodayUsage();
  const settings = loadSettings();
  
  try {
    const history = JSON.parse(localStorage.getItem('emergency_buffer_history') || '[]');
    
    // בדיקה שלא כבר נשמר היום
    if (!history.find(h => h.date === usage.date)) {
      history.push({
        date: usage.date,
        bufferMinutes: settings.dailyBufferMinutes,
        usedMinutes: usage.usedMinutes,
        releasedMinutes: usage.releasedMinutes || (settings.dailyBufferMinutes - usage.usedMinutes),
        emergencyCount: usage.emergencies.length
      });
      
      // שמירת 90 יום אחרונים
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const filtered = history.filter(h => new Date(h.date) > ninetyDaysAgo);
      
      localStorage.setItem('emergency_buffer_history', JSON.stringify(filtered));
    }
  } catch (e) {}
}

/**
 * Hook לניהול חלון בלת"מים
 */
export function useEmergencyBuffer() {
  const [settings, setSettings] = useState(loadSettings);
  const [usage, setUsage] = useState(loadTodayUsage);
  
  // בדיקת שחרור אוטומטי
  useEffect(() => {
    if (!settings.autoRelease || usage.released) return;
    
    const checkRelease = () => {
      const now = new Date();
      if (now.getHours() >= settings.releaseHour) {
        const released = releaseUnusedBuffer();
        if (released > 0) {
          setUsage(loadTodayUsage());
        }
      }
    };
    
    checkRelease();
    const interval = setInterval(checkRelease, 60 * 1000); // בדיקה כל דקה
    
    return () => clearInterval(interval);
  }, [settings.autoRelease, settings.releaseHour, usage.released]);
  
  const remainingBuffer = useMemo(() => {
    return Math.max(0, settings.dailyBufferMinutes - usage.usedMinutes);
  }, [settings.dailyBufferMinutes, usage.usedMinutes]);
  
  const updateSettings = (newSettings) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    saveSettings(updated);
  };
  
  const addEmergency = (description, minutes) => {
    const updated = logEmergency(description, minutes);
    setUsage(updated);
  };
  
  return {
    settings,
    usage,
    remainingBuffer,
    updateSettings,
    addEmergency,
    releaseBuffer: () => {
      const released = releaseUnusedBuffer();
      setUsage(loadTodayUsage());
      return released;
    }
  };
}

/**
 * כרטיס חלון בלת"מים לדשבורד
 */
export function EmergencyBufferCard({ onAddEmergency }) {
  const { settings, usage, remainingBuffer, releaseBuffer } = useEmergencyBuffer();
  const [showAddModal, setShowAddModal] = useState(false);
  const [emergencyDesc, setEmergencyDesc] = useState('');
  const [emergencyMinutes, setEmergencyMinutes] = useState(15);
  
  if (!settings.enabled) return null;
  
  const percentUsed = Math.round((usage.usedMinutes / settings.dailyBufferMinutes) * 100);
  const isReleased = usage.released;
  
  const handleAddEmergency = () => {
    if (emergencyMinutes > 0) {
      logEmergency(emergencyDesc || 'בלת"ם', emergencyMinutes);
      setShowAddModal(false);
      setEmergencyDesc('');
      setEmergencyMinutes(15);
      if (onAddEmergency) onAddEmergency();
    }
  };
  
  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-xl p-4 border ${
          isReleased
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
            : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
        }`}
      >
        {/* כותרת */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span>🆘</span>
            חלון בלת"מים
          </h3>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {settings.dailyBufferMinutes} דק' ביום
          </span>
        </div>
        
        {/* פס התקדמות */}
        <div className="mb-3">
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${percentUsed}%` }}
              className={`h-full rounded-full ${
                percentUsed > 80 
                  ? 'bg-red-500' 
                  : percentUsed > 50 
                    ? 'bg-amber-500' 
                    : 'bg-green-500'
              }`}
            />
          </div>
          <div className="flex justify-between mt-1 text-xs text-gray-500 dark:text-gray-400">
            <span>{usage.usedMinutes} דק' נוצלו</span>
            <span>{remainingBuffer} דק' נותרו</span>
          </div>
        </div>
        
        {/* סטטוס */}
        {isReleased ? (
          <div className="text-center p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
            <span className="text-green-700 dark:text-green-300 text-sm">
              ✨ {usage.releasedMinutes} דקות שוחררו למשימות אחרות!
            </span>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => setShowAddModal(true)}
              className="flex-1 py-2 px-3 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              🔥 רשום בלת"ם
            </button>
            {remainingBuffer > 0 && new Date().getHours() >= 14 && (
              <button
                onClick={releaseBuffer}
                className="py-2 px-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm transition-colors"
                title="שחרר זמן שלא נוצל"
              >
                🔓
              </button>
            )}
          </div>
        )}
        
        {/* רשימת בלת"מים של היום */}
        {usage.emergencies.length > 0 && (
          <div className="mt-3 pt-3 border-t border-amber-200 dark:border-amber-700">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              בלת"מים היום ({usage.emergencies.length}):
            </div>
            <div className="space-y-1">
              {usage.emergencies.slice(-3).map(e => (
                <div key={e.id} className="flex justify-between text-xs">
                  <span className="text-gray-600 dark:text-gray-300">{e.description}</span>
                  <span className="text-gray-500">{e.minutes} דק'</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
      
      {/* מודל הוספת בלת"ם */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-5 max-w-sm w-full"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                🔥 רישום בלת"ם
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-600 dark:text-gray-400 block mb-1">
                    מה קרה?
                  </label>
                  <input
                    type="text"
                    value={emergencyDesc}
                    onChange={e => setEmergencyDesc(e.target.value)}
                    placeholder='למשל: "שיחה דחופה עם לקוח"'
                    className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>
                
                <div>
                  <label className="text-sm text-gray-600 dark:text-gray-400 block mb-1">
                    כמה זמן לקח? (דקות)
                  </label>
                  <div className="flex gap-2">
                    {[15, 30, 45, 60].map(min => (
                      <button
                        key={min}
                        onClick={() => setEmergencyMinutes(min)}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                          emergencyMinutes === min
                            ? 'bg-amber-500 text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {min}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg"
                >
                  ביטול
                </button>
                <button
                  onClick={handleAddEmergency}
                  className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium"
                >
                  שמור
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/**
 * הגדרות חלון בלת"מים
 */
export function EmergencyBufferSettings() {
  const { settings, updateSettings } = useEmergencyBuffer();
  const stats = getBufferStats();
  
  return (
    <div className="space-y-4">
      <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
        <span>🆘</span>
        הגדרות חלון בלת"מים
      </h3>
      
      {/* הפעלה/כיבוי */}
      <label className="flex items-center justify-between">
        <span className="text-gray-700 dark:text-gray-300">הפעל חלון בלת"מים</span>
        <input
          type="checkbox"
          checked={settings.enabled}
          onChange={e => updateSettings({ enabled: e.target.checked })}
          className="w-5 h-5 rounded"
        />
      </label>
      
      {settings.enabled && (
        <>
          {/* זמן יומי */}
          <div>
            <label className="text-sm text-gray-600 dark:text-gray-400 block mb-1">
              זמן יומי לבלת"מים (דקות)
            </label>
            <input
              type="range"
              min="30"
              max="120"
              step="15"
              value={settings.dailyBufferMinutes}
              onChange={e => updateSettings({ dailyBufferMinutes: parseInt(e.target.value) })}
              className="w-full"
            />
            <div className="text-center text-sm text-gray-500">
              {settings.dailyBufferMinutes} דקות
            </div>
          </div>
          
          {/* שחרור אוטומטי */}
          <label className="flex items-center justify-between">
            <span className="text-gray-700 dark:text-gray-300">שחרור אוטומטי של זמן שלא נוצל</span>
            <input
              type="checkbox"
              checked={settings.autoRelease}
              onChange={e => updateSettings({ autoRelease: e.target.checked })}
              className="w-5 h-5 rounded"
            />
          </label>
          
          {/* סטטיסטיקות */}
          {stats && (
            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">סטטיסטיקות:</div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-500">ימים עם בלת"מים:</span>
                  <span className="font-medium mr-1">{stats.percentWithEmergencies}%</span>
                </div>
                <div>
                  <span className="text-gray-500">ממוצע שימוש:</span>
                  <span className="font-medium mr-1">{stats.avgUsedMinutes} דק'</span>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default EmergencyBufferCard;
