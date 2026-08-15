import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * S4-M1 / S4-M1R — motion flight 수명주기 (M1~M6).
 * S4M1_BASELINE=1 이면 수정 전 반례 관측 모드. 산출은 S4M1-lifecycle-baseline-r.json
 * (원본 S4M1-lifecycle-baseline.json 은 덮지 않는다).
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.resolve(__dirname, '../../../document/ops/sync-relay')
const BASELINE = process.env.S4M1_BASELINE === '1'
/** 배수 2s + finalize burst 3s 보다 커야 종료 경로에서 늦은 쓰기가 삭제 뒤에 착지한다. */
const WRITE_DELAY_MS = 8_000
const RESTART_DELAY_MS = 6_000
const OBSERVE_MS = 3_000
const SETTLE_BUDGET_MS = 2_000
const POST_END_DRAIN_MS = 24_000

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

async function endRide(page: import('@playwright/test').Page) {
  const end = page.getByRole('button', { name: '주행 종료' })
  await expect(end).toBeVisible({ timeout: 10_000 })
  await end.click()
  await dismissRideSummaryIfAny(page)
}

function attachChainCapture(page: import('@playwright/test').Page) {
  const lines: string[] = []
  page.on('console', (msg) => {
    const t = msg.text()
    if (
      t.includes('[peerSyncChain]') ||
      t.includes('[LiveLocationPublish] motionError') ||
      t.includes('[LiveLocationPublish] routeError')
    ) {
      lines.push(t)
    }
  })
  return { lines }
}

type Ev = Record<string, string | number | null> & { pt: number; seq: number | null; raw: string }

function parseChainLine(text: string): Ev | null {
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
  const ev: Ev = { pt, seq: Number.isFinite(seq as number) ? (seq as number) : null, raw: text }
  for (const [k, v] of Object.entries(fields)) {
    if (k === 'pt' || k === 'seq') continue
    const n = Number(v)
    ev[k] = v === 'null' ? null : Number.isFinite(n) && v !== '' && !/^[a-zA-Z-]/.test(v) ? n : v
  }
  return ev
}

async function motionNodeExists(
  page: import('@playwright/test').Page,
  trailId: string,
  uid: string,
): Promise<boolean> {
  await expect
    .poll(async () => page.evaluate(() => typeof (window as Window).__rtwMotionExists === 'function'), {
      timeout: 10_000,
    })
    .toBe(true)
  return page.evaluate(
    async ({ tid, id }) => {
      const fn = (window as Window).__rtwMotionExists
      if (!fn) throw new Error('__rtwMotionExists missing')
      return fn(tid, id)
    },
    { tid: trailId, id: uid },
  )
}

async function observeNodeGone(
  page: import('@playwright/test').Page,
  trailId: string,
  uid: string,
  observeMs = OBSERVE_MS,
): Promise<{ existsAfterSettle: boolean; samples: boolean[] }> {
  const samples: boolean[] = []
  const deadline = Date.now() + observeMs
  while (Date.now() < deadline) {
    samples.push(await motionNodeExists(page, trailId, uid))
    await page.waitForTimeout(400)
  }
  samples.push(await motionNodeExists(page, trailId, uid))
  return { existsAfterSettle: samples.some(Boolean), samples }
}

function hasExistAbsentExistDip(samples: Array<{ exists: boolean }>): boolean {
  let phase: 0 | 1 | 2 | 3 = 0
  for (const s of samples) {
    if (phase === 0 && s.exists) phase = 1
    else if (phase === 1 && !s.exists) phase = 2
    else if (phase === 2 && s.exists) phase = 3
  }
  return phase === 3
}

async function startMotionWatch(
  page: import('@playwright/test').Page,
  trailId: string,
  uid: string,
) {
  await expect
    .poll(async () => page.evaluate(() => typeof (window as Window).__rtwStartMotionWatch === 'function'), {
      timeout: 10_000,
    })
    .toBe(true)
  await page.evaluate(
    ({ tid, id }) => {
      const start = (window as Window).__rtwStartMotionWatch
      if (!start) throw new Error('__rtwStartMotionWatch missing')
      start(tid, id)
    },
    { tid: trailId, id: uid },
  )
}

