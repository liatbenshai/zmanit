/**
 * מנוע למידה מסונכרן - זמנית
 * ============================
 * שומר נתונים ב-Supabase לסנכרון בין מכשירים
 * עם fallback ל-localStorage כשאין חיבור
 */

import { supabase } from '../services/supabase';

// =====================================
// פונקציות עזר
// =====================================

/**
 * קבלת user_id הנוכחי
 */
async function getCurrentUserId() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
  } catch (e) {
    console.error('שגיאה בקבלת משתמש:', e);
    return null;
  }
}

/**
 * בדיקת חיבור לאינטרנט
 */
function isOnline() {
  return navigator.onLine;
}

// =====================================
// שמירת נתונים
// =====================================

/**
 * שמירת משימה שהושלמה
 */
export async function saveCompletedTask(task) {
  const userId = await getCurrentUserId();
  if (!userId) {
    console.warn('אין משתמש מחובר - שומר מקומית');
    return saveCompletedTaskLocal(task);
  }

  const taskRecord = {
    user_id: userId,
    task_id: task.id,
    title: task.title,
    task_type: task.task_type || 'general',
    category: task.category || 'work',
    estimated_duration: task.estimated_duration || 0,
    actual_duration: task.time_spent || 0,
    scheduled_time: task.due_time || null,
    actual_start_time: task.actual_start_time || null,
    date: task.due_date || new Date().toISOString().split('T')[0],
    day_of_week: new Date().getDay(),
    hour_completed: new Date().getHours(),
    priority: task.priority || 'normal',
    was_late: task.actual_start_time && task.due_time ? 
      task.actual_start_time > task.due_time : false,
    accuracy_ratio: task.estimated_duration > 0 ? 
      (task.time_spent || 0) / task.estimated_duration : null
  };

  try {
    if (isOnline()) {
      const { data, error } = await supabase
        .from('learning_completed_tasks')
        .insert(taskRecord)
        .select()
        .single();

      if (error) throw error;
      
      // עדכון דפוסי משתמש
      updateUserPatterns(userId);
      
      return data;
    } else {
      return saveCompletedTaskLocal(task);
    }
  } catch (e) {
    console.error('שגיאה בשמירת משימה:', e);
    return saveCompletedTaskLocal(task);
  }
}

/**
 * שמירה מקומית (fallback)
 */
function saveCompletedTaskLocal(task) {
  try {
    const history = JSON.parse(localStorage.getItem('learning_completed_tasks') || '[]');
    const record = {
      id: Date.now(),
      ...task,
      completedAt: new Date().toISOString(),
      needsSync: true
    };
    history.push(record);
    if (history.length > 500) history.splice(0, history.length - 500);
    localStorage.setItem('learning_completed_tasks', JSON.stringify(history));
    return record;
  } catch (e) {
    console.error('שגיאה בשמירה מקומית:', e);
    return null;
  }
}

/**
 * שמירת הפרעה
 */
export async function saveInterruption(interruption) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return saveInterruptionLocal(interruption);
  }

  const record = {
    user_id: userId,
    task_id: interruption.taskId,
    task_title: interruption.taskTitle,
    type: interruption.type || 'other',
    description: interruption.description || '',
    duration: interruption.duration || 5,
    date: new Date().toISOString().split('T')[0],
    day_of_week: new Date().getDay(),
    hour: new Date().getHours()
  };

  try {
    if (isOnline()) {
      const { data, error } = await supabase
        .from('learning_interruptions')
        .insert(record)
        .select()
        .single();

      if (error) throw error;
      return data;
    } else {
      return saveInterruptionLocal(interruption);
    }
  } catch (e) {
    console.error('שגיאה בשמירת הפרעה:', e);
    return saveInterruptionLocal(interruption);
  }
}

function saveInterruptionLocal(interruption) {
  try {
    const history = JSON.parse(localStorage.getItem('interruptions_history') || '[]');
    const record = {
      id: Date.now(),
      ...interruption,
      timestamp: new Date().toISOString(),
      needsSync: true
    };
    history.push(record);
    if (history.length > 200) history.splice(0, history.length - 200);
    localStorage.setItem('interruptions_history', JSON.stringify(history));
    return record;
  } catch (e) {
    return null;
  }
}

/**
 * שמירת התחלה באיחור
 */
