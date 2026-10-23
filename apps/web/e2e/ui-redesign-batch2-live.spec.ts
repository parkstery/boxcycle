import fs from 'node:fs/promises';
import path from 'node:path';
import { test, expect } from './open-meteo-stub';
import { guestStart } from './rideEntryHelpers';

test.skip(!process.env.FIRESTORE_EMULATOR_HOST, 'Firebase 에뮬레이터 전용');
test.use({ viewport: { width: 800, height: 360 } });
test('실제 App의 대기·주행·일시정지와 센서 접근·카메라 연결', async ({page}, info) => {
  test.setTimeout(120_000);
  const capture = async (state:string) => {
    const dir = process.env.BATCH2_EVIDENCE_DIR;
    if (dir) await fs.mkdir(dir,{recursive:true});
    await page.screenshot({path:dir?path.join(dir,`batch2-live-${state}-800x360.png`):info.outputPath(`${state}.png`),animations:'disabled'});
  };
  await page.goto('/'); await guestStart(page);
  await page.getByRole('button',{name:/케이던스 센서/}).click();
  const sheet=page.getByRole('dialog',{name:'케이던스 센서',exact:true});
  await sheet.getByRole('button',{name:'센서 없음',exact:true}).click();
  await sheet.getByRole('button',{name:'센서 설정 닫기'}).click();
  await page.getByRole('button',{name:'Trail 메뉴',exact:true}).focus();await page.keyboard.press('Enter');
  await page.getByRole('button',{name:'입문',exact:true}).click();
  await page.locator('button.oc-modal__item').nth(3).click();
  const start=page.getByRole('button',{name:'주행 시작',exact:true});
  await expect(start).toBeEnabled();
  await expect(page.getByRole('group',{name:'주행 지표'}).getByText('고도',{exact:true})).toBeVisible();
  await expect(page.locator('.hud-metrics__value--elevation')).not.toHaveText('…',{timeout:30_000});
  await capture('ready');await start.click();
  await expect(page.getByRole('button',{name:'일시정지',exact:true})).toBeVisible();
  const sensor=page.getByRole('button',{name:/케이던스 센서/});
  await expect(sensor).toHaveCount(1);await sensor.click();await expect(sheet).toBeVisible();
  await sheet.getByRole('button',{name:'센서 설정 닫기'}).click();
  const camera=page.locator('.camera-view-menu__trigger');
  for(let i=0;i<6;i++){
    await camera.click();await page.getByRole('menuitemradio').nth(i).click();
    await camera.click();await expect(page.getByRole('menuitemradio').nth(i)).toHaveAttribute('aria-checked','true');await page.keyboard.press('Escape');
  }
  const labels=new Set<string>();
  for(let turn=0;turn<3;turn++){
    await camera.click();await page.getByRole('menuitemradio').first().click();
    labels.add((await camera.innerText()).replace('▾','').trim());
  }
  expect(labels.size).toBe(3);
  // Return to route fit after verifying all three modes for a stable comparison view.
  await camera.click();await page.getByRole('menuitemradio').first().click();
  await expect(camera).toContainText('전체');
  await capture('riding');
  await page.getByRole('button',{name:'일시정지',exact:true}).click();
  await expect(page.getByText('잠깐 멈췄어요',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'일시정지 옵션',exact:true})).toBeVisible();
  await capture('paused');
  await page.getByRole('button',{name:'재개',exact:true}).click();
  await expect(page.getByRole('button',{name:'일시정지',exact:true})).toBeVisible();
});
