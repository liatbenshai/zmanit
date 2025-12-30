import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  TASK_CATEGORIES,
  getTaskTypesByCategory,
  addCustomTaskType,
  deleteCustomTaskType,
  loadCustomTaskTypes
} from '../../config/taskTypes';
import toast from 'react-hot-toast';

// אימוג'ים נפוצים לבחירה
const COMMON_EMOJIS = [
  '📌', '✨', '🎯', '⭐', '💡', '🔔', '📝', '✅',
  '🏠', '🧹', '🧺', '👕', '🍳', '🛒', '🚗', '🏃',
  '📚', '💻', '📞', '✉️', '📅', '⏰', '🎨', '🎵',
  '👶', '👧', '👦', '👨', '👩', '👴', '👵', '🐕',
  '💪', '🧘', '🏋️', '🚴', '⚽', '🎮', '📺', '🎬',
  '💊', '🏥', '💰', '🏦', '🎁', '🎂', '✈️', '🏖️'
];

/**
 * דף הגדרות סוגי משימות
 */
function TaskTypeSettings({ onClose }) {
  const [selectedCategory, setSelectedCategory] = useState('home');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [customTypes, setCustomTypes] = useState({});
  
  // טעינת סוגים מותאמים
  useEffect(() => {
    setCustomTypes(loadCustomTaskTypes());
  }, []);
  
  // רענון הרשימה
  const refreshTypes = () => {
    setCustomTypes(loadCustomTaskTypes());
  };

  // קבלת סוגים לפי קטגוריה (מובנים + מותאמים)
  const getTypesForCategory = (category) => {
    return getTaskTypesByCategory(category);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-xl"
      >
        {/* כותרת */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            ⚙️ הגדרות סוגי משימות
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            ✕
          </button>
        </div>
        
        {/* טאבים לקטגוריות */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          {Object.values(TASK_CATEGORIES).map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`
                flex-1 py-3 px-4 text-sm font-medium transition-colors
                ${selectedCategory === cat.id
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-b-2 border-blue-500'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                }
              `}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>
        
        {/* תוכן */}
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {/* רשימת סוגי משימות */}
          <div className="space-y-2 mb-4">
            {getTypesForCategory(selectedCategory).map(type => (
              <div
                key={type.id}
                className={`
                  flex items-center justify-between p-3 rounded-lg border
                  ${type.bgLight} ${type.border}
                `}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{type.icon}</span>
                  <div>
                    <p className={`font-medium ${type.text}`}>{type.name}</p>
                    <p className="text-xs text-gray-500">
                      {type.inputType === 'recording' && `הקלטה × ${type.timeRatio}`}
                      {type.inputType === 'pages' && `${type.timePerPage} דק' לעמוד`}
                      {type.inputType === 'direct' && 'זמן ישיר'}
                      {' • '}
                      {type.isBuiltIn ? 'מובנה' : 'מותאם אישית'}
                    </p>
                  </div>
                </div>
                
                {/* כפתורי פעולה - רק לסוגים מותאמים */}
                {!type.isBuiltIn && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => setEditingType(type)}
                      className="p-2 hover:bg-white/50 rounded-lg transition-colors"
                      title="ערוך"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`למחוק את "${type.name}"?`)) {
                          deleteCustomTaskType(type.id);
                          refreshTypes();
                          toast.success('סוג המשימה נמחק');
                        }
                      }}
                      className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                      title="מחק"
                    >
                      🗑️
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          
          {/* כפתור הוספה */}
          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 
                         rounded-lg text-gray-500 dark:text-gray-400 hover:border-blue-400 
                         hover:text-blue-500 transition-colors"
            >
              + הוסף סוג משימה חדש
            </button>
          )}
          
          {/* טופס הוספה */}
          {showAddForm && (
            <AddTaskTypeForm
              category={selectedCategory}
              onSave={(newType) => {
                addCustomTaskType(newType);
                refreshTypes();
                setShowAddForm(false);
                toast.success(`נוסף סוג משימה: ${newType.name}`);
              }}
              onCancel={() => setShowAddForm(false)}
            />
          )}
        </div>
        
        {/* הסבר */}
        <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
            💡 סוגי משימות מותאמים נשמרים בדפדפן. ניתן להוסיף, לערוך ולמחוק אותם בכל עת.
          </p>
        </div>
      </motion.div>
      
      {/* מודל עריכה */}
      {editingType && (
        <EditTaskTypeModal
          taskType={editingType}
          onSave={(updates) => {
            // עדכון הסוג
            const customTypes = loadCustomTaskTypes();
            if (customTypes[editingType.id]) {
              customTypes[editingType.id] = { ...customTypes[editingType.id], ...updates };
              localStorage.setItem('zmanit_custom_task_types', JSON.stringify(customTypes));
              refreshTypes();
              toast.success('סוג המשימה עודכן');
            }
            setEditingType(null);
          }}
          onClose={() => setEditingType(null)}
        />
      )}
    </div>
  );
}

