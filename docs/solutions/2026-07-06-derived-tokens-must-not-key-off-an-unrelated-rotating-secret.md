---
title: "An unsubscribe link silently dies the next time an unrelated secret rotates"
date: 2026-07-06
tags: [newsletter, secrets, hmac, tokens, rotation, silent-failure]
files: [lib/newsletter.ts, lib/env.ts]
status: solved
---

**What happened:**
The newsletter's unsubscribe link embeds a token derived from the subscriber's email, so the
weekly digest cron can regenerate the same link deterministically without storing a separate
random value per send. That derivation (`deriveUnsubscribeToken()`) used an HMAC keyed directly on
`resolveAuthSecret()` — the same secret Better Auth uses to sign session cookies. That secret has
its own reason to rotate (session-key hygiene) that has nothing to do with the newsletter. The
moment someone rotated it, every unsubscribe link already sitting in a subscriber's inbox would
hash to a different value than the one the database expected, and the unsubscribe handler only
checked "did the query error" rather than "did a row actually match" — so a hash mismatch quietly
looked identical to a successful unsubscribe. A subscriber clicking an old link would land on the
"you're unsubscribed" page while remaining subscribed.

**Why it matters:**
Two features that happen to share a secret are coupled whether anyone intended it or not — rotating
one for reasons that have nothing to do with the other silently breaks the other. The failure is
especially dangerous here because it's invisible from both ends: the subscriber sees a success
page, and the update just quietly affects zero rows instead of raising an error a monitor could
catch.

**The rule going forward:**
Any token an external party will hold onto across a secret rotation needs its *own* dedicated
secret, not a reused one from an unrelated subsystem — `NEWSLETTER_UNSUBSCRIBE_SECRET`
(`lib/env.ts#resolveNewsletterUnsubscribeSecret`) now exists for exactly this, falling back to the
auth-secret chain only when unset so nothing breaks without new config. Separately: any handler
that does a lookup-then-update should check the *affected-row count*, not just the absence of a
query error — a zero-row update is not success, and treating it as one hides the exact class of bug
this was.

**Evidence:** pull request #266 (see also pull request #264, which first moved these tokens from
plaintext storage to a hash, and `docs/solutions/2026-07-05-paired-secret-rotation.md` for the
related but distinct problem of a secret mirrored into two separate places going out of sync).
