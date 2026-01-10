import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

/**
 * 🎮 מערכת גיימיפיקציה
 * 
 * נותנת דופמין מיידי דרך:
 * - נקודות על פעולות
 * - סטריקים (רצפים)
 * - הישגים
 * - רמות
 */

const STORAGE_KEY = 'zmanit_gamification';

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
 * הגדרת נקודות לפעולות
 */
const POINT_VALUES = {
  taskCompleted: 10,           // השלמת משימה
  taskCompletedOnTime: 15,     // השלמה בזמן
  taskCompletedEarly: 20,      // השלמה לפני הזמן
  taskStartedOnTime: 5,        // התחלה בזמן
  accurateEstimate: 10,        // הערכת זמן מדויקת
  morningRitual: 5,            // ריטואל בוקר
  eveningRitual: 5,            // ריטואל ערב
  streakDay: 20,               // יום רצף
  fiveMinuteSuccess: 5,        // הצלחה בכלל 5 דקות
  focusModeComplete: 15,       // סיום במצב התמקדות
  noInterruptions: 10,         // משימה ללא הפרעות
};

/**
 * הגדרת רמות
 */
const LEVELS = [
  { level: 1, name: 'מתחילה', minPoints: 0, icon: '🌱' },
  { level: 2, name: 'מתקדמת', minPoints: 100, icon: '🌿' },
  { level: 3, name: 'מיומנת', minPoints: 300, icon: '🌳' },
  { level: 4, name: 'מקצוענית', minPoints: 600, icon: '🌟' },
  { level: 5, name: 'מאסטרית', minPoints: 1000, icon: '⭐' },
  { level: 6, name: 'אלופה', minPoints: 1500, icon: '🏆' },
  { level: 7, name: 'אגדה', minPoints: 2500, icon: '👑' },
  { level: 8, name: 'מנהלת זמן על', minPoints: 4000, icon: '🦸‍♀️' },
];

/**
 * הגדרת הישגים
 */
const ACHIEVEMENTS = [
  // הישגי התחלה
  { id: 'first_task', name: 'צעד ראשון', description: 'השלמת משימה ראשונה', icon: '👣', condition: (s) => s.tasksCompleted >= 1 },
  { id: 'first_week', name: 'שבוע ראשון', description: '7 ימי סטריק', icon: '📅', condition: (s) => s.maxStreak >= 7 },
  
  // הישגי כמות
  { id: 'ten_tasks', name: 'עשירייה', description: '10 משימות', icon: '🔟', condition: (s) => s.tasksCompleted >= 10 },
  { id: 'fifty_tasks', name: 'חמישים!', description: '50 משימות', icon: '5️⃣0️⃣', condition: (s) => s.tasksCompleted >= 50 },
  { id: 'hundred_tasks', name: 'מאה!', description: '100 משימות', icon: '💯', condition: (s) => s.tasksCompleted >= 100 },
  
  // הישגי דיוק
  { id: 'time_master', name: 'מאסטרית זמן', description: '10 הערכות מדויקות', icon: '⏰', condition: (s) => s.accurateEstimates >= 10 },
  { id: 'precision', name: 'דייקנית', description: '80% דיוק בהערכות', icon: '🎯', condition: (s) => s.tasksCompleted >= 10 && (s.accurateEstimates / s.tasksCompleted) >= 0.8 },
  
  // הישגי רצף
  { id: 'week_streak', name: 'שבוע מושלם', description: 'רצף של 7 ימים', icon: '🔥', condition: (s) => s.maxStreak >= 7 },
  { id: 'two_week_streak', name: 'שבועיים ברצף', description: 'רצף של 14 ימים', icon: '🔥🔥', condition: (s) => s.maxStreak >= 14 },
  { id: 'month_streak', name: 'חודש מושלם', description: 'רצף של 30 ימים', icon: '🌟🔥', condition: (s) => s.maxStreak >= 30 },
  
  // הישגי התחלה בזמן
  { id: 'early_bird', name: 'ציפור מוקדמת', description: '5 משימות שהתחילו בזמן', icon: '🐦', condition: (s) => s.tasksStartedOnTime >= 5 },
  { id: 'punctual', name: 'דייקנית אמיתית', description: '20 משימות בזמן', icon: '⏱️', condition: (s) => s.tasksStartedOnTime >= 20 },
  
  // הישגים מיוחדים
  { id: 'five_min_hero', name: 'גיבורת 5 דקות', description: '10 הצלחות בכלל 5 דקות', icon: '⚡', condition: (s) => s.fiveMinuteSuccesses >= 10 },
  { id: 'focus_master', name: 'מלכת הריכוז', description: '10 משימות במצב התמקדות', icon: '🧘', condition: (s) => s.focusModeCompleted >= 10 },
];

