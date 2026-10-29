import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const preview = '/scripts/ui-800x360/preview.html';
const key = 'spinatlas.rideInterval.config.v1';
const editor = (page: Page) => page.getByRole('dialog', {name:'인터벌 운동 설정',exact:true});
const settings = (page: Page) => page.getByRole('dialog', {name:'주행 설정',exact:true});
test.use({viewport:{width:699,height:273},reducedMotion:'reduce'});

async function openEditor(page: Page) {
  if (await settings(page).count()) {
    await settings(page).getByRole('button',{name:'주행 설정 닫기',exact:true}).click();
  }
  if (await editor(page).count()) {
    await expect(editor(page)).toBeVisible();
    return;
  }
  await page.getByRole('button',{name:'Trail 메뉴',exact:true}).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button',{name:'인터벌',exact:true}).click();
  await expect(editor(page)).toBeVisible();
}
async function openFromRide(page: Page) {
  await openEditor(page);
}
async function expandCustom(page: Page) {
  const toggle=editor(page).getByRole('button',{name:'직접 조절',exact:true});
  if(await toggle.count()) await toggle.click();
}
async function fillSpin(page: Page, name: string, value: string) {
  const input=editor(page).getByRole('spinbutton',{name,exact:true});
  await input.fill(value);
  await expect(input).toHaveValue(value);
}
async function configure(page: Page, high: string, low: string, repeats: string, warmup='300', cooldown='300') {
  await expandCustom(page);
  await fillSpin(page,'고강도 시간 초',high);
  await fillSpin(page,'저강도 시간 초',low);
  await fillSpin(page,'반복 수',repeats);
  const rounds=editor(page).getByRole('spinbutton',{name:'라운드 수',exact:true});
  if(await rounds.count()){
    await rounds.fill('1');
    await editor(page).getByRole('spinbutton',{name:'라운드 사이 휴식 시간 초',exact:true}).fill('0');
  }
  await fillSpin(page,'준비 시간 초',warmup);
  await fillSpin(page,'마무리 시간 초',cooldown);
}

test('3종 프리셋은 총시간을 갱신하고 적용한 선택만 주행 설정에 반영한다', async ({page}) => {
  await page.goto(`${preview}?state=settings`);
  await openEditor(page);
  const select=editor(page).getByRole('combobox',{name:'운동 프리셋'});
  await expect(select.locator('option')).toHaveCount(9);
  const options=['recovery','balanced','short'];
  const totals=['25:00','26:00','26:00'];
  for(let index=0;index<3;index++){
    await select.selectOption(options[index]);
    await expect(editor(page).locator('.ride-interval-settings__total strong')).toHaveText(totals[index]);
  }
  await expect(editor(page)).toContainText('2라운드');
  await expect(editor(page)).toContainText('사이 3분');
  await editor(page).getByRole('button',{name:'설정 적용',exact:true}).click();
  await openEditor(page);
  await expect(editor(page)).toContainText('20초 / 10초 ×8');
  await expect(editor(page).locator('.ride-interval-settings__total strong')).toHaveText('26:00');
  await expect(select).toHaveValue('short');
  await configure(page,'45','60','6');
  // Chief 10-29 A안: 직접 조절 중에는 프리셋 칸을 숨기고, 「접기」 뒤에 「직접 설정」으로 보인다.
  await expect(select).toHaveCount(0);
  await expect(editor(page).locator('.ride-interval-settings__total strong')).toHaveText('20:30');
  await editor(page).getByRole('button',{name:'접기',exact:true}).click();
  await expect(select).toHaveValue('custom');
  await expect(editor(page).locator('.ride-interval-settings__total strong')).toHaveText('20:30');
  await page.keyboard.press('Escape');
  await openEditor(page);
  await expect(editor(page)).toContainText('20초 / 10초 ×8');
  await expect(editor(page).locator('.ride-interval-settings__total strong')).toHaveText('26:00');
});

