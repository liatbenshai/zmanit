/**
 * BlockerLogModal - לוג חסמים
 * ============================
 * קופץ כשמשימה נדחית ושואל "מה עצר אותך?"
 * אוסף נתונים לניתוח דפוסי דחיינות
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// סוגי חסמים
const BLOCKER_TYPES = [
  { id: 'too_big', emoji: '🐘', label: 'נראה גדול מדי', description: 'המשימה מרגישה מכרעת' },
  { id: 'unclear', emoji: '🌫️', label: 'לא ברור מאיפה להתחיל', description: 'חסר מידע או הנחיות' },
  { id: 'fear', emoji: '😰', label: 'פחד מכישלון', description: 'חשש שלא יצא טוב' },
  { id: 'boring', emoji: '😴', label: 'משעמם', description: 'אין מוטיבציה' },
  { id: 'tired', emoji: '🔋', label: 'עייפות / אין אנרגיה', description: 'לא מרגישה בכוח' },
  { id: 'distracted', emoji: '📱', label: 'הסחות דעת', description: 'טלפון, אנשים, רעש' },
  { id: 'urgent', emoji: '🔥', label: 'משהו דחוף יותר צץ', description: 'בלת"ם או משימה אחרת' },
  { id: 'perfectionism', emoji: '✨', label: 'פרפקציוניזם', description: 'רוצה שיהיה מושלם' },
  { id: 'other', emoji: '💭', label: 'אחר', description: 'סיבה אחרת' }
];

/**
 * שמירת לוג חסמים ב-localStorage
 */
function saveBlockerLog(taskId, taskTitle, blockerId, note = '') {
  const logs = JSON.parse(localStorage.getItem('blocker_logs') || '[]');
  
  logs.push({
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    taskId,
    taskTitle,
    blockerId,
    blockerType: BLOCKER_TYPES.find(b => b.id === blockerId),
    note,
    timestamp: new Date().toISOString(),
    dayOfWeek: new Date().getDay(),
    hour: new Date().getHours()
  });
  
  // שמירת רק 90 יום אחורה
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const filteredLogs = logs.filter(l => new Date(l.timestamp) > ninetyDaysAgo);
  
  localStorage.setItem('blocker_logs', JSON.stringify(filteredLogs));
  return filteredLogs;
}

/**
 * קבלת סטטיסטיקות חסמים
 */
export function getBlockerStats() {
  const logs = JSON.parse(localStorage.getItem('blocker_logs') || '[]');
  
  if (logs.length === 0) {
    return null;
  }
  
  // ספירה לפי סוג חסם
  const byType = {};
  logs.forEach(log => {
    byType[log.blockerId] = (byType[log.blockerId] || 0) + 1;
  });
  
  // מיון לפי שכיחות
  const sortedTypes = Object.entries(byType)
    .sort((a, b) => b[1] - a[1])
    .map(([id, count]) => ({
      ...BLOCKER_TYPES.find(b => b.id === id),
      count,
      percent: Math.round((count / logs.length) * 100)
    }));
  
  // ניתוח לפי שעה
  const byHour = {};
  logs.forEach(log => {
    const hourGroup = log.hour < 12 ? 'בוקר' : log.hour < 17 ? 'צהריים' : 'ערב';
    byHour[hourGroup] = (byHour[hourGroup] || 0) + 1;
  });
  
  // ניתוח לפי יום
  const byDay = {};
  const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  logs.forEach(log => {
    const dayName = dayNames[log.dayOfWeek];
    byDay[dayName] = (byDay[dayName] || 0) + 1;
  });
  
  // החסם הנפוץ ביותר
  const topBlocker = sortedTypes[0];
  
  // טיפים מותאמים אישית
  const tips = generateTips(sortedTypes);
  
  return {
    totalLogs: logs.length,
    byType: sortedTypes,
    byHour,
    byDay,
    topBlocker,
    tips,
    recentLogs: logs.slice(-10).reverse()
  };
}

/**
 * יצירת טיפים מותאמים אישית לפי הדפוסים
 */
