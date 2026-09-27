import { test, expect } from './open-meteo-stub'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import {
  PEER_SYNC_OUT_DIR,
  ensureRiding,
  guestStart,
  loadIntroCourse,
  setSpeedKmh,
} from './rideEntryHelpers'

/**
 * S3-DIAG-R2 — pt1~pt7 전량 보존 + 시계 보정.
 * 산출: document/ops/sync-relay/S3R-chain-events.json · S3R-summary.json
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = PEER_SYNC_OUT_DIR
const WEB_ROOT = path.resolve(__dirname, '..')

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
