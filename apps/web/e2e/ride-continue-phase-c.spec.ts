import { test, expect, type Page } from '@playwright/test'

/**
 * R1 단계 C — 자동 Route 3회 연속 루프.
 * 자동 Route → 주행 → 종료 → 시트 닫기 → 「이 지점에서 새 경로」×3
 */
const LIVE = process.env.RIDE_VERIFY_LIVE === '1'
const PROJECT_ID = 'boxcycle-dc2df'
const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080'
const DOCS_URL = `http://${EMULATOR_HOST}/v1/projects/${PROJECT_ID}/databases/(default)/documents`

const TARGET_KM = 5

async function enterAsGuest(page: Page) {
  await page.goto('/')
  const gate = page.getByRole('dialog', { name: '시작' })
  await expect(gate).toBeVisible()
  await gate.getByRole('button', { name: '시작', exact: true }).click()
  await expect(gate).toBeHidden()
}

async function prepareManualRideInput(page: Page) {
  await page.getByRole('button', { name: /케이던스 센서/ }).click()
  const sheet = page.getByRole('dialog', { name: '케이던스 센서' })
  await expect(sheet).toBeVisible()
  await sheet.getByRole('button', { name: '체험 속도로 준비' }).click()
  const speedInput = sheet.getByRole('spinbutton', { name: '속도 km/h' })
  if (await speedInput.count()) {
    await speedInput.fill('50')
    await speedInput.blur()
  }
  await sheet.getByRole('button', { name: '센서 설정 닫기' }).click()
  await expect(sheet).toBeHidden()
}

async function clickMap(page: Page, offsetX: number, offsetY: number) {
  const canvas = page.locator('canvas.mapboxgl-canvas').first()
  await expect(canvas).toBeVisible({ timeout: 60_000 })
  const box = await canvas.boundingBox()
  if (!box) throw new Error('map canvas missing')
  await page.mouse.click(box.x + offsetX, box.y + offsetY)
  await page.waitForTimeout(400)
}

function pickSurface(page: Page) {
  return page.locator('.map-view__pick-dock-panel, .map-view__pick-popup').last()
}

async function parseTokenBalance(page: Page): Promise<number | null> {
  const holding = pickSurface(page).getByTestId('route-token-holding')
  if (!(await holding.isVisible().catch(() => false))) return null
  const text = (await holding.innerText()).trim()
  const m = text.match(/(\d+)\s*개/)
  return m ? Number(m[1]) : null
}

async function createAutoRouteFromMap(
  page: Page,
  targetKm = TARGET_KM,
  directionOffset: { x: number; y: number } = { x: 1100, y: 400 },
) {
  await clickMap(page, 420, 320)
  const popup = pickSurface(page)
  await expect(popup).toBeVisible({ timeout: 30_000 })
  await popup.getByRole('button', { name: 'Set start' }).evaluate((n) => n.click())
  await page.waitForTimeout(400)
  await popup.getByTestId('route-token-holding').waitFor({ state: 'visible', timeout: 30_000 })

  const modeCheckbox = popup.getByRole('checkbox', { name: '거리와 방향으로 Route 찾기' })
  await modeCheckbox.waitFor({ state: 'visible', timeout: 10_000 })
  if (!(await modeCheckbox.isChecked())) await modeCheckbox.check()

  const numberInput = popup.locator('.map-view__pick-distance-number')
  await numberInput.fill(String(targetKm))
  await numberInput.dispatchEvent('change')
  await page.waitForTimeout(300)

  await expect(
    popup.getByText(/도착하고 싶은 도로 위 지점을 클릭|방향을 클릭/),
  ).toBeVisible({ timeout: 30_000 })

  const autoRoutePromise = page.waitForResponse(
    (r) => r.request().method() === 'POST' && r.url().includes('getDistanceAutoRoute') && r.ok(),
    { timeout: 120_000 },
  )
  await clickMap(page, directionOffset.x, directionOffset.y)
  const resp = await autoRoutePromise
  const body = await resp.json()
  const result = body?.result ?? body
  await popup
    .locator('.map-view__pick-auto-route-status--found')
    .first()
    .waitFor({ state: 'visible', timeout: 120_000 })
  await page.waitForTimeout(400)
  return result as {
    start?: [number, number]
    end?: [number, number]
    distance?: number
    distanceMeters?: number
    outcome?: string
  }
}

