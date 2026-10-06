# 결과 11 — 카메라 1번: 경로전체/500m/20m · 위성 기본

- 담당: Developer(Cursor CLI) · 지시: `02-task-11.md`
- 판정: **DEVELOPMENT_DONE** · 커밋·푸시 없음
- worktree / `git restore` / `git clean` / stash / `.env*`: **미사용·미수정**
- 병행 06-4 금지 파일(`MapView.css`·`NextRideCard.css`): **미수정**

## 스타일 규칙 (구현·결과 명시)

| 상황 | 동작 |
|---|---|
| 다른 카메라(또는 없음) → **1번 진입** | 맵 스타일을 Satellite 로. 진입 직전 스타일을 ref 에 기억 |
| **1번 안 순환**(R↔500↔20) | 맵 스타일 덮지 않음(사용자 「야외」 토글 존중) |
| 1번 안에서 사용자가 스타일 토글 | `userToggled` 플래그. 이탈 시 **복원하지 않고** 그 선택 유지 |
| 1번 → 다른 카메라 **이탈** | 토글 없었으면 진입 직전 스타일 복원 |

순수 함수: `resolveCamera1EnterMapStyle` / `resolveCamera1ExitMapStyle` (`camera1Mode.ts`).

## 순환·거리

- 모드: `routeFit` → `aerial500`(500m) → `aerial20`(20m) → `routeFit`
- 표식: `R` / `500` / `20`
- 옛 식별자 `aerial200`·`aerial60`·`aerial5`: `normalizeCamera1Mode` → `routeFit`(사보타주 시험 포함)

## 변경 파일

| 파일 | 내용 |
|---|---|
| `apps/web/src/lib/camera/camera1Mode.ts` | 3단 순환·거리·META·레거시 이관·스타일 진입/이탈 |
| `apps/web/src/App.tsx` | QC1 순환·위성 진입/이탈·HUD 줌 soft-max 500·토글 플래그 |
| `apps/web/src/lib/debug/rideCameraLab.ts` | lab 거리 슬라이더 max 500(500m preset 정합) |
| `apps/web/scripts/ride-camera-framing/camera1-mode-contract.test.ts` | 순환·거리·스타일·레거시·옛 4단 사보타주 |
| `apps/web/e2e/camera-angle-candidates.spec.ts` | `aerial500`/`aerial20` assert |
| `apps/web/e2e/camera-quick-capture.spec.ts` | 샷 파일명 갱신 |
| `document/ops/.../shots-11/` · `03-result-11.md` | 증거·본 결과 |

`MapHud.tsx`: META import 만으로 표기 갱신 — **파일 수정 없음**.

## 검증

| 명령 | exit | 결과 |
|---|---|---|
| `cd apps/web && npx tsc -b --noEmit` | 0 | **0** |
| eslint `camera1Mode.ts`·`App.tsx`·`MapHud.tsx`·`rideCameraLab.ts` | 0 | **0 errors**(기존 hooks warning 7건, 증가 0) |
| `npm run test:ride-camera-framing` | 0 | **96 passed**(camera1 계약 + framing) |
| `npm run test:e2e:menu-a` | 0 | **1 passed** (~14s) |
| `npx playwright test camera-quick-capture` (functions 에뮬) | 0 | **1 passed** (~45s) |
| 임시 `_tmp-camera1-presets-11` | 0 | **1 passed**. 실행 후 **삭제** |

## 촬영 `shots-11/` (690×275)

`metrics.json`: 진입 전 `야외` → 진입 후 `위성` → cam2 이탈 후 `야외`(`restoredToBefore: true`).

| 장면 | file:/// |
|---|---|
| 1번 진입 routeFit+위성 | file:///C:/20.HDev/boxcycle/document/ops/20261006-camera1-presets/shots-11/01-enter-routefit-satellite.png |
| aerial500 | file:///C:/20.HDev/boxcycle/document/ops/20261006-camera1-presets/shots-11/02-aerial500.png |
| aerial20 | file:///C:/20.HDev/boxcycle/document/ops/20261006-camera1-presets/shots-11/03-aerial20.png |
| 순환 routeFit | file:///C:/20.HDev/boxcycle/document/ops/20261006-camera1-presets/shots-11/04-cycle-routefit.png |
| cam2 이탈·스타일 복원 | file:///C:/20.HDev/boxcycle/document/ops/20261006-camera1-presets/shots-11/05-exit-cam2-style-restored.png |
| 계측 | file:///C:/20.HDev/boxcycle/document/ops/20261006-camera1-presets/shots-11/metrics.json |

참고: e2e `stubMapboxStyle` 이라 타일 위성 영상은 안 보이고, HUD 라벨·모드 attribute 로 검증. 690×275 에서 QC 칩 hit-test 겹침(병행 06-4 레이아웃)이 있어 촬영만 DOM `click()` 사용.

## 범위 밖·잔여

1. 역사 e2e `camera-qc1-200m` / `camera-qc1-hold` 샷 파일명은 옛 단계 표기 잔존(LIVE skip 기본). 본 지시 필수 스위트 아님.
2. `rider-detail-lod-contract` 의 `aerial5/60/200` 은 **LOD 실측 zoom 라벨**(Camera1Mode 아님) — 미변경.

## Git

커밋·푸시 **하지 않음**.
