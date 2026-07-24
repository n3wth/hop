import Link from 'next/link'
import type { ComponentProps } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'ink'
export type ButtonSize = 'sm' | 'md' | 'lg'

interface CommonProps {
  variant?: ButtonVariant
  size?: ButtonSize
  onDark?: boolean
  /** Block-level, full-width CTA (e.g. an auth screen's stacked actions). */
  fullWidth?: boolean
  className?: string
}

type LinkVariant = CommonProps &
  Omit<ComponentProps<typeof Link>, 'className' | 'href'> & {
    href: ComponentProps<typeof Link>['href']
    native?: false
  }

type NativeAnchorVariant = CommonProps &
  Omit<ComponentProps<'a'>, 'className' | 'href'> & {
    href: string
    /** Force a native <a> instead of next/link — for routes outside the Next
        route tree that must always get a real browser navigation, never a
        client-side transition (e.g. /auth/login, which redirects into Auth0;
        see the same convention in components/AccountMenu.tsx's logout link). */
    native: true
  }

type ButtonBaseVariant = CommonProps &
  Omit<ComponentProps<'button'>, 'className'> & { href?: undefined; native?: undefined }

export type ButtonProps = LinkVariant | NativeAnchorVariant | ButtonBaseVariant

export const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-deep',
  secondary: 'border border-border bg-paper text-text hover:border-brand hover:text-brand',
  ghost: 'bg-transparent text-text hover:bg-surface',
  ink: 'border-[1.5px] border-text bg-transparent text-text hover:bg-text hover:text-white',
}

export const ONDARK_VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'bg-white text-brand hover:bg-brand-surface',
  secondary: 'border border-white/30 text-white hover:bg-white/10',
  ghost: 'bg-transparent text-white hover:bg-white/10',
  ink: 'border-[1.5px] border-white bg-transparent text-white hover:bg-white hover:text-text',
}

export const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-[12.5px]',
  md: 'px-5 py-3 text-[14px]',
  lg: 'px-6 py-3.5 text-[15px]',
}

// Shared CTA primitive per docs/design/DESIGN-SYSTEM.md's documented
// button patterns — one source of truth so call sites can't drift on
// radius/padding/focus treatment. Renders a Next <Link> when `href` is given,
// a plain <a> when `native` is also set, otherwise a <button type="button">.
export default function Button({
  variant = 'primary',
  size = 'md',
  onDark = false,
  fullWidth = false,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  const variantStyles = onDark ? ONDARK_VARIANT_CLASS[variant] : VARIANT_CLASS[variant]
  const sizeStyles = fullWidth ? 'w-full py-3.5 text-[14px]' : SIZE_CLASS[size]
  const classes = `inline-flex items-center justify-center gap-2 rounded-[var(--radius)] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60 ${sizeStyles} ${variantStyles} ${className}`

  if (rest.href != null) {
    if (rest.native) {
      const { href, native, ...anchorRest } = rest
      void native
      return (
        <a href={href} className={classes} {...anchorRest}>
          {children}
        </a>
      )
    }
    const { href, native, ...linkRest } = rest
    void native
    return (
      <Link href={href} className={classes} {...linkRest}>
        {children}
      </Link>
    )
  }

  const { type = 'button', ...buttonRest } = rest
  return (
    <button type={type} className={classes} {...buttonRest}>
      {children}
    </button>
  )
}
