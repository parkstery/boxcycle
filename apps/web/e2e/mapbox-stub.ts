import type { Page } from '@playwright/test'

/**
 * Approach B — Mapbox 외부 의존성 격리.
 *
 * 문제: `.env.emulator` 의 fake pk(pk.fake-token-for-emulator-testing)로는
 *       `https://api.mapbox.com/styles/**` 요청이 401/403 으로 실패해
 *       `map.on('load')` 가 발화되지 않는다 → `mapLoaded=false`
 *       → `.map-view__resume-marker` 렌더링 안 됨 → C1·C13 실패.
 *
 * 해결: Playwright `page.route()` 로 Mapbox 스타일 URL 을 가로채고
 *       최소 유효 Mapbox GL style v8 JSON 을 반환해 `map.on('load')` 를 발화시킨다.
 *       Auth / Firestore / Functions 에뮬레이터 요청은 건드리지 않는다.
 *
 * 사용: `page.goto()` / `page.reload()` **이전** 에 호출해야 한다.
 *       `test.beforeEach` 에서 한 번 설정하면 같은 page 의 모든 탐색에 적용된다.
 */

/** Mapbox GL JS v8 style spec 최소 요건: version · sources · layers */
const MINIMAL_MAPBOX_STYLE = JSON.stringify({
  version: 8,
  name: 'e2e-stub',
  sources: {},
  layers: [],
})

export async function stubMapboxStyle(page: Page): Promise<void> {
  // ── 1. 스타일 JSON (map.on('load') 의 핵심 요청) ──────────────────────────
  await page.route('https://api.mapbox.com/styles/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: MINIMAL_MAPBOX_STYLE,
    }),
  )

  // ── 2. 텔레메트리 / 이벤트 (CORS 오류·콘솔 노이즈 방지) ──────────────────
  await page.route('https://events.mapbox.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  )
}
