import type { AnchorHTMLAttributes, ReactNode } from 'react'

interface UrlObjectLike {
  pathname?: string
  search?: string
  hash?: string
}

interface ShimLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: string | UrlObjectLike
  children?: ReactNode
}

function toHref(href: string | UrlObjectLike): string {
  if (typeof href === 'string') return href
  return `${href.pathname ?? ''}${href.search ?? ''}${href.hash ?? ''}` || '#'
}

// Standalone-preview substitute for next/link — claude.ai/design renders
// components outside a Next.js app router, so the real next/link's route
// context throws. Same href/children contract, plain <a>, no navigation.
export default function Link({ href, children, ...rest }: ShimLinkProps) {
  return (
    <a href={toHref(href)} {...rest}>
      {children}
    </a>
  )
}
