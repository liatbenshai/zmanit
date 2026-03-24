import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../services/supabase';
import { 
  TASK_CATEGORIES,
  getTaskTypesByCategory,
  addCustomTaskType,
  deleteCustomTaskType,
  loadCustomTaskTypes 
} from '../config/taskTypes';
import { useNotifications } from '../hooks/useNotifications';
import { getLearningStats, clearLearningData } from '../utils/taskLearning';
import toast from 'react-hot-toast';
import Button from '../components/UI/Button';
import Input from '../components/UI/Input';
import Modal from '../components/UI/Modal';

// אימוג'ים נפוצים לבחירה
const COMMON_EMOJIS = [
  '📌', '✨', '🎯', '⭐', '💡', '🔔', '📝', '✅',
  '🏠', '🧹', '🧺', '👕', '🍳', '🛒', '🚗', '🏃',
  '📚', '💻', '📞', '✉️', '📅', '⏰', '🎨', '🎵',
  '👶', '👧', '👦', '👨', '👩', '👴', '👵', '🐕',
  '💪', '🧘', '🏋️', '🚴', '⚽', '🎮', '📺', '🎬',
  '💊', '🏥', '💰', '🏦', '🎁', '🎂', '✈️', '🏖️'
];

function Settings() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('notifications');
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark');
    setDarkMode(isDark);
  }, []);

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const tabs = [
    { id: 'notifications', label: 'התראות', icon: '🔔' },
    { id: 'work', label: 'עבודה', icon: '💼' },
    { id: 'taskTypes', label: 'סוגי משימות', icon: '📋' },
    { id: 'learning', label: 'למידה', icon: '🧠' },
    { id: 'profile', label: 'פרופיל', icon: '👤' },
    { id: 'appearance', label: 'תצוגה', icon: '🎨' },
    { id: 'account', label: 'חשבון', icon: '⚙️' }
  ];

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">⚙️ הגדרות</h1>

        <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
          {activeTab === 'notifications' && <NotificationSettings />}
          {activeTab === 'work' && <WorkSettings user={user} />}
          {activeTab === 'taskTypes' && <TaskTypesSettings />}
          {activeTab === 'learning' && <LearningSettings />}
          {activeTab === 'profile' && <ProfileSettings user={user} loading={loading} setLoading={setLoading} />}
          {activeTab === 'appearance' && <AppearanceSettings darkMode={darkMode} toggleDarkMode={toggleDarkMode} />}
          {activeTab === 'account' && <AccountSettings user={user} logout={logout} loading={loading} setLoading={setLoading} />}
        </div>
      </motion.div>
    </div>
  );
}

