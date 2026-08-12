import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

/**
 * S4-1 — route in-flight 제거 before/after.
 * S41_PHASE=before|after · S41_RUN=1|2|3
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.resolve(__dirname, '../../../document/ops/sync-relay')
const WEB_ROOT = path.resolve(__dirname, '..')
const GEO_STOP_M = 900
const PHASE = (process.env.S41_PHASE || 'after').toLowerCase() === 'before' ? 'before' : 'after'
const RUN = Math.min(3, Math.max(1, Number(process.env.S41_RUN || '1')))
const EVENTS_NAME = `S41-${PHASE}-run${RUN}-events.json`

async function guestStart(page: import('@playwright/test').Page) {
  const gate = page.getByRole('dialog', { name: '시작' })
  await expect(gate).toBeVisible({ timeout: 30_000 })
  await gate.getByRole('button', { name: '시작', exact: true }).click()
  await expect(gate).toBeHidden({ timeout: 30_000 })
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

async function openMapViewSheet(page: import('@playwright/test').Page) {
  const btn = page.getByRole('button', { name: '맵 뷰 설정' })
  await expect(btn).toBeVisible({ timeout: 15_000 })
  if ((await btn.getAttribute('aria-expanded')) !== 'true') {
    await btn.click()
  }
  await expect(page.getByRole('dialog', { name: '맵 뷰' })).toBeVisible({ timeout: 10_000 })
}

async function setMapZoom(page: import('@playwright/test').Page, zoom: number) {
  await openMapViewSheet(page)
  const slider = page.getByRole('slider', { name: /^줌 / })
  await expect(slider).toBeVisible({ timeout: 10_000 })
  await slider.fill(String(zoom))
  await page.waitForTimeout(400)
}

function attachChainCapture(page: import('@playwright/test').Page) {
  const lines: string[] = []
  page.on('console', (msg) => {
    const t = msg.text()
    if (t.includes('[peerSyncChain]')) lines.push(t)
  })
  return { lines }
}

type Ev = Record<string, string | number | null> & { pt: number; seq: number | null; side: 'A' | 'B'; raw: string }

function parseChainLine(text: string, side: 'A' | 'B'): Ev | null {
  if (!text.includes('[peerSyncChain]')) return null
  const body = text.slice(text.indexOf('[peerSyncChain]') + '[peerSyncChain]'.length).trim()
  const fields: Record<string, string> = {}
  for (const tok of body.split(/\s+/)) {
    const i = tok.indexOf('=')
    if (i <= 0) continue
    fields[tok.slice(0, i)] = tok.slice(i + 1)
  }
  const pt = Number(fields.pt)
  const seq = fields.seq != null ? Number(fields.seq) : null
  if (!Number.isFinite(pt)) return null
  const ev: Ev = { pt, seq: Number.isFinite(seq as number) ? (seq as number) : null, side, raw: text }
  for (const [k, v] of Object.entries(fields)) {
    if (k === 'pt' || k === 'seq') continue
    const n = Number(v)
    ev[k] = v === 'null' ? null : Number.isFinite(n) && v !== '' && !/^[a-zA-Z]/.test(v) ? n : v
  }
  return ev
}

function lastAuthDist(logs: string[]): number | null {
  let last: number | null = null
  for (const line of logs) {
    if (!line.includes('pt=1')) continue
    const m = line.match(/\bauthDist=([-\d.]+)/)
    if (m) last = Number(m[1])
  }
  return last != null && Number.isFinite(last) ? last : null
}

async function clocks(
  pageA: import('@playwright/test').Page,
  pageB: import('@playwright/test').Page,
) {
  const a = await pageA.evaluate(() => Date.now())
  const b = await pageB.evaluate(() => Date.now())
  return { a, b }
}

test.describe('S4-1 route in-flight', () => {
  test.setTimeout(360_000)

  test(`z15 + path B + writes (${PHASE} run ${RUN})`, async ({ browser }) => {
    const started = Date.now()
    const ctxA = await browser.newContext()
    const ctxB = await browser.newContext()
    const pageA = await ctxA.newPage()
    const pageB = await ctxB.newPage()
    const capA = attachChainCapture(pageA)
    const capB = attachChainCapture(pageB)

    const tA0 = await pageA.evaluate(() => Date.now())
    const tB0 = await pageB.evaluate(() => Date.now())
    const skewBefore = tB0 - tA0

    await pageA.goto('/?peerSyncLogMs=200')
    await guestStart(pageA)
    await loadIntroCourse(pageA)
    await ensureRiding(pageA)

    await expect
      .poll(async () => new URL(pageA.url()).searchParams.get('trail'), { timeout: 20_000 })
      .not.toBeNull()
    const trailId = new URL(pageA.url()).searchParams.get('trail')!

    await pageB.goto(`/?trail=${encodeURIComponent(trailId)}&peerSyncLogMs=200`)
    await guestStart(pageB)
    await expect(pageB.getByRole('button', { name: '주행 시작' })).toBeVisible({ timeout: 45_000 })

    await expect.poll(() => capB.lines.some((l) => l.includes('[peerSyncChain] pt=4')), {
      timeout: 45_000,
    }).toBe(true)

    await setSpeedKmh(pageA, 5)

    const cases: Record<string, { start: { a: number; b: number }; end: { a: number; b: number } }> =
      {}
    const pathA: {
      lowZoomStart?: { a: number; b: number }
      restoreStart?: { a: number; b: number }
      restoreEnd?: { a: number; b: number }
    } = {}

    const departStart = await clocks(pageA, pageB)
    await pageA.waitForTimeout(2_000)
    await setSpeedKmh(pageA, 30)

    // Path A — S3B-3 동일 조건 (회귀·경로 B 기준선 유지용)
    pathA.lowZoomStart = await clocks(pageA, pageB)
    await setMapZoom(pageB, 13)
    await pageA.waitForTimeout(15_000)
    pathA.restoreStart = await clocks(pageA, pageB)
    const peerLinesBeforeRestore = capB.lines.length
    await setMapZoom(pageB, 15)
    await pageA.waitForTimeout(2_000)
    pathA.restoreEnd = await clocks(pageA, pageB)

    const auth0 = lastAuthDist(capA.lines) ?? 0
    const departDeadline = Date.now() + 40_000
    while (Date.now() < departDeadline) {
      const auth = lastAuthDist(capA.lines)
      if (auth != null && auth >= GEO_STOP_M) break
      const elapsed = Date.now() - departStart.a
      const delta = auth != null ? auth - auth0 : 0
      if (elapsed >= 26_000 && delta >= 100) break
      await pageA.waitForTimeout(500)
    }
    cases['z15-depart'] = { start: departStart, end: await clocks(pageA, pageB) }

    const cruiseStart = await clocks(pageA, pageB)
    await pageA.waitForTimeout(24_000)
    cases['z15-cruise'] = { start: cruiseStart, end: await clocks(pageA, pageB) }

    const tA1 = await pageA.evaluate(() => Date.now())
    const tB1 = await pageB.evaluate(() => Date.now())
    const skewAfter = tB1 - tA1

    const events: Ev[] = []
    for (const line of capA.lines) {
      const e = parseChainLine(line, 'A')
      if (e) events.push(e)
    }
    for (const line of capB.lines) {
      const e = parseChainLine(line, 'B')
      if (e) events.push(e)
    }

    const publisherUid =
      events.find((e) => e.side === 'A' && e.pt === 1 && typeof e.uid === 'string')?.uid ?? null

    const elapsedMin = Math.round(((Date.now() - started) / 60_000) * 10) / 10
    fs.mkdirSync(OUT_DIR, { recursive: true })
    fs.writeFileSync(
      path.join(OUT_DIR, EVENTS_NAME),
      JSON.stringify(
        {
          instruction: 'S4-1',
          phase: PHASE,
          run: RUN,
          elapsedMin,
          trailId,
          publisherUid,
          clockSkewBefore: skewBefore,
          clockSkewAfter: skewAfter,
          clockRangeB: { start: tB0, end: tB1 },
          cases,
          pathA: { ...pathA, peerLinesBeforeRestore },
          events,
        },
        null,
        2,
      ),
      'utf8',
    )

    if (PHASE === 'after' && RUN === 3) {
      const sum = spawnSync(process.execPath, ['scripts/peer-sync/s41-summarize.mjs'], {
        cwd: WEB_ROOT,
        encoding: 'utf8',
      })
      if (sum.status !== 0) {
        throw new Error(`s41 summarize failed: ${sum.stderr || sum.stdout}`)
      }
    }

    await ctxA.close()
    await ctxB.close()

    expect(events.length).toBeGreaterThan(50)
    expect(events.some((e) => e.pt === 9)).toBe(true)
    expect(events.some((e) => e.pt === 11)).toBe(true)
  })
})
