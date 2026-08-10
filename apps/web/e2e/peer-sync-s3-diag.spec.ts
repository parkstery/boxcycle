import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * S3-DIAG — 패킷 체인 ①~⑦ seq 1:1 조인.
 * Firebase 에뮬레이터 + `npm run test:e2e:peer-s3-diag`
 *
 * 산출: document/ops/sync-relay/S3-chain-join.json
 * REPORT.md 는 개발팀장이 이 JSON 을 근거로 작성한다.
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.resolve(__dirname, '../../../document/ops/sync-relay')

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
  const slider = page.getByRole('slider', { name: '세션 속도 km/h' })
  await slider.fill(String(kmh))
}

function attachChainCapture(page: import('@playwright/test').Page) {
  const lines: string[] = []
  page.on('console', (msg) => {
    const t = msg.text()
    if (t.includes('[peerSyncChain]') || t.includes('[peerSync]')) lines.push(t)
  })
  return lines
}

type ChainFields = Record<string, string>
type ChainRow = { pt: number; seq: number | null; fields: ChainFields; raw: string }

function parseChainLine(text: string): ChainRow | null {
  if (!text.includes('[peerSyncChain]')) return null
  const body = text.slice(text.indexOf('[peerSyncChain]') + '[peerSyncChain]'.length).trim()
  const fields: ChainFields = {}
  for (const tok of body.split(/\s+/)) {
    const i = tok.indexOf('=')
    if (i <= 0) continue
    fields[tok.slice(0, i)] = tok.slice(i + 1)
  }
  const pt = Number(fields.pt)
  const seq = fields.seq != null ? Number(fields.seq) : null
  if (!Number.isFinite(pt)) return null
  return { pt, seq: Number.isFinite(seq as number) ? (seq as number) : null, fields, raw: text }
}

function firstBreak(join: Array<Record<string, unknown>>): {
  link: string
  evidence: Record<string, unknown>
} | null {
  for (const row of join) {
    const a1 = row.pt1 as ChainFields | undefined
    const a2 = row.pt2 as ChainFields | undefined
    const a3 = row.pt3 as ChainFields | undefined
    const b4 = row.pt4 as ChainFields | undefined
    const b5 = row.pt5 as ChainFields | undefined
    if (a1 && a2) {
      const auth = Number(a1.authDist)
      const dist = Number(a2.dist)
      if (Number.isFinite(auth) && Number.isFinite(dist) && Math.abs(auth - dist) > 0.15) {
        return {
          link: '①→②',
          evidence: { seq: row.seq, authDist: auth, distMetersAlongRoute: dist, delta: dist - auth },
        }
      }
    }
    if (a2 && a3) {
      const d2 = Number(a2.dist)
      const d3 = Number(a3.d)
      if (Number.isFinite(d2) && Number.isFinite(d3) && Math.abs(d2 - d3) > 0.15) {
        return { link: '②→③', evidence: { seq: row.seq, dist: d2, payloadD: d3 } }
      }
    }
    if (a3 && b4) {
      const d3 = Number(a3.d)
      const d4 = Number(b4.d)
      if (Number.isFinite(d3) && Number.isFinite(d4) && Math.abs(d3 - d4) > 0.15) {
        return { link: '③→④', evidence: { seq: row.seq, payloadD: d3, recvD: d4 } }
      }
    }
    if (b4 && b5) {
      const d4 = Number(b4.d)
      const result = b5.result
      if (result === 'discard-forward') {
        return { link: '④→⑤', evidence: { seq: row.seq, result, d: d4, newest: b5.newest } }
      }
      if (result === 'accepted' && Number.isFinite(d4)) {
        // accepted — continue
      }
    }
    const b6 = row.pt6 as ChainFields | undefined
    const b7 = row.pt7 as ChainFields | undefined
    if (b5?.result === 'accepted' && b6) {
      const newest = Number(b5.newest)
      const disp = Number(b6.displayDistM)
      // 보간 지연으로 수 m 차이는 정상 — 최초 이탈은 큰 단절만
      if (Number.isFinite(newest) && Number.isFinite(disp) && Math.abs(newest - disp) > 25) {
        return { link: '⑤→⑥', evidence: { seq: row.seq, newest, displayDistM: disp } }
      }
    }
    if (b6 && b7 && b7.clamped === '1') {
      return {
        link: '⑥→⑦',
        evidence: {
          seq: row.seq,
          displayDistM: b6.displayDistM,
          clamped: true,
          routeLen: b7.routeLen,
          lng: b7.lng,
          lat: b7.lat,
        },
      }
    }
  }
  return null;
}

