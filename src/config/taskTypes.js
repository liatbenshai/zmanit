/**
 * הגדרות סוגי משימות - קובץ מרכזי
 * כל הקומפוננטים משתמשים בקובץ הזה
 * ✅ תומך בסוגי משימות מותאמים אישית
 */

const CUSTOM_TYPES_KEY = 'zmanit_custom_task_types';

// =====================================
// קטגוריות משימות
// =====================================
export const TASK_CATEGORIES = {
  work: { 
    id: 'work', 
    name: 'עבודה', 
    icon: '💼',
    hours: { start: 8.5, end: 16.25 }  // 08:30 - 16:15
  },
  family: { 
    id: 'family', 
    name: 'משפחה', 
    icon: '👨‍👩‍👧‍👦',
    hours: { start: 17, end: 21 }  // 17:00 - 21:00
  },
  home: { 
    id: 'home', 
    name: 'בית', 
    icon: '🏠',
    hours: { start: 17, end: 21 }  // 17:00 - 21:00
  }
};

// =====================================
// סוגי משימות מובנים
// =====================================
export const BUILT_IN_TASK_TYPES = {
  // === עבודה ===
  transcription: { 
    id: 'transcription', 
    name: 'תמלול', 
    icon: '🎙️',
    category: 'work',
    gradient: 'from-purple-500 to-indigo-600',
    bg: 'bg-purple-500',
    bgColor: '#f3e8ff',
    bgLight: 'bg-purple-100 dark:bg-purple-900/30',
    text: 'text-purple-800 dark:text-purple-200',
    border: 'border-purple-300 dark:border-purple-700',
    borderColor: '#a855f7',
    color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 border-purple-300 dark:border-purple-700',
    inputType: 'manual_with_source', // ✅ שינוי: הזנה ידנית עם אפשרות לאורך מקור
    sourceLabel: 'אורך הקלטה (דקות)',
    sourcePlaceholder: 'לדוגמה: 60',
    defaultDuration: 90,
    preferredHours: { start: 8.5, end: 12 },
    isBuiltIn: true
  },
  
  proofreading: { 
    id: 'proofreading', 
    name: 'הגהה', 
    icon: '✅',
    category: 'work',
    gradient: 'from-blue-500 to-cyan-600',
    bg: 'bg-blue-500',
    bgColor: '#dbeafe',
    bgLight: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-800 dark:text-blue-200',
    border: 'border-blue-300 dark:border-blue-700',
    borderColor: '#3b82f6',
    color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-700',
    inputType: 'manual_with_source', // ✅ שינוי: הזנה ידנית
    sourceLabel: 'אורך תמלול מקורי (דקות)',
    sourcePlaceholder: 'לדוגמה: 60',
    defaultDuration: 30,
    preferredHours: { start: 12, end: 16.25 },
    isBuiltIn: true
  },
  
  translation: { 
    id: 'translation', 
    name: 'תרגום', 
    icon: '🌍',
    category: 'work',
    gradient: 'from-indigo-500 to-blue-600',
    bg: 'bg-indigo-500',
    bgColor: '#e0e7ff',
    bgLight: 'bg-indigo-100 dark:bg-indigo-900/30',
    text: 'text-indigo-800 dark:text-indigo-200',
    border: 'border-indigo-300 dark:border-indigo-700',
    borderColor: '#6366f1',
    color: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-200 border-indigo-300 dark:border-indigo-700',
    inputType: 'manual_with_source', // ✅ שינוי: הזנה ידנית
    sourceLabel: 'מספר עמודים',
    sourcePlaceholder: 'לדוגמה: 5',
    defaultDuration: 60,
    preferredHours: { start: 12, end: 16.25 },
    isBuiltIn: true
  },
  
  admin: { 
    id: 'admin', 
    name: 'אדמיניסטרציה', 
    icon: '📋',
    category: 'work',
    gradient: 'from-amber-500 to-yellow-600',
    bg: 'bg-amber-500',
    bgColor: '#fef3c7',
    bgLight: 'bg-yellow-100 dark:bg-yellow-900/30',
    text: 'text-yellow-800 dark:text-yellow-200',
    border: 'border-yellow-300 dark:border-yellow-700',
    borderColor: '#eab308',
    color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 border-yellow-300 dark:border-yellow-700',
    inputType: 'direct',
    defaultDuration: 15,
    preferredHours: { start: 8.5, end: 8.75 },
    isBuiltIn: true
  },

  email: { 
    id: 'email', 
    name: 'מענה למיילים', 
    icon: '📧',
    category: 'work',
    gradient: 'from-cyan-500 to-blue-600',
    bg: 'bg-cyan-500',
    bgColor: '#cffafe',
    bgLight: 'bg-cyan-100 dark:bg-cyan-900/30',
    text: 'text-cyan-800 dark:text-cyan-200',
    border: 'border-cyan-300 dark:border-cyan-700',
    borderColor: '#06b6d4',
    color: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-200 border-cyan-300 dark:border-cyan-700',
    inputType: 'direct',
    defaultDuration: 15,
    preferredHours: { start: 8.5, end: 16.25 },
    isBuiltIn: true
  },

  // === משפחה ===
  shaked: { 
    id: 'shaked', 
    name: 'שקד', 
    icon: '👧',
    category: 'family',
    gradient: 'from-pink-500 to-rose-600',
    bg: 'bg-pink-500',
    bgColor: '#fce7f3',
    bgLight: 'bg-pink-100 dark:bg-pink-900/30',
    text: 'text-pink-800 dark:text-pink-200',
    border: 'border-pink-300 dark:border-pink-700',
    borderColor: '#ec4899',
    color: 'bg-pink-100 dark:bg-pink-900/30 text-pink-800 dark:text-pink-200 border-pink-300 dark:border-pink-700',
    inputType: 'direct',
    defaultDuration: 45,
    preferredHours: { start: 17, end: 21 },
    isBuiltIn: true
  },
  
  dor: { 
    id: 'dor', 
    name: 'דור', 
    icon: '👦',
    category: 'family',
    gradient: 'from-blue-500 to-indigo-600',
    bg: 'bg-blue-500',
    bgColor: '#dbeafe',
    bgLight: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-800 dark:text-blue-200',
    border: 'border-blue-300 dark:border-blue-700',
    borderColor: '#3b82f6',
    color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-700',
    inputType: 'direct',
    defaultDuration: 45,
    preferredHours: { start: 17, end: 21 },
    isBuiltIn: true
  },
  
  ava: { 
    id: 'ava', 
    name: 'אווה', 
    icon: '👶',
    category: 'family',
    gradient: 'from-purple-500 to-pink-600',
    bg: 'bg-purple-500',
    bgColor: '#f3e8ff',
    bgLight: 'bg-purple-100 dark:bg-purple-900/30',
    text: 'text-purple-800 dark:text-purple-200',
    border: 'border-purple-300 dark:border-purple-700',
    borderColor: '#a855f7',
    color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 border-purple-300 dark:border-purple-700',
    inputType: 'direct',
    defaultDuration: 45,
    preferredHours: { start: 17, end: 21 },
    isBuiltIn: true
  },
  
  yaron: { 
    id: 'yaron', 
    name: 'זמן עם ירון', 
    icon: '👨',
    category: 'family',
    gradient: 'from-emerald-500 to-teal-600',
    bg: 'bg-emerald-500',
    bgColor: '#d1fae5',
    bgLight: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-800 dark:text-green-200',
    border: 'border-green-300 dark:border-green-700',
    borderColor: '#22c55e',
    color: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border-green-300 dark:border-green-700',
    inputType: 'direct',
    defaultDuration: 60,
    preferredHours: { start: 17, end: 21 },
    isBuiltIn: true
  },

  // === בית ===
  cleaning: { 
    id: 'cleaning', 
    name: 'ניקיון', 
    icon: '🧹',
    category: 'home',
    gradient: 'from-cyan-500 to-blue-600',
    bg: 'bg-cyan-500',
    bgColor: '#cffafe',
    bgLight: 'bg-cyan-100 dark:bg-cyan-900/30',
    text: 'text-cyan-800 dark:text-cyan-200',
    border: 'border-cyan-300 dark:border-cyan-700',
    borderColor: '#06b6d4',
    color: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-200 border-cyan-300 dark:border-cyan-700',
    inputType: 'direct',
    defaultDuration: 60,
    preferredHours: { start: 17, end: 21 },
    isBuiltIn: true
  },
  
  cooking: { 
    id: 'cooking', 
    name: 'בישולים', 
    icon: '🍳',
    category: 'home',
    gradient: 'from-orange-500 to-red-600',
    bg: 'bg-orange-500',
    bgColor: '#ffedd5',
    bgLight: 'bg-orange-100 dark:bg-orange-900/30',
    text: 'text-orange-800 dark:text-orange-200',
    border: 'border-orange-300 dark:border-orange-700',
    borderColor: '#f97316',
    color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 border-orange-300 dark:border-orange-700',
    inputType: 'direct',
    defaultDuration: 60,
    preferredHours: { start: 17, end: 21 },
    isBuiltIn: true
  },

  laundry: { 
    id: 'laundry', 
    name: 'כביסה', 
    icon: '🧺',
    category: 'home',
    gradient: 'from-blue-500 to-cyan-600',
    bg: 'bg-blue-500',
    bgColor: '#dbeafe',
    bgLight: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-800 dark:text-blue-200',
    border: 'border-blue-300 dark:border-blue-700',
    borderColor: '#3b82f6',
    color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-700',
    inputType: 'direct',
    defaultDuration: 30,
    preferredHours: { start: 17, end: 21 },
    isBuiltIn: true
  },

  shopping: { 
    id: 'shopping', 
    name: 'קניות', 
    icon: '🛒',
    category: 'home',
    gradient: 'from-green-500 to-emerald-600',
    bg: 'bg-green-500',
    bgColor: '#dcfce7',
    bgLight: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-800 dark:text-green-200',
    border: 'border-green-300 dark:border-green-700',
    borderColor: '#22c55e',
    color: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border-green-300 dark:border-green-700',
    inputType: 'direct',
    defaultDuration: 45,
    preferredHours: { start: 17, end: 21 },
    isBuiltIn: true
  },
  
  other: { 
    id: 'other', 
    name: 'אחר', 
    icon: '📌',
    category: 'work',
    gradient: 'from-gray-500 to-slate-600',
    bg: 'bg-gray-500',
    bgColor: '#f3f4f6',
    bgLight: 'bg-gray-100 dark:bg-gray-800',
    text: 'text-gray-800 dark:text-gray-200',
    border: 'border-gray-300 dark:border-gray-600',
    borderColor: '#6b7280',
    color: 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600',
    inputType: 'direct',
    defaultDuration: 30,
    preferredHours: { start: 8, end: 21 },
    isBuiltIn: true
  }
};

