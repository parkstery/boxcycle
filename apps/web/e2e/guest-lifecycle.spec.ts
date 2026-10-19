import { test, expect, type Page } from './open-meteo-stub'
import { guestStart } from './rideEntryHelpers'
import { readGuestUid } from './readGuestUid'

/**
 * 실제 Firebase SDK 의 Guest 재접속 — 종료/동일 Guest 복귀 회귀(02-task-18).
 *
 * Chief 계약(02-task-17):
 *   · 시작 메뉴는 「로그인 / 게스트로 시작」 두 개만(앱 소개 포함).
 *   · 이용 종료는 UserInfoSheet 메뉴 「종료」 — Firebase signOut 하지 않고 시작 메뉴로 복귀.
 *   · 종료를 반복해도 유효한 기존 Guest 를 재사용한다 — 내부에서 새 Guest 를 자동 만들지 않는다.
 *   · 종료 화면에 서버 수신 활동 핑 사용자 개인 쓰기 동행 presence 는 생기지 않는다.
 *   · heartbeat 검증은 실제 요청 카운터 + page.clock 가속으로 5분 간격을 건너뛰어 확정한다(GLM19).
 *
 * 에뮬레이터는 이 파일이 띄우지 않는다. localhost + demo-boxcycle-guest 가 아니면 돌리지 않는다.
 * Auth·Firestore·RTDB fixture 는 demo 에뮬레이터 REST(Bearer owner)만 쓴다. SDK 는 모킹하지 않는다.
 * UID 와 토큰은 로그에 남기지 않는다.
 */
const DEMO_PROJECT = 'demo-boxcycle-guest'
const OTHER_CACHE_KEY = 'boxcycle_calorie_profile_v1_google-other'
const PRIVATE_FIXTURE = 'guest-lifecycle-keep'
const EXPIRY_TEXT = '게스트 체험이 만료되었습니다'
/** 활동 heartbeat 5분 — src/lib/identity/guestActivity.ts GUEST_ACTIVITY_INTERVAL_MS 계약값. */
const GUEST_HEARTBEAT_MS = 5 * 60 * 1000
/** heartbeat 한 칸을 건너뛰는 clock 가속 폭(간격 + 여유 30초). */
const GUEST_HEARTBEAT_STEP_MS = GUEST_HEARTBEAT_MS + 30_000

/**
 * 실제 요청 카운터 — 페이지 fetch 를 래핑해 guestActivityHttp POST 만 센다.
 * 응답은 원래 fetch 그대로 통과시키므로 SDK·네트워크 모킹이 아니다. 탐색마다 counter 가 새로 시작된다.
 */
const ACTIVITY_PROBE_INIT = `
(() => {
  const probe = { guestActivityPosts: 0 }
  const original = window.fetch.bind(window)
  window.fetch = (input, init) => {
    try {
      const url = typeof input === 'string' ? input : input && typeof input.url === 'string' ? input.url : ''
      const method = (init && init.method) || (input && input.method) || 'GET'
      if (String(method).toUpperCase() === 'POST' && url.endsWith('/guestActivityHttp')) {
        probe.guestActivityPosts += 1
      }
    } catch {
      /* 카운터 실패가 실제 요청을 막지 않는다 */
    }
    return original(input, init)
  }
  window.__guestActivityProbe = probe
})()
`

async function activityPostCount(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      (window as unknown as { __guestActivityProbe?: { guestActivityPosts?: number } }).__guestActivityProbe
        ?.guestActivityPosts ?? 0,
  )
}

/**
 * 활동 heartbeat 정지(GLM19) — 종료 유지 상태의 새 탭을 page.clock 아래에서 부팅해
 * heartbeat 간격 2칸을 건너뛴다. 실제 요청 카운터 0 + 서버 기록 lastActivityAtMs 불변으로 확정한다.
 *
 * 한계: clock 가속은 제품 타이머를 가짜 시각으로 돌린다. 에뮬레이터 SDK 복구 타이머와 충돌해
 * 시작 메뉴에 못 도달하면 이 시험은 실패로 보고된다(임의 관찰 단축으로 넘기지 않는다).
 * 이 검증이 커버하는 것은 종료 상태 부팅 이후의 tick·네트워크 계층이다.
 * 종료 전에 시작된 같은 탭의 옛 interval 이 실시간 타이머로 살아남는 경우는 새 접속(탭)으로
 * 닿지 않는다 — 그 시나리오의 증명은 watch 정지 단위시험(제품 소유)의 몫이며 과장하지 않는다.
 */
