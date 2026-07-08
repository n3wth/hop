// "How to use [program] points" guides — the R2.4 content-plan P1 head terms
// ("best use of Amex points", "Chase transfer partners"). Derived entirely from
// data that already exists and is already tested: the transfer-partner graph
// (lib/transfers.ts), the baseline cpp table (lib/valuations.ts), and the
// sweet-spots seed dataset (lib/sweet-spots.ts). Nothing here is LLM-generated —
// this module only ranks and cross-references numbers other lib/* modules own.

import { listTransferablePrograms, programById, canonicalizeProgram } from '@/lib/programs'
import { partnersOf, type TransferEdge } from '@/lib/transfers'
import { programValue } from '@/lib/valuations'
import { sweetSpots, sortSweetSpotsByValue, type SweetSpot } from '@/lib/sweet-spots'

export interface PartnerRow extends TransferEdge {
  id: string
  name: string
  code: string
  /** Baseline cents-per-point for the PARTNER currency (lib/valuations.ts). */
  baselineCpp: number
  /** Sweet spots (lib/sweet-spots.ts) booked with this partner, best value first. */
  sweetSpots: SweetSpot[]
}

export interface ProgramGuide {
  slug: string
  id: string
  name: string
  code: string
  /** Baseline cents-per-point for the SOURCE currency itself. */
  baselineCpp: number
  /** Transfer partners, ranked by the partner's own baseline cpp (best first). */
  partners: PartnerRow[]
  /** All sweet spots reachable through any of this source's partners, deduped
   *  and ranked the same way the per-program sweet-spot pages are. */
  reachableSweetSpots: SweetSpot[]
}

// One sweet spot per canonical program id it books with, so a partner's row
// can show its standout redemption without re-scanning the full table.
function sweetSpotsForPartner(partnerId: string): SweetSpot[] {
  const matches = sweetSpots.filter((s) => canonicalizeProgram(s.programSlug)?.id === partnerId)
  return sortSweetSpotsByValue(matches)
}

function buildGuide(sourceId: string): ProgramGuide | undefined {
  const def = programById(sourceId)
  if (!def) return undefined

  const partners: PartnerRow[] = partnersOf(sourceId)
    .map((edge) => {
      const partnerDef = programById(edge.to)
      return {
        ...edge,
        id: edge.to,
        name: partnerDef?.name ?? edge.to,
        code: partnerDef?.code ?? '??',
        baselineCpp: programValue(edge.to),
        sweetSpots: sweetSpotsForPartner(edge.to),
      }
    })
    // best-value transfer targets first — computed from the same baseline
    // table walletValue()/valueOfPoints() use, never a hand-picked order.
    .sort((a, b) => b.baselineCpp - a.baselineCpp)

  const reachableSweetSpots = sortSweetSpotsByValue(
    sweetSpots.filter((s) => {
      const target = canonicalizeProgram(s.programSlug)?.id
      return target != null && partners.some((p) => p.id === target)
    }),
  )

  return {
    slug: def.id,
    id: def.id,
    name: def.name,
    code: def.code,
    baselineCpp: programValue(def.id),
    partners,
    reachableSweetSpots,
  }
}

// The 5 transferable bank currencies with a full transfer-partner graph today
// (lib/transfers.ts). A source with zero verified edges would render an empty
// guide, so this filters to sources that actually have partners.
export function programGuides(): ProgramGuide[] {
  return listTransferablePrograms()
    .map((p) => buildGuide(p.id))
    .filter((g): g is ProgramGuide => g != null && g.partners.length > 0)
}

export function allProgramGuideSlugs(): string[] {
  return programGuides().map((g) => g.slug)
}

export function programGuideBySlug(slug: string): ProgramGuide | undefined {
  return programGuides().find((g) => g.slug === slug)
}