/**
 * טופס הוספת סוג משימה
 */
function AddTaskTypeForm({ category, onSave, onCancel }) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('📌');
  const [defaultDuration, setDefaultDuration] = useState(30);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  
  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error('נא להזין שם');
      return;
    }
    
    onSave({
      name: name.trim(),
      icon,
      category,
      defaultDuration
    });
  };
  
  return (
    <form onSubmit={handleSubmit} className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg space-y-4">
      <h3 className="font-medium text-gray-900 dark:text-white">
        סוג משימה חדש - {TASK_CATEGORIES[category]?.name}
      </h3>
      
      {/* שם ואייקון */}
      <div className="flex gap-3">
        {/* בחירת אייקון */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="w-14 h-14 text-3xl bg-white dark:bg-gray-800 border border-gray-300 
                       dark:border-gray-600 rounded-lg hover:border-blue-400 transition-colors"
          >
            {icon}
          </button>
          
          {/* בוחר אימוג'ים */}
          {showEmojiPicker && (
            <div className="absolute top-full left-0 mt-2 p-2 bg-white dark:bg-gray-800 
                            border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10
                            grid grid-cols-8 gap-1 w-72">
              {COMMON_EMOJIS.map(emoji => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    setIcon(emoji);
                    setShowEmojiPicker(false);
                  }}
                  className="w-8 h-8 text-xl hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* שם */}
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="שם סוג המשימה (למשל: קיפול כביסה)"
          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                     bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          autoFocus
        />
      </div>
      
      {/* זמן ברירת מחדל */}
      <div>
        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
          זמן ברירת מחדל (דקות)
        </label>
        <input
          type="number"
          value={defaultDuration}
          onChange={(e) => setDefaultDuration(parseInt(e.target.value) || 30)}
          min="5"
          max="480"
          className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                     bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        />
      </div>
      
      {/* כפתורים */}
      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          className="flex-1 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 
                     transition-colors font-medium"
        >
          הוסף
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-200 
                     dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          ביטול
        </button>
      </div>
    </form>
  );
}

/**
 * מודל עריכת סוג משימה
 */
function EditTaskTypeModal({ taskType, onSave, onClose }) {
  const [name, setName] = useState(taskType.name);
  const [icon, setIcon] = useState(taskType.icon);
  const [defaultDuration, setDefaultDuration] = useState(taskType.defaultDuration);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  
  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ name, icon, defaultDuration });
  };
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md shadow-xl"
      >
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
          עריכת "{taskType.name}"
        </h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* שם ואייקון */}
          <div className="flex gap-3">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="w-14 h-14 text-3xl bg-gray-50 dark:bg-gray-900 border border-gray-300 
                           dark:border-gray-600 rounded-lg hover:border-blue-400 transition-colors"
              >
                {icon}
              </button>
              
              {showEmojiPicker && (
                <div className="absolute top-full left-0 mt-2 p-2 bg-white dark:bg-gray-800 
                                border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10
                                grid grid-cols-8 gap-1 w-72">
                  {COMMON_EMOJIS.map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => {
                        setIcon(emoji);
                        setShowEmojiPicker(false);
                      }}
                      className="w-8 h-8 text-xl hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                         bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>
          
          {/* זמן ברירת מחדל */}
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
              זמן ברירת מחדל (דקות)
            </label>
            <input
              type="number"
              value={defaultDuration}
              onChange={(e) => setDefaultDuration(parseInt(e.target.value) || 30)}
              min="5"
              max="480"
              className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                         bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>
          
          {/* כפתורים */}
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              className="flex-1 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 
                         transition-colors font-medium"
            >
              שמור
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-200 
                         dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              ביטול
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

export default TaskTypeSettings;
