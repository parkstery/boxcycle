import { defineConfig, devices } from '@playwright/test'

// RTW E2E 설정. `npm run test:e2e -w boxcycle-web` 로 실행한다.
// dev 서버(vite, 포트 5000)를 자동 기동/종료하므로 별도 서버를 미리 띄울 필요 없다.
//
// ride-entry(실주행 진입) spec 은 Firebase 에뮬레이터가 필요하다. `npm run test:e2e:ride` 는
// `firebase emulators:exec` 로 이 프로세스를 감싸며, 그때 firebase-tools 가 자식 프로세스에
// FIRESTORE_EMULATOR_HOST 같은 env 를 주입한다. 그 존재를 신호로 삼아:
//   - RIDE_VERIFY_LIVE=1 을 켜서 ride-entry spec 의 skip 을 해제하고,
//   - vite dev 서버에 VITE_USE_EMULATOR=1 을 넘겨 앱이 에뮬레이터에 붙게 한다.
// 이렇게 하면 cross-env 나 수동 플래그 없이 에뮬레이터 컨텍스트를 자동 감지한다.
const underEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST)
if (underEmulator) {
  process.env.RIDE_VERIFY_LIVE = '1'
}

// 다른 worktree 의 dev 서버가 5000 을 잡고 있으면 `RTW_DEV_PORT=5001 npm run test:e2e:ride`.
// vite.config.ts 가 같은 env 를 읽으므로 둘이 어긋나지 않는다.
const DEV_PORT = Number(process.env.RTW_DEV_PORT ?? 5000)
const DEV_URL = `http://127.0.0.1:${DEV_PORT}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['line'], ['html', { open: 'never' }]],
  use: {
    baseURL: DEV_URL,
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
    url: DEV_URL,
    // 에뮬레이터 컨텍스트에서만 vite 에 플래그를 넘겨 앱이 에뮬레이터에 붙게 한다.
    // (일반 test:e2e 는 이 env 없이 돌아 실 Firebase 설정을 그대로 쓴다 — smoke 는 Firebase 불필요)
    env: underEmulator ? { VITE_USE_EMULATOR: '1' } : {},
    // 에뮬레이터 실행 시엔 기존 dev 서버(실 Firebase 에 붙은)를 재사용하면 안 된다 —
    // 반드시 VITE_USE_EMULATOR 를 켠 새 서버를 띄운다. 일반 e2e 는 기존 서버 재사용 허용.
    reuseExistingServer: underEmulator ? false : !process.env.CI,
    timeout: 120_000,
  },
})
