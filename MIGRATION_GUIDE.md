# 🔄 Migration Guide: Integrating New Services

## Quick Start

Convert your existing components to use the new service layer. This guide shows the before/after patterns.

---

## 1. Task Validation Migration

### Before (Old Pattern)
```javascript
// Scattered validation throughout components
function TaskForm({ initialTask }) {
  const handleSubmit = (formData) => {
    // Manual validation
    if (!formData.title or formData.title.length < 3) {
      alert('Title too short');
      return;
    }
    if (formData.duration < 15 || formData.duration > 480) {
      alert('Invalid duration');
      return;
    }
    // ... more manual checks
    saveTask(formData);
  };
}
```

### After (New Pattern)
```javascript
import ValidationService from '../services/ValidationService';
import Logger from '../services/Logger';

function TaskForm({ initialTask }) {
  const handleSubmit = async (formData) => {
    // Centralized validation with detailed feedback
    const validation = ValidationService.validateTask(formData);
    
    if (!validation.valid) {
      Logger.warn('Task validation failed', { errors: validation.errors });
      // Display errors to user
      setErrors(validation.errors);
      return;
    }

    // Proceed with save
    await saveTask(formData);
    Logger.info('Task saved', { taskId: formData.id });
  };
}
```

---

## 2. Database Operations Migration

### Before (Old Pattern)
```javascript
// Direct Supabase calls scattered everywhere
async function saveTasks(tasks) {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .insert(tasks);
    
    if (error) throw error;
    
    // Manually handling offline still requires storing in localStorage
    localStorage.setItem('tasks_backup', JSON.stringify(tasks));
    return data;
  } catch (error) {
    console.error('Save failed:', error);
    // Manually retry or queue?
    throw error;
  }
}
```

### After (New Pattern)
```javascript
import SyncService from '../services/SyncService';
import Logger from '../services/Logger';

async function saveTasks(tasks) {
  // Single call handles offline, retry, queuing, logging
  const result = await SyncService.uploadBatch('tasks', tasks);
  
  if (result.success) {
    Logger.info('Tasks saved to Supabase', { count: tasks.length });
    return result.data;
  } else if (result.queued) {
    Logger.warn('Tasks queued for sync', { queueId: result.queueId });
    return { queued: true };
  } else {
    Logger.error('Failed to save tasks', result.error);
    throw result.error;
  }
}
```

**What Changed:**
- ✅ Automatic offline detection
- ✅ Automatic retry with exponential backoff
- ✅ Queue persistence (survives page reload)
- ✅ Centralized error handling
- ✅ Built-in logging

---

## 3. Error Handling Migration

### Before (Old Pattern)
```javascript
// Try-catch scattered everywhere, inconsistent handling
function Dashboard() {
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData()
      .catch(err => {
        console.error('Load failed:', err);
        setError('Something went wrong'); // Generic message
      });
  }, []);

  if (error) return <div>{error}</div>;
  // ... rest of component
}
```

### After (New Pattern)
```javascript
import { ErrorBoundary, AsyncOperation } from '../components/Error';
import Logger from '../services/Logger';

function Dashboard() {
  const [error, setError] = useState(null);

  const handleLoadData = async () => {
    try {
      return await loadData();
    } catch (err) {
      const handled = ErrorHandler.handle(err, { 
        function: 'loadData',
        component: 'Dashboard'
      });
      setError(handled.error);
      throw handled;
    }
  };

  return (
    <ErrorBoundary name="Dashboard">
      <AsyncOperation
        error={error}
        onRetry={() => handleLoadData()}
      >
        <DashboardContent />
      </AsyncOperation>
    </ErrorBoundary>
  );
}
```

**What Changed:**
- ✅ Hierarchical error catching (component → boundary)
- ✅ Automatic error reporting
- ✅ User-friendly error display
- ✅ Built-in retry logic

---

## 4. Logging Migration

### Before (Old Pattern)
```javascript
// Inconsistent logging
function ScheduleWeek(weekStart) {
  console.log('Starting schedule for', weekStart);
  
  const days = scheduleWeek(weekStart, tasks);
  
  if (days.some(d => d.overbooking)) {
    console.warn('Some days are overbooked');
  }
  
  console.log('Schedule completed with', days.length, 'days');
  
  // No way to retrieve logs later
}
```

