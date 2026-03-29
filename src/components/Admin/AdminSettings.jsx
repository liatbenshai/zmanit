/**
 * ממשק אדמין - הגדרות האפליקציה
 * =====================================
 * ✅ כולל עריכת סוגי משימות מלאה!
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth';
import { getConfig, updateConfig, DEFAULT_CONFIG } from '../../config/appConfig';
import { 
  BUILT_IN_TASK_TYPES,
  TASK_CATEGORIES,
  getAllTaskTypes,
  addCustomTaskType,
  updateCustomTaskType,
  deleteCustomTaskType,
  loadCustomTaskTypes
} from '../../config/taskTypes';
import Button from '../UI/Button';
import toast from 'react-hot-toast';
import { useGoogleCalendar } from '../../hooks/useGoogleCalendar';

// =====================================
// לשוניות
// =====================================

const TABS = [
  { id: 'workHours', name: 'שעות עבודה', icon: '🕐' },
  { id: 'taskTypes', name: 'סוגי משימות', icon: '📋' },
  { id: 'googleCalendar', name: 'יומן גוגל', icon: '📅' },
  { id: 'notifications', name: 'התראות', icon: '🔔' },
  { id: 'timer', name: 'טיימר', icon: '⏱️' }
];

// =====================================
// קומפוננטה ראשית
// =====================================

export default function AdminSettings({ onClose }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('workHours');
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // טעינת קונפיגורציה
  useEffect(() => {
    async function load() {
      if (user?.id) {
        const loaded = await getConfig(user.id);
        setConfig(loaded);
      }
      setLoading(false);
    }
    load();
  }, [user?.id]);

  // עדכון שדה
  const updateField = (section, field, value) => {
    // ✅ טיפול מיוחד ב-workDays (מערך, לא אובייקט)
    if (section === 'workDays') {
      setConfig(prev => ({
        ...prev,
        workDays: value
      }));
    } else {
      setConfig(prev => ({
        ...prev,
        [section]: {
          ...prev[section],
          [field]: value
        }
      }));
    }
    setHasChanges(true);
  };

  // שמירה
  const handleSave = async () => {
    if (!user?.id) return;
    
    setSaving(true);
    try {
      const success = await updateConfig(user.id, config);
      if (success) {
        toast.success('ההגדרות נשמרו בהצלחה! ✅');
        setHasChanges(false);
      } else {
        toast.error('שגיאה בשמירת ההגדרות');
      }
    } catch (err) {
      console.error('שגיאה:', err);
      toast.error('שגיאה בשמירת ההגדרות');
    }
    setSaving(false);
  };

  // איפוס לברירות מחדל
  const handleReset = () => {
    if (confirm('האם לאפס את כל ההגדרות לברירות מחדל?')) {
      setConfig(DEFAULT_CONFIG);
      setHasChanges(true);
      toast.success('ההגדרות אופסו לברירות מחדל');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-4xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
          ⚙️ הגדרות מערכת
        </h2>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            ✕
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="px-6 pt-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                px-4 py-2 rounded-t-lg font-medium transition-colors whitespace-nowrap
                ${activeTab === tab.id
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }
              `}
            >
              {tab.icon} {tab.name}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6 min-h-[400px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'workHours' && (
              <WorkHoursSettings config={config} updateField={updateField} />
            )}
            {activeTab === 'taskTypes' && (
              <TaskTypesSettings />
            )}
            {activeTab === 'googleCalendar' && (
              <GoogleCalendarSettings />
            )}
            {activeTab === 'notifications' && (
              <NotificationsSettings config={config} updateField={updateField} />
            )}
            {activeTab === 'timer' && (
              <TimerSettings config={config} updateField={updateField} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <button
          onClick={handleReset}
          className="text-gray-500 hover:text-red-500 text-sm"
        >
          🔄 איפוס לברירות מחדל
        </button>
        
        <div className="flex gap-3">
          {onClose && (
            <Button variant="secondary" onClick={onClose}>
              ביטול
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className={hasChanges ? 'bg-green-500 hover:bg-green-600' : ''}
          >
            {saving ? '⏳ שומר...' : hasChanges ? '💾 שמור שינויים' : '✓ נשמר'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// =====================================
// הגדרות שעות עבודה
// =====================================

function WorkHoursSettings({ config, updateField }) {
  const days = [
    { id: 0, name: 'ראשון', short: 'א\'' },
    { id: 1, name: 'שני', short: 'ב\'' },
    { id: 2, name: 'שלישי', short: 'ג\'' },
    { id: 3, name: 'רביעי', short: 'ד\'' },
    { id: 4, name: 'חמישי', short: 'ה\'' },
    { id: 5, name: 'שישי', short: 'ו\'' },
    { id: 6, name: 'שבת', short: 'ש\'' }
  ];

  return (
    <div className="space-y-6">
      {/* שעות עבודה רגילות */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
        <h3 className="font-bold text-lg mb-4 text-blue-800 dark:text-blue-200">
          🕐 שעות עבודה
        </h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              שעת התחלה
            </label>
            <input
              type="time"
              value={config.workHours?.start || '08:30'}
              onChange={(e) => updateField('workHours', 'start', e.target.value)}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-lg"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              שעת סיום
            </label>
            <input
              type="time"
              value={config.workHours?.end || '16:15'}
              onChange={(e) => updateField('workHours', 'end', e.target.value)}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-lg"
            />
          </div>
        </div>
      </div>

      {/* ימי עבודה */}
      <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
        <h3 className="font-bold text-lg mb-4 text-green-800 dark:text-green-200">
          📅 ימי עבודה
        </h3>
        
        <div className="flex flex-wrap gap-2">
          {days.map(day => (
            <button
              key={day.id}
              onClick={() => {
                const current = config.workDays || [];
                const newDays = current.includes(day.id)
                  ? current.filter(d => d !== day.id)
                  : [...current, day.id].sort();
                // ✅ עדכון ישיר של workDays
                updateField('workDays', null, newDays);
              }}
              className={`
                px-4 py-2 rounded-lg font-medium transition-all
                ${(config.workDays || []).includes(day.id)
                  ? 'bg-green-500 text-white shadow-md'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }
              `}
            >
              {day.name}
            </button>
          ))}
        </div>
      </div>

      {/* שישי */}
      <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg text-orange-800 dark:text-orange-200">
            🌅 יום שישי (שעות מיוחדות)
          </h3>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.friday?.enabled ?? true}
              onChange={(e) => updateField('friday', 'enabled', e.target.checked)}
              className="w-5 h-5 rounded"
            />
            <span className="text-sm">פעיל</span>
          </label>
        </div>
        
        {config.friday?.enabled && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                שעת התחלה
              </label>
              <input
                type="time"
                value={config.friday?.start || '08:30'}
                onChange={(e) => updateField('friday', 'start', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                שעת סיום
              </label>
              <input
                type="time"
                value={config.friday?.end || '12:00'}
                onChange={(e) => updateField('friday', 'end', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
          </div>
        )}
      </div>

      {/* הפסקה */}
      <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg text-purple-800 dark:text-purple-200">
            ☕ הפסקת צהריים
          </h3>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.breaks?.enabled ?? false}
              onChange={(e) => updateField('breaks', 'enabled', e.target.checked)}
              className="w-5 h-5 rounded"
            />
            <span className="text-sm">פעיל</span>
          </label>
        </div>
        
        {config.breaks?.enabled && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                שעת התחלה
              </label>
              <input
                type="time"
                value={config.breaks?.start || '12:00'}
                onChange={(e) => updateField('breaks', 'start', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                שעת סיום
              </label>
              <input
                type="time"
                value={config.breaks?.end || '12:30'}
                onChange={(e) => updateField('breaks', 'end', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
          </div>
        )}
      </div>

      {/* הפסקה בין משימות */}
      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          ⏸️ הפסקה בין משימות (דקות)
        </label>
        <input
          type="number"
          min="0"
          max="30"
          value={config.breaks?.betweenTasks || 5}
          onChange={(e) => updateField('breaks', 'betweenTasks', parseInt(e.target.value))}
          className="w-24 px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
        />
      </div>
    </div>
  );
}

// =====================================
// הגדרות התראות
// =====================================

function NotificationsSettings({ config, updateField }) {
  return (
    <div className="space-y-6">
      <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
        <h3 className="font-bold text-lg mb-4 text-yellow-800 dark:text-yellow-200">
          🔔 התראות
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              ⏰ התראה לפני משימה (דקות)
            </label>
            <input
              type="number"
              min="1"
              max="60"
              value={config.notifications?.reminderMinutes || 5}
              onChange={(e) => updateField('notifications', 'reminderMinutes', parseInt(e.target.value))}
              className="w-24 px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="notifyOnTime"
              checked={config.notifications?.notifyOnTime ?? true}
              onChange={(e) => updateField('notifications', 'notifyOnTime', e.target.checked)}
              className="w-5 h-5 rounded"
            />
            <label htmlFor="notifyOnTime" className="text-gray-700 dark:text-gray-300">
              🔔 התראה בזמן ההתחלה
            </label>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="notifyOnEnd"
              checked={config.notifications?.notifyOnEnd ?? true}
              onChange={(e) => updateField('notifications', 'notifyOnEnd', e.target.checked)}
              className="w-5 h-5 rounded"
            />
            <label htmlFor="notifyOnEnd" className="text-gray-700 dark:text-gray-300">
              ⏳ התראה בסיום הזמן המוקצב
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              🔁 חזרה על התראות כל (דקות)
            </label>
            <input
              type="number"
              min="5"
              max="60"
              value={config.notifications?.repeatEveryMinutes || 10}
              onChange={(e) => updateField('notifications', 'repeatEveryMinutes', parseInt(e.target.value))}
              className="w-24 px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// =====================================
// הגדרות טיימר
// =====================================

function TimerSettings({ config, updateField }) {
  return (
    <div className="space-y-6">
      <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4">
        <h3 className="font-bold text-lg mb-4 text-indigo-800 dark:text-indigo-200">
          ⏱️ הגדרות טיימר
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              📋 משך ברירת מחדל למשימה (דקות)
            </label>
            <input
              type="number"
              min="5"
              max="480"
              value={config.timer?.defaultDuration || 30}
              onChange={(e) => updateField('timer', 'defaultDuration', parseInt(e.target.value))}
              className="w-24 px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              📦 גודל בלוק מינימלי (דקות)
            </label>
            <input
              type="number"
              min="5"
              max="60"
              value={config.timer?.minBlockSize || 15}
              onChange={(e) => updateField('timer', 'minBlockSize', parseInt(e.target.value))}
              className="w-24 px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
            <p className="text-xs text-gray-500 mt-1">לחלוקת משימות גדולות לבלוקים</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              📦 גודל בלוק מקסימלי (דקות)
            </label>
            <input
              type="number"
              min="30"
              max="180"
              value={config.timer?.maxBlockSize || 90}
              onChange={(e) => updateField('timer', 'maxBlockSize', parseInt(e.target.value))}
              className="w-24 px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
            <p className="text-xs text-gray-500 mt-1">בלוקים לא יהיו גדולים מזה</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// =====================================
// 🎯 הגדרות סוגי משימות - גרסה מלאה!
// =====================================

// רשימת אימוג'ים לבחירה
const EMOJI_OPTIONS = [
  '📝', '🎙️', '📧', '📚', '💬', '👔', '👨‍👩‍👧‍👦', '🧒', '🧘', '⚡', '📋',
  '💼', '🎯', '📊', '📈', '💡', '🔧', '🛠️', '📱', '💻', '🖥️', '📞',
  '📅', '📆', '⏰', '🕐', '🎨', '✏️', '📌', '📎', '🔍', '💰', '🏠',
  '🚗', '✈️', '🏃', '🎵', '🎬', '📸', '🎮', '🛒', '🍽️', '☕', '🌟',
  '✅', '🌍', '👧', '👦', '👶', '👨', '🧹', '🍳', '🧺', '🛍️'
];

function TaskTypesSettings() {
  const [allTypes, setAllTypes] = useState({});
  const [customTypes, setCustomTypes] = useState({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    icon: '📌',
    category: 'work',
    defaultDuration: 30
  });

  // טעינת סוגי משימות
  useEffect(() => {
    loadTypes();
  }, []);

  const loadTypes = () => {
    setAllTypes(getAllTaskTypes());
    setCustomTypes(loadCustomTaskTypes());
  };

  // פתיחת טופס הוספה
  const handleAdd = () => {
    setShowAddForm(true);
    setEditingId(null);
    setFormData({
      name: '',
      icon: '📌',
      category: 'work',
      defaultDuration: 30
    });
  };

  // פתיחת טופס עריכה
  const handleEdit = (typeId) => {
    const type = allTypes[typeId];
    if (!type) return;
    
    setEditingId(typeId);
    setShowAddForm(false);
    setFormData({
      name: type.name,
      icon: type.icon,
      category: type.category,
      defaultDuration: type.defaultDuration
    });
  };

  // שמירה
  const handleSave = () => {
    if (!formData.name.trim()) {
      toast.error('נא להזין שם');
      return;
    }

    try {
      if (showAddForm) {
        // הוספה
        addCustomTaskType(formData);
        toast.success(`✅ נוסף: ${formData.name}`);
      } else if (editingId) {
        // עריכה
        updateCustomTaskType(editingId, formData);
        toast.success(`✅ עודכן: ${formData.name}`);
      }
      
      loadTypes();
      setShowAddForm(false);
      setEditingId(null);
    } catch (err) {
      toast.error('שגיאה בשמירה');
    }
  };

  // מחיקה
  const handleDelete = (typeId) => {
    const type = allTypes[typeId];
    if (!type) return;
    
    if (type.isBuiltIn) {
      toast.error('לא ניתן למחוק סוג מובנה');
      return;
    }
    
    if (!confirm(`למחוק את "${type.name}"?`)) return;
    
    try {
      deleteCustomTaskType(typeId);
      toast.success(`🗑️ נמחק: ${type.name}`);
      loadTypes();
      
      if (editingId === typeId) {
        setEditingId(null);
      }
    } catch (err) {
      toast.error('שגיאה במחיקה');
    }
  };

  // ביטול
  const handleCancel = () => {
    setShowAddForm(false);
    setEditingId(null);
  };

  // קבלת סוגים לפי קטגוריה
  const getTypesByCategory = (category) => {
    return Object.values(allTypes).filter(t => t.category === category);
  };

  return (
    <div className="space-y-6">
      {/* כותרת + כפתור הוספה */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-lg text-gray-800 dark:text-white">
            📋 סוגי משימות
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            הוספה, עריכה ומחיקה של סוגי משימות
          </p>
        </div>
        
        <button
          onClick={handleAdd}
          disabled={showAddForm}
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
            className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800"
          >
            <h4 className="font-medium text-gray-800 dark:text-white mb-4">
              {showAddForm ? '➕ הוספת סוג משימה' : '✏️ עריכת סוג משימה'}
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
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
                  {Object.values(TASK_CATEGORIES).map(cat => (
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
            </div>

            {/* בחירת אייקון */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                אייקון
              </label>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                {EMOJI_OPTIONS.map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setFormData({ ...formData, icon: emoji })}
                    className={`
                      w-10 h-10 rounded-lg text-xl flex items-center justify-center
                      transition-all duration-200
                      ${formData.icon === emoji
                        ? 'bg-blue-500 ring-2 ring-blue-600 scale-110'
                        : 'bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500'
                      }
                    `}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* תצוגה מקדימה */}
            <div className="mb-4 p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
              <span className="text-sm text-gray-500 dark:text-gray-400">תצוגה מקדימה:</span>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-3xl">{formData.icon}</span>
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {formData.name || 'שם הסוג'}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {formData.defaultDuration} דקות • {TASK_CATEGORIES[formData.category]?.name}
                  </div>
                </div>
              </div>
            </div>

            {/* כפתורים */}
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                ✓ שמור
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

      {/* רשימת סוגים לפי קטגוריה */}
      {Object.values(TASK_CATEGORIES).map(category => {
        const types = getTypesByCategory(category.id);
        if (types.length === 0) return null;
        
        return (
          <div key={category.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
            <h4 className="font-medium text-gray-800 dark:text-white mb-3 flex items-center gap-2">
              <span>{category.icon}</span>
              <span>{category.name}</span>
              <span className="text-sm text-gray-500">({types.length})</span>
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {types.map(type => (
                <div
                  key={type.id}
                  className={`
                    flex items-center justify-between p-3 rounded-lg border transition-all
                    ${editingId === type.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800'
                    }
                  `}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{type.icon}</span>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {type.name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {type.defaultDuration} דקות
                        {type.isBuiltIn && ' • מובנה'}
                        {type.isCustom && ' • מותאם'}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    {/* עריכה - רק לסוגים מותאמים */}
                    {!type.isBuiltIn && (
                      <button
                        onClick={() => handleEdit(type.id)}
                        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-blue-600 transition-colors"
                        title="עריכה"
                      >
                        ✏️
                      </button>
                    )}
                    
                    {/* מחיקה - רק לסוגים מותאמים */}
                    {!type.isBuiltIn && (
                      <button
                        onClick={() => handleDelete(type.id)}
                        className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-500 hover:text-red-600 transition-colors"
                        title="מחיקה"
                      >
                        🗑️
                      </button>
                    )}
                    
                    {/* אייקון נעול לסוגים מובנים */}
                    {type.isBuiltIn && (
                      <span className="p-2 text-gray-400" title="סוג מובנה - לא ניתן לערוך">
                        🔒
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* הודעה אם אין סוגים מותאמים */}
      {Object.keys(customTypes).length === 0 && (
        <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
          💡 טיפ: לחצי על "סוג חדש" להוספת סוגי משימות מותאמים אישית
        </div>
      )}
    </div>
  );
}

// =====================================
// הגדרות יומן גוגל
// =====================================

function GoogleCalendarSettings() {
  const {
    isConnected,
    isLoading,
    isSyncing,
    googleEmail,
    lastSyncAt,
    calendars,
    selectedCalendarId,
    setSelectedCalendarId,
    connect,
    disconnect,
    syncEvents,
  } = useGoogleCalendar();

  const formatDate = (dateStr) => {
    if (!dateStr) return 'אף פעם';
    const date = new Date(dateStr);
    return date.toLocaleString('he-IL', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        <span className="mr-3 text-gray-600">בודק חיבור...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* סטטוס חיבור */}
      <div className={`rounded-lg p-6 ${
        isConnected 
          ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' 
          : 'bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-700'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              isConnected ? 'bg-green-100 dark:bg-green-800' : 'bg-gray-100 dark:bg-gray-700'
            }`}>
              <span className="text-2xl">{isConnected ? '✅' : '📅'}</span>
            </div>
            <div>
              <h3 className="font-bold text-lg text-gray-800 dark:text-white">
                {isConnected ? 'מחובר ליומן גוגל' : 'יומן גוגל לא מחובר'}
              </h3>
              {isConnected && googleEmail && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {googleEmail}
                </p>
              )}
            </div>
          </div>
          
          {isConnected ? (
            <button
              onClick={disconnect}
              className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors"
            >
              🔌 התנתק
            </button>
          ) : (
            <button
              onClick={connect}
              className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/>
              </svg>
              התחבר ליומן גוגל
            </button>
          )}
        </div>
      </div>

      {/* אפשרויות נוספות - רק אם מחובר */}
      {isConnected && (
        <>
          {/* בחירת יומן */}
          {calendars.length > 1 && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <h4 className="font-medium text-gray-800 dark:text-white mb-3">
                📋 בחירת יומן
              </h4>
              <select
                value={selectedCalendarId}
                onChange={(e) => setSelectedCalendarId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              >
                {calendars.map(cal => (
                  <option key={cal.id} value={cal.id}>
                    {cal.summary} {cal.primary && '(ראשי)'}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* סנכרון */}
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-800 dark:text-white">
                  🔄 סנכרון אירועים
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  סנכרון אחרון: {formatDate(lastSyncAt)}
                </p>
              </div>
              <button
                onClick={() => syncEvents()}
                disabled={isSyncing}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  isSyncing 
                    ? 'bg-gray-300 cursor-not-allowed' 
                    : 'bg-purple-500 hover:bg-purple-600 text-white'
                }`}
              >
                {isSyncing ? '⏳ מסנכרן...' : '🔄 סנכרן עכשיו'}
              </button>
            </div>
          </div>

          {/* הסבר */}
          <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
            <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">
              💡 מה זה עושה?
            </h4>
            <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
              <li>• אירועים מיומן גוגל מוצגים בתצוגה היומית</li>
              <li>• המערכת מתחשבת בפגישות בעת תזמון משימות</li>
              <li>• אפשר לייצא משימות ליומן גוגל</li>
            </ul>
          </div>
        </>
      )}

      {/* הסבר למי שלא מחובר */}
      {!isConnected && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
          <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
            🤔 למה כדאי להתחבר?
          </h4>
          <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
            <li>• הצגת פגישות מיומן גוגל בתצוגה היומית</li>
            <li>• תזמון חכם שמתחשב בפגישות קיימות</li>
            <li>• ייצוא משימות ליומן גוגל</li>
            <li>• סנכרון אוטומטי בין המערכות</li>
          </ul>
        </div>
      )}
    </div>
  );
}
