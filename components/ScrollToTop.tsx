'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

// Guarantee "new page = top of page" on client-side navigation.
//
// Next's App Router resets scroll on forward navigation, but once the app moved
// to <Link> client-nav (PR #62), surfaces with their own sticky/scroll context
// could leave the window parked where the previous page left it. This makes the
// reset certain: on every route change we jump the window back to the top.
//
// A hash navigation (/account#trips) is left alone so in-page anchors still land
// on their target instead of being yanked to the top.
export default function ScrollToTop() {
  const pathname = usePathname()

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.location.hash) return
    // 'instant' so it doesn't visibly race the new page's entrance motion.
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior })
  }, [pathname])

  return null
}
