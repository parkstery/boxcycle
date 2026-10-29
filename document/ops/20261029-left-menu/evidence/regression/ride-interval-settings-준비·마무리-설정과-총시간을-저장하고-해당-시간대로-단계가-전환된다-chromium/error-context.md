# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ride-interval-settings.spec.ts >> 준비·마무리 설정과 총시간을 저장하고 해당 시간대로 단계가 전환된다
- Location: e2e\ride-interval-settings.spec.ts:248:1

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: getByRole('dialog', { name: '인터벌 운동 설정', exact: true })
Expected substring: "준비 15초"
Received string:    "인터벌 운동사용10분15분20분25분30분회복형 1:2균형형 1:1짧은 반복 20:10직접 설정준비초−+고강도초−+저강도초−+반복회−+마무리초−+라운드회−+사이 휴식초−+접기총 1:29설정 적용"
Timeout: 5000ms

Call log:
  - Expect "toContainText" with timeout 5000ms
  - waiting for getByRole('dialog', { name: '인터벌 운동 설정', exact: true })
    13 × locator resolved to <div role="dialog" aria-modal="true" aria-label="인터벌 운동 설정" class="ride-interval-settings">…</div>
       - unexpected value "인터벌 운동사용10분15분20분25분30분회복형 1:2균형형 1:1짧은 반복 20:10직접 설정준비초−+고강도초−+저강도초−+반복회−+마무리초−+라운드회−+사이 휴식초−+접기총 1:29설정 적용"

```

```yaml
- dialog "인터벌 운동 설정":
  - button "인터벌 운동 설정 배경 닫기"
  - heading "인터벌 운동" [level=2]
  - text: 사용
  - switch "인터벌"
  - combobox "운동 프리셋":
    - option "10분"
    - option "15분"
    - option "20분"
    - option "25분"
    - option "30분"
    - option "회복형 1:2"
    - option "균형형 1:1"
    - option "짧은 반복 20:10"
    - option "직접 설정" [selected]
  - button "인터벌 운동 설정 닫기"
  - group "운동 시간과 반복 수":
    - text: 준비 초
    - button "준비 30초 줄이기": −
    - spinbutton "준비 시간 초": "15"
    - button "준비 30초 늘리기": +
    - text: 고강도 초
    - button "고강도 5초 줄이기": −
    - spinbutton "고강도 시간 초": "7"
    - button "고강도 5초 늘리기": +
    - text: 저강도 초
    - button "저강도 5초 줄이기": −
    - spinbutton "저강도 시간 초": "11"
    - button "저강도 5초 늘리기": +
    - text: 반복 회
    - button "반복 1회 줄이기": −
    - spinbutton "반복 수": "3"
    - button "반복 1회 늘리기": +
    - text: 마무리 초
    - button "마무리 30초 줄이기": −
    - spinbutton "마무리 시간 초": "20"
    - button "마무리 30초 늘리기": +
    - text: 라운드 회
    - button "라운드 1회 줄이기": −
    - spinbutton "라운드 수": "1"
    - button "라운드 1회 늘리기": +
    - text: 사이 휴식 초
    - button "사이 휴식 30초 줄이기": −
    - spinbutton "라운드 사이 휴식 시간 초": "0"
    - button "사이 휴식 30초 늘리기": +
  - button "접기"
  - text: 총
  - strong: 1:29
  - button "설정 적용"
