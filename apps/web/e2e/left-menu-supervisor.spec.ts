import fs from 'node:fs/promises';
import path from 'node:path';
import { test, expect } from '@playwright/test';

const preview = '/scripts/ui-800x360/preview.html';
const evidence = process.env.LEFT_MENU_EVIDENCE_DIR ?? path.resolve('../../document/ops/20261029-left-menu/evidence');

for (const [width, height] of [[800,360],[736,320],[699,273],[667,300],[320,640]]) {
  test(`왼쪽 메뉴 승인 배치와 경계 ${width}x${height}`, async ({page}) => {
    await page.setViewportSize({width,height});
    await page.goto(`${preview}?state=menu`);
    const menu = page.getByRole('dialog',{name:'메뉴',exact:true});
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('button',{name:'지명 검색',exact:true})).toHaveAttribute('title','지명 검색');
    await expect(menu.getByRole('button',{name:'지명 검색',exact:true})).toHaveText('');
    // 10-30 Chief: 왼쪽 메뉴 본문은 Trail 전용. Chief 11-02 v4: 지도 핀(경로 목록)·⚙(주행 설정)은 머리줄 아이콘.
    await expect(menu.getByRole('group',{name:'경로 목록 열기'})).toHaveCount(0);
    await expect(menu.getByRole('button',{name:'순위',exact:true})).toHaveCount(0);
    await expect(menu.getByRole('button',{name:'인터벌',exact:true})).toHaveCount(0);
    for (const name of ['지명 검색','경로 목록','주행 설정']) await expect(menu.locator('.menu-panel__head').getByRole('button',{name,exact:true})).toHaveAttribute('title',name);
    const box = (await menu.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(-1);
    expect(box.x+box.width).toBeLessThanOrEqual(width+1);
    for (const button of await menu.locator('button:visible').all()) {
      const r = (await button.boundingBox())!;
      expect(r.x).toBeGreaterThanOrEqual(-1);
      expect(r.x+r.width).toBeLessThanOrEqual(width+1);
      expect(r.y+r.height).toBeLessThanOrEqual(height+1);
    }
    await fs.mkdir(evidence,{recursive:true});
    await page.screenshot({path:path.join(evidence,`menu-${width}x${height}.png`),animations:'disabled'});
  });
}

test('메뉴 지도 핀은 「내 경로」부터 열고 출처를 바꾸며, INT·⚙ 로 인터벌·주행 설정',async({page})=>{
  await page.setViewportSize({width:699,height:273});
  await page.goto(`${preview}?state=ready`);
  await page.getByRole('button',{name:'메뉴 열기',exact:true}).click();
  await page.locator('#menu-panel').getByRole('button',{name:'경로 목록',exact:true}).click();
  await expect(page.locator('.oc-modal__sources button[aria-pressed=true]')).toHaveText('내 경로');
  for(const name of ['퍼블릭','입문','내 경로']){
    await page.locator('.oc-modal__sources').getByRole('button',{name,exact:true}).click();
    await expect(page.locator('.oc-modal__sources button[aria-pressed=true]')).toHaveText(name);
  }
  await page.locator('.oc-modal__close').click();
  await expect(page.locator('.oc-modal__sources')).toHaveCount(0);
  // 경로 목록은 메뉴에서 열었으므로 닫으면 메뉴로 돌아온다 — 메뉴를 닫고 오른쪽 묶음 INT.
  await page.locator('#menu-panel').getByRole('button',{name:'메뉴 닫기',exact:true}).click();
  await page.getByRole('button',{name:'인터벌 운동 설정',exact:true}).click();
  const editor=page.getByRole('dialog',{name:'인터벌 운동 설정',exact:true});
  await expect(editor).toBeVisible();
  const enabled=editor.getByRole('switch',{name:'인터벌',exact:true});
  await enabled.check();
  await expect(enabled).toBeChecked();
  await editor.getByRole('button',{name:'직접 조절',exact:true}).click();
  await expect(editor.getByRole('spinbutton',{name:'준비 시간 초',exact:true})).toBeVisible();
  const overflow=await editor.locator('.ride-interval-settings__header').evaluate(el=>{
    const parent=el.getBoundingClientRect();
    return [...el.children].map(child=>{const r=child.getBoundingClientRect();return r.left>=parent.left-1&&r.right<=parent.right+1;});
  });
  expect(overflow.every(Boolean)).toBeTruthy();
  await fs.mkdir(evidence,{recursive:true});
  await page.screenshot({path:path.join(evidence,'interval-custom-699x273.png'),animations:'disabled'});
  await editor.getByRole('button',{name:'인터벌 운동 설정 닫기',exact:true}).click();
  await page.getByRole('button',{name:'메뉴 열기',exact:true}).click();
  await page.locator('#menu-panel').getByRole('button',{name:'주행 설정',exact:true}).click();
  const settings=page.getByRole('dialog',{name:'주행 설정',exact:true});
  await expect(settings).toBeVisible();
  await expect(settings.getByRole('switch',{name:'인터벌',exact:true})).toHaveCount(0);
  await expect(settings.getByRole('button',{name:'운동 설정',exact:true})).toHaveCount(0);
});

// Chief 11-02 v4: 오른쪽 반달 탭은 없다 — 순위는 오른쪽 묶음의 순위 버튼.
test('왼쪽 에지 툴팁은 열림 상태를 설명하고 오른쪽 반달은 없다',async({page})=>{
  await page.goto(`${preview}?state=ready`);
  const left=page.locator('.edge-panel-tab--left');
  await expect(left).toHaveAttribute('title','메뉴 열기');
  await expect(page.locator('.edge-panel-tab--right')).toHaveCount(0);
  await left.click();
  await expect(left).toHaveAttribute('title','메뉴 닫기');
  // Chief 11-03: 열린 메뉴가 원형 버튼을 덮는다 — 닫기는 메뉴의 닫기 버튼.
  await page.getByRole('dialog',{name:'메뉴',exact:true}).getByRole('button',{name:'메뉴 닫기',exact:true}).click();
  const rail=page.locator('.map-hud__rail');
  await expect(rail.getByRole('button',{name:'순위 열기',exact:true})).toHaveAttribute('title','순위 열기');
  await rail.getByRole('button',{name:'순위 열기',exact:true}).click();
  await expect(rail.getByRole('button',{name:'순위 닫기',exact:true})).toHaveAttribute('aria-expanded','true');
});
