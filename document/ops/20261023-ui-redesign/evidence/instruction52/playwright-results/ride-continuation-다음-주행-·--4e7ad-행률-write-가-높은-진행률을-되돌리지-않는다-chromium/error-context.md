# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ride-continuation.spec.ts >> 다음 주행 · 이어 달리기 >> RC2 — 늦은 낮은 진행률 write 가 높은 진행률을 되돌리지 않는다
- Location: e2e\ride-continuation.spec.ts:462:3

# Error details

```
TimeoutError: locator.click: Timeout 15000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: '열기' }).first()

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e3]:
    - generic [ref=e5]:
      - region "Map" [ref=e6]
      - generic:
        - generic:
          - generic:
            - status "카메라 고도(해수면 기준)": 고도 1.9 km
          - generic:
            - generic: 200 m
        - link "Mapbox homepage" [ref=e8] [cursor=pointer]:
          - /url: https://www.mapbox.com/
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
            - generic: 10월 24일
            - paragraph:
              - generic: 오늘 주행이 없어요
            - paragraph: 달리면 여기에 거리가 쌓여요
        - generic:
          - banner:
            - generic:
              - strong: 게스트-gf15
              - generic: 게스트로 이용 중
            - button:
              - img
          - generic:
            - group:
              - generic: 내 도로망
              - generic: 확인 중
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
            - button: 프로필 수정
            - button: 회원 등록
            - button: 로그아웃
  - dialog "내 경로" [ref=e9]:
    - generic [ref=e10]:
      - heading "내 경로" [level=2] [ref=e11]
      - navigation "경로 출처" [ref=e12]:
        - button "입문" [ref=e13] [cursor=pointer]
        - button "퍼블릭" [ref=e14] [cursor=pointer]
        - button "내 경로" [pressed] [ref=e15] [cursor=pointer]
      - generic [ref=e16]:
        - img [ref=e17]
        - searchbox "경로 이름 검색" [ref=e20]
      - button "닫기" [ref=e21] [cursor=pointer]:
        - img [ref=e22]
    - generic [ref=e24]:
      - region "사용자 경로" [ref=e25]:
        - generic [ref=e26]:
          - tablist "사용자 경로 완주 여부 필터" [ref=e27]:
            - tab "전체 (1)" [selected] [ref=e28] [cursor=pointer]
            - tab "완주 (0)" [ref=e29] [cursor=pointer]
            - tab "미완주 (1)" [ref=e30] [cursor=pointer]
            - tab "대기 (0)" [ref=e31] [cursor=pointer]
          - generic [ref=e32]:
            - combobox "정렬 기준" [ref=e34] [cursor=pointer]:
              - option "최근순" [selected]
              - option "거리순"
              - option "이름순"
            - toolbar "선택한 경로 작업" [ref=e35]:
              - button "공개" [disabled] [ref=e36]
              - button "이어 달리기" [ref=e37] [cursor=pointer]
              - button "이름" [ref=e38] [cursor=pointer]
              - button "삭제" [ref=e39] [cursor=pointer]
        - listbox "사용자 경로 목록" [ref=e40]:
          - listitem [ref=e41]:
            - option "자전거 RC2 stale 픽스처 자전거 · 2026. 10. 24 22:05 · 1일 후 만료 20% 달림 1.00 km" [active] [selected] [ref=e42] [cursor=pointer]:
              - generic [ref=e43]:
                - img "자전거" [ref=e44]
                - strong [ref=e50]: RC2 stale 픽스처
                - generic [ref=e51]: 자전거 · 2026. 10. 24 22:05 · 1일 후 만료
              - generic [ref=e52]: 20% 달림
              - generic [ref=e53]: 1.00 km
      - paragraph [ref=e54]: 회원 등록하면 모든 기기에서 기록이 유지됩니다 · 경로를 고른 뒤 열기 또는 이어 달리기를 눌러요
```

# Test source

