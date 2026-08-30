import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getOwnerSession } from '@/lib/owner'
import { listAdminUsers, ADMIN_USERS_PAGE_SIZE } from '@/lib/admin-users'
import UsersTable from '@/components/admin/UsersTable'

// Owner-only account directory — search + paginate registered users. Every
// row is read through lib/admin-users.ts; this page adds no new queries.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Users',
  robots: { index: false, follow: false },
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  // notFound (not 403) so the route doesn't confirm it exists to non-owners.
  if (!(await getOwnerSession())) notFound()

  const sp = await searchParams
  const search = typeof sp.q === 'string' ? sp.q : ''
  const pageParam = typeof sp.page === 'string' ? parseInt(sp.page, 10) : 1
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1

  const result = await listAdminUsers({ search, page })

  return (
    <UsersTable
      users={result?.users ?? null}
      total={result?.total ?? 0}
      page={page}
      pageSize={ADMIN_USERS_PAGE_SIZE}
      search={search}
    />
  )
}
