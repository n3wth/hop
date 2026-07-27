import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts', 'app/**/*.test.ts'],
    // Tests must be hermetic: never let a configured environment leak a real
    // database (or auth secrets) into the suite — the graceful-degradation
    // tests assert the UNCONFIGURED paths and would otherwise write real rows.
    env: {
      DATABASE_URL: '',
      DATABASE_URL_UNPOOLED: '',
      BETTER_AUTH_SECRET: '',
      AUTH_SECRET: '',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      // Next's bundler aliases the 'server-only' marker package to a no-op
      // automatically; vitest doesn't, and the real package's index.js throws
      // unconditionally when imported. See lib/test-stubs/server-only.ts.
      'server-only': path.resolve(__dirname, 'lib/test-stubs/server-only.ts'),
    },
  },
})