test('시간별 프리셋을 조절해 적용하면 새로고침 뒤에도 유지된다', async ({page}) => {
  await page.goto(`${preview}?state=settings&persistInterval`);
  await openEditor(page);
  const select=editor(page).getByRole('combobox',{name:'운동 프리셋'});
  for (const minutes of [10,15,20,25,30]) {
    await select.selectOption(`${minutes}min`);
    await expect(editor(page).locator('.ride-interval-settings__total strong')).toHaveText(`${minutes}:00`);
  }
  await select.selectOption('20min');
  await expandCustom(page);
  await fillSpin(page,'고강도 시간 초','35');
  await editor(page).getByRole('button',{name:'설정 적용',exact:true}).click();
  await page.reload();
  await openEditor(page);
  await expect(editor(page).getByRole('spinbutton',{name:'고강도 시간 초'})).toHaveValue('35');
  await expect(editor(page).getByRole('spinbutton',{name:'라운드 수'})).toHaveValue('2');
  await expect(editor(page).getByRole('spinbutton',{name:'라운드 사이 휴식 시간 초'})).toHaveValue('120');
});

test('접기는 초안을 유지한 채 요약으로 돌아간다', async ({page}) => {
  await page.goto(`${preview}?state=settings`);
  await openEditor(page);
  await expandCustom(page);
  await fillSpin(page,'고강도 시간 초','45');
  await fillSpin(page,'저강도 시간 초','60');
  await fillSpin(page,'반복 수','6');
  await editor(page).getByRole('button',{name:'접기',exact:true}).click();
  await expect(editor(page).getByRole('button',{name:'직접 조절',exact:true})).toBeVisible();
  await expect(editor(page).locator('.ride-interval-settings__compact-copy')).toContainText('45초 / 60초 ×6');
  await expect(editor(page).getByRole('spinbutton',{name:'고강도 시간 초',exact:true})).toHaveCount(0);
  await expandCustom(page);
  await expect(editor(page).getByRole('spinbutton',{name:'고강도 시간 초',exact:true})).toHaveValue('45');
  await expect(editor(page).getByRole('spinbutton',{name:'저강도 시간 초',exact:true})).toHaveValue('60');
  await expect(editor(page).getByRole('spinbutton',{name:'반복 수',exact:true})).toHaveValue('6');
});

test('직접 설정한 시간·반복이 실제 단계 전환과 완료에 쓰인다', async ({page}) => {
  await page.clock.install();
  await page.goto(`${preview}?state=settings`);
  await openEditor(page);
  await editor(page).getByRole('switch',{name:/^인터벌/}).check();
  await configure(page,'45','60','6');
  await editor(page).getByRole('button',{name:'설정 적용',exact:true}).click();
  await page.getByRole('button',{name:'주행 시작',exact:true}).click();
  await page.clock.fastForward(300_000);
  await expect(page.locator('.ride-interval-hud__phase')).toHaveText('운동');
  await expect(page.locator('.ride-interval-hud__time')).toHaveText('45');
  await expect(page.locator('.ride-interval-hud__repeat')).toHaveText('1 / 6');
  await page.clock.fastForward(45_000);
  await expect(page.locator('.ride-interval-hud__phase')).toHaveText('회복');
  await expect(page.locator('.ride-interval-hud__time')).toHaveText('1:00');
  await page.clock.fastForward(60_000);
  await expect(page.locator('.ride-interval-hud__repeat')).toHaveText('2 / 6');
  await page.clock.fastForward(825_000);
  await expect(page.locator('.ride-interval-hud__time')).toHaveText('완료');
  await expect(page.getByRole('button',{name:'일시정지',exact:true})).toBeVisible();
});

test('진행 중 초안·취소·같은 설정은 운동을 바꾸지 않고 변경 적용만 준비부터 재시작한다', async ({page}) => {
  await page.clock.install();
  await page.goto(`${preview}?state=riding&interval&intervalMs=330000`);
  await openFromRide(page);
  await editor(page).getByRole('button',{name:'설정 적용',exact:true}).click();
  await expect(page.locator('.ride-interval-hud__phase')).toHaveText('운동');
  await openEditor(page);
  await configure(page,'45','60','6');
  await expect(editor(page)).toContainText('적용하면 처음부터 다시 시작해요');
  await expect(page.locator('.ride-interval-hud__phase')).toHaveText('운동');
  await editor(page).getByRole('button',{name:'인터벌 운동 설정 닫기',exact:true}).click();
  await openEditor(page);
  await expect(editor(page)).toContainText('60초 / 120초 ×5');
  await configure(page,'45','60','6');
  await editor(page).getByRole('button',{name:'설정 적용',exact:true}).click();
  await expect(page.locator('.ride-interval-hud__phase')).toHaveText('준비');
  await expect(page.locator('.ride-interval-hud__time')).toHaveText('5:00');
  await page.getByRole('button',{name:'일시정지',exact:true}).click();
  await openFromRide(page);
  await configure(page,'20','40','8');
  await editor(page).getByRole('button',{name:'설정 적용',exact:true}).click();
  await page.clock.fastForward(60_000);
  await expect(page.locator('.ride-interval-hud__phase')).toHaveText('일시정지');
  await expect(page.locator('.ride-interval-hud__time')).toHaveText('5:00');
});

