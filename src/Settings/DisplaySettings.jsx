import { useState, useEffect } from 'react';
import { useSettings } from '../../context/SettingsContext';
import toast from 'react-hot-toast';

/**
 * הגדרות תצוגה
 */
function DisplaySettings() {
  const { display, updateSettings, saving } = useSettings();
  const [localSettings, setLocalSettings] = useState(display);

  useEffect(() => {
    setLocalSettings(display);
  }, [display]);

  const handleChange = (key, value) => {
    setLocalSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSave = async () => {
    try {
      await updateSettings('display', localSettings);
      
      // החלת ערכת נושא
      applyTheme(localSettings.theme);
      
      toast.success('הגדרות התצוגה נשמרו');
    } catch (err) {
      toast.error('שגיאה בשמירה');
    }
  };

  const applyTheme = (theme) => {
    const root = document.documentElement;
    
    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'light') {
      root.classList.remove('dark');
    } else {
      // system
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  };

  const themeOptions = [
    { id: 'system', name: 'לפי המערכת', icon: '💻' },
    { id: 'light', name: 'בהיר', icon: '☀️' },
    { id: 'dark', name: 'כהה', icon: '🌙' }
  ];

  const viewOptions = [
    { id: 'daily', name: 'תצוגה יומית', icon: '📅' },
    { id: 'weekly', name: 'תצוגה שבועית', icon: '📆' },
    { id: 'smart', name: 'דשבורד חכם', icon: '🎯' }
  ];

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6">
        🎨 תצוגה
      </h2>

      {/* ערכת נושא */}
      <div className="mb-6">
        <h3 className="font-medium text-gray-900 dark:text-white mb-3">ערכת נושא</h3>
        <div className="grid grid-cols-3 gap-3">
          {themeOptions.map(theme => (
            <button
              key={theme.id}
              onClick={() => handleChange('theme', theme.id)}
              className={`
                p-4 rounded-xl border-2 transition-all duration-200 text-center
                ${localSettings.theme === theme.id
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }
              `}
            >
              <span className="text-3xl block mb-2">{theme.icon}</span>
              <span className={`
                font-medium
                ${localSettings.theme === theme.id
                  ? 'text-blue-700 dark:text-blue-300'
                  : 'text-gray-700 dark:text-gray-300'
                }
              `}>
                {theme.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* תצוגת ברירת מחדל */}
      <div className="mb-6">
        <h3 className="font-medium text-gray-900 dark:text-white mb-3">תצוגת ברירת מחדל</h3>
        <div className="grid grid-cols-3 gap-3">
          {viewOptions.map(view => (
            <button
              key={view.id}
              onClick={() => handleChange('defaultView', view.id)}
              className={`
                p-4 rounded-xl border-2 transition-all duration-200 text-center
                ${localSettings.defaultView === view.id
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }
              `}
            >
              <span className="text-3xl block mb-2">{view.icon}</span>
              <span className={`
                font-medium text-sm
                ${localSettings.defaultView === view.id
                  ? 'text-purple-700 dark:text-purple-300'
                  : 'text-gray-700 dark:text-gray-300'
                }
              `}>
                {view.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* אפשרויות תצוגה */}
      <div className="space-y-3">
        <h3 className="font-medium text-gray-900 dark:text-white mb-3">אפשרויות</h3>
        
        <label className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <span className="text-xl">✅</span>
            <div>
              <div className="text-gray-900 dark:text-white">הצג משימות שהושלמו</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">משימות שהסתיימו יופיעו בסוף הרשימה</div>
            </div>
          </div>
          <button
            onClick={() => handleChange('showCompletedTasks', !localSettings.showCompletedTasks)}
            className={`
              relative w-12 h-6 rounded-full transition-colors duration-200
              ${localSettings.showCompletedTasks ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}
            `}
          >
            <div
              className={`
                absolute top-1 w-4 h-4 bg-white rounded-full transition-transform duration-200
                ${localSettings.showCompletedTasks ? 'right-1' : 'left-1'}
              `}
            />
          </button>
        </label>

        <label className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <span className="text-xl">📊</span>
            <div>
              <div className="text-gray-900 dark:text-white">הצג פסי התקדמות</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">בר ויזואלי של זמן שהושקע</div>
            </div>
          </div>
          <button
            onClick={() => handleChange('showProgressBars', !localSettings.showProgressBars)}
            className={`
              relative w-12 h-6 rounded-full transition-colors duration-200
              ${localSettings.showProgressBars ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}
            `}
          >
            <div
              className={`
                absolute top-1 w-4 h-4 bg-white rounded-full transition-transform duration-200
                ${localSettings.showProgressBars ? 'right-1' : 'left-1'}
              `}
            />
          </button>
        </label>

        <label className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <span className="text-xl">⏱️</span>
            <div>
              <div className="text-gray-900 dark:text-white">הצג הערכות זמן</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">זמן משוער לכל משימה</div>
            </div>
          </div>
          <button
            onClick={() => handleChange('showTimeEstimates', !localSettings.showTimeEstimates)}
            className={`
              relative w-12 h-6 rounded-full transition-colors duration-200
              ${localSettings.showTimeEstimates ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}
            `}
          >
            <div
              className={`
                absolute top-1 w-4 h-4 bg-white rounded-full transition-transform duration-200
                ${localSettings.showTimeEstimates ? 'right-1' : 'left-1'}
              `}
            />
          </button>
        </label>

        <label className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <span className="text-xl">📱</span>
            <div>
              <div className="text-gray-900 dark:text-white">מצב קומפקטי</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">תצוגה צפופה יותר</div>
            </div>
          </div>
          <button
            onClick={() => handleChange('compactMode', !localSettings.compactMode)}
            className={`
              relative w-12 h-6 rounded-full transition-colors duration-200
              ${localSettings.compactMode ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}
            `}
          >
            <div
              className={`
                absolute top-1 w-4 h-4 bg-white rounded-full transition-transform duration-200
                ${localSettings.compactMode ? 'right-1' : 'left-1'}
              `}
            />
          </button>
        </label>
      </div>

      {/* כפתור שמירה */}
      <div className="mt-6">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors disabled:opacity-50 font-medium"
        >
          {saving ? '⏳ שומר...' : '✓ שמור הגדרות תצוגה'}
        </button>
      </div>
    </div>
  );
}

export default DisplaySettings;