async function expectNoActivityHeartbeat(page: Page, uid: string): Promise<void> {
  const tab = await page.context().newPage()
  await tab.clock.install()
  await tab.addInitScript(ACTIVITY_PROBE_INIT)
  await tab.goto('/')
  await expectStartMenu(tab)
  await expect
    .poll(async () => activityPostCount(tab), {
      timeout: 10_000,
      message: '종료 유지 상태 부팅에서 guestActivityHttp 호출이 있었다',
    })
    .toBe(0)

  const sample = await lastActivityAtMs(uid)
  expect(sample, '활동 기록(lastActivityAtMs)이 문서에 남아 있어야 한다').not.toBeNull()

  await tab.clock.fastForward(GUEST_HEARTBEAT_STEP_MS)
  await tab.clock.fastForward(GUEST_HEARTBEAT_STEP_MS)
  // clock 콜백의 tick 은 getIdToken→fetch 마이크로태스크로 늦게 도달한다 — 실시간 안정 대기 뒤에 확정한다.
  await tab.waitForTimeout(2_000)
  expect(await activityPostCount(tab), 'heartbeat 간격을 건너뛴 뒤에도 guestActivityHttp 호출이 있었다').toBe(0)
  await tab.waitForTimeout(1_500)
  expect(await lastActivityAtMs(uid), 'heartbeat 간격을 건너뛴 뒤 lastActivityAtMs 가 늘었다').toBe(sample)
  await tab.close()
}

type Gate = 'run' | 'skip' | 'block'

function hostOk(value: string | undefined): boolean {
  return /^(127\.0\.0\.1|localhost):\d+$/.test(value ?? '')
}

function emulatorGate(): Gate {
  const auth = process.env.FIREBASE_AUTH_EMULATOR_HOST
  const firestore = process.env.FIRESTORE_EMULATOR_HOST
  const database = process.env.FIREBASE_DATABASE_EMULATOR_HOST
  const project = process.env.VITE_FIREBASE_PROJECT_ID ?? process.env.GCLOUD_PROJECT ?? ''
  if (!auth && !firestore && !database && !project) return 'skip'
  if (!hostOk(auth) || !hostOk(firestore) || !hostOk(database)) return 'block'
  if (project !== DEMO_PROJECT) return 'block'
  return 'run'
}

const gate = emulatorGate()

function authHost(): string {
  return process.env.FIREBASE_AUTH_EMULATOR_HOST ?? ''
}

function firestoreHost(): string {
  return process.env.FIRESTORE_EMULATOR_HOST ?? ''
}

function databaseHost(): string {
  return process.env.FIREBASE_DATABASE_EMULATOR_HOST ?? ''
}

function ownerHeaders(): HeadersInit {
  return { authorization: 'Bearer owner', 'content-type': 'application/json' }
}

function baseDocuments(): string {
  return `http://${firestoreHost()}/v1/projects/${DEMO_PROJECT}/databases/(default)/documents`
}

function docUrl(path: string): string {
  return `${baseDocuments()}/${path}`
}

/** Firestore demo REST runQuery — `documents:runQuery` 콜론 연결(문서 경로가 아니다). */
function runQueryUrl(): string {
  return `${baseDocuments()}:runQuery`
}

function blockedUrl(uid: string): string {
  const ns = `${DEMO_PROJECT}-default-rtdb`
  return `http://${databaseHost()}/guestLifecycle/${encodeURIComponent(uid)}/blocked.json?ns=${ns}`
}

/** RTDB guestLifecycle/{uid}/blocked = true — 서버 확정 삭제의 차단 마커. */
async function markBlocked(uid: string): Promise<void> {
  const res = await fetch(blockedUrl(uid), {
    method: 'PUT',
    headers: ownerHeaders(),
    body: JSON.stringify(true),
  })
  if (!res.ok) throw new Error(`rtdb block marker ${res.status}`)
  await drain(res)
}

async function drain(res: Response): Promise<void> {
  await res.text()
}

