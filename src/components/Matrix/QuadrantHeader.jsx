/**
 * כותרת רבע במטריצה
 */
function QuadrantHeader({ title, subtitle, icon, count, onAddTask }) {
  return (
    <div className="px-4 py-3 border-b border-inherit flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <span className="text-lg">{icon}</span>
        <div>
          <h3 className="font-bold text-gray-900 dark:text-white text-sm leading-tight">
            {title}
          </h3>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            {subtitle}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {/* מספר משימות */}
        <span className="bg-white/60 dark:bg-gray-900/40 w-7 h-7 rounded-full text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center justify-center">
          {count}
        </span>

        {/* כפתור הוספה */}
        <button
          onClick={onAddTask}
          className="w-7 h-7 rounded-full hover:bg-white/60 dark:hover:bg-gray-900/40 transition-colors text-gray-600 dark:text-gray-300 flex items-center justify-center"
          title="הוסף משימה"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default QuadrantHeader;