async function stopMotionWatch(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    ;(window as Window).__rtwStopMotionWatch?.()
  })
}

async function observeMotionDip100ms(
  page: import('@playwright/test').Page,
  trailId: string,
  uid: string,
  durationMs = 4_000,
): Promise<Array<{ at: number; exists: boolean }>> {
  const samples: Array<{ at: number; exists: boolean }> = []
  const t0 = Date.now()
  while (Date.now() - t0 < durationMs) {
    const exists = await motionNodeExists(page, trailId, uid)
    samples.push({ at: Date.now(), exists })
    await page.waitForTimeout(100)
  }
  return samples
}

async function armDelayedWrites(page: import('@playwright/test').Page, ms = WRITE_DELAY_MS) {
  await page.evaluate((d) => {
    ;(window as Window).__rtwMotionWriteDelayMs = d
    ;(window as Window).__rtwMotionErrorEvents = []
  }, ms)
}

async function waitInFlightAndSlot(page: import('@playwright/test').Page) {
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const d = (window as Window).__rtwMotionFlightDebug
          return Boolean(d?.writing && d?.hasSlot)
        }),
      { timeout: 20_000, intervals: [200] },
    )
    .toBe(true)
}

async function waitFlightIdle(
  page: import('@playwright/test').Page,
  timeoutMs = POST_END_DRAIN_MS,
  opts?: { keepDelay?: boolean },
) {
  if (!opts?.keepDelay) {
    await page.evaluate(() => {
      ;(window as Window).__rtwMotionWriteDelayMs = 0
    })
  }
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const d = (window as Window).__rtwMotionFlightDebug
          return !d?.writing && !d?.hasSlot
        }),
      { timeout: timeoutMs, intervals: [200] },
    )
    .toBe(true)
}

async function waitCleanupFullySettled(page: import('@playwright/test').Page) {
  await waitFlightIdle(page, POST_END_DRAIN_MS, { keepDelay: true })
  await expect
    .poll(
      async () =>
        page.evaluate(() => (window as Window).__rtwMotionFlightDebug?.deferredPending ?? 0),
      { timeout: POST_END_DRAIN_MS, intervals: [200] },
    )
    .toBe(0)
  await page.waitForTimeout(SETTLE_BUDGET_MS + 1_000)
}

async function setPageHidden(page: import('@playwright/test').Page, hidden: boolean) {
  await page.evaluate((h) => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => h })
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => (h ? 'hidden' : 'visible'),
    })
    document.dispatchEvent(new Event('visibilitychange'))
  }, hidden)
}

async function resolveUid(page: import('@playwright/test').Page): Promise<string> {
  const full = await page.evaluate(() => (window as Window).__rtwLastMotionUid ?? null)
  if (!full) throw new Error('uid not found (__rtwLastMotionUid)')
  return full
}

async function bootAndRide(page: import('@playwright/test').Page) {
  await page.goto('/?peerSyncLogMs=200')
  await guestStart(page)
  await loadIntroCourse(page)
  await ensureRiding(page)
  await expect
    .poll(async () => new URL(page.url()).searchParams.get('trail'), { timeout: 20_000 })
    .not.toBeNull()
  const trailId = new URL(page.url()).searchParams.get('trail')!
  await setSpeedKmh(page, 30)
  return trailId
}

type CaseResult = {
  id: string
  pass: boolean
  detail: Record<string, unknown>
}

