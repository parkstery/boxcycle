# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui-800x360.spec.ts >> Chief 고정14 — 왼쪽 흰 반투명 반원 탭: 계기판 아래 빈 자리, 누르면 열리고 끌어도 열리지 않는다
- Location: e2e\ui-800x360.spec.ts:301:1

# Error details

```
Error: 800×360 riding left vs 경로카드

expect(received).toBe(expected) // Object.is equality

Expected: false
Received: true
```

# Page snapshot

```yaml
- main [ref=e3]:
  - img [ref=e4]
  - generic: 검수용 지도 배경 · 실제 제품 컴포넌트 · 서버 기록 없음
  - button "메뉴 열기" [ref=e9] [cursor=pointer]:
    - img [ref=e11]
  - button "순위 열기" [ref=e13] [cursor=pointer]:
    - img [ref=e15]
  - generic:
    - generic "경로 보기":
      - generic [ref=e18]:
        - button "경로 패널 펼치기" [ref=e19] [cursor=pointer]
        - group "주행 제어" [ref=e21]:
          - button "일시정지" [ref=e22] [cursor=pointer]
          - button "주행 종료" [ref=e23] [cursor=pointer]
    - group "경로 미니맵" [ref=e24]:
      - img "전체 경로와 현재 위치" [ref=e25]:
        - img [ref=e26]
      - button "미니맵 접기" [expanded] [ref=e43] [cursor=pointer]:
        - img
  - generic "라이딩 HUD":
    - button "Trail 메뉴" [ref=e44] [cursor=pointer]
    - generic:
      - generic:
        - generic:
          - generic:
            - group "주행 지표":
              - generic "주행 누적 거리 / 경로 전체거리":
                - generic: 거리
                - generic "주행 누적 거리":
                  - text: "4.20"
                  - generic: / 10.00
                  - generic: km
              - generic "시간":
                - generic: 시간
                - generic: 24:08
              - generic "속도":
                - generic: 속도
                - generic:
                  - text: "24"
                  - generic: km/h
              - status "이번 주행에서 새로 밟은 도로(이미 내 도로면 0)":
                - generic: 새 도로
                - generic:
                  - text: "+0.42"
                  - generic: km
              - generic "평균":
                - generic: 평균
                - generic:
                  - text: "18.6"
                  - generic: km/h
    - generic [ref=e45]:
      - group "Quick Camera" [ref=e46]:
        - button "카메라 메뉴 · 카메라 1 · 500m 상공" [ref=e47] [cursor=pointer]:
          - generic [ref=e48]: "1"
          - img [ref=e50]
          - generic [ref=e54]: 500m
          - generic [ref=e55]: ▾
      - group "맵 제어" [ref=e56]:
        - button "맵 스타일 위성, 클릭 시 야외" [ref=e57] [cursor=pointer]:
          - img [ref=e58]
        - button "줌 확대" [ref=e61] [cursor=pointer]: +
        - button "줌 축소" [ref=e62] [cursor=pointer]: −
      - group "서비스 기능" [ref=e63]:
        - button "사용자 정보" [ref=e64] [cursor=pointer]:
          - generic [ref=e66]: 게스트 라이더
    - generic:
      - status:
        - generic: 오늘도 내 도로망을 넓혀 볼까요?
  - generic:
    - button
    - dialog:
      - generic:
        - tablist:
          - tab [selected]: 오늘
          - tab: 주간
          - tab: 월간
          - tab: 연간
        - generic:
          - generic: 10월 29일
          - paragraph:
            - generic: 오늘 주행이 없어요
          - paragraph: 달리면 여기에 거리가 쌓여요
      - generic:
        - generic:
          - button:
            - img
        - generic:
          - group:
            - generic:
              - text: 내 도로망
              - generic: 첫 라이딩으로 나만의 길을 남겨보세요.
            - generic:
              - generic: "0.0"
              - generic: km
          - group:
            - button [pressed]: 전체 도로망
            - button [disabled]: 신규 도로만
          - button:
            - generic: 마지막 주행
            - generic:
              - generic: 아직 주행이 없어요
              - generic:
                - img
          - group:
            - generic: 플랜
            - generic: 게스트 · 회원 등록하면 어느 기기에서나 이어져요
        - generic:
          - button: 회원 등록
  - generic:
    - button
    - dialog:
      - generic:
        - generic:
          - generic:
            - img
          - generic: Spinatlas
          - button:
            - img
        - button:
          - img
      - generic:
        - complementary:
          - generic: 경로 선택
          - group:
            - button: 내 경로
            - button: 퍼블릭
            - button: 입문
          - list:
            - listitem:
              - button:
                - generic:
                  - img
                - generic: 인터벌
                - img
            - listitem:
              - button:
                - generic:
                  - img
                - generic: 주행 설정
                - img
```

