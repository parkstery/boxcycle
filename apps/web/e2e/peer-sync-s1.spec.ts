import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  parsePeerSyncLine,
  computeDeffResidualFromSeries,
  formatAlignedTable,
  judgeCase,
} from '../scripts/peer-sync/s1-metrics.mjs'

/**
 * S1 증상 정량화 — Playwright 2-browser (A=송신, B=수신).
 * Firebase 에뮬레이터 필수 (`npm run test:e2e:peer-s1`).
 *
 * zoom 15: 주행 기본 줌(≈16) = 보간 경로 (MAP_PEER_SPRITE_MIN_ZOOM=14 초과)
 * zoom 13: B를 free 카메라 + 휠 줌아웃으로 ≤14 → peer 적분/로그 중단.
 *          그 구간은 spectator(5km/h) 경로라 [peerSync] disp 가 안 나와,
 *          B의 마지막 peerSync 표본 + age 기반 외삽으로 근사한다(보고서 §에 명시).
 */
const LIVE = process.env.RIDE_VERIFY_LIVE === '1'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.resolve(__dirname, '../../../document/ops/sync-relay')

type PeerRow = {
  t: number
  newest: number
  disp: number
  age: number
  buf: number
  spd: number
}

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
  // 0.5km(Basic1)는 30km/h면 ~1분 만에 끝나 8케이스 측정이 불가 → 가장 긴 입문(Basic3 1.5km)
  const items = modal.locator('button.oc-modal__item')
  await expect(items.first()).toBeVisible()
  const n = await items.count()
  await items.nth(Math.max(0, n - 1)).click()
  await expect(page.getByRole('button', { name: '주행 시작' })).toBeVisible({ timeout: 20_000 })
}

async function dismissRideSummaryIfAny(page: import('@playwright/test').Page) {
  const summary = page.getByRole('dialog', { name: '주행 결과' })
  if (!(await summary.isVisible().catch(() => false))) return false
  const skip = summary.getByRole('button', { name: '저장 안 함' })
  if (await skip.isVisible().catch(() => false)) {
    await skip.click()
  } else {
    await summary.getByRole('button', { name: '닫기' }).first().click()
  }
  await expect(summary).toBeHidden({ timeout: 10_000 })
  return true
}

/** 도착으로 세션이 끝났으면 같은 코스로 재시작 */
async function ensureRiding(page: import('@playwright/test').Page) {
  await dismissRideSummaryIfAny(page)
  // running: '주행 종료' / paused: '재개' — ready-to-start 의 '주행 지표' 로는 판별하지 않음
  if (await page.getByRole('button', { name: '주행 종료' }).isVisible().catch(() => false)) return
  if (await page.getByRole('button', { name: '재개' }).first().isVisible().catch(() => false)) return
  const start = page.getByRole('button', { name: '주행 시작' })
  await expect(start).toBeVisible({ timeout: 20_000 })
  await start.click()
  await expect(page.getByRole('button', { name: '주행 종료' })).toBeVisible({ timeout: 30_000 })
}

async function ensureDockExpanded(page: import('@playwright/test').Page) {
  await ensureRiding(page)
  const caret = page.getByRole('button', { name: '경로 패널 펼치기' }).or(
    page.getByRole('button', { name: '경로 패널 접기' }),
  )
  await expect(caret.first()).toBeVisible({ timeout: 10_000 })
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
  // number input 동기화 확인(있으면)
  const spin = page.getByRole('spinbutton', { name: '속도 km/h' })
  if (await spin.isVisible().catch(() => false)) {
    await expect(spin).toHaveValue(String(kmh), { timeout: 3_000 })
  }
}

async function setFollowFree(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: '맵 뷰 설정' }).click()
  await page.locator('.map-view-sheet__chip', { hasText: 'free' }).click()
  // 시트 닫기 — 바깥 클릭 대신 Escape
  await page.keyboard.press('Escape')
}

/** Mapbox 캔버스 휠로 줌 목표에 근접. peerSync 로그 유무로 ≤14 판정. */
async function zoomOutUntilPeerLogsStop(
  page: import('@playwright/test').Page,
  logs: string[],
  maxWheels = 40,
) {
  const canvas = page.locator('.mapboxgl-canvas').first()
  await expect(canvas).toBeVisible()
  const box = await canvas.boundingBox()
  if (!box) throw new Error('no canvas')
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  await page.mouse.move(cx, cy)
  let lastPeerAt = Date.now()
  const before = logs.length
  for (let i = 0; i < maxWheels; i++) {
    await page.mouse.wheel(0, 800)
    await page.waitForTimeout(200)
    // 최근 1.5s 동안 peerSync 가 안 오면 적분 경로 이탈로 간주
    const recent = logs.slice(before).filter((l) => l.includes('[peerSync]'))
    if (recent.length > 0) {
      lastPeerAt = Date.now()
    }
    if (Date.now() - lastPeerAt > 1500 && i > 8) return
  }
}

