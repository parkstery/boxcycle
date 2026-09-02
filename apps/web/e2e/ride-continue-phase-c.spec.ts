import { test, expect, type Page } from '@playwright/test'
import { readGuestUid } from './readGuestUid'

/**
 * R1 단계 C — 자동 Route 3회 연속 루프.
 * 자동 Route → 주행 → 종료 → 「이 지점에서 새 경로」×3
 */
const LIVE = process.env.RIDE_VERIFY_LIVE === '1'
const PROJECT_ID = 'boxcycle-dc2df'
const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080'
const DOCS_URL = `http://${EMULATOR_HOST}/v1/projects/${PROJECT_ID}/databases/(default)/documents`

const TARGET_KM = 5

function attachProdFunctions401Guard(page: Page): string[] {
  const hits: string[] = []
  page.on('response', (response) => {
    const url = response.url()
    if (url.includes('cloudfunctions.net') && response.status() === 401) {
      hits.push(url)
      console.error(`[phase-c] cloudfunctions.net 401: ${url}`)
    }
  })
  return hits
}

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

async function openPickSurfaceAtStart(page: Page) {
  await clickMap(page, 420, 320)
  const popup = pickSurface(page)
  await expect(popup).toBeVisible({ timeout: 30_000 })
  await popup.getByRole('button', { name: 'Set start' }).evaluate((n) => n.click())
  await page.waitForTimeout(400)
  await popup.getByTestId('route-token-holding').waitFor({ state: 'visible', timeout: 30_000 })
  return popup
}

async function parseTokenBalance(page: Page): Promise<number | null> {
  const holding = pickSurface(page).getByTestId('route-token-holding')
  if (!(await holding.isVisible().catch(() => false))) return null
  const text = (await holding.innerText()).trim()
  const m = text.match(/(\d+)\s*개/)
  return m ? Number(m[1]) : null
}

async function armDistanceDirectionMode(page: Page, popup: ReturnType<typeof pickSurface>, targetKm: number) {
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
}

async function pickDirectionAndWaitRoute(
  page: Page,
  directionOffset: { x: number; y: number },
) {
  const autoRoutePromise = page.waitForResponse(
    (r) => r.request().method() === 'POST' && r.url().includes('getDistanceAutoRoute') && r.ok(),
    { timeout: 120_000 },
  )
  await clickMap(page, directionOffset.x, directionOffset.y)
  const resp = await autoRoutePromise
  const reqPayload = resp.request().postDataJSON() as { data?: { start?: [number, number] } } | null
  const requestStart = Array.isArray(reqPayload?.data?.start) ? reqPayload.data.start : undefined
  const body = await resp.json()
  const result = body?.result ?? body
  const popup = pickSurface(page)
  await popup
    .locator('.map-view__pick-auto-route-status--found')
    .first()
    .waitFor({ state: 'visible', timeout: 120_000 })
  await page.waitForTimeout(400)
  return {
    ...(result as {
      start?: [number, number]
      end?: [number, number]
      distance?: number
      distanceMeters?: number
      outcome?: string
      geometry?: { coordinates?: [number, number][] }
    }),
    requestStart,
  }
}

function routeStartFromResult(
  result: Awaited<ReturnType<typeof pickDirectionAndWaitRoute>>,
): [number, number] | undefined {
  if (Array.isArray(result.requestStart) && result.requestStart.length === 2) {
    return result.requestStart
  }
  if (Array.isArray(result.start) && result.start.length === 2) return result.start
  const first = result.geometry?.coordinates?.[0]
  if (Array.isArray(first) && first.length >= 2) return [first[0]!, first[1]!]
  return undefined
}

async function createAutoRouteFromMap(
  page: Page,
  targetKm = TARGET_KM,
  directionOffset: { x: number; y: number } = { x: 1100, y: 400 },
) {
  const popup = await openPickSurfaceAtStart(page)
  await armDistanceDirectionMode(page, popup, targetKm)
  return pickDirectionAndWaitRoute(page, directionOffset)
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
  await expect
    .poll(
      async () => dock.getByRole('checkbox', { name: '거리와 방향으로 Route 찾기' }).isChecked(),
      { timeout: 30_000, intervals: [200], message: 'anchor extend — 거리·방향 모드 arm' },
    )
    .toBe(true)
  return dock
}

