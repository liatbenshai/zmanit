/**
 * מודל תיעוד הפרעה - זמנית
 * ==========================
 * מאפשר לתעד הפרעות במהלך עבודה
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { saveInterruption } from '../../utils/learningEngine';
import toast from 'react-hot-toast';

const INTERRUPTION_TYPES = [
  { id: 'phone', icon: '📱', name: 'טלפון', color: 'blue' },
  { id: 'person', icon: '👤', name: 'אדם', color: 'green' },
  { id: 'email', icon: '📧', name: 'מייל', color: 'purple' },
  { id: 'meeting', icon: '🤝', name: 'פגישה', color: 'orange' },
  { id: 'break', icon: '☕', name: 'הפסקה', color: 'yellow' },
  { id: 'other', icon: '❓', name: 'אחר', color: 'gray' }
];

const DURATION_OPTIONS = [
  { value: 2, label: '2 דק׳' },
  { value: 5, label: '5 דק׳' },
  { value: 10, label: '10 דק׳' },
  { value: 15, label: '15 דק׳' },
  { value: 30, label: '30 דק׳' },
  { value: 60, label: 'שעה' }
];

/**
 * כפתור "הופרעתי" - לשימוש בטיימר
 */
export function InterruptionButton({ taskId, taskTitle, onInterruption, small = false }) {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`
          flex items-center gap-1 rounded-lg transition-colors
          bg-orange-100 dark:bg-orange-900/30 
          text-orange-600 dark:text-orange-400
          hover:bg-orange-200 dark:hover:bg-orange-800/40
          ${small ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm'}
        `}
        title="תעדי הפרעה"
      >
        <span>📵</span>
        {!small && <span>הופרעתי</span>}
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <InterruptionModal
            taskId={taskId}
            taskTitle={taskTitle}
            onClose={() => setIsOpen(false)}
            onSave={(data) => {
              onInterruption?.(data);
              setIsOpen(false);
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

/**
 * מודל תיעוד הפרעה
 */
function InterruptionModal({ taskId, taskTitle, onClose, onSave }) {
  const [selectedType, setSelectedType] = useState(null);
  const [duration, setDuration] = useState(5);
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  
  const handleSave = async () => {
    if (!selectedType) {
      toast.error('בחרי סוג הפרעה');
      return;
    }
    
    setSaving(true);
    
    try {
      const interruption = {
        taskId,
        taskTitle,
        type: selectedType,
        duration,
        description
      };
      
      const saved = saveInterruption(interruption);
      
      if (saved) {
        toast.success('ההפרעה נשמרה', { icon: '📵' });
        onSave?.(saved);
      } else {
        toast.error('שגיאה בשמירה');
      }
    } catch (e) {
      console.error('שגיאה:', e);
      toast.error('שגיאה בשמירה');
    } finally {
      setSaving(false);
    }
  };
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-sm w-full overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* כותרת */}
        <div className="bg-orange-500 p-4 text-white">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">📵 תיעוד הפרעה</h3>
            <button
              onClick={onClose}
              className="p-1 hover:bg-white/20 rounded-lg transition-colors"
            >
              ✕
            </button>
          </div>
          {taskTitle && (
            <p className="text-orange-100 text-sm mt-1">במהלך: {taskTitle}</p>
          )}
        </div>
        
        {/* תוכן */}
        <div className="p-4 space-y-4">
          {/* סוג הפרעה */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              מה הפריע?
            </label>
            <div className="grid grid-cols-3 gap-2">
              {INTERRUPTION_TYPES.map(type => (
                <button
                  key={type.id}
                  onClick={() => setSelectedType(type.id)}
                  className={`
                    p-3 rounded-xl text-center transition-all
                    ${selectedType === type.id
                      ? 'bg-orange-100 dark:bg-orange-900/30 border-2 border-orange-500 scale-105'
                      : 'bg-gray-50 dark:bg-gray-700 border-2 border-transparent hover:border-gray-300'
                    }
                  `}
                >
                  <div className="text-2xl mb-1">{type.icon}</div>
                  <div className="text-xs font-medium">{type.name}</div>
                </button>
              ))}
            </div>
          </div>
          
          {/* משך */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              כמה זמן לקח?
            </label>
            <div className="flex flex-wrap gap-2">
              {DURATION_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setDuration(opt.value)}
                  className={`
                    px-3 py-2 rounded-lg text-sm font-medium transition-all
                    ${duration === opt.value
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                    }
                  `}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          
          {/* הערה */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              הערה (אופציונלי)
            </label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="למשל: טלפון מהבנק"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              dir="rtl"
            />
          </div>
        </div>
        
        {/* כפתורים */}
        <div className="flex gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            ביטול
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !selectedType}
            className={`
              flex-1 px-4 py-2 rounded-lg font-medium transition-colors
              ${selectedType
                ? 'bg-orange-500 text-white hover:bg-orange-600'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }
            `}
          >
            {saving ? '⏳ שומר...' : '✓ שמור'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default InterruptionModal;
