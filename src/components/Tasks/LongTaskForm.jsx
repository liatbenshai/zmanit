import { useState, useEffect, useMemo } from 'react';
import { useTasks } from '../../hooks/useTasks';
import { 
  scheduleLongTask, 
  getScheduleSummary,
  checkScheduleFeasibility,
  findAllFreeSlots
} from '../../utils/autoScheduler';
import { TASK_TYPES } from '../../config/taskTypes';
import { getTodayISO } from '../../utils/dateTimeHelpers';
import toast from 'react-hot-toast';
import Input from '../UI/Input';
import Button from '../UI/Button';

/**
 * טופס משימה ארוכה עם שיבוץ אוטומטי
 */
function LongTaskForm({ onClose }) {
  const { tasks, addTask, editTask, loadTasks } = useTasks();
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    taskType: 'transcription',
    isUrgent: false,
    totalHours: '',
    totalMinutes: '',
    startDate: getTodayISO(),
    endDate: '',
    maxSessionMinutes: 45
  });

  const [preview, setPreview] = useState(null);
  const [editedSessions, setEditedSessions] = useState(null);
  const [displacedTasks, setDisplacedTasks] = useState([]); // משימות שיוזזו
  const [feasibility, setFeasibility] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [editMode, setEditMode] = useState(false);

  // חישוב זמן כולל בדקות
  const totalDuration = useMemo(() => {
    const hours = parseInt(formData.totalHours) || 0;
    const minutes = parseInt(formData.totalMinutes) || 0;
    return hours * 60 + minutes;
  }, [formData.totalHours, formData.totalMinutes]);

  // בדיקת התכנות כשמשתנים הנתונים
  useEffect(() => {
    if (totalDuration > 0 && formData.startDate && formData.endDate) {
      const check = checkScheduleFeasibility(
        totalDuration,
        formData.startDate,
        formData.endDate,
        tasks
      );
      setFeasibility(check);
    } else {
      setFeasibility(null);
    }
  }, [totalDuration, formData.startDate, formData.endDate, tasks]);

  // תצוגה מקדימה של השיבוץ
  useEffect(() => {
    if (totalDuration > 0 && formData.startDate && formData.endDate && formData.title) {
      // אם דחוף - נחשב אילו משימות צריך להזיז
      let availableTasks = tasks;
      let tasksToDisplace = [];
      
      if (formData.isUrgent) {
        // מצא משימות שפחות דחופות שאפשר להזיז
        const today = getTodayISO();
        const nonUrgentTasks = tasks.filter(t => 
          !t.is_completed && 
          t.due_date >= today &&
          t.due_date <= formData.endDate &&
          t.quadrant > 1 // לא דחוף וחשוב
        );
        
        // סימולציה - נניח שנצטרך להזיז משימות
        // בפועל זה יחושב לפי החלונות הפנויים
        tasksToDisplace = nonUrgentTasks.slice(0, 3); // לדוגמה
        setDisplacedTasks(tasksToDisplace);
      } else {
        setDisplacedTasks([]);
      }
      
      const result = scheduleLongTask({
        title: formData.title,
        totalDuration,
        startDate: formData.startDate,
        endDate: formData.endDate,
        maxSessionMinutes: parseInt(formData.maxSessionMinutes) || 45,
        taskType: formData.taskType,
        isUrgent: formData.isUrgent
      }, tasks);
      
      setPreview(result);
      setEditedSessions(null);
      setEditMode(false);
    } else {
      setPreview(null);
      setEditedSessions(null);
      setDisplacedTasks([]);
    }
  }, [totalDuration, formData.startDate, formData.endDate, formData.title, formData.maxSessionMinutes, formData.taskType, formData.isUrgent, tasks]);

  // החלפה בין תצוגה מקורית וערוכה
  const displaySessions = editedSessions || preview?.sessions || [];

  // טיפול בשינוי שדה
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  // עריכת אינטרוול בודד
  const handleEditSession = (index, field, value) => {
    const sessions = editedSessions || [...preview.sessions];
    sessions[index] = { ...sessions[index], [field]: value };
    setEditedSessions(sessions);
  };

  // מחיקת אינטרוול
  const handleDeleteSession = (index) => {
    const sessions = editedSessions || [...preview.sessions];
    sessions.splice(index, 1);
    // עדכון מספרי החלקים - רק אם אין כבר מספור
    sessions.forEach((s, i) => {
      if (!formData.title.includes('/') && !formData.title.includes('חלק')) {
        s.title = `${formData.title} (${i + 1}/${sessions.length})`;
      }
    });
    setEditedSessions(sessions);
  };

  // הוספת אינטרוול חדש
  const handleAddSession = () => {
    const sessions = editedSessions || [...preview.sessions];
    const lastSession = sessions[sessions.length - 1];
    const titleForNew = (!formData.title.includes('/') && !formData.title.includes('חלק'))
      ? `${formData.title} (${sessions.length + 1}/${sessions.length + 1})`
      : formData.title;
    const newSession = {
      title: titleForNew,
      dueDate: lastSession?.dueDate || formData.startDate,
      dueTime: '09:00',
      estimatedDuration: parseInt(formData.maxSessionMinutes) || 45,
      description: ''
    };
    sessions.push(newSession);
    // עדכון מספרי החלקים - רק אם אין כבר מספור
    sessions.forEach((s, i) => {
      if (!formData.title.includes('/') && !formData.title.includes('חלק')) {
        s.title = `${formData.title} (${i + 1}/${sessions.length})`;
      }
    });
    setEditedSessions(sessions);
  };

  // איפוס לשיבוץ המקורי
  const handleResetSchedule = () => {
    setEditedSessions(null);
    setEditMode(false);
  };

  // שליחת הטופס
  const handleSubmit = async (e) => {
    e.preventDefault();

    // אימות
    if (!formData.title.trim()) {
      setErrors({ title: 'נא להזין כותרת' });
      return;
    }

    if (totalDuration < 30) {
      setErrors({ totalHours: 'משימה חייבת להיות לפחות 30 דקות' });
      return;
    }

    if (!formData.startDate || !formData.endDate) {
      setErrors({ endDate: 'נא לבחור תאריכי התחלה ויעד' });
      return;
    }

    if (new Date(formData.endDate) <= new Date(formData.startDate)) {
      setErrors({ endDate: 'תאריך היעד חייב להיות אחרי ההתחלה' });
      return;
    }

    const sessionsToCreate = editedSessions || preview?.sessions;
    if (!sessionsToCreate || sessionsToCreate.length === 0) {
      toast.error('אין משימות לשיבוץ');
      return;
    }

    setLoading(true);
    try {
      // אם דחוף - קודם נזיז משימות אחרות
      if (formData.isUrgent && displacedTasks.length > 0) {
        for (const task of displacedTasks) {
          // הזז כל משימה יום קדימה
          const currentDate = new Date(task.due_date);
          currentDate.setDate(currentDate.getDate() + 1);
          // דלג על סופ"ש
          while (currentDate.getDay() === 5 || currentDate.getDay() === 6) {
            currentDate.setDate(currentDate.getDate() + 1);
          }
          const newDate = currentDate.toISOString().split('T')[0];
          
          await editTask(task.id, { dueDate: newDate });
        }
      }

      // יצירת כל החלקים כמשימות נפרדות
      for (const session of sessionsToCreate) {
        await addTask({
          title: session.title,
          description: session.description || formData.description,
          quadrant: formData.isUrgent ? 1 : 2, // דחוף = רבעון 1, לא דחוף = רבעון 2
          dueDate: session.dueDate,
          dueTime: session.dueTime,
          estimatedDuration: session.estimatedDuration,
          taskType: formData.taskType,
          parentTaskTitle: formData.title
        });
      }

      await loadTasks();
      
      let message = `נוצרו ${sessionsToCreate.length} משימות בהצלחה!`;
      if (formData.isUrgent && displacedTasks.length > 0) {
        message += ` (${displacedTasks.length} משימות הוזזו)`;
      }
      toast.success(message);
      onClose();
    } catch (err) {
      console.error('שגיאה ביצירת משימות:', err);
      toast.error('שגיאה ביצירת המשימות');
    } finally {
      setLoading(false);
    }
  };

  // פורמט זמן פנוי
  const formatFreeTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins} דקות`;
    if (mins === 0) return `${hours} שעות`;
    return `${hours} שעות ו-${mins} דקות`;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* כותרת */}
      <Input
        label="שם המשימה"
        name="title"
        value={formData.title}
        onChange={handleChange}
        error={errors.title}
        placeholder="לדוגמה: תמלול ישיבת הנהלה"
        required
        autoFocus
      />

      {/* סוג משימה */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          סוג המשימה
        </label>
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(TASK_TYPES).slice(0, 6).map(([key, type]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, taskType: key }))}
              className={`
                p-2 rounded-lg border text-sm transition-all
                ${formData.taskType === key
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }
              `}
            >
              <span className="text-lg">{type.icon}</span>
              <div className="text-xs mt-1">{type.name}</div>
            </button>
          ))}
        </div>
      </div>

      {/* האם דחוף? */}
      <div 
        onClick={() => setFormData(prev => ({ ...prev, isUrgent: !prev.isUrgent }))}
        className={`
          p-4 rounded-lg border-2 cursor-pointer transition-all
          ${formData.isUrgent 
            ? 'border-red-500 bg-red-50 dark:bg-red-900/20' 
            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
          }
        `}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{formData.isUrgent ? '🔴' : '⚪'}</span>
            <div>
              <div className="font-medium text-gray-900 dark:text-white">
                משימה דחופה
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {formData.isUrgent 
                  ? 'המערכת תזיז משימות אחרות כדי לפנות מקום' 
                  : 'תשובץ בחלונות פנויים בלבד'
                }
              </div>
            </div>
          </div>
          <div className={`
            w-12 h-6 rounded-full transition-all relative
            ${formData.isUrgent ? 'bg-red-500' : 'bg-gray-300 dark:bg-gray-600'}
          `}>
            <div className={`
              absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow
              ${formData.isUrgent ? 'right-1' : 'left-1'}
            `} />
          </div>
        </div>
        
        {/* אזהרה על משימות שיוזזו */}
        {formData.isUrgent && displacedTasks.length > 0 && (
          <div className="mt-3 p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded text-xs text-yellow-800 dark:text-yellow-200">
            <div className="font-medium mb-1">⚠️ משימות שיוזזו:</div>
            {displacedTasks.slice(0, 3).map((task, i) => (
              <div key={i} className="flex items-center gap-1">
                <span>•</span>
                <span className="truncate">{task.title}</span>
              </div>
            ))}
            {displacedTasks.length > 3 && (
              <div className="text-gray-500">ועוד {displacedTasks.length - 3}...</div>
            )}
          </div>
        )}
      </div>

      {/* זמן כולל */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          זמן עבודה כולל
        </label>
        <div className="flex gap-3">
          <div className="flex-1">
            <div className="relative">
              <input
                type="number"
                name="totalHours"
                value={formData.totalHours}
                onChange={handleChange}
                min="0"
                max="100"
                className="input-field pl-16"
                placeholder="0"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                שעות
              </span>
            </div>
          </div>
          <div className="flex-1">
            <div className="relative">
              <input
                type="number"
                name="totalMinutes"
                value={formData.totalMinutes}
                onChange={handleChange}
                min="0"
                max="59"
                className="input-field pl-16"
                placeholder="0"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                דקות
              </span>
            </div>
          </div>
        </div>
        {errors.totalHours && (
          <p className="text-red-500 text-sm mt-1">{errors.totalHours}</p>
        )}
        {totalDuration > 0 && (
          <p className="text-sm text-gray-500 mt-1">
            סה"כ: {formatFreeTime(totalDuration)}
          </p>
        )}
      </div>

      {/* תאריכים */}
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="תאריך התחלה"
          type="date"
          name="startDate"
          value={formData.startDate}
          onChange={handleChange}
          min={getTodayISO()}
          required
        />
        <Input
          label="דדליין"
          type="date"
          name="endDate"
          value={formData.endDate}
          onChange={handleChange}
          error={errors.endDate}
          min={formData.startDate || getTodayISO()}
          required
        />
      </div>

      {/* הגדרות מתקדמות */}
      <details className="text-sm">
        <summary className="cursor-pointer text-gray-600 dark:text-gray-400 hover:text-gray-800">
          הגדרות מתקדמות
        </summary>
        <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              אורך מקסימלי לחלון עבודה (דקות)
            </label>
            <select
              name="maxSessionMinutes"
              value={formData.maxSessionMinutes}
              onChange={handleChange}
              className="input-field"
            >
              <option value="45">45 דקות (מומלץ)</option>
              <option value="60">שעה</option>
              <option value="90">שעה וחצי</option>
              <option value="30">30 דקות</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              המערכת תחלק את המשימה לחלקים בגודל הזה
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              תיאור (אופציונלי)
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={2}
              className="input-field resize-none"
              placeholder="פרטים נוספים..."
            />
          </div>
        </div>
      </details>

      {/* בדיקת התכנות */}
      {feasibility && (
        <div className={`p-3 rounded-lg border ${
          feasibility.feasible 
            ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
            : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
        }`}>
          <div className="flex items-center gap-2">
            <span className="text-xl">{feasibility.feasible ? '✅' : '⚠️'}</span>
            <span className={`text-sm font-medium ${
              feasibility.feasible ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
            }`}>
              {feasibility.message}
            </span>
          </div>
          {feasibility.feasible && (
            <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
              ניצולת: {feasibility.utilizationPercent}% מהזמן הפנוי
            </div>
          )}
        </div>
      )}

      {/* תצוגה מקדימה */}
      {preview?.success && displaySessions.length > 0 && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="bg-gray-50 dark:bg-gray-800 px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              📅 שיבוץ - {displaySessions.length} חלקים
            </h4>
            <div className="flex gap-2">
              {editMode ? (
                <>
                  <button
                    type="button"
                    onClick={handleAddSession}
                    className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1"
                  >
                    <span>➕</span> הוסף חלק
                  </button>
                  <button
                    type="button"
                    onClick={handleResetSchedule}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    🔄 איפוס
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditMode(true)}
                  className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <span>✏️</span> ערוך שיבוץ
                </button>
              )}
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {displaySessions.map((session, index) => {
              const taskType = TASK_TYPES[formData.taskType] || TASK_TYPES.other;
              return (
                <div 
                  key={index}
                  className="px-3 py-2 border-b border-gray-100 dark:border-gray-800 last:border-0"
                >
                  {editMode ? (
                    // מצב עריכה
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded text-xs ${taskType.color}`}>
                          {taskType.icon} {index + 1}/{displaySessions.length}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteSession(index)}
                          className="text-red-500 hover:text-red-700 text-xs mr-auto"
                        >
                          🗑️
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="date"
                          value={session.dueDate}
                          onChange={(e) => handleEditSession(index, 'dueDate', e.target.value)}
                          min={formData.startDate}
                          max={formData.endDate}
                          className="input-field text-xs py-1"
                        />
                        <input
                          type="time"
                          value={session.dueTime}
                          onChange={(e) => handleEditSession(index, 'dueTime', e.target.value)}
                          className="input-field text-xs py-1"
                        />
                        <div className="relative">
                          <input
                            type="number"
                            value={session.estimatedDuration}
                            onChange={(e) => handleEditSession(index, 'estimatedDuration', parseInt(e.target.value) || 45)}
                            min="15"
                            max="180"
                            className="input-field text-xs py-1 pl-10"
                          />
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">דק'</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // מצב תצוגה
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded text-xs ${taskType.color}`}>
                        {taskType.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {session.title}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(session.dueDate).toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'short' })}
                          {' • '}
                          {session.dueTime}
                          {' • '}
                          {session.estimatedDuration} דקות
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {editedSessions && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 px-3 py-2 text-xs text-yellow-700 dark:text-yellow-300">
              ⚠️ השיבוץ שונה ידנית
            </div>
          )}
        </div>
      )}

      {/* כפתורים */}
      <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <Button 
          type="submit" 
          loading={loading} 
          disabled={displaySessions.length === 0}
          fullWidth
        >
          {displaySessions.length > 0 
            ? `צור ${displaySessions.length} משימות` 
            : 'שבץ אוטומטית'}
        </Button>
        <Button type="button" variant="secondary" onClick={onClose}>
          ביטול
        </Button>
      </div>
    </form>
  );
}

export default LongTaskForm;
