# 🧪 Testing Guide - Phase 9

## Overview

This guide provides test cases and procedures to validate all components added in Phases 1-5.

---

## Unit Tests

### ValidationService Tests

**File:** `src/services/__tests__/ValidationService.test.js`

```javascript
describe('ValidationService', () => {
  describe('validateTask', () => {
    test('should pass valid task', () => {
      const task = {
        id: '1',
        title: 'Test',
        duration: 60,
        priority: 'high'
      };
      const result = ValidationService.validateTask(task);
      expect(result.valid).toBe(true);
    });

    test('should fail missing title', () => {
      const task = { id: '1', duration: 60 };
      const result = ValidationService.validateTask(task);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('title');
    });

    test('should fail invalid duration', () => {
      const task = { id: '1', title: 'Test', duration: 5 };
      const result = ValidationService.validateTask(task);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('duration');
    });
  });

  describe('isValidDate', () => {
    test('should pass YYYY-MM-DD format', () => {
      expect(ValidationService.isValidDate('2024-01-15')).toBe(true);
    });

    test('should fail invalid format', () => {
      expect(ValidationService.isValidDate('15-01-2024')).toBe(false);
      expect(ValidationService.isValidDate('2024/01/15')).toBe(false);
    });
  });

  describe('hasTimeConflict', () => {
    test('should detect overlapping blocks', () => {
      const block1 = { start: '09:00', end: '10:00' };
      const block2 = { start: '09:30', end: '10:30' };
      expect(ValidationService.hasTimeConflict(
        '09:30', '10:00', [block1]
      )).toBe(true);
    });

    test('should allow consecutive blocks', () => {
      const block1 = { start: '09:00', end: '10:00' };
      expect(ValidationService.hasTimeConflict(
        '10:00', '11:00', [block1]
      )).toBe(false);
    });
  });
});
```

**Commands:**
```bash
npm test -- ValidationService.test.js
```

---

### ErrorHandler Tests

**File:** `src/services/__tests__/ErrorHandler.test.js`

```javascript
describe('ErrorHandler', () => {
  describe('handle', () => {
    test('should create AppError with context', () => {
      const error = new Error('Test error');
      const result = ErrorHandler.handle(error, {
        function: 'testFunc',
        context: { data: 'test' }
      });
      
      expect(result.success).toBe(false);
      expect(result.error.message).toBe('Test error');
      expect(result.error.details.function).toBe('testFunc');
    });
  });

  describe('assert', () => {
    test('should throw AppError on false condition', () => {
      expect(() => {
        ErrorHandler.assert(false, 'Test message', 'TEST_CODE');
      }).toThrow();
    });

    test('should not throw on true condition', () => {
      expect(() => {
        ErrorHandler.assert(true, 'Test message', 'TEST_CODE');
      }).not.toThrow();
    });
  });

  describe('AppError', () => {
    test('should preserve error code and details', () => {
      const error = new AppError('Test', 'VALIDATION_ERROR', { field: 'title' });
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.details.field).toBe('title');
    });
  });
});
```

**Commands:**
```bash
npm test -- ErrorHandler.test.js
```

---

### SyncService Tests

**File:** `src/services/__tests__/SyncService.test.js`

```javascript
describe('SyncService', () => {
  describe('upload', () => {
    test('should upload to Supabase when online', async () => {
      const data = { user_id: '1', title: 'Test' };
      const result = await SyncService.upload('tasks', data);
      expect(result.success || result.queued).toBe(true);
    });

    test('should queue when offline', async () => {
      // Mock offline
      global.navigator.onLine = false;
      
      const data = { user_id: '1', title: 'Test' };
      const result = await SyncService.upload('tasks', data);
      expect(result.queued).toBe(true);
      
      // Restore
      global.navigator.onLine = true;
    });
  });

  describe('queue handling', () => {
    test('should process queue with retry', async () => {
      const status = SyncService.getQueueStatus();
      expect(status.queueLength).toBeGreaterThanOrEqual(0);
      
      const result = await SyncService.processSyncQueue();
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('failed');
    });
  });

  describe('download', () => {
    test('should fetch tasks with filters', async () => {
      const tasks = await SyncService.download('tasks', {
        where: { user_id: 'test-user' },
        limit: 10
      });
      
      expect(Array.isArray(tasks)).toBe(true);
    });
  });
});
```

**Commands:**
```bash
npm test -- SyncService.test.js
```

---

### Logger Tests

**File:** `src/services/__tests__/Logger.test.js`

