/**
 * שירות Validation מרכזי
 * ======================
 * בדיקות תקינות לתשומות בכל המערכת
 * שימוש: ValidationService.validateTask(task)
 */

// =====================================
// בדיקות תקינות בסיסיות
// =====================================

export const ValidationService = {
  /**
   * בדיקת תקינות של task
   * @returns {{ valid: boolean, errors: string[] }}
   */
  validateTask(task) {
    const errors = [];

    if (!task) {
      return { valid: false, errors: ['task is null/undefined'] };
    }

    if (typeof task !== 'object') {
      return { valid: false, errors: ['task must be an object'] };
    }

    // בדיקות חובה
    if (!task.id) errors.push('task.id is required');
    if (!task.title || typeof task.title !== 'string') errors.push('task.title must be a non-empty string');

    // בדיקות זמנים
    if (task.estimated_duration !== undefined) {
      if (typeof task.estimated_duration !== 'number' || task.estimated_duration <= 0) {
        errors.push('task.estimated_duration must be a positive number');
      }
      if (task.estimated_duration > 10080) { // יותר מ-7 ימים
        errors.push('task.estimated_duration is unrealistic (> 1 week)');
      }
    }

    if (task.time_spent !== undefined) {
      if (typeof task.time_spent !== 'number' || task.time_spent < 0) {
        errors.push('task.time_spent must be a non-negative number');
      }
    }

    // בדיקות תאריכים
    if (task.due_date) {
      if (!this.isValidDate(task.due_date)) {
        errors.push('task.due_date is not a valid date');
      }
    }

    if (task.start_date) {
      if (!this.isValidDate(task.start_date)) {
        errors.push('task.start_date is not a valid date');
      }
    }

    // בדיקת ترتיب תאריכים
    if (task.start_date && task.due_date) {
      if (task.start_date > task.due_date) {
        errors.push('task.start_date cannot be after task.due_date');
      }
    }

    // בדיקות זמנים
    if (task.due_time) {
      if (!this.isValidTime(task.due_time)) {
        errors.push('task.due_time is not a valid time format (HH:MM)');
      }
    }

    if (task.actual_start_time) {
      if (!this.isValidTime(task.actual_start_time)) {
        errors.push('task.actual_start_time is not a valid time format');
      }
    }

    // בדיקות קטגוריה
    if (task.category) {
      const validCategories = ['work', 'family', 'home', 'personal', 'health', 'education'];
      if (!validCategories.includes(task.category)) {
        errors.push(`task.category must be one of: ${validCategories.join(', ')}`);
      }
    }

    // בדיקות סטטוס
    if (task.status) {
      const validStatuses = ['pending', 'in-progress', 'completed', 'cancelled'];
      if (!validStatuses.includes(task.status)) {
        errors.push(`task.status must be one of: ${validStatuses.join(', ')}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  },

  /**
   * בדיקת תקינות של array של tasks
   */
  validateTasks(tasks) {
    if (!Array.isArray(tasks)) {
      return { valid: false, errors: ['tasks must be an array'] };
    }

    const allErrors = [];
    
    tasks.forEach((task, index) => {
      const result = this.validateTask(task);
      if (!result.valid) {
        allErrors.push({
          index,
          taskId: task?.id,
          errors: result.errors
        });
      }
    });

    return {
      valid: allErrors.length === 0,
      errors: allErrors
    };
  },

  /**
   * בדיקת תקינות של date string (YYYY-MM-DD)
   */
  isValidDate(dateStr) {
    if (typeof dateStr !== 'string') return false;
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateStr)) return false;

    const date = new Date(dateStr + 'T00:00:00');
    return !isNaN(date.getTime());
  },

  /**
   * בדיקת תקינות של time string (HH:MM או HH:MM:SS)
   */
  isValidTime(timeStr) {
    if (typeof timeStr !== 'string') return false;
    const regex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;
    return regex.test(timeStr);
  },

  /**
   * בדיקת תקינות של prioritet
   */
  isValidPriority(priority) {
    const validPriorities = ['low', 'medium', 'high', 'critical'];
    return validPriorities.includes(priority);
  },

  /**
   * בדיקה אם משימה מאוחרת
   */
  isTaskOverdue(task, today = new Date().toISOString().split('T')[0]) {
    if (!task.due_date) return false;
    if (task.status === 'completed') return false;
    return task.due_date < today;
  },

  /**
   * בדיקה אם משימה קרובה לדדליין
   */
  isTaskDueSoon(task, daysAhead = 3, today = new Date().toISOString().split('T')[0]) {
    if (!task.due_date) return false;

    const todayDate = new Date(today);
    const dueDate = new Date(task.due_date);
    const diffTime = dueDate - todayDate;
    const diffDays = diffTime / (1000 * 60 * 60 * 24);

    return diffDays >= 0 && diffDays <= daysAhead;
  },

  /**
   * בדיקה אם זמנים סותרים
   */
  hasTimeConflict(startMinute, endMinute, blocks) {
    if (!Array.isArray(blocks)) return false;

    return blocks.some(block => {
      return !(endMinute <= block.startMinute || startMinute >= block.endMinute);
    });
  },

  /**
   * בדיקה אם יש מספיק זמן פנוי
   */
  enoughTimeFree(requiredMinutes, blocks) {
    if (!Array.isArray(blocks) || blocks.length === 0) {
      return true;
    }

    const occupiedMinutes = blocks.reduce((sum, block) => {
      return sum + (block.endMinute - block.startMinute);
    }, 0);

    return (24 * 60 - occupiedMinutes) >= requiredMinutes;
  },

  /**
   * בדיקה אם מספר תוקף
   */
  isValidNumber(value, min = null, max = null) {
    if (typeof value !== 'number' || isNaN(value)) return false;
    if (min !== null && value < min) return false;
    if (max !== null && value > max) return false;
    return true;
  },

  /**
   * בדיקה אם אחוז תוקף
   */
  isValidPercentage(value) {
    return this.isValidNumber(value, 0, 100);
  }
};

export default ValidationService;
