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
const routeTokenUiHarness = process.env.ROUTE_TOKEN_UI_LIVE === '1'
/** `scripts/e2e/run-with-functions-emulator.mjs` 또는 firebase-tools 가 Functions host 를 주입할 때 */
const useFunctionsEmulatorBundle =
  process.env.RTW_E2E_WITH_FUNCTIONS === '1' ||
  Boolean(process.env.FIREBASE_FUNCTIONS_EMULATOR_HOST?.trim())
if (underEmulator) {
  process.env.RIDE_VERIFY_LIVE = '1'
}

// emulator 모드 vite 는 기본 5002(vite.config.ts). Functions 포함 e2e 와 맞춘다.
const DEV_PORT = Number(
  process.env.RTW_DEV_PORT ??
    (underEmulator && useFunctionsEmulatorBundle ? 5002 : 5000),
)
const DEV_URL = `http://127.0.0.1:${DEV_PORT}`

export default defineConfig({
  testDir: './e2e',
  outputDir: routeTokenUiHarness
    ? 'scripts/route-token/.out/playwright-test-results'
    : 'test-results',
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
    command: routeTokenUiHarness
      ? 'npm run dev:localhost -- --mode harness'
      : underEmulator && useFunctionsEmulatorBundle
        ? 'npm run dev:localhost -- --mode emulator'
        : 'npm run dev:localhost',
    url: DEV_URL,
    // Functions 포함 e2e 는 --mode emulator → apps/web/.env.emulator(VITE_* host 포함).
    // Auth·Firestore 만 쓰는 e2e(peer-sync 등)는 VITE_USE_EMULATOR 만 넘긴다.
    env: underEmulator
      ? {
          ...(useFunctionsEmulatorBundle
            ? { RTW_DEV_PORT: String(DEV_PORT) }
            : { VITE_USE_EMULATOR: '1' }),
          ...(routeTokenUiHarness ? { VITE_DIRECTIONS_DIRECT: '0' } : {}),
        }
      : {},
    // 에뮬레이터 실행 시엔 기존 dev 서버(실 Firebase 에 붙은)를 재사용하면 안 된다 —
    // 반드시 VITE_USE_EMULATOR 를 켠 새 서버를 띄운다. 일반 e2e 는 기존 서버 재사용 허용.
    reuseExistingServer: underEmulator || routeTokenUiHarness ? false : !process.env.CI,
    timeout: 120_000,
  },
})
