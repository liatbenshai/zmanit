import { useState } from 'react';
import { useExport } from '../../hooks/useExport';
import { QUADRANT_NAMES } from '../../utils/taskHelpers';
import { getTodayISO } from '../../utils/dateTimeHelpers';
import Modal from '../UI/Modal';
import Button from '../UI/Button';

/**
 * מודל ייצוא נתונים
 */
function ExportModal({ isOpen, onClose }) {
  const { exporting, exportPDF, exportExcel, exportCSV } = useExport();
  
  const [options, setOptions] = useState({
    format: 'pdf',
    quadrant: '', // ריק = כל הרבעים
    status: 'all',
    fromDate: '',
    toDate: '',
    separateSheets: false // רק ל-Excel
  });

  // שינוי אפשרות
  const handleChange = (key, value) => {
    setOptions(prev => ({ ...prev, [key]: value }));
  };

  // ייצוא
  const handleExport = async () => {
    const exportOptions = {
      ...options,
      quadrant: options.quadrant ? parseInt(options.quadrant) : null
    };

    try {
      switch (options.format) {
        case 'pdf':
          await exportPDF(exportOptions);
          break;
        case 'excel':
          await exportExcel(exportOptions);
          break;
        case 'csv':
          await exportCSV(exportOptions);
          break;
      }
      onClose();
    } catch (err) {
      console.error('שגיאה בייצוא:', err);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="ייצוא משימות" size="md">
      <div className="space-y-5">
        {/* פורמט */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            פורמט קובץ
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: 'pdf', label: 'PDF', icon: '📄' },
              { value: 'excel', label: 'Excel', icon: '📊' },
              { value: 'csv', label: 'CSV', icon: '📝' }
            ].map(fmt => (
              <button
                key={fmt.value}
                onClick={() => handleChange('format', fmt.value)}
                className={`
                  flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all
                  ${options.format === fmt.value
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  }
                `}
              >
                <span className="text-2xl">{fmt.icon}</span>
                <span className="text-sm font-medium">{fmt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* רבע */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            רבע במטריצה
          </label>
          <select
            value={options.quadrant}
            onChange={(e) => handleChange('quadrant', e.target.value)}
            className="input-field"
          >
            <option value="">כל הרבעים</option>
            {[1, 2, 3, 4].map(q => (
              <option key={q} value={q}>{QUADRANT_NAMES[q]}</option>
            ))}
          </select>
        </div>

        {/* סטטוס */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            סטטוס משימות
          </label>
          <select
            value={options.status}
            onChange={(e) => handleChange('status', e.target.value)}
            className="input-field"
          >
            <option value="all">הכל</option>
            <option value="active">פעילות בלבד</option>
            <option value="completed">הושלמו בלבד</option>
          </select>
        </div>

        {/* טווח תאריכים */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              מתאריך
            </label>
            <input
              type="date"
              value={options.fromDate}
              onChange={(e) => handleChange('fromDate', e.target.value)}
              max={options.toDate || getTodayISO()}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              עד תאריך
            </label>
            <input
              type="date"
              value={options.toDate}
              onChange={(e) => handleChange('toDate', e.target.value)}
              min={options.fromDate}
              className="input-field"
            />
          </div>
        </div>

        {/* אפשרויות Excel */}
        {options.format === 'excel' && (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="separateSheets"
              checked={options.separateSheets}
              onChange={(e) => handleChange('separateSheets', e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label 
              htmlFor="separateSheets"
              className="text-sm text-gray-700 dark:text-gray-300"
            >
              גיליון נפרד לכל רבע
            </label>
          </div>
        )}

        {/* כפתורים */}
        <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button onClick={handleExport} loading={exporting} fullWidth>
            📥 ייצא לקובץ
          </Button>
          <Button variant="secondary" onClick={onClose}>
            ביטול
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default ExportModal;

