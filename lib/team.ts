// The autonomous agent org — a static registry, not a database table. Adding
// a new agent to hop's autonomy loop means adding a row here; there is no
// admin CRUD for this (see docs/decisions/0004-compound-engineering-operating-model.md
// for the loop these agents run). Read by app/admin/team/page.tsx +
// lib/admin-team.ts (which layers live GitHub/Linear data on top).

export type AnimalKind = 'beaver' | 'fox' | 'owl' | 'tortoise' | 'eagle'

export interface TeamMember {
  slug: string
  name: string
  role: string
  animal: AnimalKind
  /** 5-field cron expression in UTC — matches vercel.json's convention. */
  cron: string
  /** Human-readable schedule in Pacific time, for display only. Note: this
      label is a fixed string (not derived from `cron`), so it reads correct
      for PDT (UTC-7, roughly Mar–Nov) and drifts an hour during PST — cosmetic
      for an internal display, not worth a timezone library. */
  scheduleHuman: string
  /** Branch prefix this agent commits under, e.g. 'autopilot/'. */
  branchPrefix: string
  /** Where this agent's output shows up for the owner to review. */
  reportsVia: string
}

export const TEAM: TeamMember[] = [
  {
    slug: 'jeffrey',
    name: 'Jeffrey',
    role: 'Engineering autopilot',
    animal: 'beaver',
    cron: '32 14 * * *',
    scheduleHuman: 'Daily · 7:32am PT',
    branchPrefix: 'autopilot/',
    reportsVia: 'Draft PRs',
  },
  {
    slug: 'omar',
    name: 'Omar',
    role: 'Growth desk',
    animal: 'fox',
    cron: '0 15 * * 1,3,5',
    scheduleHuman: 'Mon/Wed/Fri · 8am PT',
    branchPrefix: 'growth/',
    reportsVia: 'Marketing drafts',
  },
  {
    slug: 'elizabeth',
    name: 'Elizabeth',
    role: 'Head of finance',
    animal: 'owl',
    cron: '0 17 * * 2',
    scheduleHuman: 'Tue · 10am PT',
    branchPrefix: 'finance/',
    reportsVia: 'AgentMail + finance desk',
  },
  {
    slug: 'bob',
    name: 'Bob',
    role: 'Weekly retro',
    animal: 'tortoise',
    cron: '0 16 * * 1',
    scheduleHuman: 'Mon · 9am PT',
    branchPrefix: 'retro/',
    reportsVia: 'Playbook/docs PRs',
  },
  {
    slug: 'marcus',
    name: 'Marcus',
    role: 'Strategy desk',
    animal: 'eagle',
    cron: '0 15 * * 0',
    scheduleHuman: 'Sun · 8am PT',
    branchPrefix: 'strategy/',
    reportsVia: 'Draft PRs + Linear',
  },
]
