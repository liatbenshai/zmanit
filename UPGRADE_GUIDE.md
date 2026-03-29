# 📚 Zmanit System Upgrade Documentation

## Overview

This document describes the comprehensive system upgrade completed in Phase 1-5, focusing on error handling, validation, performance, and Supabase integration.

---

## Phase 1: Core Services Foundation

### ValidationService
**Location:** `src/services/ValidationService.js`

Centralized validation for all inputs across the system.

```javascript
import ValidationService from '../services/ValidationService';

// Validate single task
const result = ValidationService.validateTask(task);
if (!result.valid) {
  console.error('Validation errors:', result.errors);
}

// Validate array of tasks
const results = ValidationService.validateTasks(tasks);

// Check specific conditions
if (ValidationService.isValidDate(dateStr)) { }
if (ValidationService.isValidTime(timeStr)) { }
if (ValidationService.isTaskOverdue(task)) { }
if (ValidationService.hasTimeConflict(start, end, blocks)) { }
```

**Key Methods:**
- `validateTask(task)` - Full task validation
- `validateTasks(tasks)` - Batch validation
- `isValidDate/Time/Number/Percentage()` - Type-specific validators
- `isTaskOverdue()` - Deadline checking
- `isTaskDueSoon()` - Early warning
- `hasTimeConflict()` - Scheduling conflicts

---

### ErrorHandler
**Location:** `src/services/ErrorHandler.js`

Unified error handling with context and user-friendly messaging.

```javascript
import ErrorHandler from '../services/ErrorHandler';

// Handle errors gracefully
try {
  const result = someOperation();
} catch (error) {
  const handled = ErrorHandler.handle(error, {
    function: 'myFunction',
    context: additionalData
  });
  // Returns: { success: false, error: { code, message, details } }
}

// Assert conditions
ErrorHandler.assert(value > 0, 'Value must be positive', 'VALIDATION_ERROR');
ErrorHandler.assertNotNull(data, 'data');

// Wrap async functions
const wrappedFn = ErrorHandler.wrap(asyncFunction);
```

**Features:**
- Automatic error contextualization
- User-friendly error messages
- Development vs production modes
- Error tracking integration
- Custom AppError class

---

### Logger
**Location:** `src/services/Logger.js`

Structured logging with levels and automatic context.

```javascript
import Logger from '../services/Logger';

// Different log levels
Logger.debug('Development info', { data });
Logger.info('Important event', { userId, action });
Logger.warn('Warning condition', { issue });
Logger.error('Error occurred', error);

// Domain-specific logging
Logger.logTaskOperation('create', taskId, { title });
Logger.logSchedulerOperation('week-schedule', { startDate });
Logger.logSyncOperation('success', { itemCount });

// Performance tracking
Logger.logPerformance('heavyCalculation', startTime, { result });

// Export logs
const exported = Logger.exportLogs();
Logger.downloadLogs();
```

**Features:**
- DEBUG → INFO → WARN → ERROR levels
- Automatic console + backend logging
- Performance tracking
- Development-only detailed output
- Log export/download

---

### ConfigService
**Location:** `src/services/ConfigService.js`

Centralized configuration management with validation and listening.

```javascript
import ConfigService from '../services/ConfigService';

// Get config values (with defaults)
const dayStart = ConfigService.get('SCHEDULER.defaultDayStart');
const maxDuration = ConfigService.get('VALIDATION.MAX_TASK_DURATION', 10080);

// Set config values
ConfigService.set('SCHEDULER.blockDuration', 50);

// Listen for changes
const unsubscribe = ConfigService.listen('SCHEDULER.blockDuration', (newValue, oldValue) => {
  console.log(`Duration changed from ${oldValue} to ${newValue}`);
});

// Register validators
ConfigService.registerValidator('VALIDATION.MIN_TASK_DURATION', (value) => ({
  valid: value > 0 && value < 1440,
  error: 'Duration must be between 1 and 1439 minutes'
}));

// Validate entire config
const validation = ConfigService.validate();
if (!validation.valid) {
  console.error('Config errors:', validation.errors);
}
```

