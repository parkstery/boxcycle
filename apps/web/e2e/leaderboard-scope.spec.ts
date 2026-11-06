import { test, expect } from './open-meteo-stub';

/**
 * 순위 범위 버튼(Chief 11-04 A안, 고정76) — 기간 버튼과 같은 꼴, 누를 때마다 세계 → 대륙 → 국가.
 * 대표 국가가 있을 때만 버튼(거리·개척 판 모두, G5), 국가 없음은 「세계」 글자. 마지막 범위를 기억한다.
 * 실제 LeaderboardSheet 를 미리보기(fetch 흉내)로 띄운다. 요청 범위는 body[data-lb-last-scope] 로 본다.
 */
const preview = '/scripts/ui-800x360/preview.html';
const sizes = [{ width: 800, height: 360 }, { width: 699, height: 273 }];

for (const size of sizes) {
  test(`범위 버튼 순환·기억·머리줄 그대로 ${size.width}×${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto(`${preview}?state=leaderboard&country=KR`);
    await page.evaluate(() => localStorage.removeItem('rtw.leaderboard.scope'));
    await page.reload();
    const sheet = page.getByRole('dialog', { name: '리더보드', exact: true });
    const scopeBtn = sheet.locator('.leaderboard-sheet__scope-btn');
    const body = page.locator('body');
    await expect(scopeBtn).toHaveText('세계 ▾');
    await expect(body).toHaveAttribute('data-lb-last-scope', 'world');
    await scopeBtn.click();
    await expect(body).toHaveAttribute('data-lb-last-scope', 'continent');
    await expect(scopeBtn).toHaveText('아시아 ▾');
    await scopeBtn.click();
    await expect(body).toHaveAttribute('data-lb-last-scope', 'country');
    await expect(scopeBtn).toHaveText('대한민국 ▾');

    const geom = await sheet.locator('.leaderboard-sheet__top').evaluate((top) => {
      const btn = top.querySelector('.leaderboard-sheet__scope-btn')!.getBoundingClientRect();
      const period = top.querySelector('.leaderboard-sheet__period-btn:not(.leaderboard-sheet__scope-btn)')!.getBoundingClientRect();
      const close = top.querySelector('.leaderboard-sheet__close')!.getBoundingClientRect();
      return { topH: top.getBoundingClientRect().height, btnH: btn.height, periodH: period.height, clear: close.left - btn.right };
    });
    expect(geom.topH).toBeLessThanOrEqual(28);
    expect(geom.btnH).toBe(geom.periodH);
    expect(geom.clear).toBeGreaterThan(8);

    // 기억: 다시 열면 마지막 범위
    await page.reload();
    await expect(scopeBtn).toHaveText('대한민국 ▾');
    await expect(body).toHaveAttribute('data-lb-last-scope', 'country');
    await scopeBtn.click();
    await expect(scopeBtn).toHaveText('세계 ▾');
    await expect(body).toHaveAttribute('data-lb-last-scope', 'world');
  });
}

test('개척 판도 범위 버튼이 있고, 국가 없음은 「세계」 글자만·요청도 세계', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 360 });
  await page.goto(`${preview}?state=leaderboard&country=KR`);
  await page.evaluate(() => localStorage.setItem('rtw.leaderboard.scope', 'country'));
  await page.reload();
  const sheet = page.getByRole('dialog', { name: '리더보드', exact: true });
  await expect(sheet.locator('.leaderboard-sheet__scope-btn')).toHaveText('대한민국 ▾');
  await sheet.getByRole('button', { name: '개척', exact: true }).click();
  await expect(sheet.locator('.leaderboard-sheet__scope-btn')).toHaveText('대한민국 ▾');

  await page.goto(`${preview}?state=leaderboard`);
  await expect(sheet.locator('.leaderboard-sheet__scope-btn')).toHaveCount(0);
  await expect(sheet.locator('.leaderboard-sheet__scope-label')).toHaveText('세계');
  await expect(page.locator('body')).toHaveAttribute('data-lb-last-scope', 'world');
});
