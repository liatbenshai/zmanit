/**
 * ממשק אדמין - הגדרות האפליקציה
 * =====================================
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth';
import { getConfig, updateConfig, DEFAULT_CONFIG } from '../../config/appConfig';
import Button from '../UI/Button';
import toast from 'react-hot-toast';

// =====================================
// לשוניות
// =====================================

const TABS = [
  { id: 'workHours', name: 'שעות עבודה', icon: '🕐' },
  { id: 'taskTypes', name: 'סוגי משימות', icon: '📋' },
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
// הגדרות סוגי משימות
// =====================================

function TaskTypesSettings() {
  const [taskTypes, setTaskTypes] = useState([]);
  const [editingType, setEditingType] = useState(null);
  
  // טעינת סוגי משימות
  useEffect(() => {
    // כרגע טוען מ-localStorage, אחר כך נעביר ל-Supabase
    try {
      const saved = localStorage.getItem('zmanit_custom_task_types');
      if (saved) {
        setTaskTypes(JSON.parse(saved));
      }
    } catch (e) {}
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-pink-50 dark:bg-pink-900/20 rounded-lg p-4">
        <h3 className="font-bold text-lg mb-4 text-pink-800 dark:text-pink-200">
          📋 סוגי משימות
        </h3>
        
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          כאן תוכלי להוסיף, לערוך ולמחוק סוגי משימות מותאמים אישית.
        </p>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-center text-gray-500 py-8">
            🚧 בפיתוח - יהיה זמין בקרוב!
            <br />
            <span className="text-sm">כרגע ניתן לערוך סוגי משימות בקובץ taskTypes.js</span>
          </p>
        </div>
      </div>
      
      {/* רשימת סוגים קיימים (לצפייה בלבד) */}
      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
        <h4 className="font-medium mb-3">סוגים מובנים:</h4>
        <div className="flex flex-wrap gap-2">
          {[
            { icon: '🎙️', name: 'תמלול' },
            { icon: '✅', name: 'הגהה' },
            { icon: '🌐', name: 'תרגום' },
            { icon: '📁', name: 'אדמיניסטרציה' },
            { icon: '📧', name: 'מיילים' },
            { icon: '📞', name: 'שיחות' },
            { icon: '📝', name: 'כתיבה' },
            { icon: '💻', name: 'פיתוח' },
            { icon: '📊', name: 'ניתוח' },
            { icon: '🎨', name: 'עיצוב' }
          ].map(type => (
            <span
              key={type.name}
              className="px-3 py-1 bg-white dark:bg-gray-800 rounded-full border border-gray-200 dark:border-gray-600 text-sm"
            >
              {type.icon} {type.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
