import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

/**
 * H-1R — 같은 Trail 2인 주행 HUD 동행 진단.
 * 산출: H1-hud-diag.json (before) / H1-hud-diag-after.json + H1-shots/ (after)
 * 재현이 5분을 넘으면 즉시 실패하고 브라우저를 붙들지 않는다.
 * Chief Trail 403 은 저장소에 trailId 가 없어 맞출 수 없으면 그 사실을 after.json 에 기록한다.
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.resolve(__dirname, '../../../document/ops/sync-relay')
const SHOT_DIR = path.join(OUT_DIR, 'H1-shots')
const PHASE = process.env.H1_PHASE === 'after' ? 'after' : 'before'
const WALL_MS = 5 * 60_000
/** 2인 실 Firebase 재현 — 기본 e2e 에서는 skip. 수용 게이트에서만 켠다. */
const LIVE = process.env.RIDE_VERIFY_LIVE === '1' || process.env.H1_LIVE === '1'

type HudDiag = {
  atMs: number
  source: string
  coursePeerHud: { id: string; label: string }[]
  activeTrailMemberUids: string[]
  coursePeerNamesLength: number
  publicationId: string | null
  liveRideRows: { uid: string; publicationId: string }[]
  motionRowsLength: number
  motionPeersAfterPidFilter: number
  routeActivity: {
    publicationId: string | null
    activeRiderCount: number | null
    liveNow: boolean | null
    firstFetchAtMs: number | null
    lastGetDocAtMs: number | null
    lastCacheHitAtMs: number | null
    getDocCount: number
    cacheHitCount: number
    inflightJoinCount: number
  }
}

async function guestStart(page: import('@playwright/test').Page) {
  const gate = page.getByRole('dialog', { name: '시작' })
  await expect(gate).toBeVisible({ timeout: 30_000 })
  await gate.getByRole('button', { name: '시작', exact: true }).click()
  await expect(gate).toBeHidden({ timeout: 30_000 })
}

/** SENSOR-2: 기본 manual 만으로는 Go 가 잠긴다. ride-entry 와 같은 셀렉터. */
async function prepareManualRideInput(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: /케이던스 센서/ }).click()
  const sheet = page.getByRole('dialog', { name: '케이던스 센서' })
  await expect(sheet).toBeVisible({ timeout: 10_000 })
  await sheet.getByRole('button', { name: '체험 속도로 준비' }).click()
  await sheet.getByRole('button', { name: '센서 설정 닫기' }).click()
  await expect(sheet).toBeHidden()
}

async function closeMenuIfOpen(page: import('@playwright/test').Page) {
  const menuBtn = page.getByRole('button', { name: 'Trail 메뉴' })
  if ((await menuBtn.getAttribute('aria-expanded')) === 'true') {
    await menuBtn.click()
    await expect(menuBtn).toHaveAttribute('aria-expanded', 'false')
  }
}

async function loadIntroCourse(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Trail 메뉴' }).click()
  await page.getByRole('button', { name: '입문' }).click()
  const modal = page.getByRole('dialog').filter({ has: page.locator('#oc-modal-title') })
  await expect(modal).toBeVisible({ timeout: 15_000 })
  const items = modal.locator('button.oc-modal__item')
  await expect(items.first()).toBeVisible()
  const n = await items.count()
  await items.nth(Math.max(0, n - 1)).click()
  await expect(page.getByRole('button', { name: '주행 시작' })).toBeVisible({ timeout: 20_000 })
  await closeMenuIfOpen(page)
}

async function dismissRideSummaryIfAny(page: import('@playwright/test').Page) {
  const summary = page.getByRole('dialog', { name: '주행 결과' })
  if (!(await summary.isVisible().catch(() => false))) return
  const skip = summary.getByRole('button', { name: '저장 안 함' })
  if (await skip.isVisible().catch(() => false)) await skip.click()
  else await summary.getByRole('button', { name: '닫기' }).first().click()
  await expect(summary).toBeHidden({ timeout: 10_000 })
}

