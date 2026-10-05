# RESULT-27 — 잔여 peer 앞뒤 튐 (FS 축 전환)

담당: Cursor CLI · 지시: [26-task-residual-peer-jitter.md](26-task-residual-peer-jitter.md) · 시각: 2026-10-05  
상태: **DEVELOPMENT_DONE_PENDING_REVIEW** · commit/push/배포 **없음**

Chief 확인 구분: **교차창 동기화 APPROVED_BY_CHIEF** · **smoothness FAIL→이번 수정 후보**(검수 대기).

## 판정

| 항목 | 결과 |
|------|------|
| BEFORE 저속 dual RTDB/FS 제품경로 재현 | **확보** — `rtdbStallFs` axisFlip=2 · peerJump≈3.18m · vel≈191 m/s |
| 좁은 수정 | **`bridgeFsPacketToServerTimeline`** — FS 폴백에 직전 RTDB `tSrv` 축 연속 |
| D600 / RTDB200 / FS4s | **불변** |
| residual smoothness gate | **추가** · mutation PRE FAIL→POST PASS |
| READY_FOR_REVIEW | **후보** — Supervisor 검수 |

원시: [before](residual-peer-jitter-metrics-before.json) · [after](residual-peer-jitter-metrics-after.json) · [mutation](residual-peer-jitter-mutation-compare.json)

## 1. BEFORE 최소 재현

하네스 `residual-peer-jitter-harness.mjs`: encode/`tSrv`/stamp/ingest/frame/`raw displayDistM` + dual RTDB200+FS4s + common D600.

| 시나리오 | residualPp | peerJump | axisFlip | 비고 |
|----------|------------|----------|----------|------|
| low5v6 (5vs6) | 0.111m | 0.033m | 0 | 정상 저속 — 순서 residual 양호 |
| cruise20 | 0 | 0.1m | 0 | |
| pauseResumeLow | 0.256m | 0.063m | 0 | |
| **rtdbStallFs** | **3.156m** | **3.181m** | **2** | **결함** |
| lateBundle | 0.111m | 0.033m | 0 | |

원인(코드 증거): FS wire에 `tSrv` 없음 → FS 폴백 ingest 시 `serverTimeline↔legacy` 전환 → integrator 버퍼 clear/rebase → 수 m 점프·프레임 속도 폭주. 정상 RTDB 신선 구간에서는 FS 미선택이라 low5v6만으로는 안 터짐.

## 2. 수정

| 파일 | 내용 |
|------|------|
| `syncFromPresence.ts` | `bridgeFsPacketToServerTimeline` + `lastServerCaptureByUid`. FS 선택·무 tSrv·직전 RTDB 서버축 있을 때만 거리연속으로 `tSrv` 부여. 없으면 기존 legacy fallback 유지 |
| `index.ts` | bridge export |
| `residual-peer-jitter-harness.mjs` | 저속 dual 제품경로 · residual(=displayGap−truthGap) · jump/axis 게이트 |
| `residual-peer-jitter-mutation-failcheck.mjs` | bridge identity 변이 → FAIL 증명 |
| `rtdb-fs-fallback-source-select.test.mjs` | bridge 단위 시험 |
| `package.json` / `HARNESS.md` | `test:peer-residual-jitter` · `test:peer-spacing` 체인 포함 |

보존: D600, HUD 즉시, solo0, snap/tolerance 완화 없음, 송신 주기·구독 횟수 증가 없음, FS 무시 아님.

## 3. AFTER / gate

| 시나리오 | BEFORE jump/axis | AFTER jump/axis | residualPp(게이트) |
|----------|------------------|-----------------|-------------------|
| rtdbStallFs | 3.181m / **2** | **0.058m / 0** | 공백 제외 0 (공백 중 residualPpAll≈1.2m = FS4s 성김 **한계 보고**) |
| low5v6 등 | PASS | PASS | ≤0.256m |

mutation: bridge 무력화 시 `axisFlip=2`·`peerJump=3.181m` FAIL → 복원 PASS (`gateAlive: true`).

## 4. 검증 명령

| 명령 | exit | 경과 |
|------|------|------|
| `node scripts/peer-sync/residual-peer-jitter-harness.mjs` | **0** | ~4.2–5.3s |
| `node scripts/peer-sync/residual-peer-jitter-mutation-failcheck.mjs` | **0** | ~PRE+POST |
| `npm run test:peer-spacing` (gate+transitions+residual) | **0** | ~27s |
| `node --test …/rtdb-fs-fallback-source-select.test.mjs` | **0** 9/9 | ~3.7s |
| `node scripts/peer-sync/rtdb-fs-fallback-harness.mjs` | **0** 54/54 | (묶음) |
| `npm run test:peer-common-display` | **0** | ~6.8s |
| `npx tsc -b` (`apps/web`) | **0** | ~30s |
| eslint `syncFromPresence.ts`·`index.ts` | **0** | |
| `npm run test:rtdb-rules` | **0** 13/13 | regex 계약 |

트래픽 상수 불변: `PEER_MOTION_PUBLISH_INTERVAL_MS=200`, `TRAIL_LIVE_PROGRESS_HEARTBEAT_MS=4000`, `PEER_COMMON_DISPLAY_DELAY_MS=600`.

## 5. 한계

1. RTDB 공백 중 FS 4s 성김 → 외삽/hold residual(~1m대)은 **stall 한계** — 정상 신뢰 smoothness 로 주장하지 않음. 게이트는 축전환 점프.
2. oneWayStall·clockJump 기존 한계 보존.
3. 브라우저 2창 실주행 재확인은 사용자(아래). 에이전트는 오프라인 제품경로.
4. 타 작업(focus-read 등) 파일 미수정.
5. commit/push/deploy 없음.

## 6. 사용자 재시험 (각 10–15초, 양쪽 같은 새 코드)

| 항목 | 값 |
|------|-----|
| path | `C:\20.HDev\boxcycle` · branch `fix/peer-spacing-jitter` |
| 시작 | `cd apps/web; npm run dev` → `http://127.0.0.1:5000/` (또는 기존 5010) |
| 절차 | 두 독립 프로필 · 같은 Trail · 저속 5–6km/h → 등속 → 정지/resume 각 10–15초 |
| 기대 | 순서 유지(기존) + peer 앞뒤 수 m 급 튐 감소(특히 상대 일시 끊김/복구 근처) |
| HUD | 실제 속도/거리 즉시 · 표시만 D600 |

오프라인 재현: `cd apps/web && npm run test:peer-residual-jitter`
