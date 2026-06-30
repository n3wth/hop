'use client'

import type { SVGProps } from 'react'
import type { IconWeight } from '@phosphor-icons/react'
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
} from '@phosphor-icons/react'

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
}

export default function Icon({ name, size = 24, weight = 'fill', className, ...rest }: IconProps) {
  const PhIcon = ICONS[name] as React.ComponentType<{ size?: number; weight?: IconWeight; className?: string }>
  if (!PhIcon) return null
  return <PhIcon size={size} weight={weight} className={className} {...(rest as object)} />
}
