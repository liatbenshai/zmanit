/**
 * מנוע למידה מרכזי - זמנית
 * ============================
 * מנתח דפוסי עבודה ומספק המלצות מותאמות אישית
 */

// מפתחות localStorage
const STORAGE_KEYS = {
  COMPLETED_TASKS: 'learning_completed_tasks',
  LATE_STARTS: 'late_starts_history',
  INTERRUPTIONS: 'interruptions_history',
  DAILY_SUMMARIES: 'daily_summaries',
  PRODUCTIVITY_SCORES: 'productivity_scores',
  USER_PATTERNS: 'user_patterns'
};

// =====================================
// שמירת נתונים
// =====================================

/**
 * שמירת משימה שהושלמה לניתוח
 */
export function saveCompletedTask(task) {
  try {
    const history = JSON.parse(localStorage.getItem(STORAGE_KEYS.COMPLETED_TASKS) || '[]');
    
    const taskRecord = {
      id: task.id,
      title: task.title,
      taskType: task.task_type || 'general',
      category: task.category || 'work',
      estimatedDuration: task.estimated_duration || 0,
      actualDuration: task.time_spent || 0,
      scheduledTime: task.due_time || null,
      actualStartTime: task.actual_start_time || null,
      completedAt: new Date().toISOString(),
      date: task.due_date || new Date().toISOString().split('T')[0],
      dayOfWeek: new Date().getDay(),
      hourCompleted: new Date().getHours(),
      priority: task.priority || 'normal',
      quadrant: task.quadrant || null,
      wasLate: task.actual_start_time && task.due_time ? 
        task.actual_start_time > task.due_time : false,
      accuracyRatio: task.estimated_duration > 0 ? 
        (task.time_spent || 0) / task.estimated_duration : null
    };
    
    history.push(taskRecord);
    
    // שומרים 500 משימות אחרונות
    if (history.length > 500) {
      history.splice(0, history.length - 500);
    }
    
    localStorage.setItem(STORAGE_KEYS.COMPLETED_TASKS, JSON.stringify(history));
    
    // עדכון דפוסים
    updateUserPatterns();
    
    return taskRecord;
  } catch (e) {
    console.error('שגיאה בשמירת משימה:', e);
    return null;
  }
}

/**
 * שמירת הפרעה
 */
export function saveInterruption(interruption) {
  try {
    const history = JSON.parse(localStorage.getItem(STORAGE_KEYS.INTERRUPTIONS) || '[]');
    
    const record = {
      id: Date.now(),
      taskId: interruption.taskId,
      taskTitle: interruption.taskTitle,
      type: interruption.type || 'other', // phone, person, email, other
      description: interruption.description || '',
      duration: interruption.duration || 5, // דקות
      timestamp: new Date().toISOString(),
      date: new Date().toISOString().split('T')[0],
      dayOfWeek: new Date().getDay(),
      hour: new Date().getHours()
    };
    
    history.push(record);
    
    if (history.length > 200) {
      history.splice(0, history.length - 200);
    }
    
    localStorage.setItem(STORAGE_KEYS.INTERRUPTIONS, JSON.stringify(history));
    return record;
  } catch (e) {
    console.error('שגיאה בשמירת הפרעה:', e);
    return null;
  }
}

/**
 * שמירת סיכום יומי
 */
export function saveDailySummary(summary) {
  try {
    const summaries = JSON.parse(localStorage.getItem(STORAGE_KEYS.DAILY_SUMMARIES) || '[]');
    
    const record = {
      date: summary.date || new Date().toISOString().split('T')[0],
      plannedTasks: summary.plannedTasks || 0,
      completedTasks: summary.completedTasks || 0,
      plannedMinutes: summary.plannedMinutes || 0,
      actualMinutes: summary.actualMinutes || 0,
      lateStarts: summary.lateStarts || 0,
      interruptions: summary.interruptions || 0,
      productivityScore: summary.productivityScore || 0,
      bestHour: summary.bestHour || null,
      worstHour: summary.worstHour || null,
      notes: summary.notes || ''
    };
    
    // עדכון או הוספה
    const existingIndex = summaries.findIndex(s => s.date === record.date);
    if (existingIndex >= 0) {
      summaries[existingIndex] = record;
    } else {
      summaries.push(record);
    }
    
    // שומרים 90 ימים אחרונים
    if (summaries.length > 90) {
      summaries.splice(0, summaries.length - 90);
    }
    
    localStorage.setItem(STORAGE_KEYS.DAILY_SUMMARIES, JSON.stringify(summaries));
    return record;
  } catch (e) {
    console.error('שגיאה בשמירת סיכום:', e);
    return null;
  }
}

// =====================================
// ניתוח דיוק הערכות
// =====================================

/**
 * ניתוח דיוק הערכות זמן
 */