function coordsClose(a: [number, number], b: [number, number], epsilon = 0.0002): boolean {
  return Math.abs(a[0] - b[0]) <= epsilon && Math.abs(a[1] - b[1]) <= epsilon
}

function formatLngLat(p: [number, number]): string {
  return `[${p[0].toFixed(6)}, ${p[1].toFixed(6)}]`
}

function haversineMeters(a: [number, number], b: [number, number]): number {
  const r = 6_371_000
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b[1] - a[1])
  const dLng = toRad(b[0] - a[0])
  const lat1 = toRad(a[1])
  const lat2 = toRad(b[1])
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * r * Math.asin(Math.sqrt(h))
}

function assertStartMatchesSessionEnd(
  lap: number,
  routeStart: [number, number],
  sessionEnd: [number, number],
) {
  const distM = haversineMeters(routeStart, sessionEnd)
  expect(
    coordsClose(routeStart, sessionEnd),
    `루프 ${lap}: Start ${formatLngLat(routeStart)} ≠ sessionEnd ${formatLngLat(sessionEnd)} (거리 ${distM.toFixed(1)}m)`,
  ).toBe(true)
}

async function dumpRideAnchorState(
  uid: string,
  lap: number,
  opts: {
    routeStart?: [number, number]
    lastRideSessionEnd?: [number, number] | null
    phase: string
  },
) {
  const sorted = sortRideAnchors(await listUserRideAnchors(uid))
  const picked = await readLatestRideSessionEnd(uid)
  console.log(`[phase-c] anchor dump — 루프 ${lap} (${opts.phase})`)
  for (const row of sorted) {
    console.log(
      `[phase-c] rides row: ${JSON.stringify({
        lap,
        docId: row.docId,
        endedAtMs: row.endedAtMs,
        sessionEndLngLat: row.sessionEndLngLat,
      })}`,
    )
  }
  console.log(
    `[phase-c] readLatestRideSessionEnd: ${JSON.stringify({ lap, value: picked })}`,
  )
  if (opts.lastRideSessionEnd) {
    console.log(
      `[phase-c] lastRideSessionEnd(cached): ${JSON.stringify({ lap, value: opts.lastRideSessionEnd })}`,
    )
  }
  if (opts.routeStart) {
    console.log(`[phase-c] routeStart: ${JSON.stringify({ lap, value: opts.routeStart })}`)
    if (picked) {
      console.log(
        `[phase-c] routeStart vs readLatestRideSessionEnd: ${haversineMeters(opts.routeStart, picked).toFixed(1)}m`,
      )
    }
    if (opts.lastRideSessionEnd) {
      console.log(
        `[phase-c] routeStart vs lastRideSessionEnd(cached): ${haversineMeters(opts.routeStart, opts.lastRideSessionEnd).toFixed(1)}m`,
      )
    }
    for (const row of sorted) {
      if (!row.sessionEndLngLat) continue
      console.log(
        `[phase-c] routeStart vs ride ${row.docId}: ${haversineMeters(opts.routeStart, row.sessionEndLngLat).toFixed(1)}m`,
      )
    }
  }
}

type RideAnchorRow = {
  docId: string
  endedAtMs: number
  sessionEndLngLat: [number, number] | null
}

function parseFirestoreTimestampMs(
  field: { timestampValue?: string; integerValue?: string } | undefined,
): number {
  if (field?.timestampValue) {
    const ms = Date.parse(field.timestampValue)
    return Number.isFinite(ms) ? ms : 0
  }
  if (field?.integerValue) {
    const sec = Number(field.integerValue)
    return Number.isFinite(sec) ? sec * 1000 : 0
  }
  return 0
}

