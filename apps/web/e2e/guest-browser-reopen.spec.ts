import { test, expect } from './open-meteo-stub'
import { chromium, type BrowserContext } from '@playwright/test'
import { guestStart } from './rideEntryHelpers'
import { readGuestUid } from './readGuestUid'

test.skip(process.env.GUEST_BROWSER_REOPEN_LIVE !== '1', 'persistent demo browser test not requested')

test('종료 없이 실제 브라우저를 닫고 세 번 재실행해도 같은 Guest와 기록 유지', async ({ request }, testInfo) => {
  test.setTimeout(180_000)
  expect(process.env.VITE_FIREBASE_PROJECT_ID).toBe('demo-boxcycle-guest')
  const baseURL = String(testInfo.project.use.baseURL)
  const cfg = await request.get(`${baseURL}/src/lib/firebase/functionsEmulatorUrl.ts`)
  expect(/"VITE_FIREBASE_PROJECT_ID":\s*"demo-boxcycle-guest"/.test(await cfg.text())).toBe(true)
  const authURL = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/projects/demo-boxcycle-guest/accounts:batchGet'
  const count = async () => {
    let total = 0
    let token = ''
    do {
      const res = await request.get(authURL, {
        headers: { Authorization: 'Bearer owner' },
        params: { maxResults: '1000', ...(token ? { nextPageToken: token } : {}) },
      })
      expect(res.ok()).toBe(true)
      const body = await res.json()
      total += (body.users ?? []).length
      token = body.nextPageToken ?? ''
    } while (token)
    return total
  }
  const before = await count()
  const profile = testInfo.outputPath(`persistent-profile-${Date.now()}`)
  let uid = ''
  let signups = 0
  let context: BrowserContext | undefined
  try {
    for (let round = 0; round < 4; round++) {
      // A real new Chromium process reads its on-disk profile. No storageState export/import.
      context = await chromium.launchPersistentContext(profile, {
        headless: true, viewport: { width: 800, height: 360 },
      })
      await context.route('**/api.open-meteo.com/**', route => route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ elevation: [42], current: { temperature_2m: 14, weather_code: 0, is_day: 1, wind_speed_10m: 6 } }),
      }))
      context.on('request', r => { if (r.url().includes('accounts:signUp')) signups++ })
      const page = context.pages()[0] ?? await context.newPage()
      await page.goto(baseURL)
      if (round === 0) {
        await guestStart(page)
        uid = await readGuestUid(page)
        await page.evaluate(() => localStorage.setItem('guest-browser-reopen-fixture', 'retained'))
      } else {
        // Restoration must be automatic, without clicking Guest or service exit.
        await expect(page.getByRole('button', { name: '사용자 정보', exact: true })).toBeVisible({ timeout: 30_000 })
        expect(await readGuestUid(page) === uid, 'same UID after browser process restart').toBe(true)
        expect(await page.evaluate(() => localStorage.getItem('guest-browser-reopen-fixture'))).toBe('retained')
      }
      expect(await count() - before).toBe(1)
      await context.close()
      context = undefined
    }
    expect(signups).toBe(1)
  } finally {
    await context?.close()
  }
})
