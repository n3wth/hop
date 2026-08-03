import React from 'react'
import Icon from '../Icon'

export interface FieldProps {
  label?: string
  id?: string
  hint?: string
  error?: string
  children: React.ReactNode
  className?: string
}

export function Field({
  label,
  id,
  hint,
  error,
  children,
  className = '',
}: FieldProps) {
  const generatedId = React.useId()
  const inputId = id || generatedId

  // Wire id to child if it's a valid element and doesn't have its own id
  let wiredChildren = children
  if (React.isValidElement(children)) {
    const childProps = children.props as Record<string, unknown>
    wiredChildren = React.cloneElement(children, {
      id: childProps.id || inputId,
      'aria-invalid': error ? true : childProps['aria-invalid'],
    } as Record<string, unknown>)
  }

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="text-[12.5px] font-semibold tracking-[var(--track-label)] text-text2"
        >
          {label}
        </label>
      )}
      {wiredChildren}
      {error ? (
        <p role="alert" className="text-[12.5px] font-medium text-weak">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[12.5px] font-medium text-text3">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', invalid = false, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`w-full rounded-[11px] border-[1.5px] bg-paper px-3 py-[10px] text-[14.5px] text-text outline-none transition-colors placeholder:text-text3 focus:border-brand no-inner-ring ${
          invalid ? 'border-weak' : 'border-border'
        } ${className}`}
        {...props}
      />
    )
  }
)
Input.displayName = 'Input'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = '', invalid = false, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={`w-full rounded-[11px] border-[1.5px] bg-paper px-3 py-[10px] text-[14.5px] text-text outline-none transition-colors placeholder:text-text3 focus:border-brand no-inner-ring ${
          invalid ? 'border-weak' : 'border-border'
        } ${className}`}
        {...props}
      />
    )
  }
)
Textarea.displayName = 'Textarea'

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean
  options?: Array<[string, string]> | Array<{ value: string; label: string }>
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = '', invalid = false, options = [], children, ...props }, ref) => {
    return (
      <div className="relative w-full">
        <select
          ref={ref}
          className={`w-full cursor-pointer appearance-none rounded-[11px] border-[1.5px] bg-paper px-3 py-[10px] pr-9 text-[14.5px] text-text outline-none transition-colors focus:border-brand no-inner-ring ${
            invalid ? 'border-weak' : 'border-border'
          } ${className}`}
          {...props}
        >
          {children}
          {options.map((opt) => {
            const [v, label] = Array.isArray(opt) ? opt : [opt.value, opt.label]
            return (
              <option key={v} value={v}>
                {label}
              </option>
            )
          })}
        </select>
        <Icon
          name="expand_more"
          size={16}
          className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-text3"
        />
      </div>
    )
  }
)
Select.displayName = 'Select'
