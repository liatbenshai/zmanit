/**
 * 🧠 הגדרות אנרגיה אישיות - מותאם ADHD
 * 
 * מגדיר באיזה שעות כל סוג משימה עובד הכי טוב.
 * מבוסס על הידע שריכוז גבוה הוא בבוקר.
 * 
 * ⚙️ הגדרות ברירת מחדל מותאמות לליאת:
 * - תמלול: 08:30-14:00 (דורש ריכוז מקסימלי)
 * - הגהה: 14:00-16:15 (דורש ריכוז בינוני)
 * - מיילים: גמיש, עדיף סוף היום
 * - תקשורת לקוחות: עדיף לא בבוקר המוקדם
 */

const STORAGE_KEY = 'zmanit_energy_settings';

/**
 * הגדרות ברירת מחדל
 */
export const DEFAULT_ENERGY_SETTINGS = {
  // חלונות זמן (בדקות מחצות)
  windows: {
    earlyMorning: { start: 8 * 60 + 30, end: 10 * 60, name: 'בוקר מוקדם', icon: '🌅' },
    lateMorning: { start: 10 * 60, end: 12 * 60, name: 'בוקר מאוחר', icon: '☀️' },
    earlyAfternoon: { start: 12 * 60, end: 14 * 60, name: 'צהריים', icon: '🌤️' },
    lateAfternoon: { start: 14 * 60, end: 16 * 60 + 15, name: 'אחה"צ', icon: '🌇' }
  },

  // התאמת סוגי משימות לחלונות זמן
  taskTypePreferences: {
    // עבודות דורשות ריכוז גבוה - בוקר עד 14:00
    transcription: {
      name: 'תמלול',
      icon: '🎧',
      preferredWindows: ['earlyMorning', 'lateMorning', 'earlyAfternoon'],
      avoidWindows: ['lateAfternoon'],
      requiresFocus: true,
      priority: 1, // ישובץ ראשון
      notes: 'דורש ריכוז מקסימלי - עדיף בשעות הבוקר'
    },
    
    // הגהה - אחה"צ
    proofreading: {
      name: 'הגהה',
      icon: '📝',
      preferredWindows: ['lateAfternoon', 'earlyAfternoon'],
      avoidWindows: ['earlyMorning'],
      requiresFocus: true,
      priority: 2,
      notes: 'דורש ריכוז - אחרי שסיימת תמלולים'
    },
    
    // תרגום - דומה לתמלול
    translation: {
      name: 'תרגום',
      icon: '🌐',
      preferredWindows: ['earlyMorning', 'lateMorning'],
      avoidWindows: [],
      requiresFocus: true,
      priority: 1,
      notes: 'דורש ריכוז גבוה'
    },

    // מיילים - גמיש, עדיף סוף היום
    email: {
      name: 'מיילים',
      icon: '📧',
      preferredWindows: ['lateAfternoon'],
      avoidWindows: ['earlyMorning'],
      requiresFocus: false,
      priority: 4,
      notes: 'לא דורש ריכוז רב - עדיף בסוף היום'
    },

    // תקשורת לקוחות
    client_communication: {
      name: 'תקשורת לקוחות',
      icon: '💬',
      preferredWindows: ['lateMorning', 'earlyAfternoon'],
      avoidWindows: ['earlyMorning'],
      requiresFocus: false,
      priority: 3,
      notes: 'שיחות טלפון ופגישות - לא בבוקר המוקדם'
    },

    // קורס
    course: {
      name: 'קורס',
      icon: '📚',
      preferredWindows: ['lateMorning', 'earlyAfternoon'],
      avoidWindows: [],
      requiresFocus: true,
      priority: 2,
      notes: 'עבודה יצירתית - כשיש אנרגיה'
    },

    // ניהול
    admin: {
      name: 'ניהול',
      icon: '📋',
      preferredWindows: ['lateAfternoon'],
      avoidWindows: ['earlyMorning'],
      requiresFocus: false,
      priority: 5,
      notes: 'משימות אדמיניסטרטיביות - בסוף היום'
    },

    // אחר
    other: {
      name: 'אחר',
      icon: '📌',
      preferredWindows: ['earlyAfternoon', 'lateAfternoon'],
      avoidWindows: [],
      requiresFocus: false,
      priority: 5,
      notes: 'משימות כלליות'
    }
  },

  // הגדרות גלובליות
  global: {
    // שעת התחלת עבודה
    workStartMinutes: 8 * 60 + 30, // 08:30
    workEndMinutes: 16 * 60 + 15,   // 16:15
    
    // נקודת מעבר בין "משימות ריכוז" ל"משימות קלות"
    focusCutoffMinutes: 14 * 60, // 14:00
    
    // האם לכפות את ההעדפות או רק להציע
    enforcePreferences: false,
    
    // האם להציג אזהרה כששיבוץ לא אופטימלי
    warnOnSuboptimal: true
  }
};

