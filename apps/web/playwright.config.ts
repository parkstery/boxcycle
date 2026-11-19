import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'
import { loadEnv } from 'vite'
import { resolveDevPort } from './devPort'
import { isolatedWebEnvironment } from './e2eIsolation'

const webRoot = path.dirname(fileURLToPath(import.meta.url))
// Fail before importing specs, including specs with Node/Admin SDK setup.
const isolatedEnv = isolatedWebEnvironment(process.env)

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
// 래퍼가 Firebase 에뮬레이터를 실행하고, 별도 Vite(기본 5002)를 자동 기동/종료한다.
// 위의 격리 검증이 통과한 뒤에만 주행 진입 spec을 활성화한다.
const routeTokenUiHarness = process.env.ROUTE_TOKEN_UI_LIVE === '1'
process.env.RIDE_VERIFY_LIVE = '1'

// 포트 값은 ./devPort 가 소유한다 — vite.config.ts 와 같은 표를 본다.
// 시험은 항상 격리된 서버를 띄운다. 기본 5002, RTW_DEV_PORT로 별도 포트 지정 가능.
//
// ⚠️ 2026-09-27 — **값을 공유해도 판단이 갈리면 그대로 깨진다.** 여기서는 「Functions 번들을
// 쓰는가」로 보고, vite 는 `mode === "emulator"` 로 본다. 그래서 Functions 없는 에뮬레이터
// e2e(동행 12종 전부)는 **vite 가 5002, playwright 가 5000** 을 봤다. 증상은 원인을 전혀
// 말해 주지 않는다 — `Timed out waiting 120000ms from config.webServer` 한 줄뿐이다.
//
// 그래서 **아래 webServer.env 가 RTW_DEV_PORT 를 언제나 주입한다.** 그러면 판단이 갈려도
// vite 는 playwright 가 정한 포트를 그대로 쓴다(`resolveDevPort` 에서 RTW_DEV_PORT 가 이긴다).
// 값을 공유하는 것만으로는 부족하고, **한쪽이 정하고 다른 쪽이 따르게** 해야 한다.
const DEV_PORT = resolveDevPort(true)
const DEV_URL = `http://127.0.0.1:${DEV_PORT}`
const emulatorMapboxToken = resolveEmulatorMapboxToken()

/** Outer attempt budget is enforced by scripts/e2e/run-with-deadline.mjs (default 600s). */
const e2eGlobalTimeoutMs = Number(process.env.RTW_E2E_PLAYWRIGHT_GLOBAL_MS || 560_000)

export default defineConfig({
  globalSetup: './e2eIsolation.ts',
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
      : 'npm run dev:localhost -- --mode emulator',
    url: DEV_URL,
    // Codex-04 Unit ③: emulator 모드는 항상 --mode emulator 로 .env.emulator 로드
    // (Firebase config 없으면 GuestEntryCard 렌더링 안 됨)
    env: {
      ...isolatedEnv,
      // 언제나 넘긴다 — 위 ⚠️ 참고. 빠지면 vite 가 제 나름대로 포트를 고른다.
      RTW_DEV_PORT: String(DEV_PORT),
      ...(routeTokenUiHarness ? { VITE_DIRECTIONS_DIRECT: '0' } : {}),
      ...(emulatorMapboxToken ? { VITE_MAPBOX_ACCESS_TOKEN: emulatorMapboxToken } : {}),
    },
    // 기존 dev 서버는 운영 Firebase에 붙었을 수 있으므로 어떤 시험도 재사용하지 않는다.
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
