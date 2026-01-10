import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TASK_TYPES } from '../../config/taskTypes';

/**
 * 🌅 ריטואל בוקר וערב
 * 
 * טקסים קבועים שבונים הרגלים:
 * - בוקר: סקירת היום, בחירת המשימה החשובה
 * - ערב: סיכום, חגיגת הצלחות, תכנון מחר
 */

const STORAGE_KEY = 'zmanit_daily_rituals';

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
 * פורמט זמן
 */
function formatDuration(minutes) {
  if (!minutes) return '0 דקות';
  if (minutes < 60) return `${minutes} דקות`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return hours === 1 ? 'שעה' : `${hours} שעות`;
  return `${hours}:${mins.toString().padStart(2, '0')}`;
}

/**
 * טעינת נתוני ריטואלים
 */
function loadRitualData() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

/**
 * שמירת נתוני ריטואלים
 */
function saveRitualData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

/**
 * ברכות בוקר
 */
const MORNING_GREETINGS = [
  "☀️ בוקר טוב! מוכנה ליום מעולה?",
  "🌅 יום חדש, הזדמנויות חדשות!",
  "🌻 בוקר אור! היום יהיה נפלא",
  "✨ יום טוב! בואי נעשה אותו מיוחד",
  "🌈 בוקר טוב! הכל אפשרי היום"
];

/**
 * ברכות ערב
 */
const EVENING_MESSAGES = [
  "🌅 יום עבודה נגמר! בואי נסכם",
  "🌇 זמן לסיכום יומי",
  "🌙 לפני שנסיים - סיכום קצר",
  "✨ עוד יום מאחוריך! בואי נראה איך היה"
];

/**
 * הודעות חיוביות על ביצועים
 */
const POSITIVE_MESSAGES = {
  excellent: [
    "מדהים! יום מצוין! 🎉",
    "וואו, עבודה נהדרת! 🌟",
    "את כוכבת! ⭐"
  ],
  good: [
    "יום טוב! המשיכי ככה 👏",
    "עבודה יפה! 💪",
    "את בכיוון הנכון! 🎯"
  ],
  ok: [
    "לא רע! מחר יהיה עוד יותר טוב 🌱",
    "כל יום הוא הזדמנות חדשה 🌻",
    "את מתקדמת, וזה מה שחשוב 👣"
  ],
  low: [
    "היו ימים כאלה. מחר יום חדש 💜",
    "את אנושית, ומותר לך 🫂",
    "לפעמים צריך לנוח כדי להתקדם 🌿"
  ]
};

/**
 * קומפוננטת ריטואל בוקר
 */