test('입력 오류는 적용을 차단하고 취소하면 저장값을 보존한다', async ({page}) => {
  await page.goto(`${preview}?state=settings`);
  await openEditor(page);
  await expandCustom(page);
  const input=editor(page).getByRole('spinbutton',{name:'고강도 시간 초',exact:true});
  for(const invalid of ['', '0', '4', '601', '7.5']){
    await input.fill(invalid);
    await expect(editor(page).getByRole('button',{name:'설정 적용',exact:true})).toBeDisabled();
    await expect(editor(page).getByRole('alert')).toBeVisible();
  }
  await configure(page,'7','11','0');
  await expect(editor(page).getByRole('button',{name:'설정 적용',exact:true})).toBeDisabled();
  await configure(page,'7','11','31');
  await expect(editor(page).getByRole('button',{name:'설정 적용',exact:true})).toBeDisabled();
  await configure(page,'7','11','3');
  await expect(editor(page).locator('.ride-interval-settings__total strong')).toHaveText('10:54');
  await expect(editor(page).getByRole('button',{name:'설정 적용',exact:true})).toBeEnabled();
  await page.keyboard.press('Escape');
  expect(await page.evaluate(storageKey=>localStorage.getItem(storageKey),key)).toBeNull();
});

test('설정은 새로고침 후 복원되고 인터벌 사용은 자동으로 켜지지 않는다', async ({page}) => {
  await page.goto(`${preview}?state=settings&persistInterval`);
  await openEditor(page);
  await configure(page,'45','60','6');
  await editor(page).getByRole('button',{name:'설정 적용',exact:true}).click();
  await page.reload();
  await openEditor(page);
  await expect(editor(page).locator('.ride-interval-settings__total strong')).toHaveText('20:30');
  await expandCustom(page);
  await expect(editor(page).getByRole('spinbutton',{name:'고강도 시간 초',exact:true})).toHaveValue('45');
  await expect(editor(page).getByRole('spinbutton',{name:'저강도 시간 초',exact:true})).toHaveValue('60');
  await expect(editor(page).getByRole('spinbutton',{name:'반복 수',exact:true})).toHaveValue('6');
  await expect(editor(page).getByRole('switch',{name:/^인터벌/})).not.toBeChecked();
});

test('저장 데이터 파손·저장소 접근 불가에서도 기본값과 메모리 설정이 동작한다', async ({page}) => {
  await page.addInitScript(storageKey=>localStorage.setItem(storageKey,'{"highSec":"oops"}'),key);
  await page.goto(`${preview}?state=settings&persistInterval`);
  await openEditor(page);
  await expect(editor(page).locator('.ride-interval-settings__total strong')).toHaveText('25:00');
  await expandCustom(page);
  await expect(editor(page).getByRole('spinbutton',{name:'고강도 시간 초',exact:true})).toHaveValue('60');
  await expect(editor(page).getByRole('spinbutton',{name:'저강도 시간 초',exact:true})).toHaveValue('120');
  await expect(editor(page).getByRole('spinbutton',{name:'반복 수',exact:true})).toHaveValue('5');
  await page.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new Error('blocked');},configurable:true}));
  await page.reload();
  await openEditor(page);
  await configure(page,'20','40','8');
  await editor(page).getByRole('button',{name:'설정 적용',exact:true}).click();
  await openEditor(page);
  await expect(editor(page).locator('.ride-interval-settings__total strong')).toHaveText('18:00');
  await expandCustom(page);
  await expect(editor(page).getByRole('spinbutton',{name:'고강도 시간 초',exact:true})).toHaveValue('20');
  await expect(editor(page).getByRole('spinbutton',{name:'저강도 시간 초',exact:true})).toHaveValue('40');
  await expect(editor(page).getByRole('spinbutton',{name:'반복 수',exact:true})).toHaveValue('8');
});

