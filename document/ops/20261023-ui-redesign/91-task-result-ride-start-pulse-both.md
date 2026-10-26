# 지시·결과 91 — 두 주행 버튼 동시 펄스·거리·방향 탐색 포함

2026-10-26 · Chief 직접 지시(지시90 시험 후 재지시) · Supervisor Claude Code(Opus 5.5) 직접 원인 조사·구현·검증

## 지시

1. 주행 버튼은 우측 하단뿐 아니라 경로 생성 창 안에도 있다. 두 버튼이 함께 펄싱해야 하는데 창 안 버튼은 펄스가 작동하지 않는다.
2. 거리·방향 경로 탐색도 탐색이 끝나면 두 주행 버튼(창 안·우측 하단)이 똑같이 펄싱한다.

## 원인 (실제 App·에뮬레이터로 재현)

지시90의 두 버튼은 펄스를 시작하는 조건이 서로 달랐고, 둘 다 「이미 경로가 있는 채 다시 탐색」하면 펄스가 나지 않았다.

| 버튼 | 지시90 시작 조건 | 깨지는 경우 |
|---|---|---|
| 경로 생성 창 「주행」 | 버튼이 비활성→활성으로 바뀔 때 | 경로가 있는 채 거리·방향으로 다시 찾으면 버튼이 한 번도 꺼지지 않는다 → 펄스 없음 |
| 우측 하단 「주행 시작」 | 새 경로 token 때 클래스 부착 | 5회가 끝나도 클래스가 남는다. 거리·방향 탐색은 `routeLoading` 을 켜지 않아 클래스가 떨어졌다 붙지 않음 → 브라우저가 애니메이션을 다시 틀지 않음 |

재현 기록(수정 전, `animationstart` 이벤트 수집): 출발·도착+자전거 `[corner,popup]`, 수단 변경 `[corner,popup]`, **이어서 거리·방향 탐색 `[]`(둘 다 없음)**. 지시90의 Chief 확인 주소(`preview.html?state=ready`)에는 경로 생성 창이 없어 창 안 버튼을 볼 수 없었다.

## 구현

- `hooks/useRideStartPulseKey.ts` (신규): 새 경로 token 이 생기고 주행을 시작할 수 있게 되는 순간 오르는 **펄스 번호 하나**. 출발·도착, 수단 재탐색, 거리·방향 탐색 모두 새 token 이므로 같은 규칙. 주행 입력이 준비되지 않았으면 준비되는 순간까지 미룬다(눌리지 않는 버튼을 펄싱하지 않음).
- `components/ride/rideStartPulse.ts` (신규): `restartRideStartPulse` — 클래스를 지웠다 붙여 펄스를 처음부터 다시 틀고, 5회가 끝나면(`animationend`) 클래스를 지운다. `stopRideStartPulse` — 누르면 펄스만 멈춤.
- `App.tsx`: `rideStartable`(기존 경로 창 게이트와 동일 식) → `rideStartPulseKey` 를 `RideControlBar.startPulseKey` 와 `MapView.rideStartPulseKey` 에 **같은 값**으로 전달.
- `RideControlBar.tsx`: 자체 `cue` 상태 제거, 번호가 바뀌면 ref 버튼에 공용 펄스.
- `MapView.tsx`·`mapPopupElements.ts`: 활성 전환 펄스 제거, 번호가 바뀌면 열린 경로 창의 `pulseRideStart()`(버튼 동기화 뒤 공용 펄스).
- 애니메이션 모양(0.82초×5회, 1.1배·파란 광륜, 클릭 허용, 모션 감소 시 생략)은 지시90 CSS 그대로.
- 하네스 `scripts/ui-800x360/preview.tsx`·`map-route-runtime.tsx` 도 같은 훅으로 번호를 만든다. 정적 계약 `scripts/ride-verify/entry-contract.mjs` 앵커를 새 구조로 갱신.

## 검증

| 항목 | 결과 |
|---|---|
| 실제 App(에뮬레이터 5021, 임시 시험·삭제함) 연속 탐색 | 출발·도착+자전거 `[popup,corner]` · 수단 보행 `[popup,corner]` · **거리·방향 3km 방향 탐색 `[popup,corner]`** · 거리·방향 수단 자전거 `[popup,corner]` |
| 펄스 도중 창 안 「주행」 클릭 | 클래스 `ride-start-ready-pulse` 상태에서 클릭 → 「일시정지」 표시(주행 시작) |
| 타입 | `npx tsc -b --noEmit` exit 0 |
| lint(변경 8파일) | 오류 0, 경고 17건은 모두 기존 줄(App 8·MapView 9) |
| 셀렉터 계약 | `node scripts/ride-verify/verify-selectors.mjs` 19/19 |
| e2e `route-media-controls ui-redesign-batch2 distance-direction-attention map-route-runtime` | 11 PASS · 1 SKIP · **1 FAIL** — `ui-redesign-batch2` 「카메라 메뉴는 평면 높이와 시점 2~6…」 `카메라 2` 버튼 대기 시간 초과. 지시89 미커밋 카메라 메뉴 변경 쪽 시험으로 펄스와 무관, 손대지 않음 |
| 미실행 | 입력 미준비→준비 순간 펄스는 실제 App 에서 새 게스트가 이미 입력 준비 상태라 재현 못 함 — 하네스 `route-media-controls`(검수 입력 준비 토글)가 이 경로를 통과 |

## 상태

LOCAL_VERIFIED / 미커밋·미푸시·미배포. 지시88~90 및 기존 dirty 보존.