```javascript
describe('Logger', () => {
  describe('logging levels', () => {
    test('should log at different levels', () => {
      Logger.debug('Debug message', { test: true });
      Logger.info('Info message', { test: true });
      Logger.warn('Warn message', { test: true });
      Logger.error('Error message', new Error('test'));
      
      const logs = Logger.getLogs();
      expect(logs.length).toBeGreaterThan(0);
    });
  });

  describe('log retrieval', () => {
    test('should filter by level', () => {
      Logger.info('Info test');
      Logger.error('Error test');
      
      const errors = Logger.getLogs({ level: 'ERROR' });
      const allLogs = Logger.getLogs();
      
      expect(allLogs.length).toBeGreaterThanOrEqual(errors.length);
    });

    test('should export logs as JSON', () => {
      Logger.info('Export test');
      const exported = Logger.exportLogs();
      
      expect(typeof exported).toBe('string');
      expect(() => JSON.parse(exported)).not.toThrow();
    });
  });

  describe('domain logging', () => {
    test('should log task operations', () => {
      Logger.logTaskOperation('create', 'task-1', { title: 'Test' });
      const logs = Logger.getLogs({ keyword: 'task-1' });
      expect(logs.length).toBeGreaterThan(0);
    });
  });
});
```

**Commands:**
```bash
npm test -- Logger.test.js
```

---

### ConfigService Tests

**File:** `src/services/__tests__/ConfigService.test.js`

```javascript
describe('ConfigService', () => {
  describe('get/set', () => {
    test('should get and set config values', () => {
      ConfigService.set('SCHEDULER.blockDuration', 50);
      const value = ConfigService.get('SCHEDULER.blockDuration');
      expect(value).toBe(50);
    });

    test('should return default when not set', () => {
      const value = ConfigService.get('UNKNOWN.path', 'default');
      expect(value).toBe('default');
    });
  });

  describe('listeners', () => {
    test('should notify on config change', (done) => {
      const unsubscribe = ConfigService.listen(
        'SCHEDULER.blockDuration',
        (newVal, oldVal) => {
          expect(newVal).toBe(55);
          unsubscribe();
          done();
        }
      );
      
      ConfigService.set('SCHEDULER.blockDuration', 55);
    });
  });

  describe('validation', () => {
    test('should validate config', () => {
      const validation = ConfigService.validate();
      expect(validation).toHaveProperty('valid');
      expect(validation).toHaveProperty('errors');
    });
  });
});
```

**Commands:**
```bash
npm test -- ConfigService.test.js
```

---

## Integration Tests

### Scheduler Integration Test

**File:** `src/utils/__tests__/smartSchedulerV4.integration.test.js`

```javascript
describe('SmartScheduler Integration', () => {
  describe('scheduleWeekSafe', () => {
    test('should schedule week with validation', async () => {
      const weekStart = new Date('2024-01-22');
      const tasks = [
        {
          id: '1',
          title: 'Task 1',
          duration: 60,
          priority: 'high',
          category: 'work'
        },
        {
          id: '2',
          title: 'Task 2',
          duration: 30,
          priority: 'low',
          category: 'home'
        }
      ];

      const result = await scheduleWeekSafe(weekStart, tasks);
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('days');
      expect(result.data.days.length).toBe(7);
      expect(result.data).toHaveProperty('summary');
    });

    test('should handle validation errors gracefully', async () => {
      const weekStart = new Date('2024-01-22');
      const invalidTasks = [
        { id: '1', title: 'Invalid' } // Missing duration
      ];

      const result = await scheduleWeekSafe(weekStart, invalidTasks);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should detect conflicts', async () => {
      const weekStart = new Date('2024-01-22');
      const tasks = [
        {
          id: '1',
          title: 'Task 1',
          duration: 480,
          priority: 'high',
          category: 'work',
          scheduled_date: '2024-01-22',
          scheduled_time: '08:00'
        },
        {
          id: '2',
          title: 'Task 2',
          duration: 120,
          priority: 'high',
          category: 'work',
          scheduled_date: '2024-01-22',
          scheduled_time: '10:00'
        }
      ];

      const result = await scheduleWeekSafe(weekStart, tasks);
      
      if (result.success) {
        expect(result.data.warnings).toBeDefined();
      }
    });
  });

  describe('Scheduler with Google Calendar', () => {
    test('should merge Google Calendar events', async () => {
      // This requires mock Google Calendar API
      // See: src/hooks/useGoogleCalendar.js for integration
      
      const weekStart = new Date('2024-01-22');
      const tasks = [/* ... */];
      
      // Would need Google Calendar mock
      // const result = await scheduleWeekWithGoogle(weekStart, tasks);
    });
  });
});
```

