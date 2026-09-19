import { test as base, expect, type Browser, type BrowserContext } from '@playwright/test'

/**
 * 전역 Open-Meteo 스텁 (`RIDE-ELEVATION-QUOTA-1`).
 *
 * 문제: 경로를 설정하는 스펙은 매 실행마다 실제 Open-Meteo 고도 API 를 때린다.
 *       `ROUTE_ELEVATION_SAMPLE_COUNT = 72` 이므로 **주행 테스트 1회 = 72 콜**이고,
 *       2026-09-18 하루치 반복 실행으로 일일 한도를 태워 429 가 떨어졌다.
 *       그 결과 주행 화면에 「고도 데이터를 불러오지 못했습니다」만 남아 코드 회귀로 오인됐다.
 *
 * 해결: 모든 스펙이 `@playwright/test` 대신 이 파일의 `test` 를 import 한다.
 *       auto 픽스처가 고도·forecast 를 합성 응답으로 가로채므로 실 API 를 전혀 쓰지 않는다.
 *
 * 우선순위: Playwright 는 **나중에 등록된 라우트가 이긴다.** 등록 순서는
 *       ① 차단용 catch-all → ② forecast → ③ elevation 이고,
 *       스펙이 `test` 본문에서 직접 거는 스텁(예: hud-distance-elevation-shots 의 시나리오
 *       곡선)은 픽스처보다 **나중**에 등록되므로 전역 스텁을 덮는다. 시나리오 스텁은 그대로 산다.
 *
 * 축퇴 방어: ①의 catch-all 이 「스텁이 못 잡은 open-meteo 요청」을 실 네트워크로 내보내지 않고
 *       차단하면서 URL 을 기록하고, 픽스처 teardown 이 기록이 비었는지 **모든 스펙에서** 확인한다.
 *       스텁이 조용히 안 걸려도 초록으로 통과하는 일을 막는다.
 */

const OPEN_METEO_ANY = /^https:\/\/api\.open-meteo\.com\//
const OPEN_METEO_FORECAST = /^https:\/\/api\.open-meteo\.com\/v1\/forecast/
const OPEN_METEO_ELEVATION = /^https:\/\/api\.open-meteo\.com\/v1\/elevation/

export type OpenMeteoStubReport = {
  /** 전역 스텁이 응답한 고도 요청 수 */
  elevationCalls: number
  /** 전역 스텁이 응답한 forecast 요청 수 */
  forecastCalls: number
  /** 어떤 스텁도 잡지 못해 **차단된** 요청 URL — 비어 있지 않으면 실 API 로 나갈 뻔한 것이다 */
  escaped: string[]
}

/**
 * 요청 좌표 개수만큼 합성 표고를 만든다. 완만한 언덕 한 개 + 약한 상승 추세 —
 * 값이 전부 같으면(축퇴) 차트가 평평해져 「그려졌다」는 판정이 무의미해지므로 일부러 변화를 준다.
 */
export function syntheticElevations(count: number): number[] {
  const n = Math.max(1, count)
  return Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0 : i / (n - 1)
    return Number((42 + 18 * Math.sin(t * Math.PI * 1.5) + 6 * t).toFixed(1))
  })
}

/** `latitude=a,b,c` 의 콤마 개수로 요청 좌표 수를 센다(단일 지점 질의는 1). */
export function countRequestedCoords(url: string): number {
  const lat = new URL(url).searchParams.get('latitude') ?? ''
  return lat.length > 0 ? lat.split(',').length : 2
}

const JSON_HEADERS = {
  'content-type': 'application/json',
  // 교차 출처 fetch 이므로 fulfill 응답에도 CORS 허용 헤더를 실어 준다.
  'access-control-allow-origin': '*',
}

async function installOpenMeteoStub(context: BrowserContext, report: OpenMeteoStubReport) {
  // ① 마지막 방어선 — 아래 스텁이 못 잡은 open-meteo 요청은 실 API 로 내보내지 않는다.
  await context.route(OPEN_METEO_ANY, async (route) => {
    report.escaped.push(route.request().url())
    await route.abort()
  })

  // ② forecast — 고도 API 와 **같은 일일 한도를 공유**한다(openMeteoWeather.ts).
  await context.route(OPEN_METEO_FORECAST, async (route) => {
    report.forecastCalls += 1
    await route.fulfill({
      status: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify({
        current: { temperature_2m: 14, weather_code: 0, is_day: 1, wind_speed_10m: 6 },
      }),
    })
  })

  // ③ elevation — fetchRouteElevations.ts(72점) · MapView 의 단일 지점 질의 양쪽을 덮는다.
  await context.route(OPEN_METEO_ELEVATION, async (route) => {
    report.elevationCalls += 1
    await route.fulfill({
      status: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify({ elevation: syntheticElevations(countRequestedCoords(route.request().url())) }),
    })
  })
}

export const test = base.extend<{ openMeteo: OpenMeteoStubReport }>({
  openMeteo: [
    async ({ context, browser }, use) => {
      const report: OpenMeteoStubReport = { elevationCalls: 0, forecastCalls: 0, escaped: [] }
      await installOpenMeteoStub(context, report)

      // peer-sync 등 14개 스펙은 `browser.newContext()` 로 두 번째 주행자를 띄운다.
      // 기본 context 만 덮으면 그쪽이 실 API 를 때리므로 생성 지점을 감싼다.
      const originalNewContext: Browser['newContext'] = browser.newContext.bind(browser)
      const originalNewPage: Browser['newPage'] = browser.newPage.bind(browser)
      browser.newContext = (async (options) => {
        const created = await originalNewContext(options)
        await installOpenMeteoStub(created, report)
        return created
      }) as Browser['newContext']
      browser.newPage = (async (options) => {
        const created = await originalNewPage(options)
        await installOpenMeteoStub(created.context(), report)
        return created
      }) as Browser['newPage']

      await use(report)

      browser.newContext = originalNewContext
      browser.newPage = originalNewPage

      expect(
        report.escaped,
        '스텁이 잡지 못한 Open-Meteo 요청이 있다 — 실 API 일일 한도를 태울 수 있다',
      ).toEqual([])
    },
    { auto: true },
  ],
})

export { expect }
export type { Browser, BrowserContext, Locator, Page } from '@playwright/test'
