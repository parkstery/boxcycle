import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

// 다음 주행·이어 달리기 e2e(RIDE-CONTINUE-1 §7.3).
// 「어제 멈춘 곳이 오늘 앱을 열었을 때 자동으로 다음 출발점이 된다」를 종료→재진입까지 고정한다.
//
// 셀렉터는 scripts/ride-verify/entry-contract.mjs 와 같은 계약을 쓴다 —
// 한쪽만 고치지 않는다(verify-selectors.mjs 가 앵커 실재를 지킨다).
//
// ⚠ Firebase 의존: 게스트 = 실제 signInAnonymously, 경로·Ride = 실제 Firestore.
// `npm run test:e2e:ride-continuation` 이 firebase emulators:exec 로 감싸 실행하며,
// 그 env(FIRESTORE_EMULATOR_HOST) 를 playwright.config 가 감지해 RIDE_VERIFY_LIVE=1 을 켠다.
// RIDE_VERIFY_LIVE=1 을 직접 켜 실 Firebase 에 붙이지 않는다.
const LIVE = process.env.RIDE_VERIFY_LIVE === '1'

const PROJECT_ID = 'boxcycle-dc2df'
const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080'
const DOCS_URL = `http://${EMULATOR_HOST}/v1/projects/${PROJECT_ID}/databases/(default)/documents`

/** 결정적 fixture 경로 — 위도 37.5 를 따라 동쪽으로 뻗는 직선(약 1 km) */
const FIXTURE_POINTS = 11
const FIXTURE_STEP_LNG = 0.00113
const FIXTURE_LAT = 37.5
const FIXTURE_START_LNG = 127.02

function fixtureCoordinates(): [number, number][] {
  const out: [number, number][] = []
  for (let i = 0; i < FIXTURE_POINTS; i += 1) {
    out.push([FIXTURE_START_LNG + i * FIXTURE_STEP_LNG, FIXTURE_LAT])
  }
  return out
}

function haversineMeters(a: [number, number], b: [number, number]): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const R = 6371000
  const dLat = toRad(b[1] - a[1])
  const dLng = toRad(b[0] - a[0])
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

function fixtureLengthMeters(): number {
  const coords = fixtureCoordinates()
  let sum = 0
  for (let i = 1; i < coords.length; i += 1) sum += haversineMeters(coords[i - 1], coords[i])
  return sum
}

const FIXTURE_LENGTH_M = fixtureLengthMeters()

/** U4 HUD 증거 스크린샷 — Playwright 가 정리해도 남는 고정 경로 */
const U4_HUD_EVIDENCE_PATH = path.resolve(
  process.cwd(),
  '../../document/archive/ride-verify-evidence/u4-hud-resume-dual.png',
)

/** 게스트 진입 카드 → 익명 인증 완료 */
async function enterAsGuest(page: Page) {
  await page.goto('/')
  const gate = page.getByRole('dialog', { name: '시작' })
  await expect(gate).toBeVisible()
  await gate.getByRole('button', { name: '시작', exact: true }).click()
  await expect(gate).toBeHidden()
}

/**
 * 주행 입력 준비(Go 사전조건) + 체험 속도 최대치.
 * 자동 E2E 에는 BLE 장치가 없으므로 「체험 속도로 준비」를 명시적으로 고른다.
 * 속도를 올리는 건 시험 시간을 줄이기 위함이며, 주행 로직은 동일하다.
 */
async function prepareManualRideInput(page: Page, speedKmh = 50) {
  await page.getByRole('button', { name: /케이던스 센서/ }).click()
  const sheet = page.getByRole('dialog', { name: '케이던스 센서' })
  await expect(sheet).toBeVisible()
  await sheet.getByRole('button', { name: '체험 속도로 준비' }).click()
  const speedInput = sheet.getByRole('spinbutton', { name: '속도 km/h' })
  if (await speedInput.count()) {
    await speedInput.fill(String(speedKmh))
    await speedInput.blur()
  }
  await sheet.getByRole('button', { name: '센서 설정 닫기' }).click()
  await expect(sheet).toBeHidden()
}

/**
 * 익명 인증된 게스트의 uid — Firestore fixture 를 그 사용자 소유로 심기 위함.
 * Firebase v9 는 인증 상태를 IndexedDB(`firebaseLocalStorageDb`)에 저장한다 —
 * localStorage 만 뒤지면 못 찾는다(폴백으로만 남겨 둔다).
 */
