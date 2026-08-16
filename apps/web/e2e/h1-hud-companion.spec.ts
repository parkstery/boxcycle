import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

/**
 * H-1 — 같은 Trail 2인 주행 HUD 동행 진단.
 * 산출: H1-hud-diag.json (before) / H1-hud-diag-after.json + H1-shots/ (after)
 * 재현이 5분을 넘으면 즉시 실패하고 브라우저를 붙들지 않는다.
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.resolve(__dirname, '../../../document/ops/sync-relay')
const SHOT_DIR = path.join(OUT_DIR, 'H1-shots')
const PHASE = process.env.H1_PHASE === 'after' ? 'after' : 'before'
const WALL_MS = 5 * 60_000

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

async function ensureDockExpanded(page: import('@playwright/test').Page) {
  await ensureRiding(page)
  const fold = page.getByRole('button', { name: '경로 패널 접기' })
  if (!(await fold.isVisible().catch(() => false))) {
    await page.getByRole('button', { name: '경로 패널 펼치기' }).click()
  }
  await expect(page.getByRole('slider', { name: '세션 속도 km/h' })).toBeVisible({
    timeout: 10_000,
  })
}

async function setSpeedKmh(page: import('@playwright/test').Page, kmh: number) {
  await ensureDockExpanded(page)
  await page.getByRole('slider', { name: '세션 속도 km/h' }).fill(String(kmh))
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
    await loadIntroCourse(pageA)
    abortIfLate('A course')
    await ensureRiding(pageA)
    abortIfLate('A riding')
    await closeMenuIfOpen(pageA)
    await setSpeedKmh(pageA, 20)

    await expect
      .poll(async () => new URL(pageA.url()).searchParams.get('trail'), { timeout: 20_000 })
      .not.toBeNull()
    const trailId = new URL(pageA.url()).searchParams.get('trail')!

    const soloA = await readDiag(pageA)
    fs.mkdirSync(SHOT_DIR, { recursive: true })
    const soloShot = path.join(SHOT_DIR, PHASE === 'after' ? 'v4-solo-a.png' : 'before-solo-a.png')
    await shotHud(pageA, soloShot)
    const soloEmptyCopy = await pageA.locator('.hud-ride-presence__empty').allTextContents()

    await pageB.goto(`/?trail=${encodeURIComponent(trailId)}`)
    abortIfLate('B goto')
    await guestStart(pageB)
    abortIfLate('B guest')
    await expect(pageB.getByRole('button', { name: '주행 시작' })).toBeVisible({ timeout: 45_000 })
    await ensureRiding(pageB)
    abortIfLate('B riding')
    await closeMenuIfOpen(pageB)
    await setSpeedKmh(pageB, 20)

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

    let dualA = await readDiag(pageA)
    let dualB = await readDiag(pageB)

    const shotA = path.join(SHOT_DIR, PHASE === 'after' ? 'v2v3-dual-a.png' : 'before-dual-a.png')
    const shotB = path.join(SHOT_DIR, PHASE === 'after' ? 'v2v3-dual-b.png' : 'before-dual-b.png')
    await shotHud(pageA, shotA)
    await shotHud(pageB, shotB)

    if (PHASE === 'after') {
      // V2: TTL(=active poll 60s) 경과 후 양쪽이 같은 인원수를 읽게 한다
      await pageA.waitForTimeout(65_000)
      abortIfLate('ttl')
      dualA = await readDiag(pageA)
      dualB = await readDiag(pageB)
      await shotHud(pageA, shotA)
      await shotHud(pageB, shotB)
    }

    const emptyCopyA = await pageA.locator('.hud-ride-presence__empty').allTextContents()
    const emptyCopyB = await pageB.locator('.hud-ride-presence__empty').allTextContents()
    const activityA = await pageA.locator('.hud-ride-presence__activity').allTextContents()
    const activityB = await pageB.locator('.hud-ride-presence__activity').allTextContents()

    const hashes: Record<string, string> = {}
    for (const p of [soloShot, shotA, shotB]) {
      hashes[path.basename(p)] = sha256(p)
    }

    const payload = {
      instruction: 'H-1',
      phase: PHASE,
      elapsedMs: Date.now() - started,
      trailId,
      soloA,
      dualA,
      dualB,
      hudText: {
        soloEmptyCopy,
        emptyCopyA,
        emptyCopyB,
        activityA,
        activityB,
      },
      shots: hashes,
      section22: {
        coursePeerHudALength: dualA.coursePeerHud.length,
        coursePeerHudBLength: dualB.coursePeerHud.length,
        coursePeerHudEmpty: dualA.coursePeerHud.length === 0 && dualB.coursePeerHud.length === 0,
        publicationIds: {
          aSelf: dualA.publicationId,
          bSelf: dualB.publicationId,
          aLiveRows: dualA.liveRideRows.map((r) => r.publicationId),
          bLiveRows: dualB.liveRideRows.map((r) => r.publicationId),
        },
      },
    }

    const outName = PHASE === 'after' ? 'H1-hud-diag-after.json' : 'H1-hud-diag.json'
    fs.mkdirSync(OUT_DIR, { recursive: true })
    fs.writeFileSync(path.join(OUT_DIR, outName), JSON.stringify(payload, null, 2), 'utf8')

    if (PHASE === 'after') {
      const hashValues = Object.values(hashes)
      const unique = new Set(hashValues)
      expect(unique.size, 'H1-shots 해시가 서로 달라야 한다').toBe(hashValues.length)
      expect(soloEmptyCopy, 'V4 혼자 주행').toContain('다른 라이더 없음')
      expect(emptyCopyA, 'V3 A 동행 빈 문장').not.toContain('다른 라이더 없음')
      expect(emptyCopyB, 'V3 B 동행 빈 문장').not.toContain('다른 라이더 없음')
      expect(dualA.routeActivity.activeRiderCount, 'V2 인원수').toBe(
        dualB.routeActivity.activeRiderCount,
      )
      const pollMs = 60_000
      expect(dualA.routeActivity.getDocCount, 'V5 A getDoc ≤ 폴링당 1').toBeLessThanOrEqual(
        Math.max(1, Math.ceil((Date.now() - started) / pollMs)),
      )
      expect(dualB.routeActivity.getDocCount, 'V5 B getDoc ≤ 폴링당 1').toBeLessThanOrEqual(
        Math.max(1, Math.ceil((Date.now() - started) / pollMs)),
      )
    }

    await ctxA.close()
    await ctxB.close()
  })
})
