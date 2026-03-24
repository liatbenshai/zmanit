/**
 * שירות Config מרכזי עם Dependency Injection
 * ===========================================
 * ניהול configuration מרכזי לכל המערכת
 * שימוש: ConfigService.get('WORK_HOURS'), ConfigService.set('key', value)
 */

import { WORK_HOURS, HOME_HOURS } from '../config/workSchedule';
import { TASK_CATEGORIES, BUILT_IN_TASK_TYPES } from '../config/taskTypes';
import Logger from './Logger';

class ConfigService {
  constructor() {
    this.config = {
      WORK_HOURS,
      HOME_HOURS,
      TASK_CATEGORIES,
      BUILT_IN_TASK_TYPES,
      
      // Scheduler defaults
      SCHEDULER: {
        defaultDayStart: 8 * 60,      // 08:00
        defaultDayEnd: 16 * 60,       // 16:00
        blockDuration: 45,
        breakDuration: 5,
        maxBlocksPerDay: 8,
        
        breakReminders: {
          afterMinutes: 90,
          breakLength: 10,
          lunchLength: 30
        },
        
        morningTaskTypes: ['transcription', 'תמלול'],
        
        // Time thresholds
        LATE_START_THRESHOLD: 5,    // דקות
        ESTIMATION_ERROR_THRESHOLD: 0.2, // 20%
        
        // Priorities
        PRIORITY_WEIGHTS: {
          critical: 4,
          high: 3,
          medium: 2,
          low: 1
        }
      },

      // Features
      FEATURES: {
        GOOGLE_CALENDAR_SYNC: true,
        LEARNING_ENGINE: true,
        NOTIFICATIONS: true,
        EXPORT_PDF: true,
        DARK_MODE: true
      },

      // Learning Engine
      LEARNING: {
        MIN_SAMPLES_FOR_ACCURACY: 5,
        ESTIMATION_ACCURACY_WEIGHT: 0.7,
        COMPLETION_CONSISTENCY_WEIGHT: 0.3,
        PRODUCTIVELY_SCORE_MAX: 100,
        HISTORY_SIZE_LIMIT: 500
      },

      // Validation
      VALIDATION: {
        MIN_TASK_DURATION: 5,           // דקות
        MAX_TASK_DURATION: 10080,       // שבוע
        MAX_TITLE_LENGTH: 200,
        MAX_DESCRIPTION_LENGTH: 2000
      },

      // Notifications
      NOTIFICATIONS: {
        REMINDER_TIME_BEFORE: 10,       // דקות
        OVERDUE_CHECK_INTERVAL: 5 * 60 * 1000, // 5 דקות
        SYNC_ERROR_RETRY_INTERVAL: 30 * 1000   // 30 שניות
      },

      // Storage
      STORAGE: {
        LOCAL_STORAGE_PREFIX: 'zmanit_',
        SESSION_STORAGE_ENABLED: true,
        MAX_LOCAL_STORAGE_SIZE: 5 * 1024 * 1024 // 5MB
      },

      // API
      API: {
        TIMEOUT: 30000, // 30 seconds
        RETRY_ATTEMPTS: 3,
        RETRY_DELAY: 1000 // 1 second
      },

      // Environment
      ENV: process.env.NODE_ENV || 'development',
      DEV_MODE: process.env.NODE_ENV === 'development',
      DEBUG: process.env.DEBUG === 'true'
    };

    this.overrides = {};
    this.validators = new Map();
    this.listeners = new Map();

    Logger.info('ConfigService initialized', {
      env: this.config.ENV,
      dev: this.config.DEV_MODE
    });
  }

  /**
   * קבלת config value
   */
  get(key, defaultValue = undefined) {
    const keys = key.split('.');
    let value = this.overrides[key] !== undefined ? this.overrides[key] : this._getNestedValue(this.config, keys);

    if (value === undefined && defaultValue !== undefined) {
      return defaultValue;
    }

    return value;
  }

  /**
   * קביעת config value
   */
  set(key, value) {
    const oldValue = this.get(key);

    // Validate if validator exists
    if (this.validators.has(key)) {
      const validator = this.validators.get(key);
      const validation = validator(value);
      if (!validation.valid) {
        Logger.error(`Invalid config value for ${key}: ${validation.error}`);
        throw new Error(`Invalid value for ${key}: ${validation.error}`);
      }
    }

    this.overrides[key] = value;
    Logger.debug(`Config changed: ${key}`, { oldValue, newValue: value });

    // Notify listeners
    this._notifyListeners(key, value, oldValue);
  }

  /**
   * merge config partial
   */
  merge(partial) {
    Object.entries(partial).forEach(([key, value]) => {
      this.set(key, value);
    });
  }

  /**
   * reset to default
   */
  reset(key) {
    delete this.overrides[key];
    Logger.debug(`Config reset: ${key}`);
    this._notifyListeners(key, this.get(key), undefined);
  }

  /**
   * reset all
   */
  resetAll() {
    this.overrides = {};
    Logger.info('Config reset to defaults');
  }

  /**
   * register validator
   */
  registerValidator(key, validator) {
    this.validators.set(key, validator);
  }

  /**
   * listen for changes
   */
  listen(key, callback) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, []);
    }
    this.listeners.get(key).push(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(key);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    };
  }

  /**
   * helper: get nested value
   */
  _getNestedValue(obj, keys) {
    let current = obj;
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return undefined;
      }
    }
    return current;
  }

  /**
   * helper: notify listeners
   */
  _notifyListeners(key, newValue, oldValue) {
    if (this.listeners.has(key)) {
      this.listeners.get(key).forEach(callback => {
        try {
          callback(newValue, oldValue);
        } catch (error) {
          Logger.error(`Error in config listener for ${key}`, error);
        }
      });
    }
  }

  /**
   * export current config
   */
  export() {
    return {
      defaults: this.config,
      overrides: this.overrides,
      current: this._getCurrentState()
    };
  }

  /**
   * get current resolved state
   */
  _getCurrentState() {
    const state = JSON.parse(JSON.stringify(this.config));
    
    Object.entries(this.overrides).forEach(([key, value]) => {
      const keys = key.split('.');
      this._setNestedValue(state, keys, value);
    });

    return state;
  }

  /**
   * helper: set nested value
   */
  _setNestedValue(obj, keys, value) {
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }
    current[keys[keys.length - 1]] = value;
  }

  /**
   * validate entire config
   */
  validate() {
    const errors = [];

    for (const [key] of this.validators) {
      try {
        const validator = this.validators.get(key);
        const value = this.get(key);
        const validation = validator(value);
        if (!validation.valid) {
          errors.push({ key, error: validation.error });
        }
      } catch (error) {
        errors.push({ key, error: error.message });
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

export const configService = new ConfigService();

// Register some default validators
configService.registerValidator('VALIDATION.MIN_TASK_DURATION', (value) => ({
  valid: typeof value === 'number' && value > 0 && value < 1440,
  error: 'Must be a number between 0 and 1440'
}));

configService.registerValidator('VALIDATION.MAX_TASK_DURATION', (value) => ({
  valid: typeof value === 'number' && value > 0,
  error: 'Must be a positive number'
}));

export default configService;
