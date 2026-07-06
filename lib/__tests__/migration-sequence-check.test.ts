import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { checkMigrationSequence } from '../../scripts/check-migration-sequence.mjs'

// Guards task #28 (docs/solutions/2026-07-05-parallel-migration-numbering.md): parallel
// worktrees generating migrations against slightly different base states have repeatedly
// produced two drizzle/ files with the same sequence prefix (e.g. two 0008_*.sql). These tests
// prove the mechanical check catches that class of collision on synthetic fixtures — never the
// real drizzle/ directory — and still passes cleanly against the real one.

describe('checkMigrationSequence', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    let dir
    while ((dir = tempDirs.pop())) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  function fixture(files: Record<string, string>) {
    const dir = mkdtempSync(join(tmpdir(), 'migration-check-'))
    tempDirs.push(dir)
    mkdirSync(join(dir, 'meta'), { recursive: true })
    for (const [name, content] of Object.entries(files)) {
      writeFileSync(join(dir, name), content)
    }
    return dir
  }

  it('passes on the real repo drizzle/ directory', () => {
    const { ok, errors } = checkMigrationSequence(join(process.cwd(), 'drizzle'))
    expect(errors).toEqual([])
    expect(ok).toBe(true)
  })

  it('passes on a clean synthetic fixture', () => {
    const dir = fixture({
      '0001_first.sql': '-- first\n',
      '0002_second.sql': '-- second\n',
      'meta/_journal.json': JSON.stringify({
        version: '7',
        dialect: 'postgresql',
        entries: [
          { idx: 0, version: '7', when: 1, tag: '0001_first', breakpoints: true },
          { idx: 1, version: '7', when: 2, tag: '0002_second', breakpoints: true },
        ],
      }),
    })
    const { ok, errors } = checkMigrationSequence(dir)
    expect(errors).toEqual([])
    expect(ok).toBe(true)
  })

  it('detects two migration files sharing the same sequence prefix', () => {
    const dir = fixture({
      '0008_smiling_vin_gonzales.sql': '-- original\n',
      '0008_another_collision.sql': '-- landed independently in a different worktree\n',
      'meta/_journal.json': JSON.stringify({
        version: '7',
        dialect: 'postgresql',
        entries: [{ idx: 8, version: '7', when: 1, tag: '0008_smiling_vin_gonzales', breakpoints: true }],
      }),
    })
    const { ok, errors } = checkMigrationSequence(dir)
    expect(ok).toBe(false)
    expect(errors.some((e) => e.includes('Duplicate migration sequence "0008"'))).toBe(true)
  })

  it('detects a duplicate idx in drizzle/meta/_journal.json', () => {
    const dir = fixture({
      '0001_first.sql': '-- first\n',
      '0002_second.sql': '-- second\n',
      'meta/_journal.json': JSON.stringify({
        version: '7',
        dialect: 'postgresql',
        entries: [
          { idx: 0, version: '7', when: 1, tag: '0001_first', breakpoints: true },
          { idx: 0, version: '7', when: 2, tag: '0002_second', breakpoints: true },
        ],
      }),
    })
    const { ok, errors } = checkMigrationSequence(dir)
    expect(ok).toBe(false)
    expect(errors.some((e) => e.includes('Duplicate journal idx 0'))).toBe(true)
  })

  it('detects a journal entry with no matching .sql file', () => {
    const dir = fixture({
      '0001_first.sql': '-- first\n',
      'meta/_journal.json': JSON.stringify({
        version: '7',
        dialect: 'postgresql',
        entries: [
          { idx: 0, version: '7', when: 1, tag: '0001_first', breakpoints: true },
          { idx: 1, version: '7', when: 2, tag: '0002_missing_file', breakpoints: true },
        ],
      }),
    })
    const { ok, errors } = checkMigrationSequence(dir)
    expect(ok).toBe(false)
    expect(errors.some((e) => e.includes('0002_missing_file'))).toBe(true)
  })

  it('returns ok when the drizzle directory does not exist at all', () => {
    const { ok, errors } = checkMigrationSequence(join(tmpdir(), 'definitely-does-not-exist-xyz'))
    expect(ok).toBe(true)
    expect(errors).toEqual([])
  })
})
