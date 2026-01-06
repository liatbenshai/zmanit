import { useState, useEffect } from 'react';
import { useSettings } from '../../context/SettingsContext';
import toast from 'react-hot-toast';

/**
 * הגדרות התראות
 */
function NotificationsSettings() {
  const { notifications, updateSettings, saving } = useSettings();
  const [localSettings, setLocalSettings] = useState(notifications);
  const [permissionStatus, setPermissionStatus] = useState('default');

  useEffect(() => {
    setLocalSettings(notifications);
    
    // בדיקת הרשאות התראות
    if ('Notification' in window) {
      setPermissionStatus(Notification.permission);
    }
  }, [notifications]);

  const requestPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setPermissionStatus(permission);
      
      if (permission === 'granted') {
        toast.success('התראות אושרו!');
        // שליחת התראת בדיקה
        new Notification('🎉 התראות פועלות!', {
          body: 'תקבלי התראות על משימות ותזכורות',
          icon: '/icon-192.png'
        });
      } else {
        toast.error('ההתראות נחסמו');
      }
    }
  };

  const handleChange = (key, value) => {
    setLocalSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleNestedChange = (parent, key, value) => {
    setLocalSettings(prev => ({
      ...prev,
      [parent]: {
        ...prev[parent],
        [key]: value
      }
    }));
  };

  const handleSave = async () => {
    try {
      await updateSettings('notifications', localSettings);
      toast.success('הגדרות ההתראות נשמרו');
    } catch (err) {
      toast.error('שגיאה בשמירה');
    }
  };

  const testNotification = () => {
    if (permissionStatus !== 'granted') {
      toast.error('יש לאשר התראות קודם');
      return;
    }
    
    new Notification('🔔 התראת בדיקה', {
      body: 'זו התראת בדיקה מהמערכת',
      icon: '/icon-192.png'
    });
  };

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6">
        🔔 התראות
      </h2>

      {/* סטטוס הרשאות */}
      <div className={`
        p-4 rounded-xl mb-6 border
        ${permissionStatus === 'granted' 
          ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
          : permissionStatus === 'denied'
          ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
          : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
        }
      `}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">
              {permissionStatus === 'granted' ? '✅' : permissionStatus === 'denied' ? '❌' : '⚠️'}
            </span>
            <div>
              <div className="font-medium text-gray-900 dark:text-white">
                {permissionStatus === 'granted' 
                  ? 'התראות מאושרות'
                  : permissionStatus === 'denied'
                  ? 'התראות חסומות'
                  : 'התראות לא אושרו'
                }
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {permissionStatus === 'denied' && 'יש לאשר בהגדרות הדפדפן'}
              </div>
            </div>
          </div>
          
          <div className="flex gap-2">
            {permissionStatus !== 'granted' && permissionStatus !== 'denied' && (
              <button
                onClick={requestPermission}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                אשר התראות
              </button>
            )}
            {permissionStatus === 'granted' && (
              <button
                onClick={testNotification}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
              >
                בדיקה
              </button>
            )}
          </div>
        </div>
      </div>

      {/* הפעלה כללית */}
      <div className="mb-6">
        <label className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <span className="text-xl">🔔</span>
            <div>
              <div className="font-medium text-gray-900 dark:text-white">הפעל התראות</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">התראות על משימות ותזכורות</div>
            </div>
          </div>
          <button
            onClick={() => handleChange('enabled', !localSettings.enabled)}
            className={`
              relative w-14 h-7 rounded-full transition-colors duration-200
              ${localSettings.enabled ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}
            `}
          >
            <div
              className={`
                absolute top-1 w-5 h-5 bg-white rounded-full transition-transform duration-200
                ${localSettings.enabled ? 'right-1' : 'left-1'}
              `}
            />
          </button>
        </label>
      </div>

      {/* הגדרות ספציפיות */}
      <div className="space-y-4">
        {/* תזכורת לפני משימה */}
        <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <span className="text-xl">⏰</span>
              <span className="font-medium text-gray-900 dark:text-white">תזכורת לפני משימה</span>
            </div>
            <button
              onClick={() => handleNestedChange('taskReminder', 'enabled', !localSettings.taskReminder?.enabled)}
              className={`
                relative w-12 h-6 rounded-full transition-colors duration-200
                ${localSettings.taskReminder?.enabled ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}
              `}
            >
              <div
                className={`
                  absolute top-1 w-4 h-4 bg-white rounded-full transition-transform duration-200
                  ${localSettings.taskReminder?.enabled ? 'right-1' : 'left-1'}
                `}
              />
            </button>
          </div>
          {localSettings.taskReminder?.enabled && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">תזכר אותי</span>
              <input
                type="number"
                value={localSettings.taskReminder?.minutesBefore || 5}
                onChange={(e) => handleNestedChange('taskReminder', 'minutesBefore', parseInt(e.target.value) || 5)}
                className="w-16 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-center"
                min="1"
                max="60"
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">דקות לפני</span>
            </div>
          )}
        </div>

        {/* סיכום יומי */}
        <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <span className="text-xl">🌅</span>
              <span className="font-medium text-gray-900 dark:text-white">סיכום בוקר</span>
            </div>
            <button
              onClick={() => handleNestedChange('dailySummary', 'enabled', !localSettings.dailySummary?.enabled)}
              className={`
                relative w-12 h-6 rounded-full transition-colors duration-200
                ${localSettings.dailySummary?.enabled ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}
              `}
            >
              <div
                className={`
                  absolute top-1 w-4 h-4 bg-white rounded-full transition-transform duration-200
                  ${localSettings.dailySummary?.enabled ? 'right-1' : 'left-1'}
                `}
              />
            </button>
          </div>
          {localSettings.dailySummary?.enabled && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">שלח בשעה</span>
              <input
                type="time"
                value={localSettings.dailySummary?.time || '08:00'}
                onChange={(e) => handleNestedChange('dailySummary', 'time', e.target.value)}
                className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              />
            </div>
          )}
        </div>

        {/* תזכורת הפסקה */}
        <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <span className="text-xl">☕</span>
              <span className="font-medium text-gray-900 dark:text-white">תזכורת הפסקה</span>
            </div>
            <button
              onClick={() => handleNestedChange('breakReminder', 'enabled', !localSettings.breakReminder?.enabled)}
              className={`
                relative w-12 h-6 rounded-full transition-colors duration-200
                ${localSettings.breakReminder?.enabled ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}
              `}
            >
              <div
                className={`
                  absolute top-1 w-4 h-4 bg-white rounded-full transition-transform duration-200
                  ${localSettings.breakReminder?.enabled ? 'right-1' : 'left-1'}
                `}
              />
            </button>
          </div>
          {localSettings.breakReminder?.enabled && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">אחרי</span>
              <input
                type="number"
                value={localSettings.breakReminder?.afterMinutes || 45}
                onChange={(e) => handleNestedChange('breakReminder', 'afterMinutes', parseInt(e.target.value) || 45)}
                className="w-16 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-center"
                min="15"
                max="120"
                step="5"
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">דקות עבודה</span>
            </div>
          )}
        </div>

        {/* סיום יום */}
        <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <span className="text-xl">🌙</span>
              <span className="font-medium text-gray-900 dark:text-white">סיום יום עבודה</span>
            </div>
            <button
              onClick={() => handleNestedChange('endOfDay', 'enabled', !localSettings.endOfDay?.enabled)}
              className={`
                relative w-12 h-6 rounded-full transition-colors duration-200
                ${localSettings.endOfDay?.enabled ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}
              `}
            >
              <div
                className={`
                  absolute top-1 w-4 h-4 bg-white rounded-full transition-transform duration-200
                  ${localSettings.endOfDay?.enabled ? 'right-1' : 'left-1'}
                `}
              />
            </button>
          </div>
          {localSettings.endOfDay?.enabled && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">בשעה</span>
              <input
                type="time"
                value={localSettings.endOfDay?.time || '16:00'}
                onChange={(e) => handleNestedChange('endOfDay', 'time', e.target.value)}
                className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              />
            </div>
          )}
        </div>

        {/* צלילים ורטט */}
        <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="space-y-3">
            <label className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xl">🔊</span>
                <span className="text-gray-900 dark:text-white">צליל התראה</span>
              </div>
              <button
                onClick={() => handleChange('sound', !localSettings.sound)}
                className={`
                  relative w-12 h-6 rounded-full transition-colors duration-200
                  ${localSettings.sound ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}
                `}
              >
                <div
                  className={`
                    absolute top-1 w-4 h-4 bg-white rounded-full transition-transform duration-200
                    ${localSettings.sound ? 'right-1' : 'left-1'}
                  `}
                />
              </button>
            </label>
            
            <label className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xl">📳</span>
                <span className="text-gray-900 dark:text-white">רטט</span>
              </div>
              <button
                onClick={() => handleChange('vibrate', !localSettings.vibrate)}
                className={`
                  relative w-12 h-6 rounded-full transition-colors duration-200
                  ${localSettings.vibrate ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}
                `}
              >
                <div
                  className={`
                    absolute top-1 w-4 h-4 bg-white rounded-full transition-transform duration-200
                    ${localSettings.vibrate ? 'right-1' : 'left-1'}
                  `}
                />
              </button>
            </label>
          </div>
        </div>
      </div>

      {/* כפתור שמירה */}
      <div className="mt-6">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors disabled:opacity-50 font-medium"
        >
          {saving ? '⏳ שומר...' : '✓ שמור הגדרות התראות'}
        </button>
      </div>
    </div>
  );
}

export default NotificationsSettings;