export function MorningRitual({ 
  tasks = [], 
  onClose, 
  onSelectPriority,
  addPoints 
}) {
  const [step, setStep] = useState(1);
  const [selectedPriority, setSelectedPriority] = useState(null);
  const [intention, setIntention] = useState('');
  
  const today = toLocalISODate(new Date());
  const greeting = useMemo(() => 
    MORNING_GREETINGS[Math.floor(Math.random() * MORNING_GREETINGS.length)], 
  []);

  // משימות היום
  const todayTasks = useMemo(() => {
    return tasks.filter(t => {
      if (t.is_completed) return false;
      const taskDate = t.due_date ? toLocalISODate(new Date(t.due_date)) : null;
      return taskDate === today;
    });
  }, [tasks, today]);

  // משימות עם דדליין
  const deadlineTasks = todayTasks.filter(t => t.due_time);
  
  // סה"כ זמן
  const totalMinutes = todayTasks.reduce((sum, t) => sum + (t.estimated_duration || 30), 0);

  // שמירה וסגירה
  const handleComplete = () => {
    const ritualData = loadRitualData();
    ritualData[today] = {
      ...ritualData[today],
      morningCompleted: true,
      priorityTaskId: selectedPriority?.id,
      intention,
      timestamp: new Date().toISOString()
    };
    saveRitualData(ritualData);
    
    // נקודות על ריטואל בוקר
    addPoints?.(5, 'ריטואל בוקר');
    
    if (selectedPriority) {
      onSelectPriority?.(selectedPriority);
    }
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-gradient-to-b from-orange-100 to-yellow-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center z-50 p-4"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
      >
        {/* שלב 1: ברכה וסקירה */}
        {step === 1 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="p-8 bg-gradient-to-r from-orange-400 to-yellow-400 text-white text-center">
              <div className="text-5xl mb-4">☀️</div>
              <h2 className="text-2xl font-bold">{greeting}</h2>
            </div>
            
            <div className="p-6 space-y-6">
              {/* סקירת היום */}
              <div className="text-center space-y-2">
                <p className="text-gray-600 dark:text-gray-400">היום יש לך:</p>
                <div className="flex justify-center gap-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-orange-600">{todayTasks.length}</div>
                    <div className="text-sm text-gray-500">משימות</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-600">{formatDuration(totalMinutes)}</div>
                    <div className="text-sm text-gray-500">עבודה</div>
                  </div>
                  {deadlineTasks.length > 0 && (
                    <div className="text-center">
                      <div className="text-3xl font-bold text-red-600">{deadlineTasks.length}</div>
                      <div className="text-sm text-gray-500">דדליינים</div>
                    </div>
                  )}
                </div>
              </div>

              {/* דדליינים חשובים */}
              {deadlineTasks.length > 0 && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl">
                  <div className="font-medium text-red-700 dark:text-red-300 mb-2 flex items-center gap-2">
                    <span>⏰</span> דדליינים היום:
                  </div>
                  {deadlineTasks.slice(0, 3).map(task => (
                    <div key={task.id} className="flex justify-between text-sm py-1">
                      <span>{task.title}</span>
                      <span className="text-red-600 font-medium">{task.due_time?.slice(0, 5)}</span>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={() => setStep(2)}
                className="w-full py-4 bg-gradient-to-r from-orange-500 to-yellow-500 text-white rounded-xl font-bold text-lg hover:from-orange-600 hover:to-yellow-600 transition-all"
              >
                בואי נתחיל! ➡️
              </button>
            </div>
          </motion.div>
        )}

        {/* שלב 2: בחירת משימה מרכזית */}
        {step === 2 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <div className="p-6 bg-blue-50 dark:bg-blue-900/30 text-center">
              <div className="text-4xl mb-2">🎯</div>
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                מה המשימה הכי חשובה היום?
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                אם היית יכולה לעשות רק דבר אחד, מה זה היה?
              </p>
            </div>
            
            <div className="p-6 space-y-3 max-h-80 overflow-y-auto">
              {todayTasks.map(task => {
                const taskType = TASK_TYPES?.[task.task_type] || { icon: '📌' };
                const isSelected = selectedPriority?.id === task.id;
                
                return (
                  <button
                    key={task.id}
                    onClick={() => setSelectedPriority(task)}
                    className={`
                      w-full p-4 rounded-xl text-right flex items-center gap-3 transition-all
                      ${isSelected 
                        ? 'bg-blue-100 dark:bg-blue-900/50 border-2 border-blue-500' 
                        : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border-2 border-transparent'
                      }
                    `}
                  >
                    <span className="text-2xl">{taskType.icon}</span>
                    <div className="flex-1">
                      <div className="font-medium">{task.title}</div>
                      {task.estimated_duration && (
                        <div className="text-sm text-gray-500">
                          {formatDuration(task.estimated_duration)}
                        </div>
                      )}
                    </div>
                    {isSelected && <span className="text-blue-500 text-xl">✓</span>}
                  </button>
                );
              })}
            </div>
            
            <div className="p-6 pt-0 space-y-3">
              <button
                onClick={() => setStep(3)}
                disabled={!selectedPriority}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                זו המשימה החשובה! ➡️
              </button>
              <button
                onClick={() => setStep(3)}
                className="w-full py-2 text-gray-500 hover:text-gray-700 text-sm"
              >
                דלג →
              </button>
            </div>
          </motion.div>
        )}

        {/* שלב 3: כוונה ליום */}
        {step === 3 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <div className="p-6 bg-purple-50 dark:bg-purple-900/30 text-center">
              <div className="text-4xl mb-2">💭</div>
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                כוונה ליום
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                מילה אחת או משפט קצר שילווה אותך היום
              </p>
            </div>
            
            <div className="p-6 space-y-4">
              <input
                type="text"
                value={intention}
                onChange={(e) => setIntention(e.target.value)}
                placeholder="לדוגמה: להתמקד, לנשום, צעד אחר צעד..."
                className="w-full p-4 text-lg text-center border-2 border-purple-200 dark:border-purple-700 rounded-xl focus:border-purple-500 focus:outline-none dark:bg-gray-700"
                autoFocus
              />
              
              {/* הצעות מהירות */}
              <div className="flex flex-wrap gap-2 justify-center">
                {['להתמקד 🎯', 'לנשום 🌬️', 'צעד צעד 👣', 'אני יכולה 💪', 'היום זה היום ⭐'].map(suggestion => (
                  <button
                    key={suggestion}
                    onClick={() => setIntention(suggestion)}
                    className="px-3 py-1 text-sm bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full hover:bg-purple-200"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="p-6 pt-0">
              <button
                onClick={handleComplete}
                className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-bold text-lg hover:from-purple-600 hover:to-pink-600"
              >
                🚀 בואי נתחיל את היום!
              </button>
            </div>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}

/**
 * קומפוננטת ריטואל ערב
 */
export function EveningRitual({ 
  tasks = [], 
  timerLogs = [],
  onClose,
  onMoveTasks,
  addPoints 
}) {
  const [step, setStep] = useState(1);
  const [mood, setMood] = useState(null);
  const [gratitude, setGratitude] = useState('');
  const [tomorrowPriority, setTomorrowPriority] = useState('');
  
  const today = toLocalISODate(new Date());
  const eveningMessage = useMemo(() => 
    EVENING_MESSAGES[Math.floor(Math.random() * EVENING_MESSAGES.length)],
  []);

  // סטטיסטיקות היום
  const stats = useMemo(() => {
    const todayTasks = tasks.filter(t => {
      const taskDate = t.due_date ? toLocalISODate(new Date(t.due_date)) : null;
      return taskDate === today;
    });
    
    const completed = todayTasks.filter(t => t.is_completed);
    const incomplete = todayTasks.filter(t => !t.is_completed);
    const completionRate = todayTasks.length > 0 
      ? Math.round((completed.length / todayTasks.length) * 100) 
      : 0;
    
    // זמן עבודה מהטיימרים
    const workedMinutes = timerLogs
      .filter(log => toLocalISODate(new Date(log.date)) === today)
      .reduce((sum, log) => sum + (log.duration || 0), 0);
    
    return {
      total: todayTasks.length,
      completed: completed.length,
      incomplete: incomplete.length,
      incompleteTasks: incomplete,
      completionRate,
      workedMinutes
    };
  }, [tasks, timerLogs, today]);

  // הודעה חיובית לפי ביצועים
  const positiveMessage = useMemo(() => {
    let category;
    if (stats.completionRate >= 80) category = 'excellent';
    else if (stats.completionRate >= 60) category = 'good';
    else if (stats.completionRate >= 40) category = 'ok';
    else category = 'low';
    
    const messages = POSITIVE_MESSAGES[category];
    return messages[Math.floor(Math.random() * messages.length)];
  }, [stats.completionRate]);

  // שמירה וסגירה
  const handleComplete = () => {
    const ritualData = loadRitualData();
    ritualData[today] = {
      ...ritualData[today],
      eveningCompleted: true,
      mood,
      gratitude,
      tomorrowPriority,
      stats,
      timestamp: new Date().toISOString()
    };
    saveRitualData(ritualData);
    
    // נקודות על ריטואל ערב
    addPoints?.(5, 'ריטואל ערב');
    
    onClose();
  };

  // העברת משימות למחר
  const handleMoveTasks = () => {
    if (stats.incompleteTasks.length > 0) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      onMoveTasks?.(stats.incompleteTasks, toLocalISODate(tomorrow));
    }
    setStep(3);
  };

  const MOODS = [
    { value: 1, emoji: '😫', label: 'קשה' },
    { value: 2, emoji: '😐', label: 'בסדר' },
    { value: 3, emoji: '😊', label: 'טוב' },
    { value: 4, emoji: '🎉', label: 'מעולה' }
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-gradient-to-b from-indigo-100 to-purple-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center z-50 p-4"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
      >
        {/* שלב 1: סיכום היום */}
        {step === 1 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="p-8 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-center">
              <div className="text-5xl mb-4">🌅</div>
              <h2 className="text-2xl font-bold">{eveningMessage}</h2>
            </div>
            
            <div className="p-6 space-y-6">
              {/* סטטיסטיקות */}
              <div className="text-center">
                <div className="text-6xl font-bold text-indigo-600 mb-2">
                  {stats.completionRate}%
                </div>
                <p className="text-gray-600 dark:text-gray-400">
                  השלמת {stats.completed} מתוך {stats.total} משימות
                </p>
                <p className="text-lg font-medium text-indigo-600 mt-2">
                  {positiveMessage}
                </p>
              </div>

              {/* פירוט */}
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-green-50 dark:bg-green-900/30 rounded-xl">
                  <div className="text-2xl font-bold text-green-600">✅ {stats.completed}</div>
                  <div className="text-xs text-gray-500">הושלמו</div>
                </div>
                <div className="text-center p-3 bg-orange-50 dark:bg-orange-900/30 rounded-xl">
                  <div className="text-2xl font-bold text-orange-600">⏳ {stats.incomplete}</div>
                  <div className="text-xs text-gray-500">נותרו</div>
                </div>
                <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/30 rounded-xl">
                  <div className="text-2xl font-bold text-blue-600">{formatDuration(stats.workedMinutes)}</div>
                  <div className="text-xs text-gray-500">עבודה</div>
                </div>
              </div>

              <button
                onClick={() => stats.incomplete > 0 ? setStep(2) : setStep(3)}
                className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700"
              >
                המשך ➡️
              </button>
            </div>
          </motion.div>
        )}

        {/* שלב 2: טיפול במשימות שנשארו */}
        {step === 2 && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <div className="p-6 bg-orange-50 dark:bg-orange-900/30 text-center">
              <div className="text-4xl mb-2">📋</div>
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                נשארו {stats.incomplete} משימות
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                מה לעשות איתן?
              </p>
            </div>
            
            <div className="p-6 space-y-3 max-h-60 overflow-y-auto">
              {stats.incompleteTasks.map(task => (
                <div key={task.id} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg flex items-center gap-3">
                  <span>{TASK_TYPES?.[task.task_type]?.icon || '📌'}</span>
                  <span className="flex-1 text-sm">{task.title}</span>
                </div>
              ))}
            </div>
            
            <div className="p-6 space-y-3">
              <button
                onClick={handleMoveTasks}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700"
              >
                📅 העבר למחר
              </button>
              <button
                onClick={() => setStep(3)}
                className="w-full py-2 text-gray-500 hover:text-gray-700 text-sm"
              >
                השאר כמו שזה →
              </button>
            </div>
          </motion.div>
        )}

        {/* שלב 3: מצב רוח והכרת תודה */}
        {step === 3 && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <div className="p-6 bg-pink-50 dark:bg-pink-900/30 text-center">
              <div className="text-4xl mb-2">💭</div>
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                איך היה היום?
              </h2>
            </div>
            
            <div className="p-6 space-y-6">
              {/* מצב רוח */}
              <div className="flex justify-center gap-4">
                {MOODS.map(m => (
                  <button
                    key={m.value}
                    onClick={() => setMood(m.value)}
                    className={`
                      p-4 rounded-xl transition-all
                      ${mood === m.value 
                        ? 'bg-pink-100 dark:bg-pink-900/50 scale-110 shadow-lg' 
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                      }
                    `}
                  >
                    <div className="text-3xl">{m.emoji}</div>
                    <div className="text-xs text-gray-500 mt-1">{m.label}</div>
                  </button>
                ))}
              </div>

              {/* הכרת תודה */}
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2 text-center">
                  🙏 על מה את מודה היום?
                </label>
                <input
                  type="text"
                  value={gratitude}
                  onChange={(e) => setGratitude(e.target.value)}
                  placeholder="דבר אחד טוב שקרה..."
                  className="w-full p-3 border rounded-xl dark:bg-gray-700 dark:border-gray-600 text-center"
                />
              </div>

              {/* מחשבה למחר */}
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2 text-center">
                  🎯 מה חשוב לעשות מחר?
                </label>
                <input
                  type="text"
                  value={tomorrowPriority}
                  onChange={(e) => setTomorrowPriority(e.target.value)}
                  placeholder="המשימה החשובה ביותר..."
                  className="w-full p-3 border rounded-xl dark:bg-gray-700 dark:border-gray-600 text-center"
                />
              </div>
            </div>
            
            <div className="p-6 pt-0">
              <button
                onClick={handleComplete}
                className="w-full py-4 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-xl font-bold text-lg hover:from-pink-600 hover:to-purple-600"
              >
                🌙 לילה טוב!
              </button>
            </div>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}

/**
 * Hook לבדיקה אם צריך להציג ריטואל
 */
export function useRitualCheck(workStartHour = 8, workEndHour = 16) {
  const [showMorning, setShowMorning] = useState(false);
  const [showEvening, setShowEvening] = useState(false);
  
  useEffect(() => {
    const checkRituals = () => {
      const now = new Date();
      const hour = now.getHours();
      const minute = now.getMinutes();
      const today = toLocalISODate(now);
      const dayOfWeek = now.getDay();
      
      // לא בשישי-שבת
      if (dayOfWeek === 5 || dayOfWeek === 6) return;
      
      const ritualData = loadRitualData();
      const todayRitual = ritualData[today] || {};
      
      // ריטואל בוקר: 8:00-8:30 אם לא הושלם
      if (hour === workStartHour && minute <= 30 && !todayRitual.morningCompleted) {
        setShowMorning(true);
      }
      
      // ריטואל ערב: 16:00-16:30 אם לא הושלם
      if (hour === workEndHour && minute <= 30 && !todayRitual.eveningCompleted) {
        setShowEvening(true);
      }
    };
    
    checkRituals();
    const interval = setInterval(checkRituals, 60000); // בדיקה כל דקה
    
    return () => clearInterval(interval);
  }, [workStartHour, workEndHour]);
  
  return {
    showMorning,
    showEvening,
    closeMorning: () => setShowMorning(false),
    closeEvening: () => setShowEvening(false),
    openMorning: () => setShowMorning(true),
    openEvening: () => setShowEvening(true)
  };
}

export default { MorningRitual, EveningRitual, useRitualCheck };