```ts
  159 |       expiresAt: { timestampValue: new Date(Date.now() + 86400000).toISOString() },
  160 |       lastRideId: { nullValue: null },
  161 |       lastProgressRatio: { doubleValue: input.lastProgressRatio },
  162 |     },
  163 |   }
  164 |   const res = await fetch(`${DOCS_URL}/savedRoutes?documentId=${input.routeId}`, {
  165 |     method: 'POST',
  166 |     headers: { 'content-type': 'application/json', authorization: 'Bearer owner' },
  167 |     body: JSON.stringify(body),
  168 |   })
  169 |   expect(res.ok, `SavedRoute seed 실패: ${res.status} ${await res.text()}`).toBe(true)
  170 | }
  171 | 
  172 | /** 다른 탭·기기가 진행률을 올린 상황을 흉내내는 out-of-band write */
  173 | async function forceSavedRouteProgress(routeId: string, ratio: number): Promise<void> {
  174 |   const res = await fetch(
  175 |     `${DOCS_URL}/savedRoutes/${routeId}?updateMask.fieldPaths=lastProgressRatio`,
  176 |     {
  177 |       method: 'PATCH',
  178 |       headers: { 'content-type': 'application/json', authorization: 'Bearer owner' },
  179 |       body: JSON.stringify({ fields: { lastProgressRatio: { doubleValue: ratio } } }),
  180 |     },
  181 |   )
  182 |   expect(res.ok, `진행률 out-of-band write 실패: ${res.status}`).toBe(true)
  183 | }
  184 | 
  185 | async function readSavedRoute(routeId: string): Promise<Record<string, unknown>> {
  186 |   const res = await fetch(`${DOCS_URL}/savedRoutes/${routeId}`, {
  187 |     headers: { authorization: 'Bearer owner' },
  188 |   })
  189 |   expect(res.ok, `SavedRoute 조회 실패: ${res.status}`).toBe(true)
  190 |   const json = (await res.json()) as { fields?: Record<string, unknown> }
  191 |   return json.fields ?? {}
  192 | }
  193 | 
  194 | /** rides/{rideId} 문서를 에뮬레이터에서 직접 읽는다. CF conquestResult 폴링에 사용. */
  195 | async function readRide(rideId: string): Promise<Record<string, unknown>> {
  196 |   const res = await fetch(`${DOCS_URL}/rides/${rideId}`, {
  197 |     headers: { authorization: 'Bearer owner' },
  198 |   })
  199 |   if (!res.ok) return {}
  200 |   const json = (await res.json()) as { fields?: Record<string, unknown> }
  201 |   return json.fields ?? {}
  202 | }
  203 | 
  204 | function fieldNumber(fields: Record<string, unknown>, key: string): number {
  205 |   const raw = fields[key] as { doubleValue?: number; integerValue?: string } | undefined
  206 |   if (raw?.doubleValue != null) return Number(raw.doubleValue)
  207 |   if (raw?.integerValue != null) return Number(raw.integerValue)
  208 |   return 0
  209 | }
  210 | 
  211 | /** 신규 좌표 필드가 없는 옛 Ride — legacy fallback 검증용 */
  212 | async function seedLegacyRide(uid: string, rideId: string): Promise<void> {
  213 |   const body = {
  214 |     fields: {
  215 |       userId: { stringValue: uid },
  216 |       trailId: { nullValue: null },
  217 |       profile: { stringValue: 'cycling' },
  218 |       startedAt: { nullValue: null },
  219 |       endedAt: { timestampValue: new Date(Date.now() - 86400000).toISOString() },
  220 |       elapsedSec: { doubleValue: 900 },
  221 |       distanceMeters: { doubleValue: 5200 },
  222 |       avgSpeedKmh: { doubleValue: 20.8 },
  223 |       caloriesEstimate: { doubleValue: 156 },
  224 |       routeDistanceMeters: { doubleValue: 5200 },
  225 |       routeDurationSec: { doubleValue: 900 },
  226 |       source: { stringValue: 'web' },
  227 |       status: { stringValue: 'completed' },
  228 |       createdAt: { timestampValue: new Date(Date.now() - 86400000).toISOString() },
  229 |       updatedAt: { timestampValue: new Date(Date.now() - 86400000).toISOString() },
  230 |       completionRatio: { doubleValue: 0.5 },
  231 |     },
  232 |   }
  233 |   const res = await fetch(`${DOCS_URL}/rides?documentId=${rideId}`, {
  234 |     method: 'POST',
  235 |     headers: { 'content-type': 'application/json', authorization: 'Bearer owner' },
  236 |     body: JSON.stringify(body),
  237 |   })
  238 |   expect(res.ok, `legacy ride seed 실패: ${res.status}`).toBe(true)
  239 | }
  240 | 
  241 | /** MENU → 「내 경로」 칩에서 fixture 를 불러온다(카드가 없는 최초 진입용 경로) */
  242 | async function openTrailMenu(page: Page) {
  243 |   // Trail 메뉴는 키보드·스크린리더용 고정 트리거다. 포인터 클릭은 실제 HUD가 위에
  244 |   // 겹치는 화면에서 막히므로, 제품이 보장하는 focus + Enter 계약으로 연다.
  245 |   const menu = page.getByRole('button', { name: 'Trail 메뉴' })
  246 |   await menu.focus()
  247 |   await expect(menu).toBeFocused({ timeout: 15_000 })
  248 |   await page.keyboard.press('Enter')
  249 | }
  250 | 
  251 | async function loadSavedRouteFromMenu(page: Page, routeName: string) {
  252 |   await openTrailMenu(page)
  253 |   // 2026-09-16: 탭 계층을 없애고 경로 출처 칩 한 줄로 합쳤다.
  254 |   // 이름은 `내 경로 목록`(aria-label) — 「내 경로로 저장」과 섞이지 않게 명시했다.
  255 |   await page.getByRole('button', { name: '내 경로 목록' }).click()
  256 |   const row = page.getByText(routeName, { exact: false }).first()
  257 |   await expect(row).toBeVisible({ timeout: 15_000 })
  258 |   await row.click()
> 259 |   await page.getByRole('button', { name: '열기' }).first().click()
      |                                                          ^ TimeoutError: locator.click: Timeout 15000ms exceeded.
  260 |   await expect(page.getByRole('button', { name: '주행 시작' })).toBeVisible({ timeout: 15_000 })
  261 | }
  262 | 
  263 | /**
  264 |  * HUD 「주행 누적 거리」 — 경로상 누적 km(재개 offset 시드 포함).
  265 |  *
  266 |  * 2026-09-17 컴팩트 재설계로 **세션 거리 표시가 HUD 에서 사라졌고**(offset 이 없으면 누적과
  267 |  * 항상 같은 숫자라 중복이었다), 남은 누적값의 aria-label 도 「누적 진행」 → 「주행 누적 거리」로
  268 |  * 바뀌었다. 세션 거리가 필요한 곳은 **주행 시작 시점의 누적을 기준선으로 잡아 빼서** 구한다.
  269 |  * 주행 전(route-preview)에는 표시되지 않으므로 -1 을 돌려 폴링이 조기 통과하지 않게 한다.
  270 |  */
  271 | async function readHudCumulativeKm(page: Page): Promise<number> {
  272 |   const cumulative = page.getByLabel('주행 누적 거리')
  273 |   if ((await cumulative.count()) === 0) return -1
  274 |   const text = await cumulative.first().innerText()
  275 |   const km = Number(text.trim().split('/')[0]?.replace(/[^\d.]/g, ''))
  276 |   return Number.isFinite(km) ? km : -1
  277 | }
  278 | 
  279 | /**
  280 |  * 목표 세션 거리까지 달린 뒤 종료한다.
  281 |  * 고정 sleep 대신 HUD 표시값을 폴링해 램핑·프레임 편차에 흔들리지 않게 한다.
  282 |  * `beforeEnd` — 종료 클릭 직전(주행 중 HUD 가 보일 때) 콜백.
  283 |  */
  284 | async function rideUntilSessionMeters(
  285 |   page: Page,
  286 |   targetMeters: number,
  287 |   beforeEnd?: () => Promise<void>,
  288 | ) {
  289 |   const endButton = page.getByRole('button', { name: '주행 종료' })
  290 |   await expect(endButton).toBeVisible({ timeout: 30_000 })
  291 |   await expect(page.getByRole('group', { name: '주행 지표' })).toBeVisible({ timeout: 20_000 })
  292 |   // 세션 거리는 이제 HUD 에 없다 — 시작 시점 누적을 기준선으로 잡아 그만큼 더 달렸는지 본다.
  293 |   const baselineKm = await readHudCumulativeKm(page)
  294 |   expect(baselineKm, 'HUD 누적 거리를 읽지 못했다(기준선 없음 → 계측 불가)').toBeGreaterThanOrEqual(0)
  295 |   await expect
  296 |     .poll(async () => ((await readHudCumulativeKm(page)) - baselineKm) * 1000, {
  297 |       timeout: 180_000,
  298 |       intervals: [500],
  299 |       message: `세션 거리 ${targetMeters}m 에 도달하지 못했다(기준선 ${baselineKm}km)`,
  300 |     })
  301 |     .toBeGreaterThanOrEqual(targetMeters)
  302 |   if (beforeEnd) await beforeEnd()
  303 |   await endButton.click()
  304 | }
  305 | 
  306 | /**
  307 |  * 「다음 주행」 카드. 앵커 div(aria-label)·카드 group·숨기기 버튼이 모두 「다음 주행」을 포함하므로
  308 |  * 카드 본체(role=group)로 정확히 겨냥한다.
  309 |  */
  310 | const nextRideCard = (page: Page) => page.getByRole('group', { name: '다음 주행' })
  311 | 
  312 | /**
  313 |  * 결과 시트의 「끝점에서 새 경로」/「지금 새 경로 연결」 CTA 는 2026-09-17 컴팩트 재설계
  314 |  * (Chief 지시)로 시트에서 사라졌다 — 되살리지 않는다. 기능(handleStartRouteFromAnchor,
  315 |  * App.tsx)은 그대로 살아 있고, 진입점만 사용자 정보 시트 「최근 주행」 목록의
  316 |  * 「여기서 새 경로」(onExtendFromRide, App.tsx 2547행 부근)로 옮겨졌다 — 그 살아있는
  317 |  * 진입점을 그대로 쓴다. 목록은 endedAt 내림차순이라 맨 위 행이 방금 종료한 Ride 다.
  318 |  * 시트가 전체화면 scrim(z-index 25)으로 HUD 클릭을 막으므로 호출 전에 시트를 닫아 둔다.
  319 |  */
  320 | async function extendFromRecentRideRow(page: Page) {
  321 |   await page.getByRole('button', { name: '사용자 정보' }).click()
  322 |   const historyToggle = page.getByRole('button', { name: '마지막 주행' })
  323 |   await expect(historyToggle).toBeVisible({ timeout: 15_000 })
  324 |   await historyToggle.click()
  325 |   const latestRow = page.locator('#user-info-sheet-history-list .user-info-sheet__item').first()
  326 |   const extendBtn = latestRow.getByRole('button', { name: '여기서 새 경로' })
  327 |   await expect(extendBtn, '최근 주행 최신 행에 「여기서 새 경로」가 없다').toBeVisible({
  328 |     timeout: 15_000,
  329 |   })
  330 |   await extendBtn.click()
  331 | }
  332 | 
  333 | test.describe('다음 주행 · 이어 달리기', () => {
  334 |   test.skip(!LIVE, 'Firebase 에뮬레이터 필요 — npm run test:e2e:ride-continuation')
  335 |   // 실제로 경로를 달리는 시험이다(1 km ≈ 80초). 기본 30초 타임아웃으로는 부족하다.
  336 |   test.beforeEach(async ({ page }) => {
  337 |     test.setTimeout(300_000)
  338 |     page.setDefaultTimeout(15_000)
  339 |     // Approach B: Mapbox 스타일 URL 을 가로채 최소 유효 JSON 으로 대체.
  340 |     // fake pk 환경에서 map.on('load') 가 발화되어 mapLoaded=true 가 되게 한다.
  341 |     // Auth / Firestore / Functions 에뮬레이터에는 영향 없음.
  342 |     await stubMapboxStyle(page)
  343 |   })
  344 | 
  345 |   // ── RC1: 이어달리기 e2e — reload 포함 전체 흐름 (원문 §6 C1 과 무관) ──
  346 |   test('RC1 — 미완주 SavedRoute 를 종료→재진입→재개까지 이어 달린다', async ({ page }, testInfo) => {
  347 |     await enterAsGuest(page)
  348 |     const uid = await readGuestUid(page)
  349 |     const routeId = `fixture-rc1-${Date.now()}`
  350 |     await seedSavedRoute({ uid, routeId, name: 'RC1 이어달리기 픽스처', lastProgressRatio: 0 })
  351 | 
  352 |     await reloadAtDefaultLocation(page)
  353 |     await prepareManualRideInput(page)
  354 |     await loadSavedRouteFromMenu(page, 'RC1 이어달리기 픽스처')
  355 | 
  356 |     // 1차 주행 — 전체의 약 20% 지점까지
  357 |     await page.getByRole('button', { name: '주행 시작' }).click()
  358 |     await rideUntilSessionMeters(page, FIXTURE_LENGTH_M * 0.2)
  359 | 
```