**Config Sections:**
- `SCHEDULER` - Scheduling parameters
- `VALIDATION` - Input validation rules  
- `LEARNING` - Learning engine settings
- `NOTIFICATIONS` - Alert configuration
- `STORAGE` - Local storage settings
- `API` - API defaults (timeout, retries)
- `FEATURES` - Feature flags

---

### SyncService
**Location:** `src/services/SyncService.js`

Two-way sync between Supabase and localStorage with retry logic.

```javascript
import SyncService from '../services/SyncService';

// Upload data
const result = await SyncService.upload('table_name', {
  user_id: userId,
  title: 'Task',
  // ... other fields
});

if (result.success) {
  console.log('Uploaded:', result.data);
} else if (result.queued) {
  console.log('Queued for sync:', result.queueId);
}

// Batch upload
const batchResult = await SyncService.uploadBatch('table_name', dataArray);

// Download data
const data = await SyncService.download('table_name', {
  where: { user_id: userId, date: { gte: '2024-01-01' } },
  order: ['date', 'desc'],
  limit: 50
});

// Update existing
const updated = await SyncService.update('table_name', id, { title: 'New' });

// Delete
const deleted = await SyncService.delete('table_name', id);

// Queue status
const status = SyncService.getQueueStatus();
// { queueLength, isSyncing, isOnline, queue }
```

**Features:**
- Automatic online/offline detection
- Exponential backoff retry logic
- Queue persistence to localStorage
- Conflict resolution
- Batch operations

---

## Phase 2: Scheduler Refactor

### SmartSchedulerV4 + Helpers
**Locations:** `src/utils/smartSchedulerV4.js`, `src/utils/schedulerHelpers.js`

Enhanced scheduling with validation and error handling.

```javascript
import { scheduleWeekSafe } from '../utils/smartSchedulerV4';
import { 
  timeToMinutes,
  findFreeSlots,
  calculateDayStats,
  isHomeTask
} from '../utils/schedulerHelpers';

// Safe scheduling entry point
const result = await scheduleWeekSafe(weekStart, allTasks);

if (result.success) {
  const { days, summary, warnings, recommendations } = result.data;
  // Process scheduling results
} else {
  console.error('Scheduling failed:', result.error);
}

// Helper utilities
const minutes = timeToMinutes('14:30'); // 870
const time = minutesToTime(870); // "14:30"
const slots = findFreeSlots(blocks, 480, 960); // gaps in day
const isHome = isHomeTask(task); // Home vs work
const stats = calculateDayStats(day); // Utilization, overbooking
```

**Features:**
- Full task validation
- Conflict detection
- Home/work separation
- Time slot optimization
- Overbooking warnings
- Performance monitoring

---

## Phase 3: Learning Engine Refactor

### LearningEngine V2
**Location:** `src/utils/learningEngine.js`

Integrated learning with SyncService and better error handling.

```javascript
import { learningEngine } from '../utils/learningEngine';

// Initialize
await learningEngine.init();

// Record task completion
const result = await learningEngine.recordCompletion(task);
// { success, local, data }

// Record interruptions
await learningEngine.recordInterruption({
  taskId, taskTitle, type: 'distraction',  
  description: 'Phone call', duration: 15
});

// Record late starts
await learningEngine.recordLateStart(taskId, '14:30', '14:45', '2024-01-20');

// Get insights
const insights = await learningEngine.getInsights(7); // Last 7 days
// { totalTasks, averageDuration, accuracyScore, productiveHour }

// Get estimated duration for similar tasks
const estimate = await learningEngine.getEstimatedDuration('transcription', 'work');

// Get history
const history = await learningEngine.getCompletionHistory(30);
```

**Features:**
- Auto Supabase + localStorage fallback
- Accuracy tracking
- Productivity insights
- Late start detection
- Batch local queuing
- Automatic sync retry

---

