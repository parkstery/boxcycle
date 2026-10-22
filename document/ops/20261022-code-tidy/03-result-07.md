# 결과07 — P3 반복 통합: 훅·컴포넌트

2026-10-22 · 지시 [02-task-07.md](02-task-07.md) · 6쌍 모두 통합, 합치지 않은 쌍 없음. 동작·export·시그니처 불변.

## 쌍별 결과

줄 수는 `git diff --stat` 기준(+추가/-삭제), 새 파일은 전체 줄 수.

1. **관전 오버레이 훅 ↔ 월드 오버레이 훅** (geometry 적재 루프)
   - 공통부: 새 `apps/web/src/hooks/loadPublicationGeometries.ts` (57줄) — `loadMissingPublicationGeometries()` 와 `PublicationGeomState` 타입. 둘 다 앱 계층(hooks / features)이라 `dep-layers.json` 추가 없음. features → hooks 방향은 기존에도 있었다(타입 import).
   - 월드 쪽의 DEV `console.warn("geometry missing")` 는 `onGeometryMissing` 콜백(예외 경로 제외, 기존과 같은 위치)으로 보존. 로딩 표시→비동기 적재→`setGeomEpoch` 순서, 사라진 id 정리, `scheduled` 일 때 마지막 epoch 증가까지 동일.
   - 줄 수: 두 훅 파일 합계 +19 / -88, 새 파일 +57 → 순감 약 12줄(중복 약 36줄 제거).
2. **AuthSessionGate 안 두 블록** — 같은 파일 안 `GateChoiceActions` 컴포넌트(로그인 / 게스트로 시작 버튼 묶음) 추출. 렌더 결과 DOM 동일. +26 / -30.
3. **useRideResumeSlot ensureAcquired ↔ switchTo** — 같은 파일 모듈 함수 `guardReadySlotOp(ownerMatches, status, safeSlot)` 로 uid 확인 이후의 세 검사(uid_mismatch / not_ready / not_initialized) 통합. `!uid` 검사는 TS 의 uid 좁히기를 위해 각 콜백에 그대로 둠. 검사 순서·반환값·useCallback deps 불변. 순감 약 4줄(+22 / -18 근처, 함수 선언 포함).
4. **useSavedRoutesWorkspace handleRenameSavedRoute** — 두 분기가 각자 하던 `setSavedRoutes` + loaded ref 갱신을 분기 뒤 한 번으로 합침(`let name` 에 두 분기가 대입). 에러 throw 조건·호출 순서 동일. +10 / -19.
5. **usePacerPreference ↔ calorieProfileLocal** (storage 구독부) — `lib/storage` 에 쓸 만한 기존 함수가 없어 새 `apps/web/src/lib/storage/storageEntrySubscription.ts` (28줄) 의 `subscribeStorageEntry()` 를 만들었다. storage 도메인은 아무것도 import 하지 않고, ride·앱 계층이 모두 import 가능. `dep-layers.json` 의 `storage` 배정 목록에 `storage/storageEntrySubscription.ts` **추가만**(엣지 불변). 두 파일 각 +5 / -14 근처(합 약 -18), 새 파일 +28.
6. **MapViewSheet ↔ RideSettingsSheet** (Escape 닫기 effect) — 새 `apps/web/src/components/ui/useEscapeKeyClose.ts` (13줄) 훅. 두 시트 모두 호출 위치를 effect 가 있던 자리 그대로 두어 훅 순서 불변. `useEffect` import 정리. 각 -8 근처.

## 합치지 않은 쌍

없음.

## 검사 (apps/web)

- `npx tsc -b --noEmit` — 출력 없음, exit 0.
- `npx eslint <고친 파일>` — 0 error. 경고 9건은 전부 기존 훅 파일의 기존 exhaustive-deps / unused-disable 경고(원본 두 훅을 임시 복사해 돌리면 11건 → 합친 뒤 9건으로 오히려 감소). 새 react-hooks 위반 없음.
- `node ../../scripts/check-dep-direction.mjs --check` — `방향 위반 0건`, `lib 순환 0쌍`, `[check-dep-direction] baseline 이내 — 통과`.
- `npm run test:quick` (마지막 편집 후 재실행) — `[test:quick] 합계 통과 1341 · 실패 0`. 중간 실행에서 한 번 실패 8건 → 1건 → 0건으로 변했는데, 같은 트리에서 다른 구현자가 동시에 편집한 영향으로 보이며 내 변경분과 무관하게 자연 해소됐다(마지막 실행 모두 통과).

## 파일 목록

- 새 파일: `src/hooks/loadPublicationGeometries.ts`, `src/lib/storage/storageEntrySubscription.ts`, `src/components/ui/useEscapeKeyClose.ts`
- 수정: `src/hooks/useTrailLivePublicationRideSpectatorOverlay.ts`, `src/features/map-overlays/useWorldLivePublicationRideMapOverlay.ts`, `src/components/auth/AuthSessionGate.tsx`, `src/hooks/useRideResumeSlot.ts`, `src/hooks/useSavedRoutesWorkspace.ts`, `src/hooks/usePacerPreference.ts`, `src/lib/ride/repo/calorieProfileLocal.ts`, `src/components/map/MapViewSheet.tsx`, `src/components/ride/RideSettingsSheet.tsx`, `dep-layers.json`(storage 배정 1줄 추가)
- 시험·eslint·knip 설정·baseline 미수정. Playwright 미실행(감리가 `ride-entry` 실행).
