# 🏗️ Architecture Overview

## System Design After Phases 1-5

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     React Components Layer                   │
│  - ErrorBoundary (catches errors)                             │
│  - AsyncOperation (displays states)                           │
│  - All business components                                    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    Hooks Layer                                │
│  - useAsync, useDebounce, useThrottle                         │
│  - useLocalStorage, usePerformanceMonitor                     │
│  - useInView, usePrevious, useIsMounted                       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    Services Layer                             │
│  ┌────────────────┐  ┌───────────────┐  ┌─────────────────┐ │
│  │ SyncService    │  │ ErrorHandler  │  │ ValidationSvc   │ │
│  │ - Up/download  │  │ - Error mgmt  │  │ - Input rules   │ │
│  │ - Queue logic  │  │ - Logging     │  │ - Type checks   │ │
│  │ - Retry       │  │ - AppError    │  │ - Conflict det  │ │
│  └────────────────┘  └───────────────┘  └─────────────────┘ │
│                                                               │
│  ┌────────────────┐  ┌───────────────┐                       │
│  │ ConfigService  │  │ Logger        │                       │
│  │ - Config mgmt  │  │ - All logs    │                       │
│  │ - Validation   │  │ - History     │                       │
│  │ - Listeners    │  │ - Export/DL   │                       │
│  └────────────────┘  └───────────────┘                       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   Utilities Layer                             │
│  ┌──────────────────┐     ┌──────────────────┐              │
│  │ smartSchedulerV4 │     │ learningEngine   │              │
│  │ + Validation     │     │ + SyncService   │              │
│  │ + Error handling │     │ + Logging       │              │
│  │ + Safe entry pt  │     │ + Offline queue │              │
│  └──────────────────┘     └──────────────────┘              │
│          + schedulerHelpers                                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              External Services                               │
│  ┌──────────────┐          ┌──────────────┐                 │
│  │  Supabase    │          │ localStorage │                 │
│  │  - Database  │  sync ↔  │ - Offline    │                 │
│  │  - Auth      │  with    │ - Cache      │                 │
│  │  - Storage   │  queue   │ - Fallback   │                 │
│  └──────────────┘          └──────────────┘                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagram

### Creating a Task

```
User Form Input
    ↓
[ValidationService]
    ├─ Validate task object
    ├─ Check date/time formats
    ├─ Check for conflicts
    └─ Return errors if invalid
    ↓ (Valid)
[SyncService.upload]
    ├─ Check network status
    ├─ Try upload to Supabase
    ├─ If online → Success
    └─ If offline → Queue to localStorage
    ↓
[Logger.logTaskOperation]
    └─ Log: "Task created", { taskId, action }
    ↓
[Component State Update]
    └─ Show success message
```

### Loading Tasks (Weekly Schedule)

```
User navigates to Schedule
    ↓
[useAsync Hook]
    ├─ Check cache (browser memory)
    ├─ Show loading spinner
    └─ Call data fetch
    ↓
[SyncService.download]
    ├─ Check network status
    ├─ Fetch from Supabase OR localStorage
    ├─ Apply filters, ordering, limit
    └─ Return data
    ↓
[smartSchedulerV4]
    ├─ Input validation (all tasks)
    ├─ Schedule week algorithm
    ├─ Detect conflicts
    ├─ Separate home/work
    └─ Return { days, summary, warnings }
    ↓
[Component Render]
    ├─ useEffectiveMemo cached calculation
    ├─ Render schedule UI
    └─ Display warnings if any
```

### Completing a Task

```
User clicks "Complete"
    ↓
[Validation]
    └─ Validate task still exists
    ↓
[SyncService.update]
    ├─ Mark complete, save duration
    ├─ Upload to Supabase OR queue
    └─ Update localStorage cache
    ↓
[learningEngine.recordCompletion]
    ├─ Upload to learning_records
    ├─ Queue if offline
    ├─ Update accuracy score
    └─ Trigger insights recalc
    ↓
[Logger.logTaskOperation]
    └─ Log completion event
    ↓
[UI Update]
    ├─ Remove from today's list
    ├─ Show success message
    └─ Update insights display
```

