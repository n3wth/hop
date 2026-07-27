'use client'

import { useEffect } from 'react'
import { bootAnalytics, identifyUser } from '@/lib/posthog-client'

export interface PostHogBootProps {
  /** Better Auth user.id (opaque) — identifies this browser's events when the
      visitor is signed in. Omit on signed-out surfaces. */
  userId?: string
}

// Mounts PostHog: the root layout renders it bare (init + pageviews on every
// page), and AppShell renders it again with the session's userId so signed-in
// browsing is identified. Both are idempotent — init happens once per load.
// Renders nothing; no-ops entirely without NEXT_PUBLIC_POSTHOG_KEY.
export default function PostHogBoot({ userId }: PostHogBootProps) {
  useEffect(() => {
    bootAnalytics()
    if (userId) identifyUser(userId)
  }, [userId])
  return null
}