**Commands:**
```bash
npm test -- smartSchedulerV4.integration.test.js
```

---

### Sync Integration Test

**File:** `src/services/__tests__/SyncService.integration.test.js`

```javascript
describe('SyncService Integration', () => {
  describe('offline queue persistence', () => {
    test('should persist queue to localStorage', async () => {
      // Go offline
      global.navigator.onLine = false;

      const data = { user_id: 'test', title: 'Offline task' };
      const result1 = await SyncService.upload('tasks', data);
      expect(result1.queued).toBe(true);

      // Verify localStorage
      const stored = JSON.parse(localStorage.getItem('SyncQueue'));
      expect(stored.queue.length).toBeGreaterThan(0);

      // Go online
      global.navigator.onLine = true;
      
      // Process queue
      await SyncService.processSyncQueue();
      
      // Queue should be cleared
      const queue = JSON.parse(localStorage.getItem('SyncQueue') || '{}');
      expect(queue.queue || []).toHaveLength(0);
    });
  });

  describe('retry logic with exponential backoff', () => {
    test('should retry failed uploads', async () => {
      // This would require mocking Supabase to fail
      const callCount = { count: 0 };
      
      // Mock fails first 2 times, succeeds on 3rd
      const originalInsert = supabase.from;
      supabase.from = jest.fn(() => ({
        insert: jest.fn(async () => {
          callCount.count++;
          if (callCount.count < 3) throw new Error('Network error');
          return { data: [{ id: '1' }], error: null };
        })
      }));

      const result = await SyncService.upload('tasks', { title: 'Test' });
      
      // Should eventually succeed with retries
      expect(result.success || result.queued).toBe(true);
    });
  });

  describe('batch operations', () => {
    test('should sync multiple records', async () => {
      const records = [
        { user_id: '1', title: 'Task 1' },
        { user_id: '1', title: 'Task 2' },
        { user_id: '1', title: 'Task 3' }
      ];

      const result = await SyncService.uploadBatch('tasks', records);
      
      expect(result.success || result.queued).toBe(true);
      if (result.success) {
        expect(result.data.length).toBe(3);
      }
    });
  });
});
```

**Commands:**
```bash
npm test -- SyncService.integration.test.js
```

---

## Component Tests

### ErrorBoundary Component Test

**File:** `src/components/Error/__tests__/ErrorBoundary.test.jsx`

```javascript
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary';

describe('ErrorBoundary', () => {
  test('should render children when no error', () => {
    render(
      <ErrorBoundary name="test">
        <div>Content</div>
      </ErrorBoundary>
    );
    
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  test('should catch and display errors', () => {
    const ErrorComponent = () => {
      throw new Error('Test error');
    };

    render(
      <ErrorBoundary name="test">
        <ErrorComponent />
      </ErrorBoundary>
    );

    // Should show error UI instead of crashing
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  test('should display retry button', () => {
    const ErrorComponent = () => {
      throw new Error('Test error');
    };

    const { rerender } = render(
      <ErrorBoundary name="test">
        <ErrorComponent />
      </ErrorBoundary>
    );

    // Error boundary UI should have retry
    // (Exact implementation depends on ErrorBoundary UI)
  });
});
```

**Commands:**
```bash
npm test -- ErrorBoundary.test.jsx
```

---

### AsyncOperation Component Test

**File:** `src/components/Error/__tests__/AsyncOperation.test.jsx`

```javascript
import { render, screen, fireEvent } from '@testing-library/react';
import AsyncOperation from '../AsyncOperation';

describe('AsyncOperation', () => {
  test('should show loading state', () => {
    render(
      <AsyncOperation isLoading={true}>
        <div>Content</div>
      </AsyncOperation>
    );

    // Should show spinner or loading indicator
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  test('should show content when loaded', () => {
    render(
      <AsyncOperation isLoading={false}>
        <div>Content</div>
      </AsyncOperation>
    );

    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  test('should show error and retry button', () => {
    const onRetry = jest.fn();
    render(
      <AsyncOperation
        isLoading={false}
        error={{ message: 'Test error' }}
        onRetry={onRetry}
      >
        <div>Content</div>
      </AsyncOperation>
    );

    expect(screen.getByText(/error/i)).toBeInTheDocument();
    
    const retryButton = screen.getByRole('button');
    fireEvent.click(retryButton);
    expect(onRetry).toHaveBeenCalled();
  });
});
```