### After (New Pattern)
```javascript
import Logger from '../services/Logger';

function ScheduleWeek(weekStart) {
  Logger.logSchedulerOperation('start', { weekStart });
  
  const days = scheduleWeek(weekStart, tasks);
  
  const overbooked = days.filter(d => d.overbooking);
  if (overbooked.length > 0) {
    Logger.warn('Days are overbooked', { 
      count: overbooked.length,
      days: overbooked.map(d => d.date)
    });
  }
  
  Logger.logSchedulerOperation('complete', { 
    dayCount: days.length,
    overbooked: overbooked.length
  });
  
  // Can export logs anytime: Logger.exportLogs()
  // Can view all logs: Logger.getLogs()
}
```

**What Changed:**
- ✅ Structured, domain-specific logging
- ✅ Automatic timestamp and context
- ✅ Log history preserved (last 500 entries)
- ✅ Export/debug capabilities
- ✅ Performance tracking

---

## 5. Configuration Migration

### Before (Old Pattern)
```javascript
// Global config scattered across files
const DEFAULT_DAY_START = 8;
const DEFAULT_DAY_END = 18;
const BLOCK_DURATION = 45;

// Different files have different constants
// Impossible to change at runtime
// No way to validate config

function getConfig(key) {
  // Not actually used consistently
}
```

### After (New Pattern)
```javascript
import ConfigService from '../services/ConfigService';

// All config centralized and validated
ConfigService.set('SCHEDULER.defaultDayStart', 8);
ConfigService.set('SCHEDULER.blockDuration', 45);

// Can retrieve anytime with defaults
const dayStart = ConfigService.get('SCHEDULER.defaultDayStart', 8);
const blockDuration = ConfigService.get('SCHEDULER.blockDuration', 45);

// Listen for changes
ConfigService.listen('SCHEDULER.blockDuration', (newVal, oldVal) => {
  Logger.info('Config changed', { key: 'blockDuration', newVal, oldVal });
  // UI can react to config changes
});

// Validate all config
const validation = ConfigService.validate();
if (!validation.valid) {
  Logger.error('Config validation failed', validation.errors);
}
```

**What Changed:**
- ✅ Runtime configuration
- ✅ Default values support
- ✅ Change notifications
- ✅ Validation support
- ✅ Centralized management

---

## 6. Async Operations Migration

### Before (Old Pattern)
```javascript
// Manual loading/error state management
function SearchTasks() {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSearch = async (query) => {
    setLoading(true);
    setError(null);
    try {
      const data = await searchAPI(query);
      setResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {loading && <Spinner />}
      {error && <Error message={error} />}
      {results && <ResultsList items={results} />}
    </>
  );
}
```

### After (New Pattern)
```javascript
import { useAsync } from '../hooks/usePerformance';
import AsyncOperation from '../components/Error/AsyncOperation';

function SearchTasks() {
  const [query, setQuery] = useState('');
  
  // Hook handles all state automatically
  const { data: results, loading, error, execute } = useAsync(
    () => searchAPI(query),
    false // don't run immediately
  );

  return (
    <>
      <input 
        value={query} 
        onChange={(e) => {
          setQuery(e.target.value);
          execute(); // Manual trigger
        }} 
      />
      <AsyncOperation
        isLoading={loading}
        error={error}
        onRetry={execute}
      >
        {results && <ResultsList items={results} />}
      </AsyncOperation>
    </>
  );
}
```

**What Changed:**
- ✅ Single hook manages all state
- ✅ Built-in error display
- ✅ Built-in retry mechanism
- ✅ Less boilerplate code
- ✅ Consistent handling across app

---

## 7. Performance Optimization Migration

### Before (Old Pattern)
```javascript
// Expensive calculations run every render
function TaskDashboard({ tasks }) {
  // This recalculates every time - expensive!
  const taskStats = tasks.reduce((acc, task) => {
    // Heavy computation
    return {
      ...acc,
      completed: acc.completed + (task.completed ? 1 : 0),
      // ... more calculations
    };
  }, {});

  // Filtering creates new array every render
  const searchResults = tasks.filter(t => 
    t.title.includes(searchInput)
  );

  return <Display stats={taskStats} results={searchResults} />;
}
```

### After (New Pattern)
```javascript
import { 
  useEffectiveMemo, 
  useDebounce,
  useThrottle 
} from '../hooks/usePerformance';

function TaskDashboard({ tasks }) {
  const [searchInput, setSearchInput] = useState('');
  
  // Memoized calculation - only runs when tasks change
  const taskStats = useEffectiveMemo(() => {
    return tasks.reduce((acc, task) => {
      return {
        ...acc,
        completed: acc.completed + (task.completed ? 1 : 0),
      };
    }, {});
  }, [tasks]);

  // Debounced search - waits 300ms after typing stops
  const debouncedSearch = useDebounce(searchInput, 300);
  
  const searchResults = useEffectiveMemo(() => {
    return tasks.filter(t => t.title.includes(debouncedSearch));
  }, [tasks, debouncedSearch]);

  return <Display stats={taskStats} results={searchResults} />;
}
```