### Error Flow (With Recovery)

```
Operation Fails
    ↓
[ErrorHandler.handle]
    ├─ Catch error
    ├─ Add context (function, service, data)
    ├─ Create AppError object
    └─ Log to Logger
    ↓
    ├─ Component Level
    │   ├─ Set error state
    │   ├─ Show AsyncOperation error UI
    │   └─ Display retry button
    ├─ UI Level
    │   └─ ErrorBoundary shows fallback UI
    └─ Service Level
        ├─ SyncService queues for retry
        ├─ Exponential backoff (1s, 2s, 4s)
        └─ Auto-retry on network restore
    ↓
User clicks Retry / Goes Online
    ↓
[processSyncQueue or Component Retry]
    ├─ Resend failed operation
    ├─ Log retry attempt
    └─ Update UI on success/failure
```

---

## Service Interaction Matrix

| Service A | Service B | Interaction | Purpose |
|-----------|-----------|-------------|---------|
| smartSchedulerV4 | ValidationService | Calls validate() | Ensures all tasks valid |
| smartSchedulerV4 | SyncService | Calls upload() | Saves schedule |
| smartSchedulerV4 | Logger | Calls log() | Tracks operations |
| learningEngine | SyncService | Calls upload/download | Persists learning data |
| learningEngine | ValidationService | Calls isValidTask() | Validates input |
| learningEngine | Logger | Calls logLearningEvent() | Tracks patterns |
| SyncService | Logger | Calls logSyncOp() | Tracks sync events |
| ErrorHandler | Logger | Calls error() | Logs all errors |
| ConfigService | ValidationService | Validates config | Ensures valid settings |
| useAsync Hook | SyncService | Calls download() | Fetches data |
| ErrorBoundary | ErrorHandler | Uses AppError | Displays errors |
| AsyncOperation | ErrorHandler | Shows errors | User feedback |

---

## State Management Pattern

### Before (Old Pattern)
```
Component ├─ useState for form
          ├─ useState for loading
          ├─ useState for error
          ├─ useState for data
          └─ Direct supabase calls (scattered)
```

### After (New Pattern)
```
Component ├─ useState for local UI state
          ├─ useAsync Hook for data
          │  ├─ Automatically manages loading/error/data
          │  ├─ Built-in caching
          │  └─ Built-in retry
          │
          └─ useLocalStorage for persistent prefs
             ├─ Auto-syncs to localStorage
             └─ Survives page reload
```

---

## Error Handling Strategy

### Three-Level Safety Net

**Level 1: Input Validation**
```javascript
ValidationService.validateTask(task)
// Catches: bad data types, missing fields, invalid dates
// Scope: All inputs before processing
```

**Level 2: Operation Error Handling**
```javascript
try {
  await SyncService.upload(...)
} catch (error) {
  ErrorHandler.handle(error, { context })
}
// Catches: network errors, sync errors, database errors
// Scope: Data operations
```

**Level 3: Component/Boundary Error Handling**
```jsx
<ErrorBoundary>
  <Component /> // Catches rendering errors
</ErrorBoundary>
```

### Error Recovery Cascade

```
No Retry
├─ Validation errors → User fixes and resubmits
└─ Usage errors → Show user friendly message

Auto-Retry (SyncService)
├─ Network errors → Exponential backoff
├─ Temporary failures → Queue and retry
└─ Offline → Queue and sync when online

Manual Retry (AsyncOperation)
├─ Timeout errors → User clicks retry
├─ API errors → User clicks retry
└─ Component errors → User clicks reload
```

---

## Offline Strategy

### Data Sync Flow

