import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../services/supabase';
import { TASK_TYPES } from '../config/taskTypes';
import { useNotifications } from '../hooks/useNotifications';
import toast from 'react-hot-toast';
import Button from '../components/UI/Button';
import Input from '../components/UI/Input';
import Modal from '../components/UI/Modal';

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
          {activeTab === 'taskTypes' && <TaskTypesSettings user={user} />}
          {activeTab === 'profile' && <ProfileSettings user={user} loading={loading} setLoading={setLoading} />}
          {activeTab === 'appearance' && <AppearanceSettings darkMode={darkMode} toggleDarkMode={toggleDarkMode} />}
          {activeTab === 'account' && <AccountSettings user={user} logout={logout} loading={loading} setLoading={setLoading} />}
        </div>
      </motion.div>
    </div>
  );
}

function NotificationSettings() {
  const { settings, permission, isSupported, requestPermission, saveSettings, testNotification } = useNotifications();
  const [localSettings, setLocalSettings] = useState(settings);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleChange = (key, value) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveSettings(localSettings);
      toast.success('ההגדרות נשמרו! ✅');
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
    } else {
      toast.error('ההתראות לא אושרו בדפדפן');
    }
  };

  const handleTest = () => {
    testNotification();
    toast.success('נשלחה התראת בדיקה');
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white">🔔 הגדרות התראות</h2>

      <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-900 dark:text-white">התראות דפדפן</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {!isSupported && 'הדפדפן לא תומך בהתראות'}
              {isSupported && permission === 'granted' && '✅ התראות מופעלות'}
              {isSupported && permission === 'denied' && '❌ התראות חסומות'}
              {isSupported && permission === 'default' && 'יש לאשר התראות'}
            </p>
          </div>
          
          {isSupported && permission !== 'granted' && (
            <Button onClick={handleRequestPermission}>🔔 אפשר התראות</Button>
          )}
          
          {permission === 'granted' && (
            <Button variant="secondary" onClick={handleTest}>🧪 בדיקה</Button>
          )}
        </div>
      </div>

      {permission === 'granted' && (
        <div className="space-y-4">
          <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-600">
            <p className="font-medium text-gray-900 dark:text-white mb-2">⏰ התראה לפני המשימה</p>
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
            <button
              onClick={() => handleChange('notifyOnTime', !localSettings.notifyOnTime)}
              className={`relative w-14 h-8 rounded-full transition-colors ${localSettings.notifyOnTime ? 'bg-blue-600' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-transform ${localSettings.notifyOnTime ? 'right-1' : 'left-1'}`} />
            </button>
          </div>

          <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-600">
            <p className="font-medium text-gray-900 dark:text-white mb-2">🔴 תזכורת חוזרת למשימות באיחור</p>
            <select
              value={localSettings.repeatEveryMinutes || 10}
              onChange={(e) => handleChange('repeatEveryMinutes', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value={5}>כל 5 דקות</option>
              <option value={10}>כל 10 דקות</option>
              <option value={15}>כל 15 דקות</option>
              <option value={30}>כל 30 דקות</option>
              <option value={60}>כל שעה</option>
            </select>
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-600">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">🔊 צליל התראה</p>
              <p className="text-sm text-gray-500">השמע צליל עם ההתראה</p>
            </div>
            <button
              onClick={() => handleChange('soundEnabled', !localSettings.soundEnabled)}
              className={`relative w-14 h-8 rounded-full transition-colors ${localSettings.soundEnabled ? 'bg-blue-600' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-transform ${localSettings.soundEnabled ? 'right-1' : 'left-1'}`} />
            </button>
          </div>

          <Button onClick={handleSave} loading={saving} className="w-full">💾 שמור הגדרות</Button>
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
  const [workHours, setWorkHours] = useState({ startHour: 8, endHour: 16, workDays: [0, 1, 2, 3, 4] });

  useEffect(() => {
    const saved = localStorage.getItem(`work_settings_${user?.id}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.workHours) setWorkHours(parsed.workHours);
      } catch (e) {}
    }
  }, [user?.id]);

  const handleSave = () => {
    localStorage.setItem(`work_settings_${user?.id}`, JSON.stringify({ workHours }));
    toast.success('הגדרות העבודה נשמרו');
  };

  const dayNames = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white">הגדרות עבודה</h2>
      
      <div className="space-y-3">
        <h3 className="font-medium text-gray-700 dark:text-gray-300">שעות עבודה</h3>
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <label className="block text-sm text-gray-500 mb-1">התחלה</label>
            <select
              value={workHours.startHour}
              onChange={(e) => setWorkHours(w => ({ ...w, startHour: parseInt(e.target.value) }))}
              className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {Array.from({ length: 14 }, (_, i) => i + 5).map(h => (
                <option key={h} value={h}>{h}:00</option>
              ))}
            </select>
          </div>
          <span className="text-gray-400 pt-6">עד</span>
          <div>
            <label className="block text-sm text-gray-500 mb-1">סיום</label>
            <select
              value={workHours.endHour}
              onChange={(e) => setWorkHours(w => ({ ...w, endHour: parseInt(e.target.value) }))}
              className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {Array.from({ length: 14 }, (_, i) => i + 10).map(h => (
                <option key={h} value={h}>{h}:00</option>
              ))}
            </select>
          </div>
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
      </div>

      <Button onClick={handleSave}>שמור הגדרות</Button>
    </div>
  );
}

function TaskTypesSettings({ user }) {
  const [customTypes, setCustomTypes] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(`custom_task_types_${user?.id}`);
    if (saved) {
      try { setCustomTypes(JSON.parse(saved)); } catch (e) {}
    }
  }, [user?.id]);

  const saveCustomTypes = (types) => {
    setCustomTypes(types);
    localStorage.setItem(`custom_task_types_${user?.id}`, JSON.stringify(types));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">סוגי משימות</h2>
        <Button size="sm" onClick={() => setShowAddForm(true)}>+ הוסף סוג</Button>
      </div>

      <div className="grid gap-3">
        {Object.entries(TASK_TYPES).map(([key, type]) => (
          <div key={key} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{type.icon}</span>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">{type.name}</p>
                <p className="text-sm text-gray-500">{type.avgDuration} דקות</p>
              </div>
            </div>
            <span className="text-xs bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded">מובנה</span>
          </div>
        ))}
        {customTypes.map(type => (
          <div key={type.id} className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{type.icon}</span>
              <p className="font-medium text-gray-900 dark:text-white">{type.name}</p>
            </div>
            <button onClick={() => saveCustomTypes(customTypes.filter(t => t.id !== type.id))} className="text-red-500">🗑️</button>
          </div>
        ))}
      </div>

      <Modal isOpen={showAddForm} onClose={() => setShowAddForm(false)} title="הוסף סוג משימה">
        <TaskTypeForm onSave={(newType) => {
          saveCustomTypes([...customTypes, { ...newType, id: Date.now().toString() }]);
          setShowAddForm(false);
          toast.success('סוג המשימה נוסף');
        }} onClose={() => setShowAddForm(false)} />
      </Modal>
    </div>
  );
}

function TaskTypeForm({ onSave, onClose }) {
  const [form, setForm] = useState({ name: '', icon: '📌', avgDuration: 30 });
  const icons = ['📌', '📝', '💻', '📞', '📧', '🎯', '📊', '🔧', '📚', '🎨'];

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (form.name) onSave(form); }} className="space-y-4">
      <Input label="שם" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} />
      <div className="flex flex-wrap gap-2">
        {icons.map(icon => (
          <button key={icon} type="button" onClick={() => setForm(f => ({ ...f, icon }))}
            className={`w-10 h-10 rounded-lg text-xl ${form.icon === icon ? 'bg-blue-100 border-2 border-blue-500' : 'bg-gray-100'}`}>
            {icon}
          </button>
        ))}
      </div>
      <div className="flex gap-3">
        <Button type="submit">שמור</Button>
        <Button type="button" variant="secondary" onClick={onClose}>ביטול</Button>
      </div>
    </form>
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
