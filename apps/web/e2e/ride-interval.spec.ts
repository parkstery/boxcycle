import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const preview = '/scripts/ui-800x360/preview.html';
test.use({ viewport: { width: 800, height: 360 } });

test('30초 경계·일시정지·재개는 주행 활동시간을 공유한다', async ({ page }) => {
  await page.clock.install();
  await page.goto(`${preview}?state=riding&interval&intervalMs=713000`);
  const hud = page.getByRole('group', { name: '인터벌 안내' });
  await expect(hud.locator('.ride-interval-hud__phase')).toHaveText('운동');
  await expect(hud.locator('.ride-interval-hud__repeat')).toHaveText('3 / 5');
  await expect(hud.locator('.ride-interval-hud__time')).toHaveText('7');
  await page.getByRole('button', { name: '일시정지', exact: true }).click();
  await expect(hud.locator('.ride-interval-hud__phase')).toHaveText('일시정지');
  const frozen = await hud.locator('.ride-interval-hud__time').textContent();
  await page.clock.runFor(60_000);
  await expect(hud.locator('.ride-interval-hud__time')).toHaveText(frozen!);
  await page.getByRole('button', { name: '재개', exact: true }).click();
  await page.clock.runFor(7_200);
  await expect(hud.locator('.ride-interval-hud__phase')).toHaveText('회복');
  await expect(hud.locator('.ride-interval-hud__time')).toHaveText('2:00');
  await page.getByRole('button', { name: '주행 종료', exact: true }).click();
  await expect(hud).toHaveCount(0);
});

test('센서 없이도 단계가 진행되고 완료 뒤 주행 제어는 유지된다', async ({ page }) => {
  await page.clock.install();
  await page.goto(`${preview}?state=riding&interval&intervalMs=1499000&noSensor`);
  const hud = page.getByRole('group', { name: '인터벌 안내' });
  await expect(hud).toContainText('페달 강도 직접 조절');
  await page.clock.runFor(1_200);
  await expect(hud).toContainText('완료');
  await expect(hud).toContainText('자유 주행 계속');
  await expect(page.getByRole('button', { name: '일시정지', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '주행 종료', exact: true })).toBeVisible();
});

async function openRideSettingsFromMenu(page: import('@playwright/test').Page) {
  const menu = page.getByRole('button', { name: 'Trail 메뉴', exact: true });
  await menu.focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: '주행 설정', exact: true }).click();
  return page.getByRole('dialog', { name: '주행 설정', exact: true });
}

test('기본은 끔이며 설정에서 선택하고 주행 중 다시 켜면 준비부터 시작한다', async ({ page }) => {
  await page.clock.install();
  await page.goto(`${preview}?state=settings`);
  const toggle = page.getByRole('switch', { name: /^인터벌/ });
  await expect(toggle).not.toBeChecked();
  await toggle.check();
  await page.getByRole('button', { name: '주행 설정 닫기', exact: true }).click();
  await expect(page.getByRole('group', { name: '인터벌 안내' })).toHaveCount(0);
  await page.getByRole('button', { name: '주행 시작', exact: true }).click();
  await expect(page.locator('.ride-interval-hud__phase')).toHaveText('준비');
  await expect(page.locator('.ride-interval-hud__time')).toHaveText('5:00');

  await page.goto(`${preview}?state=riding&interval&intervalMs=713000&short`);
  await expect(page.locator('.ride-interval-hud__phase')).toHaveText('운동');
  const settings = await openRideSettingsFromMenu(page);
  const ridingToggle = settings.getByRole('switch', { name: /^인터벌/ });
  await expect(ridingToggle).toBeChecked();
  await ridingToggle.uncheck();
  await expect(page.getByRole('group', { name: '인터벌 안내' })).toHaveCount(0);
  await ridingToggle.check();
  await settings.getByRole('button', { name: '주행 설정 닫기', exact: true }).click();
  await expect(page.locator('.ride-interval-hud__phase')).toHaveText('준비');
  await expect(page.locator('.ride-interval-hud__time')).toHaveText('5:00');
  await page.getByRole('button', { name: '주행 종료', exact: true }).click();
  await expect(page.getByRole('group', { name: '인터벌 안내' })).toHaveCount(0);
  await expect(page.locator('.audit-world')).toHaveAttribute('data-ui-stage', 'ready-to-start');
  await page.getByRole('button', { name: '검수용 새 경로 확정', exact: true }).click();
  await page.getByRole('button', { name: '주행 시작', exact: true }).click();
  await expect(page.locator('.ride-interval-hud__phase')).toHaveText('준비');
  await expect(page.locator('.ride-interval-hud__time')).toHaveText('5:00');
});

for (const size of [{width:800,height:360},{width:667,height:300},{width:844,height:390}]) {
  test(`왼쪽 인터벌은 기존 UI와 겹치지 않고 지도를 막지 않는다 ${size.width}×${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.clock.install();
    for (const state of ['riding','paused']) {
      await page.goto(`${preview}?state=${state}&interval&intervalMs=330000&long`);
      const hud = page.getByRole('group', { name: '인터벌 안내' });
      await expect(hud).toBeVisible();
      const geometry = await hud.evaluate(el => {
        const a=el.getBoundingClientRect();
        const overlaps=[...document.querySelectorAll('.map-hud__tr,.ride-control-bar,.map-bottom-left-stack,.hud-coach')].filter(other=>{
          const b=other.getBoundingClientRect();
          return b.width>0 && b.height>0 && a.left<b.right && a.right>b.left && a.top<b.bottom && a.bottom>b.top;
        }).map(other=>other.className);
        return {overlaps,left:a.left,center:a.x+a.width/2,inside:a.left>=0 && a.right<=innerWidth && a.top>=0 && a.bottom<=innerHeight,pointer:getComputedStyle(el).pointerEvents,background:getComputedStyle(el).backgroundColor};
      });
      expect(geometry.overlaps).toEqual([]);
      expect(geometry.left).toBeLessThan(size.width*0.35);
      expect(geometry.center).toBeLessThan(size.width*0.4);
      expect(geometry.inside).toBe(true);
      expect(geometry.pointer).toBe('none');
      expect(geometry.background).toBe('rgba(0, 0, 0, 0.35)');
      if (process.env.INTERVAL_EVIDENCE_DIR) {
        await fs.mkdir(process.env.INTERVAL_EVIDENCE_DIR,{recursive:true});
        await page.screenshot({path:path.join(process.env.INTERVAL_EVIDENCE_DIR,`${state}-${size.width}x${size.height}.png`)});
      }
    }
  });
}