test('주행 중 설정 복원용 저장소 읽기는 매 프레임 반복하지 않는다', async ({page}) => {
  await page.clock.install();
  await page.addInitScript(storageKey=>{
    const original=Storage.prototype.getItem;
    const counts: Record<string,number>={reads:0};
    Object.assign(window,{intervalConfigReadCounts:counts});
    Storage.prototype.getItem=function(name:string){if(name===storageKey)counts.reads++;return original.call(this,name);};
  },key);
  await page.goto(`${preview}?state=riding&interval&persistInterval`);
  const reads=()=>page.evaluate(()=>((window as unknown as {intervalConfigReadCounts:{reads:number}}).intervalConfigReadCounts.reads));
  const initial=await reads();
  expect(initial).toBeGreaterThan(0);
  await page.clock.runFor(3000);
  expect(await reads()).toBe(initial);
});

test('준비·마무리는 기본 5분에서 버튼·키보드로 30초씩 증감한다',async({page})=>{
  await page.goto(`${preview}?state=settings`);
  await openEditor(page);
  await expandCustom(page);
  for(const label of ['준비','마무리']){
    const input=editor(page).getByRole('spinbutton',{name:`${label} 시간 초`,exact:true});
    await expect(input).toHaveValue('300');
    await editor(page).getByRole('button',{name:`${label} 30초 늘리기`,exact:true}).click();
    await expect(input).toHaveValue('330');
    await editor(page).getByRole('button',{name:`${label} 30초 줄이기`,exact:true}).click();
    await expect(input).toHaveValue('300');
    await input.focus();await input.press('ArrowDown');
    await expect(input).toHaveValue('270');
    await input.press('ArrowUp');
    await expect(input).toHaveValue('300');
    await input.fill('0');await editor(page).getByRole('button',{name:`${label} 30초 줄이기`,exact:true}).click();
    await expect(input).toHaveValue('0');
    await input.fill('1800');await editor(page).getByRole('button',{name:`${label} 30초 늘리기`,exact:true}).click();
    await expect(input).toHaveValue('1800');
  }
});

test('준비·마무리 설정과 총시간을 저장하고 해당 시간대로 단계가 전환된다',async({page})=>{
  await page.clock.install();
  await page.goto(`${preview}?state=settings&persistInterval`);
  await openEditor(page);
  await expandCustom(page);
  await configure(page,'7','11','3');
  await editor(page).getByRole('spinbutton',{name:'준비 시간 초',exact:true}).fill('15');
  await editor(page).getByRole('spinbutton',{name:'마무리 시간 초',exact:true}).fill('20');
  await expect(editor(page).locator('.ride-interval-settings__total strong')).toHaveText('1:29');
  await editor(page).getByRole('button',{name:'설정 적용',exact:true}).click();
  await page.reload();
  await openEditor(page);
  await expandCustom(page);
  await expect(editor(page).getByRole('spinbutton',{name:'준비 시간 초',exact:true})).toHaveValue('15');
  await expect(editor(page).getByRole('spinbutton',{name:'마무리 시간 초',exact:true})).toHaveValue('20');
  await editor(page).getByRole('switch',{name:/^인터벌/}).check();
  await editor(page).getByRole('button',{name:'인터벌 운동 설정 닫기',exact:true}).click();
  await page.getByRole('button',{name:'주행 시작',exact:true}).click();
  await expect(page.locator('.ride-interval-hud__time')).toHaveText('15');
  await page.clock.fastForward(15_000);
  await expect(page.locator('.ride-interval-hud__phase')).toHaveText('운동');
  await expect(page.locator('.ride-interval-hud__time')).toHaveText('7');
  await page.clock.fastForward(54_000);
  await expect(page.locator('.ride-interval-hud__phase')).toHaveText('마무리');
  await expect(page.locator('.ride-interval-hud__time')).toHaveText('20');
  await page.clock.fastForward(20_000);
  await expect(page.locator('.ride-interval-hud__time')).toHaveText('완료');
});

