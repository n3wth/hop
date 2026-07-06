#!/usr/bin/env node
// Fails loudly (non-zero exit) if drizzle/ has colliding migration sequence numbers.
//
// The recurring bug (docs/solutions/2026-07-05-parallel-migration-numbering.md): parallel
// worktrees/agents each run `npm run db:generate` against a base state that hasn't seen the
// other's migration yet, so drizzle-kit independently picks the same next sequence number in
// both. Whichever change lands second silently collides with (or overwrites) the first. This
// check exists so that collision is caught by `npm run check` before merge, instead of being
// discovered later by a broken migration run or a human noticing two PRs both touch "0008_*".
//
// Exports a pure `checkMigrationSequence(drizzleDir)` for unit testing (see
// lib/__tests__/migration-sequence-check.test.ts) and doubles as the CLI entry point wired into
// `npm run db:check-migrations` (called from `npm run check`).

import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const SQL_NAME_RE = /^(\d{4})_.+\.sql$/

export function checkMigrationSequence(drizzleDir) {
  const errors = []

  if (!existsSync(drizzleDir)) {
    // Nothing to check (e.g. a checkout that hasn't run db:generate yet) — not this check's job.
    return { ok: true, errors }
  }

  // 1. Duplicate sequence-number prefixes among migration .sql files — the actual collision.
  const sqlFiles = readdirSync(drizzleDir).filter((f) => SQL_NAME_RE.test(f))
  const byPrefix = new Map()
  for (const file of sqlFiles) {
    const [, prefix] = file.match(SQL_NAME_RE)
    if (!byPrefix.has(prefix)) byPrefix.set(prefix, [])
    byPrefix.get(prefix).push(file)
  }
  for (const [prefix, files] of byPrefix) {
    if (files.length > 1) {
      errors.push(
        `Duplicate migration sequence "${prefix}": ${files.sort().join(', ')} — regenerate ` +
          `with \`npm run db:generate\` after rebasing on the latest migration; never hand-edit ` +
          `a sequence number (docs/solutions/2026-07-05-parallel-migration-numbering.md).`,
      )
    }
  }

  // 2. Duplicate idx values in drizzle/meta/_journal.json — drizzle-kit's own bookkeeping of
  // sequence order must stay internally consistent, independent of what .sql files exist.
  const journalPath = join(drizzleDir, 'meta', '_journal.json')
  let journal
  if (existsSync(journalPath)) {
    try {
      journal = JSON.parse(readFileSync(journalPath, 'utf8'))
    } catch (err) {
      errors.push(`drizzle/meta/_journal.json is not valid JSON: ${err.message}`)
    }
  }

  if (journal && Array.isArray(journal.entries)) {
    const byIdx = new Map()
    for (const entry of journal.entries) {
      if (!byIdx.has(entry.idx)) byIdx.set(entry.idx, [])
      byIdx.get(entry.idx).push(entry.tag)
    }
    for (const [idx, tags] of byIdx) {
      if (tags.length > 1) {
        errors.push(
          `Duplicate journal idx ${idx} in drizzle/meta/_journal.json: ${tags.join(', ')} — ` +
            `two entries claim the same sequence position.`,
        )
      }
    }

    // 3. Cross-check .sql files against journal entries. A botched collision "resolution" can
    // leave one file but two journal entries pointing at it, or a journal entry for a tag whose
    // file got deleted/renamed — same failure mode (internal inconsistency), so worth catching
    // here rather than waiting for `drizzle-kit migrate` to fail confusingly at deploy time.
    const journalTags = new Set(journal.entries.map((e) => e.tag))
    const sqlTags = new Set(sqlFiles.map((f) => f.replace(/\.sql$/, '')))
    for (const tag of journalTags) {
      if (!sqlTags.has(tag)) {
        errors.push(`_journal.json references "${tag}" but drizzle/${tag}.sql does not exist.`)
      }
    }
    for (const tag of sqlTags) {
      if (!journalTags.has(tag)) {
        errors.push(`drizzle/${tag}.sql exists but has no entry in drizzle/meta/_journal.json.`)
      }
    }
  }

  return { ok: errors.length === 0, errors }
}

function main() {
  const drizzleDir = process.argv[2] ? join(process.cwd(), process.argv[2]) : join(process.cwd(), 'drizzle')
  const { ok, errors } = checkMigrationSequence(drizzleDir)
  if (!ok) {
    console.error('\n[check-migration-sequence] FAILED — migration sequence collision detected:\n')
    for (const e of errors) console.error(`  - ${e}`)
    console.error(
      '\nSee docs/solutions/2026-07-05-parallel-migration-numbering.md. Regenerate the ' +
        'migration (npm run db:generate) after rebasing — never hand-edit a sequence number.\n',
    )
    process.exitCode = 1
    return
  }
  console.log('[check-migration-sequence] OK — no migration sequence collisions')
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
