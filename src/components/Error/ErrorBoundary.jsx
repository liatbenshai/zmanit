/**
 * Global Error Boundary Component
 * ==============================
 * Catches JavaScript errors anywhere in the child component tree
 * Logs error information and displays fallback UI
 * 
 * Usage:
 * <ErrorBoundary>
 *   <YourComponent />
 * </ErrorBoundary>
 */

import React from 'react';
import Logger from '../services/Logger';
import ErrorHandler from '../services/ErrorHandler';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
      lastErrorTime: null
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    const errorCount = this.state.errorCount + 1;

    // Log error with context
    Logger.error('React Error Boundary caught error', {
      error: error.toString(),
      componentStack: errorInfo.componentStack,
      count: errorCount
    });

    this.setState({
      errorInfo,
      errorCount,
      lastErrorTime: new Date().toISOString()
    });

    // Report to monitoring service in production
    if (process.env.NODE_ENV === 'production') {
      this._reportErrorToService(error, errorInfo, errorCount);
    }

    // If too many errors, might indicate a critical issue
    if (errorCount > 5) {
      Logger.error('Too many errors from component', {
        count: errorCount,
        component: this.props.name || 'Unknown'
      });
    }
  }

  _reportErrorToService = (error, errorInfo, count) => {
    if (typeof fetch === 'undefined') return;

    fetch('/api/errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: error?.message,
        stack: error?.stack,
        componentStack: errorInfo?.componentStack,
        count,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent
      })
    }).catch(err => {
      Logger.warn('Could not report error to service', err);
    });
  };

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: '20px',
            margin: '10px',
            backgroundColor: '#fee',
            border: '2px solid #f44336',
            borderRadius: '4px',
            fontFamily: 'Arial, sans-serif'
          }}
        >
          <h2 style={{ color: '#c62828', marginTop: 0 }}>משהו השתבש 😞</h2>

          <details
            style={{
              cursor: 'pointer',
              marginBottom: '15px',
              padding: '10px',
              backgroundColor: 'rgba(244, 67, 54, 0.1)',
              borderRadius: '4px'
            }}
          >
            <summary style={{ fontWeight: 'bold', color: '#c62828' }}>
              פרטי שגיאה
            </summary>

            <pre
              style={{
                backgroundColor: '#f5f5f5',
                padding: '10px',
                borderRadius: '4px',
                overflow: 'auto',
                fontSize: '12px',
                marginTop: '10px'
              }}
            >
              {this.state.error?.toString()}
              {'\n\n'}
              {this.state.errorInfo?.componentStack}
            </pre>

            {process.env.NODE_ENV === 'development' && (
              <div style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
                <p>
                  <strong>Component:</strong> {this.props.name || 'Unknown'}
                </p>
                <p>
                  <strong>Error Count:</strong> {this.state.errorCount}
                </p>
                <p>
                  <strong>Time:</strong> {this.state.lastErrorTime}
                </p>
              </div>
            )}
          </details>

          <div
            style={{
              display: 'flex',
              gap: '10px',
              flexWrap: 'wrap'
            }}
          >
            <button
              onClick={this.handleReset}
              style={{
                padding: '8px 16px',
                backgroundColor: '#ff9800',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              ↺ נסו שוב
            </button>

            <button
              onClick={this.handleReload}
              style={{
                padding: '8px 16px',
                backgroundColor: '#2196f3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              ⟳ רענן דף
            </button>

            {process.env.NODE_ENV === 'development' && (
              <button
                onClick={() => {
                  console.error('Error details:', {
                    error: this.state.error,
                    errorInfo: this.state.errorInfo
                  });
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#9c27b0',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
               🔍 הצג בקונסולה
              </button>
            )}
          </div>

          {this.state.errorCount > 3 && (
            <div
              style={{
                marginTop: '15px',
                padding: '10px',
                backgroundColor: '#ffeb3b',
                color: '#f57f17',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            >
              ⚠️ שגיאה חזרה על עצמה{' '}
              {this.state.errorCount} פעמים. אנא פנו לתמיכה אם הבעיה
              מחזרת.
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
