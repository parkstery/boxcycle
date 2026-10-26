# 지시·결과 88 — 주행 종료 평면 지도·카메라 2~6 야외 고정

2026-10-26 · Chief 직접 지시 · Supervisor Codex 직접 구현·감리

## 지시

1. 카메라 2~6 상태에서 Stop·목표 도달 자동 종료 등 어떤 종료 경로든 주행 결과 화면이 뜨면 지도를 평면 상태로 바꾼다.
2. 카메라 2~6 상태에서는 위성 지도를 보이지 않고 야외 지도만 사용한다.

## 금지

- 고정 1~3의 주행 조작과 지도 스타일·줌 컨트롤 자체를 숨기지 않는다.
- 카메라 1의 전체 경로/500m/20m 순환과 위성 진입·사용자 토글 정책은 바꾸지 않는다.
- 종료 시 지도 중심·줌 또는 방금 달린 경로를 임의로 재프레이밍하지 않는다.
- 기존 미커밋 지시86 펄스·지시87 경로창 알약 변경을 되돌리거나 섞어 커밋하지 않는다.

## 구현

- `MapView.tsx`: 기존 `running|paused → idle` 정북 ease 한 번에 `pitch: 0`을 합쳐 결과 시트 뒤 지도를 정북·평면으로 복귀. 중심·줌 hold는 유지하고 카메라 smoothing의 pitch도 0으로 맞췄다. Stop과 자동 도착은 모두 같은 `rideActive` 전이를 쓰므로 종료 원인에 무관하다.
- `quickCameraProductTune.ts`: `isQuickCameraOutdoorsOnly(2..6)` 단일 정책 추가.
- `App.tsx`: 카메라 2~6 선택 즉시 Outdoors(`DEFAULT_MAP_STYLE`)로 전환. 해당 상태에서는 스타일 버튼을 보이는 채 비활성화하고, 콜백에도 Outdoors 방어를 둬 위성 전환을 차단. 카메라 1·미선택은 기존 토글 정책 유지.
- `MapHud.tsx/.css`: 스타일 버튼의 선택적 disabled 계약과 기존 줌 버튼과 같은 비활성 표현 추가.

## 검증

| 항목 | 명령 | 결과 |
|---|---|---|
| 타입·빌드 | `cd C:\20.HDev\boxcycle\apps\web; npx tsc -b --noEmit; npm run build` | PASS (`vite` 대형 chunk 경고만) |
| 카메라 계약 | `npm run test:ride-camera-framing` | 99/99 PASS — QC2~6 Outdoors 전용, QC1·미선택 비잠금 |
| 종료 계약 | `node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/ride-end-north-up/north-up-on-end-contract.test.ts` | 8/8 PASS — 중심·줌 유지 + bearing 0 + pitch 0 단일 ease |
| 진입 셀렉터 | `node scripts/ride-verify/verify-selectors.mjs` | 19/19 PASS |
| lint | 변경 TS/TSX 7개 `npx eslint ...` | 오류 0, 기존 경고 17 |
| 빠른 회귀 | `npm run test:quick` | 제품 범주 1,368 PASS. 별도 `e2e deadline watchdog` 3 FAIL: Windows `taskkill` 접근 거부/20초 대기 및 sentinel 종료. 변경 영역과 무관하며 성공으로 보고하지 않음 |
| 저장소 게이트 | 루트 `check-code-tidy`·`check-dep-direction --check`·`check-document-system`·`git diff --check` | PASS |

실 Firebase/Mapbox를 쓰는 실주행 Playwright는 이번 로컬 검증에서 실행하지 않았다. 종료 전이와 Mapbox `easeTo` 인자를 순수 계약으로 고정했고, 진입 계약·빌드·제품 회귀를 통과했다.

## 상태

LOCAL_VERIFIED / 미커밋·미푸시·미배포.
