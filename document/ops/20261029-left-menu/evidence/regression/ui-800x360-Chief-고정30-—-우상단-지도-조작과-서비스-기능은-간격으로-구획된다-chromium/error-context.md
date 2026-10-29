# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui-800x360.spec.ts >> Chief 고정30 — 우상단 지도 조작과 서비스 기능은 간격으로 구획된다
- Location: e2e\ui-800x360.spec.ts:47:1

# Error details

```
Error: expect(received).toBeGreaterThanOrEqual(expected)

Expected: >= 8
Received:    2.6875
```

# Page snapshot

```yaml
- main [ref=e3]:
  - img [ref=e4]
  - generic: 검수용 지도 배경 · 실제 제품 컴포넌트 · 서버 기록 없음
  - button "메뉴 열기" [ref=e9] [cursor=pointer]:
    - img [ref=e11]
  - button "순위 열기" [expanded] [ref=e13] [cursor=pointer]:
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
                  - text: "0.07"
                  - generic: / 2.02
                  - generic: km
              - generic "시간":
                - generic: 시간
                - generic: 00:13
              - generic "속도":
                - generic: 속도
                - generic:
                  - text: "37"
                  - generic: km/h
              - status "이번 주행에서 새로 밟은 도로(이미 내 도로면 0)":
                - generic: 새 도로
                - generic:
                  - text: "+0.42"
                  - generic: km
              - generic "평균":
                - generic: 평균
                - generic:
                  - text: "19.8"
                  - generic: km/h
    - generic [ref=e45]:
      - group "맵 제어" [ref=e46]:
        - button "맵 스타일 위성, 클릭 시 야외" [ref=e47] [cursor=pointer]:
          - img [ref=e48]
        - button "줌 확대" [ref=e51] [cursor=pointer]: +
        - button "줌 축소" [ref=e52] [cursor=pointer]: −
      - group "서비스 기능" [ref=e53]:
        - button "사용자 정보" [ref=e54] [cursor=pointer]:
          - generic [ref=e56]: Ridingman12
    - region "주행 중 순위" [ref=e57]:
      - generic [ref=e58]: 이번 주 순위 · 달리는 동안 갱신
      - list [ref=e59]:
        - listitem [ref=e60]:
          - generic [ref=e61]: "1"
          - generic [ref=e62]: geum
          - generic [ref=e65]: 17.1 km
        - listitem [ref=e66]:
          - generic [ref=e67]: "2"
          - generic [ref=e68]: 한강라이더
          - generic [ref=e69]: 12.4 km
        - listitem [ref=e70]:
          - generic [ref=e71]: "3"
          - generic [ref=e72]: 새벽페달
          - generic [ref=e75]: 9.8 km
        - listitem [ref=e76]:
          - generic [ref=e77]: "4"
          - generic [ref=e78]: Ridingman12나
          - generic [ref=e79]: 9.5 km
        - listitem [ref=e80]:
          - generic [ref=e81]: "5"
          - generic [ref=e82]: 원주토박이
          - generic [ref=e83]: 8.7 km
        - listitem [ref=e84]:
          - generic [ref=e85]: "6"
          - generic [ref=e86]: 달빛라이딩
          - generic [ref=e87]: 6.3 km
        - listitem [ref=e88]:
          - generic [ref=e89]: "7"
          - generic [ref=e90]: 라이더7
          - generic [ref=e91]: 5.0 km
        - listitem [ref=e92]:
          - generic [ref=e93]: "8"
          - generic [ref=e94]: 라이더8
          - generic [ref=e95]: 4.0 km
        - listitem [ref=e96]:
          - generic [ref=e97]: "9"
          - generic [ref=e98]: 라이더9
          - generic [ref=e99]: 3.0 km
        - listitem [ref=e100]:
          - generic [ref=e101]: "10"
          - generic [ref=e102]: 라이더10
          - generic [ref=e103]: 2.0 km
      - paragraph [ref=e104]:
        - text: 3위까지
        - generic [ref=e105]: 0.3 km
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
  1   | import fs from 'node:fs/promises';
  2   | import path from 'node:path';
  3   | import { test, expect } from '@playwright/test';
  4   | 
  5   | const preview = '/scripts/ui-800x360/preview.html';
  6   | test.use({ viewport: {width:800,height:360} });
  7   | 
  8   | test('800×360 준비·주행의 지표가 읽히고 계정/카메라와 겹치지 않는다', async ({page}) => {
  9   |   for(const size of [{width:800,height:360},{width:667,height:300},{width:844,height:390}]){
  10  |   await page.setViewportSize(size);
  11  |   for (const state of ['ready','riding','paused']) {
  12  |     await page.goto(`${preview}?state=${state}&long`);
  13  |     await expect(page.getByRole('group',{name:'주행 지표'})).toBeVisible();
  14  |     const geometry = await page.evaluate(() => {
  15  |       const rect = (selector:string) => document.querySelector(selector)?.getBoundingClientRect().toJSON();
  16  |       const metrics=rect('.map-hud__tl-metrics');
  17  |     const groups=['.hud-ride-map-controls','.camera-view-menu__trigger','.hud-account']
  18  |         .map(sel=>rect(sel)).filter(Boolean) as DOMRect[];
  19  |       return { labels:[...document.querySelectorAll('.hud-metrics__label')].map(e=>parseFloat(getComputedStyle(e).fontSize)),
  20  |         values:[...document.querySelectorAll('.hud-metrics__value')].map(e=>parseFloat(getComputedStyle(e).fontSize)),
  21  |         metrics,groups,top:rect('.map-hud__tl') };
  22  |     });
  23  |     expect(geometry.labels.length).toBeGreaterThanOrEqual(state === 'ready' ? 2 : 4);
  24  |     expect(geometry.values.length).toBeGreaterThanOrEqual(state === 'ready' ? 2 : 4);
  25  |     expect(Math.min(...geometry.labels)).toBeGreaterThanOrEqual(11);
  26  |     expect(Math.min(...geometry.values)).toBeGreaterThanOrEqual(18);
  27  |     expect(geometry.top!.top).toBeLessThanOrEqual(8);
  28  |     await expect(page.locator('.hud-brand')).toHaveCount(0);
  29  |     await expect(page.locator('.hud-bc-trigger')).toHaveCount(0);
  30  |     for(const [i,group] of geometry.groups.entries()){
  31  |       const a=geometry.metrics!;
  32  |       const b=group as {x:number;right:number;y:number;bottom:number};
  33  |       expect(a.right<=b.x||b.right<=a.x||a.bottom<=b.y||b.bottom<=a.y,
  34  |         `${state}@${size.width}×${size.height}: metrics vs control group ${i}`).toBeTruthy();
  35  |     }
  36  |     expect(geometry.metrics!.right).toBeLessThanOrEqual(size.width);
  37  |     const textBounds=await page.locator('.hud-metrics__cell').evaluateAll(cells=>cells.map(cell=>{
  38  |       const range=document.createRange();range.selectNodeContents(cell.querySelector('.hud-metrics__value')!);
  39  |       const text=range.getBoundingClientRect(),box=cell.getBoundingClientRect();
  40  |       return text.left>=box.left-1&&text.right<=box.right+1;
  41  |     }));
  42  |     expect(textBounds.every(Boolean),'metric text stays in its own cell').toBeTruthy();
  43  |   }
  44  |   }
  45  | });
  46  | 
  47  | test('Chief 고정30 — 우상단 지도 조작과 서비스 기능은 간격으로 구획된다', async ({ page }) => {
  48  |   await page.goto(`${preview}?state=glance-riding`);
  49  |   const mapControls = page.getByRole('group', { name: '맵 제어' });
  50  |   const serviceActions = page.getByRole('group', { name: '서비스 기능' });
  51  |   await expect(mapControls).toBeVisible();
  52  |   await expect(serviceActions).toBeVisible();
  53  | 
  54  |   const spacing = await page.evaluate(() => {
  55  |     const map = document.querySelector('.hud-ride-map-controls')!.getBoundingClientRect();
  56  |     const service = document.querySelector('.map-hud__service-actions')!.getBoundingClientRect();
  57  |     const account = document.querySelector('.hud-account')!.getBoundingClientRect();
  58  |     return {
  59  |       outer: service.left - map.right,
  60  |       account,
  61  |       centerDelta: Math.abs(service.top + service.height / 2 - (map.top + map.height / 2)),
  62  |     };
  63  |   });
> 64  |   expect(spacing.outer).toBeGreaterThanOrEqual(8);
      |                         ^ Error: expect(received).toBeGreaterThanOrEqual(expected)
  65  |   expect(spacing.centerDelta).toBeLessThanOrEqual(1);
  66  | 
  67  |   await page.setViewportSize({ width: 667, height: 300 });
  68  |   await page.goto(`${preview}?state=glance-riding`);
  69  |   const compact = await page.evaluate(() => {
  70  |     const rect = (selector: string) => document.querySelector(selector)!.getBoundingClientRect();
  71  |     const map = rect('.hud-ride-map-controls');
  72  |     const service = rect('.map-hud__service-actions');
  73  |     const children = [...document.querySelectorAll('.map-hud__service-actions > *')].map((el) => el.getBoundingClientRect());
  74  |     const overlaps = map.left < service.right && map.right > service.left && map.top < service.bottom && map.bottom > service.top;
  75  |     const inside = [map, service, ...children].every((box) =>
  76  |       box.left >= 0 && box.top >= 0 && box.right <= window.innerWidth && box.bottom <= window.innerHeight,
  77  |     );
  78  |     const childrenInsideGroup = children.every((box) =>
  79  |       box.left >= service.left && box.right <= service.right && box.top >= service.top && box.bottom <= service.bottom,
  80  |     );
  81  |     return { overlaps, inside, childrenInsideGroup };
  82  |   });
  83  |   expect(compact).toEqual({ overlaps: false, inside: true, childrenInsideGroup: true });
  84  | });
  85  | 
  86  | test('Chief 고정27 — 단일 카메라 메뉴, 1열 62px 우측 정렬, 2~6 파란 화살표 세로', async ({ page }) => {
  87  |   await page.goto(`${preview}?state=riding`);
  88  | 
  89  |   const trigger = page.getByRole('button', { name: /카메라 메뉴/ });
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
```