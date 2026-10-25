# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ride-continuation.spec.ts >> 다음 주행 · 이어 달리기 >> RC4 — ad-hoc 주행은 저장하지 않아도 다음 출발점이 남는다
- Location: e2e\ride-continuation.spec.ts:550:3

# Error details

```
TimeoutError: locator.click: Timeout 15000ms exceeded.
Call log:
  - waiting for getByRole('region', { name: '주행 결과', exact: true }).locator('.ride-summary__close')

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e4]:
    - generic [ref=e5]:
      - region "Map" [ref=e6]
      - generic:
        - generic:
          - generic:
            - status "카메라 고도(해수면 기준)": 고도 486.5 m
          - generic:
            - generic: 50 m
        - link "Mapbox homepage" [ref=e8] [cursor=pointer]:
          - /url: https://www.mapbox.com/
    - generic "다음 주행":
      - group "다음 주행" [ref=e9]:
        - generic [ref=e10]:
          - generic [ref=e11]:
            - generic [ref=e12]: 다음 주행
            - heading "새 출발" [level=2] [ref=e13]
            - paragraph [ref=e14]: 오늘 한 번 더 이어 가 볼까요?
          - button "다음 주행 숨기기" [ref=e15] [cursor=pointer]:
            - generic [ref=e16]: ✕
        - paragraph [ref=e17]: 대한민국 서울특별시 용산구 남산공원길
        - generic [ref=e18]:
          - button "여기에서 계속" [ref=e19] [cursor=pointer]
          - button "지도에서 보기" [ref=e20] [cursor=pointer]
    - generic:
      - group "주행 제어":
        - 'button "케이던스 센서: 연결 안 됨" [ref=e21] [cursor=pointer]'
    - generic "라이딩 HUD":
      - button "Trail 메뉴" [ref=e23] [cursor=pointer]
      - button "맵 뷰 설정" [ref=e24] [cursor=pointer]: 맵 뷰
      - complementary "Trail·동행" [ref=e27]:
        - generic [ref=e28]:
          - generic [ref=e29]:
            - generic [ref=e30]: 접속
            - generic "default" [ref=e31]: Trailhead
          - list [ref=e32]:
            - listitem [ref=e33]: 게스트-7h5l
            - listitem [ref=e34]: 게스트-ECVA
            - listitem [ref=e35]: 게스트-gf15
            - listitem [ref=e36]: 게스트-wAoc (나)
        - generic [ref=e37]:
          - generic [ref=e38]:
            - generic [ref=e39]: 동행
            - generic "Basic 1 · 서울 남산공원길" [ref=e40]
          - paragraph [ref=e41]: 최근 24시간 1회
          - paragraph [ref=e42]: 다른 라이더 없음
      - generic [ref=e43]:
        - group "맵 제어" [ref=e44]:
          - button "맵 스타일 야외, 클릭 시 위성" [ref=e45] [cursor=pointer]: 야외
          - button "줌 확대" [ref=e46] [cursor=pointer]: +
          - button "줌 축소" [ref=e47] [cursor=pointer]: −
        - button "순위" [ref=e49] [cursor=pointer]:
          - img [ref=e50]
        - button "사용자 정보" [ref=e52] [cursor=pointer]:
          - generic [ref=e53]: G
          - generic [ref=e54]:
            - generic [ref=e55]: 게스트-wAoc
            - generic [ref=e56]: 0 km
      - time: 26.10.24 / 22:08:22
  - button "메뉴 열기" [ref=e57] [cursor=pointer]:
    - img [ref=e59]
  - button "맵 뷰 열기" [ref=e61] [cursor=pointer]:
    - img [ref=e63]
  - generic:
    - button
    - dialog:
      - banner:
        - generic:
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
                - generic: 입문 경로
                - generic: 처음이라면
                - img
            - listitem:
              - button:
                - generic:
                  - img
                - generic: 퍼블릭 경로
                - generic: 다른 라이더가 만든 길
                - img
            - listitem:
              - button:
                - generic:
                  - img
                - generic: 내 경로
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
                - img
            - listitem:
              - button:
                - generic:
                  - img
                - generic: 주행 설정
                - img
          - status:
            - text: "선택:"
            - strong: Basic 1 · 서울 남산공원길
            - text: ·
            - button: 나가기
        - region:
          - generic: 지금 달리는 Trail
          - paragraph: 없음
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
            - strong: 게스트-wAoc
            - generic: 게스트로 이용 중
          - button:
            - img
        - generic:
          - group:
            - generic: 내 도로망
            - generic:
              - generic: "0.4"
              - generic: km
          - group:
            - generic: 누적
            - generic:
              - generic: "0.4"
              - generic: km
              - generic: ·
              - generic: "1"
              - generic: 회
              - generic: ·
              - generic: "0"
              - generic: 분
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
```

# Test source

