# 지시 12-2 — 축척 정확성 복구 · 폰 가로 하단 잘림 · 카메라 버튼 hit-test

- 담당: Developer(Cursor CLI) · 보고: `03-result-12b.md` · 커밋 **금지**
- **금지**: `git worktree`·`git restore`·`git clean`·`git stash`·`git checkout`, `.env*` 생성·수정·복사.
- 병행: 지시 13(`useRideEndAndPersistence.ts`·`rideEndPersistence.ts`·`rideEndResult.ts`·`rideRecordPolicy.ts`·`RideSummarySheet.*`) — 그 파일 금지.

## 문제 ([검수 12](04-review-12.md))
1. 축척 막대 자체를 120px 로 고정해 **막대 길이가 실제 거리와 맞지 않는다.** 축척은 정확해야 한다.
2. 690×275 주행 중 고도/축척 줄이 화면 아래로 절반 잘린다.
3. (지시 11 후속) 690×275 주행 중 퀵 카메라 1–6 버튼 중심에서 `elementFromPoint` 가 버튼이 아닌 다른 요소를 친다는 보고가 있었다.

## 요구
1. **축척**: `.mapboxgl-ctrl-scale` 의 `width` 강제를 제거해 Mapbox 가 계산한 막대 폭을 그대로 쓴다. 대신 **고정 폭 바깥 상자**(예: 120px, 고도 상자와 같은 높이)를 둬서 상자 크기는 불변, 막대는 그 안에서 왼쪽 정렬로 늘고 준다. CSS 만으로 불가하면 `MapView.tsx` 에서 ScaleControl 컨테이너를 고정 폭 wrapper 로 감싸는 최소 변경 허용(`ScaleControl({ maxWidth })` 는 상자 폭 이하로).
2. **하단 잘림**: 690×275·740×360 에서 고도/축척 줄 전체가 뷰포트 안(bottom ≤ innerHeight)에 있고, 시계·카드 스택 규칙(12 의 간격)은 유지.
3. **카메라 버튼 hit-test**: 690×275 주행 중 1–6·야외·−·+ 각 버튼 중심의 `elementFromPoint` 가 해당 버튼(또는 자식)인지 계측. 아니면 덮는 요소를 특정해 그 요소의 CSS 만 고친다(지시 06-2 배치 유지).
4. 12 의 나머지(카드∩시계 0 등)는 회귀 금지.

## 허용 파일
`components/map/MapView.css`, `components/map/MapView.tsx`(ScaleControl wrapper 만), `components/maphud/MapHud.css`, `components/ride/NextRideCard.css`.

## 완료 조건
1. `cd apps/web && npx tsc -b --noEmit` 0.
2. 계측: 주행 중 줌 3단에서 (a) 바깥 상자 Δw·Δh = 0 (b) 막대 폭이 줌마다 **변함**(축척 정확성) (c) 690·740 하단 bottom ≤ innerHeight (d) 버튼 hit-test 전원 true. + 12 의 스택 계측 재확인.
3. 포트 8080 빌 때까지 대기 후 「다음 주행 카드 자리」 spec · `npm run test:e2e:menu-a` PASS.
4. 촬영 `shots-12b/`, `03-result-12b.md`.
