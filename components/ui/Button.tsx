import Link from 'next/link'
import type { ComponentProps } from 'react'

type Variant = 'primary' | 'secondary'

interface CommonProps {
  variant?: Variant
  /** Block-level, full-width CTA (e.g. an auth screen's stacked actions). */
  fullWidth?: boolean
  className?: string
}

type LinkVariant = CommonProps &
  Omit<ComponentProps<typeof Link>, 'className'> & {
    href: ComponentProps<typeof Link>['href']
    /** Force a native <a> instead of next/link — for routes that must never be
        prefetched (e.g. /auth/login, which redirects into Auth0). */
    native?: boolean
  }

type ButtonVariant = CommonProps &
  Omit<ComponentProps<'button'>, 'className'> & { href?: undefined; native?: undefined }

export type ButtonProps = LinkVariant | ButtonVariant

const VARIANT_CLASS: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-deep',
  secondary: 'border border-border bg-paper text-text hover:border-brand hover:text-brand',
}

// Shared primary/secondary CTA per docs/design/DESIGN-SYSTEM.md's documented
// button patterns — one source of truth so call sites can't drift on
// radius/padding/focus treatment the way the old per-page hand-rolled copies
// did (error boundaries, login). Renders a Next <Link> when `href` is given,
// otherwise a native <button type="button">.
export default function Button({
  variant = 'primary',
  fullWidth = false,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  const padding = fullWidth ? 'w-full py-3.5' : variant === 'primary' ? 'px-6 py-3' : 'px-5 py-3'
  const classes = `inline-flex items-center justify-center gap-2 rounded-[var(--radius)] text-[14.5px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60 ${padding} ${VARIANT_CLASS[variant]} ${className}`

  if (rest.href != null) {
    const { href, native, ...linkRest } = rest as LinkVariant
    if (native) {
      return (
        <a href={href.toString()} className={classes} {...(linkRest as ComponentProps<'a'>)}>
          {children}
        </a>
      )
    }
    return (
      <Link href={href} className={classes} {...linkRest}>
        {children}
      </Link>
    )
  }

  const { type = 'button', ...buttonRest } = rest as ButtonVariant
  return (
    <button type={type} className={classes} {...buttonRest}>
      {children}
    </button>
  )
}
