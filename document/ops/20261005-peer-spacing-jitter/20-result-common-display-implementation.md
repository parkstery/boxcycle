# RESULT-20 — 공통 600ms 표시 제품 구현

담당: Cursor CLI · 지시: [19-task-common-display-implementation.md](19-task-common-display-implementation.md) · 시각: 2026-10-05  
상태: **IMPLEMENTED_PENDING_REVIEW** · commit/push/배포 **없음**

## 판정

| 항목 | 결과 |
|------|------|
| 제품 경로 공통 D=600 + `tSrv` + self 버퍼 | **구현** |
| BEFORE self-now/peer-past 불일치 고정 | **PASS** — gap1 oppositeSignRate=**1.0** |
| AFTER 창 간 순서(ε0/0, stall 제외) | **PASS** — oppositeSignRate=**0** (gap1/pass/accel/asym/gap15) |
| 송신 주기·FS 주기 상수 | **불변** (`PEER_MOTION_PUBLISH_INTERVAL_MS=200`, FS heartbeat 4s) |
| publish 횟수 증분 | **0** (동일 입력 200 samples/view×pair) |
| `tSrv` encode 증분 | **+21 UTF-8 bytes/encode** (실측) |
| Rules optional `tSrv` | **PASS** (`test:rtdb-rules` 13/13) |
| 기존 peer-spacing gate/transitions | **PASS** |
| 브라우저 실주행 | **미실행** (오프라인 제품 경로 재생으로 대체) |
| S3 static fixture | **미반복** (known-fail 별도; 이번 범위 밖) |

원시 JSON: [common-display-product-metrics.json](common-display-product-metrics.json) · `apps/web/scripts/peer-sync/.out/` 동명

## 1. 변경 파일 (이 작업)

| 영역 | 파일 |
|------|------|
| 시계 | `peerMotion/repo/serverClockOffset.ts` (신규) · `commonDisplayClock.ts` (신규) |
| self 버퍼 | `peerMotion/selfDisplayBuffer.ts` (신규) |
| wire | `repo/rtdbTrailMotion.ts` · `rtdbToPacket.ts` · `types.ts` · `database.rules.json` |
| ingest | `syncFromPresence.ts` (`tSrv` stamp 재정규화 금지) · `integrator.ts` (서버축·고정 D) · `PeerMotionRegistry.ts` |
| 송신 | `ride/liveLocationSnapshot.ts` · `publishLiveLocationFanout.ts` · `rideJoinPresenceBurst.ts` |
| UI | `hooks/useVirtualRideSession.ts` (맵/카메라 delayed self; HUD 즉시) · `PublicationSharedPresence.tsx` (offset 구독) |
| 정책 | `peerSyncPolicy.ts` (`PEER_COMMON_DISPLAY_DELAY_MS=600`) |
| 시험 | `common-display-product-harness.mjs` · `rtdb-rules-contract.test.ts` · `package.json` script · `HARNESS.md` |

**미포함:** focus-read 등 타 작업 untracked. 송신 주기·FS schema 미변경.

## 2. 동작 요약

```text
commonNow = Date.now() + serverTimeOffset   // .info 구독, ref-count
renderTime = commonNow − 600                 // companion only; solo D=0
tSrv = capture 순간 commonNow 추정           // encode 재샘플 금지; 기존 t 유지
self·peer·카메라 좌표 = 동일 renderTime 보간 // HUD/Claim = 즉시
tSrv 있는 RTDB → stamp 재정규화 스킵         // 구버전/FS = 기존 stamp fallback
```

D0↔D600 전환은 self `renderClock` catch-up(±10%/s, resync 5s)으로 순간 점프를 피한다. offset 미준비·uncertain 시 공통 일치로 주장하지 않고 즉시/레거시.

## 3. 검증 명령

| 명령 | exit | 경과 |
|------|------|------|
| `npm run test:rtdb-rules` | 0 | ~1.0s |
| `npm run test:peer-spacing` | 0 | ~19s |
| `npm run test:peer-common-display` (gap15,gap1,pass,accel,asym,stall × ε) | 0 | ~4.8s |
| `npx tsc -p tsconfig.json --noEmit` (관련 경로) | 0 | — |
| `check-dep-direction --check` | 2 | focus-read 미할당 파일 3 (타 작업; 이번 diff 원인 아님) |
| 브라우저 30–60s | 미실행 | — |

## 4. BEFORE / AFTER 증거 (ε0/0, 959 frames)

| 시나리오 | BEFORE opposite | AFTER opposite | AFTER excl near-tie |
|----------|-----------------|----------------|---------------------|
| gap15 | 0 | 0 | 0 |
| gap1 | **1.0** | **0** | 0 |
| pass | 0.267 | **0** | 0 |
| accel | 0 | 0 | 0 |
| asym | 0 | 0 | 0 |
| stall | 0 | 0 | 0 — **정상 신뢰 아님**(짧은 stall·양쪽 동시 한계; 위치 오류 해결로 주장 금지) |

AFTER ε=+100/−100: gap1 opposite 0; pass opposite 0.017 (near-tie 대역, excl 0).

프레임 jump: AFTER maxSelfJumpM ≈ 0.093m (step 양자). accel `maxSpeedDiscMps=2.778`는 진실 속도 20→30 변경분(게이트가 상수 V와 비교) — 표시 튐으로 해석하지 않음.

## 5. 트래픽

| 항목 | 값 |
|------|-----|
| RTDB interval | 200ms **불변** |
| FS heartbeat | 4s **불변** |
| publish count Δ | 0 |
| `tSrv` UTF-8 증분 | **+21 B/encode** (실측; 프레이밍·청구 제외) |
| `.info/serverTimeOffset` | SDK 메타 구독(motion 메시지와 구분) |

## 6. 남은 한계 · 검수 포인트

1. stall/미도착에서 창 간 일치 **비보장** — 불확실만; 3D 위치 수정 주장 금지.
2. offset 미준비·구버전·FS-only는 레거시 경로 — 정확한 공통 표시로 취급 금지.
3. 혼합 버전(한쪽만 `tSrv`)은 self catch-up으로 튐 완화, 완전 일치 비주장.
4. S3 static fixture known-fail **미재실행**.
5. Rules `tSrv`는 **배포 전** RTDB rules 배포 필요(이번 지시에서 배포 안 함).
6. Supervisor: 제품 모듈 diff · BEFORE/AFTER JSON · 주기 상수 diff=0 · Rules 소폭 검수.

## 7. Git

commit / push / merge / 배포: **하지 않음** (지시).
