/**
 * Hook לשימוש בקונפיגורציה
 * ===========================
 * 
 * מספק גישה נוחה לקונפיגורציה בכל קומפוננטה
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { 
  getConfig, 
  getConfigSync, 
  updateConfig, 
  DEFAULT_CONFIG 
} from '../config/appConfig';

/**
 * Hook ראשי לקונפיגורציה
 */
export function useConfig() {
  const { user } = useAuth();
  const [config, setConfig] = useState(getConfigSync());
  const [loading, setLoading] = useState(true);

  // טעינה ראשונית
  useEffect(() => {
    async function load() {
      if (user?.id) {
        const loaded = await getConfig(user.id);
        setConfig(loaded);
      }
      setLoading(false);
    }
    load();
  }, [user?.id]);

  // האזנה לשינויים
  useEffect(() => {
    const handleConfigUpdate = (event) => {
      setConfig(event.detail);
    };
    
    window.addEventListener('configUpdated', handleConfigUpdate);
    return () => window.removeEventListener('configUpdated', handleConfigUpdate);
  }, []);

  // פונקציית עדכון
  const update = useCallback(async (updates) => {
    if (!user?.id) return false;
    const success = await updateConfig(user.id, updates);
    if (success) {
      setConfig(prev => ({ ...prev, ...updates }));
    }
    return success;
  }, [user?.id]);

  return {
    config,
    loading,
    update,
    // קיצורים נפוצים
    workHours: config.workHours,
    workDays: config.workDays,
    friday: config.friday,
    breaks: config.breaks,
    timer: config.timer,
    notifications: config.notifications
  };
}

/**
 * Hook לשעות עבודה בלבד
 */
export function useWorkHours() {
  const { config } = useConfig();
  
  return {
    start: config.workHours?.start || '08:30',
    end: config.workHours?.end || '16:15',
    startMinutes: config.workHours?.startMinutes || 510,
    endMinutes: config.workHours?.endMinutes || 975,
    totalMinutes: config.workHours?.totalMinutes || 465,
    // תאימות לאחור
    startDecimal: (config.workHours?.startMinutes || 510) / 60,
    endDecimal: (config.workHours?.endMinutes || 975) / 60
  };
}

/**
 * Hook לבדיקה אם עכשיו בשעות עבודה
 */
export function useIsWorkTime() {
  const { workHours, workDays, friday } = useConfig();
  const [isWorkTime, setIsWorkTime] = useState(false);

  useEffect(() => {
    const check = () => {
      const now = new Date();
      const day = now.getDay();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      // בדיקה אם זה יום עבודה
      if (!workDays.includes(day)) {
        // בדיקה אם זה שישי
        if (day === 5 && friday?.enabled) {
          const [startH, startM] = (friday.start || '08:30').split(':').map(Number);
          const [endH, endM] = (friday.end || '12:00').split(':').map(Number);
          const fridayStart = startH * 60 + startM;
          const fridayEnd = endH * 60 + endM;
          setIsWorkTime(currentMinutes >= fridayStart && currentMinutes <= fridayEnd);
          return;
        }
        setIsWorkTime(false);
        return;
      }

      // בדיקה אם בשעות עבודה
      const startMinutes = workHours?.startMinutes || 510;
      const endMinutes = workHours?.endMinutes || 975;
      
      setIsWorkTime(currentMinutes >= startMinutes && currentMinutes <= endMinutes);
    };

    check();
    const interval = setInterval(check, 60000); // בדיקה כל דקה
    
    return () => clearInterval(interval);
  }, [workHours, workDays, friday]);

  return isWorkTime;
}

/**
 * Hook לחישוב זמן נותר ביום העבודה
 */
export function useRemainingWorkTime() {
  const { workHours, friday } = useConfig();
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const calculate = () => {
      const now = new Date();
      const day = now.getDay();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      let endMinutes = workHours?.endMinutes || 975;

      // שישי - שעות שונות
      if (day === 5 && friday?.enabled) {
        const [endH, endM] = (friday.end || '12:00').split(':').map(Number);
        endMinutes = endH * 60 + endM;
      }

      setRemaining(Math.max(0, endMinutes - currentMinutes));
    };

    calculate();
    const interval = setInterval(calculate, 60000);
    
    return () => clearInterval(interval);
  }, [workHours, friday]);

  return remaining;
}

export default useConfig;
