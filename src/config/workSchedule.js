/**
 * הגדרות לוח זמנים ושעות עבודה + בית
 * ======================================
 * קובץ זה מכיל את כל ההגדרות הקשורות לזמן עבודה וזמן בית/משפחה
 */

/**
 * סוגי לוחות זמנים
 */
export const SCHEDULE_TYPES = {
  work: { id: 'work', name: 'עבודה', icon: '💼' },
  home: { id: 'home', name: 'בית/משפחה', icon: '🏠' }
};

/**
 * שעות עבודה לפי יום
 * ימים: 0 = ראשון, 1 = שני, ... , 6 = שבת
 */
export const WORK_HOURS = {
  0: { start: 8.5, end: 16.25, enabled: true, name: 'ראשון' },   // ראשון 08:30-16:15
  1: { start: 8.5, end: 16.25, enabled: true, name: 'שני' },     // שני
  2: { start: 8.5, end: 16.25, enabled: true, name: 'שלישי' },   // שלישי
  3: { start: 8.5, end: 16.25, enabled: true, name: 'רביעי' },   // רביעי
  4: { start: 8.5, end: 16.25, enabled: true, name: 'חמישי' },   // חמישי
  5: { start: null, end: null, enabled: false, name: 'שישי' },  // שישי - לא עובדים
  6: { start: null, end: null, enabled: false, name: 'שבת' }    // שבת - לא עובדים
};

/**
 * שעות בית/משפחה לפי יום
 * ימים: 0 = ראשון, 1 = שני, ... , 6 = שבת
 */
export const HOME_HOURS = {
  0: { start: 17, end: 21, enabled: true, name: 'ראשון' },   // ראשון 17:00-21:00
  1: { start: 17, end: 21, enabled: true, name: 'שני' },     // שני
  2: { start: 17, end: 21, enabled: true, name: 'שלישי' },   // שלישי
  3: { start: 17, end: 21, enabled: true, name: 'רביעי' },   // רביעי
  4: { start: 17, end: 21, enabled: true, name: 'חמישי' },   // חמישי
  5: { start: 8, end: 22, enabled: true, flexible: true, name: 'שישי' },  // שישי - כל היום בית
  6: { start: 8, end: 22, enabled: true, flexible: true, name: 'שבת' }    // שבת - כל היום בית
};

/**
 * אחוז מרווח לבלת"מים והפרעות
 * 25% = רבע מהזמן שמור לדברים לא צפויים
 */
export const BUFFER_PERCENTAGE = 25;

/**
 * הגדרות נוספות
 */
export const SCHEDULE_CONFIG = {
  // זמן מינימלי בין משימות (דקות)
  minBreakBetweenTasks: 5,
  
  // משך מינימלי למשימה (דקות)
  minTaskDuration: 15,
  
  // משך מקסימלי למשימה רציפה לפני הפסקה מומלצת (דקות)
  maxContinuousWork: 90,
  
  // גודל מקטע מקסימלי לפיצול משימות ארוכות (דקות)
  maxChunkSize: 45,
  
  // שעת התחלה מומלצת למשימות קשות
  peakEnergyStart: 9,
  peakEnergyEnd: 12
};

/**
 * קבלת לוח הזמנים המתאים לפי סוג
 * @param {string} scheduleType - 'work' או 'home'
 * @returns {object} לוח השעות המתאים
 */
export function getScheduleByType(scheduleType = 'work') {
  return scheduleType === 'home' ? HOME_HOURS : WORK_HOURS;
}

/**
 * חישוב דקות זמינות ביום מסוים לפי סוג
 * @param {number} dayOfWeek - יום בשבוע (0-6)
 * @param {string} scheduleType - 'work' או 'home'
 * @returns {number} דקות זמינות
 */
export function getMinutesForDay(dayOfWeek, scheduleType = 'work') {
  const schedule = getScheduleByType(scheduleType);
  const dayConfig = schedule[dayOfWeek];
  
  if (!dayConfig || !dayConfig.enabled) return 0;
  
  // אם יום גמיש (שישי/שבת לבית) - מחזירים 0 כי אין הגבלה
  if (dayConfig.flexible) return 0;
  
  return (dayConfig.end - dayConfig.start) * 60;
}

