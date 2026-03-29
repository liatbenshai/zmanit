import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TASK_TYPES } from '../../config/taskTypes';

/**
 * 🆘 כפתור "אני אבודה" (Panic Button)
 * 
 * עוזר ברגעי עומס והצפה:
 * - מבין מה הבעיה
 * - מציע פתרון מותאם
 * - מפשט את המצב
 */

/**
 * תאריך מקומי
 */
function toLocalISODate(date) {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * סוגי מצבי פאניקה
 */
const PANIC_TYPES = [
  {
    id: 'overwhelmed',
    icon: '😰',
    title: 'יש לי יותר מדי דברים',
    subtitle: 'הכל נראה דחוף',
    color: 'from-red-500 to-orange-500'
  },
  {
    id: 'stuck',
    icon: '🤷‍♀️',
    title: 'אני לא יודעת מאיפה להתחיל',
    subtitle: 'מרגישה משותקת',
    color: 'from-purple-500 to-pink-500'
  },
  {
    id: 'urgent',
    icon: '🚨',
    title: 'יש בלת"ם דחוף!',
    subtitle: 'צריך לטפל בזה עכשיו',
    color: 'from-red-600 to-red-700'
  },
  {
    id: 'exhausted',
    icon: '😴',
    title: 'אני מותשת',
    subtitle: 'אין לי כוח להמשיך',
    color: 'from-gray-500 to-gray-600'
  },
  {
    id: 'distracted',
    icon: '🦋',
    title: 'אני מתפזרת',
    subtitle: 'לא מצליחה להתרכז',
    color: 'from-blue-500 to-cyan-500'
  }
];

/**
 * הודעות מרגיעות
 */
const CALMING_MESSAGES = [
  "נשימה עמוקה... הכל יסתדר 🌸",
  "את לא לבד בזה 💜",
  "צעד קטן אחד בכל פעם 👣",
  "את יכולה לעשות את זה! 💪",
  "בואי נפשט את העניינים ביחד 🤝"
];

/**
 * מציאת המשימה הכי קלה להתחלה
 */
function findEasiestTask(tasks, today) {
  const todayTasks = tasks.filter(t => {
    if (t.is_completed) return false;
    const taskDate = t.due_date ? toLocalISODate(new Date(t.due_date)) : null;
    return taskDate === today || !taskDate;
  });

  if (todayTasks.length === 0) return null;

  // מיון לפי: קצר ביותר + לא דורש ריכוז
  return todayTasks.sort((a, b) => {
    const aDuration = a.estimated_duration || 30;
    const bDuration = b.estimated_duration || 30;
    return aDuration - bDuration;
  })[0];
}

/**
 * מציאת המשימה הכי דחופה
 */
function findMostUrgent(tasks, today) {
  const todayTasks = tasks.filter(t => {
    if (t.is_completed) return false;
    const taskDate = t.due_date ? toLocalISODate(new Date(t.due_date)) : null;
    return taskDate === today;
  });

  if (todayTasks.length === 0) return null;

  // מיון לפי: שעה קבועה > רבע 1 > רבע 2 > השאר
  return todayTasks.sort((a, b) => {
    // משימות עם שעה קודמות
    if (a.due_time && !b.due_time) return -1;
    if (!a.due_time && b.due_time) return 1;
    if (a.due_time && b.due_time) {
      return a.due_time.localeCompare(b.due_time);
    }
    // לפי רבע
    return (a.quadrant || 4) - (b.quadrant || 4);
  })[0];
}

/**
 * פורמט זמן
 */
function formatDuration(minutes) {
  if (!minutes) return '';
  if (minutes < 60) return `${minutes} דקות`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}:${mins.toString().padStart(2, '0')}` : `${hours} שעות`;
}

function PanicButton({ 
  tasks = [], 
  onStartTask, 
  onPostponeTask,
  onTakeBreak,
  className = '' 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(1); // 1 = בחירה, 2 = פתרון
  const [selectedType, setSelectedType] = useState(null);
  const [calmingMessage] = useState(
    CALMING_MESSAGES[Math.floor(Math.random() * CALMING_MESSAGES.length)]
  );

  const today = toLocalISODate(new Date());
  const todayTasks = tasks.filter(t => {
    if (t.is_completed) return false;
    const taskDate = t.due_date ? toLocalISODate(new Date(t.due_date)) : null;
    return taskDate === today;
  });

  const easiestTask = findEasiestTask(tasks, today);
  const urgentTask = findMostUrgent(tasks, today);

  // סגירה ואיפוס
  const handleClose = () => {
    setIsOpen(false);
    setTimeout(() => {
      setStep(1);
      setSelectedType(null);
    }, 300);
  };

  // טיפול בבחירת סוג
  const handleSelectType = (type) => {
    setSelectedType(type);
    setStep(2);
  };

  // רנדור פתרון לפי סוג
  const renderSolution = () => {
    const taskType = selectedType?.id;
    
    switch (taskType) {
      case 'overwhelmed':
        return (
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400 text-center">
              בואי נפשט. יש לך {todayTasks.length} משימות להיום.
              <br />
              נתחיל מהדבר הכי קטן וקל:
            </p>
            
            {easiestTask && (
              <div className="p-4 bg-green-50 dark:bg-green-900/30 rounded-xl">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">
                    {TASK_TYPES?.[easiestTask.task_type]?.icon || '📌'}
                  </span>
                  <div>
                    <div className="font-medium">{easiestTask.title}</div>
                    <div className="text-sm text-gray-500">
                      רק {formatDuration(easiestTask.estimated_duration || 15)}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    onStartTask?.(easiestTask);
                    handleClose();
                  }}
                  className="w-full mt-3 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
                >
                  ▶️ רק את זה, עכשיו
                </button>
              </div>
            )}

            <div className="text-center text-sm text-gray-500">
              💡 טיפ: אחרי שתסיימי את זה, תרגישי הרבה יותר טוב!
            </div>
          </div>
        );

      case 'stuck':
        return (
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400 text-center">
              כשלא יודעים מאיפה להתחיל, מתחילים מהקל ביותר.
              <br />
              5 דקות בלבד, ואז מחליטים אם להמשיך.
            </p>
            
            {easiestTask && (
              <div className="p-4 bg-purple-50 dark:bg-purple-900/30 rounded-xl">
                <div className="text-center mb-3">
                  <span className="text-4xl">
                    {TASK_TYPES?.[easiestTask.task_type]?.icon || '📌'}
                  </span>
                  <div className="font-medium mt-2">{easiestTask.title}</div>
                </div>
                <button
                  onClick={() => {
                    onStartTask?.(easiestTask, { fiveMinuteRule: true });
                    handleClose();
                  }}
                  className="w-full py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700"
                >
                  ⏱️ רק 5 דקות - לנסות
                </button>
              </div>
            )}
          </div>
        );

      case 'urgent':
        return (
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400 text-center">
              אוקיי, יש בלת"ם. בואי נטפל בזה.
              <br />
              מה הדבר הכי דחוף עכשיו?
            </p>
            
            {urgentTask && (
              <div className="p-4 bg-red-50 dark:bg-red-900/30 rounded-xl border border-red-200 dark:border-red-800">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">🎯</span>
                  <div>
                    <div className="font-medium">{urgentTask.title}</div>
                    {urgentTask.due_time && (
                      <div className="text-sm text-red-600 dark:text-red-400">
                        עד {urgentTask.due_time.slice(0, 5)}
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => {
                    onStartTask?.(urgentTask);
                    handleClose();
                  }}
                  className="w-full mt-3 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700"
                >
                  🚨 לטפל עכשיו
                </button>
              </div>
            )}

            <div className="text-center">
              <button
                onClick={() => {
                  // לפתוח טופס בלת"ם חדש
                  handleClose();
                }}
                className="text-sm text-gray-500 hover:text-gray-700 underline"
              >
                + זה בלת"ם חדש שלא ברשימה
              </button>
            </div>
          </div>
        );

      case 'exhausted':
        return (
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400 text-center">
              את אנושית, ומותר להיות עייפה.
              <br />
              בואי ניקח הפסקה קצרה ואז נחליט מה עושים.
            </p>
            
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  onTakeBreak?.(10);
                  handleClose();
                }}
                className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-xl text-center hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
              >
                <div className="text-2xl mb-1">☕</div>
                <div className="font-medium">הפסקה 10 דק'</div>
              </button>
              <button
                onClick={() => {
                  onTakeBreak?.(20);
                  handleClose();
                }}
                className="p-4 bg-green-50 dark:bg-green-900/30 rounded-xl text-center hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors"
              >
                <div className="text-2xl mb-1">🚶‍♀️</div>
                <div className="font-medium">הליכה קצרה</div>
              </button>
            </div>

            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg text-center text-sm">
              💡 אם את עייפה כל הזמן, אולי כדאי לבדוק את לוח הזמנים שלך
            </div>
          </div>
        );

      case 'distracted':
        return (
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400 text-center">
              זה קורה. בואי נחזור למסלול.
              <br />
              מה המשימה שהתחלת?
            </p>
            
            {urgentTask && (
              <div className="p-4 bg-cyan-50 dark:bg-cyan-900/30 rounded-xl">
                <div className="text-center mb-3">
                  <span className="text-4xl">🎯</span>
                  <div className="font-medium mt-2">{urgentTask.title}</div>
                </div>
                <button
                  onClick={() => {
                    onStartTask?.(urgentTask, { focusMode: true });
                    handleClose();
                  }}
                  className="w-full py-3 bg-cyan-600 text-white rounded-lg font-medium hover:bg-cyan-700"
                >
                  🔒 מצב התמקדות
                </button>
                <p className="text-xs text-center mt-2 text-gray-500">
                  יסתיר את כל ההסחות ויראה רק את המשימה הזו
                </p>
              </div>
            )}

            <div className="text-center text-sm text-gray-500">
              טיפים: 📵 טלפון על שקט | 🎧 אוזניות | 🚪 דלת סגורה
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      {/* כפתור פאניקה */}
      <button
        onClick={() => setIsOpen(true)}
        className={`
          px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 
          text-white rounded-xl font-medium shadow-lg
          hover:from-purple-600 hover:to-pink-600 
          transition-all hover:scale-105
          flex items-center gap-2
          ${className}
        `}
      >
        <span className="text-lg">🆘</span>
        <span>אני אבודה</span>
      </button>

      {/* מודל */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
            onClick={(e) => e.target === e.currentTarget && handleClose()}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              {/* כותרת */}
              <div className="p-6 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-center">
                <button
                  onClick={handleClose}
                  className="absolute top-4 left-4 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center"
                >
                  ✕
                </button>
                <div className="text-4xl mb-2">🫂</div>
                <h2 className="text-xl font-bold">הכל בסדר</h2>
                <p className="text-purple-100 text-sm mt-1">{calmingMessage}</p>
              </div>

              {/* תוכן */}
              <div className="p-6">
                {step === 1 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-3"
                  >
                    <h3 className="text-center font-medium text-gray-700 dark:text-gray-300 mb-4">
                      מה קורה עכשיו?
                    </h3>
                    
                    {PANIC_TYPES.map(type => (
                      <button
                        key={type.id}
                        onClick={() => handleSelectType(type)}
                        className="w-full p-4 rounded-xl text-right flex items-center gap-4 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                      >
                        <span className="text-3xl">{type.icon}</span>
                        <div>
                          <div className="font-medium text-gray-800 dark:text-white">
                            {type.title}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {type.subtitle}
                          </div>
                        </div>
                      </button>
                    ))}
                  </motion.div>
                )}

                {step === 2 && selectedType && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                  >
                    <button
                      onClick={() => setStep(1)}
                      className="mb-4 text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
                    >
                      ← חזרה
                    </button>
                    
                    <div className="flex items-center gap-3 mb-4 pb-4 border-b dark:border-gray-700">
                      <span className="text-3xl">{selectedType.icon}</span>
                      <div>
                        <div className="font-medium">{selectedType.title}</div>
                      </div>
                    </div>

                    {renderSolution()}
                  </motion.div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default PanicButton;
