import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TASK_TYPES } from '../../config/taskTypes';
import { 
  loadEnergySettings, 
  getSuggestedSlot, 
  sortTasksByOptimalOrder,
  formatTimeFromMinutes,
  checkTimeOptimality
} from '../../utils/energySettings';

/**
 * 📅 אשף תכנון שבועי אינטראקטיבי
 * 
 * תהליך:
 * 1. הכנסת כל המשימות לשבוע (ללא שיבוץ)
 * 2. המערכת מציעה שיבוץ חכם
 * 3. המשתמשת מאשרת/משנה כל משימה
 * 4. שמירה סופית
 */

/**
 * תאריך מקומי
 */
function toLocalISODate(date) {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * פורמט זמן
 */
function formatDuration(minutes) {
  if (!minutes) return '';
  if (minutes < 60) return `${minutes} דק'`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}:${mins.toString().padStart(2, '0')}` : `${hours} ש'`;
}

/**
 * שמות ימים
 */
const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

/**
 * קבלת תחילת השבוע (יום ראשון)
 */
function getWeekStart(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * יצירת ימי השבוע
 */
function generateWeekDays(weekStart) {
  const days = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    days.push({
      date: toLocalISODate(date),
      dayOfWeek: i,
      name: DAY_NAMES[i],
      isWorkDay: i >= 0 && i <= 4, // ראשון-חמישי
      isWeekend: i === 5 || i === 6,
      scheduledBlocks: [],
      totalMinutes: 0
    });
  }
  return days;
}

/**
 * קומפוננטת אשף תכנון שבועי
 */