# Test source

```ts
  244 |   await page.goto(`${preview}?state=account&loading`);
  245 |   const loading=page.getByRole('dialog',{name:'사용자 정보',exact:true});
  246 |   await expect(loading.getByText('첫 라이딩으로 나만의 길을 남겨보세요.',{exact:true})).toHaveCount(0);
  247 | });
  248 | 
  249 | test('결과의 진행 숫자와 보조 설명은 잘리지 않고 읽힌다',async({page})=>{
  250 |   await page.goto(`${preview}?state=summary`);
  251 |   const result=page.getByRole('region',{name:'주행 결과',exact:true});
  252 |   await expect(result).toBeVisible();
  253 |   const geometry=await page.locator('.ride-summary__progress-text').evaluate(el=>({client:el.clientHeight,scroll:el.scrollHeight}));
  254 |   expect(geometry.scroll).toBeLessThanOrEqual(geometry.client+1);
  255 |   expect(await page.locator('.ride-summary__story-detail').evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(10);
  256 |   await expect(result.getByText('시간',{exact:true})).toBeVisible();
  257 |   await expect(result.getByText('평균',{exact:true})).toBeVisible();
  258 | });
  259 | 
  260 | test('메뉴는 Tab 포커스를 가두고 Escape 후 트리거로 돌려준다',async({page})=>{
  261 |   await page.goto(`${preview}?state=ready`);
  262 |   const trigger=page.getByRole('button',{name:'Trail 메뉴',exact:true});
  263 |   await trigger.focus();
  264 |   await page.keyboard.press('Enter');
  265 |   const menu=page.getByRole('dialog',{name:'메뉴',exact:true});
  266 |   await expect(menu).toBeVisible();
  267 |   for(let i=0;i<18;i++){
  268 |     await page.keyboard.press('Tab');
  269 |     expect(await menu.evaluate(el=>el.contains(document.activeElement))).toBeTruthy();
  270 |   }
  271 |   await page.keyboard.press('Escape');
  272 |   await expect(trigger).toBeFocused();
  273 |   await expect(page.getByRole('dialog',{name:'메뉴',exact:true})).toHaveCount(0);
  274 | });
  275 | 
  276 | test('왼쪽 에지 띠는 20px·화면0에 붙고 빈 가장자리 드래그로는 열리지 않는다',async({page})=>{
  277 |   await page.goto(`${preview}?state=ready`);
  278 |   const handle=page.locator('.edge-panel-handle--left');
  279 |   const r=(await handle.boundingBox())!;
  280 |   expect(r.width).toBeGreaterThanOrEqual(18);
  281 |   expect(r.width).toBeLessThanOrEqual(21);
  282 |   expect(r.x).toBeLessThanOrEqual(0.5);
  283 |   const x=10,y=80;
  284 |   await page.mouse.move(x,y);await page.mouse.down();
  285 |   await page.mouse.move(x+110,y,{steps:8});await page.mouse.up();
  286 |   await expect(page.getByRole('dialog'),'빈 가장자리 드래그는 열지 않는다').toHaveCount(0);
  287 |   await page.getByRole('button',{name:'메뉴 열기',exact:true}).click();
  288 |   const dialog=page.getByRole('dialog',{name:'메뉴',exact:true});
  289 |   await expect(dialog).toBeVisible();
  290 |   await expect.poll(async()=>{const b=(await page.locator('.menu-panel').boundingBox())!;return Math.max(-b.x,0);}).toBeLessThanOrEqual(1);
  291 |   const head=page.locator('.menu-panel__head');
  292 |   const h=(await head.boundingBox())!;
  293 |   await page.mouse.move(h.x+Math.min(80,h.width/2),h.y+h.height/2);await page.mouse.down();
  294 |   await page.mouse.move(h.x+Math.min(80,h.width/2)-100,h.y+h.height/2,{steps:8});await page.mouse.up();
  295 |   await expect(dialog).toHaveCount(0);
  296 |   await page.mouse.click(x,40);
  297 |   await expect(page.getByRole('dialog'),'20px 띠 클릭은 열지 않는다').toHaveCount(0);
  298 | });
  299 | 
  300 | // Chief 고정14(2026-10-28 후속): 측면 메뉴는 보이는 흰 반투명 반원 탭으로만 연다 — 슬라이드 금지, 위치 고정.
  301 | test('Chief 고정14 — 왼쪽 흰 반투명 반원 탭: 계기판 아래 빈 자리, 누르면 열리고 끌어도 열리지 않는다',async({page})=>{
  302 |   for(const size of [{width:800,height:360},{width:667,height:300},{width:844,height:390}]){
  303 |     await page.setViewportSize(size);
  304 |     for(const state of ['ready','riding','paused'] as const){
  305 |       await page.goto(`${preview}?state=${state}`);
  306 |       const g=await page.evaluate(()=>{
  307 |         const tabs=['left'].map(side=>{
  308 |           const tab=document.querySelector(`.edge-panel-tab--${side}`)!;
  309 |           const knob=tab.querySelector('.edge-panel-tab__knob')!;
  310 |           const t=tab.getBoundingClientRect(),k=knob.getBoundingClientRect();
  311 |           const hit=document.elementFromPoint(k.x+k.width/2,k.y+k.height/2);
  312 |           return {side,t:t.toJSON(),k:k.toJSON(),bg:getComputedStyle(knob).backgroundColor,hitOk:Boolean(hit?.closest(`.edge-panel-tab--${side}`))};
  313 |         });
  314 |         const others=[
  315 |           ['.map-hud__tl-metrics','계기'],
  316 |           ['.map-hud__tr','우상단'],
  317 |           ['.ride-control-bar','주행제어'],
  318 |           ['.hud-ride-map-controls','맵제어'],
  319 |           ['.camera-view-menu__trigger','카메라'],
  320 |           ['.hud-account','계정'],
  321 |           ['.route-dock__card','경로카드'],
  322 |           ['.route-minimap','미니맵'],
  323 |         ].flatMap(([sel,name])=>{
  324 |           const el=document.querySelector(sel);
  325 |           if(!el) return [];
  326 |           const r=el.getBoundingClientRect();
  327 |           if(r.width<=0||r.height<=0) return [];
  328 |           if(sel==='.route-dock__card' && r.width<=32 && r.height<=32) return [];
  329 |           return [{name, ...r.toJSON()}];
  330 |         });
  331 |         return {tabs,others,vw:innerWidth,vh:innerHeight};
  332 |       });
  333 |       for(const tab of g.tabs){
  334 |         const label=`${size.width}×${size.height} ${state} ${tab.side}`;
  335 |         expect(tab.k.width,label).toBeCloseTo(20.4,1);
  336 |         expect(tab.k.height,label).toBeCloseTo(43.2,1);
  337 |         expect(tab.t.width*tab.t.height,label).toBeGreaterThanOrEqual(44*76-1);
  338 |         expect(tab.bg,label).toBe('rgba(255, 255, 255, 0.78)');
  339 |         expect(tab.hitOk,label).toBe(true);
  340 |         if(tab.side==='left') expect(tab.k.x,label).toBeLessThanOrEqual(0.5);
  341 |         else expect(tab.k.x+tab.k.width,label).toBeGreaterThanOrEqual(g.vw-0.5);
  342 |         for(const o of g.others){
  343 |           const overlap=tab.k.x<o.right&&tab.k.right>o.left&&tab.k.y<o.bottom&&tab.k.bottom>o.top;
> 344 |           expect(overlap,`${label} vs ${o.name}`).toBe(false);
      |                                                   ^ Error: 800×360 riding left vs 경로카드
  345 |         }
  346 |       }
  347 |     }
  348 |   }
  349 |   await page.setViewportSize({width:800,height:360});
  350 |   const dialog=page.getByRole('dialog',{name:'메뉴',exact:true});
  351 |   await page.goto(`${preview}?state=ready`);
  352 |   const closedTab=(await page.locator('.edge-panel-tab--left').boundingBox())!;
  353 |   await page.getByRole('button',{name:'메뉴 열기',exact:true}).click();
  354 |   await expect(dialog,'누르면 열림').toBeVisible();
  355 |   const openTab=(await page.locator('.edge-panel-tab--left').boundingBox())!;
  356 |   expect(Math.abs(openTab.x-closedTab.x),'열린 뒤 x 유지').toBeLessThanOrEqual(1);
  357 |   expect(Math.abs(openTab.y-closedTab.y),'열린 뒤 y 유지').toBeLessThanOrEqual(1);
  358 |   await expect(page.locator('.edge-panel-tab--left'),'열어도 탭은 남는다').toHaveCount(1);
  359 |   await page.goto(`${preview}?state=ready`);
  360 |   const k=(await page.locator('.edge-panel-tab--left .edge-panel-tab__knob').boundingBox())!;
  361 |   const x=k.x+k.width/2,y=k.y+k.height/2;
  362 |   await page.mouse.move(x,y);await page.mouse.down();
  363 |   await page.mouse.move(x+120,y,{steps:10});await page.mouse.up();
  364 |   await expect(dialog,'탭에서 끌어도 열리지 않는다').toHaveCount(0);
  365 | });
  366 | 
  367 | test('포커스 대안·빈 가장자리 짧은/반대 드래그는 열지 않는다',async({page})=>{
  368 |   await page.goto(`${preview}?state=ready`);
  369 |   await page.getByRole('button',{name:'Trail 메뉴',exact:true}).focus();
  370 |   await page.keyboard.press('Enter');
  371 |   await expect(page.getByRole('dialog',{name:'메뉴',exact:true})).toBeVisible();
  372 |   await page.keyboard.press('Escape');
  373 |   for(const movement of [{dx:24,dy:0},{dx:-24,dy:0},{dx:0,dy:24}]){
  374 |     const x=10,y=40;
  375 |     await page.mouse.move(x,y);await page.mouse.down();
  376 |     await page.mouse.move(x+movement.dx,y+movement.dy,{steps:5});
  377 |     await page.waitForTimeout(200);
  378 |     await page.mouse.up();
  379 |     await expect(page.getByRole('dialog')).toHaveCount(0);
  380 |   }
  381 | });
  382 | 
  383 | test('빈 가장자리 드래그 취소·화면 크기 변경 후에도 중앙 지도는 가리지 않는다',async({page})=>{
  384 |   await page.goto(`${preview}?state=ready`);
  385 |   const x=10,y=40;
  386 |   await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+30,y,{steps:5});
  387 |   await page.mouse.up();
  388 |   await expect(page.getByRole('dialog')).toHaveCount(0);
  389 |   await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+30,y,{steps:5});
  390 |   await page.setViewportSize({width:844,height:390});await page.mouse.up();
  391 |   await expect(page.getByRole('dialog')).toHaveCount(0);
  392 |   await page.getByRole('button',{name:'Trail 메뉴',exact:true}).focus();
  393 |   await page.keyboard.press('Enter');
  394 |   await expect(page.getByRole('dialog',{name:'메뉴',exact:true})).toBeVisible();
  395 |   await page.keyboard.press('Escape');
  396 |   await page.locator('.audit-map').evaluate(el=>el.addEventListener('pointerdown',()=>el.setAttribute('data-audit-hit','yes')));
  397 |   await page.mouse.move(420,180);await page.mouse.down();await page.mouse.move(480,195,{steps:6});await page.mouse.up();
  398 |   await expect(page.locator('.audit-map')).toHaveAttribute('data-audit-hit','yes');
  399 |   await expect(page.getByRole('dialog')).toHaveCount(0);
  400 | });
  401 | 
  402 | test('경로 모달에서 세 출처를 전환해도 목록은 하나이며 닫으면 메뉴로 돌아온다', async ({page})=>{
  403 |   await page.goto(`${preview}?state=menu`);
  404 |   await page.getByRole('button',{name:'내 경로',exact:true}).click();
  405 |   const savedDefault=page.getByRole('dialog',{name:'내 경로',exact:true});
  406 |   await expect(savedDefault).toBeVisible();
  407 |   const sourceButtons=savedDefault.getByRole('navigation',{name:'경로 출처'}).getByRole('button');
  408 |   await expect(sourceButtons).toHaveText(['내 경로','퍼블릭','입문']);
  409 |   await savedDefault.getByRole('button',{name:'입문',exact:true}).click();
  410 |   await expect(page.getByRole('dialog',{name:'입문 경로',exact:true})).toBeVisible();
  411 |   await expect(page.getByRole('dialog')).toHaveCount(1);
  412 |   const intro=page.getByRole('dialog',{name:'입문 경로',exact:true});
  413 |   await intro.getByRole('button',{name:'퍼블릭',exact:true}).click();
  414 |   await expect(page.getByRole('dialog',{name:'퍼블릭 경로',exact:true})).toBeVisible();
  415 |   await expect(page.getByRole('dialog',{name:'입문 경로',exact:true})).toHaveCount(0);
  416 |   await page.getByRole('dialog',{name:'퍼블릭 경로',exact:true}).getByRole('button',{name:'내 경로',exact:true}).click();
  417 |   const saved=page.getByRole('dialog',{name:'내 경로',exact:true});
  418 |   await expect(saved).toBeVisible();
  419 |   await expect(page.getByRole('dialog',{name:'퍼블릭 경로',exact:true})).toHaveCount(0);
  420 |   await page.keyboard.press('Escape');
  421 |   await expect(saved).toHaveCount(0);
  422 |   await expect(page.getByRole('dialog',{name:'메뉴',exact:true})).toBeVisible();
  423 | });
  424 | 
  425 | // Chief 지정 — 바꾸려면 Chief 지시와 document/reference/product/261024-RTW-Chief-지정-디자인-고정.md 갱신 필요
  426 | test.describe('Chief 고정 — 261024 목록 1~4', () => {
  427 |   const greenBottom = 'rgb(0, 150, 39)';
  428 | 
  429 |   test('준비·일시정지 조작부와 순위 칩·주행 중 지도 조작', async ({ page }) => {
  430 |     const evidenceDir = process.env.BATCH2_EVIDENCE_DIR;
  431 |     if (evidenceDir) await fs.mkdir(evidenceDir, { recursive: true });
  432 | 
  433 |     for (const size of [{ width: 667, height: 300 }, { width: 800, height: 360 }]) {
  434 |       await page.setViewportSize(size);
  435 |       await page.goto(`${preview}?state=ready`);
  436 |       const start = page.getByRole('button', { name: '주행 시작', exact: true });
  437 |       await expect(start).toBeVisible();
  438 |       expect((await start.innerText()).trim()).toBe('');
  439 |       const startBox = await start.boundingBox();
  440 |       expect(startBox!.width).toBeCloseTo(startBox!.height, 0);
  441 |       const startBg = await start.evaluate((el) => getComputedStyle(el).backgroundImage);
  442 |       expect(startBg).toContain(greenBottom);
  443 | 
  444 |       await page.goto(`${preview}?state=glance-ready`);
```