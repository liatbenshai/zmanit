import { forwardRef } from 'react';

/**
 * שדה קלט כללי
 */
const Input = forwardRef(({
  label,
  type = 'text',
  name,
  value,
  onChange,
  onBlur,
  placeholder,
  error,
  disabled = false,
  required = false,
  autoComplete,
  className = '',
  ...props
}, ref) => {
  const inputId = name || `input-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className={className}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
        >
          {label}
          {required && <span className="text-red-500 mr-1">*</span>}
        </label>
      )}

      <input
        ref={ref}
        id={inputId}
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        autoComplete={autoComplete}
        className={`
          input-field
          ${error ? 'border-red-400 focus:ring-red-500 focus:border-red-500 bg-red-50/50 dark:bg-red-900/10' : ''}
          ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-50 dark:bg-gray-800/50' : ''}
        `}
        {...props}
      />

      {error && (
        <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
          <span>⚠</span> {error}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;