export function analyzeEstimationAccuracy() {
  try {
    const history = JSON.parse(localStorage.getItem(STORAGE_KEYS.COMPLETED_TASKS) || '[]');
    
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
        byType[type] = { estimated: 0, actual: 0, count: 0, tasks: [] };
      }
      byType[type].estimated += t.estimatedDuration;
      byType[type].actual += t.actualDuration;
      byType[type].count++;
      byType[type].tasks.push(t);
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
    
    // המלצות ספציפיות לסוגי משימות בעייתיים
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
  } catch (e) {
    console.error('שגיאה בניתוח דיוק:', e);
    return { hasEnoughData: false, error: e.message };
  }
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
export function analyzeProductiveHours() {
  try {
    const history = JSON.parse(localStorage.getItem(STORAGE_KEYS.COMPLETED_TASKS) || '[]');
    
    if (history.length < 10) {
      return {
        hasEnoughData: false,
        message: 'צריך לפחות 10 משימות לניתוח שעות'
      };
    }
    
    // ניתוח לפי שעות
    const byHour = {};
    for (let h = 6; h <= 22; h++) {
      byHour[h] = { 
        tasks: 0, 
        totalMinutes: 0, 
        avgEfficiency: 0,
        efficiencySum: 0 
      };
    }
    
    history.forEach(t => {
      const hour = t.hourCompleted;
      if (hour >= 6 && hour <= 22) {
        byHour[hour].tasks++;
        byHour[hour].totalMinutes += t.actualDuration || 0;
        if (t.accuracyRatio) {
          // יעילות = כמה קרוב להערכה (1 = מושלם)
          const efficiency = t.accuracyRatio <= 1 ? t.accuracyRatio : 1 / t.accuracyRatio;
          byHour[hour].efficiencySum += efficiency;
        }
      }
    });
    
    // חישוב ממוצעים
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
    const byDay = {};
    const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    
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
  } catch (e) {
    console.error('שגיאה בניתוח שעות:', e);
    return { hasEnoughData: false, error: e.message };
  }
}

// =====================================
// ניתוח הפרעות
// =====================================

/**
 * ניתוח דפוסי הפרעות
 */
