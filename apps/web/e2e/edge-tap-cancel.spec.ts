import { expect, test } from '@playwright/test';

test('핸들 포인터 취소 후 첫 키보드 활성화가 무시되지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 699, height: 273 });
  await page.goto('/scripts/ui-800x360/preview.html?state=riding');
  for (const side of ['left', 'right']) {
    const tab = page.locator(`.edge-panel-tab--${side}`);
    await tab.dispatchEvent('pointerdown', {
      pointerType: 'touch', isPrimary: true, pointerId: 50,
      clientX: side === 'left' ? 10 : 689, clientY: 136,
    });
    await tab.dispatchEvent('pointercancel', { pointerType: 'touch', isPrimary: true, pointerId: 50 });
    await tab.focus();
    await page.keyboard.press('Enter');
    await expect(tab).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Space');
    await expect(tab).toHaveAttribute('aria-expanded', 'false');
  }
});