export async function saveLateStart(lateStart) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return saveLateStartLocal(lateStart);
  }

  const record = {
    user_id: userId,
    task_id: lateStart.taskId,
    task_title: lateStart.taskTitle,
    task_type: lateStart.taskType || 'general',
    scheduled_time: lateStart.scheduledTime,
    actual_start_time: lateStart.actualStartTime,
    late_minutes: lateStart.lateMinutes,
    date: new Date().toISOString().split('T')[0],
    day_of_week: new Date().getDay()
  };

  try {
    if (isOnline()) {
      const { data, error } = await supabase
        .from('learning_late_starts')
        .insert(record)
        .select()
        .single();

      if (error) throw error;
      return data;
    } else {
      return saveLateStartLocal(lateStart);
    }
  } catch (e) {
    console.error('שגיאה בשמירת איחור:', e);
    return saveLateStartLocal(lateStart);
  }
}

function saveLateStartLocal(lateStart) {
  try {
    const history = JSON.parse(localStorage.getItem('late_starts_history') || '[]');
    history.push({
      ...lateStart,
      date: new Date().toISOString().split('T')[0],
      needsSync: true
    });
    if (history.length > 100) history.shift();
    localStorage.setItem('late_starts_history', JSON.stringify(history));
    return lateStart;
  } catch (e) {
    return null;
  }
}

/**
 * שמירת סיכום יומי
 */
export async function saveDailySummary(summary) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return saveDailySummaryLocal(summary);
  }

  const record = {
    user_id: userId,
    date: summary.date || new Date().toISOString().split('T')[0],
    planned_tasks: summary.plannedTasks || 0,
    completed_tasks: summary.completedTasks || 0,
    completion_rate: summary.completionRate || 0,
    planned_minutes: summary.plannedMinutes || 0,
    actual_minutes: summary.actualMinutes || 0,
    time_deviation: summary.timeDeviation || 0,
    late_starts: summary.lateStarts || 0,
    interruptions: summary.interruptions || 0,
    productivity_score: summary.productivityScore || 0,
    best_hour: summary.bestHour || null,
    notes: summary.notes || ''
  };

  try {
    if (isOnline()) {
      // upsert - עדכון או הוספה
      const { data, error } = await supabase
        .from('learning_daily_summaries')
        .upsert(record, { onConflict: 'user_id,date' })
        .select()
        .single();

      if (error) throw error;
      return data;
    } else {
      return saveDailySummaryLocal(summary);
    }
  } catch (e) {
    console.error('שגיאה בשמירת סיכום:', e);
    return saveDailySummaryLocal(summary);
  }
}

function saveDailySummaryLocal(summary) {
  try {
    const summaries = JSON.parse(localStorage.getItem('daily_summaries') || '[]');
    const existingIndex = summaries.findIndex(s => s.date === summary.date);
    if (existingIndex >= 0) {
      summaries[existingIndex] = { ...summary, needsSync: true };
    } else {
      summaries.push({ ...summary, needsSync: true });
    }
    if (summaries.length > 90) summaries.splice(0, summaries.length - 90);
    localStorage.setItem('daily_summaries', JSON.stringify(summaries));
    return summary;
  } catch (e) {
    return null;
  }
}

// =====================================
// ניתוח דיוק הערכות
// =====================================

/**
 * ניתוח דיוק הערכות זמן
 */