async function ensureRiding(page: import('@playwright/test').Page) {
  await dismissRideSummaryIfAny(page)
  if (await page.getByRole('button', { name: '주행 종료' }).isVisible().catch(() => false)) return
  if (await page.getByRole('button', { name: '재개' }).first().isVisible().catch(() => false)) return
  const start = page.getByRole('button', { name: '주행 시작' })
  await expect(start).toBeVisible({ timeout: 20_000 })
  await start.click()
  await expect(page.getByRole('button', { name: '주행 종료' })).toBeVisible({ timeout: 30_000 })
}

async function setSpeedKmh(page: import('@playwright/test').Page, kmh: number) {
  await ensureRiding(page)
  await page.getByRole('button', { name: /케이던스 센서/ }).click()
  const sheet = page.getByRole('dialog', { name: '케이던스 센서' })
  await expect(sheet).toBeVisible({ timeout: 10_000 })
  await sheet.getByRole('slider', { name: '세션 속도 km/h' }).fill(String(kmh))
  await sheet.getByRole('button', { name: '센서 설정 닫기' }).click()
  await expect(sheet).toBeHidden()
}

async function readDiag(page: import('@playwright/test').Page): Promise<HudDiag> {
  await expect
    .poll(
      async () =>
        page.evaluate(
          () => typeof (window as Window & { __rtwHudDiag?: unknown }).__rtwHudDiag === 'function',
        ),
      { timeout: 15_000 },
    )
    .toBe(true)
  const diag = await page.evaluate(() => {
    const fn = (window as Window & { __rtwHudDiag?: () => HudDiag }).__rtwHudDiag
    if (typeof fn !== 'function') throw new Error('__rtwHudDiag missing')
    return fn()
  })
  return diag
}

async function shotHud(page: import('@playwright/test').Page, filePath: string) {
  const hud = page.locator('.hud-ride-presence')
  await expect(hud).toBeVisible({ timeout: 15_000 })
  await hud.screenshot({ path: filePath })
}

function sha256(filePath: string): string {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
}

