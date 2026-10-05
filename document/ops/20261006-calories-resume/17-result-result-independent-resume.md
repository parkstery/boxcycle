# 결과 — 결과창과 독립적인 이어달리기 저장

| 항목 | 내용 |
|---|---|
| 유형 | execution / result-independent resume |
| 날짜 | 2026-10-06 |
| 지시 | [16-task-result-independent-resume.md](16-task-result-independent-resume.md) · 정책 [04](04-task-resume-slot.md) · 유지 [15](15-result-integration.md) |
| 상태 | DEVELOPMENT_DONE — 독립 progress 이벤트·큐·시험·UI 캡처. 실 Firestore/실 multi-tab 미실행 |
| Git | 커밋·push·배포 없음(지시) |
| Ownership | resume만. 칼로리(`caloriesEstimate`·`RideSummarySheet`·hook 칼로리 계산 블록) 보존 |

## 판정

Supervisor 지적(결과창 닫힘/`lastRideResult=null` 후 progress 성공 시 슬롯 누락, UID 전환 첫 commit 경합)을 **저장 완료 이벤트를 UI state와 분리**해 해소했다. 04 정책(단일 슬롯·TTL·max progress·bounded retry) 유지.

## 구현 요약

| 요구 | 조치 |
|---|---|
| progress 성공 callback | `PersistRideEndCoreDeps.onSavedRouteProgressApplied` — `userId`·`recordId`·`routeId`·실제 `routeCompleted` |
| 호출 조건 | 서버 progress/promote 성공, Guest `local-*` 성공, Firebase 미구성 local branch 성공 **뒤에만**. save/progress 실패·pending 정리(n/a)에는 호출 금지 |
| UI updater 부수효과 금지 | 이벤트는 `setLastRideResult` 밖 성공 경로에서 emit |
| App 독립 처리 | `pendingProgressAppliedRef` FIFO 큐 + `progressAppliedSeq`. `lastRideResult` effect는 dismiss 리셋만 |
| UID 무시 | 이벤트 `userId` ≠ 현재 uid 필터. 전환 시 큐·processed 정리 |
| slot ready 대기 | `resolveRideEndSlotAction` wait 유지. 최대 3회·400ms retry 유지 |
| 다중 이벤트 | `peekNextProgressAppliedEvent` FIFO — 마지막 덮어쓰기 누락 없음 |
| NextRideCard | 「종료」 보조 링크(`next-ride__abandon`). 풀 폭 3번째 주요 버튼 아님. title/aria「이어달리기 종료」 |

## 변경 파일

- `apps/web/src/lib/ride/rideEndPersistence.ts` — 이벤트 타입·emit
- `apps/web/src/lib/ride/rideResumeSlotPolicy.ts` — `filterProgressAppliedEventsForUid` / `peekNextProgressAppliedEvent`
- `apps/web/src/hooks/useRideEndAndPersistence.ts` — options 배선 + Guest local branch emit (칼로리 계산 미수정)
- `apps/web/src/App.tsx` — 큐·독립 effect (칼로리 파생 표시 유지)
- `apps/web/src/components/ride/NextRideCard.tsx` · `NextRideCard.css`
- `apps/web/scripts/next-ride/result-independent-resume.test.ts` (신규)
- `apps/web/scripts/next-ride/ride-resume-slot-policy.test.ts` — 큐/UID 시험 추가
- fixture: `fixtures/resume-slot-ui-740x300.png` 재캡처

## 검증

```text
cd apps/web
node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test \
  scripts/next-ride/result-independent-resume.test.ts \
  scripts/next-ride/ride-resume-slot-policy.test.ts \
  scripts/next-ride/next-ride-target-contract.test.ts \
  scripts/ride-result/ride-result-f2-card-resume.test.ts \
  scripts/ride-result/ride-result-n2-persistence.test.ts
# 99 pass / 0 fail, exit 0

npm run test:entry-selectors          # 15/15, exit 0
npm run test:ride-continue-progress   # 4 pass, exit 0
npx tsc -b                            # exit 0
npx eslint src/lib/ride/rideEndPersistence.ts \
  src/lib/ride/rideResumeSlotPolicy.ts \
  src/components/ride/NextRideCard.tsx --max-warnings 0   # exit 0
node scripts/next-ride/capture-resume-slot-ui-fixture.mjs  # exit 0 → png
```

controlled Promise 핵심(문자열 검사 대체 아님):

1. 결과 null로 닫힌 뒤 progress resolve → 이벤트 1건 → fake `ensureAcquired` 호출·슬롯 보존
2. progress reject → 이벤트 0 · acquire 미호출
3. UID-A 늦은 성공을 UID-B 세션에서 필터 → acquire 미호출
4. save 실패 → 이벤트 없음
5. 큐 FIFO — r1 처리 후 r2 노출

## 미실행 / 한계

| 항목 | 상태 |
|---|---|
| 실 Firestore progress delay → App effect | 미실행 — controlled Promise + drain 헬퍼로 대체 |
| 실 브라우저 multi-tab | 미실행 |
| React App 마운트 단위 시험 | 없음 — App 효과와 동등 drain + policy 큐 |
| `useRideEndAndPersistence` eslint | `calorieSessionSnapshotRef`/`calorieSignalGapRef` exhaustive-deps warning 1건 — 칼로리 concurrent 영역. 의도적 미수정(deps에 칼로리 ref 추가하지 않음) |
| e2e ride-continuation | 미실행 |

## 칼로리 보존

- `caloriesEstimate` 계산·`RideSummarySheet`·App `lastRideResult?.caloriesEstimate` 파생 미변경
- hook에는 progress callback·Guest local emit만 추가. 칼로리 블록 로직/deps 경고는 손대지 않음

## UI 740×300

재캡처: `fixtures/resume-slot-ui-740x300.png` — 「20%에서 이어 달리기」·「여기에서 계속」이 주요 행, 「종료」는 우측 작은 보조 동작.
