import { ReactNode } from 'react'

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export default function Input({
  label,
  error,
  hint,
  className = '',
  id,
  ...props
}: InputProps) {
  const generatedId = id || `input-${Math.random().toString(36).slice(2, 9)}`

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={generatedId} className="text-[13px] font-medium text-text">
          {label}
        </label>
      )}
      <input
        id={generatedId}
        className={`rounded-[12px] border px-3 py-2 text-[14px] outline-none transition-colors duration-150 focus:border-brand focus:ring-2 focus:ring-brand/10 placeholder:text-text3 ${
          error ? 'border-weak bg-weak-bg' : 'border-border bg-surface'
        } ${className}`.trim()}
        {...props}
      />
      {error && (
        <span className="text-[12px] text-weak">{error}</span>
      )}
      {hint && !error && (
        <span className="text-[12px] text-text3">{hint}</span>
      )}
    </div>
  )
}
