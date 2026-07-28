import { tool } from 'ai'
import { z } from 'zod'
import { getAccountSnapshot, snapshotSummary } from '@/lib/support-context'
import { searchSupportKb } from '@/lib/support-kb'
import { verdictSummary } from '@/lib/search'
import { runTransferPaths } from '@/lib/mcp-tools'
import { createEscalation, normalizeEmail, listEscalations } from '@/lib/escalation'
import { sendOwnerNotification } from '@/lib/email'
import { after } from 'next/server'
import type { Balance, SearchParams } from '@/lib/types'

export interface BuildSupportToolsOptions {
  userId?: string
  sessionEmail?: string
  balances: Balance[]
  walletDollars?: number
  homeAirport?: string
  conversationKey?: string
}

export function buildSupportTools(opts: BuildSupportToolsOptions) {
  let escalated = false

  return {
    get_account_snapshot: tool({
      description:
        'Get a structured summary of the user\'s account: loyalty program balances, plan tier, active route watches, recent alerts, and booking request statuses. Signed-out users get an honest empty result.',
      inputSchema: z.object({}),
      execute: async () => {
        const snapshot = await getAccountSnapshot(opts.userId)
        return {
          summary: snapshotSummary(snapshot, opts.walletDollars),
          signedIn: snapshot.signedIn,
          tier: snapshot.tier,
          hasAwardWallet: snapshot.hasAwardWallet,
        }
      },
    }),

    explain_verdict: tool({
      description:
        'Re-run hop\'s flight engine for a given route and date to explain why hop recommends cash vs points and state exact computed numbers (¢/pt, miles, taxes, dollars saved).',
      inputSchema: z.object({
        from: z
          .string()
          .optional()
          .describe('Origin 3-letter IATA code (e.g. SFO). Defaults to user\'s home airport if omitted.'),
        to: z.string().describe('Destination 3-letter IATA code (e.g. NRT).'),
        depart: z.string().describe('Departure date YYYY-MM-DD.'),
        returnDate: z.string().optional().describe('Return date YYYY-MM-DD for round trip.'),
        adults: z.number().int().min(1).optional().describe('Adult passenger count (default 1).'),
        cabin: z.enum(['economy', 'premium', 'business', 'first']).optional().describe('Requested cabin class.'),
      }),
      execute: async (args) => {
        const origin = (args.from || opts.homeAirport || 'SFO').trim().toUpperCase()
        const dest = args.to.trim().toUpperCase()

        const params: SearchParams = {
          from: origin,
          to: dest,
          depart: args.depart,
          return: args.returnDate,
          adults: args.adults ?? 1,
          cabin: args.cabin,
        }

        const summary = await verdictSummary(params, opts.balances)
        return summary
      },
    }),

    search_help: tool({
      description:
        'Search hop\'s knowledge base for clear answers on how hop works, point valuations, AwardWallet sync, booking rules, MCP integration, and privacy.',
      inputSchema: z.object({
        query: z.string().describe('Search query or question.'),
      }),
      execute: async ({ query }) => {
        const hits = searchSupportKb(query, 3)
        return { hits }
      },
    }),

    transfer_paths: tool({
      description:
        'List bank points transfer partner options and ratios for a given loyalty program or bank (e.g. "Amex", "Chase", "Velocity").',
      inputSchema: z.object({
        program: z.string().describe('Program or bank name to query.'),
      }),
      execute: async ({ program }) => {
        return runTransferPaths({ program })
      },
    }),

    escalate_to_human: tool({
      description:
        'Escalate a support issue or complex booking follow-up to a human team member at hop. Call this when you cannot resolve the user\'s issue or when the user explicitly asks to speak to a person.',
      inputSchema: z.object({
        reason: z.string().describe('Brief reason for escalation.'),
        summary: z.string().describe('Concise summary of the issue or conversation transcript (max 2000 chars).'),
        email: z.string().optional().describe('User\'s contact email address (required if signed out).'),
      }),
      execute: async (args) => {
        if (escalated) {
          return { ok: true, already: true, message: 'Support request already submitted for this conversation.' }
        }

        // Idempotency check across turns via conversationKey if signed in
        if (opts.userId && opts.conversationKey) {
          try {
            const existing = await listEscalations(opts.userId)
            const match = existing.find(
              (e) => e.trip && typeof e.trip === 'object' && e.trip.conversationKey === opts.conversationKey
            )
            if (match) {
              escalated = true
              return { ok: true, already: true, id: match.id, message: 'Support request already submitted for this conversation.' }
            }
          } catch {
            // Ignore error and proceed
          }
        }

        let contactEmail: string | null = null
        if (opts.userId && opts.sessionEmail) {
          contactEmail = normalizeEmail(opts.sessionEmail)
        }
        if (!contactEmail && args.email) {
          contactEmail = normalizeEmail(args.email)
        }

        if (!contactEmail) {
          return { ok: false, reason: 'A valid contact email address is required.' }
        }

        const transcriptClamped = args.summary.trim().slice(0, 2000)

        const id = await createEscalation({
          userId: opts.userId,
          email: contactEmail,
          trip: {
            source: 'support-agent',
            reason: args.reason.slice(0, 200),
            notes: transcriptClamped,
            transcript: transcriptClamped,
            conversationKey: opts.conversationKey,
          },
        })

        if (!id) {
          return { ok: false, reason: 'Failed to create support escalation.' }
        }

        escalated = true

        // Defer owner notification
        const subjectLine = `Support Escalation: ${args.reason.slice(0, 50)}`
        const bodyText = `Support escalation from ${contactEmail}:\n\nReason: ${args.reason}\n\nSummary:\n${transcriptClamped}\n\nEscalation ID: ${id}`

        try {
          after(async () => {
            await sendOwnerNotification(subjectLine, bodyText).catch(() => {})
          })
        } catch {
          // Fire and forget fallback if after is unavailable
          void sendOwnerNotification(subjectLine, bodyText).catch(() => {})
        }

        return {
          ok: true,
          id,
          message: 'Request received with a summary of this conversation attached. A person at hop will email you.',
        }
      },
    }),
  }
}
