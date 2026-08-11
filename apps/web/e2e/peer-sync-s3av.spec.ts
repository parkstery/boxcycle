import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

/**
 * S3A-V — 증상 종결 검증 (측정 전용). src 미변경.
 * 산출: document/ops/sync-relay/S3AV-chain-events.json · S3AV-summary.json
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.resolve(__dirname, '../../../document/ops/sync-relay')
const WEB_ROOT = path.resolve(__dirname, '..')
const GEO_STOP_M = 900

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

async function setFollowFree(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: '맵 뷰 설정' }).click()
  await page.locator('.map-view-sheet__chip', { hasText: 'free' }).click()
  await page.keyboard.press('Escape')
}

async function zoomOutWheels(page: import('@playwright/test').Page, n = 16) {
  const canvas = page.locator('.mapboxgl-canvas').first()
  await expect(canvas).toBeVisible()
  const box = await canvas.boundingBox()
  if (!box) throw new Error('no canvas')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  for (let i = 0; i < n; i++) {
    await page.mouse.wheel(0, 800)
    await page.waitForTimeout(120)
  }
}

function attachChainCapture(page: import('@playwright/test').Page) {
  const lines: string[] = []
  page.on('console', (msg) => {
    const t = msg.text()
    if (t.includes('[peerSyncChain]')) lines.push(t)
  })
  return lines
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

test.describe('S3A-V end-to-end screen error', () => {
  test.setTimeout(300_000)

  test('z15-depart · z15-cruise 판정 + z13 기록', async ({ browser }) => {
    const started = Date.now()
    const ctxA = await browser.newContext()
    const ctxB = await browser.newContext()
    const pageA = await ctxA.newPage()
    const pageB = await ctxB.newPage()
    const logsA = attachChainCapture(pageA)
    const logsB = attachChainCapture(pageB)

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
    await ensureRiding(pageB)

    await expect.poll(() => logsB.some((l) => l.includes('[peerSyncChain] pt=4')), {
      timeout: 45_000,
    }).toBe(true)

    await setSpeedKmh(pageA, 5)
    await setSpeedKmh(pageB, 5)

    const cases: Record<string, { start: { a: number; b: number }; end: { a: number; b: number } }> =
      {}

    // —— z15-depart: 램프 포함, 앞 2s 는 집계에서 폐기. 창≥20s · Δ≥100m 까지
    const departStart = await clocks(pageA, pageB)
    await pageA.waitForTimeout(2_000)
    await setSpeedKmh(pageA, 30)
    await setSpeedKmh(pageB, 30)
    const auth0 = lastAuthDist(logsA) ?? 0
    const departDeadline = Date.now() + 50_000
    while (Date.now() < departDeadline) {
      const auth = lastAuthDist(logsA)
      if (auth != null && auth >= GEO_STOP_M) break
      const elapsed = Date.now() - departStart.a
      const delta = auth != null ? auth - auth0 : 0
      if (elapsed >= 22_000 && delta >= 100) break
      await pageA.waitForTimeout(500)
    }
    cases['z15-depart'] = { start: departStart, end: await clocks(pageA, pageB) }

    // —— z15-cruise: 이미 30, 앞 2s 폐기 후 ≥22s
    const cruiseStart = await clocks(pageA, pageB)
    await pageA.waitForTimeout(24_000)
    cases['z15-cruise'] = { start: cruiseStart, end: await clocks(pageA, pageB) }

    // —— z13: 판정 제외 · 기록만
    const z13Start = await clocks(pageA, pageB)
    await setFollowFree(pageB)
    await zoomOutWheels(pageB, 18)
    await pageA.waitForTimeout(12_000)
    cases['z13'] = { start: z13Start, end: await clocks(pageA, pageB) }

    const tA1 = await pageA.evaluate(() => Date.now())
    const tB1 = await pageB.evaluate(() => Date.now())
    const skewAfter = tB1 - tA1

    const events: Ev[] = []
    for (const line of logsA) {
      const e = parseChainLine(line, 'A')
      if (e) events.push(e)
    }
    for (const line of logsB) {
      const e = parseChainLine(line, 'B')
      if (e) events.push(e)
    }

    const publisherUid =
      events.find((e) => e.side === 'A' && e.pt === 1 && typeof e.uid === 'string')?.uid ?? null

    const elapsedMin = Math.round(((Date.now() - started) / 60_000) * 10) / 10
    fs.mkdirSync(OUT_DIR, { recursive: true })
    fs.writeFileSync(
      path.join(OUT_DIR, 'S3AV-chain-events.json'),
      JSON.stringify(
        {
          instruction: 'S3A-V',
          elapsedMin,
          trailId,
          publisherUid,
          clockSkewBefore: skewBefore,
          clockSkewAfter: skewAfter,
          clockRangeB: { start: tB0, end: tB1 },
          cases,
          events,
        },
        null,
        2,
      ),
      'utf8',
    )

    const sum = spawnSync(
      process.execPath,
      ['scripts/peer-sync/s3av-summarize.mjs', 'S3AV-chain-events.json', 'S3AV-summary.json'],
      { cwd: WEB_ROOT, encoding: 'utf8' },
    )
    if (sum.status !== 0) {
      throw new Error(`s3av summarize failed: ${sum.stderr || sum.stdout}`)
    }

    await ctxA.close()
    await ctxB.close()

    expect(events.length, 'pt1~pt7 전량').toBeGreaterThan(50)
  })
})
