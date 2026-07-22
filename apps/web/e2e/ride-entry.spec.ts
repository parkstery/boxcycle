import { test, expect } from '@playwright/test'

// 실주행 진입 시퀀스 e2e: 게스트(익명 인증) → 입문 코스 로드 → 주행 시작 → running 확정.
// 셀렉터는 scripts/ride-verify/entry-contract.mjs 와 동일한 계약을 쓴다 —
// 둘 중 하나를 바꾸면 다른 하나도 바꾼다(verify-selectors.mjs 가 계약 앵커를 지킨다).
//
// ⚠ Firebase 의존: 게스트 진입 = 실제 signInAnonymously, 코스 로드 = 실제 Firestore.
// 에뮬레이터 배선이 아직 없으므로(HARNESS.md 참고), 이 spec 은 기본 skip 이고
// RIDE_VERIFY_LIVE=1 일 때만 돈다 — 실 Firebase 프로젝트(익명 인증 허용)나
// 에뮬레이터가 준비된 환경에서만 켠다.
const LIVE = process.env.RIDE_VERIFY_LIVE === '1'

test.describe('실주행 진입 시퀀스', () => {
  test.skip(!LIVE, 'Firebase 준비 필요 — RIDE_VERIFY_LIVE=1 로 실행')

  test('게스트 → 입문 코스 → 주행 시작 → running', async ({ page }) => {
    await page.goto('/')

    // 1) 게스트 진입 — 익명 인증 '시작'
    const gate = page.getByRole('dialog', { name: '시작' })
    await expect(gate).toBeVisible()
    await gate.getByRole('button', { name: '시작', exact: true }).click()
    await expect(gate).toBeHidden()

    // 2) Trail 메뉴 → '입문' → 코스 모달
    await page.getByRole('button', { name: 'Trail 메뉴' }).click()
    await page.getByRole('button', { name: '입문' }).click()

    // 3) 코스 모달에서 첫 코스 로드 (제목은 런타임 카탈로그라 첫 항목을 집는다)
    const modal = page.getByRole('dialog').filter({ has: page.locator('#oc-modal-title') })
    await expect(modal).toBeVisible()
    await modal.getByRole('button').filter({ hasText: /.+/ }).first().click()

    // 4) 주행 시작 (RouteDock 'Go' = aria '주행 시작')
    const start = page.getByRole('button', { name: '주행 시작' })
    await expect(start).toBeVisible()
    await start.click()

    // 5) running 확정 — 주행 지표 그룹 + 주행 종료 버튼
    await expect(page.getByRole('group', { name: '주행 지표' })).toBeVisible()
    await expect(page.getByRole('button', { name: '주행 종료' })).toBeVisible()
  })
})
