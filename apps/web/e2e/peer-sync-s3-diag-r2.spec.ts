import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

/**
 * S3-DIAG-R2 — pt1~pt7 전량 보존 + 시계 보정.
 * 산출: document/ops/sync-relay/S3R-chain-events.json · S3R-summary.json
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.resolve(__dirname, '../../../document/ops/sync-relay')
const WEB_ROOT = path.resolve(__dirname, '..')

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

test.describe('S3-DIAG-R2 chain rejudge', () => {
  test.setTimeout(180_000)

  test('전량 이벤트 보존 · 시계 보정', async ({ browser }) => {
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

    await setSpeedKmh(pageA, 30)
    await setSpeedKmh(pageB, 30)
    await pageA.waitForTimeout(12_000)
    await pageA.waitForTimeout(22_000)

    const tA1 = await pageA.evaluate(() => Date.now())
    const tB1 = await pageB.evaluate(() => Date.now())
    const skewAfter = tB1 - tA1
    const clockSkewMs = Math.round((skewBefore + skewAfter) / 2)

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
      path.join(OUT_DIR, 'S3R-chain-events.json'),
      JSON.stringify(
        {
          instruction: 'S3-DIAG-R2',
          elapsedMin,
          trailId,
          publisherUid,
          clockSkewBefore: skewBefore,
          clockSkewAfter: skewAfter,
          clockSkewMs,
          events,
        },
        null,
        2,
      ),
      'utf8',
    )

    const sum = spawnSync(process.execPath, ['scripts/peer-sync/s3r-summarize.mjs'], {
      cwd: WEB_ROOT,
      encoding: 'utf8',
    })
    if (sum.status !== 0) {
      throw new Error(`s3r-summarize failed: ${sum.stderr || sum.stdout}`)
    }

    await ctxA.close()
    await ctxB.close()

    expect(events.length, 'pt1~pt7 전량').toBeGreaterThan(50)
    expect(clockSkewMs, '시계 보정값').toEqual(expect.any(Number))
  })
})
