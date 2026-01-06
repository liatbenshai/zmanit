import { useState } from 'react';
import { motion } from 'framer-motion';
import { useSettings } from '../../context/SettingsContext';
import toast from 'react-hot-toast';

/**
 * הגדרות לוח זמנים
 */
function WorkScheduleSettings() {
  const { 
    workDays, 
    workHours,
    updateWorkDay,
    updateSettings,
    minutesToTime,
    timeToMinutes,
    saving 
  } = useSettings();
  
  const [localWorkHours, setLocalWorkHours] = useState(workHours);

  const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

  const handleToggleDay = async (dayIndex) => {
    const day = workDays[dayIndex];
    await updateWorkDay(dayIndex, { 
      enabled: !day.enabled,
      hours: !day.enabled ? { start: 510, end: 975 } : day.hours
    });
  };

  const handleDayHoursChange = async (dayIndex, field, value) => {
    const day = workDays[dayIndex];
    const minutes = timeToMinutes(value);
    
    await updateWorkDay(dayIndex, {
      hours: {
        ...day.hours,
        [field]: minutes
      }
    });
  };

  const handleGlobalHoursChange = (field, value) => {
    const minutes = timeToMinutes(value);
    setLocalWorkHours(prev => ({
      ...prev,
      [field]: minutes
    }));
  };

  const saveGlobalHours = async () => {
    try {
      await updateSettings('work_hours', localWorkHours);
      toast.success('שעות העבודה נשמרו');
    } catch (err) {
      toast.error('שגיאה בשמירה');
    }
  };

  const applyToAllDays = async () => {
    try {
      const updates = {};
      for (let i = 0; i < 7; i++) {
        if (workDays[i].enabled) {
          updates[i] = {
            ...workDays[i],
            hours: {
              start: localWorkHours.dayStart,
              end: localWorkHours.dayEnd
            }
          };
        }
      }
      
      await updateSettings('work_days', { ...workDays, ...updates });
      toast.success('השעות עודכנו לכל הימים');
    } catch (err) {
      toast.error('שגיאה בעדכון');
    }
  };

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6">
        📅 לוח זמנים
      </h2>

      {/* שעות עבודה כלליות */}
      <div className="mb-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
        <h3 className="font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <span>⏰</span>
          <span>שעות עבודה ברירת מחדל</span>
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
              תחילת יום
            </label>
            <input
              type="time"
              value={minutesToTime(localWorkHours.dayStart)}
              onChange={(e) => handleGlobalHoursChange('dayStart', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
              סוף יום
            </label>
            <input
              type="time"
              value={minutesToTime(localWorkHours.dayEnd)}
              onChange={(e) => handleGlobalHoursChange('dayEnd', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
              משך בלוק (דקות)
            </label>
            <input
              type="number"
              value={localWorkHours.blockDuration}
              onChange={(e) => setLocalWorkHours(prev => ({ ...prev, blockDuration: parseInt(e.target.value) || 45 }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              min="15"
              max="120"
              step="5"
            />
          </div>
          
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
              הפסקה (דקות)
            </label>
            <input
              type="number"
              value={localWorkHours.breakDuration}
              onChange={(e) => setLocalWorkHours(prev => ({ ...prev, breakDuration: parseInt(e.target.value) || 5 }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              min="0"
              max="30"
              step="5"
            />
          </div>
        </div>

        {/* חלונות זמן */}
        <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-700">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            חלונות זמן (לשיבוץ חכם)
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                תחילת בוקר
              </label>
              <input
                type="time"
                value={minutesToTime(localWorkHours.morningStart)}
                onChange={(e) => handleGlobalHoursChange('morningStart', e.target.value)}
                className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                סוף בוקר
              </label>
              <input
                type="time"
                value={minutesToTime(localWorkHours.morningEnd)}
                onChange={(e) => handleGlobalHoursChange('morningEnd', e.target.value)}
                className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                תחילת אחה"צ
              </label>
              <input
                type="time"
                value={minutesToTime(localWorkHours.afternoonStart)}
                onChange={(e) => handleGlobalHoursChange('afternoonStart', e.target.value)}
                className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                סוף אחה"צ
              </label>
              <input
                type="time"
                value={minutesToTime(localWorkHours.afternoonEnd)}
                onChange={(e) => handleGlobalHoursChange('afternoonEnd', e.target.value)}
                className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <button
            onClick={saveGlobalHours}
            disabled={saving}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
          >
            {saving ? '⏳' : '✓'} שמור הגדרות
          </button>
          <button
            onClick={applyToAllDays}
            disabled={saving}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors disabled:opacity-50"
          >
            החל על כל הימים
          </button>
        </div>
      </div>

      {/* ימי עבודה */}
      <div>
        <h3 className="font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <span>📆</span>
          <span>ימי עבודה</span>
        </h3>
        
        <div className="space-y-3">
          {[0, 1, 2, 3, 4, 5, 6].map(dayIndex => {
            const day = workDays[dayIndex];
            const isEnabled = day?.enabled || false;
            
            return (
              <motion.div
                key={dayIndex}
                layout
                className={`
                  p-4 rounded-xl border transition-all duration-200
                  ${isEnabled
                    ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20'
                    : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'
                  }
                `}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* טוגל */}
                    <button
                      onClick={() => handleToggleDay(dayIndex)}
                      className={`
                        relative w-12 h-6 rounded-full transition-colors duration-200
                        ${isEnabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}
                      `}
                    >
                      <div
                        className={`
                          absolute top-1 w-4 h-4 bg-white rounded-full transition-transform duration-200
                          ${isEnabled ? 'right-1' : 'left-1'}
                        `}
                      />
                    </button>
                    
                    <span className={`
                      font-medium text-lg
                      ${isEnabled 
                        ? 'text-gray-900 dark:text-white' 
                        : 'text-gray-400 dark:text-gray-500'
                      }
                    `}>
                      יום {dayNames[dayIndex]}
                    </span>
                  </div>
                  
                  {/* שעות ליום ספציפי */}
                  {isEnabled && day?.hours && (
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={minutesToTime(day.hours.start)}
                        onChange={(e) => handleDayHoursChange(dayIndex, 'start', e.target.value)}
                        className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                      <span className="text-gray-400">-</span>
                      <input
                        type="time"
                        value={minutesToTime(day.hours.end)}
                        onChange={(e) => handleDayHoursChange(dayIndex, 'end', e.target.value)}
                        className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* סיכום */}
      <div className="mt-6 p-4 bg-gray-100 dark:bg-gray-700/50 rounded-xl">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          <strong>סיכום:</strong>
          <ul className="mt-2 space-y-1">
            <li>
              ימי עבודה: {Object.values(workDays).filter(d => d.enabled).length} ימים
            </li>
            <li>
              שעות ביום: {minutesToTime(localWorkHours.dayStart)} - {minutesToTime(localWorkHours.dayEnd)} 
              ({Math.round((localWorkHours.dayEnd - localWorkHours.dayStart) / 60 * 10) / 10} שעות)
            </li>
            <li>
              בלוקים: {localWorkHours.blockDuration} דקות + {localWorkHours.breakDuration} דקות הפסקה
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default WorkScheduleSettings;
