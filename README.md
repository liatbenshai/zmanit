# 🧠 מודול ADHD - מדריך התקנה מהירה

## מה בפנים?

**7 פיצ'רים** שנבנו במיוחד בשבילך:

| פיצ'ר | מה עושה | איך עוזר |
|-------|---------|----------|
| **SingleTaskView** | מציג רק משימה אחת | מפחית עומס והצפה |
| **TaskCompletionFeedback** | שואל "איך הלך?" בסיום | לומד להעריך זמן נכון |
| **PanicButton** | כפתור "אני אבודה" | עוזר ברגעי משבר |
| **GamificationSystem** | נקודות, סטריקים, הישגים | מוטיבציה ודופמין |
| **DailyRituals** | ריטואל בוקר וערב | בונה הרגלים יומיים |
| **WeeklyPlanningWizard** | 📅 אשף תכנון שבועי | שיבוץ אינטראקטיבי |
| **energySettings** | הגדרות שעות אנרגיה | תמלול בבוקר, הגהה אחה"צ |

---

## 🔧 תיקון חשוב: שעות אנרגיה

המערכת עכשיו יודעת:
- **תמלול: 08:30-14:00** (שעות ריכוז גבוה)
- **הגהה: 14:00-16:15** (אחרי שסיימת תמלולים)
- **מיילים: סוף היום** (לא דורשים ריכוז)

### ⚙️ תיקון smartScheduler (חובה!)

פתחי את `src/utils/smartScheduler.js` והחליפי את הקונפיג (שורות 36-65) בזה:

```javascript
export const SMART_SCHEDULE_CONFIG = {
  dayStart: 8 * 60 + 30,         // 08:30
  dayEnd: 16 * 60 + 15,          // 16:15
  
  // ✅ תמלול עד 14:00
  morningStart: 8 * 60 + 30,     // 08:30
  morningEnd: 14 * 60,           // 14:00
  
  // ✅ הגהה מ-14:00
  afternoonStart: 14 * 60,       // 14:00
  afternoonEnd: 16 * 60 + 15,    // 16:15
  
  blockDuration: 45,
  breakDuration: 5,
  
  // ✅ משימות בוקר
  morningTaskTypes: ['transcription', 'תמלול', 'translation', 'תרגום'],
  
  // ✅ משימות אחה"צ
  afternoonTaskTypes: ['proofreading', 'הגהה', 'email', 'admin', 'client_communication'],
  
  get workMinutesPerDay() { return this.dayEnd - this.dayStart; },
  get maxBlocksPerDay() { return Math.floor(this.workMinutesPerDay / (this.blockDuration + this.breakDuration)); }
};
```

---

## 🚀 התקנה מהירה (3 שלבים)

### שלב 1: העתקת הקבצים

העתיקי את תיקיית `ADHD` לתוך:
```
src/components/ADHD/
```

העתיקי את `energySettings.js` לתוך:
```
src/utils/energySettings.js
```

### שלב 2: עטיפת האפליקציה ב-GamificationProvider

פתחי את `src/App.jsx` והוסיפי:

```jsx
// בתחילת הקובץ, הוסיפי:
import { GamificationProvider } from './components/ADHD';

// עטפי את כל האפליקציה:
function App() {
  return (
    <GamificationProvider>
      {/* כל מה שהיה קודם */}
    </GamificationProvider>
  );
}
```

### שלב 3: הוספת הקומפוננטות לדשבורד

פתחי את `src/components/Dashboard/SmartDashboard.jsx` (או הדשבורד הראשי שלך):