async function listLocalIds(): Promise<string[]> {
  const ids: string[] = []
  const seen = new Set<string>()
  let pageToken = ''
  for (;;) {
    const query = new URLSearchParams({ maxResults: '1000' })
    if (pageToken) query.set('nextPageToken', pageToken)
    const res = await fetch(
      `http://${authHost()}/identitytoolkit.googleapis.com/v1/projects/${DEMO_PROJECT}/accounts:batchGet?${query}`,
      { headers: ownerHeaders() },
    )
    if (!res.ok) throw new Error(`auth list ${res.status}`)
    const json = (await res.json()) as { users?: { localId?: string }[]; nextPageToken?: string }
    for (const user of json.users ?? []) {
      if (typeof user.localId === 'string') ids.push(user.localId)
    }
    const next = json.nextPageToken ?? ''
    if (!next || seen.has(next)) return ids
    seen.add(next)
    pageToken = next
  }
}

async function deleteAuthUser(localId: string): Promise<void> {
  const res = await fetch(
    `http://${authHost()}/identitytoolkit.googleapis.com/v1/projects/${DEMO_PROJECT}/accounts:delete`,
    {
      method: 'POST',
      headers: ownerHeaders(),
      body: JSON.stringify({ localId }),
    },
  )
  if (!res.ok) throw new Error(`auth delete ${res.status}`)
  await drain(res)
}

async function seedPrivate(uid: string): Promise<void> {
  const path = `userPrivate/${encodeURIComponent(uid)}`
  const res = await fetch(docUrl(path), {
    method: 'PATCH',
    headers: ownerHeaders(),
    body: JSON.stringify({ fields: { lifecycleFixture: { stringValue: PRIVATE_FIXTURE } } }),
  })
  if (!res.ok) throw new Error(`seed userPrivate ${res.status}`)
  await drain(res)
}

async function privateFixture(uid: string): Promise<string | null> {
  const res = await fetch(docUrl(`userPrivate/${encodeURIComponent(uid)}`), { headers: ownerHeaders() })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`read userPrivate ${res.status}`)
  const json = (await res.json()) as { fields?: { lifecycleFixture?: { stringValue?: string } } }
  return json.fields?.lifecycleFixture?.stringValue ?? null
}

async function docExists(path: string): Promise<boolean> {
  const res = await fetch(docUrl(path), { headers: ownerHeaders() })
  if (res.status === 404) return false
  if (!res.ok) throw new Error(`read fixture document ${res.status}`)
  await drain(res)
  return true
}

async function deleteDoc(path: string): Promise<void> {
  const res = await fetch(docUrl(path), { method: 'DELETE', headers: ownerHeaders() })
  if (!res.ok && res.status !== 404) throw new Error(`delete fixture document ${res.status}`)
  await drain(res)
}

async function markLifecycleDeleted(uid: string): Promise<void> {
  const res = await fetch(docUrl(`guestLifecycle/${encodeURIComponent(uid)}`), {
    method: 'PATCH',
    headers: ownerHeaders(),
    body: JSON.stringify({ fields: { status: { stringValue: 'deleted' } } }),
  })
  if (!res.ok) throw new Error(`marker guestLifecycle ${res.status}`)
  await drain(res)
}

async function lifecycleStatus(uid: string): Promise<string | null> {
  const res = await fetch(docUrl(`guestLifecycle/${encodeURIComponent(uid)}`), { headers: ownerHeaders() })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`read guestLifecycle ${res.status}`)
  const json = (await res.json()) as { fields?: { status?: { stringValue?: string } } }
  return json.fields?.status?.stringValue ?? null
}

/** 수신 활동 핑 — guestLifecycle/{uid}.lastActivityAtMs. 문서나 필드가 없으면 null(늘지 않는다). */
async function lastActivityAtMs(uid: string): Promise<number | null> {
  const res = await fetch(docUrl(`guestLifecycle/${encodeURIComponent(uid)}`), { headers: ownerHeaders() })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`read guestLifecycle activity ${res.status}`)
  const json = (await res.json()) as { fields?: { lastActivityAtMs?: { integerValue?: string; doubleValue?: number } } }
  const field = json.fields?.lastActivityAtMs
  if (!field) return null
  if (typeof field.integerValue === 'string') return Number(field.integerValue)
  if (typeof field.doubleValue === 'number') return field.doubleValue
  return null
}

