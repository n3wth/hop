# Restore production deployments

The latest main deployment was canceled by the ignored-build command before
building. Vercel reports a production target but the gate treats every value
other than `production`, including missing context, as permission to skip.

Always build `main`; skip only explicit `preview` environments on other branches.
Verify production, preview, and
missing environment values with the actual configured shell command. Run the
repository checks, merge through the normal PR path, and verify a production
deployment and its public URL. Preserve unrelated local edits.