```

# Test source

```ts
  160 | 
  161 | test('입력 오류는 적용을 차단하고 취소하면 저장값을 보존한다', async ({page}) => {
  162 |   await page.goto(`${preview}?state=settings`);
  163 |   await openEditor(page);
  164 |   await expandCustom(page);
  165 |   const input=editor(page).getByRole('spinbutton',{name:'고강도 시간 초',exact:true});
  166 |   for(const invalid of ['', '0', '4', '601', '7.5']){
  167 |     await input.fill(invalid);
  168 |     await expect(editor(page).getByRole('button',{name:'설정 적용',exact:true})).toBeDisabled();
  169 |     await expect(editor(page).getByRole('alert')).toBeVisible();
  170 |   }
  171 |   await configure(page,'7','11','0');
  172 |   await expect(editor(page).getByRole('button',{name:'설정 적용',exact:true})).toBeDisabled();
  173 |   await configure(page,'7','11','31');
  174 |   await expect(editor(page).getByRole('button',{name:'설정 적용',exact:true})).toBeDisabled();
  175 |   await configure(page,'7','11','3');
  176 |   await expect(editor(page).locator('.ride-interval-settings__total strong')).toHaveText('10:54');
  177 |   await expect(editor(page).getByRole('button',{name:'설정 적용',exact:true})).toBeEnabled();
  178 |   await page.keyboard.press('Escape');
  179 |   expect(await page.evaluate(storageKey=>localStorage.getItem(storageKey),key)).toBeNull();
  180 | });
  181 | 
  182 | test('설정은 새로고침 후 복원되고 인터벌 사용은 자동으로 켜지지 않는다', async ({page}) => {
  183 |   await page.goto(`${preview}?state=settings&persistInterval`);
  184 |   await openEditor(page);
  185 |   await configure(page,'45','60','6');
  186 |   await editor(page).getByRole('button',{name:'설정 적용',exact:true}).click();
  187 |   await page.reload();
  188 |   await openEditor(page);
  189 |   await expect(editor(page)).toContainText('45초 / 60초 ×6');
  190 |   await expect(editor(page).locator('.ride-interval-settings__total strong')).toHaveText('20:30');
  191 |   await expect(editor(page).getByRole('switch',{name:/^인터벌/})).not.toBeChecked();
  192 | });
  193 | 
  194 | test('저장 데이터 파손·저장소 접근 불가에서도 기본값과 메모리 설정이 동작한다', async ({page}) => {
  195 |   await page.addInitScript(storageKey=>localStorage.setItem(storageKey,'{"highSec":"oops"}'),key);
  196 |   await page.goto(`${preview}?state=settings&persistInterval`);
  197 |   await openEditor(page);
  198 |   await expect(editor(page)).toContainText('60초 / 120초 ×5');
  199 |   await expect(editor(page).locator('.ride-interval-settings__total strong')).toHaveText('25:00');
  200 |   await page.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new Error('blocked');},configurable:true}));
  201 |   await page.reload();
  202 |   await openEditor(page);
  203 |   await configure(page,'20','40','8');
  204 |   await editor(page).getByRole('button',{name:'설정 적용',exact:true}).click();
  205 |   await openEditor(page);
  206 |   await expect(editor(page)).toContainText('20초 / 40초 ×8');
  207 |   await expect(editor(page).locator('.ride-interval-settings__total strong')).toHaveText('18:00');
  208 | });
  209 | 
  210 | test('주행 중 설정 복원용 저장소 읽기는 매 프레임 반복하지 않는다', async ({page}) => {
  211 |   await page.clock.install();
  212 |   await page.addInitScript(storageKey=>{
  213 |     const original=Storage.prototype.getItem;
  214 |     const counts: Record<string,number>={reads:0};
  215 |     Object.assign(window,{intervalConfigReadCounts:counts});
  216 |     Storage.prototype.getItem=function(name:string){if(name===storageKey)counts.reads++;return original.call(this,name);};
  217 |   },key);
  218 |   await page.goto(`${preview}?state=riding&interval&persistInterval`);
  219 |   const reads=()=>page.evaluate(()=>((window as unknown as {intervalConfigReadCounts:{reads:number}}).intervalConfigReadCounts.reads));
  220 |   const initial=await reads();
  221 |   expect(initial).toBeGreaterThan(0);
  222 |   await page.clock.runFor(3000);
  223 |   expect(await reads()).toBe(initial);
  224 | });
  225 | 
  226 | test('준비·마무리는 기본 5분에서 버튼·키보드로 30초씩 증감한다',async({page})=>{
  227 |   await page.goto(`${preview}?state=settings`);
  228 |   await openEditor(page);
  229 |   await expandCustom(page);
  230 |   for(const label of ['준비','마무리']){
  231 |     const input=editor(page).getByRole('spinbutton',{name:`${label} 시간 초`,exact:true});
  232 |     await expect(input).toHaveValue('300');
  233 |     await editor(page).getByRole('button',{name:`${label} 30초 늘리기`,exact:true}).click();
  234 |     await expect(input).toHaveValue('330');
  235 |     await editor(page).getByRole('button',{name:`${label} 30초 줄이기`,exact:true}).click();
  236 |     await expect(input).toHaveValue('300');
  237 |     await input.focus();await input.press('ArrowDown');
  238 |     await expect(input).toHaveValue('270');
  239 |     await input.press('ArrowUp');
  240 |     await expect(input).toHaveValue('300');
  241 |     await input.fill('0');await editor(page).getByRole('button',{name:`${label} 30초 줄이기`,exact:true}).click();
  242 |     await expect(input).toHaveValue('0');
  243 |     await input.fill('1800');await editor(page).getByRole('button',{name:`${label} 30초 늘리기`,exact:true}).click();
  244 |     await expect(input).toHaveValue('1800');
  245 |   }
  246 | });
  247 | 
  248 | test('준비·마무리 설정과 총시간을 저장하고 해당 시간대로 단계가 전환된다',async({page})=>{
  249 |   await page.clock.install();
  250 |   await page.goto(`${preview}?state=settings&persistInterval`);
  251 |   await openEditor(page);
  252 |   await expandCustom(page);
  253 |   await configure(page,'7','11','3');
  254 |   await editor(page).getByRole('spinbutton',{name:'준비 시간 초',exact:true}).fill('15');
  255 |   await editor(page).getByRole('spinbutton',{name:'마무리 시간 초',exact:true}).fill('20');
  256 |   await expect(editor(page).locator('.ride-interval-settings__total strong')).toHaveText('1:29');
  257 |   await editor(page).getByRole('button',{name:'설정 적용',exact:true}).click();
  258 |   await page.reload();
  259 |   await openEditor(page);
> 260 |   await expect(editor(page)).toContainText('준비 15초');
      |                              ^ Error: expect(locator).toContainText(expected) failed
  261 |   await expect(editor(page)).toContainText('마무리 20초');
  262 |   await editor(page).getByRole('switch',{name:/^인터벌/}).check();
  263 |   await editor(page).getByRole('button',{name:'인터벌 운동 설정 닫기',exact:true}).click();
  264 |   await page.getByRole('button',{name:'주행 시작',exact:true}).click();
  265 |   await expect(page.locator('.ride-interval-hud__time')).toHaveText('15');
  266 |   await page.clock.fastForward(15_000);
  267 |   await expect(page.locator('.ride-interval-hud__phase')).toHaveText('운동');
  268 |   await expect(page.locator('.ride-interval-hud__time')).toHaveText('7');
  269 |   await page.clock.fastForward(54_000);
  270 |   await expect(page.locator('.ride-interval-hud__phase')).toHaveText('마무리');
  271 |   await expect(page.locator('.ride-interval-hud__time')).toHaveText('20');
  272 |   await page.clock.fastForward(20_000);
  273 |   await expect(page.locator('.ride-interval-hud__time')).toHaveText('완료');
  274 | });
  275 | 
  276 | test('준비·마무리 0초는 건너뛰고 잘못된 시간은 적용을 막는다',async({page})=>{
  277 |   await page.clock.install();
  278 |   await page.goto(`${preview}?state=settings`);
  279 |   await openEditor(page);
  280 |   await editor(page).getByRole('switch',{name:/^인터벌/}).check();
  281 |   await expandCustom(page);
  282 |   const warmup=editor(page).getByRole('spinbutton',{name:'준비 시간 초',exact:true});
  283 |   for(const raw of ['', '-1', '1801', '1.5']){
  284 |     await warmup.fill(raw);
  285 |     await expect(editor(page).getByRole('button',{name:'설정 적용',exact:true})).toBeDisabled();
  286 |   }
  287 |   await configure(page,'7','11','3','0','0');
  288 |   await expect(editor(page).locator('.ride-interval-settings__total strong')).toHaveText('0:54');
  289 |   await editor(page).getByRole('button',{name:'설정 적용',exact:true}).click();
  290 |   await openEditor(page);
  291 |   await expect(editor(page)).toContainText('준비 없음');
  292 |   await expect(editor(page)).toContainText('마무리 없음');
  293 |   await editor(page).getByRole('button',{name:'인터벌 운동 설정 닫기',exact:true}).click();
  294 |   await page.getByRole('button',{name:'주행 시작',exact:true}).click();
  295 |   await expect(page.locator('.ride-interval-hud__phase')).toHaveText('운동');
  296 |   await expect(page.locator('.ride-interval-hud__time')).toHaveText('7');
  297 |   await page.clock.fastForward(54_000);
  298 |   await expect(page.locator('.ride-interval-hud__time')).toHaveText('완료');
  299 | });
  300 | 
  301 | test('기존 세 필드 저장값의 운동은 보존하고 준비·마무리는 5분으로 복원한다',async({page})=>{
  302 |   await page.goto(`${preview}?state=settings&persistInterval`);
  303 |   await page.evaluate(storageKey=>localStorage.setItem(storageKey,JSON.stringify({highSec:45,lowSec:60,repeats:6})),key);
  304 |   await page.reload();
  305 |   await openEditor(page);
  306 |   await expect(editor(page)).toContainText('45초 / 60초 ×6');
  307 |   await expect(editor(page).locator('.ride-interval-settings__total strong')).toHaveText('20:30');
  308 |   await expect(editor(page)).toContainText('준비 5분');
  309 |   await expect(editor(page)).toContainText('마무리 5분');
  310 |   await expandCustom(page);
  311 |   await expect(editor(page).getByRole('spinbutton',{name:'준비 시간 초',exact:true})).toHaveValue('300');
  312 |   await expect(editor(page).getByRole('spinbutton',{name:'마무리 시간 초',exact:true})).toHaveValue('300');
  313 |   await editor(page).getByRole('spinbutton',{name:'준비 시간 초',exact:true}).fill('0');
  314 |   await editor(page).getByRole('spinbutton',{name:'마무리 시간 초',exact:true}).fill('60');
  315 |   await editor(page).getByRole('button',{name:'설정 적용',exact:true}).click();
  316 |   await page.reload();
  317 |   await openEditor(page);
  318 |   await expect(editor(page)).toContainText('45초 / 60초 ×6');
  319 |   await expect(editor(page).locator('.ride-interval-settings__total strong')).toHaveText('11:30');
  320 |   await expect(editor(page)).toContainText('준비 없음');
  321 |   await expect(editor(page)).toContainText('마무리 1분');
  322 | });
  323 | 
  324 | test.describe('지도 가림 최소화',()=>{
  325 |   test.use({hasTouch:true,isMobile:true});
  326 |   for(const size of [{width:699,height:273},{width:667,height:300},{width:800,height:360},{width:320,height:568}]){
  327 |     test(`내용에 맞춘 창 ${size.width}×${size.height}`,async({page})=>{
  328 |       await page.setViewportSize(size);
  329 |       await page.goto(`${preview}?state=settings`);
  330 |       await expect(settings(page)).toBeVisible();
  331 |       await page.locator('.ride-settings-sheet__panel').evaluate(el=>Promise.all(el.getAnimations().map(animation=>animation.finished.catch(()=>{}))));
  332 |       const parent=await page.locator('.ride-settings-sheet__panel').evaluate(el=>{
  333 |         const box=el.getBoundingClientRect();
  334 |         const children=[...el.querySelectorAll('button,input,label')].map(child=>child.getBoundingClientRect());
  335 |         return {width:box.width,height:box.height,inside:box.left>=0&&box.right<=innerWidth&&box.top>=0&&box.bottom<=innerHeight,childrenInside:children.every(child=>child.left>=box.left&&child.right<=box.right)};
  336 |       });
  337 |       expect(parent.width).toBeLessThanOrEqual(460);
  338 |       expect(parent.inside).toBe(true);
  339 |       expect(parent.childrenInside).toBe(true);
  340 |       if(process.env.INTERVAL_SETTINGS_EVIDENCE_DIR){await fs.mkdir(process.env.INTERVAL_SETTINGS_EVIDENCE_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.INTERVAL_SETTINGS_EVIDENCE_DIR,`ride-settings-${size.width}x${size.height}.png`)});await fs.writeFile(path.join(process.env.INTERVAL_SETTINGS_EVIDENCE_DIR,`ride-settings-${size.width}x${size.height}.metrics.json`),JSON.stringify(parent,null,2));}
  341 |       await openEditor(page);
  342 |       const folded=await page.locator('.ride-interval-settings__panel').evaluate(el=>{
  343 |         const box=el.getBoundingClientRect();
  344 |         const apply=el.querySelector('.ride-interval-settings__apply')!.getBoundingClientRect();
  345 |         return {width:box.width,height:box.height,inside:box.left>=0&&box.top>=0&&box.right<=innerWidth&&box.bottom<=innerHeight,applyVisible:apply.width>0&&apply.height>0};
  346 |       });
  347 |       expect(folded.width).toBeLessThanOrEqual(480);
  348 |       expect(folded.inside).toBe(true);
  349 |       expect(folded.applyVisible).toBe(true);
  350 |       await expandCustom(page);
  351 |       const geometry=await page.locator('.ride-interval-settings__panel').evaluate(el=>{
  352 |         const box=el.getBoundingClientRect();
  353 |         const apply=el.querySelector('.ride-interval-settings__apply')!.getBoundingClientRect();
  354 |         const targets=[...el.querySelectorAll('button,input,select')].map(target=>target.getBoundingClientRect());
  355 |         return {width:box.width,height:box.height,inside:box.left>=0&&box.top>=0&&box.right<=innerWidth&&box.bottom<=innerHeight,applyVisible:apply.bottom<=innerHeight&&apply.top>=0,minTargetWidth:Math.min(...targets.map(target=>target.width)),minTargetHeight:Math.min(...targets.map(target=>target.height))};
  356 |       });
  357 |       expect(geometry.width).toBeLessThanOrEqual(480);
  358 |       expect(geometry.inside).toBe(true);
  359 |       expect(geometry.applyVisible).toBe(true);
  360 |       expect(geometry.minTargetWidth).toBeGreaterThanOrEqual(32);
```