```ts
  2   | import fs from 'node:fs'
  3   | import path from 'node:path'
  4   | import { readGuestUid } from './readGuestUid'
  5   | import { stubMapboxStyle } from './mapbox-stub'
  6   | import { chooseColosseumIfNeeded, guestStart } from './rideEntryHelpers'
  7   | 
  8   | // 다음 주행·이어 달리기 e2e(RIDE-CONTINUE-1 §7.3).
  9   | // 「어제 멈춘 곳이 오늘 앱을 열었을 때 자동으로 다음 출발점이 된다」를 종료→재진입까지 고정한다.
  10  | //
  11  | // ⚠ 시나리오 ID 표기 규칙:
  12  | //   RC1–RC5 = 이어달리기 e2e 전용 (이름만 비슷할 뿐 §6 C1–C5 와 다른 시나리오)
  13  | //   RC13    = §6 C13 e2e 증거 (reload 없이 결과 닫기→다음 주행→Go)
  14  | //   CF-LIVE = CF conquestOnRideCreated 에뮬레이터 라이브 (R5/F3) — §6 C14 가 아님
  15  | //   §6 C1–C14 전체 매핑: document/archive/260910-RTW-0B-CLOSEOUT-C1-C14-matrix.md
  16  | //
  17  | // 셀렉터는 scripts/ride-verify/entry-contract.mjs 와 같은 계약을 쓴다 —
  18  | // 한쪽만 고치지 않는다(verify-selectors.mjs 가 앵커 실재를 지킨다).
  19  | //
  20  | // ⚠ Firebase 의존: 게스트 = 실제 signInAnonymously, 경로·Ride = 실제 Firestore.
  21  | // `npm run test:e2e:ride-continuation` 이 firebase emulators:exec 로 감싸 실행하며,
  22  | // 그 env(FIRESTORE_EMULATOR_HOST) 를 playwright.config 가 감지해 RIDE_VERIFY_LIVE=1 을 켠다.
  23  | // RIDE_VERIFY_LIVE=1 을 직접 켜 실 Firebase 에 붙이지 않는다.
  24  | const LIVE = process.env.RIDE_VERIFY_LIVE === '1'
  25  | 
  26  | const PROJECT_ID = 'boxcycle-dc2df'
  27  | const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080'
  28  | const DOCS_URL = `http://${EMULATOR_HOST}/v1/projects/${PROJECT_ID}/databases/(default)/documents`
  29  | 
  30  | /** 결정적 fixture 경로 — 위도 37.5 를 따라 동쪽으로 뻗는 직선(약 1 km) */
  31  | const FIXTURE_POINTS = 11
  32  | const FIXTURE_STEP_LNG = 0.00113
  33  | const FIXTURE_LAT = 37.5
  34  | const FIXTURE_START_LNG = 127.02
  35  | 
  36  | function fixtureCoordinates(): [number, number][] {
  37  |   const out: [number, number][] = []
  38  |   for (let i = 0; i < FIXTURE_POINTS; i += 1) {
  39  |     out.push([FIXTURE_START_LNG + i * FIXTURE_STEP_LNG, FIXTURE_LAT])
  40  |   }
  41  |   return out
  42  | }
  43  | 
  44  | function haversineMeters(a: [number, number], b: [number, number]): number {
  45  |   const toRad = (d: number) => (d * Math.PI) / 180
  46  |   const R = 6371000
  47  |   const dLat = toRad(b[1] - a[1])
  48  |   const dLng = toRad(b[0] - a[0])
  49  |   const h =
  50  |     Math.sin(dLat / 2) ** 2 +
  51  |     Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2
  52  |   return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
  53  | }
  54  | 
  55  | function fixtureLengthMeters(): number {
  56  |   const coords = fixtureCoordinates()
  57  |   let sum = 0
  58  |   for (let i = 1; i < coords.length; i += 1) sum += haversineMeters(coords[i - 1], coords[i])
  59  |   return sum
  60  | }
  61  | 
  62  | const FIXTURE_LENGTH_M = fixtureLengthMeters()
  63  | 
  64  | /** U4 HUD 증거 스크린샷 — Playwright 가 정리해도 남는 고정 경로 */
  65  | const U4_HUD_EVIDENCE_PATH = path.resolve(
  66  |   process.env.RIDE_CONTINUATION_EVIDENCE_DIR ?? path.resolve(process.cwd(), '../../document/archive/ride-verify-evidence'),
  67  |   'u4-hud-resume-dual.png',
  68  | )
  69  | 
  70  | /** RC1 U6 증거 — 결과 시트를 닫은 직후(reload 없이) 「다음 주행」 카드가 뜬 화면
  71  |  *  ⚠ 이 상수는 이어달리기 e2e RC1 시나리오 전용이다 — 원문 §6 C1(서버 저장 응답)과 무관하다. */
  72  | const RC1_CARD_NO_RELOAD_EVIDENCE_PATH = path.resolve(
  73  |   process.env.RIDE_CONTINUATION_EVIDENCE_DIR ?? path.resolve(process.cwd(), '../../document/archive/ride-verify-evidence'),
  74  |   'c1-next-ride-card-no-reload.png',
  75  | )
  76  | 
  77  | /** RC1 U2·§3.4 증거 — 이어 달리기 준비 상태(완료/남은 구간 + 재개점 마커 + Go)
  78  |  *  ⚠ 이어달리기 e2e RC1 시나리오 전용 — 원문 §6 C1 과 무관하다. */
  79  | const RC1_RESUME_READY_EVIDENCE_PATH = path.resolve(
  80  |   process.env.RIDE_CONTINUATION_EVIDENCE_DIR ?? path.resolve(process.cwd(), '../../document/archive/ride-verify-evidence'),
  81  |   'c1-resume-ready-to-start.png',
  82  | )
  83  | 
  84  | /** 게스트 진입 카드 → 익명 인증 완료 */
  85  | async function enterAsGuest(page: Page) {
  86  |   await page.goto('/')
  87  |   await guestStart(page)
  88  |   await chooseColosseumIfNeeded(page, true)
  89  |   await expect(page.getByRole('dialog', { name: '어디에서 시작할까요?', exact: true })).toBeHidden()
  90  | }
  91  | 
  92  | /** 새로고침 뒤 위치 안내를 완료한 다음 지도 조작을 시작한다. */
  93  | async function reloadAtDefaultLocation(page: Page) {
  94  |   await page.reload()
  95  |   await chooseColosseumIfNeeded(page, true)
  96  |   await expect(page.getByRole('dialog', { name: '어디에서 시작할까요?', exact: true })).toBeHidden()
  97  | }
  98  | 
  99  | /** 결과판 내부 닫기만 누른다. 같은 aria-label의 배경 scrim은 선택하지 않는다. */
  100 | async function closeRideResult(page: Page) {
  101 |   const summary = page.getByRole('region', { name: '주행 결과', exact: true })
> 102 |   await summary.locator('.ride-summary__close').click({ timeout: 15_000 })
      |                                                 ^ TimeoutError: locator.click: Timeout 15000ms exceeded.
  103 |   await expect(summary).toBeHidden({ timeout: 15_000 })
  104 | }
  105 | 
  106 | /**
  107 |  * 주행 입력 준비(Go 사전조건) + 체험 속도 최대치.
  108 |  * 자동 E2E 에는 BLE 장치가 없으므로 「센서 없음」를 명시적으로 고른다.
  109 |  * 속도를 올리는 건 시험 시간을 줄이기 위함이며, 주행 로직은 동일하다.
  110 |  */
  111 | async function prepareManualRideInput(page: Page, speedKmh = 50) {
  112 |   await page.getByRole('button', { name: /케이던스 센서/ }).click()
  113 |   const sheet = page.getByRole('dialog', { name: '케이던스 센서' })
  114 |   await expect(sheet).toBeVisible()
  115 |   await sheet.getByRole('button', { name: '센서 없음' }).click()
  116 |   const speedInput = sheet.getByRole('spinbutton', { name: '속도 km/h' })
  117 |   if (await speedInput.count()) {
  118 |     await speedInput.fill(String(speedKmh))
  119 |     await speedInput.blur()
  120 |   }
  121 |   await sheet.getByRole('button', { name: '센서 설정 닫기' }).click()
  122 |   await expect(sheet).toBeHidden()
  123 | }
  124 | 
  125 | 
  126 | function doubleArray(v: [number, number]) {
  127 |   return { arrayValue: { values: [{ doubleValue: v[0] }, { doubleValue: v[1] }] } }
  128 | }
  129 | 
  130 | /**
  131 |  * 결정적 SavedRoute 를 에뮬레이터에 심는다.
  132 |  * `Authorization: Bearer owner` 는 에뮬레이터에서 rules 를 우회하는 표준 방법이다.
  133 |  */
  134 | async function seedSavedRoute(input: {
  135 |   uid: string
  136 |   routeId: string
  137 |   name: string
  138 |   lastProgressRatio: number
  139 |   completed?: 0 | 1
  140 | }): Promise<void> {
  141 |   const coords = fixtureCoordinates()
  142 |   const nowIso = new Date().toISOString()
  143 |   const body = {
  144 |     fields: {
  145 |       userId: { stringValue: input.uid },
  146 |       name: { stringValue: input.name },
  147 |       profile: { stringValue: 'cycling' },
  148 |       startLngLat: doubleArray(coords[0]!),
  149 |       endLngLat: doubleArray(coords[coords.length - 1]!),
  150 |       geometryType: { stringValue: 'LineString' },
  151 |       geometryCoordsJson: { stringValue: JSON.stringify(coords) },
  152 |       distanceMeters: { doubleValue: FIXTURE_LENGTH_M },
  153 |       durationSec: { doubleValue: 300 },
  154 |       source: { stringValue: 'web' },
  155 |       createdAt: { timestampValue: nowIso },
  156 |       updatedAt: { timestampValue: nowIso },
  157 |       completed: { integerValue: String(input.completed ?? 0) },
  158 |       completedAt: { nullValue: null },
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
```