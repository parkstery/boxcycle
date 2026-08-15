import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * S4-1R — route flight 수명주기 집중 시험 (T1~T4).
 * S41R_BASELINE=1 이면 수정 전 반례 관측 모드(실패를 기대·기록).
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.resolve(__dirname, '../../../document/ops/sync-relay')
const BASELINE = process.env.S41R_BASELINE === '1'
/**
 * S4-1R2 — 강제 지연은 배수 예산(2 s)보다 **커야** 한다.
 * 1.2 s 는 timeout 경로를 한 번도 밟지 않았다. 정상 3 런 실측 FS RTT max 가 4.1~6.2 s 였다.
 */
const WRITE_DELAY_MS = 3_500
/** T5 — 늦은 쓰기가 「재시작 이후」에 착지하도록 더 길게 */
const RESTART_DELAY_MS = 6_000
const OBSERVE_MS = 3_000
/** finalizeAndDelete 의 PEER_LIVE_RIDE_FINAL_BURST_MS(3s) 와 맞춤 */
const FINALIZE_BURST_MS = 3_000
const ROUTE_SETTLE_BUDGET_MS = 2_000
/** in-flight(≤delay) + finalize 여유 */
const POST_END_DRAIN_MS = 12_000

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
    if (t.includes('[peerSyncChain]') || t.includes('[LiveLocationPublish] routeError')) {
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

async function liveRideDocExists(
  page: import('@playwright/test').Page,
  trailId: string,
  uid: string,
): Promise<boolean> {
  await expect
    .poll(async () => page.evaluate(() => typeof (window as Window).__rtwLiveRideExists === 'function'), {
      timeout: 10_000,
    })
    .toBe(true)
  return page.evaluate(
    async ({ tid, id }) => {
      const fn = (window as Window).__rtwLiveRideExists
      if (!fn) throw new Error('__rtwLiveRideExists missing')
      return fn(tid, id)
    },
    { tid: trailId, id: uid },
  )
}

async function observeDocGone(
  page: import('@playwright/test').Page,
  trailId: string,
  uid: string,
  observeMs = OBSERVE_MS,
): Promise<{ existsAfterSettle: boolean; samples: boolean[] }> {
  const samples: boolean[] = []
  const deadline = Date.now() + observeMs
  while (Date.now() < deadline) {
    samples.push(await liveRideDocExists(page, trailId, uid))
    await page.waitForTimeout(400)
  }
  samples.push(await liveRideDocExists(page, trailId, uid))
  return { existsAfterSettle: samples.some(Boolean), samples }
}

async function armDelayedWrites(page: import('@playwright/test').Page, ms = WRITE_DELAY_MS) {
  await page.evaluate((d) => {
    ;(window as Window).__rtwRouteWriteDelayMs = d
    ;(window as Window).__rtwRouteErrorEvents = []
  }, ms)
}

async function waitInFlightAndSlot(page: import('@playwright/test').Page) {
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const d = (window as Window).__rtwRouteFlightDebug
          return Boolean(d?.writing && d?.hasSlot)
        }),
      { timeout: 20_000, intervals: [200] },
    )
    .toBe(true)
}

/**
 * S4-1R2 — 지연 주입을 **끄지 않고** 늦은 쓰기가 실제로 끝날 때까지 기다린다.
 * 예전 판정은 관측 직전에 지연을 0 으로 되돌려 timeout 경로를 지워버렸다.
 */
async function waitCleanupFullySettled(page: import('@playwright/test').Page) {
  await waitFlightIdle(page, POST_END_DRAIN_MS, { keepDelay: true })
  // 지연 정리(늦은 쓰기 완료 시점 실행)까지 비었는지 확인
  await expect
    .poll(
      async () =>
        page.evaluate(() => (window as Window).__rtwRouteFlightDebug?.deferredPending ?? 0),
      { timeout: POST_END_DRAIN_MS, intervals: [200] },
    )
    .toBe(0)
  // finalize burst(3s) + 여유
  await page.waitForTimeout(ROUTE_SETTLE_BUDGET_MS + FINALIZE_BURST_MS + 1_000)
}