/**
 * טעינת הגדרות
 */
export function loadEnergySettings() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return { ...DEFAULT_ENERGY_SETTINGS, ...JSON.parse(saved) };
    }
  } catch {}
  return DEFAULT_ENERGY_SETTINGS;
}

/**
 * שמירת הגדרות
 */
export function saveEnergySettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {}
}

/**
 * קבלת חלון הזמן המועדף למשימה
 * @param {string} taskType - סוג המשימה
 * @returns {Object} { startMinutes, endMinutes, windowName }
 */
export function getPreferredTimeWindow(taskType) {
  const settings = loadEnergySettings();
  const typeSettings = settings.taskTypePreferences[taskType] || settings.taskTypePreferences.other;
  const preferredWindowId = typeSettings.preferredWindows[0];
  const window = settings.windows[preferredWindowId];
  
  return {
    startMinutes: window?.start || settings.global.workStartMinutes,
    endMinutes: window?.end || settings.global.focusCutoffMinutes,
    windowName: window?.name || 'גמיש',
    windowIcon: window?.icon || '⏰'
  };
}

/**
 * בדיקה האם שעה מסוימת אופטימלית למשימה
 * @param {string} taskType - סוג המשימה
 * @param {number} timeMinutes - שעה בדקות מחצות
 * @returns {Object} { isOptimal, isAcceptable, reason }
 */
export function checkTimeOptimality(taskType, timeMinutes) {
  const settings = loadEnergySettings();
  const typeSettings = settings.taskTypePreferences[taskType] || settings.taskTypePreferences.other;
  
  // מציאת החלון שהשעה נופלת בו
  let currentWindow = null;
  let currentWindowId = null;
  
  for (const [windowId, window] of Object.entries(settings.windows)) {
    if (timeMinutes >= window.start && timeMinutes < window.end) {
      currentWindow = window;
      currentWindowId = windowId;
      break;
    }
  }
  
  if (!currentWindow) {
    return { isOptimal: false, isAcceptable: false, reason: 'מחוץ לשעות העבודה' };
  }
  
  // בדיקה האם זה חלון מועדף
  if (typeSettings.preferredWindows.includes(currentWindowId)) {
    return { isOptimal: true, isAcceptable: true, reason: `${currentWindow.icon} זמן מועדף ל${typeSettings.name}` };
  }
  
  // בדיקה האם זה חלון להימנע ממנו
  if (typeSettings.avoidWindows.includes(currentWindowId)) {
    return { 
      isOptimal: false, 
      isAcceptable: false, 
      reason: `⚠️ ${typeSettings.name} לא מומלץ ב${currentWindow.name}` 
    };
  }
  
  // מקובל אבל לא אופטימלי
  return { isOptimal: false, isAcceptable: true, reason: `${currentWindow.icon} זמן מקובל` };
}

/**
 * מיון משימות לפי סדר שיבוץ אופטימלי
 * @param {Array} tasks - רשימת משימות
 * @returns {Array} משימות ממוינות
 */
