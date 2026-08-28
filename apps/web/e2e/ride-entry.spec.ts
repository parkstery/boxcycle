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

/**
 * 입문 실도로 경로 계약 — `apps/web/src/lib/basicIntroHubRouteGeometries.ts` 와 같은 값.
 * 정적 검증은 `scripts/basic-routes-verify/verify-basic-routes.mjs` 가 하고,
 * 여기서는 "목록에 정확히 3개가 뜨고 각각 실제로 로드·주행 시작까지 간다"만 본다.
 */
const BASIC_INTRO_TITLES = [
  'Basic 1 · 서울 남산공원길',
  'Basic 2 · 파리 퐁뇌프',
  'Basic 3 · 뉴욕 센트럴파크',
]
const BASIC_INTRO_MAX_KM = 0.5

/**
 * 실패 리소스 로그용 URL 마스킹.
 * Mapbox 타일·Directions URL 쿼리에는 `access_token=pk.…` 이 실린다 —
 * 테스트 로그·CI 아티팩트에 토큰이 남지 않도록 쿼리스트링을 통째로 지운다.
 */
function redactUrl(url: string): string {
  const q = url.indexOf('?')
  return q === -1 ? url : `${url.slice(0, q)}?<redacted>`
}

/** 게스트 진입 카드 → 익명 인증 완료 */
async function enterAsGuest(page: import('@playwright/test').Page) {
  await page.goto('/')
  const gate = page.getByRole('dialog', { name: '시작' })
  await expect(gate).toBeVisible()
  await gate.getByRole('button', { name: '시작', exact: true }).click()
  await expect(gate).toBeHidden()
}

/**
 * 주행 입력 준비 — Go 의 사전조건(SENSOR-2 §1.4).
 * 자동 E2E 에는 BLE 장치가 없으므로 HUD 센서 칩 → 센서 상세 설정에서
 * 「체험 속도로 준비」를 **명시적으로** 고른다. 기본 manual 초기값만으로는 Go 가 잠긴다.
 */
async function prepareManualRideInput(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: /케이던스 센서/ }).click()
  const sheet = page.getByRole('dialog', { name: '케이던스 센서' })
  await expect(sheet).toBeVisible()
  await sheet.getByRole('button', { name: '체험 속도로 준비' }).click()
  await sheet.getByRole('button', { name: '센서 설정 닫기' }).click()
  await expect(sheet).toBeHidden()
}

/** Trail 메뉴 → '입문' → 코스 모달 */
async function openBasicCourseModal(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Trail 메뉴' }).click()
  await page.getByRole('button', { name: '입문' }).click()
  const modal = page.getByRole('dialog').filter({ has: page.locator('#oc-modal-title') })
  await expect(modal).toBeVisible()
  return modal
}

