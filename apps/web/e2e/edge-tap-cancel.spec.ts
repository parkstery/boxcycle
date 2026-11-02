import { expect, test } from '@playwright/test';

test('핸들 포인터 취소 후 첫 키보드 활성화가 무시되지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 699, height: 273 });
  await page.goto('/scripts/ui-800x360/preview.html?state=riding');
  // Chief 11-02 v4: 오른쪽 반달은 없다(순위는 오른쪽 묶음 버튼) — 왼쪽 메뉴 반달만.
  await expect(page.locator('.edge-panel-tab--right')).toHaveCount(0);
  for (const side of ['left']) {
    const tab = page.locator(`.edge-panel-tab--${side}`);
    await tab.dispatchEvent('pointerdown', {
      pointerType: 'touch', isPrimary: true, pointerId: 50,
      clientX: side === 'left' ? 10 : 689, clientY: 136,
    });
    await tab.dispatchEvent('pointercancel', { pointerType: 'touch', isPrimary: true, pointerId: 50 });
    await tab.focus();
    await page.keyboard.press('Enter');
    await expect(tab).toHaveAttribute('aria-expanded', 'true');
    // 메뉴가 열리면 포커스가 메뉴 안으로 간다 — 손잡이로 돌아와 닫는다.
    await tab.focus();
    await page.keyboard.press('Space');
    await expect(tab).toHaveAttribute('aria-expanded', 'false');
  }
});