/**
 * חישוב דקות עבודה ביום מסוים (לתאימות אחורה)
 * @param {number} dayOfWeek - יום בשבוע (0-6)
 * @returns {number} דקות עבודה
 */
export function getWorkMinutesForDay(dayOfWeek) {
  return getMinutesForDay(dayOfWeek, 'work');
}

/**
 * חישוב דקות זמינות לתכנון (אחרי מרווח בלת"מים)
 * @param {number} dayOfWeek - יום בשבוע (0-6)
 * @param {string} scheduleType - 'work' או 'home'
 * @returns {number} דקות זמינות
 */
export function getAvailableMinutesForDay(dayOfWeek, scheduleType = 'work') {
  const totalMinutes = getMinutesForDay(dayOfWeek, scheduleType);
  if (totalMinutes === 0) return 0; // יום גמיש או לא פעיל
  const bufferMinutes = Math.round(totalMinutes * (BUFFER_PERCENTAGE / 100));
  return totalMinutes - bufferMinutes;
}

/**
 * חישוב דקות מרווח (בלת"מים) ליום
 * @param {number} dayOfWeek - יום בשבוע (0-6)
 * @param {string} scheduleType - 'work' או 'home'
 * @returns {number} דקות מרווח
 */
export function getBufferMinutesForDay(dayOfWeek, scheduleType = 'work') {
  const totalMinutes = getMinutesForDay(dayOfWeek, scheduleType);
  return Math.round(totalMinutes * (BUFFER_PERCENTAGE / 100));
}

/**
 * בדיקה האם יום מסוים פעיל לסוג לוח זמנים
 * @param {Date} date - תאריך
 * @param {string} scheduleType - 'work' או 'home'
 * @returns {boolean}
 */
export function isDayEnabled(date, scheduleType = 'work') {
  const dayOfWeek = date.getDay();
  const schedule = getScheduleByType(scheduleType);
  return schedule[dayOfWeek]?.enabled || false;
}

/**
 * בדיקה האם יום מסוים הוא יום עבודה (לתאימות אחורה)
 * @param {Date} date - תאריך
 * @returns {boolean}
 */
export function isWorkDay(date) {
  return isDayEnabled(date, 'work');
}

/**
 * בדיקה האם יום גמיש (ללא הגבלת שעות)
 * @param {Date} date - תאריך
 * @param {string} scheduleType - 'work' או 'home'
 * @returns {boolean}
 */
export function isFlexibleDay(date, scheduleType = 'work') {
  const dayOfWeek = date.getDay();
  const schedule = getScheduleByType(scheduleType);
  return schedule[dayOfWeek]?.flexible || false;
}

/**
 * קבלת שעות לתאריך מסוים לפי סוג
 * @param {Date} date - תאריך
 * @param {string} scheduleType - 'work' או 'home'
 * @returns {object|null} { start, end, flexible } או null אם לא פעיל
 */
export function getHoursForDate(date, scheduleType = 'work') {
  const dayOfWeek = date.getDay();
  const schedule = getScheduleByType(scheduleType);
  const config = schedule[dayOfWeek];
  
  if (!config || !config.enabled) return null;
  
  return { 
    start: config.start, 
    end: config.end,
    flexible: config.flexible || false
  };
}

/**
 * קבלת שעות העבודה לתאריך מסוים (לתאימות אחורה)
 * @param {Date} date - תאריך
 * @returns {object|null} { start, end } או null אם לא יום עבודה
 */
export function getWorkHoursForDate(date) {
  return getHoursForDate(date, 'work');
}

/**
 * בדיקה האם שעה מסוימת בטווח המותר
 * @param {Date} date - תאריך
 * @param {number} hour - שעה (0-23)
 * @param {number} minute - דקה (0-59)
 * @param {string} scheduleType - 'work' או 'home'
 * @returns {boolean}
 */
export function isTimeInSchedule(date, hour, minute = 0, scheduleType = 'work') {
  const hours = getHoursForDate(date, scheduleType);
  if (!hours) return false;
  
  // יום גמיש - כל שעה מותרת
  if (hours.flexible) return true;
  
  const timeValue = hour + (minute / 60);
  return timeValue >= hours.start && timeValue < hours.end;
}

