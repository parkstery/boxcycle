import { defineConfig } from '@playwright/test'
import { fileURLToPath } from 'node:url'

// The demo --serve runner must already be running. No second server is started.
export default defineConfig({
  testDir: fileURLToPath(new URL('../../e2e/', import.meta.url)),
  testMatch: 'guest-demo-ready-ride.spec.ts',
  outputDir: fileURLToPath(new URL('../../../../.out/guest-demo-ready-ride/', import.meta.url)),
  workers: 1,
  retries: 0,
  timeout: 150_000,
  globalTimeout: 300_000,
  reporter: 'line',
  use: { baseURL: 'http://127.0.0.1:5004', headless: true },
})
