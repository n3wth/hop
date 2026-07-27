#!/usr/bin/env bash
# Wires Better Auth + Google OAuth into a worktree's .env.local for local sign-in.
# Fixture-only worktrees (MOCK=1, no DATABASE_URL) can't persist sessions — run this
# when a task needs /account, /admin, or any persisted auth state.
#
# Safe to re-run: only fills keys that are missing or empty; never overwrites real values.
# Usage (from inside a worktree):
#   scripts/setup-worktree-auth.sh
#   HOP_DEV_PORT=3001 scripts/setup-worktree-auth.sh
set -euo pipefail

cd "$(dirname "$0")/.."

PORT="${HOP_DEV_PORT:-3000}"
ORIGIN="http://localhost:${PORT}"

if [ ! -f .env.local ]; then
  cat > .env.local <<EOF
# Created by scripts/setup-worktree-auth.sh
MOCK=1
EOF
fi

merge_env_key() {
  local key="$1"
  local value="$2"
  KEY="$key" VALUE="$value" node <<'NODE'
const fs = require('fs')
const key = process.env.KEY
const value = process.env.VALUE
if (!key || value == null) process.exit(0)
const path = '.env.local'
const lines = fs.existsSync(path) ? fs.readFileSync(path, 'utf8').split('\n') : []
const parse = (line) => {
  const i = line.indexOf('=')
  if (i < 1) return null
  let v = line.slice(i + 1)
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  return { key: line.slice(0, i), value: v }
}
const existing = lines.find((l) => parse(l)?.key === key)
if (existing) {
  const cur = parse(existing)?.value ?? ''
  if (cur && cur !== '""' && cur !== "''") process.exit(0)
  const next = lines.filter((l) => parse(l)?.key !== key)
  next.push(`${key}=${JSON.stringify(value)}`)
  fs.writeFileSync(path, next.join('\n').replace(/\n*$/, '\n'))
} else {
  fs.appendFileSync(path, `${key}=${JSON.stringify(value)}\n`)
}
NODE
}

export KEY=BETTER_AUTH_URL
export VALUE="$ORIGIN"
merge_env_key "$KEY" "$VALUE"
export KEY=APP_BASE_URL
export VALUE="$ORIGIN"
merge_env_key "$KEY" "$VALUE"
export KEY=NEXT_PUBLIC_SITE_URL
export VALUE="$ORIGIN"
merge_env_key "$KEY" "$VALUE"

# Secrets from 1Password (item: Hop Local Dev in Private vault).
OP_VAULT="${HOP_OP_VAULT:-Private}"
OP_ITEM="${HOP_OP_ENV_ITEM:-Hop Local Dev}"
if command -v op >/dev/null 2>&1; then
  for key in DATABASE_URL GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET GOOGLE_ID GOOGLE_SECRET BETTER_AUTH_SECRET AUTH_SECRET HOP_OWNER_EMAIL MOCK; do
    val=$(op read "op://${OP_VAULT}/${OP_ITEM}/env/${key}" 2>/dev/null || true)
    if [ -n "$val" ]; then
      merge_env_key "$key" "$val"
    fi
  done
fi

# Google OAuth — fall back to a prior vercel pull in this worktree.
  if [ -f "$src" ]; then
    for key in GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET GOOGLE_ID GOOGLE_SECRET BETTER_AUTH_SECRET AUTH_SECRET; do
      line=$(grep -E "^${key}=" "$src" 2>/dev/null | head -1 || true)
      if [ -z "$line" ]; then continue; fi
      val="${line#*=}"
      val="${val%\"}"
      val="${val#\"}"
      if [ -n "$val" ] && [ "$val" != '""' ]; then
        export KEY="$key"
        export VALUE="$val"
        merge_env_key "$KEY" "$VALUE"
      fi
    done
  fi
done

# Neon — only when DATABASE_URL is still empty and neonctl is available.
if command -v neonctl >/dev/null 2>&1; then
  current_db=$(node -e "
const fs=require('fs');
const line=(fs.readFileSync('.env.local','utf8').split('\n').find(l=>l.startsWith('DATABASE_URL='))||'');
let v=line.slice('DATABASE_URL='.length);
if((v.startsWith('\"')&&v.endsWith('\"'))||(v.startsWith(\"'\")&&v.endsWith(\"'\"))) v=v.slice(1,-1);
process.stdout.write(v);
")
  if [ -z "$current_db" ] || [ "$current_db" = '""' ]; then
    project_id=$(neonctl projects list --output json 2>/dev/null | node -e "
let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
  try {
    const parsed=JSON.parse(d);
    const rows=Array.isArray(parsed)?parsed:(parsed.projects||[]);
    const hop=rows.find(p=>/hop/i.test(p.name||''))||rows.find(p=>p.name==='n3wth')||rows[0];
    if(hop?.id) process.stdout.write(hop.id);
  } catch {}
});
" || true)
    if [ -n "$project_id" ]; then
      db_url=$(neonctl connection-string --project-id "$project_id" --branch production --role-name neondb_owner --pooled 2>/dev/null | tail -1 || true)
      if [ -n "$db_url" ] && [[ "$db_url" == postgres* ]]; then
        export KEY=DATABASE_URL
        export VALUE="$db_url"
        merge_env_key "$KEY" "$VALUE"
        echo "setup-worktree-auth: set DATABASE_URL from Neon (project $project_id)."
      fi
    fi
  fi
fi

# Better Auth needs the Drizzle schema (verification, session, user, …). A fresh
# Neon branch or first-time local wiring won't have those tables until migrate runs.
if node -e "
const fs=require('fs');
const line=(fs.readFileSync('.env.local','utf8').split('\n').find(l=>l.startsWith('DATABASE_URL='))||'');
let v=line.slice('DATABASE_URL='.length);
if((v.startsWith('\"')&&v.endsWith('\"'))||(v.startsWith(\"'\")&&v.endsWith(\"'\"))) v=v.slice(1,-1);
process.exit(v?0:1);
" 2>/dev/null; then
  if npm run db:migrate >/dev/null 2>&1; then
    echo "setup-worktree-auth: applied Drizzle migrations (Better Auth tables)."
  else
    echo "setup-worktree-auth: warning — db:migrate failed; sign-in may 500 until schema exists." >&2
  fi
fi

echo "setup-worktree-auth: ready at $ORIGIN — sign in at /login?returnTo=/admin (owner email: ${HOP_OWNER_EMAIL:-oliver@newth.ai})."
echo ""
echo "setup-worktree-auth: Google OAuth must allow this redirect URI (one-time, in Cloud Console):"
echo "  ${ORIGIN}/api/auth/callback/google"
echo "  Credentials → your Web client → Authorized redirect URIs (+ JavaScript origin ${ORIGIN})"
echo "  Error 400 redirect_uri_mismatch means that URI is missing."
echo "setup-worktree-auth: restart \`npm run dev\` if it was already running."
