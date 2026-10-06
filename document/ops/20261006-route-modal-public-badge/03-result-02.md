# 결과 02 — 「공개」 클릭 시 내 경로 창 닫기 · 취소 시 복귀

- 담당: Developer(Cursor CLI)
- 지시: [02-task-02.md](02-task-02.md)
- 상태: DONE
- 커밋: 없음(지시 금지)

## 변경 파일 (허용 범위만)

| 파일 | 요약 |
|---|---|
| `apps/web/src/components/ride/SavedRoutesModal.tsx` | `onOpenPublicRequest` 를 `onLoadRoute` 와 같이 감싸 호출 후 `onClose()`; prop 없으면 `undefined` 유지 |
| `apps/web/src/components/PublicRouteRequestModal.tsx` | 선택 prop `onCancel`; 취소 버튼·오버레이는 `onCancel ?? onClose`, 성공은 기존 `onClose` |
| `apps/web/src/components/ride/RideRoutePanel.tsx` | 선택 prop `reopenSavedSignal`; 값 변경·>0 이면 `setSavedModalOpen(true)` (필터 강제 없음, effect 금지 패턴) |
| `apps/web/src/App.tsx` | `reopenSavedNonce` + `reopenSavedSignal` 전달; 등록 창 `onCancel` 에서 닫기 + nonce 증가 |

금지 파일(`SavedRoutesPanel.*`, `OfficialCourseListModal.*`, `zz-tmp-route-modal-public-badge.spec.ts`)은 수정하지 않음.

## Diff 요약 (지시 02 관련)

```
App.tsx                               | +8 (nonce state, reopenSavedSignal, onCancel)
PublicRouteRequestModal.tsx           | +6/-2 (onCancel / handleCancel)
RideRoutePanel.tsx                    | +10 (reopenSavedSignal prop + 신호 비교)
SavedRoutesModal.tsx                  | +10 (onOpenPublicRequest wrap; 그 밖은 선행 미커밋)
```

`git diff` 기준 `SavedRoutesModal.tsx` 전체에는 검색어 제목 줄 등 **선행 미커밋**이 포함된다. 이번 지시에서 추가한 것은 `onOpenPublicRequest` wrap 블록뿐이다.

## 코드 경로 (동작 근거 · 촬영 생략)

로그인+완주 경로 에뮬레이터 재현이 5분 안에 불가해 **촬영 생략**. Chief 실기 확인 대상.

1. **「공개」 → 내 경로 닫힘**  
   `SavedRoutesPanel` 「공개」 → `onOpenPublicRequest?.(route)`  
   → `SavedRoutesModal` wrap: `panel.onOpenPublicRequest(route); onClose()`  
   → `savedModalOpen=false` 후 App `setPublicRouteRequestModalRoute(route)` 로 등록 창만 표시.

2. **취소 → 내 경로 복귀**  
   등록 창 취소 버튼 / 오버레이 `mousedown` → `handleCancel` = `onCancel`  
   → App: `setPublicRouteRequestModalRoute(null)` + `setReopenSavedNonce(n+1)`  
   → `RideRoutePanel` `reopenSavedSignal` 비교 → `setSavedModalOpen(true)`.  
   (✕/Esc UI는 등록 창에 원래 없음 — 추가하지 않음.)

3. **등록 성공 → 내 경로 재오픈 없음**  
   `handleSubmit` 성공 시 `props.onClose()` 만 호출 → nonce 증가 없음.

## 검증

| 명령 | 결과 |
|---|---|
| `npx tsc --noEmit -p .` (`apps/web`) | exit 0, 에러 0 |
| eslint 변경 4파일 | 에러 0. 경고: `App.tsx` 7건(모두 기존 `react-hooks/exhaustive-deps`, 지시 변경 줄과 무관). 나머지 3파일 0. **증가 0** |
| `netstat -ano \| findstr ":8080 "` | 시작 시 LISTENING 있었음 → 대기 후 즉시 FREE(09:09:26) |
| `npm run test:e2e:menu-a` | **1 passed** (15.5s), deadline exit=0, elapsedMs≈44802 |

## 범위 밖 발견

- 등록 창에 Esc/✕ 핸들러는 없음(지시: 있으면 연결).
- 다시 열린 내 경로의 선택·필터·스크롤 복원은 지시대로 범위 밖(초기 상태 오픈).
- `SavedRoutesModal.tsx` 에 지시 01/선행 미커밋(검색 UI)이 이미 있어 HEAD 대비 diff 에 함께 보임 — 이번 지시로 그 부분을 손대지 않음.
