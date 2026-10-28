# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ride-interval-settings.spec.ts >> 지도 가림 최소화 >> 내용에 맞춘 창 667×300
- Location: e2e\ride-interval-settings.spec.ts:227:5

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
```

# Page snapshot

```yaml
- main [ref=e3]:
  - img [ref=e4]
  - generic: 검수용 지도 배경 · 실제 제품 컴포넌트 · 서버 기록 없음
  - generic:
    - generic "경로 보기":
      - generic [ref=e9]:
        - generic [ref=e10]:
          - 'button "케이던스 센서: 연결 안 됨" [ref=e11] [cursor=pointer]':
            - generic [ref=e13]: 센서
          - button "경로 패널 접기" [expanded] [ref=e14] [cursor=pointer]:
            - img
        - generic [ref=e16]:
          - list [ref=e17]:
            - listitem [ref=e18]:
              - button "Start 남산공원 입구" [ref=e19] [cursor=pointer]:
                - generic "Start" [ref=e20]: S
                - generic "남산공원 입구" [ref=e21]
              - button "Start 삭제" [ref=e22] [cursor=pointer]:
                - img
            - listitem [ref=e23]:
              - button "End 남산 순환로 전망대" [ref=e24] [cursor=pointer]:
                - generic "End" [ref=e25]: E
                - generic "남산 순환로 전망대" [ref=e26]
              - button "End 삭제" [ref=e27] [cursor=pointer]:
                - img
          - button "Start·End 바꾸기" [ref=e28] [cursor=pointer]:
            - img
  - group "주행 제어" [ref=e29]:
    - button "주행 시작" [ref=e30] [cursor=pointer]
  - generic "라이딩 HUD":
    - button "Trail 메뉴" [ref=e31] [cursor=pointer]
    - button "맵 뷰 설정" [ref=e32] [cursor=pointer]: 맵 뷰
    - group "주행 지표" [ref=e37]:
      - generic "경로" [ref=e38]:
        - generic [ref=e39]: 경로
        - generic [ref=e40]:
          - text: "2.02"
          - generic [ref=e41]: km
      - generic "고도 46m 에서 30m" [ref=e42]:
        - generic [ref=e43]: 고도
        - generic [ref=e44]:
          - text: "46"
          - generic [ref=e45]: →
          - text: "30"
          - generic [ref=e46]: m
    - generic [ref=e47]:
      - group "맵 제어" [ref=e48]:
        - button "맵 스타일 위성, 클릭 시 야외" [ref=e49] [cursor=pointer]: 위성
        - button "줌 확대" [ref=e50] [cursor=pointer]: +
        - button "줌 축소" [ref=e51] [cursor=pointer]: −
      - group "서비스 기능" [ref=e52]:
        - button "사용자 정보" [ref=e53] [cursor=pointer]:
          - generic [ref=e54]: G
          - generic [ref=e56]: 게스트 라이더
    - time: 26.10.27 / 21:10:56
  - dialog "주행 설정":
    - button "닫기" [ref=e57] [cursor=pointer]
    - generic [ref=e58]:
      - generic [ref=e59]:
        - heading "주행 설정" [level=2] [ref=e60]
        - button "주행 설정 닫기" [active] [ref=e61] [cursor=pointer]:
          - img [ref=e62]
      - generic [ref=e64]:
        - group "화면 표시" [ref=e65]:
          - generic [ref=e66] [cursor=pointer]:
            - generic [ref=e67]:
              - generic [ref=e68]: 코칭 문구
              - generic [ref=e69]: 주행 중 화면 아래에 짧게 보여요
            - switch "코칭 문구 주행 중 화면 아래에 짧게 보여요" [checked] [ref=e70]
          - generic [ref=e71] [cursor=pointer]:
            - generic [ref=e73]: 음성 안내
            - switch "음성 안내" [checked] [ref=e74]
          - generic [ref=e75] [cursor=pointer]:
            - generic [ref=e77]: 배경 음악
            - switch "배경 음악" [checked] [ref=e78]
          - generic [ref=e79] [cursor=pointer]:
            - generic [ref=e81]: 페이서
            - switch "페이서" [checked] [ref=e82]
        - generic [ref=e83]:
          - generic [ref=e84] [cursor=pointer]:
            - generic [ref=e85]:
              - generic [ref=e86]: 인터벌
              - generic [ref=e87]: 30초 / 30초 ×5회 · 총 15:00
              - generic [ref=e88]: 준비 5분 · 마무리 5분
            - switch "인터벌 30초 / 30초 ×5회 · 총 15:00 준비 5분 · 마무리 5분" [ref=e89]
          - button "운동 설정" [ref=e90] [cursor=pointer]
        - generic [ref=e91]:
          - generic [ref=e92]:
            - generic [ref=e93]: 칼로리 계산
            - generic [ref=e94]: 체중 64 kg · 체력 3
          - button "프로필 수정" [ref=e95] [cursor=pointer]
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
          - generic: 10월 27일
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
      - generic:
        - complementary:
          - generic: 경로
          - list:
            - listitem:
              - button:
                - generic:
                  - img
                - generic: 경로 선택
                - img
            - listitem:
              - button:
                - generic:
                  - img
                - generic: 지명 검색
                - img
            - listitem:
              - button:
                - generic:
                  - img
                - generic: 순위
                - generic: 이번 주 2위
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
  136 |   await openEditor(page);
  137 |   await configure(page,'20','40','8');
  138 |   await editor(page).getByRole('button',{name:'설정 적용',exact:true}).click();
  139 |   await expect(settings(page)).toContainText('20초 / 40초 ×8회 · 총 18:00');
  140 | });
  141 | 
  142 | test('주행 중 설정 복원용 저장소 읽기는 매 프레임 반복하지 않는다', async ({page}) => {
  143 |   await page.clock.install();
  144 |   await page.addInitScript(storageKey=>{
  145 |     const original=Storage.prototype.getItem;
  146 |     const counts: Record<string,number>={reads:0};
  147 |     Object.assign(window,{intervalConfigReadCounts:counts});
  148 |     Storage.prototype.getItem=function(name:string){if(name===storageKey)counts.reads++;return original.call(this,name);};
  149 |   },key);
  150 |   await page.goto(`${preview}?state=riding&interval&persistInterval`);
  151 |   const reads=()=>page.evaluate(()=>((window as unknown as {intervalConfigReadCounts:{reads:number}}).intervalConfigReadCounts.reads));
  152 |   const initial=await reads();
  153 |   expect(initial).toBeGreaterThan(0);
  154 |   await page.clock.runFor(3000);
  155 |   expect(await reads()).toBe(initial);
  156 | });
  157 | 
  158 | test('준비·마무리 설정과 총시간을 저장하고 해당 시간대로 단계가 전환된다',async({page})=>{
  159 |   await page.clock.install();
  160 |   await page.goto(`${preview}?state=settings&persistInterval`);
  161 |   await openEditor(page);
  162 |   await configure(page,'7','11','3');
  163 |   await editor(page).getByRole('spinbutton',{name:'준비 시간 초',exact:true}).fill('15');
  164 |   await editor(page).getByRole('spinbutton',{name:'마무리 시간 초',exact:true}).fill('20');
  165 |   await expect(editor(page).locator('.ride-interval-settings__total strong')).toHaveText('1:29');
  166 |   await editor(page).getByRole('button',{name:'설정 적용',exact:true}).click();
  167 |   await page.reload();
  168 |   await expect(settings(page)).toContainText('준비 15초 · 마무리 20초');
  169 |   await settings(page).getByRole('switch',{name:/^인터벌/}).check();
  170 |   await settings(page).getByRole('button',{name:'주행 설정 닫기',exact:true}).click();
  171 |   await page.getByRole('button',{name:'주행 시작',exact:true}).click();
  172 |   await expect(page.locator('.ride-interval-hud__time')).toHaveText('15');
  173 |   await page.clock.fastForward(15_000);
  174 |   await expect(page.locator('.ride-interval-hud__phase')).toHaveText('운동');
  175 |   await expect(page.locator('.ride-interval-hud__time')).toHaveText('7');
  176 |   await page.clock.fastForward(54_000);
  177 |   await expect(page.locator('.ride-interval-hud__phase')).toHaveText('마무리');
  178 |   await expect(page.locator('.ride-interval-hud__time')).toHaveText('20');
  179 |   await page.clock.fastForward(20_000);
  180 |   await expect(page.locator('.ride-interval-hud__time')).toHaveText('완료');
  181 | });
  182 | 
  183 | test('준비·마무리 0초는 건너뛰고 잘못된 시간은 적용을 막는다',async({page})=>{
  184 |   await page.clock.install();
  185 |   await page.goto(`${preview}?state=settings`);
  186 |   await settings(page).getByRole('switch',{name:/^인터벌/}).check();
  187 |   await openEditor(page);
  188 |   const warmup=editor(page).getByRole('spinbutton',{name:'준비 시간 초',exact:true});
  189 |   for(const raw of ['', '-1', '1801', '1.5']){
  190 |     await warmup.fill(raw);
  191 |     await expect(editor(page).getByRole('button',{name:'설정 적용',exact:true})).toBeDisabled();
  192 |   }
  193 |   await warmup.fill('0');
  194 |   await editor(page).getByRole('spinbutton',{name:'마무리 시간 초',exact:true}).fill('0');
  195 |   await configure(page,'7','11','3');
  196 |   await expect(editor(page).locator('.ride-interval-settings__total strong')).toHaveText('0:54');
  197 |   await editor(page).getByRole('button',{name:'설정 적용',exact:true}).click();
  198 |   await expect(settings(page)).toContainText('준비 없음 · 마무리 없음');
  199 |   await settings(page).getByRole('button',{name:'주행 설정 닫기',exact:true}).click();
  200 |   await page.getByRole('button',{name:'주행 시작',exact:true}).click();
  201 |   await expect(page.locator('.ride-interval-hud__phase')).toHaveText('운동');
  202 |   await expect(page.locator('.ride-interval-hud__time')).toHaveText('7');
  203 |   await page.clock.fastForward(54_000);
  204 |   await expect(page.locator('.ride-interval-hud__time')).toHaveText('완료');
  205 | });
  206 | 
  207 | test('기존 세 필드 저장값의 운동은 보존하고 준비·마무리는 5분으로 복원한다',async({page})=>{
  208 |   await page.goto(`${preview}?state=settings&persistInterval`);
  209 |   await page.evaluate(storageKey=>localStorage.setItem(storageKey,JSON.stringify({highSec:45,lowSec:60,repeats:6})),key);
  210 |   await page.reload();
  211 |   await expect(settings(page)).toContainText('45초 / 60초 ×6회 · 총 20:30');
  212 |   await expect(settings(page)).toContainText('준비 5분 · 마무리 5분');
  213 |   await openEditor(page);
  214 |   await expect(editor(page).getByRole('spinbutton',{name:'준비 시간 초',exact:true})).toHaveValue('300');
  215 |   await expect(editor(page).getByRole('spinbutton',{name:'마무리 시간 초',exact:true})).toHaveValue('300');
  216 |   await editor(page).getByRole('spinbutton',{name:'준비 시간 초',exact:true}).fill('0');
  217 |   await editor(page).getByRole('spinbutton',{name:'마무리 시간 초',exact:true}).fill('60');
  218 |   await editor(page).getByRole('button',{name:'설정 적용',exact:true}).click();
  219 |   await page.reload();
  220 |   await expect(settings(page)).toContainText('45초 / 60초 ×6회 · 총 11:30');
  221 |   await expect(settings(page)).toContainText('준비 없음 · 마무리 1분');
  222 | });
  223 | 
  224 | test.describe('지도 가림 최소화',()=>{
  225 |   test.use({hasTouch:true,isMobile:true});
  226 |   for(const size of [{width:699,height:273},{width:667,height:300},{width:800,height:360},{width:320,height:568}]){
  227 |     test(`내용에 맞춘 창 ${size.width}×${size.height}`,async({page})=>{
  228 |       await page.setViewportSize(size);
  229 |       await page.goto(`${preview}?state=settings`);
  230 |       const parent=await page.locator('.ride-settings-sheet__panel').evaluate(el=>{
  231 |         const box=el.getBoundingClientRect();
  232 |         const children=[...el.querySelectorAll('button,input,label')].map(child=>child.getBoundingClientRect());
  233 |         return {width:box.width,height:box.height,inside:box.left>=0&&box.right<=innerWidth&&box.top>=0&&box.bottom<=innerHeight,childrenInside:children.every(child=>child.left>=box.left&&child.right<=box.right)};
  234 |       });
  235 |       expect(parent.width).toBeLessThanOrEqual(360);
> 236 |       expect(parent.inside).toBe(true);
      |                             ^ Error: expect(received).toBe(expected) // Object.is equality
  237 |       expect(parent.childrenInside).toBe(true);
  238 |       if(process.env.INTERVAL_SETTINGS_EVIDENCE_DIR){await fs.mkdir(process.env.INTERVAL_SETTINGS_EVIDENCE_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.INTERVAL_SETTINGS_EVIDENCE_DIR,`ride-settings-${size.width}x${size.height}.png`)});await fs.writeFile(path.join(process.env.INTERVAL_SETTINGS_EVIDENCE_DIR,`ride-settings-${size.width}x${size.height}.metrics.json`),JSON.stringify(parent,null,2));}
  239 |       await openEditor(page);
  240 |       const geometry=await page.locator('.ride-interval-settings__panel').evaluate(el=>{
  241 |         const box=el.getBoundingClientRect();
  242 |         const children=[...el.querySelectorAll('button,input,select,label,.ride-interval-settings__summary')].map(child=>child.getBoundingClientRect());
  243 |         const fields=el.querySelector('.ride-interval-settings__fields')!.getBoundingClientRect();
  244 |         const summary=el.querySelector('.ride-interval-settings__summary')!.getBoundingClientRect();
  245 |         const targets=[...el.querySelectorAll('button,input,select')].map(target=>target.getBoundingClientRect());
  246 |         return {width:box.width,height:box.height,overflow:el.scrollHeight>el.clientHeight+1,inside:box.left>=0&&box.top>=0&&box.right<=innerWidth&&box.bottom<=innerHeight,childrenInside:children.every(child=>child.left>=box.left&&child.right<=box.right),overlap:fields.left<summary.right&&fields.right>summary.left&&fields.top<summary.bottom&&fields.bottom>summary.top,cover:box.width*box.height/(innerWidth*innerHeight),minTargetWidth:Math.min(...targets.map(target=>target.width)),minTargetHeight:Math.min(...targets.map(target=>target.height))};
  247 |       });
  248 |       expect(geometry.width).toBeLessThanOrEqual(480);
  249 |       expect(geometry.inside).toBe(true);
  250 |       expect(geometry.childrenInside).toBe(true);
  251 |       expect(geometry.overflow).toBe(false);
  252 |       expect(geometry.overlap).toBe(false);
  253 |       expect(geometry.minTargetWidth).toBeGreaterThanOrEqual(44);
  254 |       expect(geometry.minTargetHeight).toBeGreaterThanOrEqual(44);
  255 |       if(size.width>440){expect(geometry.height).toBeLessThanOrEqual(248);expect(geometry.cover).toBeLessThan(.65);}
  256 |       if(process.env.INTERVAL_SETTINGS_EVIDENCE_DIR){await fs.mkdir(process.env.INTERVAL_SETTINGS_EVIDENCE_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.INTERVAL_SETTINGS_EVIDENCE_DIR,`settings-${size.width}x${size.height}.png`)});await fs.writeFile(path.join(process.env.INTERVAL_SETTINGS_EVIDENCE_DIR,`settings-${size.width}x${size.height}.metrics.json`),JSON.stringify(geometry,null,2));}
  257 |       await configure(page,'600','600','30');
  258 |       await expect(editor(page).locator('.ride-interval-settings__total strong')).toHaveText('610:00');
  259 |       const large=await page.locator('.ride-interval-settings__summary').evaluate(el=>{
  260 |         const box=el.getBoundingClientRect(),total=el.querySelector('strong')!.getBoundingClientRect();
  261 |         const marks=[...el.querySelectorAll('.ride-interval-settings__timeline span')].map(mark=>mark.getBoundingClientRect());
  262 |         return total.right<=box.right+1&&marks.every(mark=>mark.right<=box.right+1);
  263 |       });
  264 |       expect(large).toBe(true);
  265 |       await editor(page).getByRole('spinbutton',{name:'준비 시간 초',exact:true}).fill('1800');
  266 |       await editor(page).getByRole('spinbutton',{name:'마무리 시간 초',exact:true}).fill('1800');
  267 |       await expect(editor(page).locator('.ride-interval-settings__total strong')).toHaveText('660:00');
  268 |     });
  269 |   }
  270 | });
  271 | 
```