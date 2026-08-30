import type { SVGProps } from 'react'
// Type-only import from the package root (the SSR entry doesn't re-export it);
// erased at compile time, so it pulls no client runtime.
import type { IconWeight } from '@phosphor-icons/react'
// Value imports from the SSR entry: same component names, but a server-safe
// renderer (plain SVG, no hooks/handlers) so this file needs no 'use client'.
import {
  Airplane,
  ArrowClockwise,
  ArrowLeft,
  ArrowRight,
  ArrowsClockwise,
  ArrowsLeftRight,
  Bell,
  CalendarBlank,
  CaretDown,
  CaretLeft,
  CaretRight,
  CaretUp,
  ChartBar,
  Check,
  CheckCircle,
  Clock,
  Compass,
  Copy,
  CreditCard,
  CurrencyDollar,
  EnvelopeSimple,
  GearSix,
  Globe,
  House,
  Info,
  Lightbulb,
  List,
  Lock,
  MagnifyingGlass,
  MapPin,
  Medal,
  PaperPlaneRight,
  Plus,
  Receipt,
  SealPercent,
  Shield,
  SignOut,
  Star,
  Stop,
  Suitcase,
  Tag,
  ThumbsDown,
  ThumbsUp,
  TrendUp,
  Trophy,
  User,
  UsersThree,
  Wallet,
  Warning,
  WarningCircle,
  X,
} from '@phosphor-icons/react/dist/ssr'

// Icon registry — name → Phosphor component (regular weight default).
// Add new names here as the icon vocabulary grows; keep old names for compat.
const ICONS = {
  // Core utility
  search: MagnifyingGlass,
  close: X,
  add: Plus,
  check: Check,
  check_circle: CheckCircle,
  menu: List,
  info: Info,
  error: WarningCircle,
  warning: Warning,
  refresh: ArrowClockwise,
  content_copy: Copy,
  expand_more: CaretDown,
  caret_up: CaretUp,
  caret_left: CaretLeft,
  caret_right: CaretRight,
  arrow_right: ArrowRight,
  arrow_left: ArrowLeft,
  swap_horiz: ArrowsLeftRight,
  settings: GearSix,
  notifications: Bell,
  lock: Lock,
  shield: Shield,
  schedule: Clock,
  house: House,
  envelope: EnvelopeSimple,
  stop: Stop,
  paper_plane: PaperPlaneRight,
  // Travel
  flight: Airplane,
  airplane: Airplane,
  suitcase: Suitcase,
  map_pin: MapPin,
  compass: Compass,
  globe: Globe,
  calendar: CalendarBlank,
  // Finance / loyalty
  credit_card: CreditCard,
  receipt_long: Receipt,
  loyalty: Tag,
  deals: SealPercent,
  wallet: Wallet,
  currency: CurrencyDollar,
  trending_up: TrendUp,
  transfer: ArrowsClockwise,
  chart: ChartBar,
  // Achievement / premium
  workspace_premium: Trophy,
  trophy: Trophy,
  medal: Medal,
  star: Star,
  // People
  person: User,
  team: UsersThree,
  logout: SignOut,
  lightbulb: Lightbulb,
  // Feedback
  thumbs_up: ThumbsUp,
  thumbs_down: ThumbsDown,
} as const

export type IconName = keyof typeof ICONS

// The only sanctioned icon sizes. 12 = eyebrow badges / status dots,
// 16 = inline with text, 20 = icon-only controls, 24 = feature tiles.
export type IconSize = 12 | 16 | 20 | 24

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name' | 'ref'> {
  name: IconName
  size?: IconSize
  weight?: IconWeight
  /**
   * Accessible name. Provide it only when the icon carries meaning on its own
   * (e.g. an icon-only control); the icon then renders `role="img"` with this
   * label and is exposed to assistive tech. Omitted (the default) → the icon is
   * decorative and marked `aria-hidden`, so screen readers skip it.
   */
  alt?: string
}

export default function Icon({ name, size = 24, weight = 'regular', className, alt, ...rest }: IconProps) {
  const PhIcon = ICONS[name] as React.ComponentType<
    { size?: number; weight?: IconWeight; className?: string } & Record<string, unknown>
  >
  if (!PhIcon) return null
  // Decorative by default (aria-hidden); labeled mode when `alt` is supplied.
  // Placed before `...rest` so an explicit caller-provided aria-* still wins.
  const a11y = alt
    ? { role: 'img' as const, 'aria-label': alt }
    : { 'aria-hidden': true as const }
  return <PhIcon size={size} weight={weight} className={className} {...a11y} {...(rest as object)} />
}