export async function analyzeEstimationAccuracy() {
  const userId = await getCurrentUserId();
  
  let history = [];
  
  if (userId && isOnline()) {
    try {
      const { data, error } = await supabase
        .from('learning_completed_tasks')
        .select('*')
        .eq('user_id', userId)
        .order('completed_at', { ascending: false })
        .limit(200);

      if (!error && data) {
        history = data.map(t => ({
          taskType: t.task_type,
          estimatedDuration: t.estimated_duration,
          actualDuration: t.actual_duration,
          accuracyRatio: t.accuracy_ratio
        }));
      }
    } catch (e) {
      console.error('שגיאה בטעינה מ-Supabase:', e);
    }
  }
  
  // fallback למקומי
  if (history.length === 0) {
    try {
      const local = JSON.parse(localStorage.getItem('learning_completed_tasks') || '[]');
      history = local.map(t => ({
        taskType: t.task_type || t.taskType || 'general',
        estimatedDuration: t.estimated_duration || t.estimatedDuration || 0,
        actualDuration: t.time_spent || t.actualDuration || 0,
        accuracyRatio: t.accuracyRatio
      }));
    } catch (e) {}
  }

  // סינון משימות עם נתוני זמן
  const withTimeData = history.filter(t => 
    t.estimatedDuration > 0 && t.actualDuration > 0
  );

  if (withTimeData.length < 3) {
    return {
      hasEnoughData: false,
      message: 'צריך לפחות 3 משימות עם נתוני זמן לניתוח'
    };
  }

  // ניתוח כללי
  const totalEstimated = withTimeData.reduce((sum, t) => sum + t.estimatedDuration, 0);
  const totalActual = withTimeData.reduce((sum, t) => sum + t.actualDuration, 0);
  const overallRatio = totalActual / totalEstimated;

  // ניתוח לפי סוג משימה
  const byType = {};
  withTimeData.forEach(t => {
    const type = t.taskType || 'general';
    if (!byType[type]) {
      byType[type] = { estimated: 0, actual: 0, count: 0 };
    }
    byType[type].estimated += t.estimatedDuration;
    byType[type].actual += t.actualDuration;
    byType[type].count++;
  });

  const typeAnalysis = Object.entries(byType).map(([type, data]) => ({
    type,
    ratio: data.actual / data.estimated,
    count: data.count,
    avgEstimated: Math.round(data.estimated / data.count),
    avgActual: Math.round(data.actual / data.count),
    deviation: Math.round((data.actual / data.estimated - 1) * 100),
    suggestion: getSuggestionForRatio(data.actual / data.estimated)
  })).sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation));

  // המלצות
  const recommendations = [];

  if (overallRatio > 1.2) {
    recommendations.push({
      type: 'underestimate',
      icon: '⏰',
      title: 'את מעריכה פחות מדי זמן',
      message: `בממוצע, משימות לוקחות ${Math.round((overallRatio - 1) * 100)}% יותר זמן`,
      suggestion: `נסי להוסיף ${Math.round((overallRatio - 1) * 100)}% לכל הערכה`
    });
  } else if (overallRatio < 0.8) {
    recommendations.push({
      type: 'overestimate',
      icon: '🚀',
      title: 'את מהירה ממה שחשבת!',
      message: `בממוצע, משימות נגמרות ${Math.round((1 - overallRatio) * 100)}% מהר יותר`,
      suggestion: 'יכולה לתכנן יותר משימות ביום'
    });
  } else {
    recommendations.push({
      type: 'accurate',
      icon: '🎯',
      title: 'הערכות מדויקות!',
      message: 'את מעריכה זמן בצורה מצוינת',
      suggestion: 'המשיכי ככה!'
    });
  }

  // המלצות ספציפיות לסוגי משימות
  typeAnalysis.forEach(ta => {
    if (ta.count >= 3 && Math.abs(ta.deviation) > 30) {
      recommendations.push({
        type: 'type-specific',
        icon: ta.deviation > 0 ? '⚠️' : '💨',
        title: `${ta.type}: ${ta.deviation > 0 ? 'לוקח יותר זמן' : 'נגמר מהר'}`,
        message: `${Math.abs(ta.deviation)}% ${ta.deviation > 0 ? 'יותר' : 'פחות'} מהמשוער`,
        suggestion: ta.suggestion
      });
    }
  });

  return {
    hasEnoughData: true,
    totalTasks: withTimeData.length,
    overallRatio,
    overallDeviation: Math.round((overallRatio - 1) * 100),
    byType: typeAnalysis,
    recommendations,
    suggestedMultiplier: overallRatio > 1.1 ? overallRatio : 1
  };
}

function getSuggestionForRatio(ratio) {
  if (ratio > 1.5) return 'הכפילי את ההערכה';
  if (ratio > 1.3) return 'הוסיפי 50% להערכה';
  if (ratio > 1.1) return 'הוסיפי 20% להערכה';
  if (ratio < 0.7) return 'הפחיתי 30% מההערכה';
  if (ratio < 0.9) return 'הפחיתי 10% מההערכה';
  return 'ההערכה מדויקת!';
}

// =====================================
// ניתוח שעות פרודוקטיביות
// =====================================

/**
 * ניתוח שעות פרודוקטיביות
 */