function NotificationSettings() {
  const { settings, permission, isSupported, requestPermission, saveSettings, testNotification, playSound } = useNotifications();
  const [localSettings, setLocalSettings] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState('settings'); // 'settings' | 'history' | 'procrastination' | 'calendar'
  const [notificationHistory, setNotificationHistory] = useState([]);

  useEffect(() => {
    setLocalSettings({
      ...settings,
      // ברירות מחדל להגדרות דחיינות
      noTimerReminder: settings.noTimerReminder || { enabled: true, intervalMinutes: 10 },
      pausedTaskReminder: settings.pausedTaskReminder || { enabled: true, afterMinutes: 10 },
      overdueTaskReminder: settings.overdueTaskReminder || { enabled: true, intervalMinutes: 15 },
      calendarReminder: settings.calendarReminder || { enabled: true, minutesBefore: 10 }
    });
    loadNotificationHistory();
  }, [settings]);

  const loadNotificationHistory = () => {
    try {
      const history = localStorage.getItem('zmanit_notification_history');
      if (history) {
        const parsed = JSON.parse(history);
        setNotificationHistory(parsed.sort((a, b) => b.timestamp - a.timestamp).slice(0, 50));
      }
    } catch (e) {}
  };

  const clearHistory = () => {
    localStorage.removeItem('zmanit_notification_history');
    setNotificationHistory([]);
    toast.success('ההיסטוריה נמחקה');
  };

  const handleChange = (key, value) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleNestedChange = (parent, key, value) => {
    setLocalSettings(prev => ({
      ...prev,
      [parent]: { ...prev[parent], [key]: value }
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveSettings(localSettings);
      // שמירה גם ב-localStorage לגישה מהירה
      localStorage.setItem('zmanit_notification_settings', JSON.stringify(localSettings));
      toast.success('ההגדרות נשמרו! ✅');
      playSound('success');
    } catch (err) {
      toast.error('שגיאה בשמירת ההגדרות');
    } finally {
      setSaving(false);
    }
  };

  const handleRequestPermission = async () => {
    const granted = await requestPermission();
    if (granted) {
      toast.success('🔔 התראות הופעלו!');
      playSound('success');
    } else {
      toast.error('ההתראות לא אושרו בדפדפן');
    }
  };

  const handleTest = () => {
    testNotification();
    toast.success('נשלחה התראת בדיקה');
    // הוספה להיסטוריה
    const history = JSON.parse(localStorage.getItem('zmanit_notification_history') || '[]');
    history.unshift({ id: Date.now(), type: 'test', title: 'התראת בדיקה', timestamp: Date.now() });
    localStorage.setItem('zmanit_notification_history', JSON.stringify(history.slice(0, 100)));
    loadNotificationHistory();
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    if (diff < 60000) return 'עכשיו';
    if (diff < 3600000) return `לפני ${Math.floor(diff / 60000)} דק'`;
    if (diff < 86400000) return `לפני ${Math.floor(diff / 3600000)} שעות`;
    return date.toLocaleDateString('he-IL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  const getNotificationIcon = (type) => {
    const icons = { task_starting: '⏰', task_ending: '⏳', task_overdue: '🔴', no_timer: '🎯', paused: '⏸️', calendar: '📅', break: '☕', test: '🧪' };
    return icons[type] || '🔔';
  };

  // Toggle component
  const Toggle = ({ enabled, onChange }) => (
    <button
      onClick={() => onChange(!enabled)}
      className={`relative w-14 h-8 rounded-full transition-colors ${enabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
    >
      <span className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-transform ${enabled ? 'right-1' : 'left-1'}`} />
    </button>
  );

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white">🔔 הגדרות התראות</h2>

      {/* תתי-טאבים */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[
          { id: 'settings', label: '⚙️ כללי' },
          { id: 'procrastination', label: '🎯 דחיינות' },
          { id: 'calendar', label: '📅 יומן' },
          { id: 'history', label: `📜 היסטוריה (${notificationHistory.length})` }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              activeSubTab === tab.id ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* סטטוס הרשאות - מוצג תמיד */}
      <div className={`p-4 rounded-lg ${
        permission === 'granted' ? 'bg-green-50 dark:bg-green-900/20' : 
        permission === 'denied' ? 'bg-red-50 dark:bg-red-900/20' : 'bg-yellow-50 dark:bg-yellow-900/20'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{permission === 'granted' ? '✅' : permission === 'denied' ? '❌' : '⚠️'}</span>
            <div>
              <p className="font-medium text-gray-900 dark:text-white">
                {permission === 'granted' ? 'התראות Push פועלות' : permission === 'denied' ? 'התראות חסומות' : 'התראות לא אושרו'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {permission === 'denied' && 'יש לאשר בהגדרות הדפדפן'}
                {permission === 'granted' && 'התראות יופיעו גם כשהדפדפן ממוזער'}
              </p>
            </div>
          </div>
          {isSupported && permission !== 'granted' && permission !== 'denied' && (
            <Button onClick={handleRequestPermission}>🔔 אפשר</Button>
          )}
          {permission === 'granted' && (
            <Button variant="secondary" onClick={handleTest}>🧪 בדיקה</Button>
          )}
        </div>
      </div>

      {/* טאב הגדרות כלליות */}
      {activeSubTab === 'settings' && (
        <div className="space-y-4">
          <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-600">
            <p className="font-medium text-gray-900 dark:text-white mb-2">⏰ התראה לפני משימה</p>
            <select
              value={localSettings.reminderMinutes}
              onChange={(e) => handleChange('reminderMinutes', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value={1}>דקה לפני</option>
              <option value={2}>2 דקות לפני</option>
              <option value={5}>5 דקות לפני</option>
              <option value={10}>10 דקות לפני</option>
              <option value={15}>15 דקות לפני</option>
              <option value={30}>30 דקות לפני</option>
            </select>
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-600">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">🔔 התראה בזמן המשימה</p>
              <p className="text-sm text-gray-500">התראה כשמגיע הזמן</p>
            </div>
            <Toggle enabled={localSettings.notifyOnTime} onChange={(v) => handleChange('notifyOnTime', v)} />
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-600">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">🔊 צליל התראה</p>
              <p className="text-sm text-gray-500">השמע צליל עם ההתראה</p>
            </div>
            <div className="flex items-center gap-2">
              {localSettings.soundEnabled && (
                <button onClick={() => playSound('warning')} className="text-sm text-blue-500 hover:text-blue-600">🔈 נגן</button>
              )}
              <Toggle enabled={localSettings.soundEnabled} onChange={(v) => handleChange('soundEnabled', v)} />
            </div>
          </div>

          <Button onClick={handleSave} loading={saving} className="w-full">💾 שמור הגדרות</Button>
        </div>
      )}

      {/* טאב הגדרות דחיינות */}
      {activeSubTab === 'procrastination' && (
        <div className="space-y-4">
          <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg text-sm text-orange-700 dark:text-orange-300">
            💡 הגדרות אלו עוזרות להילחם בדחיינות בשעות העבודה
          </div>

          {/* תזכורת כשאין טיימר */}
          <div className="p-4 rounded-lg border-2 border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-900/10">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">🎯 תזכורת בשעות עבודה</p>
                <p className="text-sm text-gray-500">כשאין טיימר פעיל - פופאפ חוסם</p>
              </div>
              <Toggle 
                enabled={localSettings.noTimerReminder?.enabled} 
                onChange={(v) => handleNestedChange('noTimerReminder', 'enabled', v)} 
              />
            </div>
            {localSettings.noTimerReminder?.enabled && (
              <div className="flex items-center gap-2 mt-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">הזכר כל</span>
                <select
                  value={localSettings.noTimerReminder?.intervalMinutes || 10}
                  onChange={(e) => handleNestedChange('noTimerReminder', 'intervalMinutes', parseInt(e.target.value))}
                  className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
                >
                  <option value={5}>5 דקות</option>
                  <option value={10}>10 דקות</option>
                  <option value={15}>15 דקות</option>
                  <option value={20}>20 דקות</option>
                  <option value={30}>30 דקות</option>
                </select>
              </div>
            )}
          </div>

          {/* תזכורת כשמשימה מושהית */}
          <div className="p-4 rounded-lg border-2 border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-900/10">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">⏸️ משימה מושהית</p>
                <p className="text-sm text-gray-500">כשטיימר מושהה זמן רב</p>
              </div>
              <Toggle 
                enabled={localSettings.pausedTaskReminder?.enabled} 
                onChange={(v) => handleNestedChange('pausedTaskReminder', 'enabled', v)} 
              />
            </div>
            {localSettings.pausedTaskReminder?.enabled && (
              <div className="flex items-center gap-2 mt-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">הזכר אחרי</span>
                <select
                  value={localSettings.pausedTaskReminder?.afterMinutes || 10}
                  onChange={(e) => handleNestedChange('pausedTaskReminder', 'afterMinutes', parseInt(e.target.value))}
                  className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
                >
                  <option value={5}>5 דקות</option>
                  <option value={10}>10 דקות</option>
                  <option value={15}>15 דקות</option>
                  <option value={20}>20 דקות</option>
                </select>
                <span className="text-sm text-gray-600 dark:text-gray-400">השהייה</span>
              </div>
            )}
          </div>

          {/* תזכורת משימה באיחור */}
          <div className="p-4 rounded-lg border-2 border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-900/10">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">🔴 משימה באיחור</p>
                <p className="text-sm text-gray-500">כשמשימה עברה את הזמן שלה</p>
              </div>
              <Toggle 
                enabled={localSettings.overdueTaskReminder?.enabled} 
                onChange={(v) => handleNestedChange('overdueTaskReminder', 'enabled', v)} 
              />
            </div>
            {localSettings.overdueTaskReminder?.enabled && (
              <div className="flex items-center gap-2 mt-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">הזכר כל</span>
                <select
                  value={localSettings.overdueTaskReminder?.intervalMinutes || 15}
                  onChange={(e) => handleNestedChange('overdueTaskReminder', 'intervalMinutes', parseInt(e.target.value))}
                  className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
                >
                  <option value={5}>5 דקות</option>
                  <option value={10}>10 דקות</option>
                  <option value={15}>15 דקות</option>
                  <option value={30}>30 דקות</option>
                  <option value={60}>שעה</option>
                </select>
              </div>
            )}
          </div>

          <Button onClick={handleSave} loading={saving} className="w-full">💾 שמור הגדרות דחיינות</Button>
        </div>
      )}

      {/* טאב יומן גוגל */}
      {activeSubTab === 'calendar' && (
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-700 dark:text-blue-300">
            📅 קבלי התראות על אירועים מיומן גוגל
          </div>

          <div className="p-4 rounded-lg border-2 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">📅 התראות אירועי יומן</p>
                <p className="text-sm text-gray-500">תזכורת לפני פגישות ואירועים</p>
              </div>
              <Toggle 
                enabled={localSettings.calendarReminder?.enabled} 
                onChange={(v) => handleNestedChange('calendarReminder', 'enabled', v)} 
              />
            </div>
            {localSettings.calendarReminder?.enabled && (
              <div className="flex items-center gap-2 mt-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">הזכר</span>
                <select
                  value={localSettings.calendarReminder?.minutesBefore || 10}
                  onChange={(e) => handleNestedChange('calendarReminder', 'minutesBefore', parseInt(e.target.value))}
                  className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
                >
                  <option value={5}>5 דקות</option>
                  <option value={10}>10 דקות</option>
                  <option value={15}>15 דקות</option>
                  <option value={30}>30 דקות</option>
                  <option value={60}>שעה</option>
                </select>
                <span className="text-sm text-gray-600 dark:text-gray-400">לפני האירוע</span>
              </div>
            )}
          </div>

          <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">🔔 התראה בתחילת אירוע</p>
                <p className="text-sm text-gray-500">התראה כשהאירוע מתחיל</p>
              </div>
              <Toggle 
                enabled={localSettings.calendarReminder?.notifyOnStart ?? true} 
                onChange={(v) => handleNestedChange('calendarReminder', 'notifyOnStart', v)} 
              />
            </div>
          </div>

          <Button onClick={handleSave} loading={saving} className="w-full">💾 שמור הגדרות יומן</Button>
        </div>
      )}

      {/* טאב היסטוריה */}
      {activeSubTab === 'history' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">התראות אחרונות</p>
            {notificationHistory.length > 0 && (
              <button onClick={clearHistory} className="text-sm text-red-500 hover:text-red-600">🗑️ נקה</button>
            )}
          </div>

          {notificationHistory.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <div className="text-4xl mb-3">📭</div>
              <div>אין היסטוריית התראות</div>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {notificationHistory.map((n) => (
                <div key={n.id} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg flex items-start gap-3">
                  <span className="text-xl">{getNotificationIcon(n.type)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white text-sm">{n.title}</p>
                    {n.message && <p className="text-xs text-gray-500 truncate">{n.message}</p>}
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap">{formatTime(n.timestamp)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {permission === 'denied' && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-700 dark:text-red-300">
          <p className="font-medium">ההתראות חסומות בדפדפן</p>
          <p className="text-sm mt-1">לחצי על 🔒 ליד שורת הכתובת ← אפשרי התראות ← רעננו את הדף</p>
        </div>
      )}
    </div>
  );
}

function WorkSettings({ user }) {
  // 🔧 תיקון: הוספת תמיכה בדקות (לא רק שעות שלמות)
  const [workHours, setWorkHours] = useState({ 
    startHour: 8, 
    startMinute: 30, 
    endHour: 16, 
    endMinute: 15, 
    workDays: [0, 1, 2, 3, 4] 
  });

  useEffect(() => {
    const saved = localStorage.getItem(`work_settings_${user?.id}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.workHours) {
          // 🔧 תאימות אחורה: אם אין דקות, נשתמש ב-0
          setWorkHours({
            startHour: parsed.workHours.startHour || 8,
            startMinute: parsed.workHours.startMinute ?? 30,
            endHour: parsed.workHours.endHour || 16,
            endMinute: parsed.workHours.endMinute ?? 15,
            workDays: parsed.workHours.workDays || [0, 1, 2, 3, 4]
          });
        }
      } catch (e) {}
    }
  }, [user?.id]);

  const handleSave = () => {
    localStorage.setItem(`work_settings_${user?.id}`, JSON.stringify({ workHours }));
    
    // 🔧 שמירה גם בפורמט שמנהל ההתראות מחפש
    localStorage.setItem('zmanit_work_settings', JSON.stringify({
      startMinutes: workHours.startHour * 60 + workHours.startMinute,
      endMinutes: workHours.endHour * 60 + workHours.endMinute,
      workDays: workHours.workDays
    }));
    
    toast.success('הגדרות העבודה נשמרו');
  };

  const dayNames = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
  
  // אפשרויות דקות
  const minuteOptions = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
  
  // פורמט שעה לתצוגה
  const formatTime = (hour, minute) => {
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white">הגדרות עבודה</h2>
      
      <div className="space-y-3">
        <h3 className="font-medium text-gray-700 dark:text-gray-300">שעות עבודה</h3>
        
        {/* שעת התחלה */}
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <label className="block text-sm text-gray-500 mb-1">התחלה</label>
            <div className="flex gap-1">
              <select
                value={workHours.startHour}
                onChange={(e) => setWorkHours(w => ({ ...w, startHour: parseInt(e.target.value) }))}
                className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {Array.from({ length: 14 }, (_, i) => i + 5).map(h => (
                  <option key={h} value={h}>{h.toString().padStart(2, '0')}</option>
                ))}
              </select>
              <span className="text-gray-400 self-center">:</span>
              <select
                value={workHours.startMinute}
                onChange={(e) => setWorkHours(w => ({ ...w, startMinute: parseInt(e.target.value) }))}
                className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {minuteOptions.map(m => (
                  <option key={m} value={m}>{m.toString().padStart(2, '0')}</option>
                ))}
              </select>
            </div>
          </div>
          
          <span className="text-gray-400 pt-6">עד</span>
          
          {/* שעת סיום */}
          <div>
            <label className="block text-sm text-gray-500 mb-1">סיום</label>
            <div className="flex gap-1">
              <select
                value={workHours.endHour}
                onChange={(e) => setWorkHours(w => ({ ...w, endHour: parseInt(e.target.value) }))}
                className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {Array.from({ length: 14 }, (_, i) => i + 10).map(h => (
                  <option key={h} value={h}>{h.toString().padStart(2, '0')}</option>
                ))}
              </select>
              <span className="text-gray-400 self-center">:</span>
              <select
                value={workHours.endMinute}
                onChange={(e) => setWorkHours(w => ({ ...w, endMinute: parseInt(e.target.value) }))}
                className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {minuteOptions.map(m => (
                  <option key={m} value={m}>{m.toString().padStart(2, '0')}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        
        {/* תצוגת השעות שנבחרו */}
        <div className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg">
          📅 שעות עבודה: {formatTime(workHours.startHour, workHours.startMinute)} - {formatTime(workHours.endHour, workHours.endMinute)}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="font-medium text-gray-700 dark:text-gray-300">ימי עבודה</h3>
        <div className="flex gap-2">
          {dayNames.map((name, i) => (
            <button
              key={i}
              onClick={() => setWorkHours(w => ({
                ...w,
                workDays: w.workDays.includes(i) ? w.workDays.filter(d => d !== i) : [...w.workDays, i].sort()
              }))}
              className={`w-10 h-10 rounded-full font-medium transition-colors ${
                workHours.workDays.includes(i) ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
              }`}
            >
              {name}
            </button>
          ))}
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {workHours.workDays.length === 0 
            ? 'לא נבחרו ימי עבודה'
            : `${workHours.workDays.length} ימי עבודה בשבוע`
          }
        </div>
      </div>

      <Button onClick={handleSave}>שמור הגדרות</Button>
    </div>
  );
}

/**
 * ✅ הגדרות סוגי משימות - משודרג!
 */
function TaskTypesSettings() {
  const [selectedCategory, setSelectedCategory] = useState('home');
  const [showAddForm, setShowAddForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingType, setEditingType] = useState(null);
  const [builtInOverrides, setBuiltInOverrides] = useState({});

  // טעינת התאמות מובנים
  useEffect(() => {
    try {
      const saved = localStorage.getItem('zmanit_builtin_overrides');
      if (saved) setBuiltInOverrides(JSON.parse(saved));
    } catch (e) {}
  }, [refreshKey]);

  const refresh = () => setRefreshKey(k => k + 1);
  
  // בדיקה אם סוג מובנה שונה
  const isBuiltInModified = (typeId) => !!builtInOverrides[typeId];
  
  // איפוס סוג מובנה
  const resetBuiltInType = (typeId) => {
    const newOverrides = { ...builtInOverrides };
    delete newOverrides[typeId];
    localStorage.setItem('zmanit_builtin_overrides', JSON.stringify(newOverrides));
    setBuiltInOverrides(newOverrides);
    toast.success('סוג המשימה אופס להגדרות המקוריות');
    refresh();
  };

  // קבלת סוגים לפי קטגוריה
  const typesForCategory = getTaskTypesByCategory(selectedCategory);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">📋 סוגי משימות</h2>
      </div>
      
      <p className="text-sm text-gray-500 dark:text-gray-400">
        הוסיפי סוגי משימות מותאמים אישית כמו "חוג מקרמה" או "קיפול כביסה"
      </p>

      {/* טאבים לקטגוריות */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 pb-2">
        {Object.values(TASK_CATEGORIES).map(cat => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium transition-colors
              ${selectedCategory === cat.id
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-b-2 border-blue-500'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }
            `}
          >
            <span>{cat.icon}</span>
            <span>{cat.name}</span>
          </button>
        ))}
      </div>

      {/* רשימת סוגי משימות */}
      <div className="space-y-2" key={refreshKey}>
        {typesForCategory.map(type => (
          <div
            key={type.id}
            className={`
              flex items-center justify-between p-3 rounded-lg border
              ${type.bgLight || 'bg-gray-50 dark:bg-gray-700'} 
              ${type.border || 'border-gray-200 dark:border-gray-600'}
            `}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{type.icon}</span>
              <div>
                <p className={`font-medium ${type.text || 'text-gray-900 dark:text-white'}`}>
                  {type.name}
                </p>
                <p className="text-xs text-gray-500">
                  {type.defaultDuration} דק' ברירת מחדל
                  {' • '}
                  {type.isBuiltIn 
                    ? (isBuiltInModified(type.id) ? '✨ מותאם' : 'מובנה') 
                    : 'מותאם אישית'}
                </p>
              </div>
            </div>
            
            {/* כפתורי פעולה - לכל הסוגים */}
            <div className="flex gap-1">
              <button
                onClick={() => setEditingType(type)}
                className="p-2 hover:bg-white/50 dark:hover:bg-gray-600 rounded-lg transition-colors"
                title="ערוך"
              >
                ✏️
              </button>
              {type.isBuiltIn && isBuiltInModified(type.id) && (
                <button
                  onClick={() => {
                    if (confirm(`לאפס את "${type.name}" להגדרות המקוריות?`)) {
                      resetBuiltInType(type.id);
                    }
                  }}
                  className="p-2 hover:bg-orange-100 dark:hover:bg-orange-900/30 rounded-lg transition-colors"
                  title="אפס להגדרות מקוריות"
                >
                  🔄
                </button>
              )}
              {!type.isBuiltIn && (
                <button
                  onClick={() => {
                    if (confirm(`למחוק את "${type.name}"?`)) {
                      deleteCustomTaskType(type.id);
                      refresh();
                      toast.success('סוג המשימה נמחק');
                    }
                  }}
                  className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg text-gray-500 hover:text-red-600 transition-colors"
                  title="מחק"
                >
                  🗑️
                </button>
              )}
            </div>
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
            refresh();
            setShowAddForm(false);
            toast.success(`נוסף סוג משימה: ${newType.name}`);
          }}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {/* הסבר */}
      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-700 dark:text-blue-300">
        💡 <strong>טיפ:</strong> ניתן לערוך את כל סוגי המשימות. שינויים נשמרים בדפדפן.
      </div>
      
      {/* מודל עריכה */}
      {editingType && (
        <EditTaskTypeModal
          taskType={editingType}
          onSave={(updates) => {
            // עדכון הסוג - תומך גם במובנים וגם במותאמים
            if (editingType.isBuiltIn) {
              // סוג מובנה - שומרים כ-override
              const overridesKey = 'zmanit_builtin_overrides';
              let overrides = {};
              try {
                const saved = localStorage.getItem(overridesKey);
                if (saved) overrides = JSON.parse(saved);
              } catch (e) {}
              
              overrides[editingType.id] = {
                ...overrides[editingType.id],
                ...updates
              };
              localStorage.setItem(overridesKey, JSON.stringify(overrides));
              toast.success(`סוג המשימה "${updates.name}" עודכן`);
            } else {
              // סוג מותאם אישית
              const customTypes = loadCustomTaskTypes();
              if (customTypes[editingType.id]) {
                customTypes[editingType.id] = { ...customTypes[editingType.id], ...updates };
                localStorage.setItem('zmanit_custom_task_types', JSON.stringify(customTypes));
                toast.success('סוג המשימה עודכן');
              }
            }
            
            setEditingType(null);
            refresh();
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
    <form onSubmit={handleSubmit} className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg space-y-4 border border-gray-200 dark:border-gray-700">
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
            <div className="absolute top-full right-0 mt-2 p-2 bg-white dark:bg-gray-800 
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
          placeholder="שם סוג המשימה (למשל: חוג מקרמה)"
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
        <span className="text-sm text-gray-500 mr-2">דקות</span>
      </div>
      
      {/* כפתורים */}
      <div className="flex gap-2 pt-2">
        <Button type="submit">
          הוסף ✓
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          ביטול
        </Button>
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
  const [defaultDuration, setDefaultDuration] = useState(taskType.defaultDuration || 30);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('נא להזין שם');
      return;
    }
    onSave({ name: name.trim(), icon, defaultDuration });
  };
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" dir="rtl">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md shadow-xl"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            ✏️ עריכת "{taskType.name}"
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            ✕
          </button>
        </div>
        
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
                <div className="absolute top-full right-0 mt-2 p-2 bg-white dark:bg-gray-800 
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
              שמור ✓
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

/**
 * ✅ חדש: הגדרות למידה
 */
function LearningSettings() {
  const [stats, setStats] = useState(null);
  
  useEffect(() => {
    setStats(getLearningStats());
  }, []);
  
  const handleClearData = () => {
    if (confirm('למחוק את כל נתוני הלמידה? הפעולה בלתי הפיכה.')) {
      clearLearningData();
      setStats(getLearningStats());
      toast.success('נתוני הלמידה נמחקו');
    }
  };
  
  const formatRatio = (ratio) => {
    if (ratio > 1) return `+${Math.round((ratio - 1) * 100)}%`;
    if (ratio < 1) return `-${Math.round((1 - ratio) * 100)}%`;
    return 'מדויק';
  };
  
  const getTrendEmoji = (trend) => {
    if (trend === 'improving') return '📈';
    if (trend === 'declining') return '📉';
    return '➡️';
  };
  
  const getTrendText = (trend) => {
    if (trend === 'improving') return 'משתפרת';
    if (trend === 'declining') return 'יורדת';
    return 'יציבה';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">🧠 מערכת למידה</h2>
      </div>
      
      <p className="text-sm text-gray-500 dark:text-gray-400">
        המערכת לומדת מכל משימה שמסיימים ומציעה הערכות זמן מדויקות יותר
      </p>

      {!stats || Object.keys(stats).length === 0 ? (
        <div className="p-6 bg-gray-50 dark:bg-gray-700 rounded-lg text-center">
          <span className="text-4xl mb-3 block">📊</span>
          <p className="text-gray-600 dark:text-gray-300">
            אין עדיין נתוני למידה
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            סיימי משימות כדי שהמערכת תתחיל ללמוד את הדפוסים שלך
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {Object.entries(stats).map(([taskType, data]) => (
            <div
              key={taskType}
              className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {taskType}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {data.count} משימות הושלמו
                  </p>
                </div>
                <div className="text-left">
                  <p className={`font-bold ${
                    data.ratio > 1.1 ? 'text-orange-600' : 
                    data.ratio < 0.9 ? 'text-green-600' : 
                    'text-blue-600'
                  }`}>
                    {formatRatio(data.ratio)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {getTrendEmoji(data.trend)} {getTrendText(data.trend)}
                  </p>
                </div>
              </div>
              
              {/* פירוט */}
              <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600 text-xs text-gray-500 dark:text-gray-400">
                ממוצע הערכה: {Math.round(data.avgEstimated)} דק' → 
                בפועל: {Math.round(data.avgActual)} דק'
              </div>
            </div>
          ))}
        </div>
      )}

      {/* כפתור מחיקה */}
      {stats && Object.keys(stats).length > 0 && (
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleClearData}
            className="text-sm text-red-500 hover:text-red-700 dark:text-red-400"
          >
            🗑️ מחק את כל נתוני הלמידה
          </button>
        </div>
      )}

      {/* הסבר */}
      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-700 dark:text-blue-300">
        <p><strong>💡 איך זה עובד?</strong></p>
        <ul className="mt-2 space-y-1 text-xs">
          <li>• כל פעם שמסיימים משימה, המערכת שומרת את הזמן האמיתי</li>
          <li>• אחרי 3+ משימות מאותו סוג, תופיע הצעה לעדכון הערכה</li>
          <li>• ככל שתשתמשי יותר, ההצעות יהיו מדויקות יותר</li>
        </ul>
      </div>
    </div>
  );
}

function AppearanceSettings({ darkMode, toggleDarkMode }) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white">הגדרות תצוגה</h2>
      <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
        <div>
          <p className="font-medium text-gray-900 dark:text-white">מצב כהה</p>
          <p className="text-sm text-gray-500">החלף בין ערכת צבעים בהירה לכהה</p>
        </div>
        <button onClick={toggleDarkMode} className={`relative w-14 h-8 rounded-full transition-colors ${darkMode ? 'bg-blue-600' : 'bg-gray-300'}`}>
          <span className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-transform ${darkMode ? 'right-1' : 'left-1'}`} />
        </button>
      </div>
    </div>
  );
}

function ProfileSettings({ user, loading, setLoading }) {
  const [fullName, setFullName] = useState(user?.profile?.full_name || '');

  const handleSave = async () => {
    setLoading(true);
    try {
      await supabase.from('users').update({ full_name: fullName }).eq('id', user.id);
      toast.success('הפרופיל נשמר');
    } catch (err) {
      toast.error('שגיאה בשמירה');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white">פרטי פרופיל</h2>
      <div><p className="text-sm text-gray-500">אימייל</p><p className="text-gray-900 dark:text-white">{user?.email}</p></div>
      <Input label="שם מלא" value={fullName} onChange={(e) => setFullName(e.target.value)} />
      <Button onClick={handleSave} loading={loading}>שמור</Button>
    </div>
  );
}

function AccountSettings({ user, logout, loading, setLoading }) {
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwords, setPasswords] = useState({ new: '', confirm: '' });

  const handleChangePassword = async () => {
    if (passwords.new !== passwords.confirm) { toast.error('הסיסמאות לא תואמות'); return; }
    if (passwords.new.length < 6) { toast.error('סיסמה קצרה מדי'); return; }
    setLoading(true);
    try {
      await supabase.auth.updateUser({ password: passwords.new });
      toast.success('הסיסמה שונתה');
      setShowPasswordForm(false);
    } catch (err) {
      toast.error('שגיאה');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white">הגדרות חשבון</h2>
      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="flex items-center justify-between">
          <p className="font-medium text-gray-900 dark:text-white">סיסמה</p>
          <Button variant="secondary" onClick={() => setShowPasswordForm(!showPasswordForm)}>שנה סיסמה</Button>
        </div>
        {showPasswordForm && (
          <div className="mt-4 space-y-4 pt-4 border-t">
            <Input type="password" label="סיסמה חדשה" value={passwords.new} onChange={(e) => setPasswords(p => ({ ...p, new: e.target.value }))} />
            <Input type="password" label="אימות" value={passwords.confirm} onChange={(e) => setPasswords(p => ({ ...p, confirm: e.target.value }))} />
            <Button onClick={handleChangePassword} loading={loading}>שמור</Button>
          </div>
        )}
      </div>
      <Button variant="danger" onClick={logout}>צא מהמערכת</Button>
    </div>
  );
}

export default Settings;
