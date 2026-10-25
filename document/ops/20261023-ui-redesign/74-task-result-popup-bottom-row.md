# 지시74·결과 — 경로 팝업 두 탭의 맨 아래 줄 통일(Claude Code 직접)

2026-10-25 KST · Supervisor Claude Code 가 지시·구현·감리를 모두 맡음(디자인 맞춤은 수퍼바이저 직접, 2026-10-24 Chief). 외부 실행자 없음.

## Chief 지시(10-25, 묶음5 승인 조건)

> 승인하되 한 가지 수정하라. 두 개의 창 모두 최하단 버튼의 인터페이스를 동일한 구조로 만든다. 경로 탐색 방법 버튼(자동차, 자전거, 도보)과 주행 시작 버튼, 경로 삭제 버튼을 일관성 있는 모양이 되도록 한다. 거리·방향에 의한 경로탐색 방법의 경우 default 경로탐색방법이 자동차로 설정되어 있다. 이 상태에 변화는 없다. 다만 다시 배치한 자동차, 자전거, 도보 버튼을 이용해 사용자가 다른 경로 탐색 방법을 선택한 경우 해당 방법으로 재탐색 하도록 한다.

Chief 스케치: 두 탭 모두 `[자동차][자전거][도보] … [▶] 경로 삭제`.

## 금지(고정 목록에서 옮김)

- 고정1: 시작 버튼은 녹색 원형 재생 아이콘, 글자 없음(`ride-media-button--play`).
- 고정13: 지점 팝업 버튼 「Start · +WP · End」, 탭 「Start·End」.
- 10-21 지시11: 경로 삭제는 맨 아래 수단 오른쪽. 제목 줄에 두지 않는다.

## 바꾼 것 — `apps/web/src/components/map/mapPopupElements.ts`

| 전 | 후 |
|---|---|
| 거리·방향 탭: 방향을 골라 결과가 나오기 전에는 수단 3개가 **숨음** → 맨 아래 줄이 `▶ … 경로 삭제` | 두 탭 모두 수단 3개가 **늘 보임** → `🚗 🚲 👣 … ▶ 경로 삭제`, 같은 자리·같은 크기(28px 원) |
| 출발·도착 탭: 출발·도착 둘 다 있어야 수단이 보임 | 늘 보이고, 둘 다 없으면 **꺼짐**(재생 버튼처럼 흐리게) |
| 거리·방향: 방향을 고른 뒤에만 수단을 누를 수 있음 | 출발만 있으면 누를 수 있음. **방향 전**에 고르면 그 수단으로 방향 대기를 다시 걸어 다음 방향 클릭에 씀, **방향 뒤**(결과 있음)에 고르면 그 수단으로 바로 재탐색 |

- 강조 애니메이션(수단 선택 대기)은 종전 조건 그대로 — 버튼이 보인다는 이유만으로 깜빡이지 않게 `restartProfileAttention` 판단을 「숨김」에서 「강조 클래스」로 바꿈.
- 꺼진 수단 버튼의 안내(title): 출발·도착 탭 「Start·End 를 먼저 정하세요」, 거리·방향 탭 「출발 위치를 먼저 정하세요」.
- 기본 수단 로직은 손대지 않음(아래 「확인 필요」).

## 확인 필요 — 거리·방향 기본 수단

Chief 는 「거리·방향 기본은 자동차」라고 했으나 코드상 거리·방향 팝업의 첫 수단은 **앱의 현재 경로 수단**(`useRoutePlanning` 기본 `cycling`, 직전에 고른 수단·이어 달리기는 직전 Ride 수단)을 따른다(`MapView.tsx` `routeProfile: routeProfileRef.current` → 팝업 `currentProfile`). 서버(`getDistanceAutoRoute`)는 받은 수단을 그대로 쓴다. Chief 지시가 「변화 없음」이라 바꾸지 않았다. 자동차로 고정하려면 Chief 결정이 필요(이어 달리기 수단 승계 계약 `resolveRideContinuationSetup` 과 부딪힘).

## 시험

| 검사 | 결과 |
|---|---|
| `e2e/distance-direction-attention.spec.ts` | 숨김 기대 6곳 → 「보이고 아무것도 안 눌림」/「꺼짐」으로 교체. **새 시험** 「방향 전 수단 선택은 다음 방향 탐색에 쓰이고, 결과 뒤 선택은 바로 재탐색」 + 두 탭 맨 아래 줄 순서·자리(±1px)·크기 동일 단언 |
| `e2e/route-ride-controls.spec.ts` | 거리·방향 「보행 숨김」 → 「사용 가능·생성 0」, 출발·도착(도착 없음) 「자전거 숨김」 → 「보임·꺼짐」 |
| 팝업 관련 7파일(위 둘 + distance-route-result-layout·distance-route-continuation·ui-redesign-batch5·route-media-controls·route-pick-popup-title) | **50 PASS · 2 skip**(route-pick-popup-title 은 에뮬레이터 전용) |
| 잠금 ui-800x360·batch3·batch4·address-minimap-width | 52 PASS |
| `npx tsc -b --noEmit` · test:quick · verify-selectors · tidy·dep·doc·diff-check | exit 0 · 1361/1361(첫 실행 1건 실패, 재실행 2회 모두 통과) · 19단계 · 모두 0 |

증거(2배 캡처): `evidence/instruction74/popup-location.png`·`popup-distance.png`·`popup-location-to-distance.png`·`popup-ready-start.png`·`popup-no-start.png`, 실제 지도 결과 `step30-distance-800.png`, 출발만 있는 출발·도착 탭 `instruction74-bottom-row-location.png`.

## 판정

PASS(Claude Code 자체 감리). 고정1·13·지시11 유지. Chief 화면 확인 대기.