export async function analyzeProductiveHours() {
  const userId = await getCurrentUserId();
  
  let history = [];
  
  if (userId && isOnline()) {
    try {
      const { data, error } = await supabase
        .from('learning_completed_tasks')
        .select('hour_completed, day_of_week, actual_duration, accuracy_ratio')
        .eq('user_id', userId)
        .order('completed_at', { ascending: false })
        .limit(200);

      if (!error && data) {
        history = data.map(t => ({
          hourCompleted: t.hour_completed,
          dayOfWeek: t.day_of_week,
          actualDuration: t.actual_duration,
          accuracyRatio: t.accuracy_ratio
        }));
      }
    } catch (e) {
      console.error('שגיאה:', e);
    }
  }
  
  // fallback
  if (history.length === 0) {
    try {
      const local = JSON.parse(localStorage.getItem('learning_completed_tasks') || '[]');
      history = local.map(t => ({
        hourCompleted: t.hourCompleted || new Date(t.completedAt).getHours(),
        dayOfWeek: t.dayOfWeek || new Date(t.completedAt).getDay(),
        actualDuration: t.actualDuration || t.time_spent || 0,
        accuracyRatio: t.accuracyRatio
      }));
    } catch (e) {}
  }

  if (history.length < 10) {
    return {
      hasEnoughData: false,
      message: 'צריך לפחות 10 משימות לניתוח שעות'
    };
  }

  // ניתוח לפי שעות
  const byHour = {};
  for (let h = 6; h <= 22; h++) {
    byHour[h] = { tasks: 0, totalMinutes: 0, efficiencySum: 0 };
  }

  history.forEach(t => {
    const hour = t.hourCompleted;
    if (hour >= 6 && hour <= 22) {
      byHour[hour].tasks++;
      byHour[hour].totalMinutes += t.actualDuration || 0;
      if (t.accuracyRatio) {
        const efficiency = t.accuracyRatio <= 1 ? t.accuracyRatio : 1 / t.accuracyRatio;
        byHour[hour].efficiencySum += efficiency;
      }
    }
  });

  const hourAnalysis = Object.entries(byHour)
    .map(([hour, data]) => ({
      hour: parseInt(hour),
      hourDisplay: `${hour}:00`,
      tasks: data.tasks,
      totalMinutes: data.totalMinutes,
      avgEfficiency: data.tasks > 0 ? 
        Math.round((data.efficiencySum / data.tasks) * 100) : 0
    }))
    .filter(h => h.tasks >= 2)
    .sort((a, b) => b.avgEfficiency - a.avgEfficiency);

  // ניתוח לפי ימים
  const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  const byDay = {};

  history.forEach(t => {
    const day = t.dayOfWeek;
    if (!byDay[day]) {
      byDay[day] = { tasks: 0, totalMinutes: 0, efficiencySum: 0 };
    }
    byDay[day].tasks++;
    byDay[day].totalMinutes += t.actualDuration || 0;
    if (t.accuracyRatio) {
      const efficiency = t.accuracyRatio <= 1 ? t.accuracyRatio : 1 / t.accuracyRatio;
      byDay[day].efficiencySum += efficiency;
    }
  });

  const dayAnalysis = Object.entries(byDay)
    .map(([day, data]) => ({
      day: parseInt(day),
      dayName: dayNames[parseInt(day)],
      tasks: data.tasks,
      totalMinutes: data.totalMinutes,
      avgEfficiency: data.tasks > 0 ? 
        Math.round((data.efficiencySum / data.tasks) * 100) : 0
    }))
    .sort((a, b) => b.avgEfficiency - a.avgEfficiency);

  // המלצות
  const recommendations = [];

  if (hourAnalysis.length >= 3) {
    const bestHours = hourAnalysis.slice(0, 3);
    const worstHours = hourAnalysis.slice(-2);

    recommendations.push({
      type: 'best-hours',
      icon: '⭐',
      title: 'השעות הכי טובות שלך',
      message: bestHours.map(h => h.hourDisplay).join(', '),
      suggestion: 'שבצי משימות חשובות בשעות האלה'
    });

    if (worstHours.length > 0 && worstHours[0].avgEfficiency < 70) {
      recommendations.push({
        type: 'avoid-hours',
        icon: '😴',
        title: 'שעות פחות יעילות',
        message: worstHours.map(h => h.hourDisplay).join(', '),
        suggestion: 'נסי לשבץ הפסקות או משימות קלות'
      });
    }
  }

  if (dayAnalysis.length >= 3) {
    const bestDay = dayAnalysis[0];
    recommendations.push({
      type: 'best-day',
      icon: '📅',
      title: `יום ${bestDay.dayName} הכי פרודוקטיבי`,
      message: `יעילות ${bestDay.avgEfficiency}%`,
      suggestion: 'שבצי משימות מאתגרות ביום הזה'
    });
  }

  return {
    hasEnoughData: true,
    totalTasks: history.length,
    byHour: hourAnalysis,
    byDay: dayAnalysis,
    bestHours: hourAnalysis.slice(0, 3),
    worstHours: hourAnalysis.slice(-2),
    recommendations
  };
}

