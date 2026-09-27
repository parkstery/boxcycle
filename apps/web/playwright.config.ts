import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'
import { loadEnv } from 'vite'
import { resolveDevPort } from './devPort'

const webRoot = path.dirname(fileURLToPath(import.meta.url))

/** `.env.emulator` 의 fake Mapbox 토큰 대신 `.env` 실토큰을 dev 서버에 주입(ride-entry 콘솔 회귀 방지) */
function resolveEmulatorMapboxToken(): string | undefined {
  const modeEnv = loadEnv('emulator', webRoot, 'VITE_')
  const baseEnv = loadEnv('', webRoot, 'VITE_')
  const fromMode = modeEnv.VITE_MAPBOX_ACCESS_TOKEN?.trim()
  const fromBase = baseEnv.VITE_MAPBOX_ACCESS_TOKEN?.trim()
  if (fromMode && !fromMode.includes('fake-token-for-emulator')) return fromMode
  if (fromBase?.startsWith('pk.')) return fromBase
  return fromMode || fromBase
}

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

// 포트 값은 ./devPort 가 소유한다 — vite.config.ts 와 같은 표를 본다.
// 「에뮬레이터인가」의 판단만 여기 것이다: Functions 번들까지 쓰는 e2e 여야 5002 를 쓴다.
//
// ⚠️ 2026-09-27 — **값을 공유해도 판단이 갈리면 그대로 깨진다.** 여기서는 「Functions 번들을
// 쓰는가」로 보고, vite 는 `mode === "emulator"` 로 본다. 그래서 Functions 없는 에뮬레이터
// e2e(동행 12종 전부)는 **vite 가 5002, playwright 가 5000** 을 봤다. 증상은 원인을 전혀
// 말해 주지 않는다 — `Timed out waiting 120000ms from config.webServer` 한 줄뿐이다.
//
// 그래서 **아래 webServer.env 가 RTW_DEV_PORT 를 언제나 주입한다.** 그러면 판단이 갈려도
// vite 는 playwright 가 정한 포트를 그대로 쓴다(`resolveDevPort` 에서 RTW_DEV_PORT 가 이긴다).
// 값을 공유하는 것만으로는 부족하고, **한쪽이 정하고 다른 쪽이 따르게** 해야 한다.
const DEV_PORT = resolveDevPort(underEmulator && useFunctionsEmulatorBundle)
const DEV_URL = `http://127.0.0.1:${DEV_PORT}`
const emulatorMapboxToken = underEmulator ? resolveEmulatorMapboxToken() : undefined

/** Outer attempt budget is enforced by scripts/e2e/run-with-deadline.mjs (default 600s). */
const e2eGlobalTimeoutMs = Number(process.env.RTW_E2E_PLAYWRIGHT_GLOBAL_MS || 560_000)

export default defineConfig({
  testDir: './e2e',
  outputDir: routeTokenUiHarness
    ? 'scripts/route-token/.out/playwright-test-results'
    : 'test-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // RTW-PLAYWRIGHT-LIMIT-20260910-01: no auto-retry budget reset; single worker.
  retries: 0,
  workers: 1,
  globalTimeout: e2eGlobalTimeoutMs,
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
      : underEmulator
        ? 'npm run dev:localhost -- --mode emulator'
        : 'npm run dev:localhost',
    url: DEV_URL,
    // Codex-04 Unit ③: emulator 모드는 항상 --mode emulator 로 .env.emulator 로드
    // (Firebase config 없으면 GuestEntryCard 렌더링 안 됨)
    env: {
      // 언제나 넘긴다 — 위 ⚠️ 참고. 빠지면 vite 가 제 나름대로 포트를 고른다.
      RTW_DEV_PORT: String(DEV_PORT),
      ...(underEmulator
        ? {
            ...(routeTokenUiHarness ? { VITE_DIRECTIONS_DIRECT: '0' } : {}),
            ...(emulatorMapboxToken ? { VITE_MAPBOX_ACCESS_TOKEN: emulatorMapboxToken } : {}),
          }
        : {}),
    },
    // 에뮬레이터 실행 시엔 기존 dev 서버(실 Firebase 에 붙은)를 재사용하면 안 된다 —
    // 반드시 VITE_USE_EMULATOR 를 켠 새 서버를 띄운다. 일반 e2e 는 기존 서버 재사용 허용.
    reuseExistingServer: underEmulator || routeTokenUiHarness ? false : !process.env.CI,
    timeout: 120_000,
  },
})
