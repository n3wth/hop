-- hop-valuations D1 schema (version-controlled for wrangler d1 migrations).
-- This schema is ALREADY LIVE on the "hop-valuations" D1 database
-- (database_id d26989d0-b0e1-42bc-87ba-859424f6f5b9) — this file documents it
-- for version control; it is not expected to be re-applied.

CREATE TABLE IF NOT EXISTS observations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  program_id TEXT NOT NULL,
  cpp REAL NOT NULL,
  cash_cents INTEGER,
  miles INTEGER,
  -- The DEFAULT below is never actually hit: src/index.ts always binds
  -- observed_at explicitly as an ISO-8601 UTC string (new Date().toISOString())
  -- so it stays string-comparable against the aggregation cutoff, which is also
  -- an ISO string. datetime('now') is space-separated ("YYYY-MM-DD HH:MM:SS"),
  -- not ISO — keep any future ad-hoc INSERT from relying on it.
  observed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_observations_program_observed
  ON observations (program_id, observed_at);

CREATE TABLE IF NOT EXISTS valuation_snapshot (
  program_id TEXT PRIMARY KEY,
  cpp REAL NOT NULL,
  sample_size INTEGER NOT NULL,
  prev_cpp REAL,
  as_of TEXT NOT NULL
);
