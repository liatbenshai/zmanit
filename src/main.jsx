console.log('⚡ main.jsx loading...');
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { TaskProvider } from './context/TaskContext';
import { NotificationProvider } from './context/NotificationContext';
import './styles/globals.css';

// רישום Service Worker להתראות Push
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('✅ Service Worker registered:', registration.scope);
      })
      .catch(error => {
        console.log('❌ Service Worker registration failed:', error);
      });
  });
}

console.log('🚀 Starting app render...');

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <AuthProvider>
      <TaskProvider>
        <NotificationProvider>
          <App />
        </NotificationProvider>
      </TaskProvider>
    </AuthProvider>
  </BrowserRouter>
);

console.log('🚀 Render called');
