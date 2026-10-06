# 결과 04 — 「내 경로로 저장」 진행률 기록 · 미완주 UI

- 담당: Developer(Cursor CLI)
- 지시: [02-task-04.md](02-task-04.md)
- 상태: DONE
- 커밋: 없음(지시 금지)
- 범위: `apps/web/` 만. `functions/` 미수정(지시 03 병행).

## 변경 파일 (허용 범위만)

| 파일 | 요약 |
|---|---|
| `apps/web/src/hooks/useSavedRoutesWorkspace.ts` | `LastEndedAdhocState`에 `progressRatio`·`completedRoute`; `handleSaveAdhocAsUserRoute` 가 promote/progress 분기·서버 반환값으로 목록 갱신·미완주 문구 |
| `apps/web/src/lib/ride/rideEndPersistence.ts` | ad-hoc 컨텍스트에 `progressToSave`·`rideCompletedRoute` 그대로 적재 |
| `apps/web/src/hooks/useRideEndAndPersistence.ts` | 로컬(비 Firebase) ad-hoc 동일 |
| `apps/web/src/lib/route/adhocSaveAsUserRoutePolicy.ts` | **신설** — `resolveAdhocSaveServerAction` / `resolveAdhocSaveAppliedState` |
| `apps/web/scripts/ride-continue/adhoc-save-as-user-route-contract.test.ts` | **신설** — 30%/99%/완주유지/60%유지 + 사보타주 계약 |
| `apps/web/src/components/ride/SavedRoutesPanel.tsx` | 미완주 진행률 상시 표시 · 선택 시 「이어 달리기」 · 빈 목록 90일 문구 |
| `apps/web/src/components/ride/SavedRoutesPanel.css` | 진행률 바 주석만(선택 전제 제거) |

## Diff 요약

```
useSavedRoutesWorkspace.ts     | +96/-29  (타입·저장 분기·문구)
rideEndPersistence.ts          | +2
useRideEndAndPersistence.ts    | +2
adhocSaveAsUserRoutePolicy.ts  | 신설 (~60줄)
adhoc-save-as-user-route-contract.test.ts | 신설
SavedRoutesPanel.tsx           | +21/-  (진행률·라벨·90일)
SavedRoutesPanel.css           | 주석 1줄
```

## 동작 근거

### A — 저장 시 진행률
1. 종료 시 `setLastEndedWasAdhoc` 두 지점(`persistRideEndCore` · `useRideEndAndPersistence` 로컬 분기)이 기존 `progressToSave`·`rideCompletedRoute` 를 싣는다(새 계산 없음).
2. `handleSaveAdhocAsUserRoute`: `resolveAdhocSaveServerAction` → 완주면 `promoteSavedRouteInFirestore`, 아니면 `updateSavedRouteProgressInFirestore`(transaction·낮추지 않음·completed 유지). 로컬 state 는 서버 반환값 기준(§5와 동일).
3. **`rideId` null**: 진행률·promote 호출은 수행하고 `rideIdForWrite = rideId ?? ""` 로 전달(기존 promote 와 동일). `updateSavedRouteProgressInFirestore` 는 `shouldWrite` 일 때만 `lastRideId` 를 덮는다. 로컬 목록의 `lastRideId` 는 null 이면 기존 값 유지.
4. 미완주 완료 문구: `내 경로에 저장했습니다 — 미완주 NN%, 다음에 이어 달릴 수 있어요.`

### B — 미완주 찾기
1. `completed!==1 && lastProgressRatio>0` 이면 선택 여부와 무관하게 진행률 바/라벨 표시. 대기(0%)는 숨김.
2. 선택 미완주 → 툴바 라벨·`title` 「이어 달리기」(동작은 기존 `onToolbarOpen` → `handleLoadSavedRoute`).
3. **재개 근거**: `handleLoadSavedRoute` 가 `loadedSavedRouteProgressRef.current = route.completed !== 1 && Number.isFinite(route.lastProgressRatio) ? clamp(route.lastProgressRatio) : 0` 설정(`useSavedRoutesWorkspace.ts`). 종료 시 `previousProgressRatio`·`progressToSave` 가 이 ref 를 사용.
4. 빈 목록: 「미완료 경로는 90일 후 자동 삭제」(`SAVED_ROUTE_EXPIRY_MS` = 90일).

## 검증

| 명령 | 결과 |
|---|---|
| `npx tsc --noEmit -p .` (`apps/web`) | exit 0 |
| eslint 변경 TS 파일 전/후 | **전 1 / 후 1** (`useSavedRoutesWorkspace` `setSavedRoutes([])` in effect — 기존). **증가 0**. 신설 policy 0 |
| 단위: `node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/ride-continue/adhoc-save-as-user-route-contract.test.ts` | **5 passed** |
| 사보타주: `resolveAdhocSaveServerAction` 를 무조건 `promote` 로 잠시 교체 후 동일 테스트 | **3 failed**(30%·완주재저장 action·사보타주 it) → **원복 후 5 passed** |
| `npm run test:e2e:menu-a` | **1 passed** (~18s), deadline exit=0 |
| 촬영 e2e (임시 spec → 삭제) | **1 passed** (~10s), deadline exit=0, elapsedMs≈40596 |

### 촬영
- 시드: Firestore REST `Authorization: Bearer owner` → `savedRoutes` 문서 `lastProgressRatio: 0.42`, `completed: 0`.
- 뷰포트 690×275. 임시 `e2e/zz-tmp-saved-route-incomplete-ui.spec.ts` 실행 후 **삭제 완료**.
- 저장: `apps/web/.out/saved-route-integrity/`

| 그림 | file:/// 경로 |
|---|---|
| 미선택·진행률 42% 상시 | `file:///C:/20.HDev/boxcycle/apps/web/.out/saved-route-integrity/01-incomplete-progress-unselected-690x275.png` |
| 선택·「이어 달리기」 | `file:///C:/20.HDev/boxcycle/apps/web/.out/saved-route-integrity/02-incomplete-resume-label-690x275.png` |

## 범위 밖 발견
- 지시 03이 이미 `functions/`(`autoReviewPublicRouteRequest.ts` 등)를 수정 중 — 본 지시에서 건드리지 않음.
- 잘못 「완주」로 저장된 기존 데이터 복구(C안)는 Chief 미승인·범위 밖(묶음 README).
- `test:ride-continue-progress` npm 스크립트에는 신설 테스트 파일을 넣지 않음(허용 파일 밖 `package.json`). 실행은 위 `node --test …` 명령으로 수행.