/** 동행 membership — members collection group 문서 경로들(demo REST runQuery). */
async function membershipDocPaths(): Promise<string[]> {
  const res = await fetch(runQueryUrl(), {
    method: 'POST',
    headers: ownerHeaders(),
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'members', allDescendants: true }],
        limit: 1000,
      },
    }),
  })
  if (!res.ok) throw new Error(`members group query ${res.status}`)
  const rows = (await res.json()) as { document?: { name?: string } }[]
  return rows.map((row) => row.document?.name ?? '').filter(Boolean)
}

/** RTDB motion 노드 있는 trail 목록(shallow). */
async function trailsShallow(): Promise<string[]> {
  const ns = `${DEMO_PROJECT}-default-rtdb`
  const res = await fetch(`http://${databaseHost()}/trails.json?shallow=true&ns=${ns}`, { headers: ownerHeaders() })
  if (!res.ok) throw new Error(`rtdb trails ${res.status}`)
  const json = (await res.json()) as Record<string, unknown> | null
  return Object.keys(json ?? {})
}

/** RTDB trails/{trailId}/motion/{uid} 실측 — JSON 결과가 실제 null(부재)일 때만 true. */
async function motionNodeAbsent(uid: string, trailId: string): Promise<boolean> {
  const ns = `${DEMO_PROJECT}-default-rtdb`
  const res = await fetch(
    `http://${databaseHost()}/trails/${encodeURIComponent(trailId)}/motion/${encodeURIComponent(uid)}.json?ns=${ns}`,
    { headers: ownerHeaders() },
  )
  if (!res.ok) throw new Error(`rtdb motion ${res.status}`)
  const json = (await res.json()) as unknown
  return json === null || json === undefined
}

function addedCount(before: string[], after: string[]): number {
  const known = new Set(before)
  return after.filter((id) => !known.has(id)).length
}

function onlyAdded(before: string[], after: string[]): string | null {
  const known = new Set(before)
  const added = after.filter((id) => !known.has(id))
  return added.length === 1 ? added[0] : null
}

async function startOneGuest(page: Page, before: string[]): Promise<string> {
  await page.goto('/')
  await expect(page.getByRole('region', { name: '앱 소개' })).toBeVisible()
  expect(addedCount(before, await listLocalIds()), 'auth before explicit start').toBe(0)
  await guestStart(page)
  await expect(page.getByRole('button', { name: '사용자 정보' })).toBeVisible()
  const created = onlyAdded(before, await listLocalIds())
  expect(created, 'expected exactly one new auth user').not.toBeNull()
  expect(await readGuestUid(page) === created, 'indexedDB uid is not the new auth user').toBe(true)
  return created as string
}

/**
 * 종료된 이후의 시작 메뉴 — 로그인/게스트로 시작 두 개 계약. 종료 전 계약 문구
 * (로그아웃되었습니다 등)는 나오지 않는다. 제품이 이름 미반영이면 이 기대로 실패한다.
 */
async function expectStartMenu(page: Page): Promise<void> {
  await expect(page.getByRole('button', { name: '게스트로 시작' })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('button', { name: '로그인', exact: true })).toBeVisible()
  await expect(page.getByText('로그아웃되었습니다.', { exact: true })).toHaveCount(0)
}

async function endSession(page: Page): Promise<void> {
  await page.getByRole('button', { name: '사용자 정보' }).click()
  const sheet = page.getByRole('dialog', { name: '사용자 정보' })
  await sheet.getByRole('button', { name: '종료', exact: true }).click()
  await expect(sheet).toBeHidden({ timeout: 15_000 })
  await expectStartMenu(page)
}

/**
 * 시작 메뉴의 게스트로 시작 — 유효한 기존 Guest 를 재사용해야 하므로 계정은 늘지 않는다.
 * 클릭 뒤의 복귀 대기는 guestStart 가 pending(연결 중…/로그인 중…)을 계속 폴링해
 * gate/account 에 정착할 때까지 기다린다(rideEntryHelpers.guestStart 계약).
 */
async function guestStartFromMenu(page: Page): Promise<void> {
  const button = page.getByRole('button', { name: '게스트로 시작' })
  await expect(button).toBeVisible({ timeout: 30_000 })
  await button.click()
  await guestStart(page)
}