async function readGuestUid(page: Page): Promise<string> {
  let uid: string | null = null
  await expect
    .poll(
      async () => {
        uid = await page.evaluate(
          () =>
            new Promise<string | null>((resolve) => {
              const fromLocal = (() => {
                for (let i = 0; i < localStorage.length; i += 1) {
                  const key = localStorage.key(i)
                  if (!key || !key.startsWith('firebase:authUser:')) continue
                  try {
                    const parsed = JSON.parse(localStorage.getItem(key) ?? '{}') as {
                      uid?: string
                    }
                    if (parsed?.uid) return parsed.uid
                  } catch {
                    /* noop */
                  }
                }
                return null
              })()
              if (fromLocal) {
                resolve(fromLocal)
                return
              }
              let settled = false
              const done = (v: string | null) => {
                if (!settled) {
                  settled = true
                  resolve(v)
                }
              }
              try {
                const req = indexedDB.open('firebaseLocalStorageDb')
                req.onerror = () => done(null)
                req.onsuccess = () => {
                  try {
                    const db = req.result
                    const store = db
                      .transaction('firebaseLocalStorage', 'readonly')
                      .objectStore('firebaseLocalStorage')
                    const all = store.getAll()
                    all.onsuccess = () => {
                      const rows = all.result as { fbase_key?: string; value?: { uid?: string } }[]
                      const row = rows.find(
                        (r) => typeof r.fbase_key === 'string' && r.fbase_key.startsWith('firebase:authUser:'),
                      )
                      done(row?.value?.uid ?? null)
                    }
                    all.onerror = () => done(null)
                  } catch {
                    done(null)
                  }
                }
              } catch {
                done(null)
              }
            }),
        )
        return uid
      },
      { timeout: 30_000, message: '게스트 uid 를 찾지 못했다 — 익명 인증이 끝나지 않았다' },
    )
    .not.toBeNull()
  return uid as unknown as string
}

function doubleArray(v: [number, number]) {
  return { arrayValue: { values: [{ doubleValue: v[0] }, { doubleValue: v[1] }] } }
}

/**
 * 결정적 SavedRoute 를 에뮬레이터에 심는다.
 * `Authorization: Bearer owner` 는 에뮬레이터에서 rules 를 우회하는 표준 방법이다.
 */
async function seedSavedRoute(input: {
  uid: string
  routeId: string
  name: string
  lastProgressRatio: number
  completed?: 0 | 1
}): Promise<void> {
  const coords = fixtureCoordinates()
  const nowIso = new Date().toISOString()
  const body = {
    fields: {
      userId: { stringValue: input.uid },
      name: { stringValue: input.name },
      profile: { stringValue: 'cycling' },
      startLngLat: doubleArray(coords[0]!),
      endLngLat: doubleArray(coords[coords.length - 1]!),
      geometryType: { stringValue: 'LineString' },
      geometryCoordsJson: { stringValue: JSON.stringify(coords) },
      distanceMeters: { doubleValue: FIXTURE_LENGTH_M },
      durationSec: { doubleValue: 300 },
      source: { stringValue: 'web' },
      createdAt: { timestampValue: nowIso },
      updatedAt: { timestampValue: nowIso },
      completed: { integerValue: String(input.completed ?? 0) },
      completedAt: { nullValue: null },
      expiresAt: { timestampValue: new Date(Date.now() + 86400000).toISOString() },
      lastRideId: { nullValue: null },
      lastProgressRatio: { doubleValue: input.lastProgressRatio },
    },
  }
  const res = await fetch(`${DOCS_URL}/savedRoutes?documentId=${input.routeId}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer owner' },
    body: JSON.stringify(body),
  })
  expect(res.ok, `SavedRoute seed 실패: ${res.status} ${await res.text()}`).toBe(true)
}

/** 다른 탭·기기가 진행률을 올린 상황을 흉내내는 out-of-band write */
async function forceSavedRouteProgress(routeId: string, ratio: number): Promise<void> {
  const res = await fetch(
    `${DOCS_URL}/savedRoutes/${routeId}?updateMask.fieldPaths=lastProgressRatio`,
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', authorization: 'Bearer owner' },
      body: JSON.stringify({ fields: { lastProgressRatio: { doubleValue: ratio } } }),
    },
  )
  expect(res.ok, `진행률 out-of-band write 실패: ${res.status}`).toBe(true)
}

async function readSavedRoute(routeId: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${DOCS_URL}/savedRoutes/${routeId}`, {
    headers: { authorization: 'Bearer owner' },
  })
  expect(res.ok, `SavedRoute 조회 실패: ${res.status}`).toBe(true)
  const json = (await res.json()) as { fields?: Record<string, unknown> }
  return json.fields ?? {}
}

