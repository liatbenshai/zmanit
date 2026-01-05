/**
 * קטגוריות משימות - מותאמות אישית למשתמש
 * =============================================
 * 
 * כל קטגוריה משויכת לסוג לוח זמנים: 'work' או 'home'
 * זה קובע באיזה שעות ניתן לשבץ משימות מהקטגוריה
 */

import { SCHEDULE_TYPES } from './workSchedule';

// קטגוריות ברירת מחדל (קבועות) - עבודה
export const DEFAULT_CATEGORIES = {
  transcription: { 
    icon: '🎙️', 
    name: 'תמלול', 
    color: 'blue',
    scheduleType: 'work',  // משויך לשעות עבודה
    isFixed: true
  },
  translation: { 
    icon: '🌍', 
    name: 'תרגום', 
    color: 'purple',
    scheduleType: 'work',  // משויך לשעות עבודה
    isFixed: true
  }
};

// קטגוריות לדוגמה שהמשתמש יכול להוסיף
export const SUGGESTED_CATEGORIES = [
  // קטגוריות עבודה
  { id: 'proofreading', icon: '📝', name: 'הגהה', color: 'green', scheduleType: 'work' },
  { id: 'email', icon: '📧', name: 'מיילים', color: 'yellow', scheduleType: 'work' },
  { id: 'meeting', icon: '📅', name: 'פגישה', color: 'red', scheduleType: 'work' },
  { id: 'client_communication', icon: '💬', name: 'לקוחות', color: 'orange', scheduleType: 'work' },
  { id: 'management', icon: '👔', name: 'ניהול', color: 'gray', scheduleType: 'work' },
  { id: 'course', icon: '📚', name: 'קורס', color: 'indigo', scheduleType: 'work' },
  { id: 'phone', icon: '📞', name: 'טלפונים', color: 'cyan', scheduleType: 'work' },
  { id: 'writing', icon: '✍️', name: 'כתיבה', color: 'amber', scheduleType: 'work' },
  { id: 'research', icon: '🔍', name: 'מחקר', color: 'lime', scheduleType: 'work' },
  { id: 'admin', icon: '📋', name: 'אדמיניסטרציה', color: 'slate', scheduleType: 'work' },
  
  // קטגוריות בית/משפחה
  { id: 'family', icon: '👨‍👩‍👧‍👦', name: 'משפחה', color: 'pink', scheduleType: 'home' },
  { id: 'kids', icon: '👧', name: 'ילדים', color: 'rose', scheduleType: 'home' },
  { id: 'home', icon: '🏠', name: 'בית', color: 'amber', scheduleType: 'home' },
  { id: 'shopping', icon: '🛒', name: 'קניות', color: 'emerald', scheduleType: 'home' },
  { id: 'errands', icon: '🚗', name: 'סידורים', color: 'sky', scheduleType: 'home' },
  { id: 'personal', icon: '🧘', name: 'אישי', color: 'teal', scheduleType: 'home' },
  { id: 'health', icon: '💊', name: 'בריאות', color: 'red', scheduleType: 'home' },
  { id: 'cooking', icon: '🍽️', name: 'בישול', color: 'orange', scheduleType: 'home' },
];

// אייקונים זמינים לבחירה
export const AVAILABLE_ICONS = [
  '📝', '📧', '📅', '💬', '👔', '📚', '👨‍👩‍👧‍👦', '🧘', '📞', '✍️', 
  '🔍', '📋', '💼', '🏠', '🚗', '💰', '🎯', '⭐', '🔔', '📌',
  '🎨', '🎵', '🏃', '🍽️', '☕', '💊', '🏥', '🛒', '✈️', '🎁',
  '👧', '👦', '🧹', '🌱', '📺', '🎮', '📖', '🛁', '🧺', '🔧'
];

// צבעים זמינים
export const AVAILABLE_COLORS = [
  { id: 'blue', name: 'כחול', class: 'bg-blue-500' },
  { id: 'green', name: 'ירוק', class: 'bg-green-500' },
  { id: 'red', name: 'אדום', class: 'bg-red-500' },
  { id: 'yellow', name: 'צהוב', class: 'bg-yellow-500' },
  { id: 'purple', name: 'סגול', class: 'bg-purple-500' },
  { id: 'pink', name: 'ורוד', class: 'bg-pink-500' },
  { id: 'orange', name: 'כתום', class: 'bg-orange-500' },
  { id: 'teal', name: 'טורקיז', class: 'bg-teal-500' },
  { id: 'indigo', name: 'אינדיגו', class: 'bg-indigo-500' },
  { id: 'gray', name: 'אפור', class: 'bg-gray-500' },
  { id: 'rose', name: 'ורוד עמוק', class: 'bg-rose-500' },
  { id: 'amber', name: 'ענבר', class: 'bg-amber-500' },
  { id: 'emerald', name: 'אמרלד', class: 'bg-emerald-500' },
  { id: 'sky', name: 'תכלת', class: 'bg-sky-500' },
];

