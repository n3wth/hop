---
title: Local Google sign-in fails with redirect_uri_mismatch
date: 2026-07-05
tags: [auth, google-oauth, local-dev, worktree, better-auth]
files: [scripts/setup-worktree-auth.sh, lib/auth.ts, .env.example]
status: solved
---

## Problem

Google sign-in on `http://localhost:3000` fails with **Error 400: redirect_uri_mismatch**
after Better Auth and the DB schema are wired. The app POSTs to `/api/auth/sign-in/social`
fine; Google blocks the redirect because the OAuth client doesn't list localhost.

Better Auth sends:

`http://localhost:3000/api/auth/callback/google`

(from `BETTER_AUTH_URL` + `/api/auth/callback/google` — see `lib/auth.ts`).

## Root cause

Production OAuth clients usually register only `https://hop.flights/...` (and preview
domains). Localhost is a different origin and must be added explicitly to the **same**
Web client (`GOOGLE_CLIENT_ID` in `.env.local`) or to a dedicated dev client.

## Solution

In [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials),
open the Web OAuth client matching `GOOGLE_CLIENT_ID`, then add:

**Authorized redirect URIs**

- `http://localhost:3000/api/auth/callback/google`
- `http://localhost:3001/api/auth/callback/google` (optional — second worktree / port drift)

**Authorized JavaScript origins**

- `http://localhost:3000`
- `http://localhost:3001` (optional)

Save; wait ~1 minute; retry sign-in. `scripts/setup-worktree-auth.sh` prints the exact
URI for the port you're using (`HOP_DEV_PORT`).

## Not the fix

- Running `db:migrate` — fixes missing `verification` table (500 before Google), not 400.
- Changing `trustedOrigins` in `lib/auth.ts` — Better Auth origin check, not Google's.
- Pointing `BETTER_AUTH_URL` at production — callback cookies land on prod, not localhost.
