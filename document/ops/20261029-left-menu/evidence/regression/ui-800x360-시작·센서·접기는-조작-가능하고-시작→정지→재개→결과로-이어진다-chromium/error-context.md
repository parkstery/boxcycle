# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui-800x360.spec.ts >> 시작·센서·접기는 조작 가능하고 시작→정지→재개→결과로 이어진다
- Location: e2e\ui-800x360.spec.ts:178:1

# Error details

```
Error: expect(received).toBeCloseTo(expected, precision)

Expected: 44
Received: 31.99988189514974

Expected precision:    0
Expected difference: < 0.5
Received difference:   12.000118104850259
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
      - generic [ref=e17]:
        - generic [ref=e18]:
          - 'button "케이던스 센서: 연결 안 됨" [ref=e19] [cursor=pointer]':
            - generic [ref=e21]: 센서
          - button "인터벌 운동 설정" [ref=e22] [cursor=pointer]: INT
          - button "경로 패널 접기" [expanded] [ref=e23] [cursor=pointer]:
            - img
          - group "주행 제어" [ref=e24]:
            - button "주행 시작" [ref=e25] [cursor=pointer]
        - generic [ref=e27]:
          - list [ref=e28]:
            - listitem [ref=e29]:
              - button "Start 남산공원 입구" [ref=e30] [cursor=pointer]:
                - generic "Start" [ref=e31]: S
                - generic "남산공원 입구" [ref=e32]
              - button "Start 삭제" [ref=e33] [cursor=pointer]:
                - img
            - listitem [ref=e34]:
              - button "End 남산 순환로 전망대" [ref=e35] [cursor=pointer]:
                - generic "End" [ref=e36]: E
                - generic "남산 순환로 전망대" [ref=e37]
              - button "End 삭제" [ref=e38] [cursor=pointer]:
                - img
          - button "Start·End 바꾸기" [ref=e39] [cursor=pointer]:
            - img
  - generic "라이딩 HUD":
    - button "Trail 메뉴" [ref=e40] [cursor=pointer]
    - generic:
      - generic:
        - generic:
          - generic:
            - group "주행 지표":
              - generic "경로":
                - generic: 경로
                - generic:
                  - text: "2.02"
                  - generic: km
              - generic "고도 46m 에서 30m":
                - generic: 고도
                - generic:
                  - text: "46"
                  - generic: →
                  - text: "30"
                  - generic: m
    - generic [ref=e41]:
      - group "맵 제어" [ref=e42]:
        - button "맵 스타일 위성, 클릭 시 야외" [ref=e43] [cursor=pointer]:
          - img [ref=e44]
        - button "줌 확대" [ref=e47] [cursor=pointer]: +
        - button "줌 축소" [ref=e48] [cursor=pointer]: −
      - group "서비스 기능" [ref=e49]:
        - button "사용자 정보" [ref=e50] [cursor=pointer]:
          - generic [ref=e52]: 게스트 라이더
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
  90  |   await expect(trigger).toHaveCount(1);
  91  |   await trigger.click();
  92  |   const panel = page.getByRole('menu', { name: '카메라 선택' });
  93  |   await expect(panel).toBeVisible();
  94  |   const heightMenu = page.getByRole('group', { name: '평면 카메라 높이' });
  95  |   const viewMenu = page.getByRole('group', { name: '시점 카메라' });
  96  |   const [flatBox, perspectiveBox] = await Promise.all([heightMenu.boundingBox(), viewMenu.boundingBox()]);
  97  |   expect(flatBox!.x + flatBox!.width).toBeLessThanOrEqual(perspectiveBox!.x + 1);
  98  |   expect((await panel.boundingBox())!.width).toBeCloseTo(154, 0);
  99  | 
  100 |   await expect(heightMenu.getByRole('menuitemradio')).toHaveCount(7);
  101 |   for (const label of ['전체 경로', '20m 상공', '200m 상공', '300m 상공', '400m 상공', '500m 상공', '1000m 상공']) {
  102 |     await expect(heightMenu.getByRole('menuitemradio', { name: `평면 카메라 · ${label}` })).toBeVisible();
  103 |   }
  104 |   const flatGeometry = await heightMenu.evaluate(menu => {
  105 |     const box = menu.getBoundingClientRect();
  106 |     const labels = [...menu.querySelectorAll<HTMLElement>('.camera-view-menu__item-label')];
  107 |     return {
  108 |       width: box.width,
  109 |       alignments: labels.map(label => getComputedStyle(label).textAlign),
  110 |       rightEdges: labels.map(label => label.getBoundingClientRect().right),
  111 |     };
  112 |   });
  113 |   expect(flatGeometry.width).toBeCloseTo(62, 0);
  114 |   expect(flatGeometry.alignments.every(value => value === 'right')).toBeTruthy();
  115 |   expect(Math.max(...flatGeometry.rightEdges) - Math.min(...flatGeometry.rightEdges)).toBeLessThanOrEqual(0.1);
  116 |   await heightMenu.getByRole('menuitemradio', { name: '평면 카메라 · 1000m 상공' }).click();
  117 |   await expect(trigger).toContainText('1000m');
  118 | 
  119 |   await trigger.click();
  120 |   await expect(viewMenu.getByRole('menuitemradio')).toHaveCount(5);
  121 |   await expect(viewMenu.locator('svg')).toHaveCount(5);
  122 |   await expect(viewMenu.locator('.camera-view-menu__item-label')).toHaveCount(0);
  123 |   const viewGeometry = await viewMenu.evaluate(menu => {
  124 |     const items = [...menu.querySelectorAll<HTMLElement>('.camera-view-menu__item--icon')].map(item => item.getBoundingClientRect());
  125 |     return {
  126 |       oneColumn: items.every(item => Math.abs(item.x - items[0]!.x) <= 0.1),
  127 |       ordered: items.every((item, index) => index === 0 || item.y > items[index - 1]!.y),
  128 |     };
  129 |   });
  130 |   expect(viewGeometry).toEqual({ oneColumn: true, ordered: true });
  131 |   for (const slot of [2, 3, 4, 5, 6]) {
  132 |     const item = viewMenu.getByRole('menuitemradio', { name: new RegExp(`^카메라 ${slot}`) });
  133 |     await expect(item).toBeVisible();
  134 |     await expect(item.locator(`[data-camera-direction="${slot}"]`)).toHaveCount(1);
  135 |   }
  136 | });
  137 | 
  138 | test('RouteDock 시안의 250px 판이고 시작 전에는 일시정지/종료가 없다', async ({page}) => {
  139 |   await page.goto(`${preview}?state=ready`);
  140 |   const shell = page.locator('.route-dock__card');
  141 |   const box = await shell.boundingBox();
  142 |   expect(box!.width).toBeLessThanOrEqual(250.5);
  143 |   expect(box!.height).toBeLessThanOrEqual(130);
  144 |   await expect(page.getByRole('button', { name: '일시정지', exact: true })).toHaveCount(0);
  145 |   await expect(page.getByRole('button', { name: '주행 종료', exact: true })).toHaveCount(0);
  146 |   await page.getByRole('button', { name: '주행 시작', exact: true }).click();
  147 |   await expect(page.getByRole('button', { name: '일시정지', exact: true })).toBeVisible();
  148 |   await expect(page.getByRole('button', { name: '주행 종료', exact: true })).toBeVisible();
  149 | });
  150 | 
  151 | test('주소는 한 면으로 연결되고 경유지 추가만큼 패널이 늘어나며 내부 스크롤이 없다', async ({page}) => {
  152 |   for (const size of [{width:800,height:360},{width:667,height:300}]) {
  153 |     await page.setViewportSize(size);
  154 |     let previous = 0;
  155 |     for (const count of [0,1,2,3]) {
  156 |       await page.goto(`${preview}?state=ready&waypoints=${count}`);
  157 |       await expect(page.locator('.route-dock__stops > li')).toHaveCount(count+2);
  158 |       const dimensions=await page.locator('.route-dock-anchor').evaluate(root=>{
  159 |         const list=root.querySelector('.route-dock__stops') as HTMLElement;
  160 |         const rows=[...list.children].map(e=>e.getBoundingClientRect());
  161 |         const bounds=root.getBoundingClientRect();
  162 |         return {height:bounds.height, scroll:list.scrollHeight, client:list.clientHeight,
  163 |           visible:rows.every(r=>r.top>=bounds.top&&r.bottom<=bounds.bottom),
  164 |           boxes:[...root.querySelectorAll('.route-dock__stop,.route-dock__remove')].map(e=>({border:getComputedStyle(e).borderTopWidth, background:getComputedStyle(e).backgroundColor})),
  165 |           rowHeight:rows[0].height};
  166 |       });
  167 |       expect(dimensions.visible).toBeTruthy();
  168 |       expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client+1);
  169 |       // 2026-10-24 Chief 제안 A: S·E 기호 사이에 ⇅ 가 들어가도록 줄 30px(+경계선 1px) — 종전 29 이하에서 2px 늘림
  170 |       expect(dimensions.rowHeight).toBeLessThanOrEqual(31);
  171 |       expect(dimensions.boxes.every(x=>x.border==='0px'&&x.background==='rgba(0, 0, 0, 0)')).toBeTruthy();
  172 |       if(previous) expect(dimensions.height-previous).toBeGreaterThanOrEqual(23);
  173 |       previous=dimensions.height;
  174 |     }
  175 |   }
  176 | });
  177 | 
  178 | test('시작·센서·접기는 조작 가능하고 시작→정지→재개→결과로 이어진다', async ({page}) => {
  179 |   await page.goto(`${preview}?state=ready`);
  180 |   for(const locator of [page.getByRole('button',{name:'주행 시작',exact:true}),page.getByRole('button',{name:/^케이던스 센서:/}),page.getByRole('button',{name:'경로 패널 접기'})]){
  181 |     const r=await locator.boundingBox();
  182 |     expect(r!.height).toBeGreaterThanOrEqual(26);
  183 |     expect(await locator.evaluate(el=>{const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return hit===el||el.contains(hit);})).toBeTruthy();
  184 |   }
  185 |   expect(await page.getByRole('button',{name:'주행 시작',exact:true}).evaluate(el=>{
  186 |     const height=el.getBoundingClientRect().height;
  187 |     const transform=getComputedStyle(el).transform;
  188 |     const scale=transform.startsWith('matrix(')?Number.parseFloat(transform.slice(7)):1;
  189 |     return height/(Number.isFinite(scale)&&scale>0?scale:1);
> 190 |   })).toBeCloseTo(44,0);
      |       ^ Error: expect(received).toBeCloseTo(expected, precision)
  191 |   await page.getByRole('button',{name:'경로 패널 접기'}).click();
  192 |   await expect(page.getByRole('button',{name:'주행 시작',exact:true})).toBeVisible();
  193 |   await expect(page.getByRole('button',{name:'경로 패널 펼치기'})).toBeVisible();
  194 |   await expect(page.getByRole('button',{name:/^케이던스 센서:/})).toHaveCount(0);
  195 |   await page.getByRole('button',{name:'주행 시작',exact:true}).click();
  196 |   await expect(page.locator('.audit-world')).toHaveAttribute('data-ui-stage','riding');
  197 |   await page.getByRole('button',{name:'일시정지',exact:true}).click();
  198 |   await expect(page.locator('.audit-world')).toHaveAttribute('data-ui-stage','paused');
  199 |   await page.getByRole('button',{name:'재개',exact:true}).first().click();
  200 |   await expect(page.locator('.audit-world')).toHaveAttribute('data-ui-stage','riding');
  201 |   await page.getByRole('button',{name:'주행 종료',exact:true}).click();
  202 |   await expect(page.getByRole('region',{name:'주행 결과'})).toBeVisible();
  203 |   await expect(page.locator('.ride-control-bar')).toHaveCount(0);
  204 | });
  205 | 
  206 | test('주행 설정의 기본 표면은 사용자 언어와 명시적 닫기를 제공한다', async ({page}) => {
  207 |   await page.goto(`${preview}?state=settings`);
  208 |   const settings=page.getByRole('dialog',{name:'주행 설정',exact:true});
  209 |   await expect(settings.getByText('음성 안내',{exact:true})).toBeVisible();
  210 |   await expect(settings.getByText('배경 음악',{exact:true})).toBeVisible();
  211 |   await expect(settings.getByText(/No 센서/)).toHaveCount(0);
  212 |   await settings.getByRole('button',{name:'주행 설정 닫기'}).click();
  213 |   await expect(settings).toBeHidden();
  214 | });
  215 | 
  216 | test('800 기준 및 좁고 여유 있는 가로 화면에서 패널을 닫고 조작할 수 있다', async ({page}) => {
  217 |   for(const size of [{width:800,height:360},{width:667,height:300},{width:844,height:390}]){
  218 |     await page.setViewportSize(size);
  219 |     for(const state of ['sensor','settings','routes','summary','account']){
  220 |       await page.goto(`${preview}?state=${state}`);
  221 |       const panels=page.locator('.cadence-sheet__panel,.map-view-sheet__panel,.ride-settings-sheet__panel,.oc-modal,.ride-summary__sheet,.user-info-sheet-root.is-open .user-info-sheet');
  222 |       await expect(panels.first()).toBeVisible();
  223 |       await expect.poll(async()=>{
  224 |         const box=await panels.first().boundingBox();
  225 |         if(!box)return Infinity;
  226 |         return Math.max(-box.x,-box.y,box.x+box.width-size.width,box.y+box.height-size.height);
  227 |       },{message:`${state} ${size.width}×${size.height} settles inside viewport`,timeout:3000}).toBeLessThanOrEqual(1);
  228 |       const r=await panels.first().boundingBox();
  229 |       expect(r!.x).toBeGreaterThanOrEqual(-1);
  230 |       expect(r!.y).toBeGreaterThanOrEqual(-1);
  231 |       expect(r!.x+r!.width).toBeLessThanOrEqual(size.width+1);
  232 |       expect(r!.y+r!.height).toBeLessThanOrEqual(size.height+1);
  233 |       await page.keyboard.press('Escape');
  234 |     }
  235 |   }
  236 | });
  237 | 
  238 | test('Guest의 확인된 0km와 아직 읽지 않은 도로망을 구별한다', async({page})=>{
  239 |   await page.goto(`${preview}?state=account`);
  240 |   const account=page.getByRole('dialog',{name:'사용자 정보',exact:true});
  241 |   await expect(account.getByLabel('내 도로망',{exact:true})).toContainText('0.0');
  242 |   await expect(account.getByText('첫 라이딩으로 나만의 길을 남겨보세요.',{exact:true})).toBeVisible();
  243 |   await expect(account.getByText('미구독',{exact:true})).toHaveCount(0);
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
```