export function sortTasksByOptimalOrder(tasks) {
  const settings = loadEnergySettings();
  
  return [...tasks].sort((a, b) => {
    const aSettings = settings.taskTypePreferences[a.task_type] || settings.taskTypePreferences.other;
    const bSettings = settings.taskTypePreferences[b.task_type] || settings.taskTypePreferences.other;
    
    // משימות שדורשות ריכוז קודם
    if (aSettings.requiresFocus && !bSettings.requiresFocus) return -1;
    if (!aSettings.requiresFocus && bSettings.requiresFocus) return 1;
    
    // לפי עדיפות
    return (aSettings.priority || 5) - (bSettings.priority || 5);
  });
}

/**
 * קבלת המלצה לשיבוץ משימה
 * @param {Object} task - המשימה
 * @param {number} currentTimeMinutes - השעה הנוכחית
 * @param {Array} scheduledBlocks - בלוקים שכבר משובצים
 * @returns {Object} { suggestedStart, suggestedEnd, window, reason }
 */
export function getSuggestedSlot(task, currentTimeMinutes, scheduledBlocks = []) {
  const settings = loadEnergySettings();
  const typeSettings = settings.taskTypePreferences[task.task_type] || settings.taskTypePreferences.other;
  const duration = task.estimated_duration || 30;
  
  // עבור על החלונות המועדפים לפי סדר
  for (const windowId of typeSettings.preferredWindows) {
    const window = settings.windows[windowId];
    if (!window) continue;
    
    // מציאת סלוט פנוי בחלון
    const slot = findFreeSlotInWindow(window.start, window.end, duration, scheduledBlocks);
    if (slot) {
      return {
        suggestedStart: slot.start,
        suggestedEnd: slot.end,
        window: window,
        windowId,
        reason: `${window.icon} ${window.name} - זמן אופטימלי ל${typeSettings.name}`,
        isOptimal: true
      };
    }
  }
  
  // אם אין מקום בחלונות מועדפים, חפש בכל מקום
  const anySlot = findFreeSlotInWindow(
    settings.global.workStartMinutes, 
    settings.global.workEndMinutes, 
    duration, 
    scheduledBlocks
  );
  
  if (anySlot) {
    return {
      suggestedStart: anySlot.start,
      suggestedEnd: anySlot.end,
      window: null,
      windowId: null,
      reason: '⚠️ שובץ בזמן פנוי (לא אופטימלי)',
      isOptimal: false
    };
  }
  
  return null; // אין מקום היום
}

/**
 * מציאת סלוט פנוי בחלון
 */
function findFreeSlotInWindow(windowStart, windowEnd, duration, scheduledBlocks) {
  // מיון הבלוקים לפי שעת התחלה
  const sorted = [...scheduledBlocks].sort((a, b) => a.start - b.start);
  
  let searchStart = windowStart;
  
  for (const block of sorted) {
    // אם הבלוק מתחיל אחרי החלון - סיימנו
    if (block.start >= windowEnd) break;
    
    // אם יש מספיק מקום לפני הבלוק הזה
    if (block.start > searchStart && block.start - searchStart >= duration) {
      const end = Math.min(searchStart + duration, windowEnd);
      if (end - searchStart >= duration) {
        return { start: searchStart, end };
      }
    }
    
    // מעבר לאחרי הבלוק
    searchStart = Math.max(searchStart, block.end);
  }
  
  // בדיקה אם יש מקום אחרי כל הבלוקים
  if (windowEnd - searchStart >= duration) {
    return { start: searchStart, end: searchStart + duration };
  }
  
  return null;
}

/**
 * פורמט דקות לשעה
 */
export function formatTimeFromMinutes(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

export default {
  DEFAULT_ENERGY_SETTINGS,
  loadEnergySettings,
  saveEnergySettings,
  getPreferredTimeWindow,
  checkTimeOptimality,
  sortTasksByOptimalOrder,
  getSuggestedSlot,
  formatTimeFromMinutes
};
