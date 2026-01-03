/**
 * ניהול קטגוריות משימות
 * =======================
 * 
 * מאפשר למשתמש להוסיף ולמחוק קטגוריות משימות
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  loadUserCategories,
  saveUserCategories,
  addCategory,
  removeCategory,
  DEFAULT_CATEGORIES,
  SUGGESTED_CATEGORIES,
  AVAILABLE_ICONS,
  AVAILABLE_COLORS
} from '../../config/taskCategories';

function CategoryManager() {
  const [categories, setCategories] = useState({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCategory, setNewCategory] = useState({
    id: '',
    name: '',
    icon: '📋',
    color: 'blue'
  });

  useEffect(() => {
    setCategories(loadUserCategories());
  }, []);

  const handleAddCategory = () => {
    if (!newCategory.name.trim()) {
      toast.error('יש להזין שם לקטגוריה');
      return;
    }

    // יצירת ID מהשם
    const id = newCategory.id || newCategory.name
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');

    if (categories[id]) {
      toast.error('קטגוריה בשם זה כבר קיימת');
      return;
    }

    const updated = addCategory(id, newCategory.name, newCategory.icon, newCategory.color);
    setCategories(updated);
    setNewCategory({ id: '', name: '', icon: '📋', color: 'blue' });
    setShowAddForm(false);
    toast.success(`קטגוריה "${newCategory.name}" נוספה בהצלחה!`);
  };

  const handleRemoveCategory = (id) => {
    if (DEFAULT_CATEGORIES[id]) {
      toast.error('לא ניתן למחוק קטגוריה קבועה');
      return;
    }

    const categoryName = categories[id]?.name;
    const updated = removeCategory(id);
    if (updated) {
      setCategories(updated);
      toast.success(`קטגוריה "${categoryName}" נמחקה`);
    }
  };

  const handleAddSuggested = (suggested) => {
    if (categories[suggested.id]) {
      toast.error('קטגוריה זו כבר קיימת');
      return;
    }

    const updated = addCategory(suggested.id, suggested.name, suggested.icon, suggested.color);
    setCategories(updated);
    toast.success(`קטגוריה "${suggested.name}" נוספה!`);
  };

  const categoriesArray = Object.entries(categories).map(([id, data]) => ({ id, ...data }));
  const fixedCategories = categoriesArray.filter(c => c.isFixed);
  const userCategories = categoriesArray.filter(c => !c.isFixed);
  
  // קטגוריות מוצעות שעדיין לא נוספו
  const availableSuggestions = SUGGESTED_CATEGORIES.filter(s => !categories[s.id]);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
          📂 ניהול קטגוריות משימות
        </h3>
        <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
          הוסיפי קטגוריות מותאמות אישית לסוגי המשימות שלך
        </p>
      </div>

      {/* קטגוריות קבועות */}
      <div>
        <h4 className="text-sm font-medium text-gray-500 mb-2">קטגוריות קבועות (לא ניתן למחיקה)</h4>
        <div className="flex flex-wrap gap-2">
          {fixedCategories.map(cat => (
            <div
              key={cat.id}
              className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg"
            >
              <span className="text-lg">{cat.icon}</span>
              <span className="text-gray-700 dark:text-gray-300">{cat.name}</span>
              <span className="text-xs text-gray-400">🔒</span>
            </div>
          ))}
        </div>
      </div>

      {/* קטגוריות המשתמש */}
      <div>
        <h4 className="text-sm font-medium text-gray-500 mb-2">
          הקטגוריות שלך ({userCategories.length})
        </h4>
        {userCategories.length === 0 ? (
          <p className="text-gray-400 text-sm">עדיין לא הוספת קטגוריות. בחרי מהרשימה למטה או צרי חדשה.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {userCategories.map(cat => (
              <motion.div
                key={cat.id}
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className={`flex items-center gap-2 px-3 py-2 bg-${cat.color}-100 dark:bg-${cat.color}-900/30 rounded-lg group`}
              >
                <span className="text-lg">{cat.icon}</span>
                <span className="text-gray-700 dark:text-gray-300">{cat.name}</span>
                <button
                  onClick={() => handleRemoveCategory(cat.id)}
                  className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 transition-opacity"
                >
                  ✕
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* קטגוריות מוצעות */}
      {availableSuggestions.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-500 mb-2">הוסף מהרשימה</h4>
          <div className="flex flex-wrap gap-2">
            {availableSuggestions.map(suggested => (
              <button
                key={suggested.id}
                onClick={() => handleAddSuggested(suggested)}
                className="flex items-center gap-2 px-3 py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              >
                <span className="text-lg">{suggested.icon}</span>
                <span className="text-gray-600 dark:text-gray-400">{suggested.name}</span>
                <span className="text-blue-500">+</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* טופס הוספת קטגוריה חדשה */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        {!showAddForm ? (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            ➕ צור קטגוריה חדשה
          </button>
        ) : (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-4"
          >
            <h4 className="font-medium text-gray-900 dark:text-white">קטגוריה חדשה</h4>
            
            {/* שם */}
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">שם הקטגוריה</label>
              <input
                type="text"
                value={newCategory.name}
                onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                placeholder="לדוגמה: פגישות זום"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
              />
            </div>

            {/* אייקון */}
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">בחר אייקון</label>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_ICONS.map(icon => (
                  <button
                    key={icon}
                    onClick={() => setNewCategory({ ...newCategory, icon })}
                    className={`w-10 h-10 text-xl rounded-lg border-2 transition-colors ${
                      newCategory.icon === icon
                        ? 'border-blue-500 bg-blue-100 dark:bg-blue-900'
                        : 'border-gray-200 dark:border-gray-600 hover:border-blue-300'
                    }`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            {/* צבע */}
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">בחר צבע</label>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_COLORS.map(color => (
                  <button
                    key={color.id}
                    onClick={() => setNewCategory({ ...newCategory, color: color.id })}
                    className={`w-8 h-8 rounded-full ${color.class} ${
                      newCategory.color === color.id
                        ? 'ring-2 ring-offset-2 ring-blue-500'
                        : ''
                    }`}
                    title={color.name}
                  />
                ))}
              </div>
            </div>

            {/* תצוגה מקדימה */}
            <div className="bg-white dark:bg-gray-700 rounded-lg p-3">
              <span className="text-sm text-gray-500 mb-2 block">תצוגה מקדימה:</span>
              <div className={`inline-flex items-center gap-2 px-3 py-2 bg-${newCategory.color}-100 dark:bg-${newCategory.color}-900/30 rounded-lg`}>
                <span className="text-lg">{newCategory.icon}</span>
                <span>{newCategory.name || 'שם הקטגוריה'}</span>
              </div>
            </div>

            {/* כפתורים */}
            <div className="flex gap-2">
              <button
                onClick={handleAddCategory}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                ✓ הוסף
              </button>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setNewCategory({ id: '', name: '', icon: '📋', color: 'blue' });
                }}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500"
              >
                ביטול
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

export default CategoryManager;
