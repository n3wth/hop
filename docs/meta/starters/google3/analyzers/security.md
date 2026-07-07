# Analyzer checklist: security

Trigger: CLs touching `**/api/**`, `**/auth/**`, `**/rpc/**` service definitions, storage
access layers, or any file reading secrets/config.

Output: findings proto `{file, line, category: SECURITY, severity, claim, evidence}`.
Every finding faces the skeptic pass — cite the exact line and the violated rule.

## Checks

1. **Every storage read/write on user-owned data carries the authenticated principal's ID**
   from the request context — never from a request field the caller controls. → P1
2. **Handlers check authorization, not just authentication** — resource ownership or an
   ACL check, not merely a valid credential. → P1
3. **No credentials in code, logs, or error messages.** Hardcoded keys, tokens
   interpolated into logs, secrets in status messages returned to callers. → P1
4. **Untrusted input validated at the boundary** before use in queries, paths, or
   redirects; parametrized queries only. → P1 for injection paths, P2 otherwise.
5. **New RPC surfaces have an explicit access policy** — a service or method without a
   stated allowed-caller set → P2.
6. **Agent-reachable sinks stay narrow**: fields written by automated pipelines are
   allowlisted and typed (no free text into surfaces later fed to an LLM — prompt-injection
   at the write, not the read). → P2

## Severity rubric

P1 = exploitable or data exposure; P2 = defense-in-depth gap; P3 = hygiene.
