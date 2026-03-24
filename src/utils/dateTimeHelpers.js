/**
 * Date & Time Helpers - United
 * =============================
 * 
 * Combined utilities for:
 * 1. Date handling (formatting, relative dates, calculations)
 * 2. Time tracking (per-task time spent, remaining, progress)
 * 3. Deadline calculations
 * 
 * Previously split between:
 * - dateHelpers.js (now archived/merged)
 * - timeHelpers.js (now archived/merged)
 */

// ====================================
// Constants
// ====================================

const MONTHS_HE = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
];

const DAYS_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

// ====================================
// DATE FUNCTIONS
// ====================================

/**
 * Convert date to local ISO format (YYYY-MM-DD)
 * 🔴 IMPORTANT: Use this instead of toISOString().split('T')[0] to avoid timezone issues
 */
export function toLocalISODate(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format date in Hebrew
 */
export function formatDateHe(dateString, options = {}) {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  const day = date.getDate();
  const month = MONTHS_HE[date.getMonth()];
  const year = date.getFullYear();
  
  if (options.short) {
    return `${day}/${date.getMonth() + 1}/${year}`;
  }
  
  if (options.withDay) {
    const dayName = DAYS_HE[date.getDay()];
    return `יום ${dayName}, ${day} ב${month} ${year}`;
  }
  
  return `${day} ב${month} ${year}`;
}

/**
 * Format time string (HH:MM)
 */
export function formatTime(timeString) {
  if (!timeString) return '';
  return timeString.slice(0, 5); // HH:MM
}

/**
 * Format date and time combined
 */
export function formatDateTime(dateString, timeString) {
  const dateFormatted = formatDateHe(dateString);
  if (!dateFormatted) return '';
  
  if (timeString) {
    return `${dateFormatted} בשעה ${formatTime(timeString)}`;
  }
  
  return dateFormatted;
}

/**
 * Get relative date (today, yesterday, tomorrow, etc.)
 */
export function getRelativeDate(dateString) {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const dateStr = toLocalISODate(date);
  const todayStr = toLocalISODate(today);
  const yesterdayStr = toLocalISODate(yesterday);
  const tomorrowStr = toLocalISODate(tomorrow);
  
  if (dateStr === todayStr) return 'היום';
  if (dateStr === yesterdayStr) return 'אתמול';
  if (dateStr === tomorrowStr) return 'מחר';
  
  // Within a week
  const daysUntil = Math.floor((date - today) / (1000 * 60 * 60 * 24));
  if (daysUntil > 1 && daysUntil <= 7) {
    return `ביום ${DAYS_HE[date.getDay()]}`;
  }
  
  return formatDateHe(dateString, { short: true });
}

/**
 * Get time ago (X minutes/hours/days ago)
 */
export function getTimeAgo(dateString) {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffSeconds < 60) return 'עכשיו';
  if (diffMinutes < 60) return `לפני ${diffMinutes} דקות`;
  if (diffHours < 24) return `לפני ${diffHours} שעות`;
  if (diffDays === 1) return 'אתמול';
  if (diffDays < 7) return `לפני ${diffDays} ימים`;
  if (diffDays < 30) return `לפני ${Math.floor(diffDays / 7)} שבועות`;
  
  return formatDateHe(dateString, { short: true });
}

/**
 * Get today in ISO format
 */
export function getTodayISO() {
  return toLocalISODate(new Date());
}

/**
 * Get minimum date (today)
 */
export function getMinDate() {
  return getTodayISO();
}

/**
 * Check if date is in the past
 */
export function isPastDate(dateString) {
  if (!dateString) return false;
  
  const date = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return date < today;
}

/**
 * Add days to a date
 */
export function addDays(dateString, days) {
  const date = new Date(dateString);
  date.setDate(date.getDate() + days);
  return toLocalISODate(date);
}

/**
 * Get week start (Sunday)
 */
export function getWeekStart(dateString) {
  const date = new Date(dateString || new Date());
  const day = date.getDay();
  date.setDate(date.getDate() - day);
  return toLocalISODate(date);
}

/**
 * Get week end (Saturday)
 */
export function getWeekEnd(dateString) {
  const date = new Date(dateString || new Date());
  const day = date.getDay();
  date.setDate(date.getDate() + (6 - day));
  return toLocalISODate(date);
}

// ====================================
// TIME FUNCTIONS (Per-Task)
// ====================================

