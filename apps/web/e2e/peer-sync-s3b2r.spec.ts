import { test, expect } from './open-meteo-stub'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ensureRiding,
  guestStart,
  loadIntroCourse,
  setSpeedKmh,
} from './rideEntryHelpers'

/**
 * S3B-2R — 같은 빌드(D-1) 3 런 반복. S3B2R_RUN=1|2|3 → S3B2R-run{N}-events.json
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.resolve(__dirname, '../../../document/ops/sync-relay')
const GEO_STOP_M = 900
const RUN = Math.min(3, Math.max(1, Number(process.env.S3B2R_RUN || '1')))
const EVENTS_NAME = `S3B2R-run${RUN}-events.json`

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

test.describe('S3B-2R repeat measurement', () => {
  test.setTimeout(300_000)

  test(`z15-depart · z15-cruise (run ${RUN})`, async ({ browser }) => {
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
      path.join(OUT_DIR, EVENTS_NAME),
      JSON.stringify(
        {
          instruction: 'S3B-2R',
          run: RUN,
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

    await ctxA.close()
    await ctxB.close()

    expect(events.length, 'pt1~pt7+pt9 전량').toBeGreaterThan(50)
    expect(events.some((e) => e.pt === 9), 'pt9 Firestore 쓰기 계측').toBe(true)
  })
})
