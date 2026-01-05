import { useState, useEffect, useMemo } from 'react';
import { useTasks } from '../../hooks/useTasks';
import { 
  TASK_TYPES, 
  TASK_CATEGORIES,
  getTaskType, 
  getTaskTypesByCategory,
  calculateWorkTime,
  getInputLabel,
  getInputPlaceholder 
} from '../../config/taskTypes';
import toast from 'react-hot-toast';
import Input from '../UI/Input';
import Button from '../UI/Button';
import { getSuggestedEstimate } from '../../utils/taskLearning';

/**
 * ✅ תיקון: קבלת תאריך בפורמט ISO מקומי (לא UTC!)
 */
function getLocalDateISO(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * שעות עבודה ובית
 */
const SCHEDULE_HOURS = {
  work: { start: 8.5 * 60, end: 16 * 60 },    // 08:30-16:00 בדקות
  home: { start: 16.5 * 60, end: 21 * 60 }    // 16:30-21:00 בדקות
};

/**
 * חישוב זמן פנוי היום - לפי סוג לוח זמנים
 * @param {string} scheduleType - 'work' או 'home'
 */
function getAvailableMinutesToday(scheduleType = 'work') {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const dayOfWeek = now.getDay();
  
  // שישי-שבת - רק משימות בית, ללא הגבלה
  if (dayOfWeek === 5 || dayOfWeek === 6) {
    if (scheduleType === 'home') {
      return 8 * 60; // 8 שעות גמישות
    }
    return 0; // אין שעות עבודה בסופ"ש
  }
  
  const hours = SCHEDULE_HOURS[scheduleType] || SCHEDULE_HOURS.work;
  
  // אם עוד לא התחילו השעות - מחזירים את כל הטווח
  if (currentMinutes < hours.start) {
    return hours.end - hours.start;
  }
  
  // אם כבר עברו השעות - מחזירים 0
  if (currentMinutes >= hours.end) {
    return 0;
  }
  
  // באמצע הטווח - מחזירים את מה שנשאר
  return hours.end - currentMinutes;
}

/**
 * דיאלוג בחירת שיבוץ לפני יצירת משימה ארוכה
 */
function ScheduleDialog({ 
  isOpen, 
  onClose, 
  onConfirm, 
  totalBlocks, 
  blockDuration = 45,
  taskTitle,
  priority,
  scheduleType = 'work'  // ✅ חדש: סוג לוח זמנים
}) {
  const [blocksForToday, setBlocksForToday] = useState(1);
  const availableMinutes = getAvailableMinutesToday(scheduleType);
  const maxBlocksToday = Math.floor(availableMinutes / (blockDuration + 5)); // +5 להפסקות
  const isHomeTask = scheduleType === 'home';
  
  // חישוב ימים נדרשים
  const blocksPerDay = 8; // מקסימום בלוקים ביום
  const blocksForOtherDays = totalBlocks - blocksForToday;
  const daysNeeded = Math.ceil(blocksForOtherDays / blocksPerDay);
  
  useEffect(() => {
    // ברירת מחדל - כמה שנכנס היום (עד 4)
    const defaultBlocks = Math.min(maxBlocksToday, totalBlocks, 4);
    setBlocksForToday(Math.max(1, defaultBlocks));
  }, [totalBlocks, maxBlocksToday]);
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full p-6" dir="rtl">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          📅 תכנון משימה: {taskTitle}
        </h3>
        
        <div className="space-y-4">
          {/* סיכום המשימה */}
          <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-600 dark:text-gray-300">סה"כ בלוקים:</span>
              <span className="font-bold text-blue-600 dark:text-blue-400">{totalBlocks} × {blockDuration} דק'</span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-600 dark:text-gray-300">זמן פנוי היום:</span>
              <span className="font-medium">
                {Math.floor(availableMinutes / 60)}:{String(availableMinutes % 60).padStart(2, '0')} שעות
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-300">מקסימום בלוקים להיום:</span>
              <span className="font-medium">{maxBlocksToday}</span>
            </div>
          </div>
          
          {/* בחירת כמות להיום */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              כמה בלוקים לשבץ להיום?
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max={Math.min(totalBlocks, maxBlocksToday)}
                value={blocksForToday}
                onChange={(e) => setBlocksForToday(parseInt(e.target.value))}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <span className="w-12 text-center font-bold text-lg text-blue-600 dark:text-blue-400">
                {blocksForToday}
              </span>
            </div>
            
            {/* כפתורי בחירה מהירה */}
            <div className="flex gap-2 mt-3">
              <button
                type="button"
                onClick={() => setBlocksForToday(0)}
                className="flex-1 py-2 px-3 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                הכל למחר
              </button>
              <button
                type="button"
                onClick={() => setBlocksForToday(Math.min(2, totalBlocks, maxBlocksToday))}
                className="flex-1 py-2 px-3 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                2 להיום
              </button>
              <button
                type="button"
                onClick={() => setBlocksForToday(Math.min(totalBlocks, maxBlocksToday))}
                className="flex-1 py-2 px-3 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                מקסימום
              </button>
            </div>
          </div>
          
          {/* תצוגה מקדימה */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-sm">
            <div className="font-medium mb-2">תוכנית שיבוץ:</div>
            {blocksForToday > 0 && (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <span>✓</span>
                <span>היום: {blocksForToday} בלוקים ({blocksForToday * blockDuration} דק')</span>
              </div>
            )}
            {blocksForOtherDays > 0 && (
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mt-1">
                <span>📆</span>
                <span>
                  ימים הבאים: {blocksForOtherDays} בלוקים 
                  ({daysNeeded > 1 ? `~${daysNeeded} ימים` : 'יום אחד'})
                </span>
              </div>
            )}
          </div>
          
          {/* אזהרה אם אין מספיק זמן */}
          {maxBlocksToday === 0 && (
            <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3 text-sm text-yellow-800 dark:text-yellow-200">
              ⚠️ אין מספיק זמן להיום - המשימה תשובץ מהיום הבא
            </div>
          )}
        </div>
        
        {/* כפתורים */}
        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={() => onConfirm(blocksForToday)}
            className="flex-1 py-3 px-4 rounded-xl bg-blue-500 text-white hover:bg-blue-600 font-medium"
          >
            ✓ צור משימה
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * רכיב הצעת הערכה חכמה
 */
function EstimateSuggestion({ taskType, currentEstimate, onAcceptSuggestion }) {
  const [suggestion, setSuggestion] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  
  useEffect(() => {
    if (taskType && currentEstimate > 0) {
      const result = getSuggestedEstimate(taskType, currentEstimate);
      setSuggestion(result);
      setDismissed(false);
    } else {
      setSuggestion(null);
    }
  }, [taskType, currentEstimate]);
  
  // אם אין הצעה, או שההערכה זהה, או שהמשתמש סגר
  if (!suggestion || !suggestion.hasData || dismissed) {
    return null;
  }
  
  // אם ההבדל קטן מ-10% - לא מציגים
  const diffPercent = Math.abs(suggestion.ratio - 1) * 100;
  if (diffPercent < 10) {
    return null;
  }
  
  const isOverEstimate = suggestion.ratio > 1; // לוקח יותר מהצפוי
  
  return (
    <div className={`mt-2 p-3 rounded-lg border ${
      isOverEstimate 
        ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
        : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <p className={`text-sm font-medium ${
            isOverEstimate 
              ? 'text-orange-700 dark:text-orange-300'
              : 'text-green-700 dark:text-green-300'
          }`}>
            💡 {suggestion.message}
          </p>
          
          {suggestion.suggestedMinutes !== currentEstimate && (
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              הערכה מומלצת: <strong>{suggestion.suggestedMinutes} דק'</strong>
              {' '}(במקום {currentEstimate} דק')
              <span className="text-gray-400 mr-1">
                • מבוסס על {suggestion.sampleSize} משימות
              </span>
            </p>
          )}
        </div>
        
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-gray-400 hover:text-gray-600 text-lg"
          title="סגור"
        >
          ×
        </button>
      </div>
      
      {/* כפתור קבלת ההצעה */}
      {suggestion.suggestedMinutes !== currentEstimate && onAcceptSuggestion && (
        <button
          type="button"
          onClick={() => {
            onAcceptSuggestion(suggestion.suggestedMinutes);
            setDismissed(true);
          }}
          className={`mt-2 w-full py-1.5 text-sm rounded-lg font-medium transition-colors ${
            isOverEstimate
              ? 'bg-orange-500 hover:bg-orange-600 text-white'
              : 'bg-green-500 hover:bg-green-600 text-white'
          }`}
        >
          עדכן ל-{suggestion.suggestedMinutes} דק'
        </button>
      )}
    </div>
  );
}

/**
 * טופס משימה חכם - עם חישוב זמן אוטומטי והמלצות למידה
 */
function SimpleTaskForm({ task, onClose, taskTypes, defaultDate }) {
  const { addTask, editTask } = useTasks();
  const isEditing = !!task;

  // סטייט הטופס - עם שימוש ב-defaultDate
  const [formData, setFormData] = useState({
    title: '',
    taskType: 'transcription',
    inputValue: '', // משך הקלטה / עמודים / דקות ישירות
    startDate: defaultDate || '', // תאריך התחלה - מתי אפשר להתחיל
    dueDate: defaultDate || '',   // תאריך יעד - דדליין
    dueTime: '',                  // שעה ספציפית
    description: '',
    priority: 'normal' // ברירת מחדל: רגיל (לא דחוף!)
  });

  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('work');
  const [showTimeField, setShowTimeField] = useState(false);
  
  // ✅ חדש: דיאלוג בחירת שיבוץ
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [pendingTaskData, setPendingTaskData] = useState(null);
  
  // ✅ חדש: האם לעדכן את ההערכה מההמלצה
  const [manualDurationOverride, setManualDurationOverride] = useState(null);

  // קבלת סוג המשימה הנוכחי
  const currentTaskType = getTaskType(formData.taskType);

  // חישוב זמן עבודה אוטומטי
  const calculatedDuration = useMemo(() => {
    // אם יש override ידני - משתמשים בו
    if (manualDurationOverride !== null) {
      return manualDurationOverride;
    }
    
    const inputVal = parseFloat(formData.inputValue);
    if (!inputVal || inputVal <= 0) return null;
    return calculateWorkTime(formData.taskType, inputVal);
  }, [formData.taskType, formData.inputValue, manualDurationOverride]);

  // חישוב כמות בלוקים של 45 דקות
  const blocksCount = useMemo(() => {
    if (!calculatedDuration) return 0;
    return Math.ceil(calculatedDuration / 45);
  }, [calculatedDuration]);

  // מילוי נתונים בעריכה / איפוס בהוספה
  useEffect(() => {
    if (task) {
      // מציאת הקטגוריה לפי סוג המשימה
      const taskType = getTaskType(task.task_type);
      setSelectedCategory(taskType.category || 'work');
      
      // ✅ תיקון: חישוב inputValue נכון בעריכה
      // אם יש recording_duration או page_count - משתמשים בהם
      // אחרת - מחשבים הפוך מ-estimated_duration
      let inputVal = '';
      if (task.recording_duration) {
        inputVal = task.recording_duration;
      } else if (task.page_count) {
        inputVal = task.page_count;
      } else if (task.estimated_duration) {
        // חישוב הפוך - אם זה סוג עם timeRatio, מחלקים בו
        if (taskType.inputType === 'recording' && taskType.timeRatio) {
          inputVal = Math.round(task.estimated_duration / taskType.timeRatio);
        } else if (taskType.inputType === 'pages' && taskType.timePerPage) {
          inputVal = Math.round(task.estimated_duration / taskType.timePerPage);
        } else {
          inputVal = task.estimated_duration;
        }
      }
      
      setFormData({
        title: task.title || '',
        taskType: task.task_type || 'transcription',
        inputValue: inputVal,
        startDate: task.start_date || '',
        dueDate: task.due_date || '',
        dueTime: task.due_time || '',
        description: task.description || '',
        priority: task.priority || 'normal'
      });
      
      // אם יש שעה - מציגים את השדה
      if (task.due_time) {
        setShowTimeField(true);
      }
      
      setManualDurationOverride(null);
    } else {
      // איפוס הטופס כשאין משימה (הוספה חדשה)
      setFormData({
        title: '',
        taskType: 'transcription',
        inputValue: '',
        startDate: defaultDate || '',
        dueDate: defaultDate || '',
        dueTime: '',
        description: '',
        priority: 'normal'
      });
      setSelectedCategory('work');
      setShowTimeField(false);
      setManualDurationOverride(null);
    }
  }, [task, defaultDate]);

  // עדכון סוג משימה כשמשתנה קטגוריה
  useEffect(() => {
    const typesInCategory = getTaskTypesByCategory(selectedCategory);
    if (typesInCategory.length > 0 && !typesInCategory.find(t => t.id === formData.taskType)) {
      setFormData(prev => ({ ...prev, taskType: typesInCategory[0].id }));
    }
  }, [selectedCategory]);
  
  // איפוס override כשמשתנה סוג המשימה או הקלט
  useEffect(() => {
    setManualDurationOverride(null);
  }, [formData.taskType, formData.inputValue]);

  // טיפול בשינוי שדה
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  // ✅ קבלת הצעת הערכה
  const handleAcceptSuggestion = (suggestedMinutes) => {
    setManualDurationOverride(suggestedMinutes);
    toast.success(`הערכה עודכנה ל-${suggestedMinutes} דק'`);
  };

  // ✅ יצירת משימה בפועל (אחרי בחירת שיבוץ)
  const createTask = async (taskData, blocksForToday = null) => {
    setLoading(true);
    
    try {
      console.log('📝 Creating task data:', {
        ...taskData,
        blocksForToday,
        blocksCount
      });

      // העברת blocksForToday ל-addTask
      await addTask({
        ...taskData,
        blocksForToday  // ✅ חדש: כמה בלוקים להיום
      });
      
      const todayBlocks = blocksForToday !== null ? blocksForToday : blocksCount;
      const otherBlocks = blocksCount - todayBlocks;
      
      if (otherBlocks > 0) {
        toast.success(`✓ נוספה משימה: ${todayBlocks} בלוקים להיום, ${otherBlocks} לימים הבאים`);
      } else {
        toast.success(`✓ נוספה משימה: ${blocksCount} בלוקים של 45 דק'`);
      }

      onClose();
    } catch (error) {
      console.error('שגיאה בשמירת משימה:', error);
      toast.error('שגיאה בשמירת המשימה');
    } finally {
      setLoading(false);
      setPendingTaskData(null);
    }
  };

  // ✅ אישור מהדיאלוג
  const handleScheduleConfirm = (blocksForToday) => {
    setShowScheduleDialog(false);
    if (pendingTaskData) {
      createTask(pendingTaskData, blocksForToday);
    }
  };

  // שליחת הטופס
  const handleSubmit = async (e) => {
    e.preventDefault();

    // וידוא
    if (!formData.title.trim()) {
      toast.error('נא להזין שם משימה');
      return;
    }

    if (!formData.inputValue || parseFloat(formData.inputValue) <= 0) {
      toast.error('נא להזין ערך תקין');
      return;
    }

    if (!calculatedDuration) {
      toast.error('שגיאה בחישוב זמן');
      return;
    }

    const taskData = {
      title: formData.title.trim(),
      task_type: formData.taskType,
      estimated_duration: calculatedDuration,
      start_date: formData.startDate || null,
      due_date: formData.dueDate || null,
      due_time: formData.dueTime || null,
      description: formData.description || null,
      priority: formData.priority,
      recording_duration: currentTaskType.inputType === 'recording' ? parseFloat(formData.inputValue) : null,
      page_count: currentTaskType.inputType === 'pages' ? parseFloat(formData.inputValue) : null,
      category: selectedCategory  // ✅ חדש: הוספת הקטגוריה
    };

    console.log('📋 Task submission:', {
      taskType: formData.taskType,
      calculatedDuration,
      blocksCount,
      isEditing
    });

    // עריכה - פשוט מעדכן
    if (isEditing) {
      setLoading(true);
      try {
        await editTask(task.id, taskData);
        toast.success('המשימה עודכנה');
        onClose();
      } catch (error) {
        console.error('שגיאה בעדכון משימה:', error);
        toast.error('שגיאה בעדכון המשימה');
      } finally {
        setLoading(false);
      }
      return;
    }

    // ✅ משימה חדשה עם יותר מבלוק אחד - הצג דיאלוג בחירה
    if (blocksCount > 1) {
      setPendingTaskData(taskData);
      setShowScheduleDialog(true);
      return;
    }

    // משימה קצרה - יוצרים ישר
    createTask(taskData, 1);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" dir="rtl">
      
      {/* בחירת קטגוריה */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          קטגוריה
        </label>
        <div className="flex gap-2">
          {Object.values(TASK_CATEGORIES).map(cat => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`
                flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all
                ${selectedCategory === cat.id
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                }
              `}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* בחירת סוג משימה */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          סוג משימה
        </label>
        <div className="grid grid-cols-2 gap-2">
          {getTaskTypesByCategory(selectedCategory).map(type => (
            <button
              key={type.id}
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, taskType: type.id }))}
              className={`
                py-2 px-3 rounded-lg text-sm font-medium transition-all text-right
                ${formData.taskType === type.id
                  ? `${type.bgLight} ${type.text} ${type.border} border-2`
                  : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-100'
                }
              `}
            >
              {type.icon} {type.name}
            </button>
          ))}
        </div>
      </div>

      {/* שם המשימה */}
      <Input
        label="שם המשימה"
        name="title"
        value={formData.title}
        onChange={handleChange}
        placeholder="לדוגמה: תמלול דורון אריאל"
        required
      />

      {/* שדה קלט דינמי לפי סוג */}
      <div>
        <Input
          label={getInputLabel(formData.taskType)}
          type="number"
          name="inputValue"
          value={formData.inputValue}
          onChange={handleChange}
          placeholder={getInputPlaceholder(formData.taskType)}
          min="1"
          required
        />
        
        {/* תצוגת חישוב */}
        {calculatedDuration && (
          <div className="mt-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-700">
            <div className="flex items-center justify-between">
              <span className="text-sm text-green-700 dark:text-green-300">
                ⏱️ זמן עבודה משוער:
              </span>
              <span className="font-bold text-green-800 dark:text-green-200">
                {calculatedDuration} דקות
                {manualDurationOverride !== null && (
                  <span className="text-xs mr-1 text-green-600">(מותאם)</span>
                )}
              </span>
            </div>
            <div className="mt-1 text-xs text-green-600 dark:text-green-400">
              יחולק ל-{blocksCount} בלוקים של 45 דקות (+ הפסקות של 5 דק')
            </div>
          </div>
        )}
        
        {/* ✅ חדש: הצעת הערכה חכמה */}
        {calculatedDuration && !isEditing && (
          <EstimateSuggestion
            taskType={formData.taskType}
            currentEstimate={calculatedDuration}
            onAcceptSuggestion={handleAcceptSuggestion}
          />
        )}
      </div>

      {/* עדיפות */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          עדיפות
        </label>
        <div className="flex gap-2">
          {[
            { id: 'urgent', label: '🔴 דחוף', color: 'red' },
            { id: 'high', label: '🟠 גבוה', color: 'orange' },
            { id: 'normal', label: '🟢 רגיל', color: 'green' }
          ].map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, priority: p.id }))}
              className={`
                flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all
                ${formData.priority === p.id
                  ? `bg-${p.color}-100 text-${p.color}-700 border-2 border-${p.color}-500`
                  : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200'
                }
              `}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* תאריכים */}
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="📅 מתי אפשר להתחיל?"
          type="date"
          name="startDate"
          value={formData.startDate}
          onChange={handleChange}
          min={getLocalDateISO(new Date())}
        />
        <Input
          label="🎯 תאריך יעד (דדליין)"
          type="date"
          name="dueDate"
          value={formData.dueDate}
          onChange={handleChange}
          min={formData.startDate || getLocalDateISO(new Date())}
        />
      </div>
      
      {/* שדה שעה - עם toggle */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            🕐 שעה ספציפית
          </label>
          <button
            type="button"
            onClick={() => {
              setShowTimeField(!showTimeField);
              if (showTimeField) {
                setFormData(prev => ({ ...prev, dueTime: '' }));
              }
            }}
            className={`
              px-3 py-1 text-xs rounded-full transition-all
              ${showTimeField 
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' 
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
              }
            `}
          >
            {showTimeField ? 'ביטול' : 'הוסף שעה'}
          </button>
        </div>
        
        {showTimeField && (
          <Input
            type="time"
            name="dueTime"
            value={formData.dueTime}
            onChange={handleChange}
            placeholder="בחר שעה"
          />
        )}
        
        {!showTimeField && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            💡 השעה תיקבע אוטומטית לפי העומס היומי
          </p>
        )}
      </div>

      {/* הערות */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          הערות (אופציונלי)
        </label>
        <textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                     bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                     focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="פרטים נוספים..."
        />
      </div>

      {/* כפתורים */}
      <div className="flex gap-3 pt-2">
        <Button type="submit" loading={loading} className="flex-1">
          {isEditing ? 'שמור שינויים' : 'הוסף משימה'}
        </Button>
        <Button type="button" variant="secondary" onClick={onClose}>
          ביטול
        </Button>
      </div>
      
      {/* ✅ דיאלוג בחירת שיבוץ */}
      <ScheduleDialog
        isOpen={showScheduleDialog}
        onClose={() => {
          setShowScheduleDialog(false);
          setPendingTaskData(null);
        }}
        onConfirm={handleScheduleConfirm}
        totalBlocks={blocksCount}
        blockDuration={45}
        taskTitle={formData.title}
        priority={formData.priority}
        scheduleType={selectedCategory === 'work' ? 'work' : 'home'}
      />
    </form>
  );
}

export default SimpleTaskForm;