function attachPeerSyncCapture(page: import('@playwright/test').Page) {
  const lines: string[] = []
  page.on('console', (msg) => {
    const t = msg.text()
    if (t.includes('[peerSync]')) lines.push(t)
  })
  return lines
}

function selfSeries(lines: string[]) {
  const rows: { t: number; self: number }[] = []
  for (const line of lines) {
    const p = parsePeerSyncLine(line)
    if (p) rows.push({ t: p.t, self: p.self })
  }
  return rows
}

function peerSeries(lines: string[]): PeerRow[] {
  const rows: PeerRow[] = []
  for (const line of lines) {
    const p = parsePeerSyncLine(line)
    if (!p || p.peers.length === 0) continue
    // 2인 가정: peer 1명 = 관측대상 A
    const peer = p.peers[0]
    rows.push({
      t: p.t,
      newest: peer.newest,
      disp: peer.disp,
      age: peer.age,
      buf: peer.buf,
      spd: peer.spd,
    })
  }
  return rows
}

/** zoom≤14 구간: 적분 중단 직전 마지막 peer 표본을 5km/h 외삽(spectator 근사) */
function extrapolateSpectator(rows: PeerRow[], wallNow: number, durationMs: number): PeerRow[] {
  if (rows.length === 0) return []
  const last = rows[rows.length - 1]
  const out: PeerRow[] = []
  const spdMps = 5 / 3.6
  for (let t = last.t; t <= wallNow + durationMs; t += 200) {
    const dt = Math.max(0, (t - last.t) / 1000)
    const disp = last.disp + spdMps * dt
    out.push({
      t,
      newest: last.newest,
      disp,
      age: last.age + (t - last.t),
      buf: last.buf,
      spd: spdMps,
    })
  }
  return out
}

