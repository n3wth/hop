// Live data layer for the admin Team view's "Drafts awaiting review" section
// (app/admin/team/page.tsx). Reads docs/marketing/drafts/<date>-slug.md —
// the growth desk's (Omar) ready-to-paste drafts for external channels he
// has no posting credentials for (docs/team/routines.md's Omar prompt, item
// 3; docs/marketing/README.md). NEVER throws: a missing directory, an
// unreadable file, or a file with no frontmatter all degrade to an empty
// list or best-effort defaults rather than crashing the page.
//
// No YAML dependency: the frontmatter this desk writes is flat `key: value`
// pairs, so a few lines of parsing beat pulling in gray-matter for a shape
// this simple.

import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

const DRAFTS_DIR = path.join(process.cwd(), 'docs/marketing/drafts')
const GITHUB_REPO = 'n3wth/hop'
const FILENAME_PATTERN = /^(\d{4}-\d{2}-\d{2})-(.+)\.md$/

export interface MarketingDraft {
  slug: string
  filename: string
  /** YYYY-MM-DD from the filename prefix, or null if the filename doesn't match the convention. */
  date: string | null
  title: string
  channel: string
  status: string
  /** Blob URL on GitHub — no token needed, it's a link for the (already-authenticated) owner's browser. */
  githubUrl: string
}

function parseFrontmatter(raw: string): Record<string, string> {
  const data: Record<string, string> = {}
  if (!raw.startsWith('---')) return data
  const end = raw.indexOf('\n---', 3)
  if (end === -1) return data
  for (const line of raw.slice(3, end).split('\n')) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/)
    if (!match) continue
    let value = match[2].trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    data[match[1].trim()] = value
  }
  return data
}

async function readDraft(filename: string): Promise<MarketingDraft | null> {
  const match = filename.match(FILENAME_PATTERN)
  const slug = match ? match[2] : filename.replace(/\.md$/, '')
  try {
    const raw = await readFile(path.join(DRAFTS_DIR, filename), 'utf8')
    const data = parseFrontmatter(raw)
    return {
      slug,
      filename,
      date: match ? match[1] : null,
      title: data.title || slug.replace(/-/g, ' '),
      channel: data.channel || 'unknown',
      status: data.status || 'awaiting-approval',
      githubUrl: `https://github.com/${GITHUB_REPO}/blob/main/docs/marketing/drafts/${filename}`,
    }
  } catch {
    return null
  }
}

// Newest-first by filename (the YYYY-MM-DD prefix sorts lexicographically).
export async function listMarketingDrafts(): Promise<MarketingDraft[]> {
  let filenames: string[]
  try {
    filenames = (await readdir(DRAFTS_DIR)).filter((f) => f.endsWith('.md'))
  } catch {
    return []
  }
  const drafts = await Promise.all(filenames.map(readDraft))
  return drafts
    .filter((d): d is MarketingDraft => d !== null)
    .sort((a, b) => (a.filename < b.filename ? 1 : -1))
}
