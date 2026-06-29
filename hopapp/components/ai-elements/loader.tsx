// AI Elements — Loader (themed for hop).
// Adopts the official AI Elements <Loader> API (size + className), restyled to
// hop's house style: a quiet, flat spinner in brand tint. The spin is driven by
// the .hop-spin keyframe in globals.css, which is frozen under
// prefers-reduced-motion (so it degrades to a static glyph, never a jitter).

import type { HTMLAttributes } from 'react'

export type LoaderProps = HTMLAttributes<HTMLDivElement> & {
  size?: number
}

// The official Loader's 12-spoke clock SVG, recolored to currentColor so it
// inherits the surrounding brand tone. Pure markup; no client hooks needed.
function LoaderIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      height={size}
      width={size}
      viewBox="0 0 16 16"
      strokeLinejoin="round"
      style={{ color: 'currentColor' }}
      aria-hidden
    >
      <g clipPath="url(#hop_loader_clip)">
        <path d="M8 0V4" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 16V12" opacity="0.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M3.29773 1.52783L5.64887 4.7639" opacity="0.9" stroke="currentColor" strokeWidth="1.5" />
        <path d="M12.7023 1.52783L10.3511 4.7639" opacity="0.1" stroke="currentColor" strokeWidth="1.5" />
        <path d="M12.7023 14.472L10.3511 11.236" opacity="0.4" stroke="currentColor" strokeWidth="1.5" />
        <path d="M3.29773 14.472L5.64887 11.236" opacity="0.6" stroke="currentColor" strokeWidth="1.5" />
        <path d="M15.6085 5.52783L11.8043 6.7639" opacity="0.2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M0.391602 10.472L4.19583 9.23598" opacity="0.7" stroke="currentColor" strokeWidth="1.5" />
        <path d="M15.6085 10.4722L11.8043 9.2361" opacity="0.3" stroke="currentColor" strokeWidth="1.5" />
        <path d="M0.391602 5.52783L4.19583 6.7639" opacity="0.8" stroke="currentColor" strokeWidth="1.5" />
      </g>
      <defs>
        <clipPath id="hop_loader_clip">
          <rect fill="white" height="16" width="16" />
        </clipPath>
      </defs>
    </svg>
  )
}

export function Loader({ className = '', size = 16, ...props }: LoaderProps) {
  return (
    <div
      className={`hop-spin inline-flex items-center justify-center ${className}`}
      {...props}
    >
      <LoaderIcon size={size} />
    </div>
  )
}

export default Loader