function WeeklyPlanningWizard({ 
  existingTasks = [],
  onSave,
  onClose 
}) {
  // שלבים: 1=הכנסת משימות, 2=סקירת שיבוץ, 3=אישור סופי
  const [step, setStep] = useState(1);
  
  // משימות חדשות להוספה
  const [newTasks, setNewTasks] = useState([]);
  
  // הצעות שיבוץ
  const [scheduleSuggestions, setScheduleSuggestions] = useState([]);
  
  // אילו הצעות אושרו
  const [approvedSuggestions, setApprovedSuggestions] = useState(new Set());
  
  // שבוע נוכחי
  const [weekStart, setWeekStart] = useState(getWeekStart());
  const [weekDays, setWeekDays] = useState(() => generateWeekDays(getWeekStart()));
  
  // טופס הוספת משימה
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    task_type: 'transcription',
    estimated_duration: 45,
    client: '',
    deadline: '',
    notes: ''
  });

  // הגדרות אנרגיה
  const energySettings = useMemo(() => loadEnergySettings(), []);

  // סטטיסטיקות
  const stats = useMemo(() => {
    const totalNewMinutes = newTasks.reduce((sum, t) => sum + (t.estimated_duration || 30), 0);
    const totalExistingMinutes = existingTasks
      .filter(t => !t.is_completed)
      .reduce((sum, t) => sum + (t.estimated_duration || 30), 0);
    
    const workDays = weekDays.filter(d => d.isWorkDay);
    const availableMinutes = workDays.length * (16 * 60 + 15 - 8 * 60 - 30) * 0.75; // 75% capacity
    
    return {
      totalNewMinutes,
      totalExistingMinutes,
      totalMinutes: totalNewMinutes + totalExistingMinutes,
      availableMinutes,
      usagePercent: Math.round((totalNewMinutes + totalExistingMinutes) / availableMinutes * 100)
    };
  }, [newTasks, existingTasks, weekDays]);

  // הוספת משימה חדשה
  const handleAddTask = useCallback(() => {
    if (!newTask.title.trim()) return;
    
    setNewTasks(prev => [...prev, {
      ...newTask,
      id: `new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      isNew: true
    }]);
    
    setNewTask({
      title: '',
      task_type: 'transcription',
      estimated_duration: 45,
      client: '',
      deadline: '',
      notes: ''
    });
    setShowAddForm(false);
  }, [newTask]);

  // הסרת משימה
  const handleRemoveTask = useCallback((taskId) => {
    setNewTasks(prev => prev.filter(t => t.id !== taskId));
  }, []);

  // יצירת הצעות שיבוץ
  const generateSuggestions = useCallback(() => {
    const allTasks = [...newTasks];
    const suggestions = [];
    
    // מיון לפי אופטימליות
    const sortedTasks = sortTasksByOptimalOrder(allTasks);
    
    // יצירת עותק של ימי השבוע עם הבלוקים
    const daysWithBlocks = weekDays.map(day => ({
      ...day,
      scheduledBlocks: [...(day.scheduledBlocks || [])]
    }));
    
    // שיבוץ כל משימה
    for (const task of sortedTasks) {
      let scheduled = false;
      
      // עבור על הימים
      for (const day of daysWithBlocks) {
        if (!day.isWorkDay) continue;
        
        // אם יש דדליין, לא לשבץ אחריו
        if (task.deadline && day.date > task.deadline) continue;
        
        // מציאת סלוט מומלץ
        const slot = getSuggestedSlot(task, 0, day.scheduledBlocks);
        
        if (slot) {
          const suggestion = {
            id: `suggestion-${task.id}`,
            task,
            day: day.date,
            dayName: day.name,
            startTime: slot.suggestedStart,
            endTime: slot.suggestedEnd,
            window: slot.window,
            reason: slot.reason,
            isOptimal: slot.isOptimal
          };
          
          suggestions.push(suggestion);
          
          // הוספת הבלוק ליום
          day.scheduledBlocks.push({
            start: slot.suggestedStart,
            end: slot.suggestedEnd,
            taskId: task.id
          });
          
          scheduled = true;
          break;
        }
      }
      
      // אם לא מצאנו מקום
      if (!scheduled) {
        suggestions.push({
          id: `suggestion-${task.id}`,
          task,
          day: null,
          dayName: null,
          startTime: null,
          endTime: null,
          window: null,
          reason: '⚠️ לא נמצא מקום השבוע',
          isOptimal: false,
          noSpace: true
        });
      }
    }
    
    setScheduleSuggestions(suggestions);
    setApprovedSuggestions(new Set(suggestions.filter(s => !s.noSpace).map(s => s.id)));
  }, [newTasks, weekDays]);

  // מעבר לשלב 2
  const handleProceedToReview = useCallback(() => {
    generateSuggestions();
    setStep(2);
  }, [generateSuggestions]);

  // שינוי יום לשיבוץ
  const handleChangeSuggestionDay = useCallback((suggestionId, newDay) => {
    setScheduleSuggestions(prev => prev.map(s => {
      if (s.id !== suggestionId) return s;
      
      const dayInfo = weekDays.find(d => d.date === newDay);
      return {
        ...s,
        day: newDay,
        dayName: dayInfo?.name || '',
        noSpace: false
      };
    }));
  }, [weekDays]);

  // שינוי שעה
  const handleChangeSuggestionTime = useCallback((suggestionId, newStartTime) => {
    setScheduleSuggestions(prev => prev.map(s => {
      if (s.id !== suggestionId) return s;
      
      const startMinutes = parseInt(newStartTime.split(':')[0]) * 60 + parseInt(newStartTime.split(':')[1] || 0);
      const duration = s.task.estimated_duration || 30;
      
      const optimality = checkTimeOptimality(s.task.task_type, startMinutes);
      
      return {
        ...s,
        startTime: startMinutes,
        endTime: startMinutes + duration,
        isOptimal: optimality.isOptimal,
        reason: optimality.reason
      };
    }));
  }, []);

  // אישור/ביטול הצעה
  const toggleApproval = useCallback((suggestionId) => {
    setApprovedSuggestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(suggestionId)) {
        newSet.delete(suggestionId);
      } else {
        newSet.add(suggestionId);
      }
      return newSet;
    });
  }, []);

  // שמירה סופית
  const handleFinalSave = useCallback(() => {
    const tasksToSave = scheduleSuggestions
      .filter(s => approvedSuggestions.has(s.id) && s.day)
      .map(s => ({
        ...s.task,
        due_date: s.day,
        due_time: formatTimeFromMinutes(s.startTime),
        scheduled_start: s.startTime,
        scheduled_end: s.endTime,
        is_scheduled: true
      }));
    
    onSave?.(tasksToSave);
    onClose?.();
  }, [scheduleSuggestions, approvedSuggestions, onSave, onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* כותרת */}
        <div className="p-6 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">📅 אשף תכנון שבועי</h2>
              <p className="text-indigo-200 text-sm mt-1">
                {step === 1 && 'שלב 1: הכניסי את כל המשימות לשבוע'}
                {step === 2 && 'שלב 2: סקרי את הצעות השיבוץ'}
                {step === 3 && 'שלב 3: אישור סופי'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center"
            >
              ✕
            </button>
          </div>
          
          {/* פס התקדמות */}
          <div className="flex gap-2 mt-4">
            {[1, 2, 3].map(s => (
              <div
                key={s}
                className={`flex-1 h-2 rounded-full ${s <= step ? 'bg-white' : 'bg-white/30'}`}
              />
            ))}
          </div>
        </div>

        {/* תוכן */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* שלב 1: הכנסת משימות */}
          {step === 1 && (
            <div className="space-y-6">
              {/* סטטיסטיקות */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-xl text-center">
                  <div className="text-2xl font-bold text-blue-600">{newTasks.length}</div>
                  <div className="text-sm text-gray-500">משימות חדשות</div>
                </div>
                <div className="p-4 bg-green-50 dark:bg-green-900/30 rounded-xl text-center">
                  <div className="text-2xl font-bold text-green-600">{formatDuration(stats.totalNewMinutes)}</div>
                  <div className="text-sm text-gray-500">סה"כ זמן</div>
                </div>
                <div className={`p-4 rounded-xl text-center ${
                  stats.usagePercent > 100 
                    ? 'bg-red-50 dark:bg-red-900/30' 
                    : 'bg-purple-50 dark:bg-purple-900/30'
                }`}>
                  <div className={`text-2xl font-bold ${
                    stats.usagePercent > 100 ? 'text-red-600' : 'text-purple-600'
                  }`}>
                    {stats.usagePercent}%
                  </div>
                  <div className="text-sm text-gray-500">ניצולת השבוע</div>
                </div>
              </div>

              {/* רשימת משימות חדשות */}
              <div className="space-y-2">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <span>📋</span> משימות להוספה
                </h3>
                
                {newTasks.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-4xl mb-2">📝</div>
                    <p>עדיין לא הוספת משימות</p>
                    <p className="text-sm">לחצי על "הוסף משימה" להתחיל</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {newTasks.map(task => {
                      const typeInfo = TASK_TYPES?.[task.task_type] || { icon: '📌', name: 'אחר' };
                      return (
                        <div
                          key={task.id}
                          className="p-4 bg-gray-50 dark:bg-gray-700 rounded-xl flex items-center gap-4"
                        >
                          <span className="text-2xl">{typeInfo.icon}</span>
                          <div className="flex-1">
                            <div className="font-medium">{task.title}</div>
                            <div className="text-sm text-gray-500 flex gap-3">
                              <span>⏱️ {formatDuration(task.estimated_duration)}</span>
                              {task.client && <span>👤 {task.client}</span>}
                              {task.deadline && <span>📅 עד {task.deadline}</span>}
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemoveTask(task.id)}
                            className="p-2 text-red-500 hover:bg-red-100 rounded-lg"
                          >
                            🗑️
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* טופס הוספה */}
              {showAddForm ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl space-y-4"
                >
                  <h4 className="font-medium">➕ משימה חדשה</h4>
                  
                  <input
                    type="text"
                    value={newTask.title}
                    onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="שם המשימה..."
                    className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                    autoFocus
                  />
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-600 dark:text-gray-400">סוג משימה</label>
                      <select
                        value={newTask.task_type}
                        onChange={(e) => setNewTask(prev => ({ ...prev, task_type: e.target.value }))}
                        className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                      >
                        <option value="transcription">🎧 תמלול</option>
                        <option value="proofreading">📝 הגהה</option>
                        <option value="translation">🌐 תרגום</option>
                        <option value="email">📧 מיילים</option>
                        <option value="client_communication">💬 תקשורת לקוחות</option>
                        <option value="course">📚 קורס</option>
                        <option value="admin">📋 ניהול</option>
                        <option value="other">📌 אחר</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="text-sm text-gray-600 dark:text-gray-400">משך זמן משוער</label>
                      <select
                        value={newTask.estimated_duration}
                        onChange={(e) => setNewTask(prev => ({ ...prev, estimated_duration: parseInt(e.target.value) }))}
                        className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                      >
                        <option value={15}>15 דקות</option>
                        <option value={30}>30 דקות</option>
                        <option value={45}>45 דקות</option>
                        <option value={60}>שעה</option>
                        <option value={90}>שעה וחצי</option>
                        <option value={120}>שעתיים</option>
                        <option value={180}>3 שעות</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-600 dark:text-gray-400">לקוח (אופציונלי)</label>
                      <input
                        type="text"
                        value={newTask.client}
                        onChange={(e) => setNewTask(prev => ({ ...prev, client: e.target.value }))}
                        placeholder="שם הלקוח..."
                        className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                      />
                    </div>
                    
                    <div>
                      <label className="text-sm text-gray-600 dark:text-gray-400">דדליין (אופציונלי)</label>
                      <input
                        type="date"
                        value={newTask.deadline}
                        onChange={(e) => setNewTask(prev => ({ ...prev, deadline: e.target.value }))}
                        className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                      />
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowAddForm(false)}
                      className="flex-1 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg"
                    >
                      ביטול
                    </button>
                    <button
                      onClick={handleAddTask}
                      disabled={!newTask.title.trim()}
                      className="flex-1 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50"
                    >
                      ✓ הוסף
                    </button>
                  </div>
                </motion.div>
              ) : (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="w-full py-4 border-2 border-dashed border-indigo-300 dark:border-indigo-700 rounded-xl text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                >
                  ➕ הוסף משימה
                </button>
              )}

              {/* כפתור המשך */}
              <button
                onClick={handleProceedToReview}
                disabled={newTasks.length === 0}
                className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold text-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {newTasks.length > 0 
                  ? `📅 הצע שיבוץ ל-${newTasks.length} משימות →`
                  : 'הוסיפי משימות קודם'
                }
              </button>
            </div>
          )}

          {/* שלב 2: סקירת הצעות */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/30 rounded-xl">
                <p className="text-yellow-700 dark:text-yellow-300">
                  💡 המערכת שיבצה את המשימות לפי שעות האנרגיה שלך.
                  <br />
                  <strong>תמלול עד 14:00</strong> | <strong>הגהה אחה"צ</strong>
                  <br />
                  סמני ✓ ליד ההצעות שאת מאשרת, או שני אותן.
                </p>
              </div>

              {/* הצעות לפי ימים */}
              <div className="space-y-4">
                {weekDays.filter(d => d.isWorkDay).map(day => {
                  const daySuggestions = scheduleSuggestions.filter(s => s.day === day.date);
                  if (daySuggestions.length === 0) return null;
                  
                  return (
                    <div key={day.date} className="border dark:border-gray-700 rounded-xl overflow-hidden">
                      <div className="p-3 bg-gray-50 dark:bg-gray-700 font-medium flex items-center gap-2">
                        <span>📅</span>
                        <span>יום {day.name}</span>
                        <span className="text-sm text-gray-500">({day.date})</span>
                      </div>
                      
                      <div className="p-4 space-y-3">
                        {daySuggestions.map(suggestion => {
                          const isApproved = approvedSuggestions.has(suggestion.id);
                          const typeInfo = TASK_TYPES?.[suggestion.task.task_type] || { icon: '📌' };
                          
                          return (
                            <div
                              key={suggestion.id}
                              className={`p-4 rounded-xl border-2 transition-all ${
                                isApproved
                                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                                  : 'border-gray-200 dark:border-gray-600'
                              }`}
                            >
                              <div className="flex items-start gap-4">
                                {/* צ'קבוקס */}
                                <button
                                  onClick={() => toggleApproval(suggestion.id)}
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg ${
                                    isApproved
                                      ? 'bg-green-500 text-white'
                                      : 'bg-gray-200 dark:bg-gray-600'
                                  }`}
                                >
                                  {isApproved ? '✓' : ''}
                                </button>
                                
                                {/* פרטי משימה */}
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xl">{typeInfo.icon}</span>
                                    <span className="font-medium">{suggestion.task.title}</span>
                                  </div>
                                  
                                  <div className="mt-2 flex flex-wrap gap-4 text-sm">
                                    {/* שעה */}
                                    <div className="flex items-center gap-2">
                                      <span>🕐</span>
                                      <input
                                        type="time"
                                        value={formatTimeFromMinutes(suggestion.startTime)}
                                        onChange={(e) => handleChangeSuggestionTime(suggestion.id, e.target.value)}
                                        className="p-1 border rounded dark:bg-gray-700 dark:border-gray-600"
                                      />
                                      <span>-</span>
                                      <span>{formatTimeFromMinutes(suggestion.endTime)}</span>
                                    </div>
                                    
                                    {/* משך */}
                                    <span className="text-gray-500">
                                      ⏱️ {formatDuration(suggestion.task.estimated_duration)}
                                    </span>
                                  </div>
                                  
                                  {/* סיבה */}
                                  <div className={`mt-2 text-sm ${
                                    suggestion.isOptimal ? 'text-green-600' : 'text-orange-600'
                                  }`}>
                                    {suggestion.reason}
                                  </div>
                                </div>
                                
                                {/* שינוי יום */}
                                <select
                                  value={suggestion.day}
                                  onChange={(e) => handleChangeSuggestionDay(suggestion.id, e.target.value)}
                                  className="p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                                >
                                  {weekDays.filter(d => d.isWorkDay).map(d => (
                                    <option key={d.date} value={d.date}>
                                      {d.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                
                {/* משימות ללא שיבוץ */}
                {scheduleSuggestions.filter(s => s.noSpace).length > 0 && (
                  <div className="border-2 border-red-300 dark:border-red-700 rounded-xl overflow-hidden">
                    <div className="p-3 bg-red-50 dark:bg-red-900/30 font-medium text-red-700 dark:text-red-300">
                      ⚠️ לא נמצא מקום השבוע
                    </div>
                    <div className="p-4 space-y-2">
                      {scheduleSuggestions.filter(s => s.noSpace).map(suggestion => (
                        <div key={suggestion.id} className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                          {suggestion.task.title}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* כפתורים */}
              <div className="flex gap-4">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 py-3 bg-gray-200 dark:bg-gray-700 rounded-xl"
                >
                  ← חזרה
                </button>
                <button
                  onClick={handleFinalSave}
                  className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold"
                >
                  ✓ שמור {approvedSuggestions.size} משימות
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

export default WeeklyPlanningWizard;
