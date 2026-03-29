import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * מודל (חלון קופץ)
 */
function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showClose = true
}) {
  // נעילת גלילה כשהמודל פתוח
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // סגירה בלחיצה על Escape
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  // גדלים
  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    full: 'max-w-4xl'
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* רקע כהה */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            onClick={onClose}
          />

          {/* המודל */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className={`
                w-full ${sizes[size]}
                bg-white dark:bg-gray-800
                rounded-2xl shadow-elevated
                max-h-[90vh] overflow-hidden flex flex-col
              `}
              onClick={(e) => e.stopPropagation()}
            >
              {/* כותרת - sticky */}
              {(title || showClose) && (
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700/60 flex-shrink-0">
                  {title && (
                    <h2 className="text-base font-bold text-gray-900 dark:text-white">
                      {title}
                    </h2>
                  )}
                  {showClose && (
                    <button
                      onClick={onClose}
                      className="p-2 -ml-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      aria-label="סגור"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              )}

              {/* תוכן - scrollable */}
              <div className="p-5 overflow-y-auto flex-1 scrollbar-thin">
                {children}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

export default Modal;

