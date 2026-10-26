# 지시·결과 86 — 거리·방향 원·화살표 펄스

2026-10-26 · Chief 직접 지시 · Supervisor Claude Code 직접 구현·감리·캡처

## 지시

> Chief: 「거리·방향에 의한 경로 탐색할 때 원과 화살표를 펄스로 표시해서 사용자가 다음 행동에 대한 안내를 명확하게 해 주길 원해. 이 동영상처럼(`Downloads\pulsing.mp4`) … 코덱스에게 시켰는데 잘 못하더라고. 결과가 없었어.」

- 참고 영상: 빨간 점선 원 + 바깥을 향한 화살표 12개, 원 전체가 약 1.5초 주기로 커졌다 작아지기를 반복(6초·440×440, 프레임 `evidence/instruction86/reference-frames.png`).

## 원인 — 종전 구현이 「결과 없음」으로 보인 이유

- `lib/map/distanceCircleAttention.ts` 의 종전 펄스는 거리를 고른 뒤 **1.4초 동안 선 굵기만 3→6px 두 번** 바꾸고 끝났다. 원 크기는 그대로라 지도 위에서 거의 알아차릴 수 없었다.

## 변경

- `pulseDistanceCircle(map, getCircle)` — 원(`distance-target-circle`)과 화살표(`distance-target-circle-arrows`) GeoJSON 을 **중심 기준 1.0→1.1배로 함께 키웠다 줄이기를 1.5초 주기로 반복**(30fps). 굵기·색·점선·화살표 개수는 그대로.
- 시작·멈춤 시점은 종전 그대로: 거리 확정(`commitDistanceInput`) 때 시작, 방향 클릭·거리 재선택·팝업 닫힘 때 멈추고 **원래 원으로 복원**. reduced motion 이면 움직이지 않는다.
- 거리를 바꾸면 MapView 의 현재 원(`distanceTargetCircleRef`)을 매 프레임 따라간다.
- 경로 탐색·좌표·카메라·네트워크 요청은 바꾸지 않았다.

## 검증

| 항목 | 명령·방법 | 결과 |
|---|---|---|
| 계약 시험 | `node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/distance-auto-route/distance-auto-route-contract.test.ts` | 56/56 PASS |
| 사보타주 | 최대 배율을 1.0 으로 바꾸면 위 시험 | 1 FAIL(겨냥 확인) → 원복 후 PASS |
| 실지도 시험 | `npx playwright test distance-direction-attention --workers=1`(5020) — 1.6초 동안 원 폭 최대/최소 > 1.05, 멈춘 뒤 < 1.001 | 3/3 PASS |
| 화면 | 800×360 녹화·프레임(`evidence/instruction86/after-pulse-*`) — 측정 변화율 1.0999 | 원·화살표 함께 확대 확인 |
| 타입·lint·의존 방향 | `npx tsc -b --noEmit` · 변경 파일 eslint · `check-dep-direction --check` | 0 · 0 · 통과 |

비교 페이지: `C:\20.HDev\boxcycle\document\ops\20261023-ui-redesign\comparison-instruction86-87.html`

## 상태

LOCAL_VERIFIED / AWAITING_CHIEF_SCREEN — Chief 화면 확인 전 커밋·배포하지 않는다.
