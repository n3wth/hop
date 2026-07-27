'use server'

import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getUserId } from '@/lib/session'

// Setting a password on an already-Google-signed-in user is NOT Better Auth's
// social-provider linkAccount flow — it's a direct write of a new
// `credential`-provider `account` row via the server-only setPassword API.
// Better Auth itself refuses (PASSWORD_ALREADY_SET) if one already exists;
// use authClient.changePassword client-side for that case instead (it needs
// the current password, which a Google-only user doesn't have).
export async function setAccountPassword(
  newPassword: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const userId = await getUserId()
  if (!userId) return { ok: false, reason: 'not signed in' }
  try {
    await auth.api.setPassword({ body: { newPassword }, headers: await headers() })
    return { ok: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'could not set password'
    return { ok: false, reason: message }
  }
}
