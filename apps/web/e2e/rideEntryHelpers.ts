import { expect, type Locator, type Page } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * 실주행 진입 공용 헬퍼 — **동행(peer-sync) e2e 12개가 함께 쓴다.**
 *
 * 왜 한 곳으로 모았나 (2026-09-27) — 이 헬퍼들이 **스펙마다 복사돼 있었다.** 9개는
 * 바이트까지 같았다. 그래서 UI 가 바뀌자 **12개가 한꺼번에 썩었고**, 2026-08-27 부터
 * 한 달 넘게 아무도 몰랐다. 두 가지가 동시에 깨져 있었다:
 *
 *   1. Go 에 「센서 연결 또는 수동 속도」 사전조건이 붙었는데(`rideInputReady`) 스펙은
 *      그것을 모른다 → **버튼이 보이는데 안 눌린다.** 원인이 잘 안 보이는 증상이다
 *   2. 세션 속도 슬라이더가 경로 도크 → **센서 시트**로 옮겨 갔다
 *
 * 다음에 UI 가 또 움직이면 **이 파일 하나만** 고치면 된다.
 */

/** 게스트 진입 카드 → 익명 인증 완료 */
export async function guestStart(page: Page): Promise<void> {
  const gate = page.getByRole('dialog', { name: '시작' })
  await expect(gate).toBeVisible({ timeout: 30_000 })
  await gate.getByRole('button', { name: '시작', exact: true }).click()
  await expect(gate).toBeHidden({ timeout: 30_000 })
}

/**
 * 센서 시트를 연다 — **입구가 상태마다 다르다.**
 *
 * RouteDock 은 센서를 세 모습으로 보여 준다(`lib/route/sensorChipSlot`):
 *   · 첫 화면(idle)  캐럿만 — 누르면 **센서 시트가 열린다**
 *   · 주행 중 접힘   캐럿만 — 누르면 **패널이 펼쳐진다**(시트가 아니다)
 *   · 펼침           센서 칩 — 누르면 센서 시트가 열린다
 *
 * 캐럿의 접근성 이름이 「경로 패널 펼치기 · 케이던스 센서: …」라서, 앵커(`^`) 없이
 * `/케이던스 센서/` 로 누르면 **주행 중에 캐럿이 걸려** 패널만 펼쳐진다.
 */
export async function openCadenceSheet(page: Page): Promise<Locator> {
  const sheet = page.getByRole('dialog', { name: '케이던스 센서' })
  if (await sheet.isVisible().catch(() => false)) return sheet

  const caretOpensSheet = page.getByRole('button', { name: /^센서 설정 열기/ })
  const expand = page.getByRole('button', { name: /^경로 패널 펼치기/ })
  const chip = page.getByRole('button', { name: /^케이던스 센서/ })

  /*
   * ⚠️ `isVisible()` 은 **기다리지 않는다** — 그 순간의 상태를 그대로 돌려준다.
   * 게이트가 막 닫힌 직후에는 dock 이 아직 안 그려져 셋 다 false 가 되고, 그러면 아래
   * 분기가 「없는 것」을 누르러 가서 **시험 시간 전체를 그 클릭 하나가 먹는다.**
   * 2026-09-27 에 실제로 8분을 통째로 날렸다. 그래서 먼저 **하나가 나타날 때까지** 기다린다.
   */
  await expect(caretOpensSheet.or(expand).or(chip).first()).toBeVisible({ timeout: 30_000 })

  if (await caretOpensSheet.isVisible().catch(() => false)) {
    await caretOpensSheet.click({ timeout: 15_000 })
  } else {
    if (await expand.isVisible().catch(() => false)) await expand.click({ timeout: 15_000 })
    await chip.click({ timeout: 15_000 })
  }
  await expect(sheet).toBeVisible({ timeout: 15_000 })
  return sheet
}

