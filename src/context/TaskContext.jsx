import { createContext, useState, useEffect, useCallback, useRef } from 'react';
import { 
  getTasks, 
  createTask, 
  createProjectTask,
  updateTask, 
  deleteTask, 
  moveTask, 
  toggleTaskComplete,
  updateTaskTimeSpent,
  supabase
} from '../services/supabase';
import { 
  createTaskWithIntervals, 
  completeInterval, 
  uncompleteInterval,
  getTaskIntervals,
  getIntervalProgress,
  hasIntervals
} from '../services/taskIntervals';
import { useAuth } from '../hooks/useAuth';

// יצירת קונטקסט
export const TaskContext = createContext(null);

// קונפיגורציה - אורך אינטרוול בדקות
const INTERVAL_DURATION = 45;

/**
 * ספק משימות
 */
export function TaskProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // סינון ומיון
  const [filter, setFilter] = useState('all'); // all, active, completed
  const [sortBy, setSortBy] = useState('created_at'); // created_at, due_date, title
  
  // מניעת race conditions
  const updatingTasksRef = useRef(new Map());
  const loadingRef = useRef(false);
  
  // ✅ חדש: גרסת הנתונים - מתעדכנת בכל שינוי
  const [dataVersion, setDataVersion] = useState(0);
  
  // ✅ חדש: זמן עדכון אחרון
  const [lastUpdated, setLastUpdated] = useState(Date.now());
  
  // טעינת משימות
  const loadTasks = useCallback(async () => {
    if (authLoading || !user?.id || loadingRef.current) {
      return;
    }
    
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    
    try {
      const data = await getTasks(user.id);
      const safeData = (data || []).map(task => ({
        ...task,
        time_spent: task.time_spent || 0,
        estimated_duration: task.estimated_duration || null
      }));
      setTasks(safeData);
    } catch (err) {
      console.error('שגיאה בטעינת משימות:', err);
      setError(err.message || 'שגיאה בטעינת משימות');
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [user?.id, authLoading]);

  // טעינה ראשונית
  useEffect(() => {
    if (!authLoading && user?.id) {
      loadTasks();
    }
  }, [user?.id, authLoading]);

  // 🆕 Realtime Subscription - סנכרון אוטומטי בין כל התצוגות
  useEffect(() => {
    if (!user?.id) return;

    console.log('📡 מתחבר ל-Realtime...');
    
    const channel = supabase
      .channel('tasks-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'tasks',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('📡 שינוי התקבל:', payload.eventType, payload.new?.title || payload.old?.id);
          
          // ✅ עדכון גרסת הנתונים - יגרום לכל הקומפוננטות לחשב מחדש
          setDataVersion(v => v + 1);
          setLastUpdated(Date.now());
          
          switch (payload.eventType) {
            case 'INSERT':
              setTasks(prev => {
                // בדיקה שהמשימה לא קיימת כבר
                if (prev.some(t => t.id === payload.new.id)) return prev;
                return [{ ...payload.new, time_spent: payload.new.time_spent || 0 }, ...prev];
              });
              break;
              
            case 'UPDATE':
              // 🔧 תיקון קריטי: שומרים על השדות הקיימים ורק מעדכנים מה שהשתנה
              setTasks(prev => prev.map(t => 
                t.id === payload.new.id 
                  ? { 
                      ...t,                    // שומרים על כל השדות הקיימים
                      ...payload.new,          // מעדכנים רק מה שהגיע מהשרת
                      time_spent: payload.new.time_spent ?? t.time_spent ?? 0
                    }
                  : t
              ));
              break;
              
            case 'DELETE':
              setTasks(prev => prev.filter(t => t.id !== payload.old.id));
              break;
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 סטטוס Realtime:', status);
      });

    return () => {
      console.log('📡 מתנתק מ-Realtime...');
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  /**
   * הוספת משימה עם פיצול אוטומטי לאינטרוולים של 45 דקות
   * =====================================================
   * 
   * אם המשימה ארוכה מ-45 דקות, היא מתפצלת אוטומטית למשימות-ילד.
   */
  const addTask = async (taskData) => {
    
    // 🔍 DEBUG: בדיקת נתונים נכנסים
    console.log('📥 addTask - נתונים שהתקבלו:', {
      estimated_duration: taskData.estimated_duration,
      estimatedDuration: taskData.estimatedDuration,
      fullData: taskData
    });
    
    if (authLoading) {
      throw new Error('⏳ ממתין לאימות משתמש...');
    }
    
    let userId = user?.id;
    
    if (!userId) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        userId = session.user.id;
      } else {
        throw new Error('❌ אין משתמש מחובר! אנא התחברי מחדש.');
      }
    }
    
    try {
      const duration = taskData.estimatedDuration || taskData.estimated_duration || 0;
      
      // 🔍 DEBUG: בדיקת duration
      console.log('📊 addTask - duration מחושב:', duration);
      
      const taskToCreate = {
        user_id: userId,
        title: taskData.title?.trim(),
        description: taskData.description?.trim() || null,
        quadrant: taskData.quadrant || 1,
        start_date: taskData.startDate || taskData.start_date || null,
        due_date: taskData.dueDate || taskData.due_date || null,
        due_time: taskData.dueTime || taskData.due_time || null,
        reminder_minutes: taskData.reminderMinutes || taskData.reminder_minutes ? parseInt(taskData.reminderMinutes || taskData.reminder_minutes) : null,
        estimated_duration: duration || null,
        task_type: taskData.taskType || taskData.task_type || 'other',
        task_parameter: taskData.taskParameter || taskData.task_parameter ? parseInt(taskData.taskParameter || taskData.task_parameter) : null,
        priority: taskData.priority || 'normal',
        category: taskData.category || 'work'
      };
      
      if (!taskToCreate.title || taskToCreate.title.length === 0) {
        throw new Error('❌ חסרה כותרת משימה!');
      }
      
      // אם המשימה ארוכה מ-45 דקות - פיצול אוטומטי
      if (duration > INTERVAL_DURATION) {
        
        const { parentTask, intervals } = await createTaskWithIntervals(taskToCreate);
        
        
        // טעינה מחדש
        await loadTasks();
        return parentTask;
      }
      
      // משימה קצרה - יצירה רגילה
      const newTask = await createTask(taskToCreate);
      
      if (!newTask || !newTask.id) {
        throw new Error('❌ המשימה לא נוצרה');
      }
      
      await loadTasks();
      return newTask;
      
    } catch (err) {
      console.error('❌ שגיאה בהוספת משימה:', err);
      
      let errorMessage = err.message || 'שגיאה בהוספת משימה';
      if (err.code === '42501') {
        errorMessage = '❌ אין הרשאות לשמירה. אנא התחברי מחדש.';
      } else if (err.code === 'PGRST301' || err.message?.includes('JWT')) {
        errorMessage = '❌ סשן פג. אנא התחברי מחדש.';
      }
      
      throw new Error(errorMessage);
    }
  };

  // הוספת פרויקט עם שלבים
  const addProjectTask = async (projectData) => {
    try {
      const newProject = await createProjectTask({
        user_id: user.id,
        title: projectData.title,
        description: projectData.description || null,
        quadrant: projectData.quadrant,
        dueDate: projectData.dueDate || null,
        dueTime: projectData.dueTime || null,
        reminderMinutes: projectData.reminderMinutes || null,
        totalDuration: projectData.totalDuration || null,
        subtasks: projectData.subtasks || []
      });
      
      await loadTasks();
      return newProject;
    } catch (err) {
      console.error('שגיאה ביצירת פרויקט:', err);
      throw new Error('שגיאה ביצירת פרויקט');
    }
  };

  // עדכון משימה
  // תמיכה גם ב-snake_case וגם ב-camelCase לשמות משתנים
  const editTask = async (taskId, updates) => {
    try {
      // חישוב ערכים עם תמיכה בשני הפורמטים
      const startDate = updates.startDate ?? updates.start_date ?? null;
      const dueDate = updates.dueDate ?? updates.due_date ?? null;
      const dueTime = updates.dueTime ?? updates.due_time ?? null;
      const estimatedDuration = updates.estimatedDuration ?? updates.estimated_duration ?? null;
      const reminderMinutes = updates.reminderMinutes ?? updates.reminder_minutes ?? null;
      const taskType = updates.taskType ?? updates.task_type ?? null;
      const taskParameter = updates.taskParameter ?? updates.task_parameter ?? null;
      
      // 🔧 העברת כל השדות - לא רק חלק
      const updatePayload = {
        ...updates, // כל השדות המקוריים
        title: updates.title,
        description: updates.description || null,
        estimated_duration: estimatedDuration ? parseInt(estimatedDuration) : null,
        quadrant: updates.quadrant,
        start_date: startDate,
        due_date: dueDate,
        due_time: dueTime,
        reminder_minutes: reminderMinutes ? parseInt(reminderMinutes) : null,
        task_type: taskType,
        task_parameter: taskParameter ? parseInt(taskParameter) : null,
        priority: updates.priority || 'normal'
      };
      
      // הסרת שדות undefined
      Object.keys(updatePayload).forEach(key => {
        if (updatePayload[key] === undefined) {
          delete updatePayload[key];
        }
      });
      
      const updatedTask = await updateTask(taskId, updatePayload);
      
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updatedTask } : t));
      
      // 🔧 תיקון: עדכון dataVersion כדי לסנכרן מסכים אחרים
      setDataVersion(v => v + 1);
      
      return updatedTask;
    } catch (err) {
      console.error('שגיאה בעדכון משימה:', err);
      throw new Error('שגיאה בעדכון משימה');
    }
  };

  // מחיקת משימה
  const removeTask = async (taskId) => {
    try {
      // אם זו משימה הורית - מוחקים גם את הילדים
      const task = tasks.find(t => t.id === taskId);
      if (task && hasIntervals(task)) {
        // מחיקת כל הילדים קודם
        const children = tasks.filter(t => t.parent_task_id === taskId);
        for (const child of children) {
          await deleteTask(child.id);
        }
      }
      
      await deleteTask(taskId);
      setTasks(prev => prev.filter(t => t.id !== taskId && t.parent_task_id !== taskId));
    } catch (err) {
      console.error('שגיאה במחיקת משימה:', err);
      throw new Error('שגיאה במחיקת משימה');
    }
  };

  // העברת משימה לרבע אחר
  const changeQuadrant = async (taskId, newQuadrant) => {
    try {
      const updatedTask = await moveTask(taskId, newQuadrant);
      // 🔧 תיקון: שומרים על השדות הקיימים
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updatedTask } : t));
      return updatedTask;
    } catch (err) {
      console.error('שגיאה בהעברת משימה:', err);
      throw new Error('שגיאה בהעברת משימה');
    }
  };

  // עדכון זמן שבוצע למשימה
  const updateTaskTime = useCallback(async (taskId, timeSpent) => {
    const timeSpentInt = parseInt(timeSpent) || 0;
    
    try {
      const updatedTask = await updateTaskTimeSpent(taskId, timeSpentInt);
      
      setTasks(prev => prev.map(t => 
        t.id === taskId ? { ...t, time_spent: timeSpentInt } : t
      ));
      
      // 🔧 תיקון: עדכון dataVersion כדי לסנכרן מסכים אחרים
      setDataVersion(v => v + 1);
      
      return updatedTask || { id: taskId, time_spent: timeSpentInt };
    } catch (err) {
      console.error('❌ שגיאה בעדכון זמן:', err);
      setTasks(prev => prev.map(t => 
        t.id === taskId ? { ...t, time_spent: timeSpentInt } : t
      ));
      throw err;
    }
  }, []);

  /**
   * סימון כהושלם/לא הושלם
   * ======================
   * 
   * אם זה אינטרוול (יש parent_task_id):
   * - מסמנים רק אותו
   * - אם כל האחים הושלמו - מסמנים גם את ההורה
   * 
   * אם זו משימה רגילה או הורית:
   * - מסמנים אותה ישירות
   */
  const toggleComplete = async (taskId) => {
    
    const task = tasks.find(t => t.id === taskId);
    if (!task) {
      console.error('❌ לא נמצאה משימה:', taskId);
      return;
    }

    try {
      const newCompleteStatus = !task.is_completed;
      
      // בדיקה אם זה אינטרוול (משימה עם הורה)
      if (task.parent_task_id) {
        
        if (newCompleteStatus) {
          // מסמנים כהושלם
          const { interval, parentCompleted, parentId } = await completeInterval(taskId);
          
          // עדכון ה-state
          setTasks(prev => {
            let updated = prev.map(t => t.id === taskId ? { ...t, is_completed: true, completed_at: new Date().toISOString() } : t);
            
            // אם ההורה הושלם - מעדכנים גם אותו
            if (parentCompleted && parentId) {
              updated = updated.map(t => 
                t.id === parentId 
                  ? { ...t, is_completed: true, completed_at: new Date().toISOString() }
                  : t
              );
            }
            
            return updated;
          });
          
          if (parentCompleted) {
          }
          
          return interval;
        } else {
          // מבטלים השלמה
          const { interval, parentUncompleted } = await uncompleteInterval(taskId);
          
          setTasks(prev => {
            let updated = prev.map(t => t.id === taskId ? { ...t, is_completed: false, completed_at: null } : t);
            
            // אם ההורה בוטל
            if (parentUncompleted) {
              updated = updated.map(t => 
                t.id === task.parent_task_id 
                  ? { ...t, is_completed: false, completed_at: null }
                  : t
              );
            }
            
            return updated;
          });
          
          return interval;
        }
      }
      
      // משימה רגילה (לא אינטרוול)
      const updatedTask = await toggleTaskComplete(taskId, newCompleteStatus);
      
      // 🔧 תיקון: שומרים על השדות הקיימים
      setTasks(prev => {
        const updated = prev.map(t => t.id === taskId ? { ...t, ...updatedTask } : t);
        return updated;
      });
      
      return updatedTask;
      
    } catch (err) {
      console.error('❌ שגיאה בעדכון סטטוס:', err);
      throw new Error('שגיאה בעדכון סטטוס');
    }
  };

  /**
   * קבלת התקדמות אינטרוולים למשימה
   */
  const getTaskProgress = async (taskId) => {
    return await getIntervalProgress(taskId);
  };

  /**
   * קבלת אינטרוולים של משימה
   */
  const getIntervals = (parentTaskId) => {
    return tasks.filter(t => t.parent_task_id === parentTaskId);
  };

  /**
   * בדיקה אם משימה היא אינטרוול
   */
  const isTaskInterval = (task) => {
    return !!task?.parent_task_id;
  };

  /**
   * בדיקה אם למשימה יש אינטרוולים
   */
  const taskHasIntervals = (task) => {
    return hasIntervals(task) || tasks.some(t => t.parent_task_id === task.id);
  };

  // קבלת משימות לפי רבע (ללא משימות שהושלמו)
  // מציג רק אינטרוולים, לא את ההורה
  const getTasksByQuadrant = (quadrant) => {
    return tasks
      .filter(t => {
        // רק משימות מהרבע הנכון
        if (t.quadrant !== quadrant) return false;
        // רק משימות לא הושלמו
        if (t.is_completed) return false;
        // לא להציג משימות הורה אם יש להן ילדים (האינטרוולים יוצגו במקומן)
        if (t.is_project && tasks.some(child => child.parent_task_id === t.id)) {
          return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  };

  // קבלת משימות מסוננות וממוינות
  const getFilteredTasks = () => {
    let filtered = [...tasks];

    // סינון
    switch (filter) {
      case 'active':
        filtered = filtered.filter(t => !t.is_completed);
        break;
      case 'completed':
        filtered = filtered.filter(t => t.is_completed);
        break;
      default:
        break;
    }

    // מיון
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return a.title.localeCompare(b.title, 'he');
        case 'due_date':
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return new Date(a.due_date) - new Date(b.due_date);
        case 'created_at':
        default:
          return new Date(b.created_at) - new Date(a.created_at);
      }
    });

    return filtered;
  };

  // קבלת משימות שהושלמו
  const getCompletedTasks = () => {
    return tasks
      .filter(t => t.is_completed)
      .sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at));
  };

  // קבלת סטטיסטיקות
  const getStats = () => {
    const activeTasks = tasks.filter(t => !t.is_completed);
    const completedTasks = tasks.filter(t => t.is_completed);
    
    return {
      total: tasks.length,
      active: activeTasks.length,
      completed: completedTasks.length,
      byQuadrant: {
        1: tasks.filter(t => t.quadrant === 1 && !t.is_completed).length,
        2: tasks.filter(t => t.quadrant === 2 && !t.is_completed).length,
        3: tasks.filter(t => t.quadrant === 3 && !t.is_completed).length,
        4: tasks.filter(t => t.quadrant === 4 && !t.is_completed).length
      }
    };
  };

  // ✅ פונקציית רענון כפוי - לשימוש כשצריך לוודא סנכרון
  const forceRefresh = useCallback(() => {
    setDataVersion(v => v + 1);
    setLastUpdated(Date.now());
    loadTasks();
  }, [loadTasks]);

  const value = {
    tasks,
    loading,
    error,
    filter,
    sortBy,
    setFilter,
    setSortBy,
    loadTasks,
    addTask,
    addProjectTask,
    editTask,
    removeTask,
    changeQuadrant,
    updateTaskTime,
    toggleComplete,
    getTasksByQuadrant,
    getCompletedTasks,
    getFilteredTasks,
    getStats,
    // פונקציות חדשות לאינטרוולים
    getTaskProgress,
    getIntervals,
    isTaskInterval,
    taskHasIntervals,
    INTERVAL_DURATION,
    // ✅ חדש: גרסת נתונים וסנכרון
    dataVersion,
    lastUpdated,
    forceRefresh
  };

  return (
    <TaskContext.Provider value={value}>
      {children}
    </TaskContext.Provider>
  );
}

export default TaskContext;