test.describe('실주행 진입 시퀀스', () => {
  test.skip(!LIVE, 'Firebase 준비 필요 — RIDE_VERIFY_LIVE=1 로 실행')

  test('게스트 → 주행 입력 준비 → 입문 코스 → 주행 시작 → running', async ({ page }) => {
    await enterAsGuest(page)
    await prepareManualRideInput(page)

    // 코스 모달에서 첫 코스 로드 (제목은 런타임 카탈로그라 첫 항목을 집는다)
    // 헤더 '닫기' 버튼이 DOM 상 리스트보다 앞이라 `.first()` 로 아무 버튼이나 집으면 모달만 닫힌다 —
    // 반드시 코스 항목(.oc-modal__item) 만 겨냥한다.
    const modal = await openBasicCourseModal(page)
    await modal.locator('button.oc-modal__item').first().click()

    // 주행 시작 (RouteDock 'Go' = aria '주행 시작')
    const start = page.getByRole('button', { name: '주행 시작' })
    await expect(start).toBeVisible()
    await start.click()

    // running 확정 — 주행 지표 그룹 + 주행 종료 버튼
    await expect(page.getByRole('group', { name: '주행 지표' })).toBeVisible()
    await expect(page.getByRole('button', { name: '주행 종료' })).toBeVisible()
  })

  test('입문 목록은 실도로 경로 3개이고 전부 0.5km 이하', async ({ page }) => {
    await enterAsGuest(page)
    const modal = await openBasicCourseModal(page)

    const items = modal.locator('button.oc-modal__item')
    await expect(items).toHaveCount(BASIC_INTRO_TITLES.length)

    for (let i = 0; i < BASIC_INTRO_TITLES.length; i += 1) {
      const item = items.nth(i)
      await expect(item.locator('.oc-modal__item-name')).toHaveText(BASIC_INTRO_TITLES[i]!)

      // 부제 "자전거 · 0.41 km · 예상 …" — 실도로 seed 라면 전부 0.5km 이하여야 한다.
      const sub = (await item.locator('.oc-modal__item-sub').innerText()).trim()
      const km = Number(sub.match(/([\d.]+)\s*km/)?.[1])
      expect(Number.isFinite(km), `거리 파싱 실패: ${sub}`).toBe(true)
      expect(km).toBeGreaterThan(0)
      expect(km).toBeLessThanOrEqual(BASIC_INTRO_MAX_KM)
    }
  })

  test('입력 준비 전에는 Go 가 잠긴다', async ({ page }) => {
    await enterAsGuest(page)
    const modal = await openBasicCourseModal(page)
    await modal.locator('button.oc-modal__item').first().click()

    // 기본 manual 초기값은 사용자의 선택이 아니다 — Go 는 disabled 여야 한다.
    const start = page.getByRole('button', { name: '주행 시작' })
    await expect(start).toBeVisible()
    await expect(start).toBeDisabled()

    await prepareManualRideInput(page)
    await expect(start).toBeEnabled()
  })

  for (const [index, title] of BASIC_INTRO_TITLES.entries()) {
    test(`입문 ${index + 1} '${title}' 로드 → 주행 시작 → running`, async ({ page }) => {
      // 스크립트 예외(pageerror)와 "리소스 로드 실패가 아닌" 콘솔 오류만 회귀로 본다.
      // 에뮬레이터 환경에서는 앱과 무관한 404/401 리소스 응답이 상시 섞인다 — 대신
      // 실패한 리소스 URL 을 모아 두고, 경로 로드에 필요한 것이 아닌지 따로 확인한다.
      const pageErrors: string[] = []
      const consoleErrors: string[] = []
      const failedResources: string[] = []
      page.on('console', (msg) => {
        const text = msg.text()
        if (msg.type() !== 'error') return
        if (text.includes('Failed to load resource')) return
        consoleErrors.push(text)
      })
      page.on('pageerror', (err) => pageErrors.push(String(err)))
      page.on('response', (res) => {
        // ⚠ 쿼리스트링에 Mapbox access_token 이 실려 온다 — 로그에 절대 남기지 않는다.
        if (res.status() >= 400) failedResources.push(`${res.status()} ${redactUrl(res.url())}`)
      })

      await enterAsGuest(page)
      await prepareManualRideInput(page)
      const modal = await openBasicCourseModal(page)
      await modal.locator('button.oc-modal__item').nth(index).click()

      const start = page.getByRole('button', { name: '주행 시작' })
      await expect(start).toBeVisible()
      await start.click()

      await expect(page.getByRole('group', { name: '주행 지표' })).toBeVisible()
      await expect(page.getByRole('button', { name: '주행 종료' })).toBeVisible()

      expect(pageErrors, `스크립트 예외: ${pageErrors.join(' | ')}`).toEqual([])
      expect(consoleErrors, `콘솔 오류: ${consoleErrors.join(' | ')}`).toEqual([])

      // 경로 자체(Directions·타일·seed)를 못 불러온 실패는 없어야 한다.
      const routeCritical = failedResources.filter((r) => /directions|routePublications/i.test(r))
      expect(routeCritical, `경로 리소스 실패: ${routeCritical.join(' | ')}`).toEqual([])
      if (failedResources.length > 0) {
        console.info(`[ride-entry] 환경성 리소스 실패(회귀 아님): ${failedResources.join(' | ')}`)
      }
    })
  }
})
