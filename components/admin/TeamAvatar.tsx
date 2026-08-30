import type { ComponentType } from 'react'
import type { AnimalKind } from '@/lib/team'

// Five hand-drawn flat marks for the admin Team view — a cousin of the hop
// bunny mark (components/Logo.tsx): one currentColor silhouette per animal,
// detail cut as real negative space via <mask> rather than a second paint
// color. Each sits on its own soft tile so the five read as distinct at a
// glance (silhouette shape) AND at a squint (tile hue) — no two animals
// share a hue.

interface AvatarProps {
  animal: AnimalKind
  size?: number
  className?: string
}

const TILE: Record<AnimalKind, string> = {
  beaver: 'bg-good-bg text-good',
  fox: 'bg-weak-bg text-weak',
  owl: 'bg-gold-soft text-gold',
  tortoise: 'bg-sunk text-cash',
  eagle: 'bg-ok-bg text-ok',
}

const MARKS: Record<AnimalKind, ComponentType<{ size: number }>> = {
  beaver: BeaverMark,
  fox: FoxMark,
  owl: OwlMark,
  tortoise: TortoiseMark,
  eagle: EagleMark,
}

export default function TeamAvatar({ animal, size = 48, className }: AvatarProps) {
  const Mark = MARKS[animal]
  return (
    <span
      aria-hidden="true"
      className={`inline-flex flex-shrink-0 items-center justify-center rounded-[14px] ${TILE[animal]}${className ? ` ${className}` : ''}`}
      style={{ width: size, height: size }}
    >
      <Mark size={Math.round(size * 0.72)} />
    </span>
  )
}

// A big round warm face (fills most of the canvas for a chunkier, cuter
// head-to-tile ratio), close-set round ears, and a scooped open-mouth
// smile with two front teeth — the beaver signature, cut as real negative
// space rather than floating tooth bars.
function BeaverMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <mask id="team-avatar-beaver" maskUnits="userSpaceOnUse" x="0" y="0" width="48" height="48">
        <rect width="48" height="48" fill="white" />
        <circle cx="17.5" cy="24" r="2.3" fill="black" />
        <circle cx="30.5" cy="24" r="2.3" fill="black" />
        <path d="M15,31 Q24,40 33,31 Q24,35.5 15,31 Z" fill="black" />
        <rect x="21.5" y="31.5" width="2.6" height="5" rx="0.8" fill="white" />
        <rect x="24.4" y="31.5" width="2.6" height="5" rx="0.8" fill="white" />
      </mask>
      <g mask="url(#team-avatar-beaver)">
        <circle cx="10.5" cy="14.5" r="6.4" fill="currentColor" />
        <circle cx="37.5" cy="14.5" r="6.4" fill="currentColor" />
        <circle cx="24" cy="27" r="16.5" fill="currentColor" />
      </g>
    </svg>
  )
}

// A smooth single-taper shield face (no cusp at the chin), soft curved
// ears, round eyes, a small triangle nose, and a gentle closed-mouth smile
// — cute via roundness and proportion, not a gimmick.
function FoxMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <mask id="team-avatar-fox" maskUnits="userSpaceOnUse" x="0" y="0" width="48" height="48">
        <rect width="48" height="48" fill="white" />
        <circle cx="17.5" cy="23" r="2.3" fill="black" />
        <circle cx="30.5" cy="23" r="2.3" fill="black" />
        <polygon points="22.5,29.5 25.5,29.5 24,32" fill="black" />
        <path d="M18,35 Q24,39 30,35" stroke="black" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      </mask>
      <g mask="url(#team-avatar-fox)">
        <path d="M8,19 Q9,6 17,4 Q15,13 19,19 Z" fill="currentColor" />
        <path d="M40,19 Q39,6 31,4 Q33,13 29,19 Z" fill="currentColor" />
        <path
          d="M9,18 C9,10 15,6 24,6 C33,6 39,10 39,18 C39,26 34,34 24,42 C14,34 9,26 9,18 Z"
          fill="currentColor"
        />
      </g>
    </svg>
  )
}