async function pickDirectionOnArmedSession(
  page: Page,
  directionOffset: { x: number; y: number },
) {
  const popup = pickSurface(page)
  await expect(popup).toBeVisible({ timeout: 15_000 })
  await expect(
    popup.getByText(/도착하고 싶은 도로 위 지점을 클릭|방향을 클릭/),
  ).toBeVisible({ timeout: 15_000 })

  const autoRoutePromise = page.waitForResponse(
    (r) => r.request().method() === 'POST' && r.url().includes('getDistanceAutoRoute') && r.ok(),
    { timeout: 120_000 },
  )
  await clickMap(page, directionOffset.x, directionOffset.y)
  const resp = await autoRoutePromise
  const body = await resp.json()
  const result = body?.result ?? body
  await popup
    .locator('.map-view__pick-auto-route-status--found')
    .first()
    .waitFor({ state: 'visible', timeout: 120_000 })
  await page.waitForTimeout(400)
  return result as {
    start?: [number, number]
    end?: [number, number]
    distance?: number
    distanceMeters?: number
    outcome?: string
  }
}

async function closeRideSummary(page: Page) {
  const region = page.getByRole('region', { name: '주행 결과' })
  if (!(await region.isVisible().catch(() => false))) return
  const closeBtn = region.locator('.ride-summary__close')
  if (await closeBtn.isVisible().catch(() => false)) {
    await closeBtn.click()
  } else {
    await region.locator('.ride-summary__scrim').click({ force: true })
  }
  await expect(region).toBeHidden({ timeout: 15_000 })
}

async function rideUntilEnd(page: Page, minSessionMeters = 400) {
  const endButton = page.getByRole('button', { name: '주행 종료' })
  await expect(endButton).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('group', { name: '주행 지표' })).toBeVisible({ timeout: 20_000 })

  const today = page.getByLabel('오늘 거리')
  await expect
    .poll(
      async () => {
        if ((await today.count()) === 0) return -1
        const text = await today.first().innerText()
        const km = Number(text.trim().replace(/[^\d.]/g, ''))
        return Number.isFinite(km) ? km * 1000 : -1
      },
      { timeout: 180_000, intervals: [500], message: `세션 ${minSessionMeters}m 미달` },
    )
    .toBeGreaterThanOrEqual(minSessionMeters)

  await endButton.click()
  await expect(page.getByRole('region', { name: '주행 결과' })).toBeVisible({ timeout: 20_000 })
}

async function extendFromNextRideCard(page: Page) {
  const card = page.getByRole('group', { name: '다음 주행' })
  await expect(card).toBeVisible({ timeout: 15_000 })
  await card.getByRole('button', { name: '이 지점에서 새 경로' }).click()
  const dock = pickSurface(page)
  await expect(dock).toBeVisible({ timeout: 15_000 })
  await expect(dock.getByRole('checkbox', { name: '거리와 방향으로 Route 찾기' })).toBeChecked()
  return dock
}

function coordsClose(a: [number, number], b: [number, number], epsilon = 0.0002): boolean {
  return Math.abs(a[0] - b[0]) <= epsilon && Math.abs(a[1] - b[1]) <= epsilon
}

async function readGuestUid(page: Page): Promise<string> {
  let uid: string | null = null
  await expect
    .poll(async () => {
      uid = await page.evaluate(() => {
        for (let i = 0; i < localStorage.length; i += 1) {
          const key = localStorage.key(i)
          if (!key?.startsWith('firebase:authUser:')) continue
          try {
            const parsed = JSON.parse(localStorage.getItem(key) ?? '{}') as { uid?: string }
            if (parsed.uid) return parsed.uid
          } catch {
            /* noop */
          }
        }
        return null
      })
      return uid
    }, { timeout: 30_000 })
    .not.toBeNull()
  return uid as string
}

async function readLatestRideSessionEnd(uid: string): Promise<[number, number] | null> {
  const res = await fetch(
    `${DOCS_URL}/rides?` +
      new URLSearchParams({
        pageSize: '20',
        orderBy: 'updatedAt desc',
      }),
    { headers: { authorization: 'Bearer owner' } },
  )
  if (!res.ok) return null
  const json = (await res.json()) as {
    documents?: { fields?: Record<string, unknown> }[]
  }
  for (const doc of json.documents ?? []) {
    const fields = doc.fields ?? {}
    const userId = (fields.userId as { stringValue?: string })?.stringValue
    if (userId !== uid) continue
    const end = fields.sessionEndLngLat as
      | { arrayValue?: { values?: { doubleValue?: number }[] } }
      | undefined
    const lng = end?.arrayValue?.values?.[0]?.doubleValue
    const lat = end?.arrayValue?.values?.[1]?.doubleValue
    if (lng != null && lat != null) return [lng, lat]
  }
  return null
}

