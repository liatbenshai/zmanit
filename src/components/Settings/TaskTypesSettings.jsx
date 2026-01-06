import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettings } from '../../context/SettingsContext';
import toast from 'react-hot-toast';

// רשימת אימוג'ים לבחירה
const EMOJI_OPTIONS = [
  '📝', '🎙️', '📧', '📚', '💬', '👔', '👨‍👩‍👧‍👦', '🧒', '🧘', '⚡', '📋',
  '💼', '🎯', '📊', '📈', '💡', '🔧', '🛠️', '📱', '💻', '🖥️', '📞',
  '📅', '📆', '⏰', '🕐', '🎨', '✏️', '📌', '📎', '🔍', '💰', '🏠',
  '🚗', '✈️', '🏃', '🎵', '🎬', '📸', '🎮', '🛒', '🍽️', '☕', '🌟'
];

// צבעים לבחירה
const COLOR_OPTIONS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899',
  '#6366F1', '#14B8A6', '#F97316', '#A855F7', '#06B6D4', '#84CC16',
  '#6B7280', '#1F2937', '#DC2626', '#059669'
];

/**
 * הגדרות סוגי משימות
 */
function TaskTypesSettings() {
  const { 
    taskTypes, 
    categories,
    addTaskType, 
    updateTaskType, 
    deleteTaskType,
    getTaskTypes,
    saving 
  } = useSettings();
  
  const [editingId, setEditingId] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    icon: '📋',
    color: '#3B82F6',
    defaultDuration: 30,
    category: 'work',
    order: 99
  });

  const sortedTaskTypes = getTaskTypes();

  const handleEdit = (taskType) => {
    setEditingId(taskType.id);
    setFormData({ ...taskType });
    setShowAddForm(false);
  };

  const handleAdd = () => {
    setShowAddForm(true);
    setEditingId(null);
    setFormData({
      id: '',
      name: '',
      icon: '📋',
      color: '#3B82F6',
      defaultDuration: 30,
      category: 'work',
      order: Object.keys(taskTypes).length + 1
    });
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('נא להזין שם');
      return;
    }

    try {
      if (showAddForm) {
        // יצירת ID מהשם
        const id = formData.id || formData.name
          .toLowerCase()
          .replace(/\s+/g, '_')
          .replace(/[^a-z0-9_]/g, '');
        
        if (taskTypes[id]) {
          toast.error('סוג משימה עם מזהה זה כבר קיים');
          return;
        }

        await addTaskType({ ...formData, id });
        toast.success('סוג המשימה נוסף');
      } else {
        await updateTaskType(editingId, formData);
        toast.success('סוג המשימה עודכן');
      }
      
      setShowAddForm(false);
      setEditingId(null);
    } catch (err) {
      toast.error('שגיאה בשמירה');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('למחוק את סוג המשימה? משימות קיימות יישארו ללא שינוי.')) return;
    
    try {
      await deleteTaskType(id);
      toast.success('סוג המשימה נמחק');
    } catch (err) {
      toast.error('שגיאה במחיקה');
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
            🏷️ סוגי משימות
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            הגדרת סוגי המשימות שיופיעו בטופס יצירת משימה
          </p>
        </div>
        
        <button
          onClick={handleAdd}
          disabled={saving || showAddForm}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          <span>➕</span>
          <span>סוג חדש</span>
        </button>
      </div>

      {/* טופס הוספה/עריכה */}
      <AnimatePresence>
        {(showAddForm || editingId) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800"
          >
            <h3 className="font-medium text-gray-900 dark:text-white mb-4">
              {showAddForm ? '➕ הוספת סוג משימה חדש' : '✏️ עריכת סוג משימה'}
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* שם */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  שם
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="למשל: פגישות"
                />
              </div>

              {/* קטגוריה */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  קטגוריה
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {Object.values(categories).map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon} {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* משך ברירת מחדל */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  משך ברירת מחדל (דקות)
                </label>
                <input
                  type="number"
                  value={formData.defaultDuration}
                  onChange={(e) => setFormData({ ...formData, defaultDuration: parseInt(e.target.value) || 30 })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  min="5"
                  max="480"
                  step="5"
                />
              </div>

              {/* סדר */}
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
                        ? 'bg-blue-500 ring-2 ring-blue-600 scale-110'
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
                {/* בחירת צבע מותאם אישית */}
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-10 h-10 rounded-lg cursor-pointer"
                  title="בחר צבע מותאם אישית"
                />
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
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {formData.name || 'שם הסוג'}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {formData.defaultDuration} דקות • {categories[formData.category]?.name || formData.category}
                  </div>
                </div>
              </div>
            </div>

            {/* כפתורים */}
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
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

      {/* רשימת סוגי משימות */}
      <div className="space-y-2">
        {sortedTaskTypes.map(taskType => (
          <motion.div
            key={taskType.id}
            layout
            className={`
              p-4 rounded-xl border transition-all duration-200
              ${editingId === taskType.id
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
              }
            `}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-2xl"
                  style={{ backgroundColor: taskType.color }}
                >
                  {taskType.icon}
                </div>
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {taskType.name}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {taskType.defaultDuration} דקות • {categories[taskType.category]?.name || taskType.category}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleEdit(taskType)}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                  title="עריכה"
                >
                  ✏️
                </button>
                {taskType.id !== 'other' && (
                  <button
                    onClick={() => handleDelete(taskType.id)}
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

      {sortedTaskTypes.length === 0 && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <span className="text-4xl mb-2 block">📋</span>
          <p>אין סוגי משימות. הוסיפי את הראשון!</p>
        </div>
      )}
    </div>
  );
}

export default TaskTypesSettings;
