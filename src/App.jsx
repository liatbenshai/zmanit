import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { Toaster } from 'react-hot-toast';

// דפים - טעינה עצלה (lazy loading) לשיפור ביצועים
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const DailyViewPage = lazy(() => import('./pages/DailyViewPage'));
const WeeklyViewPage = lazy(() => import('./pages/WeeklyViewPage'));
const TaskInsights = lazy(() => import('./pages/TaskInsights'));
const Settings = lazy(() => import('./pages/Settings'));
const FocusedDashboard = lazy(() => import('./components/DailyView/FocusedDashboard'));

// רכיבים
import ProtectedRoute from './components/Auth/ProtectedRoute';
import Header from './components/Layout/Header';
import MobileNav from './components/Layout/MobileNav';
import InstallPrompt from './components/PWA/InstallPrompt';
import UrgentTaskButton from './components/Productivity/UrgentTaskButton';
import EndOfDayPopup from './components/Productivity/EndOfDayPopup';
import EndOfDaySummary from './components/Learning/EndOfDaySummary';
import { useTasks } from './hooks/useTasks';

// 🎯 מיקוד אוטומטי - נפתח כשמגיע זמן משימה
import { AutoFocusManager } from './components/ADHD';

/**
 * רכיב טעינה לדפים (Lazy Loading)
 */
function PageLoader() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent mx-auto mb-3"></div>
        <p className="text-gray-500 dark:text-gray-400 text-sm">טוען...</p>
      </div>
    </div>
  );
}

/**
 * ✅ Wrapper לסיכום יומי
 */
function EndOfDaySummaryWrapper() {
  const { tasks } = useTasks();
  return <EndOfDaySummary tasks={tasks} workEndHour={16} />;
}

function App() {
  const { user, loading } = useAuth();


  // מסך טעינה
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      {/* הודעות Toast */}
      <Toaster 
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            direction: 'rtl',
            fontFamily: 'Arial, sans-serif'
          }
        }}
      />

      {/* הודעת התקנת PWA */}
      <InstallPrompt />

      {/* כפתור עבודה דחופה */}
      {user && <UrgentTaskButton />}

      {/* סיכום יומי */}
      {user && <EndOfDayPopup />}

      {/* ✅ סיכום יומי אוטומטי בסוף היום */}
      {user && <EndOfDaySummaryWrapper />}
      
      {/* 🎯 מיקוד אוטומטי - זה מה שעובד מעולה! */}
      {user && <AutoFocusManager />}

      {/* כותרת עליונה */}
      {user && <Header />}

      {/* תוכן עם padding לניווט תחתון בנייד */}
      <main className={user ? 'pb-20 md:pb-0' : ''}>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* דף בית - מפנה לדשבורד */}
            <Route path="/" element={user ? <Navigate to="/dashboard" /> : <Navigate to="/login" />} />
            
            {/* התחברות והרשמה */}
            <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login />} />
            <Route path="/register" element={user ? <Navigate to="/dashboard" /> : <Register />} />
            
            {/* ===== 5 העמודים הראשיים ===== */}
            
            {/* 1. דשבורד - עמוד הבית */}
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />

            {/* 2. תצוגה יומית */}
            <Route path="/daily" element={
              <ProtectedRoute>
                <DailyViewPage />
              </ProtectedRoute>
            } />

            {/* 3. תצוגה שבועית */}
            <Route path="/weekly" element={
              <ProtectedRoute>
                <WeeklyViewPage />
              </ProtectedRoute>
            } />
            
            {/* 4. תובנות ולמידה */}
            <Route path="/insights" element={
              <ProtectedRoute>
                <TaskInsights />
              </ProtectedRoute>
            } />

            {/* 5. הגדרות */}
            <Route path="/settings" element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            } />

            {/* 6. תצוגה ממוקדת */}
            <Route path="/focus" element={
              <ProtectedRoute>
                <FocusedDashboard />
              </ProtectedRoute>
            } />

            {/* דף 404 - מפנה לדשבורד */}
            <Route path="*" element={<Navigate to="/dashboard" />} />
          </Routes>
        </Suspense>
      </main>

      {/* ניווט תחתון בנייד */}
      {user && <MobileNav />}
    </div>
  );
}

export default App;