// =====================================
// ניתוח הפרעות
// =====================================

/**
 * ניתוח דפוסי הפרעות
 */
export async function analyzeInterruptions() {
  const userId = await getCurrentUserId();
  
  let history = [];
  
  // שבועיים אחרונים
  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  const twoWeeksAgoStr = twoWeeksAgo.toISOString().split('T')[0];

  if (userId && isOnline()) {
    try {
      const { data, error } = await supabase
        .from('learning_interruptions')
        .select('*')
        .eq('user_id', userId)
        .gte('date', twoWeeksAgoStr)
        .order('timestamp', { ascending: false });

      if (!error && data) {
        history = data;
      }
    } catch (e) {
      console.error('שגיאה:', e);
    }
  }

  // fallback
  if (history.length === 0) {
    try {
      const local = JSON.parse(localStorage.getItem('interruptions_history') || '[]');
      history = local.filter(i => new Date(i.timestamp) >= twoWeeksAgo);
    } catch (e) {}
  }

  if (history.length < 5) {
    return {
      hasEnoughData: false,
      message: 'צריך לפחות 5 הפרעות מתועדות לניתוח'
    };
  }

  // ניתוח לפי סוג
  const typeNames = {
    phone: '📱 טלפון',
    person: '👤 אדם',
    email: '📧 מייל',
    meeting: '🤝 פגישה',
    break: '☕ הפסקה',
    other: '❓ אחר'
  };

  const byType = {};
  history.forEach(i => {
    const type = i.type || 'other';
    if (!byType[type]) {
      byType[type] = { count: 0, totalDuration: 0 };
    }
    byType[type].count++;
    byType[type].totalDuration += i.duration || 5;
  });

  const typeAnalysis = Object.entries(byType)
    .map(([type, data]) => ({
      type,
      typeName: typeNames[type] || type,
      count: data.count,
      totalDuration: data.totalDuration,
      avgDuration: Math.round(data.totalDuration / data.count)
    }))
    .sort((a, b) => b.count - a.count);

  // ניתוח לפי שעות
  const byHour = {};
  history.forEach(i => {
    const hour = i.hour;
    byHour[hour] = (byHour[hour] || 0) + 1;
  });

  const peakHours = Object.entries(byHour)
    .map(([hour, count]) => ({ hour: parseInt(hour), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  // סטטיסטיקות
  const totalInterruptions = history.length;
  const totalLostMinutes = history.reduce((sum, i) => sum + (i.duration || 5), 0);
  const avgPerDay = Math.round(totalInterruptions / 14 * 10) / 10;

  // המלצות
  const recommendations = [];

  if (typeAnalysis.length > 0) {
    const topType = typeAnalysis[0];
    recommendations.push({
      type: 'main-distraction',
      icon: topType.typeName.split(' ')[0],
      title: `הסחה עיקרית: ${topType.typeName.split(' ')[1]}`,
      message: `${topType.count} פעמים (${topType.totalDuration} דקות אבודות)`,
      suggestion: getInterruptionSuggestion(topType.type)
    });
  }

  if (peakHours.length > 0) {
    recommendations.push({
      type: 'peak-interruption-hours',
      icon: '🚨',
      title: 'שעות עם הכי הרבה הפרעות',
      message: peakHours.map(h => `${h.hour}:00`).join(', '),
      suggestion: 'נסי לחסום זמן בשעות האלה'
    });
  }

  if (avgPerDay > 5) {
    recommendations.push({
      type: 'too-many-interruptions',
      icon: '⚠️',
      title: 'הרבה הפרעות!',
      message: `ממוצע ${avgPerDay} הפרעות ביום`,
      suggestion: 'שקלי להפעיל "מצב ריכוז" בטלפון'
    });
  }

  return {
    hasEnoughData: true,
    totalInterruptions,
    totalLostMinutes,
    avgPerDay,
    byType: typeAnalysis,
    peakHours,
    recommendations
  };
}

function getInterruptionSuggestion(type) {
  const suggestions = {
    phone: 'העבירי לשקט בזמן משימות מרוכזות',
    person: 'קבעי "שעות קבלה" לשאלות',
    email: 'בדקי מיילים רק פעמיים ביום',
    meeting: 'קבעי יום ללא פגישות',
    break: 'הפסקות זה בסדר! רק תכנני אותן',
    other: 'נסי לזהות את מקור ההסחה'
  };
  return suggestions[type] || suggestions.other;
}

// =====================================
// סיכום יומי
// =====================================

/**
 * יצירת סיכום יומי
 */
export async function generateDailySummary(tasks, date = null) {
  const targetDate = date || new Date().toISOString().split('T')[0];
  const userId = await getCurrentUserId();

  // משימות להיום
  const todayTasks = tasks.filter(t => t.due_date === targetDate);
  const completedToday = todayTasks.filter(t => t.is_completed);

  // חישובים
  const plannedMinutes = todayTasks.reduce((sum, t) => sum + (t.estimated_duration || 0), 0);
  const actualMinutes = completedToday.reduce((sum, t) => sum + (t.time_spent || 0), 0);

  // איחורים
  let lateStarts = 0;
  if (userId && isOnline()) {
    try {
      const { count } = await supabase
        .from('learning_late_starts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('date', targetDate);
      lateStarts = count || 0;
    } catch (e) {}
  }
  if (lateStarts === 0) {
    const local = JSON.parse(localStorage.getItem('late_starts_history') || '[]');
    lateStarts = local.filter(l => l.date === targetDate).length;
  }

  // הפרעות
  let interruptions = 0;
  if (userId && isOnline()) {
    try {
      const { count } = await supabase
        .from('learning_interruptions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('date', targetDate);
      interruptions = count || 0;
    } catch (e) {}
  }
  if (interruptions === 0) {
    const local = JSON.parse(localStorage.getItem('interruptions_history') || '[]');
    interruptions = local.filter(i => i.date === targetDate).length;
  }

  // ציון פרודוקטיביות
  let productivityScore = 0;
  if (todayTasks.length > 0) {
    const completionRate = completedToday.length / todayTasks.length;
    const accuracyRate = plannedMinutes > 0 ? 
      Math.min(1, actualMinutes / plannedMinutes) : 1;
    const lateStartPenalty = Math.max(0, 1 - (lateStarts * 0.1));
    const interruptionPenalty = Math.max(0, 1 - (interruptions * 0.05));

    productivityScore = Math.round(
      (completionRate * 40 + accuracyRate * 30 + lateStartPenalty * 15 + interruptionPenalty * 15)
    );
  }

  const summary = {
    date: targetDate,
    plannedTasks: todayTasks.length,
    completedTasks: completedToday.length,
    completionRate: todayTasks.length > 0 ? 
      Math.round((completedToday.length / todayTasks.length) * 100) : 0,
    plannedMinutes,
    actualMinutes,
    timeDeviation: plannedMinutes > 0 ? 
      Math.round(((actualMinutes - plannedMinutes) / plannedMinutes) * 100) : 0,
    lateStarts,
    interruptions,
    productivityScore,
    grade: getGrade(productivityScore),
    insights: generateInsights(completedToday.length, todayTasks.length, lateStarts, interruptions)
  };

  // שמירה
  await saveDailySummary(summary);

  return summary;
}

function getGrade(score) {
  if (score >= 90) return { emoji: '🌟', text: 'מצוין!' };
  if (score >= 75) return { emoji: '😊', text: 'טוב מאוד' };
  if (score >= 60) return { emoji: '👍', text: 'סביר' };
  if (score >= 40) return { emoji: '💪', text: 'יש מקום לשיפור' };
  return { emoji: '🤗', text: 'יום קשה, מחר יהיה טוב יותר' };
}

function generateInsights(completed, planned, lateStarts, interruptions) {
  const insights = [];

  if (completed === planned && planned > 0) {
    insights.push('✅ השלמת את כל המשימות!');
  } else if (completed > 0 && completed >= planned * 0.8) {
    insights.push(`✅ השלמת ${completed} מתוך ${planned} משימות`);
  } else if (planned > 0) {
    insights.push(`📋 ${planned - completed} משימות לא הושלמו`);
  }

  if (lateStarts === 0) {
    insights.push('⏰ התחלת בזמן את כל המשימות!');
  } else if (lateStarts > 0) {
    insights.push(`⏰ ${lateStarts} התחלות באיחור`);
  }

  if (interruptions === 0) {
    insights.push('🎯 יום ללא הפרעות!');
  } else if (interruptions <= 3) {
    insights.push(`📵 רק ${interruptions} הפרעות`);
  } else {
    insights.push(`📵 ${interruptions} הפרעות - נסי להפחית`);
  }

  return insights;
}

// =====================================
// דפוסי משתמש
// =====================================

/**
 * עדכון דפוסי משתמש
 */
async function updateUserPatterns(userId) {
  if (!userId) return null;

  try {
    const accuracy = await analyzeEstimationAccuracy();
    const hours = await analyzeProductiveHours();

    const patterns = {
      user_id: userId,
      estimation_multiplier: accuracy.suggestedMultiplier || 1,
      best_hours: hours.bestHours?.map(h => h.hour) || [],
      worst_hours: hours.worstHours?.map(h => h.hour) || [],
      total_tasks_analyzed: accuracy.totalTasks || 0,
      last_updated: new Date().toISOString()
    };

    if (isOnline()) {
      await supabase
        .from('learning_user_patterns')
        .upsert(patterns, { onConflict: 'user_id' });
    }

    localStorage.setItem('user_patterns', JSON.stringify(patterns));
    return patterns;
  } catch (e) {
    console.error('שגיאה בעדכון דפוסים:', e);
    return null;
  }
}

/**
 * קבלת דפוסי משתמש
 */
export async function getUserPatterns() {
  const userId = await getCurrentUserId();

  if (userId && isOnline()) {
    try {
      const { data, error } = await supabase
        .from('learning_user_patterns')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (!error && data) {
        return {
          estimationMultiplier: data.estimation_multiplier,
          bestHours: data.best_hours || [],
          worstHours: data.worst_hours || [],
          mainDistraction: data.main_distraction,
          avgLateMinutes: data.avg_late_minutes || 0
        };
      }
    } catch (e) {}
  }

  // fallback
  try {
    return JSON.parse(localStorage.getItem('user_patterns') || '{}');
  } catch (e) {
    return {};
  }
}

// =====================================
// סנכרון נתונים מקומיים
// =====================================

/**
 * סנכרון נתונים שנשמרו מקומית
 */
export async function syncLocalData() {
  const userId = await getCurrentUserId();
  if (!userId || !isOnline()) return { synced: 0 };

  let synced = 0;

  // סנכרון משימות
  try {
    const localTasks = JSON.parse(localStorage.getItem('learning_completed_tasks') || '[]');
    const needsSync = localTasks.filter(t => t.needsSync);

    for (const task of needsSync) {
      try {
        await supabase.from('learning_completed_tasks').insert({
          user_id: userId,
          task_id: task.id,
          title: task.title,
          task_type: task.task_type || 'general',
          estimated_duration: task.estimated_duration || 0,
          actual_duration: task.time_spent || 0,
          date: task.date || new Date().toISOString().split('T')[0]
        });
        task.needsSync = false;
        synced++;
      } catch (e) {}
    }

    localStorage.setItem('learning_completed_tasks', JSON.stringify(localTasks));
  } catch (e) {}

  // סנכרון הפרעות
  try {
    const localInterruptions = JSON.parse(localStorage.getItem('interruptions_history') || '[]');
    const needsSync = localInterruptions.filter(i => i.needsSync);

    for (const interruption of needsSync) {
      try {
        await supabase.from('learning_interruptions').insert({
          user_id: userId,
          task_id: interruption.taskId,
          type: interruption.type,
          duration: interruption.duration,
          date: interruption.date
        });
        interruption.needsSync = false;
        synced++;
      } catch (e) {}
    }

    localStorage.setItem('interruptions_history', JSON.stringify(localInterruptions));
  } catch (e) {}

  console.log(`🔄 סונכרנו ${synced} רשומות`);
  return { synced };
}

// =====================================
// ייצוא
// =====================================

export default {
  saveCompletedTask,
  saveInterruption,
  saveLateStart,
  saveDailySummary,
  analyzeEstimationAccuracy,
  analyzeProductiveHours,
  analyzeInterruptions,
  generateDailySummary,
  getUserPatterns,
  syncLocalData
};