test.describe('H-1 HUD companion diag', () => {
  test.skip(!LIVE, 'Firebase 2인 재현 필요 — RIDE_VERIFY_LIVE=1 또는 H1_LIVE=1')
  test.setTimeout(WALL_MS)

  test(`2인 동시 주행 계측 (${PHASE})`, async ({ browser }) => {
    const started = Date.now()
    const abortIfLate = (label: string) => {
      if (Date.now() - started > WALL_MS) {
        throw new Error(`H-1 재현 5분 초과 — ${label} 에서 정지`)
      }
    }

    const ctxA = await browser.newContext()
    const ctxB = await browser.newContext()
    const pageA = await ctxA.newPage()
    const pageB = await ctxB.newPage()

    await pageA.goto('/')
    abortIfLate('A goto')
    await guestStart(pageA)
    abortIfLate('A guest')
    await prepareManualRideInput(pageA)
    abortIfLate('A input')
    await loadIntroCourse(pageA)
    abortIfLate('A course')
    await ensureRiding(pageA)
    abortIfLate('A riding')
    await closeMenuIfOpen(pageA)
    await setSpeedKmh(pageA, 8)

    await expect
      .poll(async () => new URL(pageA.url()).searchParams.get('trail'), { timeout: 20_000 })
      .not.toBeNull()
    const trailId = new URL(pageA.url()).searchParams.get('trail')!

    const soloA = await readDiag(pageA)
    fs.mkdirSync(SHOT_DIR, { recursive: true })
    const soloShot = path.join(SHOT_DIR, PHASE === 'after' ? 'v4-solo-a.png' : 'before-solo-a.png')
    await shotHud(pageA, soloShot)
    const soloEmptyCopy = await pageA.locator('.hud-ride-presence__empty').allTextContents()
    const trailLabelA = (await pageA.locator('.hud-ride-presence__room').first().textContent())?.trim() ?? ''

    await pageB.goto(`/?trail=${encodeURIComponent(trailId)}`)
    abortIfLate('B goto')
    await guestStart(pageB)
    abortIfLate('B guest')
    await prepareManualRideInput(pageB)
    abortIfLate('B input')
    await expect(pageB.getByRole('button', { name: '주행 시작' })).toBeVisible({ timeout: 45_000 })
    await ensureRiding(pageB)
    abortIfLate('B riding')
    await closeMenuIfOpen(pageB)
    await setSpeedKmh(pageB, 8)

    await expect
      .poll(
        async () => {
          const a = await readDiag(pageA)
          const b = await readDiag(pageB)
          return Math.max(
            a.liveRideRows.length,
            b.liveRideRows.length,
            a.motionRowsLength,
            b.motionRowsLength,
          )
        },
        { timeout: 45_000 },
      )
      .toBeGreaterThanOrEqual(2)

    await pageA.waitForTimeout(4_000)
    abortIfLate('settle')
    await dismissRideSummaryIfAny(pageA)
    await dismissRideSummaryIfAny(pageB)
    await expect(pageA.getByRole('button', { name: '주행 종료' })).toBeVisible({ timeout: 5_000 })
    await expect(pageB.getByRole('button', { name: '주행 종료' })).toBeVisible({ timeout: 5_000 })

    const dualA = await readDiag(pageA)
    const dualB = await readDiag(pageB)
    await closeMenuIfOpen(pageA)
    await closeMenuIfOpen(pageB)

    const shotV3A = path.join(SHOT_DIR, PHASE === 'after' ? 'v3-dual-a.png' : 'before-dual-a.png')
    const shotV3B = path.join(SHOT_DIR, PHASE === 'after' ? 'v3-dual-b.png' : 'before-dual-b.png')
    await shotHud(pageA, shotV3A)
    await shotHud(pageB, shotV3B)

    const emptyCopyA = await pageA.locator('.hud-ride-presence__empty').allTextContents()
    const emptyCopyB = await pageB.locator('.hud-ride-presence__empty').allTextContents()
    const activityA = await pageA.locator('.hud-ride-presence__activity').allTextContents()
    const activityB = await pageB.locator('.hud-ride-presence__activity').allTextContents()
    const namesA = await pageA.locator('.hud-ride-presence__list li').allTextContents()
    const namesB = await pageB.locator('.hud-ride-presence__list li').allTextContents()

    let dualAfterTtlA = dualA
    let dualAfterTtlB = dualB
    const shotV2A = path.join(SHOT_DIR, 'v2-dual-a.png')
    const shotV2B = path.join(SHOT_DIR, 'v2-dual-b.png')

    if (PHASE === 'after') {
      // V2: TTL(=active poll 60s) 경과 후 양쪽 인원수를 읽는다. 불일치는 WARNING 으로만 기록.
      await pageA.waitForTimeout(65_000)
      abortIfLate('ttl')
      await dismissRideSummaryIfAny(pageA)
      await dismissRideSummaryIfAny(pageB)
      await closeMenuIfOpen(pageA)
      await closeMenuIfOpen(pageB)
      dualAfterTtlA = await readDiag(pageA)
      dualAfterTtlB = await readDiag(pageB)
      await shotHud(pageA, shotV2A)
      await shotHud(pageB, shotV2B)
    }

    const hashes: Record<string, string> = {}
    const shotPaths = PHASE === 'after' ? [soloShot, shotV3A, shotV3B, shotV2A, shotV2B] : [soloShot, shotV3A, shotV3B]
    for (const p of shotPaths) {
      hashes[path.basename(p)] = sha256(p)
    }

    const v2CountA = dualAfterTtlA.routeActivity.activeRiderCount
    const v2CountB = dualAfterTtlB.routeActivity.activeRiderCount
    const v2Pass = v2CountA != null && v2CountA === v2CountB
    const trailIsChief403 = /^Trail 403$/i.test(trailLabelA)

    const payload = {
      instruction: PHASE === 'after' ? 'H-1R' : 'H-1',
      phase: PHASE,
      elapsedMs: Date.now() - started,
      trailId,
      trailLabelA,
      chiefTrail403: {
        matched: trailIsChief403,
        reason: trailIsChief403
          ? 'HUD 라벨이 Trail 403'
          : '저장소에 Chief Trail 403 의 trailId 가 없고, 재현은 Trailhead 입문 코스 시작으로 새 Trail 이 생긴다. H-1 before 와 같은 경로.',
      },
      soloA,
      dualA,
      dualB,
      dualAfterTtlA: PHASE === 'after' ? dualAfterTtlA : undefined,
      dualAfterTtlB: PHASE === 'after' ? dualAfterTtlB : undefined,
      hudText: {
        soloEmptyCopy,
        emptyCopyA,
        emptyCopyB,
        activityA,
        activityB,
        namesA,
        namesB,
      },
      shots: hashes,
      observationsUnfixed: {
        aTrailMembers: dualA.activeTrailMemberUids.length,
        activityCountA: dualA.routeActivity.activeRiderCount,
        activityCountB: dualB.routeActivity.activeRiderCount,
        course: 'intro-course fresh trail — not Chief Trail 403 unless matched above',
      },
      section22: {
        coursePeerHudALength: dualA.coursePeerHud.length,
        coursePeerHudBLength: dualB.coursePeerHud.length,
        coursePeerHudEmpty: dualA.coursePeerHud.length === 0 && dualB.coursePeerHud.length === 0,
        liveRideRowCountA: dualA.liveRideRows.length,
        liveRideRowCountB: dualB.liveRideRows.length,
        publicationIds: {
          aSelf: dualA.publicationId,
          bSelf: dualB.publicationId,
          aLiveRows: dualA.liveRideRows.map((r) => r.publicationId),
          bLiveRows: dualB.liveRideRows.map((r) => r.publicationId),
        },
      },
      verdicts: PHASE === 'after'
        ? {
            V2: {
              pass: v2Pass,
              a: v2CountA,
              b: v2CountB,
              note: v2Pass ? '양쪽 인원수 일치' : 'WARNING — 집계 불일치는 이번 범위 밖. 기록만.',
            },
            V3a: { pass: !emptyCopyA.includes('다른 라이더 없음'), emptyCopyA },
            V3b: { pass: !emptyCopyB.includes('다른 라이더 없음'), emptyCopyB },
            V4: { pass: soloEmptyCopy.includes('다른 라이더 없음'), soloEmptyCopy },
            V5: {
              aGetDoc: dualAfterTtlA.routeActivity.getDocCount,
              bGetDoc: dualAfterTtlB.routeActivity.getDocCount,
            },
            V6: { shotHashUnique: new Set(Object.values(hashes)).size === Object.values(hashes).length },
          }
        : undefined,
    }

    const outName = PHASE === 'after' ? 'H1-hud-diag-after.json' : 'H1-hud-diag.json'
    fs.mkdirSync(OUT_DIR, { recursive: true })
    fs.writeFileSync(path.join(OUT_DIR, outName), JSON.stringify(payload, null, 2), 'utf8')

    if (PHASE === 'after') {
      const hashValues = Object.values(hashes)
      const unique = new Set(hashValues)
      expect(unique.size, 'V6 H1-shots 해시가 서로 달라야 한다').toBe(hashValues.length)
      expect(soloEmptyCopy, 'V4 혼자 주행').toContain('다른 라이더 없음')
      expect(emptyCopyA, 'V3 A 동행 빈 문장').not.toContain('다른 라이더 없음')
      expect(emptyCopyB, 'V3 B 동행 빈 문장').not.toContain('다른 라이더 없음')
      const pollMs = 60_000
      expect(dualAfterTtlA.routeActivity.getDocCount, 'V5 A getDoc ≤ 폴링당 1').toBeLessThanOrEqual(
        Math.max(1, Math.ceil((Date.now() - started) / pollMs)),
      )
      expect(dualAfterTtlB.routeActivity.getDocCount, 'V5 B getDoc ≤ 폴링당 1').toBeLessThanOrEqual(
        Math.max(1, Math.ceil((Date.now() - started) / pollMs)),
      )
    }

    await ctxA.close()
    await ctxB.close()
  })
})