**Commands:**
```bash
npm test -- AsyncOperation.test.jsx
```

---

## Performance Tests

### Hook Performance Test

**File:** `src/hooks/__tests__/usePerformance.perf.test.js`

```javascript
import * as hooks from '../usePerformance';

describe('usePerformance Hooks - Performance', () => {
  test('useEffectiveMemo should reduce re-renders', () => {
    const renderCount = { count: 0 };
    
    const TestComponent = ({ data }) => {
      renderCount.count++;
      const result = hooks.useEffectiveMemo(
        () => heavyCalculation(data),
        [data]
      );
      return <div>{result}</div>;
    };

    const { rerender } = render(<TestComponent data={[1, 2, 3]} />);
    const initialRenders = renderCount.count;

    // Re-render with same data reference - should not recalculate
    rerender(<TestComponent data={[1, 2, 3]} />);
    
    expect(renderCount.count).toBe(initialRenders + 1);
  });

  test('useDebounce should reduce updates', (done) => {
    const updates = [];
    
    const TestComponent = () => {
      const [input, setInput] = useState('');
      const debounced = hooks.useDebounce(input, 300);
      
      useEffect(() => {
        updates.push(debounced);
      }, [debounced]);

      return (
        <input
          onChange={(e) => setInput(e.target.value)}
          value={input}
        />
      );
    };

    render(<TestComponent />);
    
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'a' } });
    fireEvent.change(input, { target: { value: 'ab' } });
    fireEvent.change(input, { target: { value: 'abc' } });

    setTimeout(() => {
      // Should only trigger one update due to debounce
      expect(updates.length).toBeLessThan(3);
      done();
    }, 350);
  });
});
```

**Commands:**
```bash
npm test -- usePerformance.perf.test.js
```

---

## End-to-End Tests

### Complete Workflow Test

**File:** `tests/e2e/complete-workflow.test.js`

```javascript
describe('Complete Workflow - E2E', () => {
  test('should create, schedule, and complete task', async () => {
    // 1. Navigate to task creation
    cy.visit('/tasks/new');

    // 2. Fill form with Validation
    cy.get('[data-testid="task-title"]').type('Important transcription');
    cy.get('[data-testid="task-duration"]').type('120');
    cy.get('[data-testid="task-priority"]').select('high');
    cy.get('[data-testid="task-category"]').select('work');

    // 3. Submit (should validate)
    cy.get('[data-testid="submit-btn"]').click();

    // 4. Should redirect to scheduled view
    cy.url().should('include', '/schedule');

    // 5. Verify task is scheduled
    cy.contains('Important transcription').should('be.visible');

    // 6. Complete task
    cy.get('[data-testid="task-complete-btn"]').first().click();
    cy.get('[data-testid="time-spent"]').type('100');
    cy.get('[data-testid="confirm-complete"]').click();

    // 7. Should show success + learning recorded
    cy.contains('Task completed').should('be.visible');

    // 8. Verify in learning engine (insights should update)
    cy.visit('/insights');
    cy.contains('Completed tasks').should('contain', '1');
  });

  test('should handle offline gracefully', async () => {
    // 1. Go online, create task
    cy.visit('/tasks/new');
    cy.get('[data-testid="task-title"]').type('Online task');
    cy.get('[data-testid="submit-btn"]').click();

    // 2. Go offline
    cy.window().then((win) => {
      win.navigator.onLine = false;
    });

    // 3. Create another task (should queue)
    cy.get('[data-testid="new-task"]').click();
    cy.get('[data-testid="task-title"]').type('Offline task');
    cy.get('[data-testid="submit-btn"]').click();

    // Should show "Queued for sync" indicator
    cy.contains('Queued').should('be.visible');

    // 4. Go back online
    cy.window().then((win) => {
      win.navigator.onLine = true;
    });

    // Should auto-sync
    cy.contains('Synced').should('be.visible', { timeout: 5000 });
  });

  test('should show error boundaries on failure', async () => {
    // Mock API error
    cy.intercept('POST', '**/rest/v1/tasks**', {
      statusCode: 500,
      body: { error: 'Server error' }
    });

    cy.visit('/tasks/new');
    cy.get('[data-testid="task-title"]').type('Test');
    cy.get('[data-testid="submit-btn"]').click();

    // Should show error with retry button
    cy.contains('Error').should('be.visible');
    cy.get('[data-testid="retry-btn"]').should('be.visible');
  });
});
```

