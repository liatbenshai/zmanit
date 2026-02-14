import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useTasks } from '../../hooks/useTasks';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

/**
 * כותרת עליונה
 */
function Header() {
  const { user, logout, isAdmin } = useAuth();
  const { forceRefresh, dataVersion, lastUpdated, loading } = useTasks();
  const location = useLocation();
  const [darkMode, setDarkMode] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // בדיקת מצב כהה בעליה
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
      document.documentElement.classList.add('dark');
      setDarkMode(true);
    }
  }, []);

  // החלפת מצב כהה/בהיר
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

  // התנתקות
  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error('שגיאה בהתנתקות:', err);
    }
  };

  // ✅ סנכרון ידני
  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await forceRefresh();
      toast.success('🔄 הנתונים עודכנו!');
    } catch (err) {
      toast.error('שגיאה בסנכרון');
    } finally {
      setTimeout(() => setIsSyncing(false), 500);
    }
  };

  // קישורי ניווט - 5 עמודים
  const navLinks = [
    { path: '/dashboard', label: 'דשבורד', icon: '🏠' },
    { path: '/daily', label: 'יומי', icon: '📅' },
    { path: '/weekly', label: 'שבועי', icon: '📆' },
    { path: '/insights', label: 'תובנות', icon: '💡' },
    { path: '/settings', label: 'הגדרות', icon: '⚙️' }
  ];

  return (
    <header className="sticky top-0 z-30 glass">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* לוגו */}
          <Link to="/dashboard" className="flex items-center gap-2 group">
            <span className="text-2xl group-hover:scale-110 transition-transform">⏰</span>
            <span className="font-bold text-lg text-gradient hidden sm:block">
              זמנית
            </span>
          </Link>

          {/* ניווט - דסקטופ */}
          <nav className="hidden md:flex items-center gap-1 bg-gray-100/60 dark:bg-gray-800/60 rounded-xl p-1">
            {navLinks.map(link => {
              const isActive = location.pathname === link.path;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`relative flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-all duration-200 text-sm font-medium ${
                    isActive
                      ? 'text-blue-700 dark:text-blue-300'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="headerActiveTab"
                      className="absolute inset-0 bg-white dark:bg-gray-700 rounded-lg shadow-sm"
                      transition={{ type: 'spring', duration: 0.35, bounce: 0.15 }}
                    />
                  )}
                  <span className="relative z-10">{link.icon}</span>
                  <span className="relative z-10">{link.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* פעולות */}
          <div className="flex items-center gap-1.5">
            {/* ✅ כפתור סנכרון */}
            <button
              onClick={handleSync}
              disabled={isSyncing || loading}
              className={`p-2 rounded-xl transition-all duration-200 ${
                isSyncing || loading
                  ? 'text-blue-500 animate-spin'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
              aria-label="סנכרון נתונים"
              title={`גרסה ${dataVersion} | עדכון אחרון: ${new Date(lastUpdated).toLocaleTimeString('he-IL')}`}
            >
              🔄
            </button>

            {/* כפתור מצב כהה */}
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200 transition-all duration-200"
              aria-label={darkMode ? 'מצב בהיר' : 'מצב כהה'}
            >
              {darkMode ? '☀️' : '🌙'}
            </button>

            {/* תפריט משתמש */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-medium text-sm shadow-sm">
                  {user?.profile?.full_name?.charAt(0) || user?.email?.charAt(0) || '?'}
                </div>
                <span className="hidden sm:block text-gray-700 dark:text-gray-300 text-sm font-medium">
                  {user?.profile?.full_name || 'משתמש'}
                </span>
              </button>

              {/* תפריט נפתח */}
              {showUserMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowUserMenu(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    className="absolute left-0 mt-2 w-52 bg-white dark:bg-gray-800 rounded-2xl shadow-elevated border border-gray-100 dark:border-gray-700 z-20 overflow-hidden"
                  >
                    <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                      <p className="font-semibold text-gray-900 dark:text-white text-sm">
                        {user?.profile?.full_name || 'משתמש'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                        {user?.email}
                      </p>
                    </div>

                    {/* קישורים בנייד */}
                    <div className="md:hidden py-1">
                      {navLinks.map(link => (
                        <Link
                          key={link.path}
                          to={link.path}
                          onClick={() => setShowUserMenu(false)}
                          className={`flex items-center gap-2.5 px-4 py-2.5 transition-colors ${
                            location.pathname === link.path
                              ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                          }`}
                        >
                          <span>{link.icon}</span>
                          <span className="text-sm font-medium">{link.label}</span>
                        </Link>
                      ))}
                    </div>

                    <div className="py-1">
                      <Link
                        to="/settings"
                        onClick={() => setShowUserMenu(false)}
                        className="hidden md:flex items-center gap-2.5 px-4 py-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        <span>⚙️</span>
                        <span className="text-sm font-medium">הגדרות</span>
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <span>🚪</span>
                        <span className="text-sm font-medium">צא מהמערכת</span>
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
