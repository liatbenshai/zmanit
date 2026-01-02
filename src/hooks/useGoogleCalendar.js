/**
 * useGoogleCalendar Hook - Vercel API Version
 * ============================================
 * חיבור ליומן גוגל דרך Vercel Serverless Functions
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../services/supabase';
import toast from 'react-hot-toast';

// =====================================
// קונפיגורציה
// =====================================

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || 
  '817535440248-c3bfvtta658ogdjdk473brbecumhs182.apps.googleusercontent.com';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
].join(' ');

// =====================================
// Helper - קריאה ל-API
// =====================================

async function callApi(endpoint, body) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`/api/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'API error');
  }
  
  return data;
}

// =====================================
// Hook
// =====================================

export function useGoogleCalendar() {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [googleEmail, setGoogleEmail] = useState(null);
  const [calendars, setCalendars] = useState([]);
  const [selectedCalendarId, setSelectedCalendarId] = useState('primary');
  const [lastSyncAt, setLastSyncAt] = useState(null);
  
  const popupRef = useRef(null);
  const popupCheckInterval = useRef(null);

  // =====================================
  // בדיקת מצב התחברות בטעינה
  // =====================================
  
  useEffect(() => {
    checkConnectionStatus();
  }, []);

  const checkConnectionStatus = async () => {
    try {
      setIsLoading(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsLoading(false);
        return;
      }

      const data = await callApi('google-auth', { action: 'status' });

      if (data.connected) {
        setIsConnected(true);
        setGoogleEmail(data.email);
        setLastSyncAt(data.last_sync_at);
        
        if (data.needs_refresh) {
          await refreshToken();
        }
        
        await loadCalendars();
      } else {
        setIsConnected(false);
      }
    } catch (err) {
      console.error('Error checking connection:', err);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  // =====================================
  // חידוש טוקן
  // =====================================
  
  const refreshToken = async () => {
    try {
      const data = await callApi('google-auth', { action: 'refresh' });
      return data.success;
    } catch (err) {
      console.error('Error refreshing token:', err);
      setIsConnected(false);
      return false;
    }
  };

  // =====================================
  // התחברות - פותח popup
  // =====================================
  
  const connect = useCallback(async () => {
    try {
      const redirectUri = `${window.location.origin}/auth/google/callback`;
      
      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', SCOPES);
      authUrl.searchParams.set('access_type', 'offline');
      authUrl.searchParams.set('prompt', 'consent');
      authUrl.searchParams.set('state', crypto.randomUUID());

      const width = 500;
      const height = 600;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      popupRef.current = window.open(
        authUrl.toString(),
        'google-auth',
        `width=${width},height=${height},left=${left},top=${top},popup=1`
      );

      const handleMessage = async (event) => {
        if (event.origin !== window.location.origin) return;
        
        if (event.data?.type === 'GOOGLE_AUTH_CODE') {
          window.removeEventListener('message', handleMessage);
          clearInterval(popupCheckInterval.current);
          
          if (popupRef.current) {
            popupRef.current.close();
          }

          setIsLoading(true);
          try {
            const data = await callApi('google-auth', {
              action: 'exchange',
              code: event.data.code,
              redirect_uri: redirectUri,
            });

            setIsConnected(true);
            setGoogleEmail(data.email);
            toast.success('✅ מחובר ליומן גוגל!');
            
            await loadCalendars();
            await syncEvents();
          } catch (err) {
            console.error('Error exchanging code:', err);
            toast.error('שגיאה בהתחברות לגוגל');
          } finally {
            setIsLoading(false);
          }
        }
      };

      window.addEventListener('message', handleMessage);

      popupCheckInterval.current = setInterval(() => {
        if (popupRef.current?.closed) {
          clearInterval(popupCheckInterval.current);
          window.removeEventListener('message', handleMessage);
        }
      }, 500);

    } catch (err) {
      console.error('Error connecting:', err);
      toast.error('שגיאה בפתיחת חלון התחברות');
    }
  }, []);

  // =====================================
  // ניתוק
  // =====================================
  
  const disconnect = useCallback(async () => {
    try {
      await callApi('google-auth', { action: 'disconnect' });

      setIsConnected(false);
      setGoogleEmail(null);
      setCalendars([]);
      setLastSyncAt(null);
      toast.success('התנתקת מיומן גוגל');
    } catch (err) {
      console.error('Error disconnecting:', err);
      toast.error('שגיאה בניתוק');
    }
  }, []);

  // =====================================
  // טעינת רשימת יומנים
  // =====================================
  
  const loadCalendars = async () => {
    try {
      const data = await callApi('sync-google-calendar', { action: 'list_calendars' });

      setCalendars(data.calendars || []);
      
      const primary = data.calendars?.find(c => c.primary);
      if (primary) {
        setSelectedCalendarId(primary.id);
      }
    } catch (err) {
      console.error('Error loading calendars:', err);
    }
  };

  // =====================================
  // סנכרון אירועים
  // =====================================
  
  const syncEvents = useCallback(async (startDate, endDate) => {
    if (!isConnected) return [];
    
    try {
      setIsSyncing(true);

      const start = startDate || new Date();
      start.setHours(0, 0, 0, 0);
      
      const end = endDate || new Date(start);
      end.setDate(end.getDate() + 7);

      const data = await callApi('sync-google-calendar', {
        action: 'import',
        start_date: start.toISOString(),
        end_date: end.toISOString(),
        calendar_id: selectedCalendarId,
      });

      setLastSyncAt(new Date().toISOString());
      return data.events || [];
    } catch (err) {
      console.error('Error syncing events:', err);
      
      if (err.message?.includes('expired') || err.message?.includes('reconnect')) {
        const refreshed = await refreshToken();
        if (!refreshed) {
          toast.error('יש להתחבר מחדש ליומן גוגל');
          setIsConnected(false);
        }
      }
      
      return [];
    } finally {
      setIsSyncing(false);
    }
  }, [isConnected, selectedCalendarId]);

  // =====================================
  // קבלת אירועים מהדאטהבייס
  // =====================================
  
  const getEvents = useCallback(async (startDate, endDate) => {
    if (!isConnected) return [];
    
    try {
      const data = await callApi('sync-google-calendar', {
        action: 'get_events',
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
      });
      return data.events || [];
    } catch (err) {
      console.error('Error getting events:', err);
      return [];
    }
  }, [isConnected]);

  // =====================================
  // קבלת אירועים ליום
  // =====================================
  
  const getDayEvents = useCallback(async (date) => {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    
    return getEvents(start, end);
  }, [getEvents]);

  // =====================================
  // ייבוא אירועים ליום (תאימות לאחור)
  // =====================================
  
  const importDayEvents = useCallback(async (date) => {
    // קודם מסנכרנים
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    
    await syncEvents(start, end);
    
    // ואז מחזירים את האירועים
    return getDayEvents(date);
  }, [syncEvents, getDayEvents]);

  // =====================================
  // ייצוא משימה ליומן
  // =====================================
  
  const exportTask = useCallback(async (task, scheduledBlock) => {
    if (!isConnected) {
      toast.error('יש להתחבר ליומן גוגל קודם');
      return null;
    }

    try {
      setIsSyncing(true);

      const data = await callApi('sync-google-calendar', {
        action: 'export',
        task,
        scheduled_block: scheduledBlock,
        calendar_id: selectedCalendarId,
      });

      toast.success('✅ המשימה נוספה ליומן גוגל');
      return data;
    } catch (err) {
      console.error('Error exporting task:', err);
      toast.error('שגיאה בייצוא ליומן');
      return null;
    } finally {
      setIsSyncing(false);
    }
  }, [isConnected, selectedCalendarId]);

  // =====================================
  // ייצוא מספר משימות
  // =====================================
  
  const exportTasks = useCallback(async (blocks) => {
    if (!isConnected) {
      toast.error('יש להתחבר ליומן גוגל קודם');
      return [];
    }

    setIsSyncing(true);
    const results = [];

    for (const block of blocks) {
      const task = {
        id: block.taskId || block.id,
        title: block.title,
        task_type: block.taskType,
        estimated_duration: block.duration,
        notes: block.notes
      };
      
      const scheduledBlock = {
        date: block.date || new Date().toISOString().split('T')[0],
        startTime: block.startTime,
        duration: block.duration
      };
      
      const result = await exportTask(task, scheduledBlock);
      if (result) {
        results.push(result);
      }
      
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    setIsSyncing(false);
    
    if (results.length > 0) {
      toast.success(`✅ יוצאו ${results.length} משימות ליומן`);
    }
    
    return results;
  }, [isConnected, exportTask]);

  // =====================================
  // Return
  // =====================================

  return {
    // מצב
    isConnected,
    isLoading,
    isSyncing,
    googleEmail,
    lastSyncAt,
    gapiReady: true, // תאימות לאחור
    
    // יומנים
    calendars,
    selectedCalendarId,
    setSelectedCalendarId,
    
    // פעולות חיבור
    connect,
    disconnect,
    checkConnectionStatus,
    
    // סנכרון
    syncEvents,
    getEvents,
    getDayEvents,
    importDayEvents, // תאימות לאחור
    importEvents: syncEvents, // תאימות לאחור
    
    // ייצוא
    exportTask,
    exportTasks,
  };
}

export default useGoogleCalendar;
