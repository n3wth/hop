import { describe, expect, it } from 'vitest'
import {
  computeFingerprint,
  isFingerprintOpen,
  sanitizeFilePath,
  sanitizeMarkdownBody,
  sanitizeTitleText,
} from '../../scripts/weekly-audit.mjs'

describe('weekly-audit helpers', () => {
  it('computes deterministic 10-char hex fingerprint', () => {
    const fp1 = computeFingerprint('lib/cpp.ts', 'engine', 42)
    const fp2 = computeFingerprint('lib/cpp.ts', 'engine', 42)
    const fp3 = computeFingerprint('lib/cpp.ts', 'engine', 43)

    expect(fp1).toHaveLength(10)
    expect(fp1).toBe(fp2)
    expect(fp1).not.toBe(fp3)
  })

  it('detects if fingerprint issue is already open', () => {
    const openIssues = [
      { number: 101, title: '[hop:audit:a1b2c3d4e5] P1: engine in lib/cpp.ts' },
      { number: 102, title: '[hop:audit:f6g7h8i9j0] P3: degradation in lib/env.ts' },
    ]

    expect(isFingerprintOpen(openIssues, 'a1b2c3d4e5')).toBe(true)
    expect(isFingerprintOpen(openIssues, 'f6g7h8i9j0')).toBe(true)
    expect(isFingerprintOpen(openIssues, '9999999999')).toBe(false)
  })

  it('sanitizes file paths strictly', () => {
    expect(sanitizeFilePath('lib/cpp.ts')).toBe('lib/cpp.ts')
    expect(sanitizeFilePath('app/mcp/route.ts')).toBe('app/mcp/route.ts')
    expect(sanitizeFilePath('../etc/passwd')).toBe('')
    expect(sanitizeFilePath('<script>alert(1)</script>.ts')).toBe('')
    expect(sanitizeFilePath('lib/env.ts\nother')).toBe('')
  })

  it('sanitizes title text strictly', () => {
    expect(sanitizeTitleText('Engine calculations')).toBe('Engine calculations')
    expect(sanitizeTitleText('Title\nWith\r\nNewlines`and`backticks')).toBe('Title With Newlines and backticks')
  })

  it('sanitizes markdown body', () => {
    expect(sanitizeMarkdownBody('Clean scenario')).toBe('Clean scenario')
    expect(sanitizeMarkdownBody('Scenario <script>alert("hack")</script> test')).toBe('Scenario test')
  })
})
