/**
 * קטגוריות משימות - מותאמות אישית למשתמש
 * =============================================
 * 
 * קטגוריות קבועות: תמלול, תרגום
 * השאר: נבחר על ידי המשתמש
 */

// קטגוריות ברירת מחדל (קבועות)
export const DEFAULT_CATEGORIES = {
  transcription: { 
    icon: '🎙️', 
    name: 'תמלול', 
    color: 'blue',
    isFixed: true  // לא ניתן למחיקה
  },
  translation: { 
    icon: '🌍', 
    name: 'תרגום', 
    color: 'purple',
    isFixed: true  // לא ניתן למחיקה
  }
};

// קטגוריות לדוגמה שהמשתמש יכול להוסיף
export const SUGGESTED_CATEGORIES = [
  { id: 'proofreading', icon: '📝', name: 'הגהה', color: 'green' },
  { id: 'email', icon: '📧', name: 'מיילים', color: 'yellow' },
  { id: 'meeting', icon: '📅', name: 'פגישה', color: 'red' },
  { id: 'client_communication', icon: '💬', name: 'לקוחות', color: 'orange' },
  { id: 'management', icon: '👔', name: 'ניהול', color: 'gray' },
  { id: 'course', icon: '📚', name: 'קורס', color: 'indigo' },
  { id: 'family', icon: '👨‍👩‍👧‍👦', name: 'משפחה', color: 'pink' },
  { id: 'personal', icon: '🧘', name: 'אישי', color: 'teal' },
  { id: 'phone', icon: '📞', name: 'טלפונים', color: 'cyan' },
  { id: 'writing', icon: '✍️', name: 'כתיבה', color: 'amber' },
  { id: 'research', icon: '🔍', name: 'מחקר', color: 'lime' },
  { id: 'admin', icon: '📋', name: 'אדמיניסטרציה', color: 'slate' },
];

// אייקונים זמינים לבחירה
export const AVAILABLE_ICONS = [
  '📝', '📧', '📅', '💬', '👔', '📚', '👨‍👩‍👧‍👦', '🧘', '📞', '✍️', 
  '🔍', '📋', '💼', '🏠', '🚗', '💰', '🎯', '⭐', '🔔', '📌',
  '🎨', '🎵', '🏃', '🍽️', '☕', '💊', '🏥', '🛒', '✈️', '🎁'
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
 */
export function addCategory(id, name, icon, color) {
  const categories = loadUserCategories();
  categories[id] = { name, icon, color, isFixed: false };
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
 * קבלת קטגוריה לפי ID
 */
export function getCategory(id) {
  const categories = loadUserCategories();
  return categories[id] || { icon: '📋', name: 'אחר', color: 'gray' };
}

export default {
  loadUserCategories,
  saveUserCategories,
  addCategory,
  removeCategory,
  getCategoriesArray,
  getCategory,
  DEFAULT_CATEGORIES,
  SUGGESTED_CATEGORIES,
  AVAILABLE_ICONS,
  AVAILABLE_COLORS
};
