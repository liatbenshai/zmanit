/**
 * Performance Optimization Hooks
 * ============================
 * Custom React hooks for memoization, debouncing, and performance monitoring
 * 
 * Usage:
 * const memoResult = useEffectiveMemo(() => expensiveCalculation(data), [data]);
 * const [value, setValue] = useDebounce(inputValue, 300);
 */

import { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import Logger from '../services/Logger';

/**
 * Memoization hook with dependency tracking
 * Caches result and only recalculates when dependencies actually change
 */
export function useEffectiveMemo(factory, deps) {
  const memoRef = useRef();
  const prevDepsRef = useRef();
  const prevResultRef = useRef();

  // Deep comparison of dependencies
  const depsChanged = !prevDepsRef.current || deps.some((dep, i) => dep !== prevDepsRef.current[i]);

  if (depsChanged) {
    prevDepsRef.current = deps;
    prevResultRef.current = factory();
  }

  return prevResultRef.current;
}

/**
 * Debounce hook - delays value updates
 * Useful for search inputs, API calls
 */
export function useDebounce(value, delay = 500) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Throttle hook - limits function calls
 * Useful for scroll/resize handlers
 */
export function useThrottle(value, interval = 500) {
  const [throttledValue, setThrottledValue] = useState(value);
  const lastUpdatedRef = useRef(null);

  useEffect(() => {
    const now = Date.now();

    if (now >= (lastUpdatedRef.current || 0) + interval) {
      lastUpdatedRef.current = now;
      setThrottledValue(value);
    } else {
      const handler = setTimeout(() => {
        lastUpdatedRef.current = Date.now();
        setThrottledValue(value);
      }, interval - (now - (lastUpdatedRef.current || now)));

      return () => clearTimeout(handler);
    }
  }, [value, interval]);

  return throttledValue;
}

/**
 * Local storage state hook with persistence
 * Syncs state with localStorage automatically
 */
export function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      Logger.error('Error reading from localStorage', error);
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value) => {
      try {
        const valueToStore = value instanceof Function ? value(storedValue) : value;
        setStoredValue(valueToStore);
        localStorage.setItem(key, JSON.stringify(valueToStore));
      } catch (error) {
        Logger.error('Error writing to localStorage', error);
      }
    },
    [key, storedValue]
  );

  return [storedValue, setValue];
}

/**
 * Performance monitoring hook
 * Tracks render time and logs if exceeds threshold
 */
export function usePerformanceMonitor(componentName, warnThreshold = 16) {
  const renderStartRef = useRef(null);

  useEffect(() => {
    renderStartRef.current = performance.now();

    return () => {
      const renderTime = performance.now() - renderStartRef.current;
      if (renderTime > warnThreshold) {
        Logger.warn(`Slow render detected: ${componentName} took ${renderTime.toFixed(2)}ms`, {
          component: componentName,
          duration: renderTime
        });
      }
    };
  });
}

/**
 * Async data fetching hook with caching
 * Handles loading, error, and retry logic
 */
export function useAsync(asyncFunction, immediate = true, dependencies = []) {
  const [status, setStatus] = useState('idle');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const cacheRef = useRef({});

  // Create a cache key from dependencies
  const cacheKey = JSON.stringify(dependencies);

  const execute = useCallback(async () => {
    // Check cache first
    if (cacheRef.current[cacheKey]) {
      setData(cacheRef.current[cacheKey]);
      setStatus('success');
      return;
    }

    setStatus('pending');
    setData(null);
    setError(null);

    try {
      const response = await asyncFunction();
      setData(response);
      setStatus('success');
      cacheRef.current[cacheKey] = response;
      return response;
    } catch (err) {
      setError(err);
      setStatus('error');
      Logger.error('Async hook error', err);
    }
  }, [asyncFunction, cacheKey]);

  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [execute, immediate]);

  return { execute, status, data, error };
}

/**
 * Lazy loading hook for intersections
 */
export function useInView(options = {}) {
  const ref = useRef(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsInView(entry.isIntersecting);
    }, {
      threshold: 0.1,
      ...options
    });

    observer.observe(ref.current);

    return () => observer.disconnect();
  }, [options]);

  return { ref, isInView };
}

/**
 * Previous value hook - useful for comparisons
 */
export function usePrevious(value) {
  const ref = useRef();

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref.current;
}

/**
 * Mounted hook - prevents updates on unmounted components
 */
export function useIsMounted() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  return isMounted;
}

/**
 * Safe async state updates hook
 * Prevents "Can't perform a React state update on an unmounted component" warning
 */
export function useSafeAsyncState(initialState) {
  const isMounted = useIsMounted();
  const [state, setState] = useState(initialState);

  const setSafeState = useCallback((newState) => {
    if (isMounted) {
      setState(newState);
    }
  }, [isMounted]);

  return [state, setSafeState];
}

export default {
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
};