```jsx
// בתחילת הקובץ:
import { 
  SingleTaskView,
  TaskCompletionFeedback,
  PanicButton,
  PointsBadge,
  MorningRitual,
  EveningRitual,
  useRitualCheck,
  useGamification,
  WeeklyPlanningWizard  // 🆕 אשף תכנון
} from '../ADHD';

// בתוך הקומפוננטה:
function SmartDashboard() {
  const [viewMode, setViewMode] = useState('single'); // 'single' או 'full'
  const [showFeedback, setShowFeedback] = useState(null);
  const [showPlanningWizard, setShowPlanningWizard] = useState(false);  // 🆕
  const { showMorning, showEvening, closeMorning, closeEvening } = useRitualCheck();
  const { addPoints, recordTaskCompletion } = useGamification();

  // ... שאר הקוד

  return (
    <div>
      {/* סרגל עליון עם נקודות */}
      <div className="flex justify-between items-center mb-4">
        <h1>דשבורד</h1>
        <div className="flex items-center gap-4">
          <PointsBadge />
          <PanicButton 
            tasks={tasks}
            onStartTask={handleStartTask}
            onTakeBreak={(mins) => console.log(`הפסקה של ${mins} דקות`)}
          />
        </div>
      </div>

      {/* מעבר בין תצוגות */}
      <div className="flex gap-2 mb-4">
        <button 
          onClick={() => setViewMode('single')}
          className={viewMode === 'single' ? 'bg-blue-500 text-white' : 'bg-gray-200'}
        >
          🎯 משימה אחת
        </button>
        <button 
          onClick={() => setViewMode('full')}
          className={viewMode === 'full' ? 'bg-blue-500 text-white' : 'bg-gray-200'}
        >
          📋 תצוגה מלאה
        </button>
      </div>

      {/* תצוגה לפי מצב */}
      {viewMode === 'single' ? (
        <SingleTaskView
          tasks={tasks}
          onStartTask={handleStartTask}
          onCompleteTask={(task) => {
            handleCompleteTask(task);
            setShowFeedback(task);
          }}
          onSwitchView={() => setViewMode('full')}
          activeTimerTaskId={activeTimerId}
        />
      ) : (
        /* התצוגה המלאה שלך */
      )}

      {/* ריטואל בוקר */}
      {showMorning && (
        <MorningRitual
          tasks={tasks}
          onClose={closeMorning}
          onSelectPriority={(task) => console.log('משימה חשובה:', task)}
          addPoints={addPoints}
        />
      )}

      {/* ריטואל ערב */}
      {showEvening && (
        <EveningRitual
          tasks={tasks}
          onClose={closeEvening}
          onMoveTasks={handleMoveTasks}
          addPoints={addPoints}
        />
      )}

      {/* משוב בסיום משימה */}
      {showFeedback && (
        <TaskCompletionFeedback
          task={showFeedback}
          actualMinutes={getActualMinutes(showFeedback.id)}
          onClose={() => setShowFeedback(null)}
          onSave={(data) => {
            recordTaskCompletion({ accurate: data.isAccurate });
          }}
          addPoints={addPoints}
        />
      )}
    </div>
  );
}
```

---

## 🎮 איך להשתמש בכל פיצ'ר

### 1️⃣ תצוגת משימה אחת (SingleTaskView)

**מתי להשתמש:** כברירת מחדל! זו התצוגה המומלצת ל-ADHD.

**מה קורה:**
- מציג רק את המשימה הבאה
- כפתור גדול "להתחיל עכשיו"
- הודעות עידוד
- אפשרות לעבור לתצוגה מלאה

### 2️⃣ משוב "איך הלך?" (TaskCompletionFeedback)

**מתי להציג:** בסיום כל משימה שהטיימר רץ עליה.

**מה לומד:**
- האם ההערכה הייתה נכונה
- למה לקח יותר/פחות זמן
- מציע הערכה משופרת לפעם הבאה

### 3️⃣ כפתור "אני אבודה" (PanicButton)

**איפה לשים:** בסרגל העליון, תמיד נגיש.

**מה עושה:**
- שואל מה הבעיה
- מציע פתרון מותאם:
  - עומס → המשימה הכי קלה
  - תקועה → כלל 5 דקות
  - בלת"ם → המשימה הכי דחופה
  - מותשת → הפסקה
  - מתפזרת → מצב התמקדות

### 4️⃣ גיימיפיקציה (GamificationSystem)

**נקודות אוטומטיות על:**
- השלמת משימה: 10 נקודות
- השלמה בזמן: 15 נקודות
- השלמה מוקדמת: 20 נקודות
- הערכת זמן מדויקת: 10 נקודות
- ריטואל בוקר/ערב: 5 נקודות

