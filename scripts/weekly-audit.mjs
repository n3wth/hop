#!/usr/bin/env node
// Weekly Read-Only Invariant Audit (Self-Improvement Loop PR 4 / Phase 1.5)
//
// Performs a read-only audit of hop against standing invariants (engine, degradation,
// copy, nextjs16, security, memory).
// Skips cleanly when neither an API key nor federation is configured.
// Deduplicates findings against existing GitHub issues using label "auto-audit"
// and title convention "[hop:audit:<fingerprint>]".

import { execFileSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import Anthropic from '@anthropic-ai/sdk'

export function computeFingerprint(file, invariant, line) {
  const raw = `${file}:${invariant}:${line}`
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 10)
}

function parseArgs(argv) {
  const flags = { dryRun: true, fileIssues: false }
  for (const arg of argv) {
    if (arg === '--no-dry-run') flags.dryRun = false
    if (arg === '--file-issues') flags.fileIssues = true
    if (arg === '--dry-run') flags.dryRun = true
  }
  return flags
}

function gh(args) {
  try {
    return execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (err) {
    console.warn('[weekly-audit] gh command failed:', err.message)
    return null
  }
}

export function checkIssuesEnabled() {
  const output = gh(['repo', 'view', '--json', 'hasIssuesEnabled'])
  if (!output) return false
  try {
    const data = JSON.parse(output)
    return Boolean(data.hasIssuesEnabled)
  } catch {
    return false
  }
}

export function fetchOpenAuditIssues() {
  const output = gh(['issue', 'list', '--label', 'auto-audit', '--state', 'open', '--limit', '100', '--json', 'title,number'])
  if (!output) return []
  try {
    return JSON.parse(output)
  } catch {
    return []
  }
}

export function isFingerprintOpen(openIssues, fingerprint) {
  const tag = `[hop:audit:${fingerprint}]`
  return openIssues.some((issue) => issue.title && issue.title.includes(tag))
}

export const INVARIANT_RULES = [
  {
    key: 'engine',
    name: 'Economic calculations trace to lib/*',
    description: 'All cpp, miles, pricing, or valuation numbers must be computed by lib/* engines, never hardcoded in UI or prompt-generated.',
  },
  {
    key: 'degradation',
    name: 'Graceful degradation via withDb',
    description: 'Database operations must use withDb and fall back gracefully without throwing unhandled exceptions.',
  },
  {
    key: 'security',
    name: 'User isolation and credential safety',
    description: 'Queries filtering by user data must be scoped by user_id; secrets must be accessed via lib/env.ts.',
  },
  {
    key: 'nextjs16',
    name: 'Next.js 16 + React 19 conventions',
    description: 'Async params/searchParams in App Router, no deprecated caching idioms or pre-16 handler shapes.',
  },
]

export function sanitizeFilePath(filePath) {
  if (typeof filePath !== 'string') return ''
  const cleaned = filePath.trim().replace(/\\/g, '/')
  if (!/^[a-zA-Z0-9_\-\.\/]+\.[a-zA-Z0-9]+$/.test(cleaned)) return ''
  if (cleaned.includes('..')) return ''
  return cleaned.slice(0, 150)
}

export function sanitizeTitleText(str) {
  if (typeof str !== 'string') return ''
  return str.replace(/[\r\n\t\`]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100)
}

export function sanitizeMarkdownBody(str) {
  if (typeof str !== 'string') return ''
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 2000)
}

function sanitizeSeverity(sev) {
  if (typeof sev === 'string' && ['P1', 'P2', 'P3'].includes(sev.toUpperCase())) {
    return sev.toUpperCase()
  }
  return 'P3'
}

function sanitizeLine(line) {
  const parsed = parseInt(line, 10)
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 10000 ? parsed : 1
}

export async function runAuditWithAnthropic(apiKey) {
  const client = new Anthropic(apiKey ? { apiKey } : {})
  const findings = []
  let auditedFiles = 0

  // Sample key files for audit
  const sampleFiles = [
    'app/mcp/route.ts',
    'app/pricing/page.tsx',
    'lib/cpp.ts',
    'lib/env.ts',
    'lib/supabase-helpers.ts',
    'lib/health-checks.ts',
  ]

  const model = process.env.ANTHROPIC_MODEL || 'claude-3-7-sonnet-20250219'

  for (const fileRel of sampleFiles) {
    const fullPath = path.resolve(process.cwd(), fileRel)
    if (!fs.existsSync(fullPath)) continue
    const content = fs.readFileSync(fullPath, 'utf8')

    const prompt = `You are performing an invariant audit on the codebase file '${fileRel}'.
Rules to verify:
1. Economic calculations (cpp, points, pricing) must trace to lib/* engines and never be hardcoded or computed in UI/prompts.
2. DB queries must be wrapped in withDb and degrade gracefully.
3. Security/Auth: User-specific queries must be scoped to user_id.
4. Next.js 16 App Router: params and searchParams are Promises and must be awaited.

File content:
\`\`\`
${content.slice(0, 4000)}
\`\`\`

If you find ANY clear violation of these rules, return a JSON object with:
{"findings": [{"file": "${fileRel}", "line": 1, "severity": "P1"|"P2"|"P3", "invariant": "name of invariant", "scenario": "concrete description of defect"}]}
If no violations are found, return {"findings": []}.
Return ONLY valid JSON.`

    try {
      const res = await client.messages.create({
        model,
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      })
      auditedFiles += 1
      const text = res.content[0]?.type === 'text' ? res.content[0].text : ''
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        if (Array.isArray(parsed.findings)) {
          for (const rawF of parsed.findings) {
            const file = sanitizeFilePath(rawF.file) || fileRel
            const line = sanitizeLine(rawF.line)
            const severity = sanitizeSeverity(rawF.severity)
            const invariant = sanitizeTitleText(rawF.invariant) || 'invariant'
            const scenario = sanitizeMarkdownBody(rawF.scenario) || 'Unspecified scenario'

            const fingerprint = computeFingerprint(file, invariant, line)
            findings.push({ file, line, severity, invariant, scenario, fingerprint })
          }
        }
      }
    } catch (err) {
      console.warn(`[weekly-audit] Failed audit for ${fileRel}:`, err.message)
    }
  }

  if (auditedFiles === 0) throw new Error('No files could be audited; check Claude authentication and API availability.')
  return findings
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey && !process.env.ANTHROPIC_FEDERATION_RULE_ID) {
    console.log('[weekly-audit] Claude credentials absent. Skipping weekly audit cleanly.')
    process.exit(0)
  }

  console.log('[weekly-audit] Running weekly invariant audit...')
  const findings = await runAuditWithAnthropic(apiKey)

  console.log(`[weekly-audit] Found ${findings.length} findings.`)

  const summary = {
    date: new Date().toISOString(),
    dryRun: args.dryRun,
    findingsCount: findings.length,
    findings,
  }

  console.log(JSON.stringify(summary, null, 2))

  if (args.dryRun) {
    console.log('[weekly-audit] Dry run active — no GitHub issues will be created.')
    return
  }

  if (args.fileIssues && findings.length > 0) {
    if (!checkIssuesEnabled()) {
      console.warn('[weekly-audit] GitHub Issues are disabled or unreachable for this repository. Cannot file issues.')
      return
    }

    const openIssues = fetchOpenAuditIssues()
    const filedInRun = new Set()

    for (const f of findings) {
      if (filedInRun.has(f.fingerprint) || isFingerprintOpen(openIssues, f.fingerprint)) {
        console.log(`[weekly-audit] Issue for fingerprint ${f.fingerprint} is already open or filed in this run. Skipping.`)
        continue
      }

      const title = `[hop:audit:${f.fingerprint}] ${f.severity}: ${f.invariant} in ${f.file}`
      const body = `## Invariant Audit Finding\n\n**File:** \`${f.file}:${f.line}\`\n**Severity:** ${f.severity}\n**Invariant:** ${f.invariant}\n\n### Scenario\n${f.scenario}\n\n---\n*Auto-generated by weekly audit workflow.*`

      console.log(`[weekly-audit] Creating issue: ${title}`)
      const res = gh(['issue', 'create', '--title', title, '--body', body, '--label', 'auto-audit'])
      if (res !== null) {
        filedInRun.add(f.fingerprint)
        openIssues.push({ title, number: -1 })
      } else {
        console.warn(`[weekly-audit] Issue creation failed for fingerprint ${f.fingerprint}`)
      }
    }
  }
}

if (process.argv[1] && process.argv[1].endsWith('weekly-audit.mjs')) {
  main().catch((err) => {
    console.error('[weekly-audit] Fatal error:', err)
    process.exit(1)
  })
}