test('준비·마무리 0초는 건너뛰고 잘못된 시간은 적용을 막는다',async({page})=>{
  await page.clock.install();
  await page.goto(`${preview}?state=settings`);
  await openEditor(page);
  await editor(page).getByRole('switch',{name:/^인터벌/}).check();
  await expandCustom(page);
  const warmup=editor(page).getByRole('spinbutton',{name:'준비 시간 초',exact:true});
  for(const raw of ['', '-1', '1801', '1.5']){
    await warmup.fill(raw);
    await expect(editor(page).getByRole('button',{name:'설정 적용',exact:true})).toBeDisabled();
  }
  await configure(page,'7','11','3','0','0');
  await expect(editor(page).locator('.ride-interval-settings__total strong')).toHaveText('0:54');
  await editor(page).getByRole('button',{name:'설정 적용',exact:true}).click();
  await openEditor(page);
  await expandCustom(page);
  await expect(editor(page).getByRole('spinbutton',{name:'준비 시간 초',exact:true})).toHaveValue('0');
  await expect(editor(page).getByRole('spinbutton',{name:'마무리 시간 초',exact:true})).toHaveValue('0');
  await editor(page).getByRole('button',{name:'인터벌 운동 설정 닫기',exact:true}).click();
  await page.getByRole('button',{name:'주행 시작',exact:true}).click();
  await expect(page.locator('.ride-interval-hud__phase')).toHaveText('운동');
  await expect(page.locator('.ride-interval-hud__time')).toHaveText('7');
  await page.clock.fastForward(54_000);
  await expect(page.locator('.ride-interval-hud__time')).toHaveText('완료');
});

test('기존 세 필드 저장값의 운동은 보존하고 준비·마무리는 5분으로 복원한다',async({page})=>{
  await page.goto(`${preview}?state=settings&persistInterval`);
  await page.evaluate(storageKey=>localStorage.setItem(storageKey,JSON.stringify({highSec:45,lowSec:60,repeats:6})),key);
  await page.reload();
  await openEditor(page);
  await expect(editor(page).locator('.ride-interval-settings__total strong')).toHaveText('20:30');
  await expandCustom(page);
  await expect(editor(page).getByRole('spinbutton',{name:'고강도 시간 초',exact:true})).toHaveValue('45');
  await expect(editor(page).getByRole('spinbutton',{name:'저강도 시간 초',exact:true})).toHaveValue('60');
  await expect(editor(page).getByRole('spinbutton',{name:'반복 수',exact:true})).toHaveValue('6');
  await expect(editor(page).getByRole('spinbutton',{name:'준비 시간 초',exact:true})).toHaveValue('300');
  await expect(editor(page).getByRole('spinbutton',{name:'마무리 시간 초',exact:true})).toHaveValue('300');
  await editor(page).getByRole('spinbutton',{name:'준비 시간 초',exact:true}).fill('0');
  await editor(page).getByRole('spinbutton',{name:'마무리 시간 초',exact:true}).fill('60');
  await editor(page).getByRole('button',{name:'설정 적용',exact:true}).click();
  await page.reload();
  await openEditor(page);
  await expect(editor(page).locator('.ride-interval-settings__total strong')).toHaveText('11:30');
  await expandCustom(page);
  await expect(editor(page).getByRole('spinbutton',{name:'고강도 시간 초',exact:true})).toHaveValue('45');
  await expect(editor(page).getByRole('spinbutton',{name:'저강도 시간 초',exact:true})).toHaveValue('60');
  await expect(editor(page).getByRole('spinbutton',{name:'반복 수',exact:true})).toHaveValue('6');
  await expect(editor(page).getByRole('spinbutton',{name:'준비 시간 초',exact:true})).toHaveValue('0');
  await expect(editor(page).getByRole('spinbutton',{name:'마무리 시간 초',exact:true})).toHaveValue('60');
});

