/**
 * useGoogleCalendar Hook
 * ========================
 * חיבור ליומן גוגל - ייצוא וייבוא אירועים
 */

import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';

// =====================================
// קונפיגורציה
// =====================================

const GOOGLE_CLIENT_ID = '817535440248-c3bfvtta658ogdjdk473brbecumhs182.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';

// מפתח לשמירת הטוקן
const TOKEN_KEY = 'zmanit_google_token';

// =====================================
// Hook
// =====================================

export function useGoogleCalendar() {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [tokenClient, setTokenClient] = useState(null);
  const [gapiReady, setGapiReady] = useState(false);
  const [calendars, setCalendars] = useState([]);
  const [selectedCalendarId, setSelectedCalendarId] = useState('primary');

  // =====================================
  // אתחול Google API
  // =====================================

  useEffect(() => {
    loadGoogleScripts();
  }, []);

  const loadGoogleScripts = async () => {
    try {
      // המתנה לטעינת הסקריפטים
      await waitForGapi();
      await waitForGis();

      // אתחול GAPI
      await new Promise((resolve, reject) => {
        window.gapi.load('client', { callback: resolve, onerror: reject });
      });

      await window.gapi.client.init({
        discoveryDocs: [DISCOVERY_DOC],
      });

      setGapiReady(true);

      // אתחול Token Client
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPES,
        callback: (response) => handleTokenResponse(response),
      });
      setTokenClient(client);

      // בדיקה אם יש טוקן שמור
      const savedToken = localStorage.getItem(TOKEN_KEY);
      if (savedToken) {
        try {
          const token = JSON.parse(savedToken);
          // בדיקה אם הטוקן עדיין תקף
          if (token.expires_at > Date.now()) {
            window.gapi.client.setToken(token);
            setIsConnected(true);
            loadCalendars();
          } else {
            localStorage.removeItem(TOKEN_KEY);
          }
        } catch (e) {
          localStorage.removeItem(TOKEN_KEY);
        }
      }

      setIsLoading(false);
    } catch (err) {
      console.error('שגיאה בטעינת Google API:', err);
      setIsLoading(false);
    }
  };

  // המתנה לטעינת gapi
  const waitForGapi = () => {
    return new Promise((resolve) => {
      if (window.gapi) {
        resolve();
      } else {
        const checkGapi = setInterval(() => {
          if (window.gapi) {
            clearInterval(checkGapi);
            resolve();
          }
        }, 100);
        // timeout after 10 seconds
        setTimeout(() => {
          clearInterval(checkGapi);
          resolve();
        }, 10000);
      }
    });
  };

  // המתנה לטעינת Google Identity Services
  const waitForGis = () => {
    return new Promise((resolve) => {
      if (window.google?.accounts) {
        resolve();
      } else {
        const checkGis = setInterval(() => {
          if (window.google?.accounts) {
            clearInterval(checkGis);
            resolve();
          }
        }, 100);
        // timeout after 10 seconds
        setTimeout(() => {
          clearInterval(checkGis);
          resolve();
        }, 10000);
      }
    });
  };

  // טיפול בתגובת הטוקן
  const handleTokenResponse = useCallback((response) => {
    if (response.error) {
      console.error('שגיאת אימות:', response);
      toast.error('שגיאה בהתחברות לגוגל');
      return;
    }

    // שמירת הטוקן עם זמן תפוגה
    const token = {
      ...response,
      expires_at: Date.now() + (response.expires_in * 1000)
    };
    localStorage.setItem(TOKEN_KEY, JSON.stringify(token));
    
    setIsConnected(true);
    loadCalendars();
    toast.success('✅ מחובר ליומן גוגל!');
  }, []);

  // =====================================
  // התחברות וניתוק
  // =====================================

  const connect = useCallback(() => {
    if (!tokenClient) {
      toast.error('Google API לא נטען עדיין, נסי לרענן את הדף');
      return;
    }

    // בקשת הרשאה
    tokenClient.requestAccessToken({ prompt: 'consent' });
  }, [tokenClient]);

  const disconnect = useCallback(() => {
    const token = window.gapi?.client?.getToken();
    
    if (token) {
      window.google.accounts.oauth2.revoke(token.access_token);
      window.gapi.client.setToken(null);
    }
    
    localStorage.removeItem(TOKEN_KEY);
    setIsConnected(false);
    setCalendars([]);
    toast.success('התנתקת מיומן גוגל');
  }, []);

  // =====================================
  // טעינת יומנים
  // =====================================

  const loadCalendars = async () => {
    try {
      const response = await window.gapi.client.calendar.calendarList.list();
      const items = response.result.items || [];
      setCalendars(items);
      
      // בחירת היומן הראשי כברירת מחדל
      const primary = items.find(c => c.primary) || items[0];
      if (primary) {
        setSelectedCalendarId(primary.id);
      }
    } catch (err) {
      console.error('שגיאה בטעינת יומנים:', err);
    }
  };

  // =====================================
  // ייצוא משימה ליומן
  // =====================================

  const exportTask = useCallback(async (task, scheduledBlock) => {
    if (!isConnected) {
      toast.error('יש להתחבר ליומן גוגל קודם');
      return null;
    }

    try {
      // חישוב זמני התחלה וסיום
      const startDate = new Date(scheduledBlock.date);
      const [startHours, startMinutes] = scheduledBlock.startTime.split(':').map(Number);
      startDate.setHours(startHours, startMinutes, 0, 0);

      const endDate = new Date(startDate);
      endDate.setMinutes(endDate.getMinutes() + (scheduledBlock.duration || task.estimated_duration || 30));

      const event = {
        summary: `${getTaskIcon(task.task_type)} ${task.title}`,
        description: task.notes || `משימה מזמנית\nסוג: ${task.task_type || 'אחר'}`,
        start: {
          dateTime: startDate.toISOString(),
          timeZone: 'Asia/Jerusalem',
        },
        end: {
          dateTime: endDate.toISOString(),
          timeZone: 'Asia/Jerusalem',
        },
        colorId: getColorIdForType(task.task_type),
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'popup', minutes: 5 },
          ],
        },
        extendedProperties: {
          private: {
            zmanitTaskId: task.id,
            zmanitType: task.task_type || 'other',
          },
        },
      };

      const response = await window.gapi.client.calendar.events.insert({
        calendarId: selectedCalendarId,
        resource: event,
      });

      return response.result;
    } catch (err) {
      console.error('שגיאה בייצוא ליומן:', err);
      toast.error('שגיאה בייצוא ליומן גוגל');
      return null;
    }
  }, [isConnected, selectedCalendarId]);

  // ייצוא מספר משימות
  const exportTasks = useCallback(async (blocks) => {
    if (!isConnected) {
      toast.error('יש להתחבר ליומן גוגל קודם');
      return [];
    }

    setIsSyncing(true);
    const results = [];

    for (const block of blocks) {
      // בניית אובייקט משימה מהבלוק
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
      
      // המתנה קצרה בין בקשות
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    setIsSyncing(false);
    
    if (results.length > 0) {
      toast.success(`✅ יוצאו ${results.length} משימות ליומן`);
    }
    
    return results;
  }, [isConnected, exportTask]);

  // =====================================
  // ייבוא אירועים מיומן
  // =====================================

  const importEvents = useCallback(async (startDate, endDate) => {
    if (!isConnected) {
      toast.error('יש להתחבר ליומן גוגל קודם');
      return [];
    }

    setIsSyncing(true);

    try {
      const response = await window.gapi.client.calendar.events.list({
        calendarId: selectedCalendarId,
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });

      const events = response.result.items || [];
      
      // המרה לפורמט של זמנית
      const blockedTimes = events
        .filter(event => event.start?.dateTime) // רק אירועים עם שעה (לא יום שלם)
        .map(event => ({
          id: event.id,
          title: event.summary || 'אירוע ללא שם',
          startTime: new Date(event.start.dateTime),
          endTime: new Date(event.end.dateTime),
          isGoogleEvent: true,
          googleEventId: event.id,
          color: event.colorId,
          // בדיקה אם זה אירוע שיוצא מזמנית
          isZmanitTask: event.extendedProperties?.private?.zmanitTaskId ? true : false,
          zmanitTaskId: event.extendedProperties?.private?.zmanitTaskId,
        }));

      setIsSyncing(false);
      return blockedTimes;
    } catch (err) {
      console.error('שגיאה בייבוא מיומן:', err);
      toast.error('שגיאה בייבוא מיומן גוגל');
      setIsSyncing(false);
      return [];
    }
  }, [isConnected, selectedCalendarId]);

  // ייבוא אירועים ליום
  const importDayEvents = useCallback(async (date) => {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    
    return importEvents(start, end);
  }, [importEvents]);

  // =====================================
  // עזר: צבעים ואייקונים
  // =====================================

  const getColorIdForType = (type) => {
    const colors = {
      transcription: '3',
      proofreading: '9',
      translation: '7',
      admin: '5',
      email: '7',
      course: '3',
      client_communication: '4',
      management: '6',
      family: '4',
      kids: '4',
      personal: '2',
      unexpected: '11',
      other: '8',
    };
    return colors[type] || '8';
  };

  const getTaskIcon = (type) => {
    const icons = {
      transcription: '🎙️',
      proofreading: '📝',
      email: '📧',
      course: '📚',
      client_communication: '💬',
      management: '👔',
      family: '👨‍👩‍👧‍👦',
      kids: '🧒',
      personal: '🧘',
      unexpected: '⚡',
      other: '📋',
    };
    return icons[type] || '📋';
  };

  // =====================================
  // Return
  // =====================================

  return {
    // מצב
    isConnected,
    isLoading,
    isSyncing,
    gapiReady,
    
    // יומנים
    calendars,
    selectedCalendarId,
    setSelectedCalendarId,
    
    // פעולות
    connect,
    disconnect,
    
    // ייצוא
    exportTask,
    exportTasks,
    
    // ייבוא
    importEvents,
    importDayEvents,
  };
}

export default useGoogleCalendar;