```
Online State                 Offline State
|                            |
SyncService.upload() ─────→  localStorage queue
        |                            |
        ├─ Success                  ├─ Retry 1s
        ├─ Retry (fail)  ────────→  ├─ Retry 2s
        └─ Queue offline ────────→  ├─ Retry 4s
                                    └─ Wait for online
                                           |
                                           ↓
                                    Auto-sync on restore
                                           |
                                           ↓
                                    processSyncQueue()
                                           |
                                           ↓
                                    Upload all queued
```

### Offline Capabilities

✅ **Can Do Offline:**
- Create tasks (queued)
- Edit tasks (queued)
- Delete tasks (queued)
- View existing tasks (cached)
- Complete tasks (queued with learning record)
- Schedule tasks (calculated locally)
- View insights (cached stats)

❌ **Cannot Do Offline:**
- Google Calendar sync
- Multi-user collaboration
- Real-time updates
- Cloud storage access

---

## Performance Optimization Layers

### Layer 1: Component Level
```javascript
useEffectiveMemo   // Expensive calculations cached
useDebounce        // Search/filter debounced
useThrottle        // Scroll/resize throttled
useInView          // Lazy load components
```

### Layer 2: Hook Level
```javascript
useAsync           // Data fetching with cache
useLocalStorage    // Persistent state
useSafeAsyncState  // Safe unmounted updates
```

### Layer 3: Service Level
```javascript
SyncService        // Batch operations
ValidationService  // Quick format checks
Logger            // Async logging (doesn't block)
```

### Layer 4: UI Level
```javascript
Code splitting      // Load components on demand
Image optimization  // Next-gen formats
CSS minification    // Tailwind purging
```

---

## Config & Customization

### Configuration Hierarchy

```
Default Config (hardcoded)
        ↓
ConfigService.get() with defaults
        ↓
User preferences (localStorage)
        ↓
Admin settings (Supabase)
        ↓
Runtime overrides (temp changes)
```

### Config Sections

**SCHEDULER Configuration**
```javascript
{
  defaultDayStart: 8,           // 8 AM
  defaultDayEnd: 18,            // 6 PM
  blockDuration: 45,            // minutes
  breakDuration: 5,             // minutes
  homeHours: { start: 18, end: 8 },
  workHours: { start: 8, end: 18 },
  priorityDistribution: {
    high: 0.3,
    medium: 0.5,
    low: 0.2
  }
}
```

**VALIDATION Configuration**
```javascript
{
  MIN_TASK_DURATION: 15,        // minutes
  MAX_TASK_DURATION: 480,       // minutes
  MIN_TASK_TITLE_LENGTH: 3,
  MAX_TASKS_PER_DAY: 20
}
```

---

## Logging Architecture

### Log Levels (Filtering Available)

```
DEBUG    (development only)
  ↓
INFO     (important events)
  ↓
WARN     (concerning conditions)
  ↓
ERROR    (failures)
```

### Log Categories (Searchable)

```
- TaskOperation: create, update, delete, complete
- SchedulerOperation: week-schedule, reschedule
- SyncOperation: upload, download, queue, process
- LearningEvent: completion, interruption, accuracy
- PerformanceMetrics: timing, memory, renders
- ValidationEvent: errors, conflicts
```

### Log Storage & Export

```
In-Memory Buffer (Last 500 entries)
        ↓
   Export to JSON
        ↓
   Download to file
        ↓
   Send to analytics (optional)
```

---

## Testing Architecture

### Test Pyramid

```
        /\
       /  \      E2E Tests (Complete workflows)
      /────\    
     /      \   Integration Tests (Service interactions)
    /────────\
   /          \  Unit Tests (Individual functions)
  /____________\
```

### Test Coverage by Layer

- **Services**: 90%+ unit tests
- **Hooks**: 85%+ unit tests
- **Components**: 80%+ integration tests
- **Utils**: 85%+ unit tests
- **E2E**: Critical workflows covered

---

## Monitoring & Debugging

### Developer Tools Integration

