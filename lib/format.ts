/**
 * Consolidated number and currency formatting utilities.
 * See docs/plans/2026-07-02-design-component-system.md.
 */

/**
 * Formats a number as USD with commas and rounded to the nearest integer.
 * E.g., formatUSD(1234.5) === '$1,235'
 */
export function formatUSD(n: number | undefined | null): string {
  if (n == null || !isFinite(n)) return ''
  return `$${Math.round(n).toLocaleString('en-US')}`
}

/**
 * Formats a number with commas for points.
 * E.g., formatPoints(60000) === '60,000'
 */
export function formatPoints(n: number | undefined | null): string {
  if (n == null || !isFinite(n)) return ''
  return Math.round(n).toLocaleString('en-US')
}
