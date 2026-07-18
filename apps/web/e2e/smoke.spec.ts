import { test, expect } from '@playwright/test'

// 앱이 뜨는지만 확인하는 최소 스모크 테스트. 실제 시나리오 테스트의 골격 예시.
test('앱이 로드된다', async ({ page }) => {
  await page.goto('/')
  // 문서 <title>이 비어 있지 않으면 최소한 셸이 렌더된 것으로 본다.
  await expect(page).toHaveTitle(/.+/)
})