/**
 * טעינת נתונים
 */
function loadGamificationData() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch {}
  
  return {
    points: 0,
    totalPoints: 0,
    currentStreak: 0,
    maxStreak: 0,
    lastActiveDate: null,
    tasksCompleted: 0,
    tasksStartedOnTime: 0,
    accurateEstimates: 0,
    fiveMinuteSuccesses: 0,
    focusModeCompleted: 0,
    achievements: [],
    dailyPoints: {},
    history: []
  };
}

/**
 * שמירת נתונים
 */
function saveGamificationData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

/**
 * Context לגיימיפיקציה
 */
const GamificationContext = createContext(null);

/**
 * Provider לגיימיפיקציה
 */
export function GamificationProvider({ children }) {
  const [data, setData] = useState(loadGamificationData);
  const [showLevelUp, setShowLevelUp] = useState(null);
  const [showAchievement, setShowAchievement] = useState(null);

  // חישוב רמה נוכחית
  const currentLevel = LEVELS.filter(l => data.totalPoints >= l.minPoints).pop() || LEVELS[0];
  const nextLevel = LEVELS.find(l => l.minPoints > data.totalPoints);
  const progressToNextLevel = nextLevel 
    ? ((data.totalPoints - currentLevel.minPoints) / (nextLevel.minPoints - currentLevel.minPoints)) * 100
    : 100;

  // עדכון סטריק יומי
  useEffect(() => {
    const today = toLocalISODate(new Date());
    
    if (data.lastActiveDate !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = toLocalISODate(yesterday);
      
      setData(prev => {
        const newData = { ...prev };
        
        if (prev.lastActiveDate === yesterdayStr) {
          // המשך רצף
          newData.currentStreak = prev.currentStreak + 1;
        } else if (prev.lastActiveDate !== today) {
          // הרצף נשבר
          newData.currentStreak = 1;
        }
        
        newData.maxStreak = Math.max(newData.maxStreak, newData.currentStreak);
        newData.lastActiveDate = today;
        
        saveGamificationData(newData);
        return newData;
      });
    }
  }, []);

  // בדיקת הישגים חדשים
  const checkAchievements = useCallback((newData) => {
    const unlockedIds = new Set(newData.achievements);
    
    ACHIEVEMENTS.forEach(achievement => {
      if (!unlockedIds.has(achievement.id) && achievement.condition(newData)) {
        newData.achievements.push(achievement.id);
        setShowAchievement(achievement);
        
        // הוספת נקודות על הישג
        newData.points += 50;
        newData.totalPoints += 50;
        
        toast.success(`🏆 הישג חדש: ${achievement.name}!`, { duration: 4000 });
      }
    });
    
    return newData;
  }, []);

  // הוספת נקודות
  const addPoints = useCallback((amount, reason = '') => {
    const today = toLocalISODate(new Date());
    
    setData(prev => {
      const oldLevel = LEVELS.filter(l => prev.totalPoints >= l.minPoints).pop();
      
      let newData = {
        ...prev,
        points: prev.points + amount,
        totalPoints: prev.totalPoints + amount,
        dailyPoints: {
          ...prev.dailyPoints,
          [today]: (prev.dailyPoints[today] || 0) + amount
        },
        history: [
          ...prev.history.slice(-99),
          { date: new Date().toISOString(), amount, reason }
        ]
      };
      
      // בדיקת הישגים
      newData = checkAchievements(newData);
      
      // בדיקת עלייה ברמה
      const newLevel = LEVELS.filter(l => newData.totalPoints >= l.minPoints).pop();
      if (newLevel && oldLevel && newLevel.level > oldLevel.level) {
        setShowLevelUp(newLevel);
        toast.success(`🎉 עלית לרמה ${newLevel.level}: ${newLevel.name}!`, { duration: 5000 });
      }
      
      saveGamificationData(newData);
      return newData;
    });

    // הודעה קטנה על הנקודות
    if (amount > 0) {
      toast(`+${amount} נקודות ${reason ? `(${reason})` : ''}`, {
        icon: '⭐',
        duration: 2000,
        style: { background: '#FEF3C7', color: '#92400E' }
      });
    }
  }, [checkAchievements]);

  // רישום השלמת משימה
  const recordTaskCompletion = useCallback((options = {}) => {
    const { onTime = false, early = false, accurate = false } = options;
    
    setData(prev => {
      let newData = {
        ...prev,
        tasksCompleted: prev.tasksCompleted + 1
      };
      
      if (accurate) {
        newData.accurateEstimates = prev.accurateEstimates + 1;
      }
      
      newData = checkAchievements(newData);
      saveGamificationData(newData);
      return newData;
    });

    // נקודות
    let points = POINT_VALUES.taskCompleted;
    let reason = 'השלמת משימה';
    
    if (early) {
      points = POINT_VALUES.taskCompletedEarly;
      reason = 'השלמה לפני הזמן!';
    } else if (onTime) {
      points = POINT_VALUES.taskCompletedOnTime;
      reason = 'השלמה בזמן';
    }
    
    addPoints(points, reason);
    
    if (accurate) {
      addPoints(POINT_VALUES.accurateEstimate, 'הערכה מדויקת');
    }
  }, [addPoints, checkAchievements]);

  // רישום התחלה בזמן
  const recordTaskStart = useCallback((onTime = true) => {
    if (onTime) {
      setData(prev => {
        let newData = {
          ...prev,
          tasksStartedOnTime: prev.tasksStartedOnTime + 1
        };
        newData = checkAchievements(newData);
        saveGamificationData(newData);
        return newData;
      });
      addPoints(POINT_VALUES.taskStartedOnTime, 'התחלה בזמן');
    }
  }, [addPoints, checkAchievements]);

  // רישום הצלחה בכלל 5 דקות
  const recordFiveMinuteSuccess = useCallback(() => {
    setData(prev => {
      let newData = {
        ...prev,
        fiveMinuteSuccesses: prev.fiveMinuteSuccesses + 1
      };
      newData = checkAchievements(newData);
      saveGamificationData(newData);
      return newData;
    });
    addPoints(POINT_VALUES.fiveMinuteSuccess, 'כלל 5 דקות');
  }, [addPoints, checkAchievements]);

  // רישום סיום במצב התמקדות
  const recordFocusModeComplete = useCallback(() => {
    setData(prev => {
      let newData = {
        ...prev,
        focusModeCompleted: prev.focusModeCompleted + 1
      };
      newData = checkAchievements(newData);
      saveGamificationData(newData);
      return newData;
    });
    addPoints(POINT_VALUES.focusModeComplete, 'מצב התמקדות');
  }, [addPoints, checkAchievements]);

  const value = {
    // נתונים
    points: data.points,
    totalPoints: data.totalPoints,
    currentStreak: data.currentStreak,
    maxStreak: data.maxStreak,
    tasksCompleted: data.tasksCompleted,
    achievements: data.achievements,
    dailyPoints: data.dailyPoints,
    
    // רמה
    currentLevel,
    nextLevel,
    progressToNextLevel,
    
    // פונקציות
    addPoints,
    recordTaskCompletion,
    recordTaskStart,
    recordFiveMinuteSuccess,
    recordFocusModeComplete,
    
    // הישגים
    allAchievements: ACHIEVEMENTS,
    unlockedAchievements: ACHIEVEMENTS.filter(a => data.achievements.includes(a.id)),
  };

  return (
    <GamificationContext.Provider value={value}>
      {children}
      
      {/* פופאפ עליית רמה */}
      <AnimatePresence>
        {showLevelUp && (
          <LevelUpPopup level={showLevelUp} onClose={() => setShowLevelUp(null)} />
        )}
      </AnimatePresence>
      
      {/* פופאפ הישג */}
      <AnimatePresence>
        {showAchievement && (
          <AchievementPopup achievement={showAchievement} onClose={() => setShowAchievement(null)} />
        )}
      </AnimatePresence>
    </GamificationContext.Provider>
  );
}

