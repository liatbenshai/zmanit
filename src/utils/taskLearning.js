/**
 * מערכת למידה - מעקב אחר הערכה מול ביצוע בפועל
 * ================================================
 * 
 * לומדת מכל משימה שמסתיימת:
 * - כמה הערכת?
 * - כמה לקח בפועל?
 * - מה היחס?
 * 
 * ומציעה הערכות מדויקות יותר בפעם הבאה.
 */

const STORAGE_KEY = 'zmanit_task_learning';

/**
 * מבנה הנתונים:
 * {
 *   "transcription": {
 *     count: 15,           // כמה משימות מסוג זה הושלמו
 *     totalEstimated: 900, // סה"כ דקות שהוערכו
 *     totalActual: 1080,   // סה"כ דקות בפועל
 *     ratio: 1.2,          // יחס ממוצע (actual/estimated)
 *     history: [           // 10 אחרונות לניתוח
 *       { estimated: 60, actual: 72, date: "2024-12-30", taskTitle: "תמלול נעמה" },
 *       ...
 *     ]
 *   },
 *   "proofreading": { ... },
 *   ...
 * }
 */

/**
 * טעינת נתוני הלמידה מ-localStorage
 */
export function loadLearningData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('❌ שגיאה בטעינת נתוני למידה:', e);
  }
  return {};
}

/**
 * שמירת נתוני הלמידה
 */
function saveLearningData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('❌ שגיאה בשמירת נתוני למידה:', e);
  }
}

/**
 * הוספת נתון למידה חדש (כשמשימה מסתיימת)
 * 
 * @param {string} taskType - סוג המשימה (transcription, proofreading, etc.)
 * @param {number} estimatedMinutes - הערכה מקורית בדקות
 * @param {number} actualMinutes - זמן בפועל בדקות
 * @param {string} taskTitle - שם המשימה (לניתוח)
 */
export function recordTaskCompletion(taskType, estimatedMinutes, actualMinutes, taskTitle = '') {
  if (!taskType || !estimatedMinutes || !actualMinutes) {
    console.log('⚠️ חסרים נתונים ללמידה:', { taskType, estimatedMinutes, actualMinutes });
    return;
  }
  
  const data = loadLearningData();
  
  // אתחול סוג משימה אם לא קיים
  if (!data[taskType]) {
    data[taskType] = {
      count: 0,
      totalEstimated: 0,
      totalActual: 0,
      ratio: 1.0,
      history: []
    };
  }
  
  const typeData = data[taskType];
  
  // עדכון סטטיסטיקות
  typeData.count++;
  typeData.totalEstimated += estimatedMinutes;
  typeData.totalActual += actualMinutes;
  typeData.ratio = typeData.totalActual / typeData.totalEstimated;
  
  // הוספה להיסטוריה (שומרים 20 אחרונות)
  typeData.history.unshift({
    estimated: estimatedMinutes,
    actual: actualMinutes,
    date: new Date().toISOString().split('T')[0],
    taskTitle: taskTitle.substring(0, 50) // קיצור השם
  });
  
  // שמירת רק 20 אחרונות
  if (typeData.history.length > 20) {
    typeData.history = typeData.history.slice(0, 20);
  }
  
  saveLearningData(data);
  
  console.log(`📊 למידה: ${taskType} | הערכה: ${estimatedMinutes} | בפועל: ${actualMinutes} | יחס: ${typeData.ratio.toFixed(2)}`);
  
  return typeData;
}

/**
 * קבלת הערכה מותאמת לסוג משימה
 * 
 * @param {string} taskType - סוג המשימה
 * @param {number} baseEstimate - הערכה בסיסית (מה שהמשתמש הכניס)
 * @returns {Object} { suggestedMinutes, ratio, confidence, message }
 */
export function getSuggestedEstimate(taskType, baseEstimate) {
  const data = loadLearningData();
  const typeData = data[taskType];
  
  // אם אין מספיק נתונים - מחזירים את ההערכה המקורית
  if (!typeData || typeData.count < 3) {
    return {
      suggestedMinutes: baseEstimate,
      ratio: 1.0,
      confidence: 'low',
      message: 'אין מספיק נתונים - משתמש בהערכה שלך',
      hasData: false
    };
  }
  
  // חישוב הערכה מותאמת
  const suggestedMinutes = Math.round(baseEstimate * typeData.ratio);
  
  // רמת ביטחון לפי כמות הנתונים
  let confidence = 'low';
  if (typeData.count >= 10) confidence = 'high';
  else if (typeData.count >= 5) confidence = 'medium';
  
  // הודעה למשתמש
  let message = '';
  if (typeData.ratio > 1.15) {
    const percent = Math.round((typeData.ratio - 1) * 100);
    message = `בממוצע לוקח לך ${percent}% יותר מהצפוי במשימות ${getTaskTypeName(taskType)}`;
  } else if (typeData.ratio < 0.85) {
    const percent = Math.round((1 - typeData.ratio) * 100);
    message = `את מהירה! בממוצע מסיימת ${percent}% מהר יותר במשימות ${getTaskTypeName(taskType)}`;
  } else {
    message = `ההערכות שלך מדויקות למשימות ${getTaskTypeName(taskType)}`;
  }
  
  return {
    suggestedMinutes,
    originalMinutes: baseEstimate,
    ratio: typeData.ratio,
    confidence,
    message,
    hasData: true,
    sampleSize: typeData.count
  };
}

