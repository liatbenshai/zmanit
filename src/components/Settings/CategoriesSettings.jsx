import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettings } from '../../context/SettingsContext';
import toast from 'react-hot-toast';

const EMOJI_OPTIONS = [
  '💼', '🚀', '👨‍👩‍👧‍👦', '🧘', '📚', '💰', '🏠', '🎯', '🌟', '💡',
  '🎨', '🎵', '🏃', '🍽️', '✈️', '🛠️', '📊', '🔬', '⚕️', '📱'
];

const COLOR_OPTIONS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899',
  '#6366F1', '#14B8A6', '#F97316', '#A855F7', '#06B6D4', '#84CC16'
];

/**
 * הגדרות קטגוריות
 */
function CategoriesSettings() {
  const { 
    categories, 
    addCategory, 
    updateCategory, 
    deleteCategory,
    getCategories,
    saving 
  } = useSettings();
  
  const [editingId, setEditingId] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    icon: '📁',
    color: '#3B82F6',
    order: 99
  });

  const sortedCategories = getCategories();

  const handleEdit = (category) => {
    setEditingId(category.id);
    setFormData({ ...category });
    setShowAddForm(false);
  };

  const handleAdd = () => {
    setShowAddForm(true);
    setEditingId(null);
    setFormData({
      id: '',
      name: '',
      icon: '📁',
      color: '#3B82F6',
      order: Object.keys(categories).length + 1
    });
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('נא להזין שם');
      return;
    }

    try {
      if (showAddForm) {
        const id = formData.id || formData.name
          .toLowerCase()
          .replace(/\s+/g, '_')
          .replace(/[^a-z0-9_]/g, '');
        
        if (categories[id]) {
          toast.error('קטגוריה עם מזהה זה כבר קיימת');
          return;
        }

        await addCategory({ ...formData, id });
        toast.success('הקטגוריה נוספה');
      } else {
        await updateCategory(editingId, formData);
        toast.success('הקטגוריה עודכנה');
      }
      
      setShowAddForm(false);
      setEditingId(null);
    } catch (err) {
      toast.error('שגיאה בשמירה');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('למחוק את הקטגוריה?')) return;
    
    try {
      await deleteCategory(id);
      toast.success('הקטגוריה נמחקה');
    } catch (err) {
      // toast.error handled in context
    }
  };

  const handleCancel = () => {
    setShowAddForm(false);
    setEditingId(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            📁 קטגוריות
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            קבוצות לארגון סוגי המשימות
          </p>
        </div>
        
        <button
          onClick={handleAdd}
          disabled={saving || showAddForm}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          <span>➕</span>
          <span>קטגוריה חדשה</span>
        </button>
      </div>

      {/* טופס הוספה/עריכה */}
      <AnimatePresence>
        {(showAddForm || editingId) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-800"
          >
            <h3 className="font-medium text-gray-900 dark:text-white mb-4">
              {showAddForm ? '➕ הוספת קטגוריה חדשה' : '✏️ עריכת קטגוריה'}
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  שם
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="למשל: לימודים"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  סדר הצגה
                </label>
                <input
                  type="number"
                  value={formData.order}
                  onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  min="1"
                  max="100"
                />
              </div>
            </div>

            {/* אייקון */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                אייקון
              </label>
              <div className="flex flex-wrap gap-2">
                {EMOJI_OPTIONS.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => setFormData({ ...formData, icon: emoji })}
                    className={`
                      w-10 h-10 rounded-lg text-xl flex items-center justify-center
                      transition-all duration-200
                      ${formData.icon === emoji
                        ? 'bg-purple-500 ring-2 ring-purple-600 scale-110'
                        : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }
                    `}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* צבע */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                צבע
              </label>
              <div className="flex flex-wrap gap-2">
                {COLOR_OPTIONS.map(color => (
                  <button
                    key={color}
                    onClick={() => setFormData({ ...formData, color })}
                    className={`
                      w-10 h-10 rounded-lg transition-all duration-200
                      ${formData.color === color
                        ? 'ring-2 ring-offset-2 ring-gray-400 scale-110'
                        : 'hover:scale-105'
                      }
                    `}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            {/* תצוגה מקדימה */}
            <div className="mt-4 p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
              <span className="text-sm text-gray-500 dark:text-gray-400 mb-2 block">תצוגה מקדימה:</span>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-xl"
                  style={{ backgroundColor: formData.color }}
                >
                  {formData.icon}
                </div>
                <span className="font-medium text-gray-900 dark:text-white">
                  {formData.name || 'שם הקטגוריה'}
                </span>
              </div>
            </div>

            {/* כפתורים */}
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50"
              >
                {saving ? '⏳ שומר...' : '✓ שמור'}
              </button>
              <button
                onClick={handleCancel}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
              >
                ביטול
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* רשימת קטגוריות */}
      <div className="space-y-2">
        {sortedCategories.map(category => (
          <motion.div
            key={category.id}
            layout
            className={`
              p-4 rounded-xl border transition-all duration-200
              ${editingId === category.id
                ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
              }
            `}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-2xl"
                  style={{ backgroundColor: category.color }}
                >
                  {category.icon}
                </div>
                <div className="font-medium text-gray-900 dark:text-white">
                  {category.name}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleEdit(category)}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                  title="עריכה"
                >
                  ✏️
                </button>
                {!['work', 'personal'].includes(category.id) && (
                  <button
                    onClick={() => handleDelete(category.id)}
                    className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-500 hover:text-red-600 transition-colors"
                    title="מחיקה"
                  >
                    🗑️
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export default CategoriesSettings;
