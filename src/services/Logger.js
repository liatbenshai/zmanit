/**
 * שירות Logger מרכזי
 * ===================
 * structured logging עם levels
 * שימוש: Logger.info('message', data), Logger.error('message', error)
 */

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

class Logger {
  constructor() {
    this.level = process.env.NODE_ENV === 'development' ? LOG_LEVELS.DEBUG : LOG_LEVELS.WARN;
    this.logs = [];
    this.maxLogs = 500;
  }

  /**
   * set log level
   */
  setLevel(level) {
    if (LOG_LEVELS[level]) {
      this.level = LOG_LEVELS[level];
    }
  }

  /**
   * internal logger
   */
  _log(levelName, message, data = {}) {
    const levelValue = LOG_LEVELS[levelName];
    
    if (levelValue < this.level) {
      return;
    }

    const logEntry = {
      timestamp: new Date().toISOString(),
      level: levelName,
      message,
      data,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
    };

    // Store in memory
    this.logs.push(logEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Console output
    this._consoleLog(levelName, message, data, logEntry);

    // Send to backend in production
    if (process.env.NODE_ENV === 'production' && levelValue >= LOG_LEVELS.WARN) {
      this._sendToBackend(logEntry);
    }
  }

  /**
   * console logging עם styling
   */
  _consoleLog(levelName, message, data, logEntry) {
    const styles = {
      DEBUG: 'color: #888; font-style: italic',
      INFO: 'color: #4CAF50; font-weight: bold',
      WARN: 'color: #FF9800; font-weight: bold',
      ERROR: 'color: #f44336; font-weight: bold'
    };

    const style = styles[levelName] || '';
    const icon = {
      DEBUG: '🔍',
      INFO: 'ℹ️',
      WARN: '⚠️',
      ERROR: '❌'
    }[levelName];

    console.log(
      `%c${icon} [${logEntry.timestamp}] ${levelName}: ${message}`,
      style
    );

    if (Object.keys(data).length > 0) {
      console.log('%cData:', 'color: #666; font-weight: bold', data);
    }
  }

  /**
   * send to backend
   */
  _sendToBackend(logEntry) {
    if (typeof fetch === 'undefined') return;

    fetch('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(logEntry)
    }).catch(() => {
      // Silently fail
    });
  }

  // =====================================
  // Public Methods
  // =====================================

  debug(message, data = {}) {
    this._log('DEBUG', message, data);
  }

  info(message, data = {}) {
    this._log('INFO', message, data);
  }

  warn(message, data = {}) {
    this._log('WARN', message, data);
  }

  error(message, error = null) {
    const data = error ? {
      error: error.message || error,
      stack: error?.stack,
      code: error?.code
    } : {};

    this._log('ERROR', message, data);
  }

  /**
   * log task operation
   */
  logTaskOperation(operation, taskId, details = {}) {
    this.info(`Task ${operation}`, {
      taskId,
      ...details
    });
  }

  /**
   * log scheduler operation
   */
  logSchedulerOperation(operation, details = {}) {
    this.info(`Scheduler ${operation}`, details);
  }

  /**
   * log sync operation
   */
  logSyncOperation(status, details = {}) {
    const method = status === 'error' ? 'error' : 'info';
    this[method](`Sync ${status}`, details);
  }

  /**
   * performance logging
   */
  logPerformance(operation, startTime, details = {}) {
    const duration = Date.now() - startTime;
    const level = duration > 1000 ? 'warn' : 'debug';

    this[level](`Performance: ${operation} took ${duration}ms`, {
      duration,
      ...details
    });
  }

  /**
   * get all logs
   */
  getLogs(filter = {}) {
    let filtered = [...this.logs];

    if (filter.level) {
      filtered = filtered.filter(log => log.level === filter.level);
    }

    if (filter.message) {
      filtered = filtered.filter(log => log.message.includes(filter.message));
    }

    if (filter.since) {
      filtered = filtered.filter(log => new Date(log.timestamp) >= new Date(filter.since));
    }

    return filtered;
  }

  /**
   * export logs
   */
  exportLogs() {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * clear logs
   */
  clearLogs() {
    this.logs = [];
  }

  /**
   * download logs
   */
  downloadLogs() {
    const data = this.exportLogs();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zmanit-logs-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

export const loggerInstance = new Logger();

// Setup global error handler
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    loggerInstance.error(`Uncaught error: ${event.message}`, {
      error: event.error,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    loggerInstance.error(`Unhandled promise rejection`, {
      reason: event.reason
    });
  });
}

export default loggerInstance;