/**
 * קבלת סטטיסטיקות למידה לכל סוגי המשימות
 */
export function getLearningStats() {
  const data = loadLearningData();
  const stats = {};
  
  for (const [taskType, typeData] of Object.entries(data)) {
    stats[taskType] = {
      name: getTaskTypeName(taskType),
      count: typeData.count,
      avgEstimated: typeData.count > 0 ? Math.round(typeData.totalEstimated / typeData.count) : 0,
      avgActual: typeData.count > 0 ? Math.round(typeData.totalActual / typeData.count) : 0,
      ratio: typeData.ratio,
      ratioPercent: Math.round(typeData.ratio * 100),
      trend: calculateTrend(typeData.history)
    };
  }
  
  return stats;
}

/**
 * חישוב מגמה - האם משתפרים או לא
 */
function calculateTrend(history) {
  if (!history || history.length < 5) return 'unknown';
  
  // השוואה בין 5 אחרונות ל-5 שלפני
  const recent5 = history.slice(0, 5);
  const older5 = history.slice(5, 10);
  
  if (older5.length < 3) return 'unknown';
  
  const recentRatio = recent5.reduce((sum, h) => sum + (h.actual / h.estimated), 0) / recent5.length;
  const olderRatio = older5.reduce((sum, h) => sum + (h.actual / h.estimated), 0) / older5.length;
  
  if (recentRatio < olderRatio - 0.1) return 'improving'; // משתפרים
  if (recentRatio > olderRatio + 0.1) return 'declining'; // מדרדרים
  return 'stable'; // יציבים
}

/**
 * שם סוג משימה בעברית
 */
function getTaskTypeName(taskType) {
  const names = {
    'transcription': 'תמלול',
    'proofreading': 'הגהה',
    'email': 'מיילים',
    'course': 'קורס',
    'client_communication': 'לקוחות',
    'management': 'ניהול',
    'family': 'משפחה',
    'kids': 'ילדים',
    'personal': 'אישי',
    'unexpected': 'בלת"מים',
    'other': 'אחר'
  };
  return names[taskType] || taskType;
}

/**
 * איפוס נתוני למידה (לבדיקות)
 */
export function resetLearningData() {
  localStorage.removeItem(STORAGE_KEY);
  console.log('🗑️ נתוני למידה אופסו');
}

/**
 * קבלת היסטוריה לסוג משימה ספציפי
 */
export function getTaskTypeHistory(taskType) {
  const data = loadLearningData();
  return data[taskType]?.history || [];
}

/**
 * עדכון ידני של זמן בפועל (כשהמשתמש מתקן)
 * 
 * @param {string} taskType - סוג המשימה
 * @param {number} originalActual - הזמן שנרשם אוטומטית
 * @param {number} correctedActual - הזמן המתוקן
 */
export function correctActualTime(taskType, originalActual, correctedActual) {
  const data = loadLearningData();
  const typeData = data[taskType];
  
  if (!typeData) return;
  
  // עדכון הסטטיסטיקות
  typeData.totalActual = typeData.totalActual - originalActual + correctedActual;
  typeData.ratio = typeData.totalActual / typeData.totalEstimated;
  
  // עדכון ההיסטוריה האחרונה
  if (typeData.history.length > 0) {
    typeData.history[0].actual = correctedActual;
    typeData.history[0].corrected = true;
  }
  
  saveLearningData(data);
  
  console.log(`✏️ תיקון למידה: ${taskType} | מקורי: ${originalActual} | מתוקן: ${correctedActual}`);
}

// Alias for Settings page
export const clearLearningData = resetLearningData;

export default {
  loadLearningData,
  recordTaskCompletion,
  getSuggestedEstimate,
  getLearningStats,
  getTaskTypeHistory,
  correctActualTime,
  resetLearningData,
  clearLearningData
};
