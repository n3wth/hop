#!/usr/bin/env node
// Mechanical merge predicate (pattern-library doc 05).
// Usage: node scripts/merge-gate.mjs <branch> [--base main]
// Prints AUTO or HOLD with reasons; exits 1 on HOLD. Checks the *path tier* and the
// kill switch. CI-green and reviews-clear are enforced by branch protection; this
// script is the part branch protection can't express.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// Hold list: never auto-merged. TODO(project): tune to your repo. Keep the
// self-referential entries — agents must not merge changes to the gate itself.
const HOLD = [
  /^\.github\/workflows\//,        // CI is the merge gate
  /^scripts\/merge-gate\.mjs$/,    // this file
  /^docs\/autonomy-runbook\.md$/,  // the policy + kill switch
  /^package(-lock)?\.json$/,       // dependencies (supply chain)
  /^drizzle\//, /schema\.ts$/,     // migrations + schema
  /^middleware\.ts$/, /^vercel\.json$/,
  /^app\/api\/auth\//, /^lib\/auth/, /^lib\/session/,   // identity
  /^app\/api\/(billing|webhooks)\//, /^lib\/(stripe|billing)/, // money
  /^\.env/,
];

const branch = process.argv[2];
if (!branch) { console.error('usage: merge-gate.mjs <branch> [--base main]'); process.exit(2); }
const base = process.argv.includes('--base') ? process.argv[process.argv.indexOf('--base') + 1] : 'main';

const runbook = readFileSync('docs/autonomy-runbook.md', 'utf8');
const killSwitch = /^Auto-merge:\s*on\b/m.test(runbook);

const files = execSync(`git diff --name-only origin/${base}...origin/${branch}`, { encoding: 'utf8' })
  .split('\n').filter(Boolean);

const held = files.filter((f) => HOLD.some((re) => re.test(f)));

if (!killSwitch) {
  console.log('HOLD: Auto-merge is off in docs/autonomy-runbook.md');
  process.exit(1);
}
if (held.length) {
  // A partially-held PR is entirely held.
  console.log(`HOLD: ${held.length} path(s) on the hold list:`);
  for (const f of held) console.log(`  ${f}`);
  process.exit(1);
}
console.log(`AUTO: ${files.length} changed path(s), all auto-tier.`);
console.log('Remaining conditions (enforced elsewhere): CI green on head; zero unresolved review threads; diff within the item\'s written scope.');
