import { test, expect } from './open-meteo-stub'

/**
 * 전역 Open-Meteo 스텁 자체의 검산 (`RIDE-ELEVATION-QUOTA-1` 축퇴 방어).
 *
 * 「스텁을 깔았다」는 사실만으로는 아무것도 보장하지 못한다 — 스텁이 조용히 안 걸려도
 * 나머지 스펙은 초록으로 통과한다(실 API 를 때리면서). 그래서 여기서 직접 확인한다:
 *   ① 고도·forecast 요청이 실제로 가로채진다
 *   ② 스펙이 직접 건 스텁이 전역 스텁을 **이긴다**(hud 시나리오 곡선이 무력화되지 않는다)
 *   ③ 스텁이 못 잡는 open-meteo 경로는 실 네트워크로 나가지 않고 **차단**된다
 *   ④ 스펙이 따로 만든 context(peer 주행자)도 덮인다
 */

const ELEVATION_URL =
  'https://api.open-meteo.com/v1/elevation?latitude=37.5665,37.5666&longitude=126.9780,126.9781'
const FORECAST_URL =
  'https://api.open-meteo.com/v1/forecast?latitude=37.5665&longitude=126.9780&current=temperature_2m'

async function fetchJson(page: { evaluate: (fn: (u: string) => Promise<unknown>, arg: string) => Promise<unknown> }, url: string) {
  return page.evaluate(async (u: string) => {
    const res = await fetch(u)
    return res.json()
  }, url)
}

test('① 고도·forecast 요청이 전역 스텁에 가로채진다', async ({ page, openMeteo }) => {
  await page.goto('/')

  const elevation = (await fetchJson(page, ELEVATION_URL)) as { elevation: number[] }
  expect(elevation.elevation).toHaveLength(2)
  expect(openMeteo.elevationCalls).toBeGreaterThan(0)

  const forecast = (await fetchJson(page, FORECAST_URL)) as { current?: { temperature_2m?: number } }
  expect(forecast.current?.temperature_2m).toBe(14)
  expect(openMeteo.forecastCalls).toBeGreaterThan(0)

  // 축퇴 방어: 합성 표고가 전부 같은 값이면 차트가 그려져도 의미가 없다.
  const many = (await fetchJson(
    page,
    `https://api.open-meteo.com/v1/elevation?latitude=${Array(72).fill('37.5').join(',')}&longitude=${Array(72).fill('127.0').join(',')}`,
  )) as { elevation: number[] }
  expect(many.elevation).toHaveLength(72)
  expect(new Set(many.elevation).size).toBeGreaterThan(10)
})

test('② 스펙이 직접 건 스텁이 전역 스텁을 이긴다', async ({ page }) => {
  await page.goto('/')

  await page.route(/^https:\/\/api\.open-meteo\.com\/v1\/elevation/, async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
      body: JSON.stringify({ elevation: [111, 222] }),
    })
  })

  const elevation = (await fetchJson(page, ELEVATION_URL)) as { elevation: number[] }
  expect(elevation.elevation).toEqual([111, 222])
})

test('③ 스텁이 못 잡는 open-meteo 경로는 차단된다', async ({ page, openMeteo }) => {
  await page.goto('/')

  const outcome = await page.evaluate(async () => {
    try {
      await fetch('https://api.open-meteo.com/v1/air-quality?latitude=37.5&longitude=127.0')
      return 'reached-network'
    } catch {
      return 'blocked'
    }
  })

  expect(outcome).toBe('blocked')
  expect(openMeteo.escaped).toHaveLength(1)
  // 이 스펙은 차단을 **일부러** 유발한다. 픽스처 teardown 의 「escaped 는 비어야 한다」
  // 전역 검사에 걸리지 않도록 기록을 비운다.
  openMeteo.escaped.length = 0
})

test('④ 스펙이 따로 만든 context 도 덮인다', async ({ browser, openMeteo }) => {
  const before = openMeteo.elevationCalls
  const context = await browser.newContext()
  try {
    const page = await context.newPage()
    await page.goto('/')
    const elevation = (await fetchJson(page, ELEVATION_URL)) as { elevation: number[] }
    expect(elevation.elevation).toHaveLength(2)
    expect(openMeteo.elevationCalls).toBeGreaterThan(before)
  } finally {
    await context.close()
  }
})
