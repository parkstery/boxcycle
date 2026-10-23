# 순위 칩·순위판(A) + 주행 결과 순위 줄(C) — 지시서 (2026-10-23)

chief 승인 시안: https://claude.ai/artifact/NWrpXU7boGovvs8EixVcdN 맨 위 줄
- 「A. 순위 칩 + 펼친 순위판 (지도 대기)」 → `LbMap`
- 「A. 주행 중 — 내 앞뒤 2명」 → `LbRiding`
- 「C. 주행 결과 — 순위 변화 한 줄」 → `LbSummary`

시안 원본 HTML은 `C:\Users\kdrea\AppData\Local\Temp\claude\C--20-HDev-boxcycle\6575635b-6ae9-45bb-9e12-4afec0ea93b9\scratchpad\all-screens\project\LbMap.dc.html`·`LbRiding.dc.html`·`LbSummary.dc.html` 에 있다. 색·크기·간격은 여기서 읽는다.

디자인 규칙: `document/ops/20261023-leaderboard/design-system/README.md` — 특히 **「상태별 원칙」** 절을 지킨다.
- 지도 위 순위 목록은 **바탕 없는 윤곽선 글자**로 그린다. 지금 HUD 계기판(`MapHud.css` 의 `.hud-metrics__value` — `-webkit-text-stroke`·`paint-order: stroke fill`·`--hud-metric-halo`)과 같은 방식이다.
- 칩은 누르는 조작부라 작은 파란 바탕을 둔다.
- 단위는 언제나 소문자 km.

서버는 감리가 이미 바꿨다: `LEADERBOARD_TOP_N` 20, 내 위아래 3명(`AROUND_SPAN` 3). 배포는 감리가 한다.

## 1. 순수 계산 모듈 (먼저, 단위 시험 포함)

`src/lib/ride/leaderboardLiveRank.ts`. **import 없음**으로 순수 함수만 둔다.

- 입력: 리더보드 응답의 줄들(`top` ∪ `me.around`, 중복 제거; 각 줄 `{ rank, nickname, valueKm, isMe, liveTrailId? }`), 내 기준값 `myBaseKm`, 이번 주행으로 더할 `addedKm`.
- 출력:
  - `rank`: 내 새 순위
  - `rows`: 나를 가운데 둔 위아래 2명씩 최대 5줄. 내 줄 값은 `myBaseKm + addedKm`
  - `gapToNextKm`: 바로 앞 사람까지 남은 거리. 1위면 null
  - `aheadRank`: 「N위까지」의 N
- 순위 규칙은 서버와 같다(`functions/src/leaderboardCore.ts` `layoutLeaderboard`).
  - 0.1 km 단위로 내림(`tenthsOf`)한 값으로 비교한다.
  - 동점은 같은 순위이고, 그다음은 건너뛴다(1, 2, 2, 4).
- 내가 목록에 없던 경우(unranked)에 `addedKm > 0` 이면 들어갈 자리를 계산한다.
- 시험 위치: `scripts/ride-stats/leaderboard-live-rank.test.ts`. `test:quick` 이 집어 가는 위치·형식을 기존 시험에서 확인할 것.
- 시험 경우: 추월 1명 / 동점 / 1위 / 목록 밖에서 진입 / addedKm 0.

## 2. 데이터 훅

`src/hooks/useLeaderboardGlance.ts`
- `fetchLeaderboard(user, "distance", "week")`를 쓴다(`services/leaderboardApi.ts`).
- 언제 부르나: 칩을 그릴 때 1번, 그 뒤 5분마다(서버 캐시 5분과 같게). 화면이 숨겨지면(`document.visibilityState`) 쉰다.
- **주행 시작 때 응답을 한 번 붙잡아 둔다**(`atRideStart`). 주행 중 계산과 결과 화면의 「전 순위」는 이 값을 쓴다.
- 실패는 조용히 처리한다. 칩만 「순위」로 보이고, 오류 문구는 띄우지 않는다.
- 결과 적용은 `components/ui/settleUnlessCancelled.ts` 패턴을 따른다.

## 3. 순위 칩 + 순위판 (지도 대기 — `LbMap`)

- **위치:** `MapHud.tsx` 우상단 줄(`map-hud__tr`). 맵 제어(위성 + −)와 계정 칩 사이에 칩을 넣는다. 순위판은 그 아래 오른쪽에 붙는다.
- **칩 문구:**
  - 회원·순위 있음: 「이번 주 **2**위 ▾/▴」
  - 회원·순위 없음: 「순위」
  - 게스트·예상 있음: 「예상 **2**위」
  - 게스트·예상 없음: 「순위」
  - 숫자는 Saira Condensed.
