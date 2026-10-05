# 결과 — 단일 재개 슬롯 재작업

| 항목 | 내용 |
|---|---|
| 유형 | execution / rework |
| 날짜 | 2026-10-06 |
| 지시 | [08-task-resume-rework.md](08-task-resume-rework.md) · 검수 [07](07-preliminary-review.md) |
| 상태 | DEVELOPMENT_DONE — 07 지적 코드 반영·검증. 실 Firestore 미검증 |
| Git | 커밋·push·배포 없음(지시) |
| 동시작업 | 칼로리(`caloriesEstimate`·`RideSummarySheet`·`useRideEndAndPersistence` 칼로리 영역) 미수정·보존 |

## 판정

07 항목을 ownership 범위에서 최소 수정했다. 자동 미완주 스캔 acquire 제거, expectedId abandon, TTL no-op 보호, snapshot error·timeout, ready bootstrap, tombstone=ride 기준을 코드로 고쳤다. 실기기 multi-tab·실 Firestore는 미실행.

## 07 대조 (코드 근거)

| 지적 | 조치 |
|---|---|
| eligibility(progress/geometry/owner) | `applyRideResumeSlotTx` — `isResumableProgressFields` + `hasResumableGeometryData` + `userId` |
| initialized no-op TTL | bootstrap already-init / acquire 실패 시 `expiresAt` 미변경. 실제 claim 후에만 `null` |
| abandon expectedId | `expectedRouteId` — 불일치 `expected_mismatch`, 현재 B 유지 |
| clear 고아 TTL | clearIfActive 시 미완주 잔여 문서면 TTL 복구. 삭제 문서 재생성 없음 |
| snapshot error + ready 후 timeout 메시지 | `onError` 전달. timeout은 `statusRef==='loading'`일 때만 error |
| ready 전 bootstrap 금지 | hook `status!=='ready'`면 bootstrap 스킵 |
| bootstrap catch 무시 | 실패 시 `error`+짧은 메시지, `bootstrapAttemptedRef` 리셋 |
| 과거 B auto-acquire | 목록 스캔 effect **삭제**. App `ensureAcquired(lastRideResult)`만 |
| tombstone vs 이름변경 updatedAt | `hasMeaningfulRideAfterTombstone`(ride.endedAt). TTL 복구는 `updatedAtIso` 미변경 |
| 조회실패 vs 삭제 clear | 빈목록/목록미포함 clear 금지. 삭제는 App `clearIfActive` 명시 |
| UID guard | `mountedUidRef`로 비동기 결과 무시 |
| Guest 경쟁 | local CAS + 짧은 lock. 슬롯 키 uid별. global `savedRoutesLocal` 소유 필드 없음 → 한계 기록 |
| hook lint 무더기 disable | `startTransition`·cleanup/비동기 setState로 정리. ownership lint exit 0 |
| App ready guard | `resumeSlotActiveRouteId`는 `status==='ready'`일 때만 |

## 변경 파일 (resume ownership)

- `rideResumeSlotPolicy.ts`, `firestoreRideResumeSlot.ts`, `rideResumeSlotLocal.ts`, `useRideResumeSlot.ts`
- `savedRoutesLocal.ts` (`updateSavedRouteExpiresAtInLocal` — updatedAt 미터치)
- `App.tsx` resume 부분만(칼로리 영역 유지)
- 시험 `scripts/next-ride/ride-resume-slot-policy.test.ts`
- fixture: `scripts/next-ride/resume-slot-ui-fixture*.{html,tsx}`, `capture-resume-slot-ui-fixture.mjs`
- 캡처: `fixtures/resume-slot-ui-740x300.png` (실제 `NextRideCard` Vite 마운트)

## 검증

```text
cd apps/web
node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test \
  scripts/next-ride/ride-resume-slot-policy.test.ts \
  scripts/next-ride/next-ride-target-contract.test.ts \
  scripts/ride-result/ride-result-f2-card-resume.test.ts
# 69 pass / 0 fail, exit 0

npm run test:entry-selectors          # 15/15, exit 0
npm run test:ride-continue-progress   # 4 pass, exit 0
npx tsc -b                            # exit 0 (재작업 끝 재실행)
npx eslint <resume ownership ts> --max-warnings 0   # exit 0
node scripts/next-ride/capture-resume-slot-ui-fixture.mjs  # exit 0 → png
```

App.tsx 전체 eslint는 기존·칼로리 concurrent warning 포함(ownership 밖). 칼로리 파일 미터치.

## UI 740×300

실제 `NextRideCard`+CSS import, Vite fixture 렌더 후 Playwright 캡처. auth 우회·앱 전체 기동 없음. 손코딩 HTML 위장 캡처 폐기.  
증거: `fixtures/resume-slot-ui-740x300.png` — 「20%에서 이어 달리기」·「이어달리기 종료」 표시.

## 한계 (정직)

| 항목 | 상태 |
|---|---|
| 실 Firestore / 실 multi-tab | 미검증 — fake tx·local CAS만 |
| e2e ride-continuation | 미실행 |
| Guest global savedRoutesLocal 소유 분리 | 기존 정책 유지. uid 필드 없음 — 계정전환 섞임 잔여 위험 |
| savedRoutesLoadFailed 배선 | hook optional prop만. workspace 실패 플래그 미연결(빈목록 clear 가드로 완화) |
| React hook 단위 시험 | 없음 — policy/tx + 배선 의존 |

핵심 배선/정책 오류로 보이는 미완은 없음. Supervisor 최종 검수 대기.
