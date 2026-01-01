import { useState, useEffect } from 'react';
import { useSettings } from '../../context/SettingsContext';
import toast from 'react-hot-toast';

/**
 * הגדרות טיימר
 */
function TimerSettings() {
  const { timerSettings, updateSettings, saving } = useSettings();
  const [localSettings, setLocalSettings] = useState(timerSettings);

  useEffect(() => {
    setLocalSettings(timerSettings);
  }, [timerSettings]);

  const handleChange = (key, value) => {
    setLocalSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSave = async () => {
    try {
      await updateSettings('timer', localSettings);
      toast.success('הגדרות הטיימר נשמרו');
    } catch (err) {
      toast.error('שגיאה בשמירה');
    }
  };

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6">
        ⏱️ טיימר
      </h2>

      {/* הגדרות בסיסיות */}
      <div className="space-y-4 mb-8">
        <h3 className="font-medium text-gray-900 dark:text-white">הגדרות כלליות</h3>
        
        <label className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <span className="text-xl">▶️</span>
            <div>
              <div className="text-gray-900 dark:text-white">התחל אוטומטית</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">הטיימר יתחיל כשפותחים משימה</div>
            </div>
          </div>
          <button
            onClick={() => handleChange('autoStart', !localSettings.autoStart)}
            className={`
              relative w-12 h-6 rounded-full transition-colors duration-200
              ${localSettings.autoStart ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}
            `}
          >
            <div
              className={`
                absolute top-1 w-4 h-4 bg-white rounded-full transition-transform duration-200
                ${localSettings.autoStart ? 'right-1' : 'left-1'}
              `}
            />
          </button>
        </label>

        <label className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <span className="text-xl">✅</span>
            <div>
              <div className="text-gray-900 dark:text-white">השלם אוטומטית</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">סמן כהושלם כשהזמן נגמר</div>
            </div>
          </div>
          <button
            onClick={() => handleChange('autoComplete', !localSettings.autoComplete)}
            className={`
              relative w-12 h-6 rounded-full transition-colors duration-200
              ${localSettings.autoComplete ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}
            `}
          >
            <div
              className={`
                absolute top-1 w-4 h-4 bg-white rounded-full transition-transform duration-200
                ${localSettings.autoComplete ? 'right-1' : 'left-1'}
              `}
            />
          </button>
        </label>

        <label className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <span className="text-xl">📌</span>
            <div>
              <div className="text-gray-900 dark:text-white">הצג בכותרת הדף</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">הזמן יופיע בטאב הדפדפן</div>
            </div>
          </div>
          <button
            onClick={() => handleChange('showInTitle', !localSettings.showInTitle)}
            className={`
              relative w-12 h-6 rounded-full transition-colors duration-200
              ${localSettings.showInTitle ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}
            `}
          >
            <div
              className={`
                absolute top-1 w-4 h-4 bg-white rounded-full transition-transform duration-200
                ${localSettings.showInTitle ? 'right-1' : 'left-1'}
              `}
            />
          </button>
        </label>

        <label className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <span className="text-xl">🔊</span>
            <div>
              <div className="text-gray-900 dark:text-white">צליל טיקים</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">צליל קטן כל שנייה</div>
            </div>
          </div>
          <button
            onClick={() => handleChange('tickSound', !localSettings.tickSound)}
            className={`
              relative w-12 h-6 rounded-full transition-colors duration-200
              ${localSettings.tickSound ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}
            `}
          >
            <div
              className={`
                absolute top-1 w-4 h-4 bg-white rounded-full transition-transform duration-200
                ${localSettings.tickSound ? 'right-1' : 'left-1'}
              `}
            />
          </button>
        </label>
      </div>

      {/* מצב פומודורו */}
      <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-200 dark:border-orange-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🍅</span>
            <div>
              <div className="font-medium text-gray-900 dark:text-white">מצב פומודורו</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">עבודה ממוקדת עם הפסקות קצרות</div>
            </div>
          </div>
          <button
            onClick={() => handleChange('pomodoroMode', !localSettings.pomodoroMode)}
            className={`
              relative w-14 h-7 rounded-full transition-colors duration-200
              ${localSettings.pomodoroMode ? 'bg-orange-500' : 'bg-gray-300 dark:bg-gray-600'}
            `}
          >
            <div
              className={`
                absolute top-1 w-5 h-5 bg-white rounded-full transition-transform duration-200
                ${localSettings.pomodoroMode ? 'right-1' : 'left-1'}
              `}
            />
          </button>
        </div>

        {localSettings.pomodoroMode && (
          <div className="space-y-4 pt-4 border-t border-orange-200 dark:border-orange-700">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                  זמן עבודה (דקות)
                </label>
                <input
                  type="number"
                  value={localSettings.pomodoroDuration}
                  onChange={(e) => handleChange('pomodoroDuration', parseInt(e.target.value) || 25)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  min="10"
                  max="60"
                  step="5"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                  הפסקה קצרה (דקות)
                </label>
                <input
                  type="number"
                  value={localSettings.shortBreak}
                  onChange={(e) => handleChange('shortBreak', parseInt(e.target.value) || 5)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  min="1"
                  max="15"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                  הפסקה ארוכה (דקות)
                </label>
                <input
                  type="number"
                  value={localSettings.longBreak}
                  onChange={(e) => handleChange('longBreak', parseInt(e.target.value) || 15)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  min="5"
                  max="30"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                  הפסקה ארוכה אחרי
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={localSettings.longBreakAfter}
                    onChange={(e) => handleChange('longBreakAfter', parseInt(e.target.value) || 4)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    min="2"
                    max="8"
                  />
                  <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">סבבים</span>
                </div>
              </div>
            </div>

            {/* תצוגה מקדימה */}
            <div className="p-3 bg-white dark:bg-gray-700 rounded-lg">
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">סבב פומודורו:</div>
              <div className="flex items-center gap-2 flex-wrap">
                {[1, 2, 3, 4].slice(0, localSettings.longBreakAfter).map((num, i) => (
                  <div key={num} className="flex items-center gap-1">
                    <div className="px-3 py-1 bg-orange-100 dark:bg-orange-900/30 rounded-lg text-sm">
                      🍅 {localSettings.pomodoroDuration} דק'
                    </div>
                    {i < localSettings.longBreakAfter - 1 && (
                      <div className="px-2 py-1 bg-green-100 dark:bg-green-900/30 rounded-lg text-xs">
                        ☕ {localSettings.shortBreak}
                      </div>
                    )}
                  </div>
                ))}
                <div className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-sm">
                  🛋️ {localSettings.longBreak} דק'
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* כפתור שמירה */}
      <div className="mt-6">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors disabled:opacity-50 font-medium"
        >
          {saving ? '⏳ שומר...' : '✓ שמור הגדרות טיימר'}
        </button>
      </div>
    </div>
  );
}

export default TimerSettings;