test.describe('S1 peer sync 정량화', () => {
  test.skip(!LIVE, 'Firebase 에뮬레이터 필요 — npm run test:e2e:peer-s1')
  test.setTimeout(10 * 60_000)

  test('2-browser 8케이스 D_eff/residual', async ({ browser }) => {
    const ctxA = await browser.newContext()
    const ctxB = await browser.newContext()
    const pageA = await ctxA.newPage()
    const pageB = await ctxB.newPage()
    const logsA = attachPeerSyncCapture(pageA)
    const logsB = attachPeerSyncCapture(pageB)

    // 시계 오차 측정 (직전)
    const tA0 = await pageA.evaluate(() => Date.now())
    const tB0 = await pageB.evaluate(() => Date.now())
    // Playwright 호스트 기준 — 두 컨텍스트는 같은 OS 시계라 skew≈0 이 정상
    const skewBefore = tB0 - tA0

    await pageA.goto('/?peerSyncLogMs=200')
    await guestStart(pageA)
    await loadIntroCourse(pageA)
    await ensureRiding(pageA)

    // A의 trail id 확보
    await expect.poll(async () => {
      const u = new URL(pageA.url())
      return u.searchParams.get('trail')
    }, { timeout: 20_000 }).not.toBeNull()
    const trailId = new URL(pageA.url()).searchParams.get('trail')!
    expect(trailId).toBeTruthy()

    await pageB.goto(`/?trail=${encodeURIComponent(trailId)}&peerSyncLogMs=200`)
    await guestStart(pageB)
    // Trail join 시 입문 코스 자동 로드 대기
    await expect(pageB.getByRole('button', { name: '주행 시작' })).toBeVisible({ timeout: 45_000 })
    await ensureRiding(pageB)

    // peer 로그가 양쪽에 뜰 때까지 (서로 registry 등록)
    await expect.poll(() => logsA.some((l) => l.includes('disp=')), { timeout: 30_000 }).toBe(true)
    await expect.poll(() => logsB.some((l) => l.includes('disp=')), { timeout: 30_000 }).toBe(true)

    const cases: Array<{
      id: string
      zoom: 15 | 13
      phase: 'depart' | 'cruise' | 'decel' | 'pause'
    }> = [
      { id: 'z15-depart', zoom: 15, phase: 'depart' },
      { id: 'z15-cruise', zoom: 15, phase: 'cruise' },
      { id: 'z15-decel', zoom: 15, phase: 'decel' },
      { id: 'z15-pause', zoom: 15, phase: 'pause' },
      { id: 'z13-depart', zoom: 13, phase: 'depart' },
      { id: 'z13-cruise', zoom: 13, phase: 'cruise' },
      { id: 'z13-decel', zoom: 13, phase: 'decel' },
      { id: 'z13-pause', zoom: 13, phase: 'pause' },
    ]

    const reportCases: Array<{
      id: string
      table: string
      metrics: ReturnType<typeof computeDeffResidualFromSeries>
      judge: ReturnType<typeof judgeCase>
      note?: string
    }> = []

    // 공통: 속도를 5로 리셋 후 시나리오
    async function resetIdleSpeed() {
      await ensureRiding(pageA)
      await ensureRiding(pageB)
      const resumeA = pageA.getByRole('button', { name: '재개' }).first()
      const resumeB = pageB.getByRole('button', { name: '재개' }).first()
      if (await resumeA.isVisible().catch(() => false)) await resumeA.click()
      if (await resumeB.isVisible().catch(() => false)) await resumeB.click()
      await setSpeedKmh(pageA, 5)
      await setSpeedKmh(pageB, 5)
      await pageA.waitForTimeout(1500)
    }

    async function prepareZoom(zoom: 15 | 13) {
      // A는 항상 보간 경로(로그 self) 유지 — 기본 주행 줌
      if (zoom === 13) {
        await setFollowFree(pageB)
        await zoomOutUntilPeerLogsStop(pageB, logsB)
      }
    }

    function takeSlices(a0: number, b0: number) {
      return {
        aSlice: selfSeries(logsA.slice(a0)),
        bSlice: peerSeries(logsB.slice(b0)),
      }
    }

    async function waitKeepRiding(ms: number) {
      const step = 4_000
      let left = ms
      while (left > 0) {
        await ensureRiding(pageA)
        await ensureRiding(pageB)
        const chunk = Math.min(step, left)
        await pageA.waitForTimeout(chunk)
        left -= chunk
      }
    }

    for (const c of cases) {
      await resetIdleSpeed()
      await prepareZoom(c.zoom)

      let a0 = logsA.length
      let b0 = logsB.length
      let note: string | undefined

      if (c.phase === 'depart') {
        await setSpeedKmh(pageA, 30)
        await waitKeepRiding(13_000)
      } else if (c.phase === 'cruise') {
        await setSpeedKmh(pageA, 30)
        await waitKeepRiding(12_000) // 램프 제외
        a0 = logsA.length
        b0 = logsB.length
        await waitKeepRiding(20_000)
      } else if (c.phase === 'decel') {
        await setSpeedKmh(pageA, 30)
        await waitKeepRiding(12_000)
        a0 = logsA.length
        b0 = logsB.length
        await setSpeedKmh(pageA, 5)
        await waitKeepRiding(6_000)
      } else {
        await setSpeedKmh(pageA, 30)
        await waitKeepRiding(8_000)
        a0 = logsA.length
        b0 = logsB.length
        await pageA.getByRole('button', { name: '일시정지' }).click()
        await expect(pageA.getByRole('button', { name: '재개' }).first()).toBeVisible()
        await waitKeepRiding(10_000)
      }

      const { aSlice, bSlice } = takeSlices(a0, b0)
      let bUsed = bSlice
      if (c.zoom === 13 && bSlice.length < 8) {
        const allB = peerSeries(logsB)
        const approx = extrapolateSpectator(allB.slice(-5), Date.now(), 0)
        bUsed = bSlice.length >= 3 ? bSlice : approx
        note = 'zoom≤14: peerDrive 로그 희소 — spectator 5km/h 외삽 근사 포함'
      }

      const metrics = computeDeffResidualFromSeries(aSlice, bUsed, {
        clockSkewMs: skewBefore,
        maxDelayMs: 800,
        delayStepMs: 20,
      })
      const judge = judgeCase(metrics)
      reportCases.push({
        id: c.id,
        table: formatAlignedTable(metrics.aligned ?? []),
        metrics,
        judge,
        note,
      })
    }

    const tA1 = await pageA.evaluate(() => Date.now())
    const tB1 = await pageB.evaluate(() => Date.now())
    const skewAfter = tB1 - tA1

    const failed = reportCases.filter((r) => !r.judge.pass).map((r) => r.id)
    const maxResidual = reportCases.reduce(
      (m, r) => Math.max(m, r.metrics.residualMax || 0),
      0,
    )
    const worst = [...reportCases].sort(
      (a, b) => (b.metrics.residualMax || 0) - (a.metrics.residualMax || 0),
    )[0]

    const delays = reportCases.map((r) => r.metrics.D_eff).filter((d) => Number.isFinite(d))
    const delayMean = delays.reduce((a, b) => a + b, 0) / Math.max(1, delays.length)
    const delaySorted = [...delays].sort((a, b) => a - b)

    const md = [
      '# S1 REPORT — peer 디스플레이 불일치 정량화',
      '',
      `- **지시번호**: S1`,
      `- **일시**: ${new Date().toISOString()}`,
      `- **방법**: Playwright 2-browser + Firebase emulator (\`?peerSyncLogMs=200\`)`,
      `- **시계 오차**: before B−A=${skewBefore}ms · after B−A=${skewAfter}ms (동일 호스트 → 보정≈0)`,
      `- **zoom 15**: 주행 기본 줌(보간 경로, z>14)`,
      `- **zoom 13**: B free+휠 줌아웃(z≤14 spectator 경로; 로그 희소 시 5km/h 외삽 근사)`,
      '',
      '## UAG',
      '',
      `- 상한 초과 케이스: ${failed.length ? failed.join(', ') : '(없음)'}`,
      `- 최대 residual max: ${maxResidual.toFixed(2)} m (${worst?.id})`,
      '',
      '## 케이스별 지표',
      '',
      '| case | D_eff(ms) | RMSE(m) | P95(m) | max(m) | n | PASS |',
      '|---|---:|---:|---:|---:|---:|---|',
    ]
    for (const r of reportCases) {
      md.push(
        `| ${r.id} | ${r.metrics.D_eff} | ${r.metrics.residualRmse?.toFixed(3)} | ${r.metrics.residualP95?.toFixed(3)} | ${r.metrics.residualMax?.toFixed(3)} | ${r.metrics.n} | ${r.judge.pass ? 'PASS' : 'FAIL'} |`,
      )
    }
    md.push('')
    for (const r of reportCases) {
      md.push(`### ${r.id}`)
      if (r.note) md.push(`> ${r.note}`)
      md.push('')
      md.push('```')
      md.push(r.table || '(empty)')
      md.push('```')
      md.push('')
      if (!r.judge.pass) md.push(`FAIL: ${r.judge.fail.join('; ')}`)
      md.push('')
    }
    md.push('## 필수 결론 3줄')
    md.push('')
    md.push(
      `1. 상한 초과 케이스: ${failed.length ? failed.join(', ') : '없음'}`,
    )
    md.push(
      `2. 사용자가 말한 "상당한 차이"에 해당하는 실측: **${worst?.id}** 에서 residual max **${(worst?.metrics.residualMax ?? NaN).toFixed(2)} m** (RMSE ${(worst?.metrics.residualRmse ?? NaN).toFixed(2)} m, D_eff ${worst?.metrics.D_eff} ms)`,
    )
    md.push(
      `3. S2 지연 모델: base≈**${Math.round(delayMean)} ms**, 분포 min/med/max = ${delaySorted[0]}/${delaySorted[Math.floor(delaySorted.length / 2)]}/${delaySorted[delaySorted.length - 1]} ms (케이스별 D_eff)`,
    )
    md.push('')

    fs.mkdirSync(OUT_DIR, { recursive: true })
    const reportPath = path.join(OUT_DIR, 'REPORT.md')
    fs.writeFileSync(reportPath, md.join('\n'), 'utf8')

    // 원시 로그 보존
    fs.writeFileSync(
      path.join(OUT_DIR, 'REPORT-S1-raw-logs.json'),
      JSON.stringify({ skewBefore, skewAfter, logsA, logsB, reportCases: reportCases.map((r) => ({ id: r.id, metrics: r.metrics, judge: r.judge, note: r.note })) }, null, 2),
      'utf8',
    )

    await ctxA.close()
    await ctxB.close()

    // 측정 자체가 목적 — 상한 FAIL 이어도 리포트는 남긴다. 하네스 실패는 표본 부족일 때만.
    const thin = reportCases.filter((r) => r.metrics.n < 5)
    expect(thin, `표본 부족: ${thin.map((t) => t.id).join(',')}`).toEqual([])
  })
})
