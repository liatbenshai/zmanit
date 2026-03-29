/**
 * Smart Scheduler Helper Utilities
 * ================================
 * Extracted utility functions for scheduling
 * Makes code more testable and maintainable
 */

import ValidationService from '../services/ValidationService';
import ErrorHandler from '../services/ErrorHandler';
import Logger from '../services/Logger';

/**
 * Convert time string (HH:MM) to minutes
 */
export function timeToMinutes(timeStr) {
  try {
    if (!timeStr || typeof timeStr !== 'string') {
      throw new Error('Invalid time string');
    }

    const [hours, minutes] = timeStr.split(':').map(Number);

    if (isNaN(hours) || isNaN(minutes)) {
      throw new Error('Invalid time format');
    }

    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      throw new Error('Time out of bounds');
    }

    return hours * 60 + minutes;
  } catch (error) {
    Logger.error(`Error converting time to minutes: ${timeStr}`, error);
    throw ErrorHandler.createError(`Invalid time: ${timeStr}`, 'INVALID_TIME', { timeStr });
  }
}

/**
 * Convert minutes to time string (HH:MM)
 */
export function minutesToTime(minutes) {
  try {
    if (!ValidationService.isValidNumber(minutes, 0, 1439)) {
      throw new Error('Invalid minutes value');
    }

    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  } catch (error) {
    Logger.error(`Error converting minutes to time: ${minutes}`, error);
    throw ErrorHandler.createError(`Invalid minutes: ${minutes}`, 'INVALID_MINUTES', { minutes });
  }
}

/**
 * Find free time slots in a day
 */
export function findFreeSlots(blocks, dayStart, dayEnd, minSlotDuration = 15, breakDuration = 5) {
  try {
    ErrorHandler.assert(Array.isArray(blocks), 'blocks must be an array');
    ErrorHandler.assert(ValidationService.isValidNumber(dayStart, 0, 1439), 'dayStart must be valid');
    ErrorHandler.assert(ValidationService.isValidNumber(dayEnd, 0, 1439), 'dayEnd must be valid');
    ErrorHandler.assert(dayStart < dayEnd, 'dayStart must be before dayEnd');

    // Sort blocks by start time
    const sortedBlocks = [...blocks].sort((a, b) => (a.startMinute || 0) - (b.startMinute || 0));

    const slots = [];
    let currentTime = dayStart;

    for (const block of sortedBlocks) {
      const blockStart = block.startMinute;
      const blockEnd = block.endMinute;

      // Check if there's a gap before this block
      if (blockStart > currentTime) {
        const gapSize = blockStart - currentTime;
        if (gapSize >= minSlotDuration) {
          slots.push({
            start: currentTime,
            end: blockStart,
            duration: gapSize
          });
        }
      }

      // Move current time past this block
      currentTime = Math.max(currentTime, blockEnd + breakDuration);
    }

    // Add remaining time at end of day
    if (currentTime < dayEnd) {
      const remaining = dayEnd - currentTime;
      if (remaining >= minSlotDuration) {
        slots.push({
          start: currentTime,
          end: dayEnd,
          duration: remaining
        });
      }
    }

    return slots;
  } catch (error) {
    Logger.error('Error finding free slots', error);
    return [];
  }
}

/**
 * Check if a task is a home/family task
 */
export function isHomeTask(task, homeCategories = ['family', 'home', 'kids', 'personal']) {
  try {
    if (!task) return false;

    const category = task.category || '';
    if (homeCategories.includes(category)) {
      return true;
    }

    // Could extend this to check task type config if needed
    return false;
  } catch (error) {
    Logger.error('Error determining if task is home task', error);
    return false;
  }
}

/**
 * Create a scheduling block
 */