test.describe('R1 단계 C — 자동 Route 3회 루프', () => {
  test.skip(!LIVE, 'Firebase 에뮬레이터 필요 — npm run test:e2e:ride-continue-phase-c')
  test.beforeEach(() => {
    test.setTimeout(900_000)
  })

  test('3회 연속 — anchor 자동 Route · Token · Start 승계', async ({ page }) => {
    await enterAsGuest(page)
    const uid = await readGuestUid(page)
    await prepareManualRideInput(page)

    const segments: {
      start: [number, number]
      end: [number, number]
      distanceM: number
      outcome?: string
    }[] = []

    const first = await createAutoRouteFromMap(page, TARGET_KM, { x: 1100, y: 400 })
    segments.push({
      start: first.start!,
      end: first.end!,
      distanceM: first.distanceMeters ?? first.distance ?? 0,
      outcome: first.outcome,
    })

    const tokenAfterFirstRoute = await parseTokenBalance(page)
    expect(tokenAfterFirstRoute, '첫 Route 생성 후 Token 잔액').not.toBeNull()

    await page.getByRole('button', { name: '주행 시작' }).click()
    await rideUntilEnd(page, 400)
    await closeRideSummary(page)

    const directionOffsets = [
      { x: 1050, y: 420 },
      { x: 1000, y: 380 },
      { x: 950, y: 440 },
    ]

    for (let lap = 0; lap < 3; lap += 1) {
      const sessionEnd = await readLatestRideSessionEnd(uid)
      expect(sessionEnd, `루프 ${lap + 1}: sessionEndLngLat`).not.toBeNull()

      const dock = await extendFromNextRideCard(page)

      const targetInput = dock.locator('.map-view__pick-distance-number')
      await expect(targetInput).toHaveValue(`${TARGET_KM}.0`)

      const result = await pickDirectionOnArmedSession(page, directionOffsets[lap]!)
      const start = result.start!
      const distanceM = result.distanceMeters ?? result.distance ?? 0

      expect(
        coordsClose(start, sessionEnd!),
        `루프 ${lap + 1}: Start ≠ sessionEndLngLat`,
      ).toBe(true)
      expect(distanceM).toBeGreaterThan(0)
      if (result.outcome === 'offered' || result.outcome === 'shortfall') {
        expect(['offered', 'shortfall']).toContain(result.outcome)
      } else {
        expect(Math.abs(distanceM - TARGET_KM * 1000)).toBeLessThanOrEqual(5)
      }

      segments.push({
        start,
        end: result.end!,
        distanceM,
        outcome: result.outcome,
      })

      await page.getByRole('button', { name: '주행 시작' }).click()
      await rideUntilEnd(page, 300)
      await closeRideSummary(page)
    }

    expect(segments.length).toBe(4)

    await extendFromNextRideCard(page)
    const tokenAfterLoops = await parseTokenBalance(page)
    expect(tokenAfterFirstRoute! - tokenAfterLoops!, '3회 extend = Token 3개 추가 차감').toBe(3)
  })

  test('Start 이동 시 anchor 고정 해제 — 일반 자동 Route', async ({ page }) => {
    await enterAsGuest(page)
    await prepareManualRideInput(page)

    await createAutoRouteFromMap(page, 3, { x: 1100, y: 400 })
    await page.getByRole('button', { name: '주행 시작' }).click()
    await rideUntilEnd(page, 300)
    await closeRideSummary(page)

    await extendFromNextRideCard(page)

    await clickMap(page, 600, 500)
    const popup = pickSurface(page)
    await popup.getByRole('button', { name: 'Set start' }).evaluate((n) => n.click())
    await page.waitForTimeout(400)

    const modeCheckbox = popup.getByRole('checkbox', { name: '거리와 방향으로 Route 찾기' })
    await expect(modeCheckbox).not.toBeChecked()
  })
})