test.describe('S4-M1 motion flight lifecycle', () => {
  test.setTimeout(480_000)

  test(`M1~M6 (${BASELINE ? 'baseline FAIL-expect' : 'after fix'})`, async ({ browser }) => {
    const started = Date.now()
    const results: CaseResult[] = []

    // ── M1 종료 중 늦은 motion 쓰기 ──────────────────────────
    {
      const ctx = await browser.newContext()
      const page = await ctx.newPage()
      attachChainCapture(page)
      const trailId = await bootAndRide(page)
      await armDelayedWrites(page)
      await waitInFlightAndSlot(page)
      const uid = await resolveUid(page)
      expect(await motionNodeExists(page, trailId, uid)).toBe(true)
      await endRide(page)
      await waitCleanupFullySettled(page)
      const obs = await observeNodeGone(page, trailId, uid)
      const dbg = BASELINE
        ? null
        : await page.evaluate(() => (window as Window).__rtwMotionFlightDebug ?? null)
      const routeDbg = BASELINE
        ? null
        : await page.evaluate(() => (window as Window).__rtwRouteFlightDebug ?? null)
      results.push({
        id: 'M1',
        pass: BASELINE
          ? !obs.existsAfterSettle
          : !obs.existsAfterSettle && (dbg?.deferredRunTotal ?? 0) >= 1,
        detail: {
          trailId,
          uidPrefix: uid.slice(0, 6),
          existsAfterSettle: obs.existsAfterSettle,
          samples: obs.samples,
          ...(BASELINE
            ? {}
            : {
                deferredRunTotal: dbg?.deferredRunTotal ?? null,
                routeDeferredRunTotal: routeDbg?.deferredRunTotal ?? null,
              }),
          expect: BASELINE ? 'node absent (반례=잔존)' : 'node absent + deferredRunTotal≥1',
        },
      })
      await ctx.close()
    }

    // ── M2 pageVisible=false · 종료 두 경로 ──────────────────
    {
      const ctx = await browser.newContext()
      const page = await ctx.newPage()
      attachChainCapture(page)
      const trailId = await bootAndRide(page)
      await armDelayedWrites(page)
      await waitInFlightAndSlot(page)
      const uid = await resolveUid(page)
      await setPageHidden(page, true)
      await waitCleanupFullySettled(page)
      const obsHidden = await observeNodeGone(page, trailId, uid)

      await setPageHidden(page, false)
      await waitFlightIdle(page)
      await ensureRiding(page)
      await armDelayedWrites(page)
      await waitInFlightAndSlot(page)
      await endRide(page)
      await waitCleanupFullySettled(page)
      const obsEnd = await observeNodeGone(page, trailId, uid)

      results.push({
        id: 'M2',
        pass: !obsHidden.existsAfterSettle && !obsEnd.existsAfterSettle,
        detail: {
          trailId,
          pageVisibleGone: !obsHidden.existsAfterSettle,
          routeDisableGone: !obsEnd.existsAfterSettle,
          samplesHidden: obsHidden.samples,
          samplesEnd: obsEnd.samples,
        },
      })
      await ctx.close()
    }

    // ── M3 Trail 전환 ────────────────────────────────────────
    {
      const ctx = await browser.newContext()
      const page = await ctx.newPage()
      const cap = attachChainCapture(page)
      const trailA = await bootAndRide(page)
      await armDelayedWrites(page)
      await waitInFlightAndSlot(page)
      const uid = await resolveUid(page)
      await endRide(page)
      await waitCleanupFullySettled(page)

      await page.evaluate(() => {
        ;(window as Window).__rtwMotionWriteDelayMs = 0
      })
      await loadIntroCourse(page)
      await ensureRiding(page)
      const trailB = new URL(page.url()).searchParams.get('trail')!
      expect(trailB).not.toBe(trailA)

      const obsA = await observeNodeGone(page, trailA, uid)
      const pt3 = cap.lines.map(parseChainLine).filter((e): e is Ev => !!e && e.pt === 3)
      const epochStarts = await page.evaluate(
        () => (window as Window).__rtwMotionEpochStarts ?? [],
      )
      const newEpoch = epochStarts.length ? epochStarts[epochStarts.length - 1] : null
      const oldEpochOk1AfterNew = newEpoch
        ? pt3.filter(
            (e) =>
              e.ok === 1 &&
              typeof e.epoch === 'number' &&
              e.epoch < newEpoch.epoch &&
              typeof e.writeDone === 'number' &&
              (e.writeDone as number) >= newEpoch.at,
          ).length
        : null

      results.push({
        id: 'M3',
        pass: BASELINE
          ? !obsA.existsAfterSettle
          : !obsA.existsAfterSettle && oldEpochOk1AfterNew === 0,
        detail: {
          trailA,
          trailB,
          previousTrailResurrected: obsA.existsAfterSettle,
          samplesA: obsA.samples,
          newEpoch,
          oldEpochOk1AfterNew,
          note: BASELINE
            ? 'baseline: 이전 Trail 노드 부활이면 FAIL'
            : 'after: 노드 부재 + 새 epoch 이후 옛 epoch ok=1 = 0',
        },
      })
      await ctx.close()
    }

    // ── M5 첫 쓰기 강제 실패 → 복구 (M4 전에 짧게) ───────────
    {
      const ctx = await browser.newContext()
      const page = await ctx.newPage()
      const cap = attachChainCapture(page)
      await bootAndRide(page)

      await page.evaluate(() => {
        ;(window as Window).__rtwMotionWriteDelayMs = 0
        ;(window as Window).__rtwMotionWriteFaultOnce = 1
        ;(window as Window).__rtwMotionErrorEvents = []
      })
      const linesBeforeFault = cap.lines.length
      const faultDeadline = Date.now() + 12_000
      while (Date.now() < faultDeadline) {
        if (
          cap.lines
            .slice(linesBeforeFault)
            .some((l) => l.includes('pt=3') && l.includes('ok=0'))
        ) {
          break
        }
        await page.waitForTimeout(200)
      }

      await setSpeedKmh(page, 31)
      await page.waitForTimeout(1_200)
      await setSpeedKmh(page, 32)

      const errEvents = await page.evaluate(() => (window as Window).__rtwMotionErrorEvents ?? [])
      const motionErrorLogs = cap.lines
        .slice(linesBeforeFault)
        .filter((l) => l.includes('[LiveLocationPublish] motionError'))
      const pt3 = cap.lines
        .slice(linesBeforeFault)
        .map(parseChainLine)
        .filter((e): e is Ev => !!e && e.pt === 3)
      const ok0 = pt3.filter((e) => e.ok === 0)
      const ok1 = pt3.filter((e) => e.ok === 1)
      const firstOk0Idx = pt3.findIndex((e) => e.ok === 0)
      const laterOk1 = firstOk0Idx >= 0 && pt3.slice(firstOk0Idx + 1).some((e) => e.ok === 1)

      results.push({
        id: 'M5',
        pass: ok0.length >= 1 && errEvents.length >= 1 && laterOk1 && ok1.length >= 1,
        detail: {
          pt3_ok0: ok0.length,
          pt3_ok1: ok1.length,
          motionErrorEvents: errEvents,
          motionErrorLogs: motionErrorLogs.length,
          laterOk1,
          note: 'ok=0 1회 + onMotionError 도달 + 이후 ok=1',
        },
      })
      await ctx.close()
    }

    // ── M4 같은 Trail 빠른 재시작 (숨김→복귀) ───────────────
    {
      const ctx = await browser.newContext()
      const page = await ctx.newPage()
      attachChainCapture(page)
      const trailId = await bootAndRide(page)
      await armDelayedWrites(page, RESTART_DELAY_MS)
      await waitInFlightAndSlot(page)
      const uid = await resolveUid(page)

      await startMotionWatch(page, trailId, uid)
      await setPageHidden(page, true)
      await page.waitForTimeout(400)
      await page.evaluate(() => {
        ;(window as Window).__rtwMotionWriteDelayMs = 0
      })
      await setPageHidden(page, false)
      const trailAfter = new URL(page.url()).searchParams.get('trail')
      expect(trailAfter).toBe(trailId)

      const pollSamples = await observeMotionDip100ms(page, trailId, uid, 4_000)
      const watchSamples = await page.evaluate(
        () => (window as Window).__rtwMotionWatchSamples ?? [],
      )
      await stopMotionWatch(page)

      const merged = [...watchSamples, ...pollSamples].sort((a, b) => a.at - b.at)
      const dip = hasExistAbsentExistDip(merged)
      if (!BASELINE) {
        await expect
          .poll(
            async () =>
              page.evaluate(
                () => (window as Window).__rtwMotionFlightDebug?.deferredSkipTotal ?? 0,
              ),
            { timeout: POST_END_DRAIN_MS, intervals: [200] },
          )
          .toBeGreaterThanOrEqual(1)
      }
      const dbg = BASELINE
        ? null
        : await page.evaluate(() => (window as Window).__rtwMotionFlightDebug ?? null)
      const skipTotal = dbg?.deferredSkipTotal ?? 0

      results.push({
        id: 'M4',
        pass: BASELINE ? !dip : !dip && skipTotal >= 1,
        detail: {
          trailId,
          trailAfter,
          sameTrail: trailAfter === trailId,
          uidPrefix: uid.slice(0, 6),
          dip,
          watchN: watchSamples.length,
          pollN: pollSamples.length,
          watchExists: watchSamples.map((s) => s.exists),
          pollExists: pollSamples.map((s) => s.exists),
          ...(BASELINE ? {} : { deferredSkipTotal: skipTotal }),
          expect: BASELINE
            ? '딥 관측 = 반례 성립 (pass=false)'
            : '딥 0회 + deferredSkipTotal≥1',
        },
      })
      await ctx.close()
    }

    // ── M6 W-2 선후 시각 ─────────────────────────────────────
    {
      const ctx = await browser.newContext()
      const page = await ctx.newPage()
      attachChainCapture(page)
      const trailId = await bootAndRide(page)
      await armDelayedWrites(page)
      await waitInFlightAndSlot(page)
      const uid = await resolveUid(page)
      await endRide(page)
      await waitCleanupFullySettled(page)
      await observeNodeGone(page, trailId, uid)
      const w2m = await page.evaluate(() => (window as Window).__rtwMotionFlightDebug ?? null)
      const w2r = await page.evaluate(() => (window as Window).__rtwRouteFlightDebug ?? null)
      const motionLate = (w2m as { w2?: { lateWriteDoneAt?: number; deleteDoneAt?: number } } | null)?.w2
      const routeLate = (w2r as { w2?: { lateWriteDoneAt?: number; deleteDoneAt?: number } } | null)?.w2
      const motionOk =
        typeof motionLate?.lateWriteDoneAt === 'number' &&
        typeof motionLate?.deleteDoneAt === 'number' &&
        motionLate.lateWriteDoneAt < motionLate.deleteDoneAt
      const routeOk =
        typeof routeLate?.lateWriteDoneAt === 'number' &&
        typeof routeLate?.deleteDoneAt === 'number' &&
        routeLate.lateWriteDoneAt < routeLate.deleteDoneAt

      results.push({
        id: 'M6',
        pass: BASELINE ? false : motionOk,
        detail: {
          trailId,
          motionW2: motionLate ?? null,
          routeW2: routeLate ?? null,
          motionOk,
          routeOk,
          expect: 'lateWriteDoneAt < deleteDoneAt 표본 ≥1 (motion)',
        },
      })
      await ctx.close()
    }

    const elapsedMin = Math.round(((Date.now() - started) / 60_000) * 10) / 10
    const m1 = results.find((r) => r.id === 'M1')
    const m3 = results.find((r) => r.id === 'M3')
    const m4 = results.find((r) => r.id === 'M4')
    const m5 = results.find((r) => r.id === 'M5')
    const allPass = results.every((r) => r.pass)
    const out = {
      instruction: 'S4-M1R',
      mode: BASELINE ? 'baseline-pre-fix-r' : 'after-fix',
      elapsedMin,
      results,
      allPass,
      baselineExpectM1M3Fail: BASELINE,
      baselineM1Fail: BASELINE ? m1 && !m1.pass : null,
      baselineM3Fail: BASELINE ? m3 && !m3.pass : null,
      baselineM4Dip: BASELINE ? Boolean(m4?.detail?.dip) : null,
      baselineM5ok0: BASELINE ? m5?.detail?.pt3_ok0 ?? null : null,
    }

    fs.mkdirSync(OUT_DIR, { recursive: true })
    const outName = BASELINE ? 'S4M1-lifecycle-baseline-r.json' : 'S4M1-lifecycle.json'
    fs.writeFileSync(path.join(OUT_DIR, outName), JSON.stringify(out, null, 2), 'utf8')

    if (BASELINE) {
      expect(
        Boolean(m1 && !m1.pass && m3 && !m3.pass),
        `baseline M1·M3 must FAIL, got ${JSON.stringify(results)}`,
      ).toBe(true)
    } else {
      expect(allPass, JSON.stringify(results, null, 2)).toBe(true)
    }
  })
})
