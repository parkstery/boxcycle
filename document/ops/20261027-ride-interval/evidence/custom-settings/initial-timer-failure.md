# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ride-interval-settings.spec.ts >> 직접 설정한 시간·반복이 실제 단계 전환과 완료에 쓰인다
- Location: e2e\ride-interval-settings.spec.ts:50:1

# Error details

```
Error: expect(locator).toHaveText(expected) failed

Locator:  locator('.ride-interval-hud__phase')
Expected: "회복"
Received: "운동"
Timeout:  5000ms

Call log:
  - Expect "toHaveText" with timeout 5000ms
  - waiting for locator('.ride-interval-hud__phase')
    14 × locator resolved to <span class="ride-interval-hud__phase">운동</span>
       - unexpected value "운동"

```

```yaml
- text: 운동
```

# Test source

```ts
  1   | import { expect, test, type Page } from '@playwright/test';
  2   | import fs from 'node:fs/promises';
  3   | import path from 'node:path';
  4   | 
  5   | const preview = '/scripts/ui-800x360/preview.html';
  6   | const key = 'spinatlas.rideInterval.config.v1';
  7   | const editor = (page: Page) => page.getByRole('dialog', {name:'인터벌 운동 설정',exact:true});
  8   | const settings = (page: Page) => page.getByRole('dialog', {name:'주행 설정',exact:true});
  9   | test.use({viewport:{width:699,height:273},reducedMotion:'reduce'});
  10  | 
  11  | async function openEditor(page: Page) {
  12  |   await settings(page).getByRole('button',{name:'운동 설정',exact:true}).click();
  13  |   await expect(editor(page)).toBeVisible();
  14  |   await expect(settings(page)).toHaveCount(0);
  15  | }
  16  | async function openFromRide(page: Page) {
  17  |   await page.getByRole('button',{name:'Trail 메뉴',exact:true}).focus();
  18  |   await page.keyboard.press('Enter');
  19  |   await page.getByRole('button',{name:'주행 설정',exact:true}).click();
  20  |   await openEditor(page);
  21  | }
  22  | async function configure(page: Page, high: string, low: string, repeats: string) {
  23  |   await editor(page).getByRole('spinbutton',{name:'고강도 시간 초',exact:true}).fill(high);
  24  |   await editor(page).getByRole('spinbutton',{name:'저강도 시간 초',exact:true}).fill(low);
  25  |   await editor(page).getByRole('spinbutton',{name:'반복 수',exact:true}).fill(repeats);
  26  | }
  27  | 
  28  | test('8종 프리셋은 총시간을 갱신하고 적용한 선택만 주행 설정에 반영한다', async ({page}) => {
  29  |   await page.goto(`${preview}?state=settings`);
  30  |   await openEditor(page);
  31  |   const select=editor(page).getByRole('combobox',{name:'운동 프리셋'});
  32  |   await expect(select.locator('option')).toHaveCount(9);
  33  |   const options=await select.locator('option').evaluateAll(nodes=>nodes.map(node=>(node as HTMLOptionElement).value));
  34  |   const totals=['15:00','17:30','18:00','18:00','22:00','20:00','22:00','25:00'];
  35  |   for(let index=0;index<8;index++){
  36  |     await select.selectOption(options[index]);
  37  |     await expect(editor(page).locator('.ride-interval-settings__total strong')).toHaveText(totals[index]);
  38  |   }
  39  |   await editor(page).getByRole('button',{name:'설정 적용',exact:true}).click();
  40  |   await expect(settings(page)).toContainText('90초 / 60초 ×6회 · 총 25:00');
  41  |   await openEditor(page);
  42  |   await expect(select).toHaveValue('90-60-6');
  43  |   await configure(page,'45','60','6');
  44  |   await expect(select).toHaveValue('custom');
  45  |   await expect(editor(page).locator('.ride-interval-settings__total strong')).toHaveText('20:30');
  46  |   await page.keyboard.press('Escape');
  47  |   await expect(settings(page)).toContainText('90초 / 60초 ×6회 · 총 25:00');
  48  | });
  49  | 
  50  | test('직접 설정한 시간·반복이 실제 단계 전환과 완료에 쓰인다', async ({page}) => {
  51  |   await page.clock.install();
  52  |   await page.goto(`${preview}?state=settings`);
  53  |   await settings(page).getByRole('switch',{name:/^인터벌/}).check();
  54  |   await openEditor(page);
  55  |   await configure(page,'45','60','6');
  56  |   await editor(page).getByRole('button',{name:'설정 적용',exact:true}).click();
  57  |   await settings(page).getByRole('button',{name:'주행 설정 닫기',exact:true}).click();
  58  |   await page.getByRole('button',{name:'주행 시작',exact:true}).click();
  59  |   await page.clock.fastForward(300_000);
  60  |   await expect(page.locator('.ride-interval-hud__phase')).toHaveText('운동');
  61  |   await expect(page.locator('.ride-interval-hud__time')).toHaveText('45');
  62  |   await expect(page.locator('.ride-interval-hud__repeat')).toHaveText('1 / 6');
  63  |   await page.clock.fastForward(45_000);
> 64  |   await expect(page.locator('.ride-interval-hud__phase')).toHaveText('회복');
      |                                                           ^ Error: expect(locator).toHaveText(expected) failed
  65  |   await expect(page.locator('.ride-interval-hud__time')).toHaveText('1:00');
  66  |   await page.clock.fastForward(60_000);
  67  |   await expect(page.locator('.ride-interval-hud__repeat')).toHaveText('2 / 6');
  68  |   await page.clock.fastForward(825_000);
  69  |   await expect(page.locator('.ride-interval-hud__time')).toHaveText('완료');
  70  |   await expect(page.getByRole('button',{name:'일시정지',exact:true})).toBeVisible();
  71  | });
  72  | 
  73  | test('진행 중 초안·취소·같은 설정은 운동을 바꾸지 않고 변경 적용만 준비부터 재시작한다', async ({page}) => {
  74  |   await page.clock.install();
  75  |   await page.goto(`${preview}?state=riding&interval&intervalMs=426000`);
  76  |   await openFromRide(page);
  77  |   await editor(page).getByRole('button',{name:'설정 적용',exact:true}).click();
  78  |   await expect(page.locator('.ride-interval-hud__phase')).toHaveText('운동');
  79  |   await openEditor(page);
  80  |   await configure(page,'45','60','6');
  81  |   await expect(editor(page)).toContainText('적용하면 준비부터 다시 시작해요');
  82  |   await expect(page.locator('.ride-interval-hud__phase')).toHaveText('운동');
  83  |   await editor(page).getByRole('button',{name:'인터벌 운동 설정 닫기',exact:true}).click();
  84  |   await expect(settings(page)).toContainText('30초 / 30초 ×5회');
  85  |   await openEditor(page);
  86  |   await configure(page,'45','60','6');
  87  |   await editor(page).getByRole('button',{name:'설정 적용',exact:true}).click();
  88  |   await expect(page.locator('.ride-interval-hud__phase')).toHaveText('준비');
  89  |   await expect(page.locator('.ride-interval-hud__time')).toHaveText('5:00');
  90  |   await settings(page).getByRole('button',{name:'주행 설정 닫기',exact:true}).click();
  91  |   await page.getByRole('button',{name:'일시정지',exact:true}).click();
  92  |   await openFromRide(page);
  93  |   await configure(page,'20','40','8');
  94  |   await editor(page).getByRole('button',{name:'설정 적용',exact:true}).click();
  95  |   await page.clock.fastForward(60_000);
  96  |   await expect(page.locator('.ride-interval-hud__phase')).toHaveText('일시정지');
  97  |   await expect(page.locator('.ride-interval-hud__time')).toHaveText('5:00');
  98  | });
  99  | 
  100 | test('입력 오류는 적용을 차단하고 취소하면 저장값을 보존한다', async ({page}) => {
  101 |   await page.goto(`${preview}?state=settings`);
  102 |   await openEditor(page);
  103 |   const input=editor(page).getByRole('spinbutton',{name:'고강도 시간 초',exact:true});
  104 |   for(const invalid of ['', '0', '4', '601', '7.5']){
  105 |     await input.fill(invalid);
  106 |     await expect(editor(page).getByRole('button',{name:'설정 적용',exact:true})).toBeDisabled();
  107 |     await expect(editor(page).getByRole('alert')).toBeVisible();
  108 |   }
  109 |   await configure(page,'7','11','0');
  110 |   await expect(editor(page).getByRole('button',{name:'설정 적용',exact:true})).toBeDisabled();
  111 |   await configure(page,'7','11','31');
  112 |   await expect(editor(page).getByRole('button',{name:'설정 적용',exact:true})).toBeDisabled();
  113 |   await configure(page,'7','11','3');
  114 |   await expect(editor(page).locator('.ride-interval-settings__total strong')).toHaveText('10:54');
  115 |   await expect(editor(page).getByRole('button',{name:'설정 적용',exact:true})).toBeEnabled();
  116 |   await page.keyboard.press('Escape');
  117 |   expect(await page.evaluate(storageKey=>localStorage.getItem(storageKey),key)).toBeNull();
  118 | });
  119 | 
  120 | test('설정은 새로고침 후 복원되고 인터벌 사용은 자동으로 켜지지 않는다', async ({page}) => {
  121 |   await page.goto(`${preview}?state=settings&persistInterval`);
  122 |   await openEditor(page);
  123 |   await configure(page,'45','60','6');
  124 |   await editor(page).getByRole('button',{name:'설정 적용',exact:true}).click();
  125 |   await page.reload();
  126 |   await expect(settings(page)).toContainText('45초 / 60초 ×6회 · 총 20:30');
  127 |   await expect(settings(page).getByRole('switch',{name:/^인터벌/})).not.toBeChecked();
  128 | });
  129 | 
  130 | test('저장 데이터 파손·저장소 접근 불가에서도 기본값과 메모리 설정이 동작한다', async ({page}) => {
  131 |   await page.addInitScript(storageKey=>localStorage.setItem(storageKey,'{"highSec":"oops"}'),key);
  132 |   await page.goto(`${preview}?state=settings&persistInterval`);
  133 |   await expect(settings(page)).toContainText('30초 / 30초 ×5회 · 총 15:00');
  134 |   await page.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new Error('blocked');},configurable:true}));
  135 |   await page.reload();
  136 |   await openEditor(page);
  137 |   await configure(page,'20','40','8');
  138 |   await editor(page).getByRole('button',{name:'설정 적용',exact:true}).click();
  139 |   await expect(settings(page)).toContainText('20초 / 40초 ×8회 · 총 18:00');
  140 | });
  141 | 
  142 | test.describe('지도 가림 최소화',()=>{
  143 |   test.use({hasTouch:true,isMobile:true});
  144 |   for(const size of [{width:699,height:273},{width:667,height:300},{width:800,height:360},{width:320,height:568}]){
  145 |     test(`내용에 맞춘 창 ${size.width}×${size.height}`,async({page})=>{
  146 |       await page.setViewportSize(size);
  147 |       await page.goto(`${preview}?state=settings`);
  148 |       await openEditor(page);
  149 |       const geometry=await page.locator('.ride-interval-settings__panel').evaluate(el=>{
  150 |         const box=el.getBoundingClientRect();
  151 |         const children=[...el.querySelectorAll('button,input,select,label,.ride-interval-settings__summary')].map(child=>child.getBoundingClientRect());
  152 |         const fields=el.querySelector('.ride-interval-settings__fields')!.getBoundingClientRect();
  153 |         const summary=el.querySelector('.ride-interval-settings__summary')!.getBoundingClientRect();
  154 |         return {width:box.width,height:box.height,overflow:el.scrollHeight>el.clientHeight+1,inside:box.left>=0&&box.top>=0&&box.right<=innerWidth&&box.bottom<=innerHeight,childrenInside:children.every(child=>child.left>=box.left&&child.right<=box.right),overlap:fields.left<summary.right&&fields.right>summary.left&&fields.top<summary.bottom&&fields.bottom>summary.top,cover:box.width*box.height/(innerWidth*innerHeight)};
  155 |       });
  156 |       expect(geometry.width).toBeLessThanOrEqual(480);
  157 |       expect(geometry.inside).toBe(true);
  158 |       expect(geometry.childrenInside).toBe(true);
  159 |       expect(geometry.overflow).toBe(false);
  160 |       expect(geometry.overlap).toBe(false);
  161 |       if(size.width>440){expect(geometry.height).toBeLessThanOrEqual(248);expect(geometry.cover).toBeLessThan(.65);}
  162 |       if(process.env.INTERVAL_SETTINGS_EVIDENCE_DIR){await fs.mkdir(process.env.INTERVAL_SETTINGS_EVIDENCE_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.INTERVAL_SETTINGS_EVIDENCE_DIR,`settings-${size.width}x${size.height}.png`)});}
  163 |     });
  164 |   }
```