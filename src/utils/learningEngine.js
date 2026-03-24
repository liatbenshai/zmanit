/**
 * Learning Engine - משודרג
 * =======================
 * שומר נתונים ב-Supabase לסנכרון בין מכשירים
 * עם fallback ל-localStorage כשאין חיבור
 * 
 * שימוש: await learningEngine.recordCompletion(task)
 */

import SyncService from '../services/SyncService';
import ValidationService from '../services/ValidationService';
import ErrorHandler from '../services/ErrorHandler';
import Logger from '../services/Logger';
import ConfigService from '../services/ConfigService';
import { supabase } from '../services/supabase';

// =====================================
// Learning Engine Service
// =====================================

class LearningEngine {
  constructor() {
    this.userId = null;
    this.initialized = false;
    this.localStorageKey = ConfigService.get('STORAGE.LOCAL_STORAGE_PREFIX', 'zmanit_') + 'learning_';
  }

  /**
   * Initialize engine and get user ID
   */
  async init() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      this.userId = user?.id || null;
      this.initialized = true;

      if (this.userId) {
        Logger.info('Learning engine initialized for user', { userId: this.userId });
      } else {
        Logger.warn('Learning engine initialized without user - using local storage only');
      }

      return this.userId;
    } catch (error) {
      Logger.error('Failed to initialize learning engine', error);
      this.initialized = true;
      return null;
    }
  }

  /**
   * Ensure initialized
   */
  async ensureInitialized() {
    if (!this.initialized) {
      await this.init();
    }
  }

  /**
   * Record task completion
   */
  async recordCompletion(task) {
    try {
      await this.ensureInitialized();

      // Validate task
      const validation = ValidationService.validateTask(task);
      if (!validation.valid) {
        Logger.warn('Invalid task for learning record', { errors: validation.errors });
        return {
          success: false,
          reason: 'Invalid task',
          local: false
        };
      }

      const record = this._createCompletionRecord(task);

      if (this.userId) {
        // Try to sync to database
        const syncResult = await SyncService.upload('learning_completed_tasks', {
          ...record,
          user_id: this.userId
        });

        if (syncResult.success) {
          Logger.logPerformance('Task completion recorded to Supabase', Date.now());
          await this._updateUserPatterns();
          return { success: true, local: false, data: syncResult.data };
        }
      }

      // Fallback to local storage
      this._saveCompletionLocal(task, record);
      Logger.info('Task completion recorded locally', { taskId: task.id });

      return { success: true, local: true };
    } catch (error) {
      Logger.error('Failed to record task completion', error);
      return ErrorHandler.handle(error, { function: 'recordCompletion', task: task?.id });
    }
  }

  /**
   * Record interruption
   */
  async recordInterruption(interruption) {
    try {
      await this.ensureInitialized();

      ErrorHandler.assertNotNull(interruption, 'interruption');

      const record = {
        user_id: this.userId,
        task_id: interruption.taskId,
        task_title: interruption.taskTitle,
        type: interruption.type || 'other',
        description: interruption.description || '',
        duration: Math.max(1, interruption.duration || 5),
        date: new Date().toISOString().split('T')[0],
        day_of_week: new Date().getDay(),
        hour: new Date().getHours(),
        timestamp: new Date().toISOString()
      };

      if (this.userId) {
        const syncResult = await SyncService.upload('learning_interruptions', record);
        if (syncResult.success) {
          Logger.info('Interruption recorded', { duration: record.duration });
          return { success: true, local: false };
        }
      }

      this._saveLocal('interruptions', record);
      return { success: true, local: true };
    } catch (error) {
      Logger.error('Failed to record interruption', error);
      return ErrorHandler.handle(error, { interruption: interruption?.taskId });
    }
  }

  /**
   * Record late start
   */
  async recordLateStart(taskId, scheduledTime, actualTime, dueDate) {
    try {
      await this.ensureInitialized();

      if (!taskId || !scheduledTime || !actualTime) {
        Logger.warn('Missing required fields for late start recording');
        return { success: false, reason: 'Missing fields' };
      }

      const scheduledMinutes = this._timeStringToMinutes(scheduledTime);
      const actualMinutes = this._timeStringToMinutes(actualTime);
      const lateMinutes = Math.max(0, actualMinutes - scheduledMinutes);

      if (lateMinutes === 0) {
        return { success: true, lateMinutes: 0 }; // Not late
      }

      const record = {
        user_id: this.userId,
        task_id: taskId,
        scheduled_time: scheduledTime,
        actual_start_time: actualTime,
        late_minutes: lateMinutes,
        date: dueDate || new Date().toISOString().split('T')[0],
        day_of_week: new Date().getDay(),
        timestamp: new Date().toISOString()
      };

      if (this.userId) {
        const syncResult = await SyncService.upload('learning_late_starts', record);
        if (syncResult.success) {
          Logger.info('Late start recorded', { lateMinutes });
          return { success: true, lateMinutes, local: false };
        }
      }

      this._saveLocal('late_starts', record);
      return { success: true, lateMinutes, local: true };
    } catch (error) {
      Logger.error('Failed to record late start', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get completion history
   */
  async getCompletionHistory(limit = 30, sinceDate = null) {
    try {
      await this.ensureInitialized();

      if (this.userId && SyncService.isOnline) {
        const filters = {
          limit,
          order: ['date', 'desc']
        };

        if (sinceDate) {
          filters.where = { date: { gte: sinceDate } };
        }

        const result = await SyncService.download('learning_completed_tasks', filters);
        if (result.success) {
          return { success: true, data: result.data, source: 'server' };
        }
      }

      // Fallback to local
      const local = this._getLocal('completed_tasks', []);
      return { success: true, data: local, source: 'local' };
    } catch (error) {
      Logger.error('Failed to get completion history', error);
      return { success: false, data: [], error: error.message };
    }
  }

  /**
   * Get productivity insights
   */
  async getInsights(days = 7) {
    try {
      const history = await this.getCompletionHistory(1000);

      if (!history.success || !history.data) {
        return { success: false, error: 'Could not load history' };
      }

      const today = new Date();
      const startDate = new Date(today.getTime() - days * 24 * 60 * 60 * 1000);

      const filtered = history.data.filter(item => {
        const itemDate = new Date(item.date);
        return itemDate >= startDate && itemDate <= today;
      });

      if (filtered.length === 0) {
        return {
          success: true,
          insights: {
            totalTasks: 0,
            averageDuration: 0,
            accuracyScore: 0,
            completionRate: 0,
            message: 'Not enough data for insights'
          }
        };
      }

      return {
        success: true,
        insights: this._calculateInsights(filtered, days)
      };
    } catch (error) {
      Logger.error('Failed to get insights', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get estimated duration for similar tasks
   */
  async getEstimatedDuration(taskType, category) {
    try {
      const history = await this.getCompletionHistory(100);

      if (!history.success) {
        return null;
      }

      const similar = history.data.filter(item => {
        const typeMatch = !taskType || item.task_type === taskType;
        const categoryMatch = !category || item.category === category;
        return typeMatch && categoryMatch && item.actual_duration > 0;
      });

      if (similar.length === 0) {
        return null;
      }

      const average = Math.round(
        similar.reduce((sum, item) => sum + item.actual_duration, 0) / similar.length
      );

      return average;
    } catch (error) {
      Logger.error('Failed to get estimated duration', error);
      return null;
    }
  }

  // =====================================
  // Private Helper Methods
  // =====================================

  _createCompletionRecord(task) {
    const accuracy = task.estimated_duration > 0
      ? (task.time_spent || 0) / task.estimated_duration
      : null;

    return {
      task_id: task.id,
      title: task.title,
      task_type: task.task_type || 'general',
      category: task.category || 'work',
      estimated_duration: task.estimated_duration || 0,
      actual_duration: task.time_spent || 0,
      accuracy_ratio: accuracy,
      scheduled_time: task.due_time || null,
      actual_start_time: task.actual_start_time || null,
      date: task.due_date || new Date().toISOString().split('T')[0],
      day_of_week: new Date().getDay(),
      hour_completed: new Date().getHours(),
      priority: task.priority || 'normal',
      was_late: this._wasLate(task),
      timestamp: new Date().toISOString()
    };
  }

  _wasLate(task) {
    if (!task.actual_start_time || !task.due_time) {
      return false;
    }

    const scheduled = this._timeStringToMinutes(task.due_time);
    const actual = this._timeStringToMinutes(task.actual_start_time);

    return actual > scheduled;
  }

  _timeStringToMinutes(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') {
      return 0;
    }

    const [hours, minutes] = timeStr.split(':').map(Number);
    return (hours || 0) * 60 + (minutes || 0);
  }

  _saveCompletionLocal(task, record) {
    try {
      const key = this.localStorageKey + 'completed_tasks';
      const history = JSON.parse(localStorage.getItem(key) || '[]');

      history.push({
        id: `local-${Date.now()}`,
        ...record,
        taskedId: task.id,
        syncPending: true
      });

      // Limit to max items
      const maxItems = ConfigService.get('LEARNING.HISTORY_SIZE_LIMIT', 500);
      if (history.length > maxItems) {
        history.splice(0, history.length - maxItems);
      }

      localStorage.setItem(key, JSON.stringify(history));
    } catch (error) {
      Logger.error('Failed to save completion locally', error);
    }
  }

  _saveLocal(type, record) {
    try {
      const key = this.localStorageKey + type;
      const items = JSON.parse(localStorage.getItem(key) || '[]');

      items.push({
        id: `local-${Date.now()}`,
        ...record,
        syncPending: true
      });

      localStorage.setItem(key, JSON.stringify(items));
    } catch (error) {
      Logger.error(`Failed to save ${type} locally`, error);
    }
  }

  _getLocal(type, defaultValue = []) {
    try {
      const key = this.localStorageKey + type;
      return JSON.parse(localStorage.getItem(key) || JSON.stringify(defaultValue));
    } catch (error) {
      Logger.error(`Failed to get ${type} from local storage`, error);
      return defaultValue;
    }
  }

  async _updateUserPatterns() {
    // Could trigger a background sync of patterns
    Logger.debug('User patterns updated');
  }

  _calculateInsights(data, days) {
    const totalTasks = data.length;
    const totalDuration = data.reduce((sum, item) => sum + (item.actual_duration || 0), 0);
    const totalEstimated = data.reduce((sum, item) => sum + (item.estimated_duration || 0), 0);

    const accuracyScores = data
      .filter(item => item.accuracy_ratio !== null)
      .map(item => Math.min(item.accuracy_ratio, 2)); // Cap at 200%

    const avgAccuracy = accuracyScores.length > 0
      ? Math.round((accuracyScores.reduce((a, b) => a + b) / accuracyScores.length) * 100)
      : 0;

    return {
      totalTasks,
      averageDuration: totalTasks > 0 ? Math.round(totalDuration / totalTasks) : 0,
      accuracyScore: Math.max(0, Math.min(100, avgAccuracy)),
      completionRate: 100, // All recorded items were completed
      message: `${totalTasks} tasks analyzed over ${days} days`,
      details: {
        lateStarts: data.filter(item => item.was_late).length,
        mostProductiveHour: this._getMostProductiveHour(data),
        averageEstimationError: totalTasks > 0 ? Math.round(((totalDuration - totalEstimated) / totalEstimated) * 100) : 0
      }
    };
  }

  _getMostProductiveHour(data) {
    if (data.length === 0) return null;

    const hourCounts = {};
    data.forEach(item => {
      const hour = item.hour_completed || 0;
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    return Object.keys(hourCounts).reduce((a, b) =>
      hourCounts[a] > hourCounts[b] ? a : b
    );
  }
}

// Export singleton instance
export const learningEngine = new LearningEngine();

// Backwards compatibility exports
export async function saveCompletedTask(task) {
  return learningEngine.recordCompletion(task);
}

export async function recordInterruption(interruption) {
  return learningEngine.recordInterruption(interruption);
}

export async function recordLateStart(taskId, scheduledTime, actualTime, dueDate) {
  return learningEngine.recordLateStart(taskId, scheduledTime, actualTime, dueDate);
}

export async function getInsights(days = 7) {
  return learningEngine.getInsights(days);
}

export default learningEngine;