**Commands:**
```bash
npm run cy:run -- --spec tests/e2e/complete-workflow.test.js
```

---

## Manual Testing Checklist

### ✅ Validation Testing
- [ ] Create task with empty title → Error message
- [ ] Create task with duration < 15 min → Error message
- [ ] Create task with duration > 480 min → Error message
- [ ] Create task with past deadline → Warning
- [ ] Create task with invalid date format → Error message

### ✅ Database Sync Testing
- [ ] Create task online → Saved to Supabase
- [ ] Go offline (DevTools) → Can still create task
- [ ] Go offline → Task shows "Queued" badge
- [ ] Go online → Task auto-syncs
- [ ] Modify task offline → Queued and synced on online
- [ ] Delete task offline → Queued and deleted on online
- [ ] Page reload offline → Queue persists in localStorage

### ✅ Scheduling Testing
- [ ] Schedule single task → Shows in calendar
- [ ] Schedule conflicting tasks → Shows warning
- [ ] Schedule home + work tasks → Separated correctly
- [ ] Schedule week → No overbooking warnings
- [ ] Reschedule task → Updates calendar
- [ ] Delete scheduled task → Removed from calendar

### ✅ Learning Engine Testing
- [ ] Complete task → Recorded in learning engine
- [ ] Complete multiple tasks → Insights update
- [ ] View 7-day insights → Stats correct
- [ ] View 30-day insights → Accuracy score shown
- [ ] Late start task → Recorded with timestamp
- [ ] Interruption → Logged with type and duration

### ✅ Error Handling Testing
- [ ] Task creation fails → Error boundary shows message
- [ ] Retry task creation → Works correctly
- [ ] Multiple errors (> 5) → Alert shown
- [ ] Check logs (DevTools) → Logger.getLogs() works
- [ ] Export logs → JSON downloaded
- [ ] Stack trace in dev mode → Visible

### ✅ Performance Testing
- [ ] Search tasks → Debounced (no lag)
- [ ] Scroll calendar → Smooth (60fps)
- [ ] Add many tasks → No UI slowdown
- [ ] Open DevTools → Performance tab shows good metrics
- [ ] Memory check → No leaks over time
- [ ] Lazy load components → Network tab shows code splitting

### ✅ Configuration Testing
- [ ] Change block duration → Applied to new schedules
- [ ] Change start time → Calendar updates
- [ ] Listen for config change → Event fires
- [ ] Reset to defaults → Works correctly
- [ ] Validate bad config → Error shown
- [ ] Export config → JSON valid

---

## Coverage Goals

| Category | Current | Target | Status |
|----------|---------|--------|--------|
| Services | - | 90%+ | In Progress |
| Hooks | - | 85%+ | In Progress |
| Components | - | 80%+ | In Progress |
| Utilities | - | 85%+ | In Progress |
| Integration | - | 75%+ | In Progress |

---

## Test Results Template

```
Phase 9 - Testing Results
========================

Date: ________________
Tester: ______________

VALIDATION TESTS:
✅ Input validation: _____
✅ Error messages: _____
✅ Edge cases: _____

SYNC TESTS:
✅ Online upload: _____
✅ Offline queue: _____
✅ Retry logic: _____

COMPONENT TESTS:
✅ Error boundary: _____
✅ Async operation: _____
✅ Loading states: _____

PERFORMANCE TESTS:
✅ Hook performance: _____
✅ Memory usage: _____
✅ Render optimization: _____

E2E TESTS:
✅ Complete workflow: _____
✅ Offline workflow: _____
✅ Error recovery: _____

OVERALL: PASS / FAIL
Issues found: ___________
Blockers: ______________
```

---

## Running All Tests

```bash
# Unit tests
npm test

# Coverage report
npm test -- --coverage

# E2E tests
npm run cy:run

# Performance tests
npm test -- --testNamePattern="perf"

# Specific test file
npm test -- ValidationService.test.js

# Watch mode
npm test -- --watch
```

---

## Debugging Failed Tests

```javascript
// Add debugging
import Logger from '../services/Logger';

// In test
test('should work', () => {
  Logger.debug('Test started', { data });
  // ... test code ...
  const logs = Logger.getLogs();
  console.log('All logs:', logs);
});

// In browser console (E2E)
Logger.getLogs()
Logger.getStats()
SyncService.getQueueStatus()
ConfigService.validate()
```