function parseSessionEndLngLat(
  fields: Record<string, unknown>,
): [number, number] | null {
  const end = fields.sessionEndLngLat as
    | { arrayValue?: { values?: { doubleValue?: number }[] } }
    | undefined
  const lng = end?.arrayValue?.values?.[0]?.doubleValue
  const lat = end?.arrayValue?.values?.[1]?.doubleValue
  if (lng != null && lat != null) return [lng, lat]
  return null
}

function docIdFromFirestoreName(name: string | undefined): string {
  if (!name) return ''
  const parts = name.split('/')
  return parts[parts.length - 1] ?? name
}

function sortRideAnchors(rows: RideAnchorRow[]): RideAnchorRow[] {
  return [...rows].sort((a, b) => {
    if (b.endedAtMs !== a.endedAtMs) return b.endedAtMs - a.endedAtMs
    return b.docId.localeCompare(a.docId)
  })
}

async function listUserRideAnchors(uid: string): Promise<RideAnchorRow[]> {
  const res = await fetch(`${DOCS_URL}:runQuery`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      authorization: 'Bearer owner',
    },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'rides' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'userId' },
            op: 'EQUAL',
            value: { stringValue: uid },
          },
        },
      },
    }),
  })
  if (!res.ok) return []
  const rows = (await res.json()) as Array<{
    document?: { name?: string; fields?: Record<string, unknown> }
  }>
  return rows
    .filter((row) => row.document?.fields)
    .map((row) => {
      const fields = row.document!.fields!
      return {
        docId: docIdFromFirestoreName(row.document!.name),
        endedAtMs: parseFirestoreTimestampMs(
          fields.endedAt as { timestampValue?: string; integerValue?: string },
        ),
        sessionEndLngLat: parseSessionEndLngLat(fields),
      }
    })
}

async function readLatestRideSessionEnd(uid: string): Promise<[number, number] | null> {
  const sorted = sortRideAnchors(await listUserRideAnchors(uid))
  const latest = sorted.find((row) => row.sessionEndLngLat != null)
  return latest?.sessionEndLngLat ?? null
}

async function waitForRideSessionEndAfter(
  uid: string,
  previous: [number, number] | null,
  timeoutMs = 90_000,
): Promise<[number, number]> {
  let sessionEnd: [number, number] | null = null
  await expect
    .poll(
      async () => {
        const latest = await readLatestRideSessionEnd(uid)
        if (!latest) return null
        if (previous && coordsClose(latest, previous)) return null
        sessionEnd = latest
        return latest
      },
      {
        timeout: timeoutMs,
        intervals: [500],
        message: previous
          ? 'Firestore — 직전 Ride 와 다른 sessionEndLngLat'
          : 'Firestore sessionEndLngLat',
      },
    )
    .not.toBeNull()
  return sessionEnd as [number, number]
}

