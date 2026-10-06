# 결과 05 — 고른 미완주 경로로 이어달리기 대상 교체

- 담당: Developer(Cursor CLI)
- 지시: [02-task-05.md](02-task-05.md)
- 상태: DONE
- 커밋: 없음(지시 금지)
- 범위: `apps/web/` 만. `functions/`·설계 문서 **미수정**.

## 변경 파일 (허용 범위만)

| 파일 | 요약 |
|---|---|
| `lib/ride/rideResumeSlotPolicy.ts` | `resolveResumeSlotSwitchAction`(none/acquire/switch) · `resolveAdhocSaveSlotAcquireAction`(빈 슬롯만 acquire) |
| `hooks/useRideResumeSlot.ts` | `switchTo(routeId)` — switch 시 abandon(게스트 `abandonLocal…` / 등록 `abandonRideResumeSlot`) 성공 후 acquire |
| `App.tsx` | `handleResumeSavedRouteById` 가 `switchTo` · 교체 안내 문구 · ad-hoc 저장 후 빈 슬롯만 `ensureAcquired` · `onResumeSavedRoute` 배선 |
| `hooks/useSavedRoutesWorkspace.ts` | `handleSaveAdhocAsUserRoute` 가 `SavedRoute` 반환(슬롯 확보용) |
| `SavedRoutesPanel.tsx/.css` | `onResumeRoute` · `activeResumeRouteId` · 미완주 「이어 달리기」 · 「이어달리기 중」 배지 |
| `SavedRoutesModal.tsx` | `onResumeRoute` 전달·닫기 |
| `RideRoutePanel.tsx` | `onResumeSavedRoute` · `activeResumeRouteId` |
| `scripts/ride-continue/resume-slot-switch-contract.test.ts` | **신설** — 교체 판정·adhoc 빈슬롯·사보타주 |

## Diff 요약 (지시 05 관련)

```
rideResumeSlotPolicy.ts   | +31 (판정 함수)
useRideResumeSlot.ts      | +108 (switchTo)
App.tsx                   | ~+55 (교체·adhoc 확보·패널 배선)
useSavedRoutesWorkspace.ts| return applied (Promise<SavedRoute>)
SavedRoutesPanel.tsx/.css | onResume + 배지
SavedRoutesModal.tsx      | onResume 닫기
RideRoutePanel.tsx        | props 전달
resume-slot-switch-contract.test.ts | 신설 8 tests
```

## 동작 근거

### 콜백 선택
- `onResumeRoute` 를 **추가**했다. 대기·완주 「열기」는 기존 `onLoadRoute`(슬롯 불변)이고, 미완주만 `switchTo` 후 로드해야 해서 의도 분리가 단순하다.

### 교체
1. `resolveResumeSlotSwitchAction(active, target)` → none / acquire / switch.
2. `switchTo`: none no-op · acquire=`ensureAcquired` · switch=`abandon` 성공 후에만 acquire. 실패 시 `routeSummary` 안내, **로드하지 않음**(처음부터 조용히 떨어지지 않음).
3. 성공(acquire|switch) 시 `이어달리기 대상을 이 경로로 바꿨어요 — N%부터`.
4. 게스트도 `abandonLocalRideResumeSlot` → `acquireLocalRideResumeSlot`.

### ad-hoc 저장
- 미완주 저장 성공 후 `resolveAdhocSaveSlotAcquireAction(active)===acquire` 일 때만 `ensureAcquired`. 이미 대상이 있으면 교체하지 않음.

### UI
- 미완주(`0 < lastProgressRatio < 0.98`) 선택 → 「이어 달리기」. 대기·완주 → 「열기」.
- 슬롯 활성 카드 진행률 줄 오른쪽 `saved-routes__badge--resume` 「이어달리기 중」.

## 검증

| 명령 | 결과 |
|---|---|
| `npx tsc --noEmit -p .` (`apps/web`) | exit 0 |
| eslint 변경 TS 파일 | **1 error / 7 warnings** (`useSavedRoutesWorkspace` setState-in-effect · App exhaustive-deps — **기존**). **증가 0** |
| 단위: `node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/ride-continue/resume-slot-switch-contract.test.ts` | **8 passed** |
| 사보타주: `acquireOnlyNeverSwitch`(점유 시 acquire) vs 실제 `switch` | 계약 it 가 `notEqual` — acquire-only 면 실패. **통과** |
| `npm run test:e2e:ride-continuation` | **FAIL** — 아래 「관련성」 |
| `npm run test:e2e:ride-continue-phase-c` | **FAIL** — Token 온보딩(잔액 null≠10). 슬롯 교체와 무관 |
| `npm run test:e2e:menu-a` | **1 passed** (~14.6s), deadline exit=0 |
| 촬영 e2e (임시 spec → 삭제) | **1 passed** (~10.2s), deadline exit=0, elapsedMs≈39274 |

### e2e 관련성 — ride-continuation
- 실패: `loadSavedRouteFromMenu` 의 `getByRole('button', { name: '열기' }).first()` 가 RouteDock **「센서 설정 열기」** 에 매칭되고, 내 경로 `oc-modal-overlay` 가 클릭을 가로챔.
- RC1 시드 `lastProgressRatio: 0` → 툴바는 여전히 「열기」(이번 교체 로직과 무관).
- **수정 전(지시 05 파일 stash)으로 동일 RC1 재실행 → 동일 실패**(센서 버튼 매칭). → **이번 변경과 무관**.

### 촬영
- 시드: Firestore REST `Bearer owner` → `savedRoutes` A(0.42)·B(0.30) + `users/{uid}.rideResumeSlot` active=A. 게스트 SoT 는 `localStorage` `boxcycle_ride_resume_slot_v1_{uid}` 동시 시드.
- 뷰포트 690×275. 임시 `e2e/zz-tmp-resume-slot-switch-capture.spec.ts` 실행 후 **삭제 완료**.
- 저장: `apps/web/.out/saved-route-integrity/`

| 그림 | file:/// 경로 |
|---|---|
| B 교체 후 RouteDock 30%부터 | `file:///C:/20.HDev/boxcycle/apps/web/.out/saved-route-integrity/03-switch-resume-30pct-dock-690x275.png` |
| 내 경로 B 「이어달리기 중」 | `file:///C:/20.HDev/boxcycle/apps/web/.out/saved-route-integrity/04-switch-badge-active-b-690x275.png` |

## 범위 밖 발견
- `ride-continuation` 헬퍼가 `name: '열기'` 부분 매칭으로 센서 버튼과 충돌 — e2e 수정은 허용 파일 밖이라 미수정.
- `ride-continue-phase-c` Token 잔액 폴링 실패 — 온보딩/에뮬레이터 경합 의심, 본 지시 범위 밖.
- 설계 문서·`functions/` 미수정(지시).
