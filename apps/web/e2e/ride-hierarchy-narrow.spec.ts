import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

/**
 * RIDE-IN-RIDE-HIERARCHY-3 H3 — 좁은 가로에서 Go·종료/일시정지 조작 가능.
 * ride-entry 와 동일하게 Firebase 에뮬레이터 + RIDE_VERIFY_LIVE=1 컨텍스트에서만 실행.
 */
const LIVE = process.env.RIDE_VERIFY_LIVE === '1'

/** RouteDock.css 계측 기준(690×275)과 동일한 폰 가로 */
const NARROW_LANDSCAPE = { width: 690, height: 275 }

/** Playwright cwd = apps/web */
const ARCHIVE_DIR = path.resolve(process.cwd(), '../../document/archive')
if (!fs.existsSync(ARCHIVE_DIR)) fs.mkdirSync(ARCHIVE_DIR, { recursive: true })

async function enterAsGuest(page: import('@playwright/test').Page) {
  await page.goto('/')
  const gate = page.getByRole('dialog', { name: '시작' })
  await expect(gate).toBeVisible()
  await gate.getByRole('button', { name: '시작', exact: true }).click()
  await expect(gate).toBeHidden()
}

async function prepareManualRideInput(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: /케이던스 센서/ }).click()
  const sheet = page.getByRole('dialog', { name: '케이던스 센서' })
  await expect(sheet).toBeVisible()
  await sheet.getByRole('button', { name: '체험 속도로 준비' }).click()
  await sheet.getByRole('button', { name: '센서 설정 닫기' }).click()
  await expect(sheet).toBeHidden()
}

async function loadFirstIntroCourse(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Trail 메뉴' }).click()
  await page.getByRole('button', { name: '입문' }).click()
  const modal = page.getByRole('dialog').filter({ has: page.locator('#oc-modal-title') })
  await expect(modal).toBeVisible()
  await modal.locator('button.oc-modal__item').first().click()
}

/** 버튼 중심이 viewport 안에 있고 enabled 이면 클릭 가능으로 본다 */
async function assertClickableInViewport(
  page: import('@playwright/test').Page,
  name: RegExp | string,
) {
  const btn = page.getByRole('button', { name })
  await expect(btn).toBeVisible()
  await expect(btn).toBeEnabled()
  const box = await btn.boundingBox()
  expect(box, `${String(name)} boundingBox`).not.toBeNull()
  const vp = page.viewportSize()!
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.y).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width + 1)
  expect(box!.y + box!.height).toBeLessThanOrEqual(vp.height + 1)
  await btn.click({ trial: true })
}

test.describe('주행 중 HUD 위계 — 좁은 가로 조작', () => {
  test.skip(!LIVE, 'Firebase 준비 필요 — RIDE_VERIFY_LIVE=1 로 실행')

  test.use({ viewport: NARROW_LANDSCAPE })

  test('ready-to-start — Go 클릭 가능(H3)', async ({ page }) => {
    await enterAsGuest(page)
    await prepareManualRideInput(page)
    await loadFirstIntroCourse(page)

    const start = page.getByRole('button', { name: '주행 시작' })
    await assertClickableInViewport(page, '주행 시작')

    await page.screenshot({
      path: path.join(ARCHIVE_DIR, '260913-ride-hierarchy-narrow-ready-to-start.png'),
      fullPage: false,
    })

    await start.click()
    await expect(page.getByRole('group', { name: '주행 지표' })).toBeVisible()
  })

  test('riding — 일시정지·종료 클릭 가능(H3)', async ({ page }) => {
    await enterAsGuest(page)
    await prepareManualRideInput(page)
    await loadFirstIntroCourse(page)

    const start = page.getByRole('button', { name: '주행 시작' })
    await expect(start).toBeEnabled()
    await start.click()
    await expect(page.getByRole('group', { name: '주행 지표' })).toBeVisible()

    await assertClickableInViewport(page, '일시정지')
    await assertClickableInViewport(page, '주행 종료')

    await page.screenshot({
      path: path.join(ARCHIVE_DIR, '260913-ride-hierarchy-narrow-riding.png'),
      fullPage: false,
    })
  })
})