test.describe('S3-DIAG peer chain', () => {
  test.setTimeout(180_000)

  test('cruise 창 seq 조인 · 최초 이탈', async ({ browser }) => {
    const started = Date.now()
    const ctxA = await browser.newContext()
    const ctxB = await browser.newContext()
    const pageA = await ctxA.newPage()
    const pageB = await ctxB.newPage()
    const logsA = attachChainCapture(pageA)
    const logsB = attachChainCapture(pageB)

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

    // 램프 후 정속 창
    await setSpeedKmh(pageA, 30)
    await setSpeedKmh(pageB, 30)
    await pageA.waitForTimeout(12_000)
    await pageA.waitForTimeout(22_000)

    const parsedA = logsA.map(parseChainLine).filter(Boolean) as ChainRow[]
    const parsedB = logsB.map(parseChainLine).filter(Boolean) as ChainRow[]

    const bySeqA = new Map<number, Partial<Record<string, ChainFields>>>()
    let publisherUid: string | null = null
    for (const r of parsedA) {
      if (r.seq == null) continue
      const slot = bySeqA.get(r.seq) ?? {}
      slot[`pt${r.pt}`] = r.fields
      bySeqA.set(r.seq, slot)
      if (!publisherUid && r.fields.uid) publisherUid = r.fields.uid
    }
    const bySeqB = new Map<number, Partial<Record<string, ChainFields>>>()
    for (const r of parsedB) {
      if (r.seq == null) continue
      // A 가 보낸 패킷만 조인 (B 자체 발행 seq 대역과 섞지 않음)
      if (publisherUid && r.fields.uid && r.fields.uid !== publisherUid) continue
      const slot = bySeqB.get(r.seq) ?? {}
      if (r.pt === 4 && slot.pt4) continue
      if (r.pt === 5) slot.pt5 = r.fields // 마지막 ingest 결과
      else slot[`pt${r.pt}`] = r.fields
      bySeqB.set(r.seq, slot)
    }

    const join: Array<Record<string, unknown>> = []
    for (const [seq, a] of [...bySeqA.entries()].sort((x, y) => x[0] - y[0])) {
      const b = bySeqB.get(seq) ?? {}
      join.push({ seq, ...a, ...b })
    }

    const discard = { sameDist: 0, forward: 0, retrograde: 0, accepted: 0 }
    for (const r of parsedB.filter((x) => x.pt === 5)) {
      if (publisherUid && r.fields.uid && r.fields.uid !== publisherUid) continue
      const res = r.fields.result
      if (res === 'dup-same-dist') discard.sameDist += 1
      else if (res === 'discard-forward') discard.forward += 1
      else if (res === 'discard-retrograde') discard.retrograde += 1
      else if (res === 'accepted') discard.accepted += 1
    }

    // 반증: ②③④ d 일치 + 전진 폐기 0
    let matched234 = 0
    let mismatch234 = 0
    for (const row of join) {
      const d2 = Number((row.pt2 as ChainFields | undefined)?.dist)
      const d3 = Number((row.pt3 as ChainFields | undefined)?.d)
      const d4 = Number((row.pt4 as ChainFields | undefined)?.d)
      if (![d2, d3, d4].every(Number.isFinite)) continue
      if (Math.abs(d2 - d3) <= 0.15 && Math.abs(d3 - d4) <= 0.15) matched234 += 1
      else mismatch234 += 1
    }
    const rebuttalApplies =
      matched234 > 0 && mismatch234 === 0 && discard.forward === 0

    const breakInfo = firstBreak(join)

    // routeLen A/B — ② · ⑦ 표본
    const routeLenA = join.map((r) => Number((r.pt2 as ChainFields | undefined)?.routeLen)).find(Number.isFinite)
    const geoLenA = join.map((r) => Number((r.pt2 as ChainFields | undefined)?.geoLen)).find(Number.isFinite)
    const routeLenB = join.map((r) => Number((r.pt7 as ChainFields | undefined)?.routeLen)).find(Number.isFinite)

    // ① vs ② clamp 발생 비율
    let clampLike = 0
    let paired12 = 0
    for (const row of join) {
      const a1 = row.pt1 as ChainFields | undefined
      const a2 = row.pt2 as ChainFields | undefined
      if (!a1 || !a2) continue
      paired12 += 1
      if (Math.abs(Number(a1.authDist) - Number(a2.dist)) > 0.15) clampLike += 1
    }

    const sampleJoin = join.filter((r) => r.pt2 && r.pt4).slice(0, 12)

    const elapsedMin = (Date.now() - started) / 60_000
    const out = {
      instruction: 'S3-DIAG',
      elapsedMin: Math.round(elapsedMin * 10) / 10,
      trailId,
      publisherUid,
      counts: {
        chainA: parsedA.length,
        chainB: parsedB.length,
        joinN: join.length,
        joinWith4: join.filter((r) => r.pt4).length,
      },
      discard,
      forwardDiscardGate: discard.forward === 0 ? 'PASS' : 'FAIL',
      rebuttal: {
        applies: rebuttalApplies,
        matched234,
        mismatch234,
        note: rebuttalApplies
          ? '②③④ d 일치 · 전진 폐기 0 → 전송 아닌 ①→② clamp 또는 ⑥⑦'
          : '②③④ 불일치 또는 전진 폐기 있음 → 전송/ingest 쪽',
      },
      firstBreak: breakInfo,
      routeLen: { A_routeLen: routeLenA, A_geoLen: geoLenA, B_routeLen: routeLenB },
      clamp12: { paired: paired12, diverge: clampLike },
      sampleJoin,
      rawTailA: logsA.filter((l) => l.includes('peerSyncChain')).slice(-30),
      rawTailB: logsB.filter((l) => l.includes('peerSyncChain')).slice(-40),
    }

    fs.mkdirSync(OUT_DIR, { recursive: true })
    fs.writeFileSync(path.join(OUT_DIR, 'S3-chain-join.json'), JSON.stringify(out, null, 2), 'utf8')

    await ctxA.close()
    await ctxB.close()

    expect(join.length, 'seq 조인 표본').toBeGreaterThan(5)
    expect(discard.forward, '전진 packet 폐기').toBe(0)
  })
})
