import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const { ignoreCommand } = JSON.parse(readFileSync('vercel.json', 'utf8'));

describe('Vercel ignored build step', () => {
  it.each(['production', '', 'development'])('builds when VERCEL_ENV is %j', (value) => {
    const result = spawnSync('sh', ['-c', ignoreCommand], {
      env: { ...process.env, VERCEL_ENV: value, VERCEL_GIT_COMMIT_REF: 'feature' },
    });
    expect(result.status).toBe(1);
  });

  it('never skips the production branch even with preview environment context', () => {
    expect(spawnSync('sh', ['-c', ignoreCommand], {
      env: { ...process.env, VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'main' },
    }).status).toBe(1);
  });

  it('skips explicit preview deployments', () => {
    expect(() => execFileSync('sh', ['-c', ignoreCommand], {
      env: { ...process.env, VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'feature' },
    })).not.toThrow();
  });
});