export async function closeCadenceSheet(page: Page): Promise<void> {
  const sheet = page.getByRole('dialog', { name: '케이던스 센서' })
  if (!(await sheet.isVisible().catch(() => false))) return
  await sheet.getByRole('button', { name: '센서 설정 닫기' }).click({ timeout: 15_000 })
  await expect(sheet).toBeHidden({ timeout: 15_000 })
}

/**
 * 주행 입력 준비 — Go 의 사전조건(SENSOR-2 §1.4).
 * 자동 e2e 에는 BLE 장치가 없으므로 **「센서 없음」을 명시적으로** 고른다.
 */
export async function prepareManualRideInput(page: Page): Promise<void> {
  const sheet = await openCadenceSheet(page)
  await sheet.getByRole('button', { name: '센서 없음' }).click({ timeout: 15_000 })
  await closeCadenceSheet(page)
}

/**
 * Go 가 눌리는 상태인지 보장한다.
 *
 * **이미 눌리면 아무것도 하지 않는다** — 스펙마다 진입 순서가 달라도 안전하게 끼울 수 있게.
 */
export async function ensureRideInputReady(page: Page): Promise<void> {
  const start = page.getByRole('button', { name: '주행 시작' })
  if (!(await start.isVisible().catch(() => false))) return
  if (await start.isEnabled().catch(() => false)) return
  await prepareManualRideInput(page)
  await expect(start).toBeEnabled({ timeout: 20_000 })
}

/**
 * Trail 메뉴 → 입문 → 코스 로드.
 *
 * 기본은 **가장 긴 코스**다. 동행 시험은 몇 분씩 달리는데, 짧은 코스를 고르면 측정 도중
 * **완주해 버려** Go 버튼이 사라진다.
 *
 * 2026-09-27: 종전에는 「목록의 마지막 항목」을 골랐다. 그때는 그것이 가장 길었지만 코스가
 * 늘면서 순서가 바뀌었고, s1 이 0.45 km 코스를 집어 8케이스 중간에 주행이 끝났다.
 * **위치는 바뀌지만 의도는 안 바뀐다** — 목록에 적힌 거리(`N.NN km`)를 읽어 고른다.
 */
export async function loadIntroCourse(
  page: Page,
  opts?: { pick?: 'first' | 'last' | 'longest' },
): Promise<void> {
  await page.getByRole('button', { name: 'Trail 메뉴' }).click()
  await page.getByRole('button', { name: '입문' }).click()
  const modal = page.getByRole('dialog').filter({ has: page.locator('#oc-modal-title') })
  await expect(modal).toBeVisible({ timeout: 15_000 })
  const items = modal.locator('button.oc-modal__item')
  await expect(items.first()).toBeVisible()
  const n = await items.count()

  const pick = opts?.pick ?? 'longest'
  let index = pick === 'first' ? 0 : Math.max(0, n - 1)

  if (pick === 'longest') {
    let bestKm = -1
    for (let i = 0; i < n; i += 1) {
      const text = (await items.nth(i).innerText().catch(() => '')) ?? ''
      const m = text.match(/([\d.]+)\s*km/)
      const km = m ? Number(m[1]) : NaN
      if (Number.isFinite(km) && km > bestKm) {
        bestKm = km
        index = i
      }
    }
    // 거리를 하나도 못 읽으면 마지막 항목으로 — 조용히 첫 항목을 고르지 않는다.
    if (bestKm < 0) index = Math.max(0, n - 1)
  }

  await items.nth(index).click()
  await expect(page.getByRole('button', { name: '주행 시작' })).toBeVisible({ timeout: 20_000 })
}

/**
 * 결과 시트가 떠 있으면 닫는다. 닫았으면 true.
 *
 * 2026-09-27 — 종전에는 「저장 안 함」**이나** 「닫기」 **둘 중 하나**를 눌렀다. 그런데
 * 제품에서 그 둘은 하는 일이 다르다:
 *   · 「저장 안 함」 → `onDismissAdhoc` — **저장 행만 없앤다. 시트는 그대로 열려 있다**
 *   · 「닫기」       → `onClose` — 시트를 닫는다
 * 그래서 「저장 안 함」을 누르고 닫히기를 기다리면 영영 안 닫힌다.
 * 저장 행이 있으면 먼저 치우고, **닫는 것은 언제나 「닫기」로** 한다.
 */
