// Plain (non-'use client', no engine imports) home for constants the content
// candidate pipeline shares with client components. Server modules
// (lib/sweet-spot-candidates.ts, which is 'server-only') and Client Components
// (components/admin/ContentConsole.tsx) must both import FROM HERE — mirrors
// lib/origin-constants.ts's split. A client component importing a value
// straight out of a 'server-only' module either breaks the build or drags the
// whole engine graph (assembleSearch, upstream clients) into the client
// bundle; this file has zero imports so it's safe on either side.

// Sentinel for hop_sweet_spot_drafts.created_by on every row the content
// candidate pipeline creates — never an owner email. ContentConsole reads this
// to badge auto-sourced cards "Auto-found".
export const CONTENT_CANDIDATES_CREATED_BY = 'auto:content-candidates'