```javascript
// Browser Console Access
Logger.getLogs()              // View all logs
Logger.getLogs({ level: 'ERROR' })  // View errors
Logger.getStats()             // Log statistics
Logger.downloadLogs()         // Export to file

SyncService.getQueueStatus()  // Check sync queue
ConfigService.validate()      // Validate settings
```

### Performance Monitoring

```javascript
// DevTools Integration
Performance tab    // React Profiler data
Network tab       // API calls & sync activity
Storage tab       // localStorage queue contents
Memory tab        // Heap snapshots & leaks
```

---

## Deployment Considerations

### Before Deployment

- [ ] All unit tests passing
- [ ] Integration tests passing
- [ ] E2E tests passing (critical workflows)
- [ ] Performance baseline established
- [ ] Logs reviewed for errors
- [ ] Config validated
- [ ] Offline mode tested
- [ ] Error boundaries tested
- [ ] Mobile responsiveness checked
- [ ] Accessibility audit passed

### After Deployment

- [ ] Monitor error logs (first 24h)
- [ ] Track sync queue metrics
- [ ] Monitor performance metrics
- [ ] Collect user feedback
- [ ] Review Analytics
- [ ] Check for memory leaks (48h+)

---

## Future Enhancements

### Phase 10+: Analytics Integration
```javascript
// Send to analytics service
ErrorHandler.setAnalyticsAction(error => {
  analytics.captureException(error);
});

Logger.setAnalyticsAction(log => {
  analytics.captureEvent(log);
});
```

### Phase 11: Real-time Sync
```javascript
SyncService.enableRealtimeSubscription('tasks', (update) => {
  // Broadcast to all components
  // Merge remote changes with local
});
```

### Phase 12: Advanced Conflict Resolution
```javascript
SyncService.setConflictResolver((local, remote) => {
  // Merge strategies for specific tables
  return mergedData;
});
```

---

## Architecture Principles

### 1. **Separation of Concerns**
- Services handle data
- Components handle UI
- Hooks handle state
- Utils handle algorithms

### 2. **Single Responsibility**
- ValidationService: Input validation only
- SyncService: Data sync only
- ErrorHandler: Error management only

### 3. **Dependency Injection**
- ConfigService provides configuration
- No global state pollution
- Easy testing with mocks

### 4. **Error-First Design**
- Errors are caught at every layer
- Never silently fail
- Always log failures

### 5. **Progressive Enhancement**
- Works offline
- Works with poor connectivity
- Works with JavaScript disabled (graceful degradation)

### 6. **Performance First**
- Memoization by default
- Debounce/throttle on inputs
- Lazy load components
- Batch database operations

---

## Quick Start Integration

### Step 1: Wrap App with Error Boundary
```jsx
// App.jsx
import { ErrorBoundary } from './components/Error';

export default function App() {
  return (
    <ErrorBoundary name="App">
      {/* your app */}
    </ErrorBoundary>
  );
}
```

### Step 2: Replace Direct Supabase Calls
```javascript
// Before
const { data } = await supabase.from('tasks').insert(task);

// After
const result = await SyncService.upload('tasks', task);
```

### Step 3: Validate All Inputs
```javascript
// Before
if (!task.title) throw new Error('Title required');

// After
const { valid, errors } = ValidationService.validateTask(task);
if (!valid) return;
```

### Step 4: Use Hooks for Performance
```javascript
// Before
const result = heavyCalc();

// After
const result = useEffectiveMemo(() => heavyCalc(), [deps]);
```

---

## Summary

The new architecture provides:

✅ **Reliability**: 3-level error handling + recovery
✅ **Performance**: Multiple optimization layers
✅ **Maintainability**: Clear separation of concerns
✅ **Scalability**: Service-based design
✅ **Debuggability**: Comprehensive logging
✅ **Offline Support**: Automatic queuing + sync
✅ **User Experience**: Smooth error recovery
✅ **Developer Experience**: Simple APIs + good documentation