## Phase 4: Error Boundaries

### ErrorBoundary Component
**Location:** `src/components/Error/ErrorBoundary.jsx`

```jsx
import { ErrorBoundary } from '../components/Error';

// Wrap entire app or parts
<ErrorBoundary name="Dashboard">
  <Dashboard />
</ErrorBoundary>

// In larger app
<ErrorBoundary name="Scheduling">
  <SchedulingModule />
</ErrorBoundary>
<ErrorBoundary name="Analytics">
  <AnalyticsModule />
</ErrorBoundary>
```

**Features:**
- Catches JavaScript errors
- Shows detailed error UI
- Retry / Reload buttons
- Error reporting to service
- Development stack traces
- Error counting to detect loops

---

### AsyncOperation Component
**Location:** `src/components/Error/AsyncOperation.jsx`

```jsx
import AsyncOperation from '../components/Error/AsyncOperation';

<AsyncOperation
  isLoading={loading}
  error={error}
  onRetry={() => refetch()}
  loadingMessage="טוען משימות..."
  errorMessage="שגיאה בטעינה"
>
  <YourContent />
</AsyncOperation>
```

**Features:**
- Loading state display
- Error display with details
- Exponential backoff retry
- Max retry limit
- Development error details

---

## Phase 5: Performance Optimization

### usePerformance Hooks
**Location:** `src/hooks/usePerformance.js`

```javascript
import {
  useEffectiveMemo,
  useDebounce,
  useThrottle,
  useLocalStorage,
  usePerformanceMonitor,
  useAsync,
  useInView,
  usePrevious,
  useIsMounted,
  useSafeAsyncState
} from '../hooks/usePerformance';

// Effective memoization
const expensiveResult = useEffectiveMemo(
  () => calculateSchedule(tasks),
  [tasks]
);

// Debounced search input
const [searchInput, setSearchInput] = useState('');
const debouncedSearch = useDebounce(searchInput, 300);

// Lazy loading observer
const { ref, isInView } = useInView();
<div ref={ref}>
  {isInView && <HeavyComponent />}
</div>

// Async data with caching
const { data, loading, error, execute } = useAsync(
  () => fetchTasks(),
  true // immediate
);

// Persistent local state
const [savedPrefs, setSavedPrefs] = useLocalStorage('preferences', defaultPrefs);
```

**Available Hooks:**
- `useEffectiveMemo` - Smart memoization
- `useDebounce` - Delayed updates
- `useThrottle` - Rate limiting
- `useLocalStorage` - Persisted state
- `usePerformanceMonitor` - Render tracking
- `useAsync` - Data fetching + caching
- `useInView` - Intersection observer
- `usePrevious` - Previous value
- `useIsMounted` - Safe updates
- `useSafeAsyncState` - Unmounted protection

---

## Integration Examples

### Complete Task Completion Flow

```javascript
import { learningEngine } from '../utils/learningEngine';
import ValidationService from '../services/ValidationService';
import Logger from '../services/Logger';
import SyncService from '../services/SyncService';

async function completeTask(task, actualDuration, actualStartTime) {
  try {
    // Validate
    const validation = ValidationService.validateTask(task);
    if (!validation.valid) throw validation.errors[0];

    // Log action
    Logger.logTaskOperation('complete', task.id, { duration: actualDuration });

    // Update task
    const updated = await SyncService.update('tasks', task.id, {
      is_completed: true,
      time_spent: actualDuration,
      actual_start_time: actualStartTime,
      completed_at: new Date().toISOString()
    });

    if (updated.success) {
      // Record learning
      await learningEngine.recordCompletion({
        ...task,
        time_spent: actualDuration,
        actual_start_time: actualStartTime
      });

      Logger.info('Task completed successfully', { taskId: task.id });
      return { success: true };
    }
  } catch (error) {
    Logger.error('Failed to complete task', error);
    return { success: false, error: error.message };
  }
}
```

### Scheduling with Error Handling