/**
 * Get time spent on a task (including current session)
 */
export function getTimeSpent(task, elapsedSeconds = 0) {
  if (!task) return 0;
  
  const timeSpent = task.time_spent ? parseInt(task.time_spent) : 0;
  const currentSessionMinutes = Math.floor(elapsedSeconds / 60);
  
  return timeSpent + currentSessionMinutes;
}

/**
 * Get remaining time for a task
 */
export function getRemainingTime(task, elapsedSeconds = 0) {
  if (!task) return 0;
  
  const estimated = task.estimated_duration ? parseInt(task.estimated_duration) : 0;
  const totalSpent = getTimeSpent(task, elapsedSeconds);
  
  return Math.max(0, estimated - totalSpent);
}

/**
 * Get total time spent (alias for getTimeSpent for clarity)
 */
export function getTotalSpent(task, elapsedSeconds = 0) {
  return getTimeSpent(task, elapsedSeconds);
}

/**
 * Check if task exceeded estimated time
 */
export function isOverTime(task, elapsedSeconds = 0) {
  if (!task) return false;
  
  const estimated = task.estimated_duration ? parseInt(task.estimated_duration) : 0;
  if (estimated <= 0) return false;
  
  const totalSpent = getTimeSpent(task, elapsedSeconds);
  return totalSpent > estimated;
}

/**
 * Calculate progress percentage
 */
export function getProgress(task, elapsedSeconds = 0) {
  if (!task) return 0;
  
  const estimated = task.estimated_duration ? parseInt(task.estimated_duration) : 0;
  if (estimated <= 0) return 0;
  
  const totalSpent = getTimeSpent(task, elapsedSeconds);
  return Math.min(100, Math.round((totalSpent / estimated) * 100));
}

// ====================================
// TIME FORMATTING
// ====================================

/**
 * Format minutes to "X hours Y minutes" format
 */
export function formatTimeMinutes(minutes) {
  if (!minutes || minutes <= 0) return '0 דקות';
  
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours === 0) {
    return `${mins} דקות`;
  }
  
  if (mins === 0) {
    return `${hours} ${hours === 1 ? 'שעה' : 'שעות'}`;
  }
  
  return `${hours} ${hours === 1 ? 'שעה' : 'שעות'} ${mins} דקות`;
}

/**
 * Format seconds to "HH:MM:SS" format
 */
export function formatTimeSeconds(seconds) {
  if (!seconds || seconds < 0) return '00:00:00';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Format seconds to short "MM:SS" format
 */
export function formatTimeShort(seconds) {
  if (!seconds || seconds < 0) return '00:00';
  
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// ====================================
// DEADLINE CALCULATIONS
// ====================================

/**
 * Calculate minutes until deadline
 */
export function getMinutesUntilDeadline(dueDate, dueTime) {
  if (!dueDate) return null;
  
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Create deadline date
    const [year, month, day] = dueDate.split('-').map(Number);
    const deadlineDate = new Date(year, month - 1, day);
    
    // Add time if provided
    if (dueTime) {
      const [hours, minutes] = dueTime.split(':').map(Number);
      deadlineDate.setHours(hours || 0, minutes || 0, 0, 0);
    } else {
      deadlineDate.setHours(23, 59, 59, 999);
    }
    
    // Calculate difference in minutes
    const diffMs = deadlineDate - now;
    return Math.floor(diffMs / (1000 * 60));
  } catch (err) {
    console.error('❌ Error calculating deadline:', err);
    return null;
  }
}

/**
 * Check if deadline has passed
 */
export function isDeadlinePassed(dueDate, dueTime) {
  const minutesUntil = getMinutesUntilDeadline(dueDate, dueTime);
  return minutesUntil !== null && minutesUntil < 0;
}

// ====================================
// EXPORTS
// ====================================

export default {
  // Date functions
  toLocalISODate,
  formatDateHe,
  formatTime,
  formatDateTime,
  getRelativeDate,
  getTimeAgo,
  getTodayISO,
  getMinDate,
  isPastDate,
  addDays,
  getWeekStart,
  getWeekEnd,
  
  // Time functions (per-task)
  getTimeSpent,
  getRemainingTime,
  getTotalSpent,
  isOverTime,
  getProgress,
  
  // Time formatting
  formatTimeMinutes,
  formatTimeSeconds,
  formatTimeShort,
  
  // Deadline
  getMinutesUntilDeadline,
  isDeadlinePassed
};
