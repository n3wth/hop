import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getOwnerSession } from '@/lib/owner'
import { getAdminUserDetail } from '@/lib/admin-users'
import UserDetail from '@/components/admin/UserDetail'

// Owner-only single-account profile. Every field is read through
// lib/admin-users.ts#getAdminUserDetail; this page adds no new queries.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'User',
  robots: { index: false, follow: false },
}

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  // notFound (not 403) so the route doesn't confirm it exists to non-owners.
  if (!(await getOwnerSession())) notFound()

  const { id } = await params
  const detail = await getAdminUserDetail(id)
  if (!detail) notFound()

  return <UserDetail detail={detail} />
}