/** 종료 상태가 결핍을 유지하는 것들(membership·presence 재생성 0)을 확정한다. */
async function expectNoMembershipOrPresence(page: Page, uid: string): Promise<void> {
  await expect
    .poll(async () => (await membershipDocPaths()).some((name) => name.endsWith(`/${uid}`)), {
      timeout: 15_000,
      message: '종료 뒤에 members membership 문서가 (재)생성됐다',
    })
    .toBe(false)
  for (const trailId of await trailsShallow()) {
    await expect
      .poll(async () => motionNodeAbsent(uid, trailId), {
        timeout: 15_000,
        message: 'trail motion 노드는 종료 뒤에도 남아 있다',
      })
      .toBe(true)
  }
  await expect
    .poll(async () => (await docExists(`livePresence/${encodeURIComponent(uid)}`)), {
      timeout: 15_000,
      message: '종료 뒤 livePresence 문서가 남아 있다',
    })
    .toBe(false)
}

test.describe('guest lifecycle firebase sdk', () => {
  test.describe.configure({ mode: 'serial' })
  test.skip(gate === 'skip', 'demo localhost emulator is not configured')
  test.beforeAll(() => {
    if (gate === 'block') {
      throw new Error('guest lifecycle e2e refuses a non-localhost emulator host or a project other than demo-boxcycle-guest')
    }
  })

  test('최초 진입은 명시 Guest 한 명이고 새로고침해도 같은 계정이다', async ({ page }) => {
    const before = await listLocalIds()
    const created = await startOneGuest(page, before)
    await page.reload()
    await expect(page.getByRole('button', { name: '사용자 정보' })).toBeVisible()
    expect(addedCount(before, await listLocalIds()), 'auth count after refresh').toBe(1)
    expect(await readGuestUid(page) === created, 'uid changed on refresh').toBe(true)
  })

  test('종료를 반복해도 같은 Guest 한 명을 재사용하고 계정 추가·활동 핑·presence 를 만들지 않는다', async ({ page }) => {
    const before = await listLocalIds()
    const created = await startOneGuest(page, before)
    await seedPrivate(created)

    for (let round = 1; round <= 3; round += 1) {
      await endSession(page)
      // 종료 자체는 계정을 만들지 않고, 개인 fixture 는 유지되어야 한다.
      expect(addedCount(before, await listLocalIds()), `round ${round} auth count after ending`).toBe(1)
      expect(await privateFixture(created), `round ${round} private fixture after ending`).toBe(PRIVATE_FIXTURE)
      expect((await readGuestUid(page)) === created, `round ${round} uid kept after ending`).toBe(true)

      // 종료 중 상태 — 새로고침/새 탭도 시작 메뉴만 주고 계정을 만들지 않는다.
      await page.reload()
      await expectStartMenu(page)
      expect(addedCount(before, await listLocalIds()), `round ${round} auth count after refresh`).toBe(1)
      expect(await privateFixture(created), `round ${round} private fixture after refresh`).toBe(PRIVATE_FIXTURE)
      const tab = await page.context().newPage()
      await tab.goto('/')
      await expectStartMenu(tab)
      expect(addedCount(before, await listLocalIds()), `round ${round} auth count in the new tab`).toBe(1)
      await tab.close()

      // 게스트로 시작 — 같은 UID 로 되돌아간다(기존 Guest 재사용 계약).
      await guestStartFromMenu(page)
      await expect(page.getByRole('button', { name: '사용자 정보' })).toBeVisible()
      expect(addedCount(before, await listLocalIds()), `round ${round} auth count after explicit start`).toBe(1)
      expect((await readGuestUid(page)) === created, `round ${round} uid changed after explicit start`).toBe(true)
    }

    // 종료된 상태가 유지되는 동안 membership/presence 만들기가 없어야 한다.
    await endSession(page)
    await expectNoMembershipOrPresence(page, created)

    // 활동 heartbeat 정지 — 새 탭 clock 가속으로 5분 간격 2칸 건너뛴 뒤 콜·기록 불변.
    await expectNoActivityHeartbeat(page, created)
    expect(await privateFixture(created), 'private fixture still kept').toBe(PRIVATE_FIXTURE)
  })

  test('삭제된 Guest 는 만료 안내로 돌아오고 명시 시작만 새 계정을 만든다', async ({ page }) => {
    const before = await listLocalIds()
    const created = await startOneGuest(page, before)
    await page.evaluate((key) => localStorage.setItem(key, 'preserve'), OTHER_CACHE_KEY)
    await seedPrivate(created)
    await deleteAuthUser(created)
    await deleteDoc(`users/${created}`)
    await deleteDoc(`userPrivate/${created}`)
    await markLifecycleDeleted(created)
    await markBlocked(created)
    expect(await lifecycleStatus(created), 'deleted marker missing').toBe('deleted')

    const afterDelete = await listLocalIds()
    expect(afterDelete.includes(created), 'deleted auth user still listed').toBe(false)

    await page.reload()
    await expect(page.getByText(EXPIRY_TEXT)).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('연결 중…')).toHaveCount(0)
    await expect(page.getByText('로그인 중…')).toHaveCount(0)
    expect(addedCount(afterDelete, await listLocalIds()), 'automatic auth after refresh').toBe(0)
    expect(await docExists(`users/${created}`), 'old users doc recreated').toBe(false)
    expect(await privateFixture(created), 'old userPrivate recreated').toBeNull()
    expect(await lifecycleStatus(created), 'deleted marker changed').toBe('deleted')
    expect(await page.evaluate((key) => localStorage.getItem(key), OTHER_CACHE_KEY), 'other uid cache cleared').toBe('preserve')

    const tab = await page.context().newPage()
    await tab.goto('/')
    await expect(tab.getByText(EXPIRY_TEXT)).toBeVisible({ timeout: 30_000 })
    expect(addedCount(afterDelete, await listLocalIds()), 'automatic auth in the new tab').toBe(0)
    expect(await tab.evaluate((key) => localStorage.getItem(key), OTHER_CACHE_KEY), 'other uid cache cleared in the new tab').toBe('preserve')
    await tab.close()

    await guestStart(page)
    const again = onlyAdded(afterDelete, await listLocalIds())
    expect(again, 'expected exactly one new auth user after explicit start').not.toBeNull()
    expect(again === created, 'explicit start reused the deleted auth user').toBe(false)
    expect(await readGuestUid(page) === again, 'indexedDB uid is not the new auth user').toBe(true)
    expect(await docExists(`users/${created}`), 'old users doc recreated after new start').toBe(false)
    expect(await privateFixture(created), 'old userPrivate recreated after new start').toBeNull()
  })

  test('offline 게스트 시작은 새 계정을 만들지 않고 복구 뒤 같은 Guest 에 돌아온다', async ({ page }) => {
    const before = await listLocalIds()
    const created = await startOneGuest(page, before)
    // 생성 후 snapshot — offline/복구 구간의 증가 비교는 이 기준으로만 한다.
    const afterCreated = await listLocalIds()
    expect(addedCount(before, afterCreated), 'auth count after guest creation').toBe(1)
    await endSession(page)
    expect(addedCount(before, await listLocalIds()), 'auth count before offline start').toBe(1)

    // 실제 network 차단 — 시작 메뉴의 게스트로 시작은 새 계정을 만들지 않아야 한다(forceclick 금지).
    await page.context().setOffline(true)
    const offlineButton = page.getByRole('button', { name: '게스트로 시작' })
    await expect(offlineButton).toBeVisible({ timeout: 30_000 })
    await offlineButton.click()
    await expect(page.getByRole('button', { name: '게스트로 시작' })).toBeVisible({ timeout: 30_000 })
    // 확정은 서버 REST 계정 목록으로 본다 — UI 텍스트는 이 검증의 대상이 아니다.
    // 기준이 생성 후 snapshot이므로 "기존 계정이 유지된 채 증가 0"이 아니라 증가만 0으로 검사한다.
    await expect
      .poll(async () => addedCount(afterCreated, await listLocalIds()), {
        timeout: 15_000,
        message: 'offline 게스트 시작이 새 계정을 만들었다',
      })
      .toBe(0)
    expect(await listLocalIds(), '기존 Guest 계정이 offline 구간에 사라졌다').toEqual(expect.arrayContaining(afterCreated))

    // network 복구 후 시작 — 증가 0(재사용)이고 uid 는 그 Guest 이다.
    await page.context().setOffline(false)
    const button = page.getByRole('button', { name: '게스트로 시작' })
    await expect(button).toBeVisible({ timeout: 30_000 })
    await button.click()
    await guestStart(page)
    await expect(page.getByRole('button', { name: '사용자 정보' })).toBeVisible()
    expect(addedCount(afterCreated, await listLocalIds()), 'auth count after recovery').toBe(0)
    expect(addedCount(before, await listLocalIds()), '전체 계정은 여전히 이 시험의 한 명이다').toBe(1)
    expect((await readGuestUid(page)) === created, 'uid changed after recovery').toBe(true)
  })
})