/**
 * טעינת קטגוריות המשתמש
 */
export function loadUserCategories() {
  try {
    const saved = localStorage.getItem('zmanit_user_categories');
    if (saved) {
      const userCategories = JSON.parse(saved);
      // מיזוג עם קטגוריות קבועות
      return { ...DEFAULT_CATEGORIES, ...userCategories };
    }
  } catch (e) {
    console.error('Error loading categories:', e);
  }
  return { ...DEFAULT_CATEGORIES };
}

/**
 * שמירת קטגוריות המשתמש
 */
export function saveUserCategories(categories) {
  try {
    // שומרים רק את הקטגוריות שאינן קבועות
    const userCategories = {};
    for (const [key, value] of Object.entries(categories)) {
      if (!DEFAULT_CATEGORIES[key]) {
        userCategories[key] = value;
      }
    }
    localStorage.setItem('zmanit_user_categories', JSON.stringify(userCategories));
    return true;
  } catch (e) {
    console.error('Error saving categories:', e);
    return false;
  }
}

/**
 * הוספת קטגוריה חדשה
 * @param {string} id - מזהה הקטגוריה
 * @param {string} name - שם הקטגוריה
 * @param {string} icon - אייקון
 * @param {string} color - צבע
 * @param {string} scheduleType - 'work' או 'home'
 */
export function addCategory(id, name, icon, color, scheduleType = 'work') {
  const categories = loadUserCategories();
  categories[id] = { name, icon, color, scheduleType, isFixed: false };
  saveUserCategories(categories);
  return categories;
}

/**
 * מחיקת קטגוריה (רק אם לא קבועה)
 */
export function removeCategory(id) {
  if (DEFAULT_CATEGORIES[id]) {
    return false; // לא ניתן למחוק קטגוריה קבועה
  }
  const categories = loadUserCategories();
  delete categories[id];
  saveUserCategories(categories);
  return categories;
}

/**
 * עדכון קטגוריה
 */
export function updateCategory(id, updates) {
  const categories = loadUserCategories();
  if (categories[id]) {
    // לא מאפשרים לשנות isFixed
    const { isFixed, ...allowedUpdates } = updates;
    categories[id] = { ...categories[id], ...allowedUpdates };
    saveUserCategories(categories);
  }
  return categories;
}

/**
 * קבלת כל הקטגוריות כמערך (לשימוש ב-Select)
 */
export function getCategoriesArray() {
  const categories = loadUserCategories();
  return Object.entries(categories).map(([id, data]) => ({
    id,
    ...data
  }));
}

/**
 * קבלת קטגוריות לפי סוג לוח זמנים
 * @param {string} scheduleType - 'work' או 'home'
 */
export function getCategoriesByScheduleType(scheduleType) {
  const categories = loadUserCategories();
  return Object.entries(categories)
    .filter(([_, data]) => data.scheduleType === scheduleType)
    .map(([id, data]) => ({ id, ...data }));
}

/**
 * קבלת קטגוריה לפי ID
 */
export function getCategory(id) {
  const categories = loadUserCategories();
  return categories[id] || { icon: '📋', name: 'אחר', color: 'gray', scheduleType: 'work' };
}

/**
 * קבלת סוג לוח הזמנים של קטגוריה
 * @param {string} categoryId - מזהה הקטגוריה
 * @returns {string} 'work' או 'home'
 */
export function getCategoryScheduleType(categoryId) {
  const category = getCategory(categoryId);
  return category.scheduleType || 'work';
}

/**
 * בדיקה האם קטגוריה שייכת לעבודה
 */
export function isWorkCategory(categoryId) {
  return getCategoryScheduleType(categoryId) === 'work';
}

/**
 * בדיקה האם קטגוריה שייכת לבית
 */
export function isHomeCategory(categoryId) {
  return getCategoryScheduleType(categoryId) === 'home';
}

export default {
  loadUserCategories,
  saveUserCategories,
  addCategory,
  removeCategory,
  updateCategory,
  getCategoriesArray,
  getCategoriesByScheduleType,
  getCategory,
  getCategoryScheduleType,
  isWorkCategory,
  isHomeCategory,
  DEFAULT_CATEGORIES,
  SUGGESTED_CATEGORIES,
  AVAILABLE_ICONS,
  AVAILABLE_COLORS,
  SCHEDULE_TYPES
};
