/**
 * Async Error Component
 * ====================
 * Displays loading/error/success states for async operations
 * Provides automatic retry with exponential backoff
 * 
 * Usage:
 * <AsyncOperation
 *   isLoading={loading}
 *   error={error}
 *   onRetry={() => refetch()}
 * >
 *   <YourContent />
 * </AsyncOperation>
 */

import React from 'react';
import Logger from '../../services/Logger';

const AsyncOperation = ({
  isLoading = false,
  error = null,
  children,
  onRetry = null,
  loadingMessage = 'טוען...',
  errorMessage = null,
  retryable = true,
  maxRetries = 3,
  onMaxRetriesReached = null
}) => {
  const [retryCount, setRetryCount] = React.useState(0);
  const [isRetrying, setIsRetrying] = React.useState(false);

  const handleRetry = React.useCallback(async () => {
    if (retryCount >= maxRetries) {
      Logger.warn('Max retries reached', { retryCount });
      onMaxRetriesReached?.();
      return;
    }

    setIsRetrying(true);
    setRetryCount(prev => prev + 1);

    try {
      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, retryCount) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));

      onRetry?.();
    } catch (err) {
      Logger.error('Retry failed', err);
    } finally {
      setIsRetrying(false);
    }
  }, [retryCount, maxRetries, onRetry, onMaxRetriesReached]);

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          backgroundColor: '#f5f5f5',
          borderRadius: '4px',
          minHeight: '100px'
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: '24px',
              marginBottom: '10px',
              animation: 'spin 1s linear infinite'
            }}
          >
            ⟳
          </div>
          <p style={{ color: '#666', margin: 0 }}>{loadingMessage}</p>
        </div>

        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          padding: '15px',
          backgroundColor: '#fee',
          border: '2px solid #f44336',
          borderRadius: '4px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
          <span style={{ fontSize: '20px', flexShrink: 0 }}>❌</span>
          <div style={{ flex: 1 }}>
            <h4 style={{ margin: '0 0 5px 0', color: '#c62828' }}>שגיאה</h4>
            <p style={{ margin: '5px 0', fontSize: '14px', color: '#d32f2f' }}>
              {errorMessage || error?.message || 'שגיאה לא ידועה'}
            </p>

            {process.env.NODE_ENV === 'development' && error?.stack && (
              <details style={{ marginTop: '10px', fontSize: '12px' }}>
                <summary style={{ cursor: 'pointer', color: '#666' }}>
                  Stack trace
                </summary>
                <pre
                  style={{
                    backgroundColor: '#f5f5f5',
                    padding: '8px',
                    borderRadius: '4px',
                    overflow: 'auto',
                    marginTop: '8px'
                  }}
                >
                  {error.stack}
                </pre>
              </details>
            )}

            {retryable && onRetry && (
              <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
                <button
                  onClick={handleRetry}
                  disabled={isRetrying || retryCount >= maxRetries}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#ff9800',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: isRetrying ? 'wait' : 'pointer',
                    opacity: isRetrying || retryCount >= maxRetries ? 0.6 : 1,
                    fontSize: '12px'
                  }}
                >
                  {isRetrying ? 'מנסה שוב...' : 'נסו שוב'}
                </button>

                {retryCount > 0 && (
                  <span style={{ fontSize: '12px', color: '#666', alignSelf: 'center' }}>
                    ניסיון {retryCount} מתוך {maxRetries}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return children;
};

export default AsyncOperation;