export function createBlock(taskData, slotStart, blockDuration, dayDate, config = {}) {
  try {
    ErrorHandler.assertNotNull(taskData, 'taskData');
    ErrorHandler.assertNotNull(slotStart, 'slotStart');
    ErrorHandler.assertNotNull(blockDuration, 'blockDuration');
    ErrorHandler.assertNotNull(dayDate, 'dayDate');

    if (blockDuration <= 0) {
      throw new Error('Block duration must be positive');
    }

    const blockEnd = slotStart + blockDuration;

    if (blockEnd > 1440) {
      throw new Error('Block extends beyond day end');
    }

    return {
      id: `${taskData.id}-${Date.now()}`,
      taskId: taskData.id,
      task: taskData,
      type: taskData.task_type || 'other',
      taskType: taskData.task_type || 'other',
      category: taskData.category || 'work',
      priority: taskData.priority || 'normal',
      title: taskData.title || 'Untitled',
      startMinute: slotStart,
      endMinute: blockEnd,
      startTime: minutesToTime(slotStart),
      endTime: minutesToTime(blockEnd),
      duration: blockDuration,
      dayDate: dayDate,
      isFixed: false,
      blockType: 'flexible_task',
      canMove: true,
      canResize: true,
      createdAt: new Date().toISOString()
    };
  } catch (error) {
    Logger.error('Error creating block', error);
    throw ErrorHandler.createError('Failed to create schedule block', 'BLOCK_CREATION_ERROR', { error: error.message });
  }
}

/**
 * Validate task is safe to schedule
 */
export function validateTaskForScheduling(task) {
  try {
    if (!task || !task.id) {
      return { valid: false, reason: 'Missing task ID' };
    }

    if (!task.title) {
      return { valid: false, reason: 'Missing task title' };
    }

    const duration = task.estimated_duration || 30;
    if (duration <= 0 || duration > 10080) { // Max 1 week
      return { valid: false, reason: `Invalid duration: ${duration}` };
    }

    if (task.due_date && !ValidationService.isValidDate(task.due_date)) {
      return { valid: false, reason: `Invalid due date: ${task.due_date}` };
    }

    if (task.due_time && !ValidationService.isValidTime(task.due_time)) {
      return { valid: false, reason: `Invalid due time: ${task.due_time}` };
    }

    return { valid: true };
  } catch (error) {
    Logger.error('Error validating task', error);
    return { valid: false, reason: error.message };
  }
}

/**
 * Calculate scheduling stats
 */
export function calculateDayStats(day) {
  try {
    ErrorHandler.assertNotNull(day, 'day');

    return {
      date: day.date,
      totalBlocks: day.blocks?.length || 0,
      totalScheduledMinutes: day.totalScheduledMinutes || 0,
      totalFixedMinutes: (day.blocks || [])
        .filter(b => b.isFixed || b.isGoogleEvent)
        .reduce((sum, b) => sum + (b.duration || 0), 0),
      utilization: calculateUtilization(day),
      isOverbooked: isOverbooked(day)
    };
  } catch (error) {
    Logger.error('Error calculating day stats', error);
    return null;
  }
}

/**
 * Calculate day utilization percentage
 */
export function calculateUtilization(day) {
  try {
    const dayStart = day.dayStart || (8 * 60); // 8 AM
    const dayEnd = day.dayEnd || (16 * 60);   // 4 PM
    const dayCapacity = dayEnd - dayStart;

    if (dayCapacity <= 0) return 0;

    const scheduled = day.totalScheduledMinutes || 0;
    return Math.round((scheduled / dayCapacity) * 100);
  } catch (error) {
    Logger.error('Error calculating utilization', error);
    return 0;
  }
}

/**
 * Check if day is overbooked
 */
export function isOverbooked(day, threshold = 1.2) {
  try {
    const dayStart = day.dayStart || (8 * 60);
    const dayEnd = day.dayEnd || (16 * 60);
    const dayCapacity = dayEnd - dayStart;

    const scheduled = day.totalScheduledMinutes || 0;
    return scheduled > (dayCapacity * threshold);
  } catch (error) {
    Logger.error('Error checking overbooking', error);
    return false;
  }
}

export default {
  timeToMinutes,
  minutesToTime,
  findFreeSlots,
  isHomeTask,
  createBlock,
  validateTaskForScheduling,
  calculateDayStats,
  calculateUtilization,
  isOverbooked
};
