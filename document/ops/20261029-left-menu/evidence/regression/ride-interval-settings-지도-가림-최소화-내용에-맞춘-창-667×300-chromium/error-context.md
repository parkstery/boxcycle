# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ride-interval-settings.spec.ts >> 지도 가림 최소화 >> 내용에 맞춘 창 667×300
- Location: e2e\ride-interval-settings.spec.ts:327:5

# Error details

```
Error: expect(received).toBeGreaterThanOrEqual(expected)

Expected: >= 32
Received:    13
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
  - dialog "인터벌 운동 설정":
    - button "인터벌 운동 설정 배경 닫기" [ref=e53]
    - generic [ref=e54]:
      - generic [ref=e55]:
        - heading "인터벌 운동" [level=2] [ref=e56]
        - generic [ref=e57] [cursor=pointer]:
          - generic [ref=e58]: 사용
          - switch "인터벌" [ref=e59]
        - combobox "운동 프리셋" [ref=e60]:
          - option "10분"
          - option "15분"
          - option "20분"
          - option "25분"
          - option "30분"
          - option "회복형 1:2"
          - option "균형형 1:1"
          - option "짧은 반복 20:10"
          - option "직접 설정" [selected]
        - button "인터벌 운동 설정 닫기" [ref=e61] [cursor=pointer]:
          - img [ref=e62]
      - group "운동 시간과 반복 수" [ref=e65]:
        - generic [ref=e66]:
          - generic [ref=e67]:
            - text: 준비
            - generic [ref=e68]: 초
          - generic [ref=e69]:
            - button "준비 30초 줄이기" [ref=e70] [cursor=pointer]: −
            - spinbutton "준비 시간 초" [ref=e71]: "300"
            - button "준비 30초 늘리기" [ref=e72] [cursor=pointer]: +
        - generic [ref=e73]:
          - generic [ref=e74]:
            - text: 고강도
            - generic [ref=e75]: 초
          - generic [ref=e76]:
            - button "고강도 5초 줄이기" [ref=e77] [cursor=pointer]: −
            - spinbutton "고강도 시간 초" [ref=e78]: "60"
            - button "고강도 5초 늘리기" [ref=e79] [cursor=pointer]: +
        - generic [ref=e80]:
          - generic [ref=e81]:
            - text: 저강도
            - generic [ref=e82]: 초
          - generic [ref=e83]:
            - button "저강도 5초 줄이기" [ref=e84] [cursor=pointer]: −
            - spinbutton "저강도 시간 초" [ref=e85]: "120"
            - button "저강도 5초 늘리기" [ref=e86] [cursor=pointer]: +
        - generic [ref=e87]:
          - generic [ref=e88]:
            - text: 반복
            - generic [ref=e89]: 회
          - generic [ref=e90]:
            - button "반복 1회 줄이기" [ref=e91] [cursor=pointer]: −
            - spinbutton "반복 수" [ref=e92]: "5"
            - button "반복 1회 늘리기" [ref=e93] [cursor=pointer]: +
        - generic [ref=e94]:
          - generic [ref=e95]:
            - text: 마무리
            - generic [ref=e96]: 초
          - generic [ref=e97]:
            - button "마무리 30초 줄이기" [ref=e98] [cursor=pointer]: −
            - spinbutton "마무리 시간 초" [ref=e99]: "300"
            - button "마무리 30초 늘리기" [ref=e100] [cursor=pointer]: +
        - generic [ref=e101]:
          - generic [ref=e102]:
            - text: 라운드
            - generic [ref=e103]: 회
          - generic [ref=e104]:
            - button "라운드 1회 줄이기" [ref=e105] [cursor=pointer]: −
            - spinbutton "라운드 수" [ref=e106]: "1"
            - button "라운드 1회 늘리기" [ref=e107] [cursor=pointer]: +
        - generic [ref=e108]:
          - generic [ref=e109]:
            - text: 사이 휴식
            - generic [ref=e110]: 초
          - generic [ref=e111]:
            - button "사이 휴식 30초 줄이기" [ref=e112] [cursor=pointer]: −
            - spinbutton "라운드 사이 휴식 시간 초" [ref=e113]: "0"
            - button "사이 휴식 30초 늘리기" [ref=e114] [cursor=pointer]: +
      - generic [ref=e115]:
        - generic [ref=e116]:
          - button "접기" [ref=e117] [cursor=pointer]
          - generic [ref=e119]:
            - text: 총
            - strong [ref=e120]: 25:00
        - button "설정 적용" [ref=e121] [cursor=pointer]
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
  260 |   await expect(editor(page)).toContainText('준비 15초');
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
> 360 |       expect(geometry.minTargetWidth).toBeGreaterThanOrEqual(32);
      |                                       ^ Error: expect(received).toBeGreaterThanOrEqual(expected)
  361 |       expect(geometry.minTargetHeight).toBeGreaterThanOrEqual(28);
  362 |       if (size.width > 480) {
  363 |         const layout = await page.locator('.ride-interval-settings__panel').evaluate(el => {
  364 |           const body=el.querySelector('.ride-interval-settings__body')!;
  365 |           const apply=el.querySelector('.ride-interval-settings__apply')!.getBoundingClientRect();
  366 |           const fields=[...el.querySelectorAll('.ride-interval-settings__field')].map(field=>field.getBoundingClientRect());
  367 |           const bodyBox=body.getBoundingClientRect();
  368 |           return {height:el.getBoundingClientRect().height, width:el.getBoundingClientRect().width,
  369 |             columns:new Set(fields.map(field=>Math.round(field.left))).size,
  370 |             scroll:body.scrollHeight-body.clientHeight, bodyHeight:bodyBox.height,
  371 |             rightOffsets:[...el.querySelectorAll('.ride-interval-settings__stepper')].map(stepper=>Math.abs(stepper.getBoundingClientRect().right-apply.right))};
  372 |         });
  373 |         expect(layout.height).toBeLessThanOrEqual(Math.min(300, size.height-16));
  374 |         expect(layout.width).toBeLessThanOrEqual(230);
  375 |         expect(layout.columns).toBe(1);
  376 |         expect(Math.max(...layout.rightOffsets)).toBeLessThanOrEqual(1);
  377 |       }
  378 |       if(process.env.INTERVAL_SETTINGS_EVIDENCE_DIR){await fs.mkdir(process.env.INTERVAL_SETTINGS_EVIDENCE_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.INTERVAL_SETTINGS_EVIDENCE_DIR,`settings-${size.width}x${size.height}.png`)});await fs.writeFile(path.join(process.env.INTERVAL_SETTINGS_EVIDENCE_DIR,`settings-${size.width}x${size.height}.metrics.json`),JSON.stringify(geometry,null,2));}
  379 |       await configure(page,'600','600','30');
  380 |       await expect(editor(page).locator('.ride-interval-settings__total strong')).toHaveText('610:00');
  381 |       await editor(page).getByRole('spinbutton',{name:'준비 시간 초',exact:true}).fill('1800');
  382 |       await editor(page).getByRole('spinbutton',{name:'마무리 시간 초',exact:true}).fill('1800');
  383 |       await expect(editor(page).locator('.ride-interval-settings__total strong')).toHaveText('660:00');
  384 |     });
  385 |   }
  386 | });
  387 | 
```