**הישגים:** נפתחים אוטומטית לפי הביצועים

**איפה להציג:**
- `<PointsBadge />` - תצוגה קטנה (רמה, נקודות, סטריק)
- `<ProgressDashboard />` - תצוגה מלאה עם כל ההישגים

### 5️⃣ ריטואלים יומיים (DailyRituals)

**מתי מופיעים:**
- בוקר: 08:00-08:30 (ניתן לשנות)
- ערב: 16:00-16:30 (ניתן לשנות)

**לא מופיעים בשישי-שבת**

**להפעלה ידנית:**
```jsx
const { openMorning, openEvening } = useRitualCheck();
<button onClick={openMorning}>📅 תכנון בוקר</button>
<button onClick={openEvening}>🌅 סיכום יום</button>
```

---

## ⚙️ התאמה אישית

### שינוי שעות הריטואלים:
```jsx
const { showMorning, showEvening } = useRitualCheck(8.5, 16); // 08:30 בוקר, 16:00 ערב
```

### שינוי נקודות:
ערכי את `POINT_VALUES` בקובץ `GamificationSystem.jsx`

### הוספת הישגים:
הוסיפי ל-`ACHIEVEMENTS` בקובץ `GamificationSystem.jsx`

---

## 📅 אשף תכנון שבועי (WeeklyPlanningWizard)

זה הפיצ'ר החדש שביקשת! מאפשר להכניס את כל המשימות לשבוע והמערכת משבצת בהתייעצות איתך.

### איך זה עובד:

**שלב 1: הכנסת משימות**
- מכניסה את כל המשימות לשבוע
- בוחרת סוג, משך, לקוח, דדליין

**שלב 2: הצעת שיבוץ**
- המערכת משבצת לפי שעות האנרגיה שלך
- תמלול: 08:30-14:00
- הגהה: 14:00-16:15
- מציגה כל הצעה עם ✓ לאישור

**שלב 3: אישור ושינויים**
- את יכולה לשנות יום/שעה לכל משימה
- לבטל הצעות שלא מתאימות
- לאשר ולשמור

### הוספה לדשבורד:
```jsx
import { WeeklyPlanningWizard } from '../ADHD';

// בתוך הקומפוננטה:
const [showWizard, setShowWizard] = useState(false);

// כפתור לפתיחה:
<button onClick={() => setShowWizard(true)}>
  📅 תכנון השבוע
</button>

// הקומפוננטה:
{showWizard && (
  <WeeklyPlanningWizard
    existingTasks={tasks}
    onSave={(newTasks) => {
      // שמירת המשימות החדשות
      handleSaveTasks(newTasks);
    }}
    onClose={() => setShowWizard(false)}
  />
)}
```

---

## 🐛 פתרון בעיות

**הקומפוננטות לא נטענות:**
- וודאי שהתיקייה `ADHD` בתוך `src/components/`
- וודאי שה-imports נכונים

**הגיימיפיקציה לא עובדת:**
- וודאי שעטפת ב-`<GamificationProvider>`
- וודאי שאת משתמשת ב-`useGamification()` בתוך הפרובידר

**הריטואלים לא מופיעים:**
- בדקי את השעה (רק בטווח הזמנים הנכון)
- בדקי שזה לא שישי/שבת
- בדקי שלא סימנת "הושלם" ב-localStorage

---

## 💡 טיפים לשימוש

1. **התחילי עם תצוגת משימה אחת** - זו הדרך הטובה ביותר להתמודד עם עומס

2. **תמיד תעני על "איך הלך?"** - ככה המערכת תלמד את הקצב שלך

3. **השתמשי בכפתור "אני אבודה"** - אל תתביישי, הוא שם בשבילך

4. **תשימי לב לסטריק** - נסי לשמור עליו, זה יעזור לבנות הרגל

5. **עשי את הריטואלים** - 2 דקות בבוקר וערב משנות את כל היום

---

בהצלחה! את יכולה לעשות את זה! 💪🌟
