import React, { useId, forwardRef } from 'react'
import Icon from '@/components/Icon'

export interface FieldProps {
  label: string
  error?: string
  hint?: string
  id?: string
  required?: boolean
  className?: string
  children?: React.ReactNode
}

export function Field({
  label,
  error,
  hint,
  id,
  required,
  className,
  children,
}: FieldProps) {
  const generatedId = useId()
  const controlId = id || generatedId
  const errorId = `${controlId}-error`
  const hintId = `${controlId}-hint`

  let ariaDescribedBy = ''
  if (error) ariaDescribedBy += `${errorId} `
  if (hint) ariaDescribedBy += `${hintId} `
  ariaDescribedBy = ariaDescribedBy.trim()

  const wiredChildren = React.Children.map(children, (child) => {
    if (React.isValidElement(child)) {
      const childProps: Record<string, unknown> = { id: controlId }
      if (ariaDescribedBy) {
        childProps['aria-describedby'] = ariaDescribedBy
      }
      if (error) {
        childProps.invalid = true
      }
      return React.cloneElement(child, childProps)
    }
    return child
  })

  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ''}`}>
      <label htmlFor={controlId} className="text-[12.5px] font-semibold tracking-[var(--track-label)] text-text2">
        {label}
        {required && <span className="text-weak ml-0.5">*</span>}
      </label>
      {wiredChildren}
      {error ? (
        <p id={errorId} role="alert" className="mt-1.5 text-[12.5px] font-medium text-weak flex items-center gap-1.5">
          <Icon name="warning" size={16} className="text-weak flex-shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-1.5 text-[12.5px] text-text3">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

export default Field

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
  onChangeValue?: (v: string) => void
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, onChange, onChangeValue, ...props }, ref) => {
    return (
      <input
        ref={ref}
        onChange={(e) => {
          onChange?.(e)
          onChangeValue?.(e.target.value)
        }}
        {...props}
        className={`no-inner-ring w-full rounded-[10px] border bg-paper px-3.5 py-2.5 text-[14px] font-semibold tabular-nums text-text outline-none transition-colors placeholder:text-text3 focus:border-brand ${
          invalid ? 'border-weak' : 'border-border'
        } ${className ?? ''}`}
      />
    )
  }
)
Input.displayName = 'Input'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean
  onChangeValue?: (v: string) => void
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid, onChange, onChangeValue, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        onChange={(e) => {
          onChange?.(e)
          onChangeValue?.(e.target.value)
        }}
        {...props}
        className={`no-inner-ring w-full rounded-[10px] border bg-paper px-3.5 py-2.5 text-[14px] font-semibold text-text outline-none transition-colors placeholder:text-text3 focus:border-brand ${
          invalid ? 'border-weak' : 'border-border'
        } ${className ?? ''}`}
      />
    )
  }
)
Textarea.displayName = 'Textarea'

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean
  options?: Array<[string, string]>
  onChangeValue?: (v: string) => void
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, invalid, options, children, onChange, onChangeValue, ...props }, ref) => {
    return (
      <div className="relative w-full">
        <select
          ref={ref}
          onChange={(e) => {
            onChange?.(e)
            onChangeValue?.(e.target.value)
          }}
          {...props}
          className={`no-inner-ring w-full cursor-pointer appearance-none rounded-[10px] border bg-paper px-3.5 py-2.5 pr-9 text-[14px] font-semibold text-text outline-none transition-colors focus:border-brand ${
            invalid ? 'border-weak' : 'border-border'
          } ${className ?? ''}`}
        >
          {options
            ? options.map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))
            : children}
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