// =====================================
// ניהול סוגי משימות מותאמים אישית
// =====================================

/**
 * טעינת סוגי משימות מותאמים אישית מ-localStorage
 */
export function loadCustomTaskTypes() {
  try {
    const saved = localStorage.getItem(CUSTOM_TYPES_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('שגיאה בטעינת סוגי משימות מותאמים:', e);
  }
  return {};
}

/**
 * שמירת סוגי משימות מותאמים אישית
 */
export function saveCustomTaskTypes(customTypes) {
  try {
    localStorage.setItem(CUSTOM_TYPES_KEY, JSON.stringify(customTypes));
  } catch (e) {
    console.error('שגיאה בשמירת סוגי משימות מותאמים:', e);
  }
}

/**
 * הוספת סוג משימה חדש
 */
export function addCustomTaskType(taskType) {
  const customTypes = loadCustomTaskTypes();
  
  const id = taskType.id || `custom_${Date.now()}`;
  
  // צבעים לפי קטגוריה
  const categoryColors = {
    work: {
      gradient: 'from-slate-500 to-gray-600',
      bg: 'bg-slate-500',
      bgColor: '#f1f5f9',
      bgLight: 'bg-slate-100 dark:bg-slate-900/30',
      text: 'text-slate-800 dark:text-slate-200',
      border: 'border-slate-300 dark:border-slate-700',
      borderColor: '#64748b'
    },
    family: {
      gradient: 'from-rose-500 to-pink-600',
      bg: 'bg-rose-500',
      bgColor: '#ffe4e6',
      bgLight: 'bg-rose-100 dark:bg-rose-900/30',
      text: 'text-rose-800 dark:text-rose-200',
      border: 'border-rose-300 dark:border-rose-700',
      borderColor: '#f43f5e'
    },
    home: {
      gradient: 'from-teal-500 to-emerald-600',
      bg: 'bg-teal-500',
      bgColor: '#ccfbf1',
      bgLight: 'bg-teal-100 dark:bg-teal-900/30',
      text: 'text-teal-800 dark:text-teal-200',
      border: 'border-teal-300 dark:border-teal-700',
      borderColor: '#14b8a6'
    }
  };
  
  const colors = categoryColors[taskType.category] || categoryColors.home;
  const categoryHours = TASK_CATEGORIES[taskType.category]?.hours || { start: 17, end: 21 };
  
  customTypes[id] = {
    id,
    name: taskType.name,
    icon: taskType.icon || '📌',
    category: taskType.category || 'home',
    ...colors,
    color: `${colors.bgLight} ${colors.text} ${colors.border}`,
    inputType: 'direct',
    defaultDuration: taskType.defaultDuration || 30,
    preferredHours: categoryHours,
    isBuiltIn: false,
    isCustom: true
  };
  
  saveCustomTaskTypes(customTypes);
  
  return customTypes[id];
}

/**
 * עדכון סוג משימה מותאם אישית
 */
export function updateCustomTaskType(id, updates) {
  const customTypes = loadCustomTaskTypes();
  
  if (!customTypes[id]) {
    console.error(`סוג משימה ${id} לא נמצא`);
    return null;
  }
  
  customTypes[id] = { ...customTypes[id], ...updates };
  saveCustomTaskTypes(customTypes);
  return customTypes[id];
}

/**
 * מחיקת סוג משימה מותאם אישית
 */
export function deleteCustomTaskType(id) {
  const customTypes = loadCustomTaskTypes();
  
  if (!customTypes[id]) {
    return false;
  }
  
  delete customTypes[id];
  saveCustomTaskTypes(customTypes);
  
  return true;
}

// =====================================
// פונקציות עזר - משולבות מובנה + מותאם
// =====================================

/**
 * קבלת כל סוגי המשימות (מובנים + מותאמים)
 */
export function getAllTaskTypes() {
  const customTypes = loadCustomTaskTypes();
  return { ...BUILT_IN_TASK_TYPES, ...customTypes };
}

/**
 * TASK_TYPES - לתאימות לאחור
 */
export const TASK_TYPES = new Proxy({}, {
  get(target, prop) {
    if (prop === Symbol.iterator || prop === 'length') return undefined;
    const allTypes = getAllTaskTypes();
    return allTypes[prop];
  },
  ownKeys() {
    return Object.keys(getAllTaskTypes());
  },
  getOwnPropertyDescriptor(target, prop) {
    const allTypes = getAllTaskTypes();
    if (prop in allTypes) {
      return { enumerable: true, configurable: true, value: allTypes[prop] };
    }
    return undefined;
  },
  has(target, prop) {
    return prop in getAllTaskTypes();
  }
});

/**
 * קבלת סוג משימה עם ברירת מחדל
 */
export function getTaskType(typeId) {
  const allTypes = getAllTaskTypes();
  return allTypes[typeId] || allTypes.other || BUILT_IN_TASK_TYPES.other;
}

/**
 * רשימת סוגי משימות לבחירה
 */
export function getTaskTypesList() {
  return Object.values(getAllTaskTypes());
}

/**
 * רשימת סוגי משימות לפי קטגוריה
 */
export function getTaskTypesByCategory(category) {
  return Object.values(getAllTaskTypes()).filter(t => t.category === category);
}

/**
 * חישוב זמן עבודה לפי סוג משימה
 * ✅ שינוי: לא מחשב אוטומטית - מחזיר את הערך שהוזן
 */
export function calculateWorkTime(typeId, inputValue) {
  const type = getTaskType(typeId);
  
  if (!inputValue || inputValue <= 0) {
    return type.defaultDuration;
  }
  
  // ✅ כל הסוגים עכשיו מחזירים את הערך שהוזן ישירות
  return inputValue;
}

/**
 * קבלת תווית שדה הקלט לפי סוג
 */
export function getInputLabel(typeId) {
  const type = getTaskType(typeId);
  
  // ✅ תמיד "משך משימה משוער"
  return 'משך משימה משוער (דקות)';
}

/**
 * קבלת תווית שדה המקור (אורך הקלטה/עמודים)
 */
export function getSourceLabel(typeId) {
  const type = getTaskType(typeId);
  return type.sourceLabel || null;
}

/**
 * קבלת placeholder לשדה המקור
 */
export function getSourcePlaceholder(typeId) {
  const type = getTaskType(typeId);
  return type.sourcePlaceholder || '';
}

/**
 * בדיקה אם לסוג יש שדה מקור
 */
export function hasSourceField(typeId) {
  const type = getTaskType(typeId);
  return type.inputType === 'manual_with_source';
}

/**
 * קבלת placeholder לשדה הקלט
 */
export function getInputPlaceholder(typeId) {
  return 'לדוגמה: 45';
}

/**
 * שעות מועדפות לפי סוג
 */
export function getPreferredHours(typeId) {
  const type = getTaskType(typeId);
  return type.preferredHours || { start: 8, end: 21 };
}

/**
 * זמן ברירת מחדל לפי סוג
 */
export function getDefaultDuration(typeId) {
  const type = getTaskType(typeId);
  return type.defaultDuration || 30;
}

/**
 * קבלת צבע גבול CSS
 */
export function getBorderColor(typeId) {
  const type = getTaskType(typeId);
  return type.borderColor || '#6b7280';
}

/**
 * בדיקה אם משימה היא משימת עבודה
 */
export function isWorkTask(typeId) {
  const type = getTaskType(typeId);
  return type.category === 'work';
}

/**
 * בדיקה אם משימה היא משימת משפחה
 */
export function isFamilyTask(typeId) {
  const type = getTaskType(typeId);
  return type.category === 'family';
}

/**
 * בדיקה אם משימה היא משימת בית
 */
export function isHomeTask(typeId) {
  const type = getTaskType(typeId);
  return type.category === 'home';
}

/**
 * קבלת שעות לפי קטגוריה
 */
export function getCategoryHours(category) {
  return TASK_CATEGORIES[category]?.hours || { start: 8, end: 21 };
}

export default TASK_TYPES;