/**
 * קבלת כל ימי העבודה בשבוע נתון
 * @param {Date} weekStart - תחילת השבוע (יום ראשון)
 * @param {string} scheduleType - 'work' או 'home'
 * @returns {Date[]} מערך תאריכים של ימים פעילים
 */
export function getEnabledDaysInWeek(weekStart, scheduleType = 'work') {
  const enabledDays = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    if (isDayEnabled(date, scheduleType)) {
      enabledDays.push(date);
    }
  }
  return enabledDays;
}

/**
 * קבלת כל ימי העבודה בשבוע נתון (לתאימות אחורה)
 */
export function getWorkDaysInWeek(weekStart) {
  return getEnabledDaysInWeek(weekStart, 'work');
}

/**
 * חישוב סה"כ דקות זמינות בשבוע
 * @param {string} scheduleType - 'work' או 'home'
 * @returns {number} סה"כ דקות זמינות
 */
export function getTotalWeeklyMinutes(scheduleType = 'work') {
  let total = 0;
  for (let day = 0; day < 7; day++) {
    total += getAvailableMinutesForDay(day, scheduleType);
  }
  return total;
}

/**
 * חישוב סה"כ דקות זמינות בשבוע (לתאימות אחורה)
 */
export function getTotalWeeklyAvailableMinutes() {
  return getTotalWeeklyMinutes('work');
}

/**
 * פורמט שעה לתצוגה
 * @param {number} hour - שעה (יכולה להיות עשרונית, למשל 8.5 = 08:30)
 * @param {number} minutes - דקות נוספות (אופציונלי)
 * @returns {string} פורמט HH:MM
 */
export function formatTime(hour, minutes = 0) {
  const totalMinutes = Math.round(hour * 60) + minutes;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/**
 * פורמט דקות לתצוגה קריאה
 * @param {number} minutes - מספר דקות
 * @returns {string} פורמט קריא (לדוגמה: "2:30 שעות" או "45 דקות")
 */
export function formatDuration(minutes) {
  if (!minutes || minutes <= 0) return '0 דקות';
  if (minutes < 60) return `${minutes} דקות`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours} שעות`;
  return `${hours}:${mins.toString().padStart(2, '0')} שעות`;
}

/**
 * סיכום הגדרות לתצוגה
 * @param {string} scheduleType - 'work' או 'home'
 */
export function getScheduleSummary(scheduleType = 'work') {
  const schedule = getScheduleByType(scheduleType);
  const scheduleInfo = SCHEDULE_TYPES[scheduleType];
  
  const days = Object.entries(schedule)
    .filter(([_, config]) => config.enabled)
    .map(([day, config]) => ({
      day: parseInt(day),
      name: config.name,
      hours: config.flexible ? 'גמיש' : `${formatTime(config.start)}-${formatTime(config.end)}`,
      totalMinutes: getMinutesForDay(parseInt(day), scheduleType),
      availableMinutes: getAvailableMinutesForDay(parseInt(day), scheduleType),
      bufferMinutes: getBufferMinutesForDay(parseInt(day), scheduleType),
      flexible: config.flexible || false
    }));

  return {
    type: scheduleType,
    name: scheduleInfo.name,
    icon: scheduleInfo.icon,
    days,
    bufferPercentage: BUFFER_PERCENTAGE,
    totalWeeklyMinutes: days.reduce((sum, d) => sum + d.totalMinutes, 0),
    availableWeeklyMinutes: days.reduce((sum, d) => sum + d.availableMinutes, 0),
    bufferWeeklyMinutes: days.reduce((sum, d) => sum + d.bufferMinutes, 0)
  };
}

export default {
  SCHEDULE_TYPES,
  WORK_HOURS,
  HOME_HOURS,
  BUFFER_PERCENTAGE,
  SCHEDULE_CONFIG,
  getScheduleByType,
  getMinutesForDay,
  getWorkMinutesForDay,
  getAvailableMinutesForDay,
  getBufferMinutesForDay,
  isDayEnabled,
  isWorkDay,
  isFlexibleDay,
  getHoursForDate,
  getWorkHoursForDate,
  isTimeInSchedule,
  getEnabledDaysInWeek,
  getWorkDaysInWeek,
  getTotalWeeklyMinutes,
  getTotalWeeklyAvailableMinutes,
  formatTime,
  formatDuration,
  getScheduleSummary
};