test.describe('지도 가림 최소화',()=>{
  test.use({hasTouch:true,isMobile:true});
  for(const size of [{width:699,height:273},{width:667,height:300},{width:800,height:360},{width:320,height:568}]){
    test(`내용에 맞춘 창 ${size.width}×${size.height}`,async({page})=>{
      await page.setViewportSize(size);
      await page.goto(`${preview}?state=settings`);
      await expect(settings(page)).toBeVisible();
      await page.locator('.ride-settings-sheet__panel').evaluate(el=>Promise.all(el.getAnimations().map(animation=>animation.finished.catch(()=>{}))));
      const parent=await page.locator('.ride-settings-sheet__panel').evaluate(el=>{
        const box=el.getBoundingClientRect();
        const children=[...el.querySelectorAll('button,input,label')].map(child=>child.getBoundingClientRect());
        return {width:box.width,height:box.height,inside:box.left>=0&&box.right<=innerWidth&&box.top>=0&&box.bottom<=innerHeight,childrenInside:children.every(child=>child.left>=box.left&&child.right<=box.right)};
      });
      expect(parent.width).toBeLessThanOrEqual(460);
      expect(parent.inside).toBe(true);
      expect(parent.childrenInside).toBe(true);
      if(process.env.INTERVAL_SETTINGS_EVIDENCE_DIR){await fs.mkdir(process.env.INTERVAL_SETTINGS_EVIDENCE_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.INTERVAL_SETTINGS_EVIDENCE_DIR,`ride-settings-${size.width}x${size.height}.png`)});await fs.writeFile(path.join(process.env.INTERVAL_SETTINGS_EVIDENCE_DIR,`ride-settings-${size.width}x${size.height}.metrics.json`),JSON.stringify(parent,null,2));}
      await openEditor(page);
      const folded=await page.locator('.ride-interval-settings__panel').evaluate(el=>{
        const box=el.getBoundingClientRect();
        const apply=el.querySelector('.ride-interval-settings__apply')!.getBoundingClientRect();
        return {width:box.width,height:box.height,inside:box.left>=0&&box.top>=0&&box.right<=innerWidth&&box.bottom<=innerHeight,applyVisible:apply.width>0&&apply.height>0};
      });
      expect(folded.width).toBeLessThanOrEqual(480);
      expect(folded.inside).toBe(true);
      expect(folded.applyVisible).toBe(true);
      await expandCustom(page);
      const geometry=await page.locator('.ride-interval-settings__panel').evaluate(el=>{
        const box=el.getBoundingClientRect();
        const apply=el.querySelector('.ride-interval-settings__apply')!.getBoundingClientRect();
        const targets=[...el.querySelectorAll('button,input,select')].map(target=>target.getBoundingClientRect());
        return {width:box.width,height:box.height,inside:box.left>=0&&box.top>=0&&box.right<=innerWidth&&box.bottom<=innerHeight,applyVisible:apply.bottom<=innerHeight&&apply.top>=0,minTargetWidth:Math.min(...targets.map(target=>target.width)),minTargetHeight:Math.min(...targets.map(target=>target.height))};
      });
      expect(geometry.width).toBeLessThanOrEqual(480);
      expect(geometry.inside).toBe(true);
      expect(geometry.applyVisible).toBe(true);
      expect(geometry.minTargetWidth).toBeGreaterThanOrEqual(32);
      expect(geometry.minTargetHeight).toBeGreaterThanOrEqual(28);
      if (size.width > 480) {
        const layout = await page.locator('.ride-interval-settings__panel').evaluate(el => {
          const body=el.querySelector('.ride-interval-settings__body')!;
          const apply=el.querySelector('.ride-interval-settings__apply')!.getBoundingClientRect();
          const fields=[...el.querySelectorAll('.ride-interval-settings__field')].map(field=>field.getBoundingClientRect());
          const bodyBox=body.getBoundingClientRect();
          return {height:el.getBoundingClientRect().height, width:el.getBoundingClientRect().width,
            columns:new Set(fields.map(field=>Math.round(field.left))).size,
            scroll:body.scrollHeight-body.clientHeight, bodyHeight:bodyBox.height,
            rightOffsets:[...el.querySelectorAll('.ride-interval-settings__stepper')].map(stepper=>Math.abs(stepper.getBoundingClientRect().right-apply.right))};
        });
        expect(layout.height).toBeLessThanOrEqual(Math.min(300, size.height-16));
        expect(layout.width).toBeLessThanOrEqual(230);
        expect(layout.columns).toBe(1);
        expect(Math.max(...layout.rightOffsets)).toBeLessThanOrEqual(1);
      }
      if(process.env.INTERVAL_SETTINGS_EVIDENCE_DIR){await fs.mkdir(process.env.INTERVAL_SETTINGS_EVIDENCE_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.INTERVAL_SETTINGS_EVIDENCE_DIR,`settings-${size.width}x${size.height}.png`)});await fs.writeFile(path.join(process.env.INTERVAL_SETTINGS_EVIDENCE_DIR,`settings-${size.width}x${size.height}.metrics.json`),JSON.stringify(geometry,null,2));}
      await configure(page,'600','600','30');
      await expect(editor(page).locator('.ride-interval-settings__total strong')).toHaveText('610:00');
      await editor(page).getByRole('spinbutton',{name:'준비 시간 초',exact:true}).fill('1800');
      await editor(page).getByRole('spinbutton',{name:'마무리 시간 초',exact:true}).fill('1800');
      await expect(editor(page).locator('.ride-interval-settings__total strong')).toHaveText('660:00');
    });
  }
});