// Same big round body + ear tufts as before, tilted a few degrees for a
// curious head-tilt, with eyes cut all the way through (real holes, tile
// color shows) and a solid pupil layered back on top — same "cut, then
// re-add" trick as components/Logo.tsx's mask.
function OwlMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <mask id="team-avatar-owl" maskUnits="userSpaceOnUse" x="0" y="0" width="48" height="48">
        <rect width="48" height="48" fill="white" />
        <circle cx="16.5" cy="24.5" r="6.2" fill="black" />
        <circle cx="31.5" cy="26.5" r="6.2" fill="black" />
        <polygon points="21.5,34 27,34.5 24,39.5" fill="black" />
      </mask>
      <g mask="url(#team-avatar-owl)" transform="rotate(-6 24 26)">
        <polygon points="13,14 18,3 22,15" fill="currentColor" />
        <polygon points="34,16 31,4 27,16" fill="currentColor" />
        <circle cx="24" cy="27" r="17" fill="currentColor" />
      </g>
      <circle cx="16.5" cy="24.5" r="2" fill="currentColor" transform="rotate(-6 24 26)" />
      <circle cx="31.5" cy="26.5" r="2" fill="currentColor" transform="rotate(-6 24 26)" />
    </svg>
  )
}

// Top-down turtle silhouette (shell + a head peeking out above it + four
// paddling feet + a tail point) — the classic legible turtle gestalt. A
// front-facing tortoise face alone doesn't read at 48px, so this mark
// breaks from the other four's face-forward framing on purpose.
function TortoiseMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <mask id="team-avatar-tortoise" maskUnits="userSpaceOnUse" x="0" y="0" width="48" height="48">
        <rect width="48" height="48" fill="white" />
        <circle cx="21.5" cy="8.5" r="1.1" fill="black" />
        <circle cx="26.5" cy="8.5" r="1.1" fill="black" />
        <path d="M21.5,11.5 Q24,13.2 26.5,11.5" stroke="black" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      </mask>
      <g mask="url(#team-avatar-tortoise)">
        <polygon points="21,41 27,41 24,46" fill="currentColor" />
        <ellipse cx="9" cy="17" rx="4.4" ry="3.1" fill="currentColor" transform="rotate(35 9 17)" />
        <ellipse cx="39" cy="17" rx="4.4" ry="3.1" fill="currentColor" transform="rotate(-35 39 17)" />
        <ellipse cx="9" cy="37" rx="4.4" ry="3.1" fill="currentColor" transform="rotate(-35 9 37)" />
        <ellipse cx="39" cy="37" rx="4.4" ry="3.1" fill="currentColor" transform="rotate(35 39 37)" />
        <ellipse cx="24" cy="27" rx="16" ry="15" fill="currentColor" />
        <circle cx="24" cy="9" r="5.3" fill="currentColor" />
      </g>
    </svg>
  )
}

// A round head like the owl's, but a bold stout wedge beak (not a thin
// taper, which just read as a chin) is the one shape that says "raptor"
// rather than "owl" — plus a single back-swept crest feather (vs. the
// owl's twin tufts) and forward-set pupils for a more alert expression.
function EagleMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <mask id="team-avatar-eagle" maskUnits="userSpaceOnUse" x="0" y="0" width="48" height="48">
        <rect width="48" height="48" fill="white" />
        <circle cx="17" cy="19" r="2.7" fill="black" />
        <circle cx="31" cy="19" r="2.7" fill="black" />
      </mask>
      <g mask="url(#team-avatar-eagle)">
        <polygon points="29,2.5 34.5,9 25.5,6" fill="currentColor" />
        <circle cx="24" cy="20" r="14" fill="currentColor" />
        <path d="M18,28 Q24,25 30,28 Q28,35 24,39.5 Q20,35 18,28 Z" fill="currentColor" />
      </g>
      <circle cx="17.3" cy="20" r="1.35" fill="currentColor" />
      <circle cx="31.3" cy="20" r="1.35" fill="currentColor" />
    </svg>
  )
}