/**
 * Hook לשימוש בגיימיפיקציה
 */
export function useGamification() {
  const context = useContext(GamificationContext);
  if (!context) {
    throw new Error('useGamification must be used within GamificationProvider');
  }
  return context;
}

/**
 * פופאפ עליית רמה
 */
function LevelUpPopup({ level, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100]"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        exit={{ scale: 0, rotate: 180 }}
        transition={{ type: 'spring', damping: 15 }}
        className="bg-gradient-to-br from-yellow-400 to-orange-500 p-8 rounded-3xl text-center text-white shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="text-6xl mb-4">{level.icon}</div>
        <h2 className="text-3xl font-bold mb-2">עלית רמה!</h2>
        <p className="text-xl">רמה {level.level}: {level.name}</p>
        <button
          onClick={onClose}
          className="mt-6 px-6 py-2 bg-white text-orange-600 rounded-full font-medium hover:bg-orange-100"
        >
          מעולה! 🎉
        </button>
      </motion.div>
    </motion.div>
  );
}

/**
 * פופאפ הישג
 */
function AchievementPopup({ achievement, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -100 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -100 }}
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[100]"
    >
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4">
        <div className="text-4xl">{achievement.icon}</div>
        <div>
          <div className="font-bold">🏆 הישג חדש!</div>
          <div className="text-lg">{achievement.name}</div>
          <div className="text-sm text-purple-200">{achievement.description}</div>
        </div>
        <button onClick={onClose} className="text-white/70 hover:text-white">✕</button>
      </div>
    </motion.div>
  );
}

