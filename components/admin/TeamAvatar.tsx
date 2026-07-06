import type { ComponentType } from 'react'
import type { AnimalKind } from '@/lib/team'

// Four hand-drawn flat marks for the admin Team view — a cousin of the hop
// bunny mark (components/Logo.tsx): one currentColor silhouette per animal,
// detail cut as real negative space via <mask> rather than a second paint
// color. Each sits on its own soft tile so the four read as distinct at a
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
}

const MARKS: Record<AnimalKind, ComponentType<{ size: number }>> = {
  beaver: BeaverMark,
  fox: FoxMark,
  owl: OwlMark,
  tortoise: TortoiseMark,
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

// Round ears + a big flat face + a two-tooth cutout — the beaver signature
// that still reads at 48px even once the ears mostly vanish.
function BeaverMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <mask id="team-avatar-beaver" maskUnits="userSpaceOnUse" x="0" y="0" width="48" height="48">
        <rect width="48" height="48" fill="white" />
        <circle cx="18" cy="26" r="2" fill="black" />
        <circle cx="30" cy="26" r="2" fill="black" />
        <rect x="20" y="34" width="3" height="6" rx="1" fill="black" />
        <rect x="25" y="34" width="3" height="6" rx="1" fill="black" />
      </mask>
      <g mask="url(#team-avatar-beaver)">
        <circle cx="12" cy="16" r="6" fill="currentColor" />
        <circle cx="36" cy="16" r="6" fill="currentColor" />
        <circle cx="24" cy="28" r="14" fill="currentColor" />
      </g>
    </svg>
  )
}

// Triangle ears + a chin that tapers to a point — the two shapes that make a
// silhouette read as "fox" rather than any other pointed-ear animal.
function FoxMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <mask id="team-avatar-fox" maskUnits="userSpaceOnUse" x="0" y="0" width="48" height="48">
        <rect width="48" height="48" fill="white" />
        <circle cx="17" cy="23" r="2" fill="black" />
        <circle cx="31" cy="23" r="2" fill="black" />
        <circle cx="24" cy="37" r="1.6" fill="black" />
      </mask>
      <g mask="url(#team-avatar-fox)">
        <polygon points="9,20 15,5 21,21" fill="currentColor" />
        <polygon points="39,20 33,5 27,21" fill="currentColor" />
        <polygon points="10,18 13,33 24,44 35,33 38,18 30,13 18,13" fill="currentColor" />
      </g>
    </svg>
  )
}

// A big round body with two ear tufts; the eyes are cut all the way through
// (real holes, tile color shows), with a solid pupil layered back on top —
// same "cut, then re-add" trick as components/Logo.tsx's mask.
function OwlMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <mask id="team-avatar-owl" maskUnits="userSpaceOnUse" x="0" y="0" width="48" height="48">
        <rect width="48" height="48" fill="white" />
        <circle cx="16" cy="25" r="5.5" fill="black" />
        <circle cx="32" cy="25" r="5.5" fill="black" />
        <polygon points="21,33 27,33 24,38" fill="black" />
      </mask>
      <g mask="url(#team-avatar-owl)">
        <polygon points="14,15 18,4 22,16" fill="currentColor" />
        <polygon points="34,15 30,4 26,16" fill="currentColor" />
        <circle cx="24" cy="27" r="16" fill="currentColor" />
      </g>
      <circle cx="16" cy="25" r="1.8" fill="currentColor" />
      <circle cx="32" cy="25" r="1.8" fill="currentColor" />
    </svg>
  )
}

// A domed shell (an arc, not a circle, so it reads as a shell rather than a
// head) with two stubby feet peeking from underneath and a head below —
// the feet are what keep this reading as a tortoise instead of a mushroom.
function TortoiseMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <mask id="team-avatar-tortoise" maskUnits="userSpaceOnUse" x="0" y="0" width="48" height="48">
        <rect width="48" height="48" fill="white" />
        <circle cx="21" cy="38" r="1.2" fill="black" />
        <circle cx="27" cy="38" r="1.2" fill="black" />
      </mask>
      <g mask="url(#team-avatar-tortoise)">
        <circle cx="11" cy="34" r="3.4" fill="currentColor" />
        <circle cx="37" cy="34" r="3.4" fill="currentColor" />
        <ellipse cx="24" cy="40" rx="7" ry="6" fill="currentColor" />
        <path d="M7,32 A17,17 0 0 1 41,32 Z" fill="currentColor" />
      </g>
    </svg>
  )
}
