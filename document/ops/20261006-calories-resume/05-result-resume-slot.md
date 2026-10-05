# 결과 — 단일 이어달리기 슬롯

| 항목 | 내용 |
|---|---|
| 유형 | execution |
| 날짜 | 2026-10-06 |
| 지시 | [04-task-resume-slot.md](04-task-resume-slot.md) |
| 상태 | DEVELOPMENT_DONE — pure·배선 완료. 실 Firestore 미검증 |
| Git | 커밋·push·배포 없음(지시) |

## 판정

확정 범위(단일 active routeId · 명시 포기 tombstone · TTL 보호 · Guest local · 공용 재개/Go 가드)를 구현했다. 칼로리·Rules 완화·max progress 변경 없음.

## Policy · schema

`users/{uid}.rideResumeSlot` (versioned):

```ts
{ v: 1, activeRouteId: string | null, initialized: boolean,
  lastProcessedEnd: { routeId: string; at: string } | null }
```

순수 모듈: `apps/web/src/lib/ride/rideResumeSlotPolicy.ts`  
전이: bootstrap / acquire(점유 시 교체 금지) / abandon(tombstone) / clearIfActive(일치 id만) / markInitializedEmpty.

## 원자성 · TTL · Guest

| 축 | 구현 |
|---|---|
| 등록 | `firestoreRideResumeSlot.ts` — `applyRideResumeSlotTx` + `runTransaction`. acquire 시 `savedRoutes.expiresAt=null`, abandon 미완주 시 `now+90d` 복귀. nickname/tier/token 필드 미터치 |
| 경쟁 | 다른 active 있으면 `slot_occupied`. clear는 active===요청 id만 |
| Guest | `rideResumeSlotLocal.ts` — uid별 localStorage + storage event. Firestore users 구독 없음 |
| 등록 실패 | status `error`/`loading`, 성공처럼 abandon/acquire 보고 안 함. local을 서버보다 우선하지 않음 |
| 구독 | 등록 UID당 users onSnapshot 1개 |

## 제품 배선

- `resolveNextRideView({ activeRouteId })` — 슬롯 우선; history 없으면 `slot:` synthetic ride(거리·시간 0). `null`/무효 string이면 파생 resume 우회 금지(extend만). `undefined`는 legacy 테스트 유지
- `resolveRecentRideActions` — `resumeBlocked` + 짧은 안내·활성 경로 확인
- Go offset: `resumeCandidateId === activeRouteId` 일 때만. B 로드는 처음부터 가능
- 「처음부터」·카드 X: 슬롯 유지. 「이어달리기 종료」: NextRideCard·RouteDock 보조 액션
- 완주/삭제 → clearIfActive. 매 주행 후 dismiss reset. geometry 파손·완주 문서 → clear(로딩/빈 목록으로는 해제 안 함)

## 실제 변경 파일

**신규:** `rideResumeSlotPolicy.ts`, `repo/firestoreRideResumeSlot.ts`, `repo/rideResumeSlotLocal.ts`, `hooks/useRideResumeSlot.ts`, `scripts/next-ride/ride-resume-slot-policy.test.ts`  
**수정:** `nextRideTarget.ts`, `App.tsx`, `NextRideCard.tsx`, `RouteDock.tsx`, `UserInfoSheet.tsx`, `savedRoutesLocal.ts`(+expiresAt 헬퍼), `dep-layers.json`

Rules·칼로리·상태보드·결정로그·01~04 ops 문서 미변경.

## 검증 명령 · exit

```text
cd apps/web
node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test \
  scripts/next-ride/ride-resume-slot-policy.test.ts \
  scripts/next-ride/next-ride-target-contract.test.ts \
  scripts/ride-result/ride-result-f2-card-resume.test.ts
# → 59 pass / 0 fail, exit 0

npm run test:entry-selectors          # 15/15, exit 0
npm run test:ride-continue-progress   # 4 pass, exit 0
```

회귀 시나리오(pure/fake tx): A20%·B종료→A유지; B offset block; abandon→A 재bootstrap 금지·이후 B acquire; clearIfActive 일치만; 경쟁 acquire; TTL null/복귀; legacy API `resumeBlocked=false`.

## 한계

| 항목 | 상태 |
|---|---|
| 실 Firestore / multi-tab 실기 | 미검증 — fake tx만 |
| 브라우저 740×300 캡처 · e2e `ride-continuation` | 미실행(지시: 가능하면; 이번은 pure 우선) |
| typecheck 전체 `tsc -b` | 슬롯 관련 수동 확인 수준; 풀 빌드 미실행 |
| 등록 bootstrap 실패 후 같은 세션 재시도 | `bootstrapAttemptedRef`로 1회만 — 다음 세션 재시도 |

production 실데이터·인증 우회 없음. Supervisor 검수·상태보드/결정로그/ops index는 후속.
