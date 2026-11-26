import { expect, test } from '@playwright/test';

for (const size of [{ width: 800, height: 360 }, { width: 667, height: 300 }]) {
  test(`계정 정보 배치와 주행 기록 ${size.width}×${size.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(size);
    await page.goto('/scripts/ui-800x360/preview.html?state=account&historyPreview=1&accountUser=1');
    const sheet = page.getByRole('dialog', { name: '사용자 정보' });
    const identity = sheet.locator('.user-info-sheet__id');
    const tabs = sheet.getByRole('tablist', { name: '통계 기간' });
    const road = sheet.getByRole('group', { name: '내 도로망', exact: true });
    const close = sheet.getByRole('button', { name: '닫기', exact: true });
    await expect(identity).toBeVisible();
    const idBox = (await identity.boundingBox())!;
    const tabsBox = (await tabs.boundingBox())!;
    const roadBox = (await road.boundingBox())!;
    const labelBox = (await road.locator('.user-info-sheet__row-k').boundingBox())!;
    const valueBox = (await road.locator('.user-info-sheet__row-v').boundingBox())!;
    const closeBox = (await close.boundingBox())!;
    expect(idBox.y + idBox.height).toBeLessThanOrEqual(tabsBox.y);
    expect(idBox.x).toBeLessThan(roadBox.x);
    expect(valueBox.x - (labelBox.x + labelBox.width)).toBeLessThanOrEqual(8);
    expect(valueBox.x + valueBox.width).toBeLessThanOrEqual(closeBox.x);
    await sheet.screenshot({ path: testInfo.outputPath('account.png'), animations: 'disabled' });
    await sheet.getByRole('tab', { name: '주간' }).click();
    await expect(sheet.getByRole('tab', { name: '주간' })).toHaveAttribute('aria-selected', 'true');
    const history = sheet.getByRole('button', { name: /마지막 주행/ });
    await history.click();
    await expect(sheet.locator('#user-info-sheet-history-list')).toBeVisible();
    await history.click();
    await expect(road).toBeVisible();
    await close.click();
    await expect(sheet).toBeHidden();
  });
}