test.describe('R1 단계 C — 자동 Route 3회 루프', () => {
  test.skip(!LIVE, 'Firebase 에뮬레이터 필요 — npm run test:e2e:ride-continue-phase-c')
  test.beforeEach(() => {
    test.setTimeout(900_000)
  })

  test('3회 연속 — anchor 자동 Route · Token · Start 승계', async ({ page }) => {
    const prod401 = attachProdFunctions401Guard(page)
    const tokenCheckpoints: number[] = []

    await enterAsGuest(page)
    const uid = await readGuestUid(page)
    await prepareManualRideInput(page)

    const popup = await openPickSurfaceAtStart(page)
    await expect
      .poll(async () => parseTokenBalance(page), {
        timeout: 30_000,
        message: 'Guest 온보딩 후 Token 잔액 10',
      })
      .toBe(10)
    tokenCheckpoints.push(10)
    console.log('[phase-c] token checkpoint: 10 (첫 회차 시작)')

    const directionOffsets = [
      { x: 1100, y: 400 },
      { x: 1050, y: 420 },
      { x: 1000, y: 380 },
      { x: 950, y: 440 },
    ]

    let lastRideSessionEnd: [number, number] | null = null

    for (let lap = 0; lap < 3; lap += 1) {
      let result: Awaited<ReturnType<typeof pickDirectionAndWaitRoute>>

      if (lap === 0) {
        await armDistanceDirectionMode(page, popup, TARGET_KM)
        result = await pickDirectionAndWaitRoute(page, directionOffsets[lap]!)
      } else {
        expect(lastRideSessionEnd, `루프 ${lap + 1}: 직전 Ride sessionEndLngLat`).not.toBeNull()
        const sessionEnd = lastRideSessionEnd!

        await dumpRideAnchorState(uid, lap + 1, {
          phase: 'extend 직전',
          lastRideSessionEnd: sessionEnd,
        })

        const dock = await extendFromNextRideCard(page)
        await expect(dock.locator('.map-view__pick-distance-number')).toHaveValue(`${TARGET_KM}.0`)
        result = await pickDirectionAndWaitRoute(page, directionOffsets[lap]!)

        const routeStart = routeStartFromResult(result)
        expect(routeStart, `루프 ${lap + 1}: Route start`).toBeDefined()
        await dumpRideAnchorState(uid, lap + 1, {
          phase: 'Route 생성 직후',
          routeStart: routeStart!,
          lastRideSessionEnd: sessionEnd,
        })
        assertStartMatchesSessionEnd(lap + 1, routeStart!, sessionEnd)
      }

      const distanceM = result.distanceMeters ?? result.distance ?? 0
      expect(distanceM).toBeGreaterThan(0)
      if (result.outcome === 'offered' || result.outcome === 'shortfall') {
        expect(['offered', 'shortfall']).toContain(result.outcome)
      } else {
        expect(Math.abs(distanceM - TARGET_KM * 1000)).toBeLessThanOrEqual(5)
      }

      const balanceAfterRoute = await parseTokenBalance(page)
      expect(balanceAfterRoute, `루프 ${lap + 1} Route 생성 후 Token`).toBe(9 - lap)
      tokenCheckpoints.push(balanceAfterRoute!)
      console.log(`[phase-c] token checkpoint: ${balanceAfterRoute} (루프 ${lap + 1} Route 생성 후)`)

      await page.getByRole('button', { name: '주행 시작' }).click()
      await rideUntilEnd(page, lap === 0 ? 400 : 300)
      await closeRideSummary(page)
      lastRideSessionEnd = await waitForRideSessionEndAfter(uid, lastRideSessionEnd)
      await dumpRideAnchorState(uid, lap + 1, {
        phase: '주행 종료·Firestore persist 후',
        lastRideSessionEnd,
      })
    }

    expect(tokenCheckpoints).toEqual([10, 9, 8, 7])
    expect(prod401, 'cloudfunctions.net 401 누출').toEqual([])
    console.log('[phase-c] green: token 10→9→8→7, prod 401 없음')
  })

  test('Start 이동 시 anchor 고정 해제 — 일반 자동 Route', async ({ page }) => {
    const prod401 = attachProdFunctions401Guard(page)

    await enterAsGuest(page)
    await prepareManualRideInput(page)

    await createAutoRouteFromMap(page, 3, { x: 1100, y: 400 })
    await page.getByRole('button', { name: '주행 시작' }).click()
    await rideUntilEnd(page, 300)
    await closeRideSummary(page)

    await extendFromNextRideCard(page)

    // direction pick 점유 중 map click 은 방향 입력으로 간다 — Start 수동 이동은 모드 해제 후 새 pick
    const extendDock = pickSurface(page)
    await extendDock.getByRole('checkbox', { name: '거리와 방향으로 Route 찾기' }).uncheck()
    await clickMap(page, 600, 500)
    const popup = pickSurface(page)
    await popup.getByRole('button', { name: 'Set start' }).evaluate((n) => n.click())
    await page.waitForTimeout(400)

    const modeCheckbox = popup.getByRole('checkbox', { name: '거리와 방향으로 Route 찾기' })
    await expect(modeCheckbox).not.toBeChecked()

    expect(prod401, 'cloudfunctions.net 401 누출').toEqual([])
  })
})
