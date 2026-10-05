# 결과 — 최종 통합 결함 4건 보완

| 항목 | 내용 |
|---|---|
| 유형 | execution / integration fix |
| 날짜 | 2026-10-06 |
| 근거 | [14-final-integration-findings.md](14-final-integration-findings.md) · 정책 [04](04-task-resume-slot.md) |
| 상태 | DEVELOPMENT_DONE — 4결함 최소 수정·검증. 실 Firestore/실 multi-tab 미실행 |
| Git | 커밋·push·배포 없음(지시) |
| Ownership | resume만. 칼로리(`caloriesEstimate`·`RideSummarySheet`·`useRideEndAndPersistence` 칼로리 영역) 미수정·보존 |

## 판정

14가 지적한 **실제 결함 4건만** 고쳤다. 앞선 조사 반복 없음. 04 정책(단일 슬롯·TTL·과거 스캔 금지·Rules 비완화) 유지.

## 4결함 대조

| # | 결함 | 조치 |
|---|---|---|
| 1 | `lastRideResult` 직후 `ensureAcquired` — progress pending/서버 0에서 `route_not_resumable` 후 재시도 없음 | App: `resolveRideEndSlotAction`으로 **progress success(또는 n/a) + slot ready/init + ownerUid** 일 때만 acquire/clear. pending→wait(effect 재실행). 성공/`slot_occupied`/`uid_mismatch`만 processed. 오류는 최대 3회·400ms 재시도(무한 poll 금지). uid 전환 시 `lastRideResult` 초기화 |
| 2 | Guest `localStorage` token lock 비원자 | `navigator.locks.request(UID별 exclusive)` + 결과 async. 미지원 시 단일 탭 fallback·`lock_busy`(다중 탭 동시 획득 주장 안 함). TTL 선보호 후 슬롯 CAS 실패 시 TTL rollback |
| 3 | uid 전환 첫 렌더에 이전 active 노출 / 로딩 중 Go offset 0 | hook `slotOwnerUid===uid`일 때만 active/slot 노출. 전환 시 즉시 empty+loading. App: 재개 후보 로드 + status≠ready면 Go 차단·「이어달리기 준비 중」 |
| 4 | `clearIfActive`가 유효 미완주에도 TTL복구·슬롯 삭제 | 서버(또는 local routes)에 유효 미완주면 `route_still_resumable` 거부. 삭제·completed/≥.98·geometry 무효만 해제. 읽기 거절≠삭제(`route_read_denied`). `expectedUid` guard. 경로 삭제는 delete 후 `force: true` clear |

## 변경 파일 (resume ownership)

- `apps/web/src/lib/ride/rideResumeSlotPolicy.ts` — `resolveRideEndSlotAction` / `shouldMarkSlotOpProcessed`
- `apps/web/src/lib/ride/repo/firestoreRideResumeSlot.ts` — clear 검증·expectedUid·force
- `apps/web/src/lib/ride/repo/rideResumeSlotLocal.ts` — Web Locks async·TTL rollback·clear guard
- `apps/web/src/hooks/useRideResumeSlot.ts` — ownerUid·async API·반환형
- `apps/web/src/App.tsx` — progress-gated 슬롯 effect·Go 준비 가드·delete→force clear (칼로리 영역 유지)
- `apps/web/scripts/next-ride/ride-resume-slot-policy.test.ts` — clear/UID/wiring/locks 시험

## 검증

```text
cd apps/web
node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test \
  scripts/next-ride/ride-resume-slot-policy.test.ts \
  scripts/next-ride/next-ride-target-contract.test.ts \
  scripts/ride-result/ride-result-f2-card-resume.test.ts
# 81 pass / 0 fail, exit 0

npm run test:entry-selectors          # 15/15, exit 0
npm run test:ride-continue-progress   # 4 pass, exit 0
npx tsc -b                            # exit 0
npx eslint src/hooks/useRideResumeSlot.ts \
  src/lib/ride/repo/rideResumeSlotLocal.ts \
  src/lib/ride/repo/firestoreRideResumeSlot.ts \
  src/lib/ride/rideResumeSlotPolicy.ts --max-warnings 0   # exit 0
```

추가 시험(14 핵심):

- `resolveRideEndSlotAction`: pending→wait, success→acquire/clear, owner/loading→wait
- fake tx: `route_still_resumable` / completed clear / ≥.98 clear / `uid_mismatch` / `route_read_denied`
- Guest: mock `navigator.locks` 동시 acquire 직렬화(1승·1 `slot_occupied`), clear 거부·force

## 한계 (정직)

| 항목 | 상태 |
|---|---|
| 실 Firestore progress delay → acquire | 미실행 — 배선+fake tx·decision 시험으로 대체 |
| 실 브라우저 multi-tab Web Locks | mock 직렬화만. 미지원 환경은 단일 탭 fallback |
| React hook 단위 마운트 시험 | 없음 — ownerUid/status 계약은 hook 코드+App 배선 |
| Guest `savedRoutesLocal` 전역 소유 분리 | 04 유지. uid 필드 없음 — 계정전환 섞임 잔여 위험(기존) |
| e2e ride-continuation | 미실행 |

## 칼로리 보존

`useRideEndAndPersistence`·`RideSummarySheet`·`caloriesEstimate` import/표시 경로 diff에 손대지 않음. App 칼로리 파생(`lastRideResult?.caloriesEstimate`) 유지.