function fieldNumber(fields: Record<string, unknown>, key: string): number {
  const raw = fields[key] as { doubleValue?: number; integerValue?: string } | undefined
  if (raw?.doubleValue != null) return Number(raw.doubleValue)
  if (raw?.integerValue != null) return Number(raw.integerValue)
  return 0
}

/** 신규 좌표 필드가 없는 옛 Ride — legacy fallback 검증용 */
async function seedLegacyRide(uid: string, rideId: string): Promise<void> {
  const body = {
    fields: {
      userId: { stringValue: uid },
      trailId: { nullValue: null },
      profile: { stringValue: 'cycling' },
      startedAt: { nullValue: null },
      endedAt: { timestampValue: new Date(Date.now() - 86400000).toISOString() },
      elapsedSec: { doubleValue: 900 },
      distanceMeters: { doubleValue: 5200 },
      avgSpeedKmh: { doubleValue: 20.8 },
      caloriesEstimate: { doubleValue: 156 },
      routeDistanceMeters: { doubleValue: 5200 },
      routeDurationSec: { doubleValue: 900 },
      source: { stringValue: 'web' },
      status: { stringValue: 'completed' },
      createdAt: { timestampValue: new Date(Date.now() - 86400000).toISOString() },
      updatedAt: { timestampValue: new Date(Date.now() - 86400000).toISOString() },
      completionRatio: { doubleValue: 0.5 },
    },
  }
  const res = await fetch(`${DOCS_URL}/rides?documentId=${rideId}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer owner' },
    body: JSON.stringify(body),
  })
  expect(res.ok, `legacy ride seed 실패: ${res.status}`).toBe(true)
}

/** MENU → 내 경로 탭에서 fixture 를 불러온다(카드가 없는 최초 진입용 경로) */
async function loadSavedRouteFromMenu(page: Page, routeName: string) {
  await page.getByRole('button', { name: 'Trail 메뉴' }).click()
  await page.getByRole('tab', { name: /내 경로/ }).click()
  const row = page.getByText(routeName, { exact: false }).first()
  await expect(row).toBeVisible({ timeout: 15_000 })
  await row.click()
  await page.getByRole('button', { name: '열기' }).first().click()
  await expect(page.getByRole('button', { name: '주행 시작' })).toBeVisible({ timeout: 15_000 })
}

/**
 * HUD 「오늘 거리」 km — 이번 세션 실주행(재개 시 offset 차감).
 * 주행 전(route-preview)에는 표시되지 않으므로 -1 을 돌려 폴링이 조기 통과하지 않게 한다.
 */
async function readHudSessionKm(page: Page): Promise<number> {
  const today = page.getByLabel('오늘 거리')
  if ((await today.count()) === 0) return -1
  const text = await today.first().innerText()
  const km = Number(text.trim().replace(/[^\d.]/g, ''))
  return Number.isFinite(km) ? km : -1
}

/** HUD 「누적 진행」 — 경로상 누적 km(재개 offset 시드 포함) */
async function readHudCumulativeKm(page: Page): Promise<number> {
  const cumulative = page.getByLabel('누적 진행')
  if ((await cumulative.count()) === 0) return -1
  const text = await cumulative.first().innerText()
  const km = Number(text.trim().split('/')[0]?.replace(/[^\d.]/g, ''))
  return Number.isFinite(km) ? km : -1
}

/**
 * 목표 세션 거리까지 달린 뒤 종료한다.
 * 고정 sleep 대신 HUD 표시값을 폴링해 램핑·프레임 편차에 흔들리지 않게 한다.
 * `beforeEnd` — 종료 클릭 직전(주행 중 HUD 가 보일 때) 콜백.
 */
async function rideUntilSessionMeters(
  page: Page,
  targetMeters: number,
  beforeEnd?: () => Promise<void>,
) {
  const endButton = page.getByRole('button', { name: '주행 종료' })
  await expect(endButton).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('group', { name: '주행 지표' })).toBeVisible({ timeout: 20_000 })
  await expect
    .poll(async () => (await readHudSessionKm(page)) * 1000, {
      timeout: 180_000,
      intervals: [500],
      message: `세션 거리 ${targetMeters}m 에 도달하지 못했다`,
    })
    .toBeGreaterThanOrEqual(targetMeters)
  if (beforeEnd) await beforeEnd()
  await endButton.click()
}

/**
 * 「다음 주행」 카드. 앵커 div(aria-label)·카드 group·숨기기 버튼이 모두 「다음 주행」을 포함하므로
 * 카드 본체(role=group)로 정확히 겨냥한다.
 */
const nextRideCard = (page: Page) => page.getByRole('group', { name: '다음 주행' })

test.describe('다음 주행 · 이어 달리기', () => {
  test.skip(!LIVE, 'Firebase 에뮬레이터 필요 — npm run test:e2e:ride-continuation')
  // 실제로 경로를 달리는 시험이다(1 km ≈ 80초). 기본 30초 타임아웃으로는 부족하다.
  test.beforeEach(() => {
    test.setTimeout(300_000)
  })

  test('C1 — 미완주 SavedRoute 를 종료→재진입→재개까지 이어 달린다', async ({ page }, testInfo) => {
    await enterAsGuest(page)
    const uid = await readGuestUid(page)
    const routeId = `fixture-c1-${Date.now()}`
    await seedSavedRoute({ uid, routeId, name: 'C1 이어달리기 픽스처', lastProgressRatio: 0 })

    await page.reload()
    await prepareManualRideInput(page)
    await loadSavedRouteFromMenu(page, 'C1 이어달리기 픽스처')

    // 1차 주행 — 전체의 약 20% 지점까지
    await page.getByRole('button', { name: '주행 시작' }).click()
    await rideUntilSessionMeters(page, FIXTURE_LENGTH_M * 0.2)

    // 결과 시트: 전체 진행 0% → N% 와 다음 출발점
    const summary = page.getByRole('region', { name: '주행 결과' })
    await expect(summary).toBeVisible({ timeout: 20_000 })
    await expect(summary.getByLabel('전체 진행')).toContainText('전체 진행 0% →')
    await expect(summary.getByText('다음 출발점이 저장되었습니다')).toBeVisible()
    await summary.getByRole('button', { name: '닫기' }).first().click()

    // Firestore 진행률 반영을 기다린 뒤 재진입한다(결과 시트는 로컬 record 낙관 표시라 더 빠르다)
    await expect
      .poll(async () => fieldNumber(await readSavedRoute(routeId), 'lastProgressRatio'), {
        timeout: 30_000,
        message: '1차 주행의 진행률이 서버에 반영되지 않았다',
      })
      .toBeGreaterThan(0)

    // 재진입 — 지도 위 「다음 주행」 카드가 자동으로 뜬다
    await page.reload()
    const card = nextRideCard(page)
    await expect(card).toBeVisible({ timeout: 30_000 })
    const resumeBtn = card.getByRole('button', { name: /%에서 이어 달리기/ })
    await expect(resumeBtn).toBeVisible()
    const resumeLabel = await resumeBtn.innerText()
    const resumePct = Number(resumeLabel.match(/(\d+)%/)?.[1])
    expect(resumePct, `재개 진행률이 20% 근처가 아니다: ${resumeLabel}`).toBeGreaterThanOrEqual(15)

    // CTA 는 ready-to-start 까지만 만든다 — 실제 시작은 기존 Go 게이트
    await resumeBtn.click()
    const start = page.getByRole('button', { name: '주행 시작' })
    await expect(start).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(`${resumePct}% 지점부터`)).toBeVisible()

    // 입력 준비 후 Go — 재개 주행은 세션 구간만 인정된다
    await prepareManualRideInput(page)
    await expect(start).toBeEnabled()
    await start.click()
    await expect(page.getByRole('group', { name: '주행 지표' })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByLabel('오늘 거리')).toBeVisible()
    await expect(page.getByLabel('누적 진행')).toBeVisible()
    const resumeOffsetM = FIXTURE_LENGTH_M * (resumePct / 100)
    // U4 — HUD 누적은 재개 지점(offset)부터, 오늘은 0 근처
    await expect
      .poll(async () => readHudCumulativeKm(page), {
        timeout: 15_000,
        message: '재개 직후 HUD 누적 위치가 offset 시드에 맞지 않다',
      })
      .toBeGreaterThanOrEqual((resumeOffsetM * 0.85) / 1000)
    await expect
      .poll(async () => readHudSessionKm(page), { timeout: 10_000 })
      .toBeLessThan((resumeOffsetM * 0.5) / 1000)

    await rideUntilSessionMeters(page, FIXTURE_LENGTH_M * 0.17, async () => {
      const sessionKm = await readHudSessionKm(page)
      const cumulativeKm = await readHudCumulativeKm(page)
      expect(cumulativeKm, '누적 위치가 세션 거리보다 작다').toBeGreaterThan(sessionKm)
      fs.mkdirSync(path.dirname(U4_HUD_EVIDENCE_PATH), { recursive: true })
      await page.screenshot({ path: U4_HUD_EVIDENCE_PATH })
      await page.screenshot({ path: testInfo.outputPath('u4-hud-resume-dual.png') })
    })

    const summary2 = page.getByRole('region', { name: '주행 결과' })
    await expect(summary2).toBeVisible({ timeout: 20_000 })
    const progressText = await summary2.getByLabel('전체 진행').innerText()
    const [fromPct, toPct] = (progressText.match(/(\d+)%/g) ?? []).map((v) => Number(v.replace('%', '')))
    expect(fromPct, `이전 진행률이 재개 지점과 다르다: ${progressText}`).toBe(resumePct)
    expect(toPct, `누적 진행률이 늘지 않았다: ${progressText}`).toBeGreaterThan(resumePct)

    // 서버 문서도 누적 진행률로 올라간다.
    // 결과 시트는 로컬 record 로 낙관 표시되므로 Firestore 반영은 조금 뒤에 온다 — 폴링한다.
    await expect
      .poll(async () => fieldNumber(await readSavedRoute(routeId), 'lastProgressRatio'), {
        timeout: 30_000,
        message: '서버 진행률이 재개 지점보다 올라가지 않았다',
      })
      .toBeGreaterThan(resumePct / 100)
  })

  test('C2 — 늦은 낮은 진행률 write 가 높은 진행률을 되돌리지 않는다', async ({ page }) => {
    await enterAsGuest(page)
    const uid = await readGuestUid(page)
    const routeId = `fixture-c2-${Date.now()}`
    // 앱이 20% 를 캐시한 상태에서 서버가 43% 로 올라간 상황을 만든다.
    await seedSavedRoute({ uid, routeId, name: 'C2 stale 픽스처', lastProgressRatio: 0.2 })

    await page.reload()
    await prepareManualRideInput(page)
    await loadSavedRouteFromMenu(page, 'C2 stale 픽스처')

    // 로드 이후 다른 탭이 43% 로 올린다(클라이언트는 여전히 20% 를 들고 있다)
    await forceSavedRouteProgress(routeId, 0.43)

    // 처음부터 달려 약 31% 에서 종료 → 클라이언트 요청값은 43% 보다 낮다
    await page.getByRole('radio', { name: /처음부터/ }).check()
    await page.getByRole('button', { name: '주행 시작' }).click()
    await rideUntilSessionMeters(page, FIXTURE_LENGTH_M * 0.31)
    await expect(page.getByRole('region', { name: '주행 결과' })).toBeVisible({ timeout: 20_000 })

    await expect
      .poll(async () => fieldNumber(await readSavedRoute(routeId), 'lastProgressRatio'), {
        timeout: 20_000,
        message: 'stale write 가 진행률을 되돌렸다',
      })
      .toBeGreaterThanOrEqual(0.43)

    await page.reload()
    const card = nextRideCard(page)
    await expect(card).toBeVisible({ timeout: 30_000 })
    await expect(card.getByRole('button', { name: /43%에서 이어 달리기/ })).toBeVisible()
  })

  test('C3 — 완주 끝점에서 새 Route 를 연결하고 이전 경로는 불변이다', async ({ page }) => {
    await enterAsGuest(page)
    const uid = await readGuestUid(page)
    const routeId = `fixture-c3-${Date.now()}`
    await seedSavedRoute({ uid, routeId, name: 'C3 완주 픽스처', lastProgressRatio: 0 })
    const before = await readSavedRoute(routeId)
    const geometryBefore = (before.geometryCoordsJson as { stringValue?: string })?.stringValue

    await page.reload()
    await prepareManualRideInput(page)
    await loadSavedRouteFromMenu(page, 'C3 완주 픽스처')
    await page.getByRole('button', { name: '주행 시작' }).click()
    // 끝까지 달린다 — 경로 끝에 닿으면 도착 자동 종료가 결과 시트를 연다(버튼을 누르지 않는다).
    await expect(page.getByRole('button', { name: '주행 종료' })).toBeVisible({ timeout: 30_000 })
    const summary = page.getByRole('region', { name: '주행 결과' })
    await expect(summary).toBeVisible({ timeout: 240_000 })
    await expect(summary.getByText('경로를 완주했습니다')).toBeVisible()
    await summary.getByRole('button', { name: '끝점에서 새 경로' }).click()

    // 새 Route 준비 상태 — 출발점만 찍힌 setup 단계
    await expect(page.getByRole('button', { name: '주행 시작' })).toHaveCount(0)
    await expect(page.getByLabel('경로 설정')).toBeVisible({ timeout: 15_000 })

    // 이전 SavedRoute geometry 는 mutate 되지 않는다
    const after = await readSavedRoute(routeId)
    expect((after.geometryCoordsJson as { stringValue?: string })?.stringValue).toBe(geometryBefore)
    expect(fieldNumber(after, 'completed')).toBe(1)
  })

  test('C4 — ad-hoc 주행은 저장하지 않아도 다음 출발점이 남는다', async ({ page }) => {
    await enterAsGuest(page)
    await prepareManualRideInput(page)

    // 입문 코스는 SavedRoute 가 아니다 → 종료 시 ad-hoc 컨텍스트가 된다
    await page.getByRole('button', { name: 'Trail 메뉴' }).click()
    await page.getByRole('button', { name: '입문' }).click()
    const modal = page.getByRole('dialog').filter({ has: page.locator('#oc-modal-title') })
    await expect(modal).toBeVisible()
    await modal.locator('button.oc-modal__item').first().click()

    await page.getByRole('button', { name: '주행 시작' }).click()
    // 입문 경로는 0.5 km 미만이라 도착 자동 종료가 먼저 온다 — 결과 시트를 기다린다.
    await expect(page.getByRole('button', { name: '주행 종료' })).toBeVisible({ timeout: 30_000 })
    const summary = page.getByRole('region', { name: '주행 결과' })
    await expect(summary).toBeVisible({ timeout: 180_000 })
    await expect(summary.getByText('다음 출발점이 저장되었습니다')).toBeVisible()
    // 저장하지 않고 닫는다 — 경고 없이 즉시 닫혀야 한다
    await summary.getByRole('button', { name: '저장 안 함' }).click()
    await summary.getByRole('button', { name: '닫기' }).first().click()

    await page.reload()
    const card = nextRideCard(page)
    await expect(card).toBeVisible({ timeout: 30_000 })
    await expect(card.getByRole('button', { name: '이 지점에서 새 경로' })).toBeVisible()
  })

  test('C5 — legacy Ride 는 기록만 보이고 잘못된 CTA·Null Island 이동이 없다', async ({ page }) => {
    await enterAsGuest(page)
    const uid = await readGuestUid(page)
    await seedLegacyRide(uid, `legacy-${Date.now()}`)

    const pageErrors: string[] = []
    page.on('pageerror', (err) => pageErrors.push(String(err)))

    await page.reload()
    // 좌표도 Route 도 없는 Ride 뿐이므로 「다음 주행」 카드는 뜨지 않는다
    await expect(nextRideCard(page)).toHaveCount(0)

    // 기록 자체는 최근 주행 목록에 남는다
    await page.getByRole('button', { name: '사용자 정보' }).click()
    const history = page.getByRole('button', { name: '최근 주행' })
    await expect(history).toBeVisible({ timeout: 15_000 })
    await history.click()
    await expect(page.getByText('5.20 km').first()).toBeVisible({ timeout: 15_000 })
    // legacy 행에는 이어 달리기·새 경로 CTA 가 없다
    await expect(page.getByRole('button', { name: '이어 달리기' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: '여기서 새 경로' })).toHaveCount(0)

    expect(pageErrors, `스크립트 예외: ${pageErrors.join(' | ')}`).toEqual([])
  })
})