function generateTips(sortedTypes) {
  const tips = [];
  
  if (!sortedTypes.length) return tips;
  
  const top = sortedTypes[0];
  
  switch (top.id) {
    case 'too_big':
      tips.push({
        emoji: '✂️',
        title: 'פרקי משימות גדולות',
        text: 'נסי לחלק כל משימה גדולה ל-3-5 חלקים קטנים. מוח אוהב לסיים דברים!'
      });
      tips.push({
        emoji: '5️⃣',
        title: 'כלל 5 הדקות',
        text: 'התחייבי רק ל-5 דקות. אחרי שמתחילים, קל להמשיך.'
      });
      break;
      
    case 'unclear':
      tips.push({
        emoji: '📝',
        title: 'הגדירי את הצעד הראשון',
        text: 'לפני שמוסיפים משימה, כתבי מה בדיוק הפעולה הראשונה.'
      });
      tips.push({
        emoji: '❓',
        title: 'שאלי שאלות',
        text: 'אם משהו לא ברור - זה הזמן לברר, לא לדחות.'
      });
      break;
      
    case 'fear':
      tips.push({
        emoji: '🎯',
        title: 'מושלם זה האויב של טוב',
        text: 'גרסה ראשונה לא צריכה להיות מושלמת. היא צריכה להיות קיימת.'
      });
      tips.push({
        emoji: '💪',
        title: 'זכרי הצלחות קודמות',
        text: 'כבר עשית דברים קשים בעבר. גם את זה תעשי.'
      });
      break;
      
    case 'tired':
      tips.push({
        emoji: '⏰',
        title: 'זהי את שעות השיא שלך',
        text: 'תכנני משימות קשות בשעות שבהן יש לך הכי הרבה אנרגיה.'
      });
      tips.push({
        emoji: '😴',
        title: 'בדקי שינה ותזונה',
        text: 'עייפות כרונית יכולה להיות סימן שצריך לשפר הרגלים בסיסיים.'
      });
      break;
      
    case 'distracted':
      tips.push({
        emoji: '📵',
        title: 'צרי סביבה נקייה',
        text: 'טלפון במצב טיסה, סגרי טאבים מיותרים, שימי אוזניות.'
      });
      tips.push({
        emoji: '🚪',
        title: 'הודיעי שאת עסוקה',
        text: 'תני לסביבה לדעת שאת צריכה זמן מרוכז.'
      });
      break;
      
    case 'urgent':
      tips.push({
        emoji: '📅',
        title: 'שמרי זמן לבלת"מים',
        text: 'תכנני 60-90 דקות ביום לדברים לא צפויים.'
      });
      tips.push({
        emoji: '🔍',
        title: 'בדקי אם באמת דחוף',
        text: 'הרבה "דחוף" הוא בעצם "רועש". מה באמת חייב להיות היום?'
      });
      break;
      
    case 'perfectionism':
      tips.push({
        emoji: '📊',
        title: '80% מספיק',
        text: 'השקעה של 20% נוספים לשיפור קטן לרוב לא משתלמת.'
      });
      tips.push({
        emoji: '⏱️',
        title: 'הגבילי זמן',
        text: 'קבעי מראש כמה זמן משקיעים - ואז עוצרים.'
      });
      break;
      
    default:
      tips.push({
        emoji: '🔍',
        title: 'המשיכי לעקוב',
        text: 'ככל שתאספי יותר נתונים, הדפוסים יתבהרו.'
      });
  }
  
  return tips;
}

/**
 * המודל עצמו
 */
export default function BlockerLogModal({ isOpen, onClose, task, onSkip }) {
  const [selectedBlocker, setSelectedBlocker] = useState(null);
  const [note, setNote] = useState('');
  const [showThanks, setShowThanks] = useState(false);
  
  if (!isOpen) return null;
  
  const handleSubmit = () => {
    if (selectedBlocker) {
      saveBlockerLog(task?.id, task?.title, selectedBlocker, note);
      setShowThanks(true);
      setTimeout(() => {
        setShowThanks(false);
        setSelectedBlocker(null);
        setNote('');
        onClose();
      }, 1500);
    }
  };
  
  const handleSkip = () => {
    setSelectedBlocker(null);
    setNote('');
    if (onSkip) onSkip();
    onClose();
  };
  
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        onClick={handleSkip}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full shadow-xl"
          onClick={e => e.stopPropagation()}
        >
          {showThanks ? (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="text-center py-8"
            >
              <span className="text-6xl block mb-4">💜</span>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                תודה על השיתוף!
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mt-2">
                זה יעזור לי להבין אותך טוב יותר
              </p>
            </motion.div>
          ) : (
            <>
              {/* כותרת */}
              <div className="text-center mb-6">
                <span className="text-4xl block mb-2">🤔</span>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  מה עצר אותך?
                </h3>
                {task && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    "{task.title}" נדחתה
                  </p>
                )}
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                  ✨ המידע הזה יעזור לזהות דפוסים ולשפר
                </p>
              </div>
              
              {/* אפשרויות */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {BLOCKER_TYPES.map(blocker => (
                  <button
                    key={blocker.id}
                    onClick={() => setSelectedBlocker(blocker.id)}
                    className={`p-3 rounded-xl text-center transition-all ${
                      selectedBlocker === blocker.id
                        ? 'bg-blue-100 dark:bg-blue-900/50 border-2 border-blue-500 scale-105'
                        : 'bg-gray-50 dark:bg-gray-700 border-2 border-transparent hover:bg-gray-100 dark:hover:bg-gray-600'
                    }`}
                  >
                    <span className="text-2xl block mb-1">{blocker.emoji}</span>
                    <span className="text-xs text-gray-700 dark:text-gray-300 leading-tight block">
                      {blocker.label}
                    </span>
                  </button>
                ))}
              </div>
              
              {/* הערה אופציונלית */}
              {selectedBlocker && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  className="mb-4"
                >
                  <input
                    type="text"
                    placeholder="רוצה להוסיף פרט? (אופציונלי)"
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    className="w-full p-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  />
                </motion.div>
              )}
              
              {/* כפתורים */}
              <div className="flex gap-2">
                <button
                  onClick={handleSkip}
                  className="flex-1 py-3 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm"
                >
                  דלגי
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!selectedBlocker}
                  className={`flex-1 py-3 rounded-xl font-medium transition-all ${
                    selectedBlocker
                      ? 'bg-blue-500 hover:bg-blue-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  שמרי
                </button>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export { BLOCKER_TYPES, saveBlockerLog };
