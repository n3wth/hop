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
  GearSix,
  Globe,
  Info,
  Lightbulb,
  List,
  Lock,
  MagnifyingGlass,
  MapPin,
  Medal,
  Plus,
  Receipt,
  SealPercent,
  Shield,
  SignOut,
  Star,
  Suitcase,
  Tag,
  TrendUp,
  Trophy,
  User,
  Wallet,
  Warning,
  WarningCircle,
  X,
} from '@phosphor-icons/react/dist/ssr'

// Icon registry — name → Phosphor component (fill weight default).
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
  caret_right: CaretRight,
  arrow_right: ArrowRight,
  arrow_left: ArrowLeft,
  swap_horiz: ArrowsLeftRight,
  settings: GearSix,
  notifications: Bell,
  lock: Lock,
  shield: Shield,
  schedule: Clock,
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
  logout: SignOut,
  lightbulb: Lightbulb,
} as const

export type IconName = keyof typeof ICONS

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name' | 'ref'> {
  name: IconName
  size?: number
  weight?: IconWeight
  /**
   * Accessible name. Provide it only when the icon carries meaning on its own
   * (e.g. an icon-only control); the icon then renders `role="img"` with this
   * label and is exposed to assistive tech. Omitted (the default) → the icon is
   * decorative and marked `aria-hidden`, so screen readers skip it.
   */
  alt?: string
}

export default function Icon({ name, size = 24, weight = 'fill', className, alt, ...rest }: IconProps) {
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
