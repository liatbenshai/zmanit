import { motion, AnimatePresence } from 'framer-motion';

/**
 * דיאלוג אישור יפה
 * משמש לאישור מחיקה, ביטול וכו'
 */
function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'האם את בטוחה?',
  message = '',
  confirmText = 'אישור',
  cancelText = 'ביטול',
  type = 'danger', // danger | warning | info
  icon = null,
  loading = false
}) {
  const typeStyles = {
    danger: {
      iconBg: 'bg-red-100 dark:bg-red-900/30',
      iconColor: 'text-red-600 dark:text-red-400',
      buttonBg: 'bg-red-500 hover:bg-red-600',
      defaultIcon: '🗑️'
    },
    warning: {
      iconBg: 'bg-yellow-100 dark:bg-yellow-900/30',
      iconColor: 'text-yellow-600 dark:text-yellow-400',
      buttonBg: 'bg-yellow-500 hover:bg-yellow-600',
      defaultIcon: '⚠️'
    },
    info: {
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      iconColor: 'text-blue-600 dark:text-blue-400',
      buttonBg: 'bg-blue-500 hover:bg-blue-600',
      defaultIcon: 'ℹ️'
    }
  };

  const style = typeStyles[type] || typeStyles.danger;
  const displayIcon = icon || style.defaultIcon;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* רקע כהה */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* הדיאלוג */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', duration: 0.3 }}
              className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* תוכן */}
              <div className="p-6 text-center">
                {/* אייקון */}
                <div className={`mx-auto w-16 h-16 rounded-full ${style.iconBg} flex items-center justify-center mb-4`}>
                  <span className="text-3xl">{displayIcon}</span>
                </div>

                {/* כותרת */}
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  {title}
                </h3>

                {/* הודעה */}
                {message && (
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    {message}
                  </p>
                )}
              </div>

              {/* כפתורים */}
              <div className="flex border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={onClose}
                  disabled={loading}
                  className="flex-1 px-4 py-3 text-gray-700 dark:text-gray-300 font-medium
                           hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors
                           border-l border-gray-200 dark:border-gray-700"
                >
                  {cancelText}
                </button>
                <button
                  onClick={onConfirm}
                  disabled={loading}
                  className={`flex-1 px-4 py-3 text-white font-medium transition-colors
                           ${style.buttonBg} ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin">⏳</span>
                      מבצע...
                    </span>
                  ) : (
                    confirmText
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

export default ConfirmDialog;
