import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTasks } from '../../hooks/useTasks';
import { useAuth } from '../../hooks/useAuth';
import { TASK_TYPES } from '../../config/taskTypes';
import toast from 'react-hot-toast';

/**
 * כפתור "עבודה דחופה נכנסה"
 * 
 * לחיצה אחת שעושה:
 * 1. עוצרת את הטיימר הנוכחי
 * 2. מבקשת פרטי העבודה הדחופה
 * 3. מוסיפה את המשימה עם דחיפות גבוהה
 * 4. מזיזה משימות לא-קריטיות (קורס, אדמין)
 * 5. מתריעה אם משהו לא יכנס
 */

// סוגי משימות שאפשר לדחות אוטומטית
const DEFERABLE_TASK_TYPES = ['course', 'admin', 'email', 'management'];

// סוגי משימות קריטיות (לקוח)
const CRITICAL_TASK_TYPES = ['transcription', 'proofreading', 'translation'];

function UrgentTaskButton() {
  const { user } = useAuth();
  const { tasks, addTask, editTask } = useTasks();
  
  const [showModal, setShowModal] = useState(false);
  const [step, setStep] = useState(1); // 1=פרטים, 2=אישור דחיות
  const [formData, setFormData] = useState({
    title: '',
    taskType: 'transcription',
    estimatedDuration: 60,
    dueDate: new Date().toISOString().split('T')[0],
    dueTime: ''
  });
  const [deferredTasks, setDeferredTasks] = useState([]);
  const [warnings, setWarnings] = useState([]);

  // פתיחת המודל
  const handleOpen = useCallback(() => {
    // עצירת טיימר פעיל
    stopActiveTimer();
    
    // איפוס
    setFormData({
      title: '',
      taskType: 'transcription',
      estimatedDuration: 60,
      dueDate: new Date().toISOString().split('T')[0],
      dueTime: ''
    });
    setStep(1);
    setDeferredTasks([]);
    setWarnings([]);
    setShowModal(true);
  }, []);

  // עצירת טיימר פעיל
  const stopActiveTimer = () => {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('timer_v2_')) {
        try {
          const data = JSON.parse(localStorage.getItem(key));
          if (data?.isRunning) {
            // שמירת ההתקדמות ועצירה
            data.isRunning = false;
            data.pausedAt = new Date().toISOString();
            localStorage.setItem(key, JSON.stringify(data));
            toast('⏸️ הטיימר הופסק', { duration: 2000 });
          }
        } catch (e) {}
      }
    }
  };

  // חישוב מה צריך לדחות
  const calculateDeferrals = useCallback(() => {
    const today = new Date().toISOString().split('T')[0];
    const urgentDuration = formData.estimatedDuration;
    
    // משימות להיום שאפשר לדחות
    const todayTasks = tasks.filter(t => 
      t.due_date === today && 
      !t.is_completed &&
      DEFERABLE_TASK_TYPES.includes(t.task_type)
    );

    // משימות קריטיות להיום
    const criticalToday = tasks.filter(t =>
      t.due_date === today &&
      !t.is_completed &&
      CRITICAL_TASK_TYPES.includes(t.task_type)
    );

    // חישוב זמן פנוי (נניח 8 שעות עבודה)
    const totalWorkMinutes = 8 * 60;
    const criticalMinutes = criticalToday.reduce((sum, t) => sum + (t.estimated_duration || 30), 0);
    const availableMinutes = totalWorkMinutes - criticalMinutes - urgentDuration;

    const toDefer = [];
    const newWarnings = [];
    let minutesToFree = 0;

    // אם אין מספיק זמן, צריך לדחות
    if (availableMinutes < 0) {
      minutesToFree = Math.abs(availableMinutes);
      
      // דחיית משימות לפי סדר עדיפות (קורס ראשון, אח"כ אדמין)
      const sortedDeferable = [...todayTasks].sort((a, b) => {
        const priority = { course: 0, admin: 1, email: 2, management: 3 };
        return (priority[a.task_type] || 99) - (priority[b.task_type] || 99);
      });

      for (const task of sortedDeferable) {
        if (minutesToFree <= 0) break;
        toDefer.push(task);
        minutesToFree -= (task.estimated_duration || 30);
      }

      // אם עדיין לא מספיק
      if (minutesToFree > 0) {
        newWarnings.push({
          type: 'not_enough_time',
          message: `עדיין חסרות ${minutesToFree} דקות גם אחרי דחיית כל מה שאפשר`
        });
      }
    }

    setDeferredTasks(toDefer);
    setWarnings(newWarnings);
    return { toDefer, warnings: newWarnings };
  }, [formData.estimatedDuration, tasks]);

  // מעבר לשלב 2
  const handleNext = useCallback(() => {
    if (!formData.title.trim()) {
      toast.error('נא להזין שם משימה');
      return;
    }
    calculateDeferrals();
    setStep(2);
  }, [formData.title, calculateDeferrals]);

  // שמירה סופית
  const handleSave = useCallback(async () => {
    try {
      // 1. דחיית משימות למחר
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowISO = tomorrow.toISOString().split('T')[0];

      for (const task of deferredTasks) {
        await editTask(task.id, {
          ...task,
          dueDate: tomorrowISO,
          title: task.title,
          estimatedDuration: task.estimated_duration,
          taskType: task.task_type
        });
      }

      // 2. הוספת המשימה הדחופה
      await addTask({
        title: formData.title,
        taskType: formData.taskType,
        estimatedDuration: formData.estimatedDuration,
        dueDate: formData.dueDate,
        dueTime: formData.dueTime || '08:00',
        priority: 'urgent'
      });

      // הודעות
      if (deferredTasks.length > 0) {
        toast.success(`✅ נוסף! ${deferredTasks.length} משימות נדחו למחר`);
      } else {
        toast.success('✅ המשימה הדחופה נוספה!');
      }

      setShowModal(false);
    } catch (err) {
      console.error('Error saving urgent task:', err);
      toast.error('שגיאה בשמירה');
    }
  }, [formData, deferredTasks, addTask, editTask]);

  if (!user) return null;

  return (
    <>
      {/* כפתור צף */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleOpen}
        className="fixed bottom-24 left-4 md:bottom-8 z-40
                   w-14 h-14 rounded-full bg-red-500 hover:bg-red-600
                   text-white shadow-lg flex items-center justify-center
                   text-2xl"
        title="עבודה דחופה נכנסה"
      >
        🚨
      </motion.button>

      {/* מודל */}
      <AnimatePresence>
        {showModal && (
          <>
            {/* רקע */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50"
              onClick={() => setShowModal(false)}
            />

            {/* תוכן */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50
                         w-[95%] max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-2xl
                         max-h-[90vh] overflow-auto"
            >
              {/* כותרת */}
              <div className="bg-gradient-to-l from-red-500 to-orange-500 p-4 text-white">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <span>🚨</span>
                  עבודה דחופה נכנסה
                </h2>
                <p className="text-red-100 text-sm mt-1">
                  {step === 1 ? 'פרטי העבודה' : 'אישור שינויים'}
                </p>
              </div>

              {/* שלב 1: פרטים */}
              {step === 1 && (
                <div className="p-4 space-y-4">
                  {/* שם המשימה */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      שם העבודה
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={e => setFormData(f => ({ ...f, title: e.target.value }))}
                      placeholder="לדוגמה: תמלול דחוף - לקוח חדש"
                      className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg
                                 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      autoFocus
                    />
                  </div>

                  {/* סוג משימה */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      סוג
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {CRITICAL_TASK_TYPES.map(type => {
                        const taskType = TASK_TYPES[type];
                        if (!taskType) return null;
                        return (
                          <button
                            key={type}
                            onClick={() => setFormData(f => ({ ...f, taskType: type }))}
                            className={`p-2 rounded-lg border-2 transition-all ${
                              formData.taskType === type
                                ? 'border-red-500 bg-red-50 dark:bg-red-900/30'
                                : 'border-gray-200 dark:border-gray-600'
                            }`}
                          >
                            <div className="text-xl">{taskType.icon}</div>
                            <div className="text-xs mt-1">{taskType.name}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* זמן משוער */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      זמן משוער
                    </label>
                    <div className="flex gap-2">
                      {[30, 60, 90, 120, 180].map(mins => (
                        <button
                          key={mins}
                          onClick={() => setFormData(f => ({ ...f, estimatedDuration: mins }))}
                          className={`flex-1 p-2 rounded-lg border-2 text-sm transition-all ${
                            formData.estimatedDuration === mins
                              ? 'border-red-500 bg-red-50 dark:bg-red-900/30'
                              : 'border-gray-200 dark:border-gray-600'
                          }`}
                        >
                          {mins < 60 ? `${mins}ד'` : `${mins/60}ש'`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* דדליין */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      דדליין
                    </label>
                    <input
                      type="date"
                      value={formData.dueDate}
                      onChange={e => setFormData(f => ({ ...f, dueDate: e.target.value }))}
                      className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg
                                 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  {/* כפתורים */}
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setShowModal(false)}
                      className="flex-1 p-3 rounded-lg border border-gray-300 text-gray-700 dark:text-gray-300"
                    >
                      ביטול
                    </button>
                    <button
                      onClick={handleNext}
                      className="flex-1 p-3 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium"
                    >
                      המשך ←
                    </button>
                  </div>
                </div>
              )}

              {/* שלב 2: אישור */}
              {step === 2 && (
                <div className="p-4 space-y-4">
                  {/* סיכום המשימה */}
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                    <div className="font-medium text-red-800 dark:text-red-200">
                      {TASK_TYPES[formData.taskType]?.icon} {formData.title}
                    </div>
                    <div className="text-sm text-red-600 dark:text-red-300 mt-1">
                      {formData.estimatedDuration} דקות • דדליין: {formData.dueDate}
                    </div>
                  </div>

                  {/* משימות שיידחו */}
                  {deferredTasks.length > 0 && (
                    <div>
                      <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                        <span>📅</span>
                        משימות שיידחו למחר:
                      </h3>
                      <div className="space-y-2">
                        {deferredTasks.map(task => (
                          <div 
                            key={task.id}
                            className="p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg
                                       flex items-center justify-between"
                          >
                            <span className="text-sm">
                              {TASK_TYPES[task.task_type]?.icon} {task.title}
                            </span>
                            <span className="text-xs text-gray-500">
                              {task.estimated_duration} דק'
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {deferredTasks.length === 0 && (
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-green-700 dark:text-green-300">
                      ✅ יש מספיק זמן! לא צריך לדחות משימות
                    </div>
                  )}

                  {/* אזהרות */}
                  {warnings.map((warning, idx) => (
                    <div 
                      key={idx}
                      className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg
                                 text-orange-700 dark:text-orange-300"
                    >
                      ⚠️ {warning.message}
                    </div>
                  ))}

                  {/* כפתורים */}
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setStep(1)}
                      className="flex-1 p-3 rounded-lg border border-gray-300 text-gray-700 dark:text-gray-300"
                    >
                      ← חזרה
                    </button>
                    <button
                      onClick={handleSave}
                      className="flex-1 p-3 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium"
                    >
                      🚀 הוסף והתחל!
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

export default UrgentTaskButton;
