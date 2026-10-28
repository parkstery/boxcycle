import { test, expect } from '@playwright/test';
import path from 'node:path';
const preview = '/scripts/ui-800x360/preview.html';
test.use({ reducedMotion: 'reduce' });
for (const size of [{width:800,height:360},{width:667,height:300},{width:699,height:273}]) {
  test(`메뉴 통합 ${size.width}×${size.height}`, async ({page}) => {
    await page.setViewportSize(size);
    await page.goto(`${preview}?state=account&menuFixture&recent`);
    const controls=page.getByRole('group',{name:'내 도로망 표시',exact:true});
    await expect(controls.getByRole('button',{name:'전체 도로망',exact:true})).toHaveAttribute('aria-pressed','true');
    for(const button of await controls.getByRole('button').all()) expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    if(size.width===800 && process.env.MAP_MENU_EVIDENCE_DIR) await page.screenshot({path:path.join(process.env.MAP_MENU_EVIDENCE_DIR,'account-800x360.png')});
    await controls.getByRole('button',{name:'신규 도로만',exact:true}).click();
    await expect(controls).toBeHidden();
    await expect(page.locator('#batch4-fixture')).toHaveAttribute('data-map-conquest','recent');
    await page.getByRole('button',{name:"사용자 정보",exact:true}).click();
    await expect(controls.getByRole('button',{name:'신규 도로만',exact:true})).toHaveAttribute('aria-pressed','true');
    await controls.getByRole('button',{name:'전체 도로망',exact:true}).click();
    await expect(page.locator('#batch4-fixture')).toHaveAttribute('data-map-conquest','all');
    await page.goto(`${preview}?state=account&menuFixture`);
    await expect(page.getByRole('button',{name:'신규 도로만',exact:true})).toBeDisabled();
    for(const state of ['riding','paused']) {
      await page.goto(`${preview}?state=${state}&menuFixture`);
      await expect(page.locator('#map-view-sheet')).toHaveCount(0);
      await expect(page.getByRole('button',{name:/맵 뷰|도로 비교|거리 한 눈금/})).toHaveCount(0);
      await expect(page.getByRole('button',{name:'순위 열기',exact:true})).toBeVisible();
      await page.getByRole('button',{name:/카메라 메뉴/}).click();
      const terrain=page.getByRole('menuitemcheckbox',{name:/3D 뷰/});
      const six=page.locator('[data-camera-slot="6"]');
      await expect(terrain).toHaveAttribute('aria-checked','false');
      expect((await terrain.boundingBox())!.y).toBeGreaterThan((await six.boundingBox())!.y);
      await terrain.click();
      await expect(terrain).toHaveAttribute('aria-checked','true');
      await expect(page.locator('#batch4-fixture')).toHaveAttribute('data-map-enable3d','1');
      expect((await terrain.boundingBox())!.y+(await terrain.boundingBox())!.height).toBeLessThanOrEqual(size.height);
      if(state==='riding' && process.env.MAP_MENU_EVIDENCE_DIR) await page.screenshot({path:path.join(process.env.MAP_MENU_EVIDENCE_DIR,`camera-${size.width}x${size.height}.png`)});
      await terrain.click();
      await expect(page.locator('#batch4-fixture')).toHaveAttribute('data-map-enable3d','0');
      await six.click();
      await expect(page.getByRole('menu',{name:'시점 카메라',exact:true})).toHaveCount(0);
    }
  });
}
