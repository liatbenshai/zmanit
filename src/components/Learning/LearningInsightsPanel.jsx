/**
 * פאנל תובנות ולמידה - זמנית
 * ============================
 * מציג ניתוח מקיף של דפוסי העבודה והמלצות לשיפור
 */

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  analyzeEstimationAccuracy,
  analyzeProductiveHours,
  analyzeInterruptions,
  generateDailySummary,
  getUserPatterns
} from '../../utils/learningEngine';

/**
 * רכיב ראשי - פאנל תובנות
 */
function LearningInsightsPanel({ tasks = [], onClose }) {
  const [activeTab, setActiveTab] = useState('summary');
  const [dailySummary, setDailySummary] = useState(null);
  
  // ניתוחים
  const estimationAnalysis = useMemo(() => analyzeEstimationAccuracy(), [tasks]);
  const hoursAnalysis = useMemo(() => analyzeProductiveHours(), [tasks]);
  const interruptionsAnalysis = useMemo(() => analyzeInterruptions(), []);
  const patterns = useMemo(() => getUserPatterns(), []);
  
  // יצירת סיכום יומי
  useEffect(() => {
    if (tasks.length > 0) {
      const summary = generateDailySummary(tasks);
      setDailySummary(summary);
    }
  }, [tasks]);
  
  const tabs = [
    { id: 'summary', name: 'סיכום יומי', icon: '📊' },
    { id: 'accuracy', name: 'דיוק הערכות', icon: '🎯' },
    { id: 'hours', name: 'שעות פרודוקטיביות', icon: '⏰' },
    { id: 'interruptions', name: 'הפרעות', icon: '📵' },
    { id: 'tips', name: 'טיפים', icon: '💡' }
  ];
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden"
    >
      {/* כותרת */}
      <div className="bg-gradient-to-r from-purple-500 to-indigo-600 p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">🧠 מערכת למידה</h2>
            <p className="text-purple-100 mt-1">תובנות אישיות לניהול זמן טוב יותר</p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              ✕
            </button>
          )}
        </div>
        
        {/* ציון יומי */}
        {dailySummary && (
          <div className="mt-4 bg-white/20 rounded-xl p-4 backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-4xl">{dailySummary.grade?.emoji}</div>
                <div className="text-sm text-purple-100">{dailySummary.grade?.text}</div>
              </div>
              <div className="text-left">
                <div className="text-3xl font-bold">{dailySummary.productivityScore}</div>
                <div className="text-sm text-purple-100">ציון פרודוקטיביות</div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* טאבים */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex-1 min-w-max px-4 py-3 text-sm font-medium transition-colors
              ${activeTab === tab.id
                ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50 dark:bg-purple-900/20'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }
            `}
          >
            <span className="ml-1">{tab.icon}</span>
            {tab.name}
          </button>
        ))}
      </div>
      
      {/* תוכן */}
      <div className="p-6 max-h-96 overflow-y-auto">
        <AnimatePresence mode="wait">
          {activeTab === 'summary' && (
            <TabContent key="summary">
              <DailySummaryTab summary={dailySummary} />
            </TabContent>
          )}
          
          {activeTab === 'accuracy' && (
            <TabContent key="accuracy">
              <AccuracyTab analysis={estimationAnalysis} />
            </TabContent>
          )}
          
          {activeTab === 'hours' && (
            <TabContent key="hours">
              <ProductiveHoursTab analysis={hoursAnalysis} />
            </TabContent>
          )}
          
          {activeTab === 'interruptions' && (
            <TabContent key="interruptions">
              <InterruptionsTab analysis={interruptionsAnalysis} />
            </TabContent>
          )}
          
          {activeTab === 'tips' && (
            <TabContent key="tips">
              <TipsTab 
                estimation={estimationAnalysis}
                hours={hoursAnalysis}
                interruptions={interruptionsAnalysis}
                patterns={patterns}
              />
            </TabContent>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/**
 * עטיפה לאנימציה
 */
function TabContent({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
    >
      {children}
    </motion.div>
  );
}

/**
 * טאב סיכום יומי
 */
function DailySummaryTab({ summary }) {
  if (!summary) {
    return (
      <div className="text-center py-8 text-gray-500">
        <span className="text-4xl block mb-4">📋</span>
        <p>אין נתונים להיום עדיין</p>
        <p className="text-sm mt-2">התחילי לעבוד על משימות וחזרי לכאן</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* סטטיסטיקות */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon="✅"
          label="משימות שהושלמו"
          value={`${summary.completedTasks}/${summary.plannedTasks}`}
          subtext={`${summary.completionRate}%`}
          color="green"
        />
        <StatCard
          icon="⏱️"
          label="זמן עבודה"
          value={`${summary.actualMinutes} דק'`}
          subtext={`מתוכנן: ${summary.plannedMinutes}`}
          color="blue"
        />
        <StatCard
          icon="⏰"
          label="התחלות באיחור"
          value={summary.lateStarts}
          subtext={summary.lateStarts === 0 ? 'מצוין!' : 'יש מקום לשיפור'}
          color={summary.lateStarts === 0 ? 'green' : 'yellow'}
        />
        <StatCard
          icon="📵"
          label="הפרעות"
          value={summary.interruptions}
          subtext={summary.interruptions <= 3 ? 'סביר' : 'הרבה'}
          color={summary.interruptions <= 3 ? 'green' : 'red'}
        />
      </div>
      
      {/* תובנות */}
      {summary.insights && summary.insights.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
          <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">תובנות היום</h4>
          <ul className="space-y-1">
            {summary.insights.map((insight, i) => (
              <li key={i} className="text-sm text-gray-600 dark:text-gray-400">
                {insight}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * טאב דיוק הערכות
 */
function AccuracyTab({ analysis }) {
  if (!analysis.hasEnoughData) {
    return (
      <div className="text-center py-8 text-gray-500">
        <span className="text-4xl block mb-4">📊</span>
        <p>{analysis.message}</p>
        <p className="text-sm mt-2">השלימי משימות עם מעקב זמן</p>
      </div>
    );
  }
  
  const getDeviationColor = (deviation) => {
    if (Math.abs(deviation) <= 10) return 'text-green-600';
    if (Math.abs(deviation) <= 30) return 'text-yellow-600';
    return 'text-red-600';
  };
  
  return (
    <div className="space-y-4">
      {/* סיכום כללי */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-gray-700 dark:text-gray-300">דיוק כללי</h4>
            <p className={`text-2xl font-bold ${getDeviationColor(analysis.overallDeviation)}`}>
              {analysis.overallDeviation > 0 ? '+' : ''}{analysis.overallDeviation}%
            </p>
          </div>
          <div className="text-4xl">
            {Math.abs(analysis.overallDeviation) <= 10 ? '🎯' : 
             analysis.overallDeviation > 0 ? '⏰' : '🚀'}
          </div>
        </div>
        <p className="text-sm text-gray-500 mt-2">
          {analysis.overallDeviation > 10 
            ? `משימות לוקחות ${analysis.overallDeviation}% יותר זמן מהמשוער`
            : analysis.overallDeviation < -10
            ? `משימות נגמרות ${Math.abs(analysis.overallDeviation)}% מהר יותר`
            : 'הערכות הזמן שלך מדויקות!'}
        </p>
      </div>
      
      {/* פירוט לפי סוג */}
      {analysis.byType && analysis.byType.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">לפי סוג משימה</h4>
          <div className="space-y-2">
            {analysis.byType.slice(0, 5).map((type, i) => (
              <div 
                key={i}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
              >
                <div>
                  <span className="font-medium">{type.type}</span>
                  <span className="text-sm text-gray-500 mr-2">({type.count} משימות)</span>
                </div>
                <div className="text-left">
                  <span className={`font-bold ${getDeviationColor(type.deviation)}`}>
                    {type.deviation > 0 ? '+' : ''}{type.deviation}%
                  </span>
                  <p className="text-xs text-gray-500">{type.suggestion}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* המלצות */}
      {analysis.recommendations && (
        <RecommendationsList recommendations={analysis.recommendations} />
      )}
    </div>
  );
}

/**
 * טאב שעות פרודוקטיביות
 */
function ProductiveHoursTab({ analysis }) {
  if (!analysis.hasEnoughData) {
    return (
      <div className="text-center py-8 text-gray-500">
        <span className="text-4xl block mb-4">⏰</span>
        <p>{analysis.message}</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* שעות טובות */}
      {analysis.bestHours && analysis.bestHours.length > 0 && (
        <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4">
          <h4 className="font-medium text-green-700 dark:text-green-300 mb-2">
            ⭐ השעות הכי טובות שלך
          </h4>
          <div className="flex gap-2 flex-wrap">
            {analysis.bestHours.map((h, i) => (
              <span 
                key={i}
                className="px-3 py-1 bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-200 rounded-full text-sm font-medium"
              >
                {h.hourDisplay}
              </span>
            ))}
          </div>
          <p className="text-sm text-green-600 dark:text-green-400 mt-2">
            שבצי משימות חשובות בשעות האלה
          </p>
        </div>
      )}
      
      {/* שעות פחות טובות */}
      {analysis.worstHours && analysis.worstHours.length > 0 && 
       analysis.worstHours[0].avgEfficiency < 70 && (
        <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-4">
          <h4 className="font-medium text-orange-700 dark:text-orange-300 mb-2">
            😴 שעות פחות יעילות
          </h4>
          <div className="flex gap-2 flex-wrap">
            {analysis.worstHours.map((h, i) => (
              <span 
                key={i}
                className="px-3 py-1 bg-orange-100 dark:bg-orange-800 text-orange-700 dark:text-orange-200 rounded-full text-sm font-medium"
              >
                {h.hourDisplay}
              </span>
            ))}
          </div>
          <p className="text-sm text-orange-600 dark:text-orange-400 mt-2">
            נסי הפסקות או משימות קלות בשעות האלה
          </p>
        </div>
      )}
      
      {/* גרף שעות */}
      <div>
        <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">יעילות לפי שעה</h4>
        <div className="space-y-1">
          {analysis.byHour?.slice(0, 8).map((h, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-12 text-sm text-gray-500">{h.hourDisplay}</span>
              <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all ${
                    h.avgEfficiency >= 80 ? 'bg-green-500' :
                    h.avgEfficiency >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${h.avgEfficiency}%` }}
                />
              </div>
              <span className="w-12 text-sm text-gray-500 text-left">{h.avgEfficiency}%</span>
            </div>
          ))}
        </div>
      </div>
      
      {/* ימים */}
      {analysis.byDay && analysis.byDay.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">יעילות לפי יום</h4>
          <div className="grid grid-cols-7 gap-1">
            {analysis.byDay.map((d, i) => (
              <div 
                key={i}
                className={`text-center p-2 rounded-lg ${
                  d.avgEfficiency >= 80 ? 'bg-green-100 dark:bg-green-900/30' :
                  d.avgEfficiency >= 60 ? 'bg-yellow-100 dark:bg-yellow-900/30' :
                  'bg-gray-100 dark:bg-gray-700/50'
                }`}
              >
                <div className="text-xs text-gray-500">{d.dayName}</div>
                <div className="font-bold text-sm">{d.avgEfficiency}%</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * טאב הפרעות
 */
function InterruptionsTab({ analysis }) {
  if (!analysis.hasEnoughData) {
    return (
      <div className="text-center py-8 text-gray-500">
        <span className="text-4xl block mb-4">📵</span>
        <p>{analysis.message}</p>
        <p className="text-sm mt-2">השתמשי בכפתור "הופרעתי" במהלך עבודה</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* סטטיסטיקות */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          icon="📵"
          label="סה״כ הפרעות"
          value={analysis.totalInterruptions}
          color="gray"
          small
        />
        <StatCard
          icon="⏱️"
          label="זמן אבוד"
          value={`${analysis.totalLostMinutes} דק'`}
          color="red"
          small
        />
        <StatCard
          icon="📅"
          label="ממוצע יומי"
          value={analysis.avgPerDay}
          color="yellow"
          small
        />
      </div>
      
      {/* לפי סוג */}
      {analysis.byType && analysis.byType.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">לפי סוג הפרעה</h4>
          <div className="space-y-2">
            {analysis.byType.map((type, i) => (
              <div 
                key={i}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">{type.typeName.split(' ')[0]}</span>
                  <span>{type.typeName.split(' ')[1]}</span>
                </div>
                <div className="text-left">
                  <span className="font-bold">{type.count} פעמים</span>
                  <p className="text-xs text-gray-500">{type.totalDuration} דקות</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* שעות שיא */}
      {analysis.peakHours && analysis.peakHours.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4">
          <h4 className="font-medium text-red-700 dark:text-red-300 mb-2">
            🚨 שעות עם הכי הרבה הפרעות
          </h4>
          <div className="flex gap-2 flex-wrap">
            {analysis.peakHours.map((h, i) => (
              <span 
                key={i}
                className="px-3 py-1 bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-200 rounded-full text-sm"
              >
                {h.hour}:00 ({h.count} הפרעות)
              </span>
            ))}
          </div>
        </div>
      )}
      
      {/* המלצות */}
      {analysis.recommendations && (
        <RecommendationsList recommendations={analysis.recommendations} />
      )}
    </div>
  );
}

/**
 * טאב טיפים
 */
function TipsTab({ estimation, hours, interruptions, patterns }) {
  const allRecommendations = [
    ...(estimation.recommendations || []),
    ...(hours.recommendations || []),
    ...(interruptions.recommendations || [])
  ];
  
  // טיפים כלליים
  const generalTips = [
    {
      icon: '🎯',
      title: 'התחילי מהמשימה הקשה',
      description: 'המוח הכי חד בבוקר - נצלי את זה'
    },
    {
      icon: '⏰',
      title: 'טכניקת פומודורו',
      description: '25 דקות עבודה + 5 דקות הפסקה'
    },
    {
      icon: '📵',
      title: 'מצב ריכוז',
      description: 'השתיקי התראות בזמן משימות מרוכזות'
    },
    {
      icon: '📝',
      title: 'תכנון ערב',
      description: 'תכנני את המחר בסוף כל יום'
    },
    {
      icon: '💪',
      title: 'אל תשכחי הפסקות',
      description: 'מוח עייף = פחות יעילות'
    }
  ];
  
  // טיפים מותאמים אישית
  const personalTips = [];
  
  if (patterns.avgLateMinutes > 5) {
    personalTips.push({
      icon: '⏰',
      title: `את מאחרת בממוצע ${patterns.avgLateMinutes} דקות`,
      description: 'נסי לתזמן משימות מעט יותר מאוחר'
    });
  }
  
  if (patterns.estimationMultiplier > 1.2) {
    personalTips.push({
      icon: '📊',
      title: 'הערכות זמן נמוכות',
      description: `הוסיפי ${Math.round((patterns.estimationMultiplier - 1) * 100)}% לכל הערכה`
    });
  }
  
  if (patterns.bestHours && patterns.bestHours.length > 0) {
    personalTips.push({
      icon: '⭐',
      title: 'השעות הטובות שלך',
      description: `${patterns.bestHours.slice(0, 2).join(':00, ')}:00 - שבצי שם משימות חשובות`
    });
  }
  
  return (
    <div className="space-y-4">
      {/* טיפים אישיים */}
      {personalTips.length > 0 && (
        <div>
          <h4 className="font-medium text-purple-700 dark:text-purple-300 mb-2">
            💜 טיפים מותאמים אישית
          </h4>
          <div className="space-y-2">
            {personalTips.map((tip, i) => (
              <div 
                key={i}
                className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-700"
              >
                <div className="flex items-start gap-2">
                  <span className="text-xl">{tip.icon}</span>
                  <div>
                    <div className="font-medium text-purple-700 dark:text-purple-300">{tip.title}</div>
                    <div className="text-sm text-purple-600 dark:text-purple-400">{tip.description}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* המלצות מהניתוחים */}
      {allRecommendations.length > 0 && (
        <RecommendationsList 
          recommendations={allRecommendations.slice(0, 5)} 
          title="המלצות מהנתונים שלך"
        />
      )}
      
      {/* טיפים כלליים */}
      <div>
        <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">
          💡 טיפים כלליים
        </h4>
        <div className="grid grid-cols-1 gap-2">
          {generalTips.map((tip, i) => (
            <div 
              key={i}
              className="flex items-start gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-colors"
            >
              <span className="text-lg">{tip.icon}</span>
              <div>
                <div className="font-medium text-sm">{tip.title}</div>
                <div className="text-xs text-gray-500">{tip.description}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * כרטיס סטטיסטיקה
 */
function StatCard({ icon, label, value, subtext, color = 'gray', small = false }) {
  const colors = {
    green: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300',
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
    yellow: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300',
    red: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300',
    gray: 'bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300'
  };
  
  return (
    <div className={`rounded-xl p-3 ${colors[color]}`}>
      <div className="flex items-center gap-2">
        <span className={small ? 'text-lg' : 'text-2xl'}>{icon}</span>
        <div>
          <div className={`font-bold ${small ? 'text-lg' : 'text-xl'}`}>{value}</div>
          <div className="text-xs opacity-80">{label}</div>
          {subtext && <div className="text-xs opacity-60">{subtext}</div>}
        </div>
      </div>
    </div>
  );
}

/**
 * רשימת המלצות
 */
function RecommendationsList({ recommendations, title = 'המלצות' }) {
  if (!recommendations || recommendations.length === 0) return null;
  
  return (
    <div>
      <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">{title}</h4>
      <div className="space-y-2">
        {recommendations.map((rec, i) => (
          <div 
            key={i}
            className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700"
          >
            <div className="flex items-start gap-2">
              <span className="text-xl">{rec.icon}</span>
              <div>
                <div className="font-medium text-blue-700 dark:text-blue-300">{rec.title}</div>
                <div className="text-sm text-blue-600 dark:text-blue-400">{rec.message}</div>
                {rec.suggestion && (
                  <div className="text-xs text-blue-500 mt-1">💡 {rec.suggestion}</div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default LearningInsightsPanel;
