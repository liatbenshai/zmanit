# שיפורי זמנית - הוראות התקנה
## 📦 קבצים חדשים

### 1. מערכת למידה
```
src/utils/taskLearning.js
```
מעקב אוטומטי אחר הערכה מול ביצוע בפועל.

### 2. מודל משוב בסיום משימה
```
src/components/TaskCompletion/CompletionFeedbackModal.jsx
```
קופץ כשמשימה מסתיימת - מאפשר לאשר או לתקן את הזמן.

### 3. הצעת הערכה חכמה
```
src/components/TaskForm/EstimateSuggestion.jsx
```
מציג הערכה מותאמת בטופס משימה חדשה.

### 4. מערכת גרירה
```
src/utils/taskReorder.js
src/components/DailyView/DraggableTaskList.jsx
```
גרירה לשינוי סדר משימות.

### 5. מערכת בלת"מים
```
src/components/Interruption/InterruptionModal.jsx
```
ניהול הפרעות והעברת משימות למחר.

---

## 🔧 שילוב בקוד הקיים

### שלב 1: מודל משוב בסיום משימה

ב-`DailyTaskCard.jsx`, הוסיפי:

```jsx
import CompletionFeedbackModal from '../TaskCompletion/CompletionFeedbackModal';

// בתוך הקומפוננטה:
const [showFeedback, setShowFeedback] = useState(false);

// כשמסיימים משימה (בפונקציית toggleComplete או handleComplete):
const handleComplete = async () => {
  await toggleComplete(task.id);
  // הצג מודל משוב אם יש הערכה
  if (task.estimated_duration && task.time_spent) {
    setShowFeedback(true);
  }
};

// בסוף הקומפוננטה, לפני ה-return האחרון:
<CompletionFeedbackModal
  isOpen={showFeedback}
  onClose={() => setShowFeedback(false)}
  task={task}
  actualMinutes={task.time_spent || 0}
/>
```

### שלב 2: הצעת הערכה בטופס

ב-`SimpleTaskForm.jsx`, הוסיפי:

```jsx
import EstimateSuggestion from '../TaskForm/EstimateSuggestion';

// אחרי שדה הזמן המוערך:
<EstimateSuggestion
  taskType={taskType}
  currentEstimate={estimatedDuration}
  onAcceptSuggestion={(suggested) => setEstimatedDuration(suggested)}
/>
```

### שלב 3: גרירה לשינוי סדר

ב-`DailyView.jsx`, החליפי את הלולאה של המשימות:

```jsx
import DraggableTaskList from './DraggableTaskList';

// במקום:
{upcomingBlocks.map((block, index) => (
  <DailyTaskCard ... />
))}

// שימי:
<DraggableTaskList
  blocks={upcomingBlocks}
  date={getDateISO(selectedDate)}
  renderTask={(block, index) => (
    <DailyTaskCard 
      key={block.id || `block-${index}`} 
      task={{...}}
      onEdit={() => handleEditTask(block)}
      onUpdate={loadTasks}
      showTime={true}
    />
  )}
  onReorder={(newOrder) => {
    console.log('סדר חדש:', newOrder);
  }}
/>
```

### שלב 4: מערכת בלת"מים

ב-`DailyView.jsx`, הוסיפי:

```jsx
import InterruptionModal from '../Interruption/InterruptionModal';

// state:
const [showInterruption, setShowInterruption] = useState(false);

// הוסיפי כפתור בלת"ם באזור הטיימר או בראש העמוד:
<button
  onClick={() => setShowInterruption(true)}
  className="px-4 py-2 bg-orange-500 text-white rounded-lg"
>
  ⚡ בלת"ם
</button>

// המודל:
<InterruptionModal
  isOpen={showInterruption}
  onClose={() => setShowInterruption(false)}
  currentTask={activeTask}
  remainingBlocks={upcomingBlocks}
  currentMinutes={currentTime.minutes}
  onApplyInterruption={async (result) => {
    console.log('בלת"ם:', result);
    // כאן תוסיפי את הלוגיקה:
    // 1. עצירת הטיימר
    // 2. עדכון due_date למשימות שצריך להעביר
    // 3. רענון
    if (result.tasksToMove.length > 0) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowISO = tomorrow.toISOString().split('T')[0];
      
      for (const task of result.tasksToMove) {
        await editTask(task.taskId || task.id, {
          due_date: tomorrowISO
        });
      }
    }
    loadTasks();
  }}
/>
```

---

## 📊 דף סטטיסטיקות למידה (אופציונלי)

אם רוצים להציג סטטיסטיקות למידה, הוסיפי לדף הגדרות או דשבורד:

```jsx
import { LearningStatsPanel } from '../components/TaskForm/EstimateSuggestion';

// בתוך הקומפוננטה:
<LearningStatsPanel />
```

---

## 🔄 מה צריך להתאים

1. **ודאי שיש `framer-motion`** מותקן (לאנימציות)
2. **בדקי שהנתיבים נכונים** - התאימי את ה-imports לפי מבנה התיקיות שלך
3. **התאימי את שמות הפונקציות** - אם יש לך שמות אחרים ל-editTask, loadTasks וכו'

---

## 🧪 בדיקה

1. צרי משימה חדשה עם זמן מוערך
2. התחילי לעבוד עליה עם הטיימר
3. סיימי אותה - המודל אמור לקפוץ
4. אשרי או תקני את הזמן
5. צרי משימה חדשה מאותו סוג - ההמלצה אמורה להופיע

---

## 📝 הערות

- נתוני הלמידה נשמרים ב-localStorage (לא בדאטהבייס)
- אם רוצים לשמור בדאטהבייס, צריך ליצור טבלה חדשה ב-Supabase
- סדר הגרירה נשמר גם ב-localStorage