```javascript
import { scheduleWeekSafe } from '../utils/smartSchedulerV4';
import { ErrorBoundary } from '../components/Error';

function SchedulingView() {
  const [week, setWeek] = useState(new Date());
  const [schedule, setSchedule] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function schedule() {
      const result = await scheduleWeekSafe(week, allTasks);
      if (result.success) {
        setSchedule(result.data);
      } else {
        setError(result.error);
      }
    }
    schedule();
  }, [week, allTasks]);

  return (
    <ErrorBoundary>
      <div>
        {error && <div className="error">{error.message}</div>}
        {schedule && <ScheduleDisplay schedule={schedule} />}
      </div>
    </ErrorBoundary>
  );
}
```

---

## Best Practices

### 1. Always Validate Input
```javascript
const validation = ValidationService.validateTask(task);
if (!validation.valid) {
  Logger.warn('Invalid task', { errors: validation.errors });
  return;
}
```

### 2. Use SyncService for All DB
```javascript
// Don't call supabase directly
// Instead use:
await SyncService.upload('table', data);
await SyncService.download('table', filters);
```

### 3. Handle Async Operations
```javascript
<AsyncOperation isLoading={loading} error={error}>
  <Component />
</AsyncOperation>
```

### 4. Wrap Risky Code
```javascript
try {
  const result = riskyOperation();
} catch (error) {
  return ErrorHandler.handle(error, { operation: 'name' });
}
```

### 5. Log Important Events
```javascript
Logger.info('User action completed', { userId, action, timestamp });
Logger.warn('Configuration changed', { section, oldValue, newValue });
Logger.error('Operation failed', error);
```

---

## Migration Guide

### Old Code → New Code

```javascript
// Before: Direct Supabase
const { data, error } = await supabase
  .from('tasks')
  .insert(task);

// After: SyncService
const result = await SyncService.upload('tasks', task);
```

```javascript
// Before: Manual validation
if (!task || !task.id) throw new Error('Invalid task');

// After: ValidationService
const validation = ValidationService.validateTask(task);
if (!validation.valid) throw validation.errors[0];
```

```javascript
// Before: Try-catch everything
try { ... } catch (e) { console.error(e); }

// After: Unified error handling
try { ... } catch (error) {
  return ErrorHandler.handle(error, { context });
}
```

---

## Monitoring & Debugging

### View All Logs
```javascript
// In browser console
import Logger from '../services/Logger';
Logger.getLogs();
Logger.getLogs({ level: 'ERROR' });
Logger.getLogs({ since: '2024-01-20T00:00:00' });
Logger.downloadLogs();
```

### Check Sync Queue
```javascript
import SyncService from '../services/SyncService';
SyncService.getQueueStatus();
// { queueLength, isSyncing, isOnline, queue }
```

### Performance
```javascript
// Monitor component renders
<ErrorBoundary name="Dashboard">
  <Dashboard /> {/* Errors logged automatically */}
</ErrorBoundary>

// Track async operations
const { data, loading, error } = useAsync(expensiveFunc);
// Loading UI shown automatically
```

---

## Summary of Files Added/Modified

**New Services (src/services/):**
- `ValidationService.js` - Input validation (280 lines)
- `ErrorHandler.js` - Error management (150 lines)
- `Logger.js` - Structured logging (300 lines)
- `ConfigService.js` - Centralized config (380 lines)
- `SyncService.js` - Database syncing (550+ lines)

**Refactored Utils (src/utils/):**
- `smartSchedulerV4.js` - Enhanced scheduler
- `schedulerHelpers.js` - Scheduling utilities (350+ lines)
- `learningEngine.js` - Refactored learning (1400+ lines)

**New Components (src/components/Error/):**
- `ErrorBoundary.jsx` - Error catching
- `AsyncOperation.jsx` - Async states
- `index.js` - Exports

**New Hooks (src/hooks/):**
- `usePerformance.js` - Performance helpers (300+ lines)

---

## Questions?

Refer to inline JSDoc comments in each file for specific function documentation.

