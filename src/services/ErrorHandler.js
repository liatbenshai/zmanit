/**
 * שירות Error Handling מרכזי
 * =============================
 * ניהול שגיאות מובנה עם context
 * שימוש: ErrorHandler.handle(error, context)
 */

const LOG_LEVELS = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error'
};

class AppError extends Error {
  constructor(message, code, context = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.context = context;
    this.timestamp = new Date().toISOString();
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
      timestamp: this.timestamp
    };
  }
}

export const ErrorHandler = {
  /**
   * טיפול מרכזי בשגיאות
   */
  handle(error, context = {}) {
    const errorInfo = {
      message: error?.message || 'Unknown error',
      code: error?.code || 'UNKNOWN_ERROR',
      stack: error?.stack,
      context,
      timestamp: new Date().toISOString()
    };

    this.logError(errorInfo);
    this.trackError(errorInfo);

    return {
      success: false,
      error: {
        code: errorInfo.code,
        message: this.getUserFriendlyMessage(errorInfo.code),
        details: process.env.NODE_ENV === 'development' ? errorInfo : null
      }
    };
  },

  /**
   * logging בעזרת הקשור
   */
  logError(errorInfo) {
    const isDev = process.env.NODE_ENV === 'development';
    
    const log = {
      level: LOG_LEVELS.ERROR,
      message: errorInfo.message,
      code: errorInfo.code,
      context: errorInfo.context,
      timestamp: errorInfo.timestamp
    };

    if (isDev) {
      console.error('❌ Error:', log);
      if (errorInfo.stack) {
        console.error('📍 Stack:', errorInfo.stack);
      }
    } else {
      // Send to external logging service (e.g., Sentry)
      this.sendToExternalLogger(log);
    }
  },

  /**
   * tracking של שגיאות (ניתן להעביר ל-analytics)
   */
  trackError(errorInfo) {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'exception', {
        description: errorInfo.message,
        code: errorInfo.code,
        context: JSON.stringify(errorInfo.context)
      });
    }
  },

  /**
   * הודעה ידידותית למשתמש
   */
  getUserFriendlyMessage(code) {
    const messages = {
      VALIDATION_ERROR: 'נתונים לא תקינים. אנא בדוקו את הקלט.',
      TASK_NOT_FOUND: 'המשימה לא נמצאה.',
      SCHEDULING_ERROR: 'שגיאה בשיבוץ משימות. אנא נסו שוב.',
      DATABASE_ERROR: 'שגיאה בחיבור לבסיס הנתונים.',
      AUTH_ERROR: 'שגיאה בהתחברות. אנא התחברו מחדש.',
      NETWORK_ERROR: 'בעיה בתקשורת. אנא בדוקו את החיבור לאינטרנט.',
      SYNC_ERROR: 'שגיאה בסנכרון נתונים.',
      UNKNOWN_ERROR: 'שגיאה לא ידועה. נא פנו לתמיכה.'
    };

    return messages[code] || messages.UNKNOWN_ERROR;
  },

  /**
   * שליחה לשירות logging חיצוני
   */
  sendToExternalLogger(log) {
    if (typeof fetch !== 'undefined') {
      fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(log)
      }).catch(() => {
        // Silently fail - don't create infinite loop
      });
    }
  },

  /**
   * יצירת AppError
   */
  createError(message, code, context) {
    return new AppError(message, code, context);
  },

  /**
   * wrap function עם error handling
   */
  wrap(fn) {
    return async (...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        return this.handle(error, { function: fn.name, args });
      }
    };
  },

  /**
   * assert conditions
   */
  assert(condition, message, code = 'ASSERTION_ERROR', context = {}) {
    if (!condition) {
      throw this.createError(message, code, context);
    }
  },

  /**
   * בדיקה שלא null/undefined
   */
  assertNotNull(value, fieldName = 'value') {
    this.assert(value != null, `${fieldName} cannot be null or undefined`, 'NULL_VALUE_ERROR', { fieldName });
  },

  /**
   * בדיקה שיש תקבול לפונקציה
   */
  assertIsFunction(fn, functionName = 'function') {
    this.assert(typeof fn === 'function', `${functionName} must be a function`, 'INVALID_FUNCTION', { functionName });
  }
};

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    ErrorHandler.handle(error, {
      component: this.constructor.name,
      errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-100 border border-red-400 rounded">
          <h2 className="font-bold text-red-700">משהו השתבש 😞</h2>
          <p className="text-red-600 text-sm mt-2">
            {process.env.NODE_ENV === 'development' && this.state.error?.message}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            ⟳ רענן דף
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorHandler;