/**
 * קומפוננטת תצוגת נקודות קטנה
 */
export function PointsBadge({ className = '' }) {
  const { totalPoints, currentLevel, currentStreak } = useGamification();
  
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* רמה */}
      <div className="flex items-center gap-1 bg-gradient-to-r from-yellow-100 to-orange-100 dark:from-yellow-900/30 dark:to-orange-900/30 px-3 py-1 rounded-full">
        <span>{currentLevel.icon}</span>
        <span className="text-sm font-medium text-orange-700 dark:text-orange-300">
          {currentLevel.name}
        </span>
      </div>
      
      {/* נקודות */}
      <div className="flex items-center gap-1 bg-purple-100 dark:bg-purple-900/30 px-3 py-1 rounded-full">
        <span>⭐</span>
        <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
          {totalPoints}
        </span>
      </div>
      
      {/* סטריק */}
      {currentStreak > 0 && (
        <div className="flex items-center gap-1 bg-red-100 dark:bg-red-900/30 px-3 py-1 rounded-full">
          <span>🔥</span>
          <span className="text-sm font-medium text-red-700 dark:text-red-300">
            {currentStreak}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * קומפוננטת התקדמות מלאה
 */
export function ProgressDashboard() {
  const { 
    totalPoints, 
    currentLevel, 
    nextLevel, 
    progressToNextLevel,
    currentStreak,
    maxStreak,
    tasksCompleted,
    unlockedAchievements,
    allAchievements,
    dailyPoints
  } = useGamification();

  const today = toLocalISODate(new Date());
  const todayPoints = dailyPoints[today] || 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg space-y-6">
      {/* כותרת */}
      <div className="text-center">
        <div className="text-5xl mb-2">{currentLevel.icon}</div>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
          {currentLevel.name}
        </h2>
        <p className="text-gray-500">רמה {currentLevel.level}</p>
      </div>

      {/* פס התקדמות לרמה הבאה */}
      {nextLevel && (
        <div>
          <div className="flex justify-between text-sm text-gray-500 mb-1">
            <span>{totalPoints} נקודות</span>
            <span>{nextLevel.minPoints} לרמה הבאה</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressToNextLevel}%` }}
              className="h-3 rounded-full bg-gradient-to-r from-purple-500 to-pink-500"
            />
          </div>
          <p className="text-center text-xs text-gray-400 mt-1">
            {nextLevel.icon} {nextLevel.name} - עוד {nextLevel.minPoints - totalPoints} נקודות
          </p>
        </div>
      )}

      {/* סטטיסטיקות */}
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/30 rounded-xl">
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            {todayPoints}
          </div>
          <div className="text-xs text-gray-500">נקודות היום</div>
        </div>
        <div className="text-center p-3 bg-red-50 dark:bg-red-900/30 rounded-xl">
          <div className="text-2xl font-bold text-red-600 dark:text-red-400 flex items-center justify-center gap-1">
            🔥 {currentStreak}
          </div>
          <div className="text-xs text-gray-500">ימים ברצף</div>
        </div>
        <div className="text-center p-3 bg-green-50 dark:bg-green-900/30 rounded-xl">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {tasksCompleted}
          </div>
          <div className="text-xs text-gray-500">משימות</div>
        </div>
      </div>

      {/* רקורד */}
      {maxStreak > currentStreak && (
        <p className="text-center text-sm text-gray-500">
          🏆 הרקורד שלך: {maxStreak} ימים ברצף
        </p>
      )}

      {/* הישגים */}
      <div>
        <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
          <span>🏆</span> הישגים ({unlockedAchievements.length}/{allAchievements.length})
        </h3>
        <div className="grid grid-cols-5 gap-2">
          {allAchievements.map(achievement => {
            const isUnlocked = unlockedAchievements.some(a => a.id === achievement.id);
            return (
              <div
                key={achievement.id}
                className={`
                  aspect-square rounded-xl flex items-center justify-center text-2xl
                  ${isUnlocked 
                    ? 'bg-gradient-to-br from-yellow-100 to-orange-100 dark:from-yellow-900/30 dark:to-orange-900/30' 
                    : 'bg-gray-100 dark:bg-gray-700 opacity-40'
                  }
                `}
                title={`${achievement.name}: ${achievement.description}`}
              >
                {isUnlocked ? achievement.icon : '🔒'}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default { GamificationProvider, useGamification, PointsBadge, ProgressDashboard };