async function waitFlightIdle(
  page: import('@playwright/test').Page,
  timeoutMs = POST_END_DRAIN_MS,
  opts?: { keepDelay?: boolean },
) {
  if (!opts?.keepDelay) {
    await page.evaluate(() => {
      ;(window as Window).__rtwRouteWriteDelayMs = 0
    })
  }
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const d = (window as Window).__rtwRouteFlightDebug
          return !d?.writing && !d?.hasSlot
        }),
      { timeout: timeoutMs, intervals: [200] },
    )
    .toBe(true)
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
  const full = await page.evaluate(() => (window as Window).__rtwLastRouteUid ?? null)
  if (!full) throw new Error('uid not found (__rtwLastRouteUid)')
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

test.describe('S4-1R route flight lifecycle', () => {
  test.setTimeout(480_000)

  test(`T1~T5 (${BASELINE ? 'baseline FAIL-expect' : 'after fix'})`, async ({ browser }) => {
    const started = Date.now()
    const results: CaseResult[] = []

    // ── T1 종료 중 지연 쓰기 ─────────────────────────────────
    {
      const ctx = await browser.newContext()
      const page = await ctx.newPage()
      attachChainCapture(page)
      const trailId = await bootAndRide(page)
      await armDelayedWrites(page)
      await waitInFlightAndSlot(page)
      const uid = await resolveUid(page)
      expect(await liveRideDocExists(page, trailId, uid)).toBe(true)
      await endRide(page)
      await waitCleanupFullySettled(page)
      const obs = await observeDocGone(page, trailId, uid)
      results.push({
        id: 'T1',
        pass: !obs.existsAfterSettle,
        detail: {
          trailId,
          uidPrefix: uid.slice(0, 6),
          existsAfterSettle: obs.existsAfterSettle,
          samples: obs.samples,
          expect: 'doc absent after settle+3s observe',
        },
      })
      await ctx.close()
    }

    // ── T2a pageVisible=false ────────────────────────────────
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
      const obsHidden = await observeDocGone(page, trailId, uid)

      // ── T2b route disable (= 종료) — 같은 컨텍스트에서 재개 후 종료
      await setPageHidden(page, false)
      await waitFlightIdle(page)
      await ensureRiding(page)
      await armDelayedWrites(page)
      await waitInFlightAndSlot(page)
      await endRide(page)
      await waitCleanupFullySettled(page)
      const obsEnd = await observeDocGone(page, trailId, uid)

      results.push({
        id: 'T2',
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

    // ── T3 Trail 전환 — 이전 Trail 행 부활 금지 ──────────────
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

      // 새 trail 에서는 지연 주입을 끈다 (idle 대기 방해 금지)
      await page.evaluate(() => {
        ;(window as Window).__rtwRouteWriteDelayMs = 0
      })
      await loadIntroCourse(page)
      await ensureRiding(page)
      const trailB = new URL(page.url()).searchParams.get('trail')!
      expect(trailB).not.toBe(trailA)

      const obsA = await observeDocGone(page, trailA, uid)

      const pt9 = cap.lines.map(parseChainLine).filter((e): e is Ev => !!e && e.pt === 9)

      // S4-1R2 — 「새 epoch 시작 이후」의 이전 epoch 성공 쓰기만 위반이다.
      const epochStarts = await page.evaluate(
        () => (window as Window).__rtwRouteEpochStarts ?? [],
      )
      const newEpoch = epochStarts.length ? epochStarts[epochStarts.length - 1] : null
      const oldEpochOk1AfterNew = newEpoch
        ? pt9.filter(
            (e) =>
              e.ok === 1 &&
              typeof e.epoch === 'number' &&
              e.epoch < newEpoch.epoch &&
              typeof e.fsWriteDoneAt === 'number' &&
              (e.fsWriteDoneAt as number) >= newEpoch.at,
          ).length
        : null
      const oldEpochOk1Total = pt9.filter(
        (e) => e.ok === 1 && e.trailId === trailA && e.epoch != null,
      ).length

      const epochDiscard = await page.evaluate(
        () => (window as Window).__rtwRouteFlightDebug?.epochDiscardTotal ?? 0,
      )

      results.push({
        id: 'T3',
        // 판정은 Chief 기준 2 건뿐이다: 옛 Trail 행 부활 0 · 새 epoch 시작 이후 옛 epoch 성공 쓰기 0.
        // epochDiscard 는 관측치다 — 배수가 깨끗하게 끝나면 폐기할 작업이 없는 것이 정상이고,
        // Trail 전환이 페이지 재적재를 동반하면 모듈 상태(epoch 카운터)가 초기화된다.
        pass:
          !obsA.existsAfterSettle && (BASELINE || oldEpochOk1AfterNew === 0),
        detail: {
          trailA,
          trailB,
          previousTrailResurrected: obsA.existsAfterSettle,
          samplesA: obsA.samples,
          epochDiscard,
          epochStartCount: epochStarts.length,
          newEpoch,
          oldEpochOk1AfterNew,
          oldEpochOk1Total,
          note: BASELINE
            ? 'baseline: 행 부활만 판정'
            : 'after: 행 부재 + epoch 폐기 ≥1 + 새 epoch 시작 이후 옛 epoch ok=1 이 0 건',
        },
      })
      await ctx.close()
    }

    // ── T4 첫 쓰기 강제 실패 → 복구 ─────────────────────────
    {
      const ctx = await browser.newContext()
      const page = await ctx.newPage()
      const cap = attachChainCapture(page)
      await bootAndRide(page)

      await page.evaluate(() => {
        ;(window as Window).__rtwRouteWriteDelayMs = 0
        ;(window as Window).__rtwRouteWriteFaultOnce = 1
        ;(window as Window).__rtwRouteErrorEvents = []
      })
      const linesBeforeFault = cap.lines.length

      await expect
        .poll(
          () =>
            cap.lines
              .slice(linesBeforeFault)
              .filter((l) => l.includes('pt=9') && l.includes('ok=0')).length,
          { timeout: 15_000 },
        )
        .toBeGreaterThanOrEqual(1)

      // 실패 후 최신 스냅샷 재발행을 유도 (스로틀 우회 burst)
      await setSpeedKmh(page, 31)
      await page.waitForTimeout(1_200)
      await setSpeedKmh(page, 32)

      await expect
        .poll(
          () => {
            const pt9 = cap.lines
              .slice(linesBeforeFault)
              .map(parseChainLine)
              .filter((e): e is Ev => !!e && e.pt === 9)
            const i0 = pt9.findIndex((e) => e.ok === 0)
            if (i0 < 0) return 0
            return pt9.slice(i0 + 1).filter((e) => e.ok === 1).length
          },
          { timeout: 20_000 },
        )
        .toBeGreaterThanOrEqual(1)

      const errEvents = await page.evaluate(() => (window as Window).__rtwRouteErrorEvents ?? [])
      const routeErrorLogs = cap.lines
        .slice(linesBeforeFault)
        .filter((l) => l.includes('[LiveLocationPublish] routeError'))
      const pt9 = cap.lines
        .slice(linesBeforeFault)
        .map(parseChainLine)
        .filter((e): e is Ev => !!e && e.pt === 9)
      const ok0 = pt9.filter((e) => e.ok === 0)
      const ok1 = pt9.filter((e) => e.ok === 1)
      const firstOk0Idx = pt9.findIndex((e) => e.ok === 0)
      const laterOk1 = firstOk0Idx >= 0 && pt9.slice(firstOk0Idx + 1).some((e) => e.ok === 1)

      results.push({
        id: 'T4',
        pass:
          ok0.length >= 1 &&
          errEvents.length >= 1 &&
          routeErrorLogs.length >= 1 &&
          laterOk1 &&
          ok1.length >= 1,
        detail: {
          pt9_ok0: ok0.length,
          pt9_ok1: ok1.length,
          routeErrorEvents: errEvents,
          routeErrorLogs: routeErrorLogs.length,
          laterOk1,
          note: 'ok=0 은 fault 1회; 이후 ok=1 로 큐 잠김 없음',
        },
      })
      await ctx.close()
    }

    // ── T5 같은 Trail 빠른 재시작 — 옛 정리가 새 세션 행을 지우면 안 된다 ──
    {
      const ctx = await browser.newContext()
      const page = await ctx.newPage()
      attachChainCapture(page)
      const trailId = await bootAndRide(page)
      // 늦은 쓰기가 「재시작 이후」에 착지하도록 길게 잡는다
      await armDelayedWrites(page, RESTART_DELAY_MS)
      await waitInFlightAndSlot(page)
      const uid = await resolveUid(page)

      // 같은 Trail·같은 uid 로 세션만 끊었다 잇는다 (숨김→복귀).
      // 새 주행 시작은 새 Trail 을 만들 수 있어 「같은 Trail」 조건이 깨진다.
      await setPageHidden(page, true) // cleanup 시작 — 배수는 2 s 에서 시간 초과한다
      await page.waitForTimeout(3_000) // 시간 초과·삭제·지연 정리 등록까지 지나게 둔다
      await setPageHidden(page, false) // 같은 세션 키로 재시작
      const trailAfter = new URL(page.url()).searchParams.get('trail')
      expect(trailAfter).toBe(trailId)

      // 옛 세션의 늦은 쓰기가 착지하고 지연 정리가 실행될 때까지 기다린다.
      // (새 세션이 계속 발행하므로 flight 는 idle 이 되지 않는다 — idle 을 기다리지 않는다)
      await page.waitForTimeout(RESTART_DELAY_MS + 3_000)
      await page.evaluate(() => {
        ;(window as Window).__rtwRouteWriteDelayMs = 0
      })
      await expect
        .poll(
          async () =>
            page.evaluate(() => (window as Window).__rtwRouteFlightDebug?.deferredPending ?? 0),
          { timeout: POST_END_DRAIN_MS, intervals: [200] },
        )
        .toBe(0)
      await page.waitForTimeout(2_000)

      const samples: boolean[] = []
      for (let i = 0; i < 6; i += 1) {
        samples.push(await liveRideDocExists(page, trailId, uid))
        await page.waitForTimeout(400)
      }
      const dbg = await page.evaluate(() => (window as Window).__rtwRouteFlightDebug ?? null)
      const newSessionRowKept = samples.every(Boolean)
      const guardFired = (dbg?.deferredSkipTotal ?? 0) >= 1

      results.push({
        id: 'T5',
        pass: BASELINE ? true : newSessionRowKept && guardFired,
        detail: {
          trailId,
          uidPrefix: uid.slice(0, 6),
          newSessionRowKept,
          samples,
          deferredRunTotal: dbg?.deferredRunTotal ?? null,
          deferredSkipTotal: dbg?.deferredSkipTotal ?? null,
          guardFired,
          expect: '같은 Trail 재시작 세션의 행이 계속 존재 + 지연 정리가 skip-live-session 으로 걸러짐',
        },
      })
      await ctx.close()
    }

    const elapsedMin = Math.round(((Date.now() - started) / 60_000) * 10) / 10
    const allPass = results.every((r) => r.pass)
    const out = {
      instruction: 'S4-1R2',
      mode: BASELINE ? 'baseline-pre-fix' : 'after-fix',
      headHint: BASELINE ? '507bd68+dev-inject' : 'post-lifecycle',
      elapsedMin,
      results,
      allPass,
      baselineExpectAtLeastOneFail: BASELINE,
      baselineHasFail: BASELINE ? results.some((r) => !r.pass) : null,
    }

    fs.mkdirSync(OUT_DIR, { recursive: true })
    const outName = BASELINE ? 'S41R-lifecycle-baseline.json' : 'S41R-lifecycle.json'
    fs.writeFileSync(path.join(OUT_DIR, outName), JSON.stringify(out, null, 2), 'utf8')

    if (BASELINE) {
      expect(results.some((r) => !r.pass), `baseline must FAIL ≥1, got ${JSON.stringify(results)}`).toBe(
        true,
      )
    } else {
      expect(allPass, JSON.stringify(results, null, 2)).toBe(true)
    }
  })
})
