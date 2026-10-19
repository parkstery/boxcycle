import { test, expect } from './open-meteo-stub'
import { guestStart } from './rideEntryHelpers'

// Opt-in: real local Auth/Firestore/HTTP handlers and real Mapbox road data.
// Run against the demo --serve runner, never the production project.
test.skip(process.env.GUEST_DEMO_ROUTE_LIVE !== '1', 'demo route server not requested')
test.beforeAll(async ({ request }) => {
  expect(process.env.VITE_FIREBASE_PROJECT_ID).toBe('demo-boxcycle-guest')
  for (const key of ['FIREBASE_AUTH_EMULATOR_HOST', 'FIRESTORE_EMULATOR_HOST', 'FIREBASE_DATABASE_EMULATOR_HOST']) {
    expect(/^(localhost|127\.0\.0\.1):\d+$/.test(process.env[key] ?? '')).toBe(true)
  }
  const config = await request.get('/src/lib/firebase/functionsEmulatorUrl.ts')
  expect(config.ok()).toBe(true)
  // Inspect only the project/emu flags; never print the module's other env values.
  const source = await config.text()
  expect(/"VITE_FIREBASE_PROJECT_ID":\s*"demo-boxcycle-guest"/.test(source)).toBe(true)
  expect(/"VITE_USE_EMULATOR":\s*"1"/.test(source)).toBe(true)
})

for (const km of [2, 3, 5, 10]) {
  test(`첫 Ready Ride ${km} km 클릭으로 실제 경로 생성`, async ({ page }, testInfo) => {
    test.setTimeout(150_000)
    await page.setViewportSize({ width: 800, height: 360 })
    await page.addInitScript(() => {
      localStorage.setItem('rtw.localFirst.region', JSON.stringify({
        name: '단구동', lngLat: [127.9386, 37.3215], zoom: 13,
        source: 'search', at: '2026-10-19T00:00:00.000Z',
      }))
    })
    await page.goto('/')
    await guestStart(page)
    const card = page.locator('.local-first__card')
    await expect(card).toBeVisible()
    const response = page.waitForResponse(r => r.request().method() === 'POST' &&
      r.url().endsWith('/getDistanceAutoRoute') &&
      r.request().postDataJSON()?.data?.targetDistanceMeters === km * 1000,
    { timeout: 120_000 })
    await card.getByRole('button', { name: `${km} km`, exact: true }).click()
    const result = await response
    expect(result.status()).toBe(200)
    const json = await result.json()
    expect(json.result?.status).toBe('found')
    expect(json.result?.targetDistanceMeters).toBe(km * 1000)
    expect(json.result?.geometry?.type).toBe('LineString')
    expect(json.result.geometry.coordinates.length).toBeGreaterThan(2)
    expect(json.result.distance).toBeGreaterThan(0)
    await expect(page.getByRole('button', { name: '주행 시작', exact: true })).toBeVisible({ timeout: 20_000 })
    await expect(card.getByRole('button', { name: '다른 경로', exact: true })).toBeVisible()
    await expect(card.locator('.local-first__fail')).toHaveCount(0)
    console.log(JSON.stringify({ targetKm: km, routeMeters: Math.round(json.result.distance), status: json.result.status }))
    await page.screenshot({ path: testInfo.outputPath(`ready-ride-${km}km.png`) })
  })
}