export async function dismissRideSummaryIfAny(page: Page): Promise<boolean> {
  const summary = page.getByRole('dialog', { name: '주행 결과' })
  if (!(await summary.isVisible().catch(() => false))) return false

  const skip = summary.getByRole('button', { name: '저장 안 함' })
  if (await skip.isVisible().catch(() => false)) {
    await skip.click({ timeout: 10_000 })
  }
  await summary.getByRole('button', { name: '닫기' }).first().click({ timeout: 10_000 })
  await expect(summary).toBeHidden({ timeout: 10_000 })
  return true
}

/**
 * 주행 중 상태를 보장한다.
 * running: '주행 종료' / paused: '재개' — ready-to-start 의 '주행 지표' 로는 판별하지 않는다.
 */
export async function ensureRiding(page: Page): Promise<void> {
  await dismissRideSummaryIfAny(page)
  if (await page.getByRole('button', { name: '주행 종료' }).isEnabled().catch(() => false)) return
  if (await page.getByRole('button', { name: '재개' }).first().isVisible().catch(() => false)) return
  const start = page.getByRole('button', { name: '주행 시작' })
  await expect(start).toBeVisible({ timeout: 20_000 })
  // Go 는 센서·수동 입력이 준비돼야 눌린다. 준비돼 있으면 아무것도 하지 않는다.
  await ensureRideInputReady(page)
  await start.click()
  await expect(page.getByRole('button', { name: '주행 종료' })).toBeEnabled({ timeout: 30_000 })
}

/**
 * 세션 속도 설정.
 * 2026-09-27: 슬라이더가 **경로 도크 → 센서 시트**로 옮겨 갔다. 도크를 펼쳐 찾으면 못 찾는다.
 */
export async function setSpeedKmh(page: Page, kmh: number): Promise<void> {
  await ensureRiding(page)
  const sheet = await openCadenceSheet(page)
  const slider = sheet.getByRole('slider', { name: '세션 속도 km/h' })
  await expect(slider).toBeVisible({ timeout: 10_000 })
  await slider.fill(String(kmh))
  // 숫자 입력이 함께 있으면 동기화를 확인한다(있을 때만).
  const spin = sheet.getByRole('spinbutton', { name: '속도 km/h' })
  if (await spin.isVisible().catch(() => false)) {
    await expect(spin).toHaveValue(String(kmh), { timeout: 3_000 })
  }
  await closeCadenceSheet(page)
}

/**
 * 동행 시험 산출물이 나갈 자리 — **기본은 추적되지 않는 `.out/`.**
 *
 * 왜 (2026-09-27) — 이 시험들은 `document/ops/sync-relay/` 에 직접 썼다. 한 번 돌리면
 * **13만 줄이 바뀐다.** 돌리면 저장소가 더러워지니 아무도 안 돌리게 되고, 그래서 12개가
 * 한 달 넘게 red 인 줄도 몰랐다. 감사 P2 와 같은 계열이고, e2e 두 스펙(09-25)과
 * S3 픽스처 게이트(09-26)가 이미 같은 처방으로 옮겨 갔다.
 *
 * 다만 이 산출물은 **보고서 증거로 쓰인 이력**이 있다. 그래서 필요할 때만 켠다:
 *
 *   PEER_SYNC_EVIDENCE=1   → `document/ops/sync-relay/` 에 쓴다(증거를 남길 때)
 *   (기본)                  → `apps/web/.out/sync-relay/` 에 쓴다
 */
const HERE = path.dirname(fileURLToPath(import.meta.url))

export const PEER_SYNC_OUT_DIR =
  process.env.PEER_SYNC_EVIDENCE === '1'
    ? path.resolve(HERE, '../../../document/ops/sync-relay')
    : path.resolve(HERE, '../.out/sync-relay')
