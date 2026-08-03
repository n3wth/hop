import Link from 'next/link'
import type { AdminUserRow } from '@/lib/admin-users'
import AdminPageHeader, { AdminPageShell } from '@/components/admin/AdminPageHeader'

interface Props {
  /** null = the db read failed (unavailable); [] = genuinely no matches. */
  users: AdminUserRow[] | null
  total: number
  page: number
  pageSize: number
  search: string
}

// /admin/users — the owner-only account directory: search + paginate the
// Better Auth user table, each row showing tier and program count. Read-only
// list; a plain GET form for search keeps it working with JS disabled.
// Mirrors AdminDashboard/OpsPanel's flat-editorial internal-tool style.
export default function UsersTable({ users, total, page, pageSize, search }: Props) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Users"
        description={users === null ? 'Directory unavailable.' : `${total} registered`}
        crumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Users' },
        ]}
        actions={
          <form action="/admin/users" method="get" className="flex items-center gap-2">
            <input
              type="search"
              name="q"
              defaultValue={search}
              placeholder="Search name or email"
              className="no-inner-ring w-56 rounded-full border border-border bg-paper px-3.5 py-2 text-[13px] text-text placeholder:text-text3 focus:border-brand focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-full border border-border bg-surface px-3.5 py-2 text-[13px] font-semibold text-text2 transition-colors hover:bg-sunk"
            >
              Search
            </button>
          </form>
        }
      />

      <div className="mt-8">
        {users === null ? (
          <Empty>Couldn&apos;t load the user directory — try again shortly.</Empty>
        ) : users.length === 0 ? (
          <Empty>{search ? `No users match "${search}".` : 'No registered users yet.'}</Empty>
        ) : (
          <div className="flex flex-col gap-2">
            {users.map((u) => (
              <Link
                key={u.id}
                href={`/admin/users/${u.id}`}
                className="flex flex-col gap-1 rounded-[var(--radius-sm)] border border-border bg-paper px-3.5 py-3 transition-colors hover:bg-sunk sm:flex-row sm:items-center sm:justify-between sm:gap-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-[13.5px] font-semibold text-text">
                    {u.name || u.email}
                  </div>
                  <div className="truncate text-[12px] text-text3">{u.email}</div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-3 text-[12px] text-text3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[var(--track-eyebrow)] ${
                      u.tier === 'premium' ? 'bg-good-bg text-good' : 'bg-sunk text-text3'
                    }`}
                  >
                    {u.tier}
                  </span>
                  <span>{u.balancesCount} program{u.balancesCount === 1 ? '' : 's'}</span>
                  <span>joined {fmtDate(u.createdAt)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {users !== null && pageCount > 1 ? (
        <div className="mt-6 flex items-center justify-between gap-3">
          <PageLink page={page - 1} search={search} disabled={page <= 1}>
            ← Previous
          </PageLink>
          <span className="text-[12px] text-text3">
            Page {page} of {pageCount}
          </span>
          <PageLink page={page + 1} search={search} disabled={page >= pageCount}>
            Next →
          </PageLink>
        </div>
      ) : null}
    </AdminPageShell>
  )
}

function PageLink({
  page,
  search,
  disabled,
  children,
}: {
  page: number
  search: string
  disabled: boolean
  children: string
}) {
  if (disabled) {
    return <span className="text-[13px] font-medium text-text3/50">{children}</span>
  }
  const params = new URLSearchParams()
  if (search) params.set('q', search)
  params.set('page', String(page))
  return (
    <Link
      href={`/admin/users?${params.toString()}`}
      className="text-[13px] font-semibold text-text2 transition-colors hover:text-text"
    >
      {children}
    </Link>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[14px] border border-dashed border-border bg-paper/50 px-4 py-6 text-center text-[13px] text-text3">
      {children}
    </div>
  )
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return ''
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
