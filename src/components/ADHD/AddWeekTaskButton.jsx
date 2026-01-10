import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * 📅 כפתור צף - הוסף משימה לשבוע
 * 
 * כפתור קבוע בפינת המסך שמאפשר להוסיף משימה
 * שצריכה להשתלב במהלך השבוע (לא בהכרח היום)
 */

/**
 * טופס מהיר להוספת משימה לשבוע
 */
function QuickWeekTaskForm({ onClose, onAdd }) {
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState(45);
  const [taskType, setTaskType] = useState('transcription');
  const [client, setClient] = useState('');
  const [deadline, setDeadline] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = () => {
    if (!title.trim()) return;
    
    onAdd({
      title: title.trim(),
      task_type: taskType,
      estimated_duration: duration,
      client: client.trim() || null,
      deadline: deadline || null,
      notes: notes.trim() || null,
      // סימון שזו משימה לשבוע - לא משובצת עדיין
      schedule_for_week: true,
      is_scheduled: false
    });
    
    // איפוס ושמירה פתוחה להוספה נוספת
    setTitle('');
    setClient('');
    setNotes('');
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
      >
        {/* כותרת */}
        <div className="p-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <span>📅</span> משימה לשבוע
            </h3>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center"
            >
              ✕
            </button>
          </div>
          <p className="text-blue-100 text-sm mt-1">
            לא דחוף להיום, אבל צריך להיכנס השבוע
          </p>
        </div>

        {/* טופס */}
        <div className="p-4 space-y-4">
          {/* שם המשימה */}
          <div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="מה צריך לעשות?"
              className="w-full p-3 text-lg border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              autoFocus
            />
          </div>

          {/* סוג ומשך */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">סוג</label>
              <select
                value={taskType}
                onChange={(e) => setTaskType(e.target.value)}
                className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                <option value="transcription">🎧 תמלול</option>
                <option value="proofreading">📝 הגהה</option>
                <option value="translation">🌐 תרגום</option>
                <option value="email">📧 מיילים</option>
                <option value="client_communication">💬 לקוחות</option>
                <option value="course">📚 קורס</option>
                <option value="admin">📋 ניהול</option>
                <option value="other">📌 אחר</option>
              </select>
            </div>
            
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">משך</label>
              <select
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value))}
                className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                <option value={15}>15 דק'</option>
                <option value={30}>30 דק'</option>
                <option value={45}>45 דק'</option>
                <option value={60}>שעה</option>
                <option value={90}>שעה וחצי</option>
                <option value={120}>שעתיים</option>
                <option value={180}>3 שעות</option>
              </select>
            </div>
          </div>

          {/* לקוח ודדליין */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">לקוח</label>
              <input
                type="text"
                value={client}
                onChange={(e) => setClient(e.target.value)}
                placeholder="שם הלקוח..."
                className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>
            
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">צריך לסיים עד</label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>
          </div>

          {/* הערות */}
          <div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="הערות נוספות..."
              rows={2}
              className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white resize-none"
            />
          </div>
        </div>

        {/* כפתורים */}
        <div className="p-4 border-t dark:border-gray-700 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium"
          >
            סגור
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim()}
            className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold disabled:opacity-50"
          >
            ✓ הוסף לשבוע
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/**
 * כפתור צף להוספת משימה לשבוע
 */
function AddWeekTaskButton({ onAdd }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleAdd = (task) => {
    onAdd?.(task);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  };

  return (
    <>
      {/* כפתור צף */}
      <motion.button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 left-4 z-40 w-14 h-14 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center text-2xl hover:scale-110 transition-transform"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        title="הוסף משימה לשבוע"
      >
        📅
      </motion.button>

      {/* הודעת הצלחה */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed bottom-40 left-4 z-40 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg"
          >
            ✓ נוסף לשבוע!
          </motion.div>
        )}
      </AnimatePresence>

      {/* מודאל הוספה */}
      <AnimatePresence>
        {isOpen && (
          <QuickWeekTaskForm
            onClose={() => setIsOpen(false)}
            onAdd={handleAdd}
          />
        )}
      </AnimatePresence>
    </>
  );
}

export default AddWeekTaskButton;
export { QuickWeekTaskForm };
