import type { Balance, TransferSource } from '@/lib/types'

interface PartnerMap {
  [source: string]: string[]
}

const TRANSFER_PARTNERS: PartnerMap = {
  'Amex MR': ['Aeroplan', 'BA Avios', 'Delta', 'Virgin Atlantic'],
  'Chase UR': ['United', 'Southwest', 'BA Avios', 'Aeroplan'],
  'Bilt': ['Alaska', 'United', 'BA Avios', 'Aeroplan'],
}

// Aliases for tolerant matching — keys are canonical partner names in the map,
// values are additional strings that should match them.
const ALIASES: Record<string, string[]> = {
  'BA Avios': ['british airways', 'avios'],
  'Aeroplan': ['air canada', 'aeroplan'],
  'United': ['united mileageplus', 'mileageplus'],
  'Alaska': ['alaska airlines', 'alaska atmos'],
  'Delta': ['delta skymiles', 'skymiles'],
  'Virgin Atlantic': ['virgin', 'flying club'],
  'Southwest': ['rapid rewards'],
}

function matches(partner: string, target: string): boolean {
  const p = partner.toLowerCase()
  const t = target.toLowerCase()
  if (t.includes(p) || p.includes(t)) return true
  const aliases = ALIASES[partner] ?? []
  return aliases.some(alias => t.includes(alias))
}

export function transfersTo(targetProgram: string, balances: Balance[]): TransferSource[] {
  const result: TransferSource[] = []

  for (const [source, partners] of Object.entries(TRANSFER_PARTNERS)) {
    const canReach = partners.some(partner => matches(partner, targetProgram))
    if (!canReach) continue

    const balance = balances.find(b => b.program === source || b.code === source || matches(source, b.program))
    if (balance && balance.balance > 0) {
      result.push({ source, ratio: '1:1' })
    }
  }

  return result
}
