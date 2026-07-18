import { defineConfig, devices } from '@playwright/test'

// RTW E2E 설정. `npm run test:e2e -w boxcycle-web` 로 실행한다.
// dev 서버(vite, 포트 5000)를 자동 기동/종료하므로 별도 서버를 미리 띄울 필요 없다.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://127.0.0.1:5000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev:localhost',
    url: 'http://127.0.0.1:5000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