export function analyzeInterruptions() {
  try {
    const history = JSON.parse(localStorage.getItem(STORAGE_KEYS.INTERRUPTIONS) || '[]');
    
    if (history.length < 5) {
      return {
        hasEnoughData: false,
        message: 'צריך לפחות 5 הפרעות מתועדות לניתוח'
      };
    }
    
    // סינון שבועיים אחרונים
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    
    const recent = history.filter(i => new Date(i.timestamp) >= twoWeeksAgo);
    
    // ניתוח לפי סוג
    const byType = {};
    const typeNames = {
      phone: '📱 טלפון',
      person: '👤 אדם',
      email: '📧 מייל',
      meeting: '🤝 פגישה',
      other: '❓ אחר'
    };
    
    recent.forEach(i => {
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
    recent.forEach(i => {
      const hour = i.hour;
      byHour[hour] = (byHour[hour] || 0) + 1;
    });
    
    const peakHours = Object.entries(byHour)
      .map(([hour, count]) => ({ hour: parseInt(hour), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
    
    // סטטיסטיקות
    const totalInterruptions = recent.length;
    const totalLostMinutes = recent.reduce((sum, i) => sum + (i.duration || 5), 0);
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
  } catch (e) {
    console.error('שגיאה בניתוח הפרעות:', e);
    return { hasEnoughData: false, error: e.message };
  }
}

function getInterruptionSuggestion(type) {
  const suggestions = {
    phone: 'העבירי לשקט בזמן משימות מרוכזות',
    person: 'קבעי "שעות קבלה" לשאלות',
    email: 'בדקי מיילים רק פעמיים ביום',
    meeting: 'קבעי יום ללא פגישות',
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
export function generateDailySummary(tasks, date = null) {
  try {
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    // משימות להיום
    const todayTasks = tasks.filter(t => t.due_date === targetDate);
    const completedToday = todayTasks.filter(t => t.is_completed);
    
    // חישובים
    const plannedMinutes = todayTasks.reduce((sum, t) => sum + (t.estimated_duration || 0), 0);
    const actualMinutes = completedToday.reduce((sum, t) => sum + (t.time_spent || 0), 0);
    
    // איחורים
    const lateStarts = JSON.parse(localStorage.getItem(STORAGE_KEYS.LATE_STARTS) || '[]')
      .filter(l => l.date === targetDate).length;
    
    // הפרעות
    const interruptions = JSON.parse(localStorage.getItem(STORAGE_KEYS.INTERRUPTIONS) || '[]')
      .filter(i => i.date === targetDate).length;
    
    // ציון פרודוקטיביות (0-100)
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
    
    // זיהוי שעה הכי טובה
    const tasksByHour = {};
    completedToday.forEach(t => {
      const hour = t.completed_at ? new Date(t.completed_at).getHours() : null;
      if (hour) {
        if (!tasksByHour[hour]) tasksByHour[hour] = 0;
        tasksByHour[hour]++;
      }
    });
    
    const bestHour = Object.entries(tasksByHour)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    
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
      bestHour: bestHour ? parseInt(bestHour) : null,
      grade: getGrade(productivityScore),
      insights: generateInsights(completedToday.length, todayTasks.length, lateStarts, interruptions)
    };
    
    // שמירה
    saveDailySummary(summary);
    
    return summary;
  } catch (e) {
    console.error('שגיאה ביצירת סיכום:', e);
    return null;
  }
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
// עדכון דפוסי משתמש
// =====================================

/**
 * עדכון דפוסים כלליים
 */
function updateUserPatterns() {
  try {
    const accuracy = analyzeEstimationAccuracy();
    const hours = analyzeProductiveHours();
    const interruptions = analyzeInterruptions();
    
    const patterns = {
      lastUpdated: new Date().toISOString(),
      estimationMultiplier: accuracy.suggestedMultiplier || 1,
      bestHours: hours.bestHours?.map(h => h.hour) || [],
      worstHours: hours.worstHours?.map(h => h.hour) || [],
      mainDistraction: interruptions.byType?.[0]?.type || null,
      avgLateMinutes: getAvgLateMinutes()
    };
    
    localStorage.setItem(STORAGE_KEYS.USER_PATTERNS, JSON.stringify(patterns));
    return patterns;
  } catch (e) {
    console.error('שגיאה בעדכון דפוסים:', e);
    return null;
  }
}

function getAvgLateMinutes() {
  try {
    const lateStarts = JSON.parse(localStorage.getItem(STORAGE_KEYS.LATE_STARTS) || '[]');
    if (lateStarts.length === 0) return 0;
    
    const recent = lateStarts.slice(-20); // 20 אחרונים
    const avg = recent.reduce((sum, l) => sum + l.lateMinutes, 0) / recent.length;
    return Math.round(avg);
  } catch (e) {
    return 0;
  }
}

/**
 * קבלת דפוסי משתמש
 */
export function getUserPatterns() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.USER_PATTERNS) || '{}');
  } catch (e) {
    return {};
  }
}

// =====================================
// המלצות חכמות לתזמון
// =====================================

/**
 * קבלת המלצה לזמן משוער
 */
export function getSuggestedDuration(taskType, baseDuration) {
  const patterns = getUserPatterns();
  const multiplier = patterns.estimationMultiplier || 1;
  
  // בדיקה אם יש דפוס ספציפי לסוג משימה
  const accuracy = analyzeEstimationAccuracy();
  const typeData = accuracy.byType?.find(t => t.type === taskType);
  
  if (typeData && typeData.count >= 3) {
    return Math.round(baseDuration * typeData.ratio);
  }
  
  return Math.round(baseDuration * multiplier);
}

/**
 * קבלת המלצה לשעת התחלה
 */
export function getSuggestedStartTime(scheduledTime, taskType) {
  const patterns = getUserPatterns();
  const avgLate = patterns.avgLateMinutes || 0;
  
  if (avgLate > 5) {
    // הצע להתחיל מאוחר יותר
    const [hours, minutes] = scheduledTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + avgLate;
    const newHours = Math.floor(totalMinutes / 60);
    const newMinutes = totalMinutes % 60;
    
    return {
      originalTime: scheduledTime,
      suggestedTime: `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`,
      reason: `בממוצע את מתחילה ${avgLate} דקות אחרי הזמן המתוכנן`
    };
  }
  
  return null;
}

/**
 * בדיקה האם שעה מסוימת טובה למשימה
 */
export function isGoodTimeForTask(hour, taskPriority = 'normal') {
  const patterns = getUserPatterns();
  const bestHours = patterns.bestHours || [];
  const worstHours = patterns.worstHours || [];
  
  if (taskPriority === 'high' || taskPriority === 'urgent') {
    if (worstHours.includes(hour)) {
      return {
        isGood: false,
        reason: 'זו שעה שבה את פחות יעילה',
        suggestion: `נסי ${bestHours[0]}:00 או ${bestHours[1]}:00`
      };
    }
  }
  
  if (bestHours.includes(hour)) {
    return { isGood: true, reason: 'זו אחת השעות הכי טובות שלך!' };
  }
  
  return { isGood: true, reason: null };
}

// =====================================
// ייצוא כל הפונקציות
// =====================================

export default {
  // שמירה
  saveCompletedTask,
  saveInterruption,
  saveDailySummary,
  
  // ניתוח
  analyzeEstimationAccuracy,
  analyzeProductiveHours,
  analyzeInterruptions,
  generateDailySummary,
  
  // דפוסים והמלצות
  getUserPatterns,
  getSuggestedDuration,
  getSuggestedStartTime,
  isGoodTimeForTask,
  
  // מפתחות
  STORAGE_KEYS
};
