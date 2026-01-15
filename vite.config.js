import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react()
  ],
  resolve: {
    alias: {
      '@': '/src'
    }
  },
  // הסרת console.log בייצור
  esbuild: {
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : []
  },
  build: {
    // חלוקת הקוד לחבילות קטנות יותר
    rollupOptions: {
      output: {
        manualChunks: {
          // ספריות React בנפרד
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // ספריות UI
          'ui-vendor': ['framer-motion', 'react-hot-toast'],
          // Supabase
          'supabase': ['@supabase/supabase-js'],
          // ייצוא קבצים
          'export-vendor': ['jspdf', 'jspdf-autotable', 'xlsx']
        }
      }
    },
    // הגבלת גודל אזהרה ל-700KB
    chunkSizeWarningLimit: 700
  }
});