**What Changed:**
- ✅ Expensive calculations cached
- ✅ Search debounced (API calls reduced)
- ✅ Unnecessary renders prevented
- ✅ Better user experience
- ✅ Less CPU/network usage

---

## 8. Step-by-Step Migration Checklist

### Phase 1: Add Services to Root Component
```javascript
// App.jsx
import { ErrorBoundary } from './components/Error';

export default function App() {
  return (
    <ErrorBoundary name="App">
      {/* Your existing app */}
    </ErrorBoundary>
  );
}
```

### Phase 2: Replace Validation
- Replace manual form validation → `ValidationService.validateTask()`
- Replace error checks → `ValidationService.isValidDate()`, etc.
- Update all form components

### Phase 3: Replace Database Calls
- Replace `supabase` direct calls → `SyncService.upload()`, `download()`
- Replace localStorage operations → use `SyncService` queuing
- Update all service layer files

### Phase 4: Add Error Handling
- Wrap risky operations → `ErrorHandler.handle()`
- Replace error messages → ErrorBoundary + AsyncOperation
- Update error displays

### Phase 5: Add Logging
- Replace `console.log()` → `Logger.info()`
- Add domain-specific logs → `Logger.logTaskOperation()`
- Update all important functions

### Phase 6: Optimize Performance
- Identify expensive calculations
- Wrap with `useEffectiveMemo()`
- Add debounce to search/filter inputs
- Monitor with `usePerformanceMonitor()`

### Phase 7: Test Everything
- Verify validation works
- Test offline → online sync
- Check error boundaries catch errors
- Validate logging appears
- Monitor performance improvement

---

## Common Patterns

### Pattern 1: Form Submission
```javascript
const handleSubmit = async (formData) => {
  // 1. Validate
  const validation = ValidationService.validateTask(formData);
  if (!validation.valid) {
    setErrors(validation.errors);
    return;
  }

  // 2. Save
  const result = await SyncService.upload('tasks', formData);
  if (!result.success) {
    Logger.error('Save failed', result.error);
    return;
  }

  // 3. Log success
  Logger.info('Task saved', { taskId: result.data.id });
};
```

### Pattern 2: Data Loading
```javascript
const { data, loading, error, execute } = useAsync(
  async () => {
    const results = await SyncService.download('tasks', filters);
    Logger.info('Tasks loaded', { count: results.length });
    return results;
  },
  true // immediate
);

return (
  <AsyncOperation isLoading={loading} error={error} onRetry={execute}>
    {data && <TaskList tasks={data} />}
  </AsyncOperation>
);
```

### Pattern 3: Error Handling
```javascript
<ErrorBoundary name="ModuleName">
  <AsyncOperation isLoading={loading} error={error}>
    <YourComponent />
  </AsyncOperation>
</ErrorBoundary>
```

---

## Troubleshooting

### "SyncService not syncing to Supabase"
```javascript
// Check queue status
import SyncService from '../services/SyncService';
const status = SyncService.getQueueStatus();
console.log(status);
// { queueLength, isSyncing, isOnline, queue }

// Check logs
import Logger from '../services/Logger';
Logger.getLogs({ level: 'ERROR' });
```

### "ErrorBoundary not catching errors"
- Error boundaries only catch rendering errors, not async errors
- Wrap async errors → `ErrorHandler.handle()`
- Use `AsyncOperation` for async states

### "Validation not working"
```javascript
// Check validation result
const result = ValidationService.validateTask(task);
console.log(result); // { valid, errors }

// Check config
const validation = ConfigService.validate();
console.log(validation);
```

---

## Performance Checklist

- [ ] Replaced manual memoization with `useEffectiveMemo`
- [ ] Added `useDebounce` to search inputs
- [ ] Added `useThrottle` to scroll/resize handlers
- [ ] Using `useLocalStorage` for preferences
- [ ] Using `useInView` for lazy loading
- [ ] Wrapped all async with `AsyncOperation`
- [ ] Using `useAsync` for data fetching
- [ ] Logger imports for important events
- [ ] No direct `console.log()` calls in new code
- [ ] All DB calls go through `SyncService`
- [ ] All validation uses `ValidationService`

---

## Next Steps

After migration:
1. Run unit tests to verify behavior
2. Test offline functionality
3. Check browser DevTools → Memory for leaks
4. Monitor Logger.getLogs() for errors
5. Export logs if issues occur

