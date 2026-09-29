/**
 * 실 Firebase 트래픽 전·후 비교 — Firestore Usage(지난 60분)과 동시 측정용.
 *
 * env:
 *   RIDE_VERIFY_LIVE=1        필수
 *   TRAFFIC_SOLO_ONLY=1       1인 1분만
 *   TRAFFIC_SKIP_SOLO=1       2인 1분만(A 시작 후 B 합류)
 *   TRAFFIC_QUIET_MS          조용 구간(기본 90000) — 콘솔 반영 대기
 */
import { test, expect } from './open-meteo-stub'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  guestStart,
  prepareManualRideInput,
  loadIntroCourse,
  ensureRiding,
  setSpeedKmh,
  dismissRideSummaryIfAny,
} from './rideEntryHelpers'

const LIVE = process.env.RIDE_VERIFY_LIVE === '1'
const UNDER_EMU = Boolean(process.env.FIRESTORE_EMULATOR_HOST)
const RIDE_MS = 60_000
const QUIET_MS = Number(process.env.TRAFFIC_QUIET_MS || 90_000)
const OUT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.out/firebase-traffic')
const RUN_ID = process.env.TRAFFIC_RUN_ID || new Date().toISOString().replace(/[:.]/g, '-')

function stamp(phase: string, extra: Record<string, unknown> = {}) {
  const row = {
    runId: RUN_ID,
    phase,
    atIso: new Date().toISOString(),
    atMs: Date.now(),
    ...extra,
  }
  fs.mkdirSync(OUT_DIR, { recursive: true })
  fs.appendFileSync(path.join(OUT_DIR, `ride-phases-${RUN_ID}.jsonl`), `${JSON.stringify(row)}\n`, 'utf8')
  fs.appendFileSync(path.join(OUT_DIR, 'ride-phases.jsonl'), `${JSON.stringify(row)}\n`, 'utf8')
  fs.writeFileSync(path.join(OUT_DIR, `phase-${phase}.json`), JSON.stringify(row, null, 2), 'utf8')
  // eslint-disable-next-line no-console
  console.log(`[traffic-compare] ${phase} @ ${row.atIso}`)
  return row
}

async function prepareManualOrContinue(page: import('@playwright/test').Page, label: string) {
  const start = page.getByRole('button', { name: '주행 시작' })
  if ((await start.isVisible().catch(() => false)) && (await start.isEnabled().catch(() => false))) {
    stamp(`${label}_input_already_ready`)
    return
  }
  for (let i = 0; i < 3; i += 1) {
    try {
      await prepareManualRideInput(page)
      return
    } catch (err) {
      stamp(`${label}_prepare_retry_${i}`, { message: String(err).slice(0, 200) })
      await page.keyboard.press('Escape').catch(() => {})
      await page.waitForTimeout(1_000)
    }
  }
  await ensureRiding(page).catch(() => {})
}

async function closeMenuIfOpen(page: import('@playwright/test').Page) {
  const menuBtn = page.getByRole('button', { name: 'Trail 메뉴' })
  if ((await menuBtn.getAttribute('aria-expanded')) === 'true') {
    await menuBtn.click()
    await expect(menuBtn).toHaveAttribute('aria-expanded', 'false')
  }
}

async function endRide(page: import('@playwright/test').Page) {
  const end = page.getByRole('button', { name: '주행 종료' })
  if (await end.isEnabled().catch(() => false)) {
    await end.click()
  }
  try {
    await dismissRideSummaryIfAny(page)
  } catch {
    const summary = page.getByRole('dialog', { name: '주행 결과' })
    if (await summary.isVisible().catch(() => false)) {
      await summary.getByRole('button', { name: '닫기' }).first().click({ force: true, timeout: 5_000 }).catch(() => {})
      await page.keyboard.press('Escape').catch(() => {})
    }
  }
}

test.describe('Firebase traffic before/after ride windows', () => {
  test.skip(!LIVE || UNDER_EMU, '실 Firebase 전용 — RIDE_VERIFY_LIVE=1 이고 에뮬레이터 없이')
  test.setTimeout(12 * 60_000)

  test('1인 1분 / Trail 2인 1분', async ({ browser }) => {
    const soloOnly = process.env.TRAFFIC_SOLO_ONLY === '1'
    const skipSolo = process.env.TRAFFIC_SKIP_SOLO === '1'
    stamp('script_start', { soloOnly, skipSolo, quietMs: QUIET_MS, rideMs: RIDE_MS })

    const ctxA = await browser.newContext()
    const pageA = await ctxA.newPage()
    await pageA.goto('/')
    await guestStart(pageA)
    await prepareManualOrContinue(pageA, 'a')
    await loadIntroCourse(pageA, { pick: 'longest' })
    await closeMenuIfOpen(pageA)
    await ensureRiding(pageA)
    await setSpeedKmh(pageA, 12)

    await expect
      .poll(async () => new URL(pageA.url()).searchParams.get('trail'), { timeout: 20_000 })
      .not.toBeNull()
    const trailId = new URL(pageA.url()).searchParams.get('trail')!

    if (!skipSolo) {
      // 셋업 완료 후 콘솔 T0 찍을 여유
      stamp('solo_ready_quiet', { trailId })
      await pageA.waitForTimeout(QUIET_MS)

      stamp('solo_ride_start', { url: pageA.url(), trailId })
      await pageA.waitForTimeout(RIDE_MS)
      stamp('solo_ride_end')
      await endRide(pageA)
      stamp('solo_done_quiet', { trailId })
      await pageA.waitForTimeout(QUIET_MS)
    } else {
      stamp('solo_skipped', { trailId })
    }

    if (soloOnly) {
      stamp('script_end', { mode: 'solo_only', trailId })
      await ctxA.close()
      return
    }

    if (!skipSolo) {
      await ensureRiding(pageA)
      await setSpeedKmh(pageA, 12)
    }

    const ctxB = await browser.newContext()
    const pageB = await ctxB.newPage()

    await pageB.goto(`/?trail=${encodeURIComponent(trailId)}`)
    await guestStart(pageB)
    await pageB.waitForTimeout(2_000)
    await prepareManualOrContinue(pageB, 'b')
    await expect(pageB.getByRole('button', { name: '주행 시작' })).toBeVisible({ timeout: 45_000 })
    await ensureRiding(pageB)
    await closeMenuIfOpen(pageB)
    await setSpeedKmh(pageB, 12)

    stamp('dual_ready_quiet', { trailId })
    await pageA.waitForTimeout(QUIET_MS)

    stamp('dual_ride_start', { trailId, urlA: pageA.url(), urlB: pageB.url() })
    await pageA.waitForTimeout(RIDE_MS)
    stamp('dual_ride_end')

    await endRide(pageA)
    await endRide(pageB)
    stamp('dual_done_quiet', { trailId })
    await pageA.waitForTimeout(QUIET_MS)
    stamp('script_end', { mode: skipSolo ? 'dual_only' : 'full', trailId })

    await ctxB.close()
    await ctxA.close()
  })
})
