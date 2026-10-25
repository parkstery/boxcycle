import fs from 'node:fs/promises';
import path from 'node:path';
import { test, expect, type Page } from '@playwright/test';

/** Render the real sheet with a subscription result fixture; never contact Firestore. */
async function mockConquestResult(page: Page, status: string, newMeters: number) {
  const fixture = JSON.stringify({ status, newMeters });
  await page.route('**/src/hooks/useRideConquestResult.ts*', (route) => route.fulfill({
    contentType: 'application/javascript',
    body: `const result = ${fixture}; export function useRideConquestResult() { return result; }`,
  }));
}

for (const size of [{ width: 800, height: 360 }, { width: 667, height: 300 }]) {
  test(`확정 새 도로는 단위와 함께 가장 크게 읽힌다 ${size.width}×${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await mockConquestResult(page, 'positive', 160);
    await page.goto('/scripts/ui-800x360/preview.html?state=summary');
    const value = page.locator('.ride-summary__conquest-value');
    await expect(value).toHaveText(/\+0\.16\s*km/);
    const geometry = await value.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const column = element.closest('.ride-summary__col--primary')!.getBoundingClientRect();
      const progress = element.closest('.ride-summary__col--primary')!
        .querySelector('.ride-summary__progress')!.getBoundingClientRect();
      return { fontSize: parseFloat(getComputedStyle(element).fontSize),
        right: box.right, columnRight: column.right, height: box.height,
        progressBottomGap: column.bottom - progress.bottom };
    });
    expect(geometry.fontSize).toBeGreaterThanOrEqual(60);
    expect(geometry.right).toBeLessThanOrEqual(geometry.columnRight);
    expect(geometry.height).toBeGreaterThan(40);
    expect(geometry.progressBottomGap).toBeLessThanOrEqual(24);
    if (process.env.BATCH3_EVIDENCE_DIR) {
      await fs.mkdir(process.env.BATCH3_EVIDENCE_DIR, { recursive: true });
      await page.screenshot({ path: path.join(process.env.BATCH3_EVIDENCE_DIR,
        `after-summary-positive-${size.width}x${size.height}.png`), animations: 'disabled' });
    }
  });
}

test('확정 0은 양수 새 도로 숫자를 만들지 않는다', async ({ page }) => {
  await mockConquestResult(page, 'confirmed_zero', 0);
  await page.goto('/scripts/ui-800x360/preview.html?state=summary');
  await expect(page.locator('.ride-summary__progress')).toBeVisible();
  await expect(page.locator('.ride-summary__conquest-value')).toHaveCount(0);
});

test('새 도로 확인 실패는 양수 숫자 대신 상태를 보여 준다', async ({ page }) => {
  await mockConquestResult(page, 'error', 0);
  await page.goto('/scripts/ui-800x360/preview.html?state=summary');
  await expect(page.locator('.ride-summary__conquest-status')).toContainText(/확인하지 못/);
  await expect(page.locator('.ride-summary__conquest-value')).toHaveCount(0);
});
