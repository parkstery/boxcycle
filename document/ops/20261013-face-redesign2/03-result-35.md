# 결과35 — 전환 터치 높이와 공통 삭제 마감

- 범위: `apps/web/src/components/map/mapPopupElements.ts`, `apps/web/src/components/map/MapView.css` pick 규칙만. 기존34/32/33·타 담당자 dirty 미접촉. commit/push/deploy/server/하위agent 없음.

## 1. CSS specificity (enter/back 44px 덮임 해소)

- 원인: `.map-view__pick-btn--route-enter/back` (0,1,0)이 파일 뒤쪽 base `.map-view__pick-btn { min-height:0 ... }` (0,1,0)에 순서로 밀림.
- 수정: 셀렉터를 `.map-view__pick .map-view__pick-btn--route-enter` / `.map-view__pick .map-view__pick-btn--route-back` (+hover 동일)로 올려 (0,2,0)으로 base를 순서 무관하게 이김. min-height:44px, display:flex/center, 패딩/배경/색 포함.
- back은 약한 배경(#F1F5F9) 유지 + `border-radius:10px`로 알약(999px)인 제목·진입 버튼과 구분.
- 제목 `.map-view__pick-route-distance-title`: 기존 nowrap+ellipsis(생략) 제거 → `white-space:normal; overflow:visible; text-overflow:clip; overflow-wrap:break-word`. 좁으면 제목만 줄바꿈, 생략 없음. back 버튼은 `white-space:nowrap` 유지.
- 44px 추가 중간행 없음: enter는 기존 profile행 끝, back+제목은 기존 거리 head행 안.

## 2. 공통 삭제 (profile row → headerRow)

- `clearRouteBtn`을 `let clearRouteBtn: HTMLButtonElement | null` 전용 변수에 보관, `rowProfile.appendChild(clearRouteBtn)` 제거. profile행은 3수단+`거리 ›`만.
- 새 공통 `div.map-view__pick-header-row`에 `tokenSection` + `clearRouteBtn` 나란히 append. `dragHandle` 순서 = headerRow, address, meta. dragHandle이 두 뷰 공통 상위라 위치/거리 모두 동일 삭제 버튼 접근.
- 라벨(`경로 삭제`)/aria(`경로 전체 삭제`)/콜백(onClearRoute+원 정리+핀 초기화+close)/기존 font·버튼 size 그대로. token 피드백은 `flex:1 1 auto; min-width:0`으로 전체 표시.
- 닫기 ✕ 자리: headerRow가 `padding-right:1.85rem`(1.65rem 버튼+0.2rem 오프셋, 지시 약1.7rem) 확보. scoped `.map-view__pick-header-row .map-view__pick-token { margin:0; padding:0; border-bottom:0 }`으로 기존 token 우측 1.95rem 패딩과 이중 확보 방지. 구분선은 headerRow에 하나만. headerRow 내 clear 버튼 `margin-left:0; flex:0 0 auto`.

## 검증 (Developer)

- `git diff --check`: 통과(출력 없음).
- `apps/web npx tsc -b --pretty false`: 통과(출력 없음).
- `grep`: `rowProfile.appendChild(clearRouteBtn)` 소스에서 제거 확인, `headerRow`/`(0,2,0)` 셀렉터 존재 확인.

## Supervisor 검수 요청 (본 Developer 미실행)

- DOM32 상태 / 실제 3viewport 15상태와 44px 실측(enter/back 계산 높이 ≥44px, base min-height:0에 안 밀림).
- 좁은 화면에서 거리 제목 전체 문구 읽힘(줄바꿈 허용, ellipsis 생략 없음), 복귀 버튼과 제목이 한 덩어리로 안 보임(배경/radius 구분).
- 두 모드에서 동일 삭제 버튼 접근·동작, 삭제 후 값 보존(목표거리·수단·검색/오류 상태 초기화 없음 — 기존34 계약 유지).

## 테스트 계약 변경 필요 (테스트 파일 수정은 이번 허용 아님)

- `apps/web/scripts/distance-auto-route/distance-auto-route-contract.test.ts` 중 `3D-2 — 이동수단과 경로 삭제가 같은 action row` (`assert.match(.../rowProfile\.appendChild\(clearRouteBtn\)/)`, `assert.doesNotMatch(.../profileHeader/)`)가旧 배치에 고정되어 이번 Chief 구조 승인(공통 headerRow)과 충돌 → FAIL 예상. 다음 지시에서 해당 계약을 headerRow(`map-view__pick-header-row`에 token+clear 동거, profile행은 3수단+진입만)로 갱신 필요. 새 설계·알고리즘 변경 없음.
