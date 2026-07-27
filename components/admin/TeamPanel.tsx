import type { ReactNode } from 'react'
import AdminPageHeader, { AdminPageShell } from '@/components/admin/AdminPageHeader'
import TeamAvatar from '@/components/admin/TeamAvatar'
import { formatNextRun, type TeamCard } from '@/lib/admin-team'
import type { MarketingDraft } from '@/lib/admin-marketing'
import type { OpenItem } from '@/lib/linear-client'

interface Props {
  cards: TeamCard[]
  /** Whether GITHUB_TOKEN is set — distinguishes "not connected" from "GitHub
      sync failed" in the empty-state copy below. */
  githubConfigured: boolean
  now: Date
  /** Growth desk's docs/marketing/drafts/*.md, newest first. Always an array — never null. */
  drafts: MarketingDraft[]
  /** The three standing coordination threads, or null when Linear sync is unavailable. */
  openItems: OpenItem[] | null
  /** Whether LINEAR_API_KEY + LINEAR_TEAM_ID are set. */
  linearConfigured: boolean
}

// /admin/team — the autonomous agent org (lib/team.ts's static roster) laid
// over live GitHub PR data, the growth desk's marketing drafts, and the
// standing Linear coordination threads. Read-only composition, same shape as
// OpsPanel / AgentActivity: every section renders fully whether or not
// GITHUB_TOKEN / LINEAR_API_KEY are set.
export default function TeamPanel({ cards, githubConfigured, now, drafts, openItems, linearConfigured }: Props) {
  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Team"
        description="hop's autonomous agent org. They work on a schedule and open PRs or drafts — nothing merges or sends without your review."
        crumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Team' },
        ]}
      />

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {cards.map((card) => (
          <TeamMemberCard key={card.member.slug} card={card} githubConfigured={githubConfigured} now={now} />
        ))}
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <DraftsSection drafts={drafts} />
        <OpenItemsSection items={openItems} linearConfigured={linearConfigured} />
      </div>
    </AdminPageShell>
  )
}

function PanelHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-[10.5px] font-bold uppercase tracking-[var(--track-eyebrow)] text-brand">
      {children}
    </h2>
  )
}

function DraftsSection({ drafts }: { drafts: MarketingDraft[] }) {
  return (
    <div className="rounded-[var(--radius)] border border-border bg-paper p-4">
      <PanelHeading>Drafts awaiting review</PanelHeading>
      <p className="mt-1 text-[12px] text-text3">
        Ready-to-paste drafts for channels Omar has no posting credentials for.
      </p>
      {drafts.length === 0 ? (
        <div className="mt-3">
          <Empty>No drafts in docs/marketing/drafts/ right now.</Empty>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-1.5">
          {drafts.map((draft) => (
            <a
              key={draft.filename}
              href={draft.githubUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-border bg-surface px-3 py-2 transition-colors hover:border-brand"
            >
              <div className="min-w-0">
                <div className="truncate text-[12.5px] font-medium text-text">{draft.title}</div>
                <div className="truncate text-[11px] text-text3">
                  {draft.channel}
                  {draft.date ? ` · ${draft.date}` : ''}
                </div>
              </div>
              <span className="flex-shrink-0 whitespace-nowrap rounded-full bg-sunk px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[var(--track-eyebrow)] text-text3">
                {draft.status}
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

function OpenItemsSection({ items, linearConfigured }: { items: OpenItem[] | null; linearConfigured: boolean }) {
  return (
    <div className="rounded-[var(--radius)] border border-border bg-paper p-4">
      <PanelHeading>Open items</PanelHeading>
      <p className="mt-1 text-[12px] text-text3">The desks&rsquo; standing coordination threads in Linear.</p>
      {items === null ? (
        <div className="mt-3">
          <Empty>
            {linearConfigured ? 'Linear sync unavailable right now.' : 'Connect Linear to see open items.'}
          </Empty>
        </div>
      ) : items.length === 0 ? (
        <div className="mt-3">
          <Empty>No standing threads found.</Empty>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-1.5">
          {items.map((item) => (
            <a
              key={item.identifier}
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="block rounded-[var(--radius-sm)] border border-border bg-surface px-3 py-2 transition-colors hover:border-brand"
            >
              <div className="truncate text-[12.5px] font-medium text-text">{item.title}</div>
              {item.snippet ? (
                <div className="mt-0.5 line-clamp-2 text-[11.5px] text-text3">{item.snippet}</div>
              ) : null}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

function TeamMemberCard({
  card,
  githubConfigured,
  now,
}: {
  card: TeamCard
  githubConfigured: boolean
  now: Date
}) {
  const { member, work, waitingOn, nextRunAt } = card

  return (
    <div className="rounded-[var(--radius)] border border-border bg-paper p-4">
      <div className="flex items-center gap-3">
        <TeamAvatar animal={member.animal} size={48} />
        <div className="min-w-0">
          <div className="truncate text-[14px] font-semibold text-text">{member.name}</div>
          <div className="truncate text-[12.5px] text-text3">{member.role}</div>
        </div>
        <span className="ml-auto flex-shrink-0 whitespace-nowrap rounded-full bg-sunk px-2 py-0.5 text-[11px] font-semibold text-text3">
          next {formatNextRun(nextRunAt, now)}
        </span>
      </div>

      <SectionLabel>Current work</SectionLabel>
      {work === null ? (
        <Empty>
          {githubConfigured ? 'GitHub sync unavailable right now.' : 'Connect GITHUB_TOKEN to see live work.'}
        </Empty>
      ) : work.length === 0 ? (
        <Empty>No open PRs on {member.branchPrefix}*.</Empty>
      ) : (
        <div className="flex flex-col gap-1.5">
          {work.map((pr) => (
            <a
              key={pr.number}
              href={pr.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-border bg-surface px-3 py-2 transition-colors hover:border-brand"
            >
              <span className="min-w-0 truncate text-[12.5px] font-medium text-text">
                #{pr.number} {pr.title}
              </span>
              <span className="flex-shrink-0 text-[10.5px] font-bold uppercase tracking-[var(--track-eyebrow)] text-text3">
                {pr.draft ? 'draft' : 'ready'}
              </span>
            </a>
          ))}
        </div>
      )}

      <SectionLabel>Waiting on you</SectionLabel>
      {waitingOn.length === 0 ? (
        <Empty>Nothing waiting.</Empty>
      ) : (
        <div className="flex flex-col gap-1">
          {waitingOn.map((item, i) =>
            item.href ? (
              <a
                key={i}
                href={item.href}
                className="text-[12.5px] font-medium text-brand underline-offset-2 transition-colors hover:text-brand-deep hover:underline"
              >
                {item.label}
              </a>
            ) : (
              <span key={i} className="text-[12.5px] text-text3">
                {item.label}
              </span>
            )
          )}
        </div>
      )}

      <div className="mt-3 border-t border-hair pt-2.5 text-[11.5px] text-text3">
        {member.scheduleHuman} · reports via {member.reportsVia}
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-1.5 mt-3.5 text-[10.5px] font-bold uppercase tracking-[var(--track-eyebrow)] text-brand">
      {children}
    </div>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[var(--radius-sm)] border border-dashed border-border bg-paper/50 px-3 py-2 text-[12px] text-text3">
      {children}
    </div>
  )
}
