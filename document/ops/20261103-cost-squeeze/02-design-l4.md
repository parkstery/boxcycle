# L4 설계 — RTDB가 정상일 때 Trail Firestore 위치 저장 4초 → 12초

작성 2026-11-03 Supervisor Claude Code(Opus 5.5) 직접 · 상태: **Chief 승인(2026-11-04 C1·C2) → 구현·로컬 검증 완료, 미커밋·미배포** · [작업 입구](README.md) · 근거 [01-audit L4·L5](01-audit.md)

## 지금 구조 (코드 확인)

| 누가 보나 | 동행 점이 보이는 조건 | 위치 |
|---|---|---|
| **같은 Trail 동행** | Firestore 행이 15초 안 **또는** RTDB 행이 수신 관측 2.5초 안 | `components/PublicationSharedPresence.tsx:455` `peerVisibleByUid` |
| 같은 Trail 동행(움직임) | RTDB 5Hz 우선, RTDB가 2.5초 끊기면 Firestore로 폴백 | `lib/peerMotion/syncFromPresence.ts` `PEER_MOTION_RTDB_SOURCE_STALE_MS` |
| **관전자**(세계 지도·Trail 관전) | Firestore 행 15초 안 **만** (RTDB를 받지 않는다) | `useWorldLivePublicationRideMapOverlay.ts:226`, `useTrailLivePublicationRideSpectatorOverlay.ts:127` |

`rideSyncPolicy.ts`의 「15초 대비 여유 11초, 8~10초는 거부(TASK-31A)」는 **관전자와 RTDB가 끊긴 경우**에 해당한다. 같은 Trail 동행은 이미 RTDB만으로 보인다.

## 바꿀 것

1. **송신 주기**: `shouldPublishRouteProgress`의 하트비트를 `trailLiveProgressHeartbeatMs(rtdbHealthy)`로 바꾼다. 정상이면 12초, 아니면 4초.
   - `rtdbHealthy`의 판정: `.info/connected`가 참이고, 마지막 RTDB motion 쓰기 응답이 2.5초 안(`rtdbTrailMotion.ts`의 기존 연결 감시를 그대로 쓴다).
   - 초기 쓰기·속도 변화·일시정지/종료·합류 즉시 쓰기는 지금 그대로 둔다(하트비트만 늘린다).
   - RTDB가 끊기면 다음 판정에서 바로 4초로 돌아간다.
2. **관전자 숨김 기준**: 관전 화면 두 곳만 15초 → **30초**(`SPECTATOR_LIVE_RIDE_STALE_MS`, 12초×2 + 여유). 같은 Trail 동행 판정(`PEER_LIVE_RIDE_STALE_MS` 15초 + RTDB)은 그대로 둔다.

## 효과

- Trail 안 Firestore 위치 쓰기가 시간당 900회에서 300회로 준다. 같은 Trail 동행의 Firestore 읽기, 쓰기마다 도는 서버 함수(L5)도 1/3이 된다.
- 1만 명 기준 월 약 $100~210 → $35~70, 함수 $35~100 → $12~35.

## 대가 (Chief 확인 필요)

| # | 무엇이 달라지나 | 제안 |
|---|---|---|
| C1 | **관전자** 화면의 남의 점이 4초가 아니라 12초마다 움직인다. 나간 라이더 점은 최대 30초 남는다(지금 15초) | 수용. 관전은 「어디서 누가 달리나」를 보는 용도다 |
| C2 | 내 RTDB만 끊긴 수신자는 Firestore로 폴백할 때 동행 위치를 12초 간격으로 받는다(보간 대신 외삽이 늘어 덜 매끄러움). 보내는 쪽 RTDB는 정상이라 4초로 돌아가지 않는다 | 수용. 수신 측만 끊기는 경우는 드물고, 동행 점이 사라지지는 않는다 |

## 검증 계획

