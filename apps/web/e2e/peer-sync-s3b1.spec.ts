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
 * S3B-1 — D-0 배선 후 종단 재측정 (S3AV 와 같은 창 조건, skew=0 집계).
 * 산출: document/ops/sync-relay/S3B1-chain-events.json · S3B1-summary.json
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = PEER_SYNC_OUT_DIR
const WEB_ROOT = path.resolve(__dirname, '..')
const GEO_STOP_M = 900

function attachChainCapture(page: import('@playwright/test').Page) {
  const lines: string[] = []
  const publish: Array<{ route: boolean; motion: boolean; at: number }> = []
  page.on('console', (msg) => {
    const t = msg.text()
    if (t.includes('[peerSyncChain]')) lines.push(t)
    if (t.includes('[LiveLocationPublish]')) {
      publish.push({
        route: /\broute:\s*true\b/.test(t) || t.includes('route: true'),
        motion: /\bmotion:\s*true\b/.test(t) || t.includes('motion: true'),
        at: Date.now(),
      })
    }
  })
  return { lines, publish }
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

test.describe('S3B-1 D-0 publish from rAF', () => {
  test.setTimeout(300_000)

  test('z15-depart · z15-cruise 재측정', async ({ browser }) => {
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
    await ensureRiding(pageB)

    await expect.poll(() => capB.lines.some((l) => l.includes('[peerSyncChain] pt=4')), {
      timeout: 45_000,
    }).toBe(true)

    await setSpeedKmh(pageA, 5)
    await setSpeedKmh(pageB, 5)

    const cases: Record<string, { start: { a: number; b: number }; end: { a: number; b: number } }> =
      {}

    const departStart = await clocks(pageA, pageB)
    await pageA.waitForTimeout(2_000)
    await setSpeedKmh(pageA, 30)
    await setSpeedKmh(pageB, 30)
    const auth0 = lastAuthDist(capA.lines) ?? 0
    const departDeadline = Date.now() + 50_000
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
      path.join(OUT_DIR, 'S3B1-chain-events.json'),
      JSON.stringify(
        {
          instruction: 'S3B-1',
          elapsedMin,
          trailId,
          publisherUid,
          clockSkewBefore: skewBefore,
          clockSkewAfter: skewAfter,
          clockRangeB: { start: tB0, end: tB1 },
          cases,
          publishLogs: capA.publish,
          events,
        },
        null,
        2,
      ),
      'utf8',
    )

    const sum = spawnSync(
      process.execPath,
      ['scripts/peer-sync/s3b1-summarize.mjs', 'S3B1-chain-events.json', 'S3B1-summary.json'],
      { cwd: WEB_ROOT, encoding: 'utf8' },
    )
    if (sum.status !== 0) {
      throw new Error(`s3b1 summarize failed: ${sum.stderr || sum.stdout}`)
    }

    await ctxA.close()
    await ctxB.close()

    expect(events.length, 'pt1~pt7 전량').toBeGreaterThan(50)
  })
})
