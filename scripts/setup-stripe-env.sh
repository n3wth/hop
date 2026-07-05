#!/usr/bin/env bash
# ------------------------------------------------------------
# setup-stripe-env.sh
#   • Configures Stripe CLI (login if needed)
#   • Retrieves webhook secret, secret key, publishable key
#   • Writes a local .env.local (git‑ignored) for next dev
#   • Pushes the three values to Vercel (production)
# ------------------------------------------------------------
set -euo pipefail

# ---------- 1️⃣ Ensure Stripe CLI is logged in ----------
if ! stripe whoami &>/dev/null; then
    echo "🔐 Logging into Stripe CLI…"
    stripe login
fi

# ---------- 2️⃣ Get webhook signing secret ----------
echo "🔎 Starting Stripe listener to obtain webhook signing secret…"
# The listener prints the secret and exits; we capture it.
WEBHOOK_SECRET=$(stripe listen \
    --forward-to localhost:3000/api/webhooks/stripe \
    --print-secret 2>/dev/null)

# ---------- 3️⃣ Pull secret & publishable keys from Stripe CLI ----------
SECRET_KEY=$(stripe config --list | grep "test_mode_api_key" | cut -d "=" -f 2 | tr -d " '\"")
PUBLISHABLE_KEY=$(stripe config --list | grep "test_mode_pub_key" | cut -d "=" -f 2 | tr -d " '\"")

# ---------- 4️⃣ Write local .env.local (git‑ignored) ----------
# Remove existing STRIPE_* lines from .env.local to avoid duplicates
touch .env.local
grep -v "^STRIPE_" .env.local > .env.local.tmp || true
mv .env.local.tmp .env.local

# Append new values
cat >> .env.local <<ENVFILE
STRIPE_SECRET_KEY=$SECRET_KEY
STRIPE_PUBLISHABLE_KEY=$PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET=$WEBHOOK_SECRET
ENVFILE
echo "📝 Local .env.local updated (git‑ignored)."

# ---------- 5️⃣ Push to Vercel (production) ----------
echo "⚙️  Setting Vercel production environment variables…"
# Each `vercel env add` reads the value from stdin (hidden, no echo)
vercel env add STRIPE_SECRET_KEY production --force --yes <<< "$SECRET_KEY"
vercel env add STRIPE_PUBLISHABLE_KEY production --force --yes <<< "$PUBLISHABLE_KEY"
vercel env add STRIPE_WEBHOOK_SECRET production --force --yes <<< "$WEBHOOK_SECRET"

echo "✅ All done!"
echo "   • Stored securely in Vercel (production)"
echo "   • Available locally in .env.local for development"
echo "⚠️  Never share or commit these values."