- peer-sync 재생 하네스: Firestore 12초 + RTDB 정상 → 기존 간격·진동 기준 PASS. RTDB 끊김 주입 → 송신자가 다음 판정에서 4초로 복귀.
- 관전 숨김 시험: 12초 간격 행이 30초 기준에서 깜빡이지 않는다. 15초 기준으로 두면 FAIL(사보타주).
- 에뮬레이터 두 창 동행 e2e(`test:e2e:peer-s1`).
- Chief 2인 실주행 1회(배포 후).

## 구현 결과 (2026-11-04, Claude Code 직접)

| 파일 | 변경 |
|---|---|
| `apps/web/src/lib/ride/rideSyncPolicy.ts` | `TRAIL_LIVE_PROGRESS_HEARTBEAT_RTDB_HEALTHY_MS=12_000`, `RTDB_MOTION_HEALTHY_ACK_WINDOW_MS=2_500`, 순수 `isRtdbMotionHealthy`·`trailLiveProgressHeartbeatMs` |
| `apps/web/src/lib/ride/liveLocationSnapshot.ts` | `shouldPublishRouteProgress(..., rtdbHealthy=false)` — 기본값은 종전 4초 |
| `apps/web/src/lib/peerMotion/repo/rtdbTrailMotion.ts` | `.info/connected` 값·마지막 motion 쓰기 서버 응답 시각 기록, `readRtdbMotionHealthInput()` |
| `apps/web/src/hooks/useLiveLocationPublishSession.ts` | 하트비트 판정에 RTDB 정상 여부 전달 |
| `apps/web/src/lib/trail/trailLivePolicy.ts` | `SPECTATOR_LIVE_RIDE_STALE_MS=30_000` |
| `apps/web/src/lib/trail/repo/firestoreTrailLivePublicationRides.ts` | `isSpectatorLiveRideRowVisible`(관전 30초), 기존 판정은 기본 15초 유지 |
| 관전 훅 2곳 | 관전 판정으로 교체 |
| `apps/web/src/lib/peerMotion/peerSyncPolicy.ts` | **`SPECTATOR_MAX_EXTRAP_MS` 3초 → 13초** — 설계에 없던 추가. 12초 간격에서 「3초 가고 9초 얼었다가 툭」(2026-09-27 증상)을 막는다. 멈춤·속도 변화는 즉시 쓰이므로 과주행은 짧다 |

검증:
- 폴백 하네스(`rtdb-fs-fallback-harness.mjs`): 구현 전에 FS 간격 12초·14초를 먼저 돌렸다 → 12/12 통과, 동행 소멸 없음. **수신 측만 RTDB가 끊긴 경우 최대 점프 4초 1.3m → 12초 45.8m**(C2의 실제 크기). 전체 54/54, 양쪽 정지 6/6.
- `replay.mjs --check` 전 시나리오 통과, `test:peer-spacing` PASS.
- `test:next-ride` 394/0. 하트비트 계약에 L4 시험 3건(12초·기본 4초·정상 판정 5경우), 관전 계약에 L4 조건 4건.
- 사보타주: 관전 외삽을 3초로 되돌리면 관전 계약 FAIL → 복원 PASS.
- web tsc 0·eslint 오류 0(경고는 기존 hook 줄)·test:quick 1485/0·의존 방향·정련 PASS.
- 에뮬레이터 두 창 동행 e2e(`test:e2e:peer-s1`): **미완**.
  - 1회차: 제가 고른 포트 5061이 Chrome 금지 포트(SIP)라 `ERR_UNSAFE_PORT`로 페이지가 열리지 않았다.
  - 2회차(5071): 8케이스 측정 spec이 스위트 제한 560초에 걸려 시간 초과로 끝났다. Functions 에뮬레이터 미기동으로 `ensureRouteTokenOnboardingHttp` 호출 오류가 함께 찍혔는데, 이는 spec 설정 쪽의 기존 문제다.
  - L4와의 관련은 판정하지 못했다. 5분 규칙에 따라 반복하지 않았다.
  - 대체 확인: 배포 전 HEAD(L4 전)에서 같은 spec을 비교 실행하거나, 배포 후 Chief 2인 실주행으로 확인한다.
