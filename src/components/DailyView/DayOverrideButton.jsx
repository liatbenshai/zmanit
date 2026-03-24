import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

/**
 * מפתח localStorage לדריסות יומיות
 */
const OVERRIDES_KEY = 'zmanit_day_overrides';

/**
 * קבלת דריסות מ-localStorage
 */
export function getDayOverrides() {
  try {
    const saved = localStorage.getItem(OVERRIDES_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

/**
 * שמירת דריסה ליום
 */
export function saveDayOverride(dateISO, override) {
  const overrides = getDayOverrides();
  overrides[dateISO] = override;
  localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides));
}

/**
 * מחיקת דריסה ליום
 */
export function removeDayOverride(dateISO) {
  const overrides = getDayOverrides();
  delete overrides[dateISO];
  localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides));
}

/**
 * קבלת שעות עבודה ליום עם התחשבות בדריסות
 */
export function getEffectiveHoursForDate(date, defaultSchedule) {
  const dateISO = date.toISOString().split('T')[0];
  const overrides = getDayOverrides();
  const override = overrides[dateISO];
  
  if (override) {
    return {
      ...defaultSchedule,
      start: override.start ?? defaultSchedule.start,
      end: override.end ?? defaultSchedule.end,
      startStr: override.startStr ?? defaultSchedule.startStr,
      endStr: override.endStr ?? defaultSchedule.endStr,
      hasOverride: true
    };
  }
  
  return { ...defaultSchedule, hasOverride: false };
}

/**
 * כפתור לשינוי שעות עבודה ליום ספציפי
 */
function DayOverrideButton({ date, currentSchedule, onScheduleChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [endTime, setEndTime] = useState(currentSchedule.endStr || '16:15');
  const [startTime, setStartTime] = useState(currentSchedule.startStr || '08:30');
  
  const dateISO = date.toISOString().split('T')[0];
  const overrides = getDayOverrides();
  const hasOverride = !!overrides[dateISO];

  useEffect(() => {
    // עדכון הערכים כשמשתנה התאריך
    const override = overrides[dateISO];
    if (override) {
      setEndTime(override.endStr || currentSchedule.endStr);
      setStartTime(override.startStr || currentSchedule.startStr);
    } else {
      setEndTime(currentSchedule.endStr || '16:15');
      setStartTime(currentSchedule.startStr || '08:30');
    }
  }, [dateISO, currentSchedule]);

  const handleSave = () => {
    // המרת שעות לפורמט עשרוני
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const startDecimal = startH + startM / 60;
    const endDecimal = endH + endM / 60;

    saveDayOverride(dateISO, {
      start: startDecimal,
      end: endDecimal,
      startStr: startTime,
      endStr: endTime
    });

    toast.success(`📅 שעות העבודה עודכנו ל-${startTime} - ${endTime}`);
    setIsOpen(false);
    
    if (onScheduleChange) {
      onScheduleChange();
    }
  };

  const handleReset = () => {
    removeDayOverride(dateISO);
    setEndTime(currentSchedule.endStr || '16:15');
    setStartTime(currentSchedule.startStr || '08:30');
    toast.success('🔄 חזרה לשעות רגילות');
    setIsOpen(false);
    
    if (onScheduleChange) {
      onScheduleChange();
    }
  };

  const quickOptions = [
    { label: 'עד 17:00', end: '17:00' },
    { label: 'עד 18:00', end: '18:00' },
    { label: 'עד 19:00', end: '19:00' },
    { label: 'עד 20:00', end: '20:00' },
  ];

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors
          ${hasOverride 
            ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-700' 
            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}
        `}
        title="שנה שעות עבודה ליום זה"
      >
        <span>⚙️</span>
        <span>{hasOverride ? 'שונה' : 'שנה שעות'}</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* רקע לסגירה */}
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setIsOpen(false)}
            />
            
            {/* פופאפ */}
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="absolute top-full mt-2 left-0 right-0 min-w-[280px] bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-4 z-50"
            >
              <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <span>⏰</span>
                <span>שעות עבודה ליום זה</span>
              </h4>

              {/* שעות התחלה וסיום */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                    התחלה
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                    סיום
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  />
                </div>
              </div>

              {/* אפשרויות מהירות */}
              <div className="mb-4">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  🌙 עבודה עד מאוחר:
                </p>
                <div className="flex flex-wrap gap-2">
                  {quickOptions.map(opt => (
                    <button
                      key={opt.end}
                      onClick={() => setEndTime(opt.end)}
                      className={`
                        px-3 py-1 text-xs rounded-lg transition-colors
                        ${endTime === opt.end
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}
                      `}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* כפתורי פעולה */}
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  className="flex-1 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  ✓ שמור
                </button>
                {hasOverride && (
                  <button
                    onClick={handleReset}
                    className="px-3 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm transition-colors"
                  >
                    🔄 איפוס
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-3 py-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-sm"
                >
                  ביטול
                </button>
              </div>

              {hasOverride && (
                <p className="text-xs text-purple-600 dark:text-purple-400 mt-3 text-center">
                  ⚡ שעות מותאמות ליום זה בלבד
                </p>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export default DayOverrideButton;
