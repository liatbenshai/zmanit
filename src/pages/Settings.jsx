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

/**
 * דף הגדרות מקיף
 */
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          ⚙️ הגדרות
        </h1>

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
          {activeTab === 'appearance' && (
            <AppearanceSettings darkMode={darkMode} toggleDarkMode={toggleDarkMode} />
          )}
          {activeTab === 'account' && <AccountSettings user={user} logout={logout} loading={loading} setLoading={setLoading} />}
        </div>
      </motion.div>
    </div>
  );
}

/**
 * הגדרות התראות
 */
function NotificationSettings() {
  const { 
    settings, 
    permission, 
    isSupported, 
    requestPermission, 
    saveSettings,
    testNotification
  } = useNotifications();
  
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

      {/* סטטוס */}
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
            <Button onClick={handleRequestPermission}>
              🔔 אפשר התראות
            </Button>
          )}
          
          {permission === 'granted' && (
            <Button variant="secondary" onClick={handleTest}>
              🧪 בדיקה
            </Button>
          )}
        </div>
      </div>

      {permission === 'granted' && (
        <div className="space-y-4">
          
          {/* התראה לפני */}
          <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-600">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">⏰ התראה לפני המשימה</p>
                <p className="text-sm text-gray-500">כמה זמן לפני לקבל התראה</p>
              </div>
            </div>
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

          {/* התראה בזמן */}
          <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-600">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">🔔 התראה בזמן המשימה</p>
              <p className="text-sm text-gray-500">קבל התראה כשמגיע הזמן</p>
            </div>
            <button
              onClick={() => handleChange('notifyOnTime', !localSettings.notifyOnTime)}
              className={`relative w-14 h-8 rounded-full transition-colors ${
                localSettings.notifyOnTime ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span 
                className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                  localSettings.notifyOnTime ? 'right-1' : 'left-1'
                }`}
              />
            </button>
          </div>

          {/* תזכורת חוזרת */}
          <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-600">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">🔴 תזכורת חוזרת למשימות באיחור</p>
                <p className="text-sm text-gray-500">כל כמה זמן להזכיר על משימה שלא הושלמה</p>
              </div>
            </div>
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

          {/* צליל */}
          <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-600">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">🔊 צליל התראה</p>
              <p className="text-sm text-gray-500">השמע צליל עם ההתראה</p>
            </div>
            <button
              onClick={() => handleChange('soundEnabled', !localSettings.soundEnabled)}
              className={`relative w-14 h-8 rounded-full transition-colors ${
                localSettings.soundEnabled ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span 
                className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                  localSettings.soundEnabled ? 'right-1' : 'left-1'
                }`}
              />
            </button>
          </div>

          <Button onClick={handleSave} loading={saving} className="w-full">
            💾 שמור הגדרות
          </Button>
        </div>
      )}

      {permission === 'denied' && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-700 dark:text-red-300">
          <p className="font-medium">ההתראות חסומות בדפדפן</p>
          <p className="text-sm mt-1">
            לחצי על 🔒 ליד שורת הכתובת ← אפשרי התראות ← רעננו את הדף
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * הגדרות עבודה
 */
function WorkSettings({ user }) {
  const [workHours, setWorkHours] = useState({
    startHour: 8,
    endHour: 16,
    workDays: [0, 1, 2, 3, 4]
  });
  const [preferences, setPreferences] = useState({
    bufferMinutes: 0,
    preferMorning: true
  });

  useEffect(() => {
    const saved = localStorage.getItem(`work_settings_${user?.id}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.workHours) setWorkHours(parsed.workHours);
        if (parsed.preferences) setPreferences(parsed.preferences);
      } catch (e) {}
    }
  }, [user?.id]);

  const handleSave = () => {
    localStorage.setItem(`work_settings_${user?.id}`, JSON.stringify({ workHours, preferences }));
    toast.success('הגדרות העבודה נשמרו');
  };

  const dayNames = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

  const toggleDay = (day) => {
    setWorkHours(w => ({
      ...w,
      workDays: w.workDays.includes(day) 
        ? w.workDays.filter(d => d !== day)
        : [...w.workDays, day].sort()
    }));
  };

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
              onClick={() => toggleDay(i)}
              className={`w-10 h-10 rounded-full font-medium transition-colors ${
                workHours.workDays.includes(i)
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
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

/**
 * הגדרות סוגי משימות
 */
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

  const deleteCustomType = (id) => {
    const newTypes = customTypes.filter(t => t.id !== id);
    saveCustomTypes(newTypes);
    toast.success('סוג המשימה נמחק');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">סוגי משימות</h2>
        <Button size="sm" onClick={() => setShowAddForm(true)}>
          + הוסף סוג
        </Button>
      </div>

      <div className="grid gap-3">
        {Object.entries(TASK_TYPES).map(([key, type]) => (
          <div 
            key={key}
            className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{type.icon}</span>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">{type.name}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {type.avgDuration} דקות בממוצע
                </p>
              </div>
            </div>
            <span className="text-xs bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded">
              מובנה
            </span>
          </div>
        ))}

        {customTypes.map(type => (
          <div 
            key={type.id}
            className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{type.icon}</span>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">{type.name}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {type.avgDuration} דקות בממוצע
                </p>
              </div>
            </div>
            <button
              onClick={() => deleteCustomType(type.id)}
              className="text-red-500 hover:text-red-700"
            >
              🗑️
            </button>
          </div>
        ))}
      </div>

      <Modal
        isOpen={showAddForm}
        onClose={() => setShowAddForm(false)}
        title="הוסף סוג משימה"
      >
        <TaskTypeForm 
          onSave={(newType) => {
            saveCustomTypes([...customTypes, { ...newType, id: Date.now().toString() }]);
            setShowAddForm(false);
            toast.success('סוג המשימה נוסף');
          }}
          onClose={() => setShowAddForm(false)}
        />
      </Modal>
    </div>
  );
}

function TaskTypeForm({ onSave, onClose, initialData = {} }) {
  const [form, setForm] = useState({
    name: initialData.name || '',
    icon: initialData.icon || '📌',
    avgDuration: initialData.avgDuration || 30
  });

  const icons = ['📌', '📝', '💻', '📞', '📧', '🎯', '📊', '🔧', '📚', '🎨', '🏃', '🧹'];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('יש להזין שם');
      return;
    }
    onSave(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="שם הסוג"
        value={form.name}
        onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
        placeholder="לדוגמה: שיחות לקוחות"
      />

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          אייקון
        </label>
        <div className="flex flex-wrap gap-2">
          {icons.map(icon => (
            <button
              key={icon}
              type="button"
              onClick={() => setForm(f => ({ ...f, icon }))}
              className={`w-10 h-10 rounded-lg text-xl ${
                form.icon === icon 
                  ? 'bg-blue-100 dark:bg-blue-900 border-2 border-blue-500' 
                  : 'bg-gray-100 dark:bg-gray-700'
              }`}
            >
              {icon}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3 pt-4">
        <Button type="submit">שמור</Button>
        <Button type="button" variant="secondary" onClick={onClose}>
          ביטול
        </Button>
      </div>
    </form>
  );
}

function AppearanceSettings({ darkMode, toggleDarkMode }) {
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }
    
    const userAgent = navigator.userAgent || navigator.vendor;
    setIsIOS(/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream);

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        toast.success('✅ האפליקציה הותקנה!');
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else if (isIOS) {
      toast((t) => (
        <div className="text-right">
          <p className="font-bold mb-2">להתקנה ב-iPhone/iPad:</p>
          <p>1. לחצי על כפתור השיתוף ⬆️</p>
          <p>2. בחרי "הוסף למסך הבית"</p>
          <button 
            onClick={() => toast.dismiss(t.id)}
            className="mt-2 px-3 py-1 bg-blue-500 text-white rounded"
          >
            הבנתי
          </button>
        </div>
      ), { duration: 10000 });
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white">הגדרות תצוגה</h2>
      
      <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
        <div>
          <p className="font-medium text-gray-900 dark:text-white">מצב כהה</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">החלף בין ערכת צבעים בהירה לכהה</p>
        </div>
        <button
          onClick={toggleDarkMode}
          className={`relative w-14 h-8 rounded-full transition-colors ${darkMode ? 'bg-blue-600' : 'bg-gray-300'}`}
        >
          <span className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-transform ${darkMode ? 'right-1' : 'left-1'}`} />
        </button>
      </div>

      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl">📱</span>
          <div>
            <p className="font-medium text-gray-900 dark:text-white">התקנת אפליקציה</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isInstalled ? 'האפליקציה מותקנת!' : 'התקן את זמנית על המכשיר שלך'}
            </p>
          </div>
        </div>
        
        {isInstalled ? (
          <div className="text-green-600 dark:text-green-400 flex items-center gap-2">
            <span>✓</span>
            <span>האפליקציה מותקנת</span>
          </div>
        ) : (
          <Button onClick={handleInstall} className="w-full">
            {isIOS ? '📲 איך להתקין?' : '📲 התקן עכשיו'}
          </Button>
        )}
      </div>
    </div>
  );
}

function ProfileSettings({ user, loading, setLoading }) {
  const [fullName, setFullName] = useState(user?.profile?.full_name || '');
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ full_name: fullName })
        .eq('id', user.id);

      if (error) throw error;
      toast.success('הפרופיל נשמר בהצלחה');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      toast.error('שגיאה בשמירת הפרופיל');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white">פרטי פרופיל</h2>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            אימייל
          </label>
          <p className="text-gray-900 dark:text-white">{user?.email}</p>
        </div>

        <Input
          label="שם מלא"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="הזן את שמך המלא"
        />

        <Button onClick={handleSave} loading={loading}>
          {saved ? '✓ נשמר' : 'שמור שינויים'}
        </Button>
      </div>
    </div>
  );
}

function AccountSettings({ user, logout, loading, setLoading }) {
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: ''
  });

  const handleChangePassword = async () => {
    if (passwords.new !== passwords.confirm) {
      toast.error('הסיסמאות אינן תואמות');
      return;
    }
    if (passwords.new.length < 6) {
      toast.error('הסיסמה חייבת להכיל לפחות 6 תווים');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwords.new
      });

      if (error) throw error;
      toast.success('הסיסמה שונתה בהצלחה');
      setShowPasswordForm(false);
      setPasswords({ current: '', new: '', confirm: '' });
    } catch (err) {
      toast.error('שגיאה בשינוי הסיסמה');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('התנתקת בהצלחה');
    } catch (err) {
      toast.error('שגיאה בהתנתקות');
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white">הגדרות חשבון</h2>
      
      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="font-medium text-gray-900 dark:text-white">סיסמה</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">שנה את הסיסמה שלך</p>
          </div>
          <Button 
            variant="secondary"
            onClick={() => setShowPasswordForm(!showPasswordForm)}
          >
            שנה סיסמה
          </Button>
        </div>

        {showPasswordForm && (
          <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Input
              type="password"
              label="סיסמה חדשה"
              value={passwords.new}
              onChange={(e) => setPasswords(p => ({ ...p, new: e.target.value }))}
              placeholder="הזן סיסמה חדשה"
            />
            <Input
              type="password"
              label="אימות סיסמה"
              value={passwords.confirm}
              onChange={(e) => setPasswords(p => ({ ...p, confirm: e.target.value }))}
              placeholder="הזן שוב את הסיסמה"
            />
            <Button onClick={handleChangePassword} loading={loading}>
              שמור סיסמה חדשה
            </Button>
          </div>
        )}
      </div>

      <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
        <Button variant="danger" onClick={handleLogout}>
          צא מהמערכת
        </Button>
      </div>
    </div>
  );
}

export default Settings;