- **열기·닫기:** 칩을 누르면 순위판이 열리고 닫힌다. **처음엔 닫힘.** 열림 상태는 `localStorage` 에 저장한다(읽기·쓰기 모두 try/catch, 실패해도 동작).
- **순위판 내용:**
  - 제목 줄 「순위 · 주행 거리 · 이번 주」 + 「전체 보기 ›」. 「전체 보기」는 기존 `openLeaderboardPanel` 로 큰 리더보드를 연다.
  - 목록은 최대 20줄이고 6줄 높이를 넘으면 판 안에서 세로 스크롤한다.
  - 1~3위 번호는 하늘색, 내 줄은 연한 하늘색 + 「나」, 달리는 사람은 검은 테 두른 초록 점.
  - 아래 줄: 「1위까지 **0.5 km**」(내가 1위면 줄 없음).
  - 게스트: 「회원 등록하면 그대로 순위에 올라가요」 글자 버튼 → 기존 회원 등록(`handleGoogleSignIn`).
  - 회원·순위 없음: 「센서로 달리면 순위에 올라가요」.
- **크기:** 순위판이 오른쪽 아래 「주행 시작」 버튼과 경로 도크를 가리지 않게 높이를 제한한다. 800×360 기준.
- **터치:** 지도로 터치가 새지 않게 기존 우상단 그룹처럼 `onPointerDown`/`onTouchStart` 를 `stopPropagation` 한다.

## 4. 주행 중 (`LbRiding`)

- 순위판이 열려 있던 사람에게만 보인다. 닫혀 있으면 칩만 보인다.
- 칩 문구: 「**5**위」(실시간 순위).
- 판은 1번 함수의 `rows` 5줄(위아래 2명). 머리말 「이번 주 순위 · 달리는 동안 갱신」, 아래 「4위까지 **0.3 km**」.
- `addedKm` 은 **이번 세션 거리**다. 단, **케이던스 센서 데이터가 들어온 주행일 때만** 더한다(`pedalActiveSecRef.current != null`, 서버의 t1 판정과 같은 기준). 센서 없는 주행이면 더하지 않고, 아래 줄을 「센서 없이 달리는 중 · 순위 제외」로 바꾼다.
- 주행 중에는 서버를 다시 부르지 않는다(`atRideStart` 사용).
- 우상단 카메라 버튼 줄과 겹치지 않는지 800×360 에서 확인한다.

## 5. 주행 결과 한 줄 (C — `LbSummary`)

- `RideSummarySheet` 에 선택 prop 하나를 추가한다(예: `rankChange`). App 에서 `atRideStart`·이번 주행 거리·센서 여부로 계산해 넘긴다.
- 표시:
  - 「이번 주 순위 **3**위 → **2**위 ▲1 · 1위까지 0.5 km」. ▲ 는 live 초록 `#1E7A46`.
  - 순위가 그대로면 「이번 주 **2**위 그대로 · 1위까지 0.5 km」.
  - 게스트면 「회원이라면 이번 주 예상 **2**위」.
  - 센서 없는 주행이거나 데이터가 없으면 줄을 그리지 않는다.
- 이 줄을 누르면 큰 리더보드를 연다. 버튼을 새로 늘리지 않는다.
- 기존 주행 결과 화면의 다른 요소는 바꾸지 않는다.

## 금지

- `git worktree`·`git restore`·`git clean`·`git stash`·브랜치 전환·커밋·푸시 금지.
- `functions/` 수정 금지(감리 담당).
- `dep-layers.json` 수정 금지. 의존 방향 위반이 생기면 구조를 바꿔 풀 것.
- localhost:3000 건드리지 말 것.
- 요청 범위 밖 리팩토링 금지.

## 검증 (apps/web)

```
npx tsc -b --noEmit
npx eslint <바꾼 파일>
npm run test:quick
node ../../scripts/check-code-tidy.mjs        # 기준선 이내(늘면 안 됨)
node ../../scripts/check-dep-direction.mjs --check
RTW_DEV_PORT=5016 npx playwright test ui-800x360 --workers=1 --retries=0   # 기존 :84 1건만 실패 허용
RTW_DEV_PORT=5017 npm run test:e2e:ride                                    # 7/7
```

**캡처 (필수):** 800×360 에서 3장을 `C:\20.HDev\boxcycle\.out\glance-map.png`·`glance-riding.png`·`glance-summary.png` 로 남긴다. 각각 시안 `LbMap`·`LbRiding`·`LbSummary` 와 같은 상태다.
- 실제 앱에서 데이터를 만들기 어려우면 `scripts/ui-800x360/preview.tsx` 하네스에 리더보드 예시 데이터를 넣어 찍는다. 이때 **제품 컴포넌트와 제품 CSS를 그대로** 쓴다. 베낀 사본은 금지.

## 보고

`document/ops/20261023-leaderboard/05-result-glance.md`에 다음을 적는다.
- 바꾼 파일
- 새 시험
- 검증 숫자(tsc, test:quick 통과 수, tidy 전→후, dep, e2e)
- 캡처 3장 경로
- 시안과 다르게 한 점과 그 이유
