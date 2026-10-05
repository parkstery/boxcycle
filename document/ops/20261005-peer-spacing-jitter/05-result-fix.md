# RESULT-02 수신 시간축 복구

담당: Cursor CLI · 지시: [04-task-fix-and-two-view-plan.md](04-task-fix-and-two-view-plan.md) · 시각: 2026-10-05  
승인용 두 창 계획: [06-plan-two-view-consistency.md](06-plan-two-view-consistency.md)

## 판정

**수정 완료(생산 주기).** `stampDualSourceIngestPacket` 이 동일 source 동안 송신(native) Δt 를 보존하도록 바꿨다. 200ms dual sin/bundle 안정 구간이 single 수준으로 회복됐다(간격 pp ≤0.259m, 속도 5..6.11 m/s).  
3000ms 셀은 `PEER_MOTION_RTDB_SOURCE_STALE_MS=2500` 과의 정책 충돌로 **policyConflict** 로만 보고하며 all-pass 로 주장하지 않는다. commit/push 없음.

## 변경 요약

| 파일 | 내용 |
|------|------|
| `apps/web/src/lib/peerMotion/syncFromPresence.ts` | dual stamp: source별 `native+offset`, source 전환·최초만 now 정렬, frozen/같은자세 전환 stamp 유지, **인과 클램프**(stamp≤now) |
| `apps/web/scripts/peer-sync/peer-spacing-jitter-harness.mjs` | FS 미래좌표 금지, 도착마다 sync, 시작/안정 구간 분리, 반올림 없는 displayDistM, no-seq 셀, `--graph`, 3000ms policyConflict |
| `rtdb-fs-fallback-source-select.test.mjs` | Δt 보존·freeze 유지 계약 갱신 |
| `scenarios.mjs` / `HARNESS.md` | stock replay 이중소스 사각 문서화 + 본 하네스 필수 게이트 |

공용 wire/API/Rules/송신주기/타입 확대 없음.

### stamp 계약 (복구 후)

1. 동일 source: `normalized = native + offset` (매 패킷 now 재지정 금지)
2. source 전환·최초: `offset = now - native`, `normalized = now`
3. frozen 재배달·같은 자세 소스 전환: stamp 유지 (TASK-30C liveness)
4. `normalized > now` 이면 now 로 클램프하고 offset 재앵커 (낡은 FS 진입 후 native 점프 시 clockOffset 붕괴 방지)

## 전후 수치 (안정 구간 · off=0)

수정 전 원본 보존: [peer-spacing-jitter-metrics-pre-fix.json](peer-spacing-jitter-metrics-pre-fix.json)  
수정 후: [peer-spacing-jitter-metrics-post-fix.json](peer-spacing-jitter-metrics-post-fix.json) · PNG: `apps/web/scripts/peer-sync/.out/peer-spacing-jitter.png`

| cell | PRE spd m/s | PRE spacePp | POST spd | POST spacePp |
|------|-------------|-------------|----------|--------------|
| dual 200 sin | 4.00..8.15 | **1.21m** FAIL | 5.00..6.11 | **0.26m** PASS |
| dual 200 bundle | **-12.95..13.89** | **1.54m** FAIL | 5.00..6.11 | **0.02m** PASS |
| single 200 sin | 5.00..6.11 | 0.26m PASS | 5.00..6.11 | 0.26m PASS |
| dual 100 sin | 3.75..9.17 | 0.70m | 5.00..6.11 | 0.15m PASS |
| dual 1000 sin | -13.9..13.9 | 13.6m | 5.00..6.11 | 6.71m (pp는 적응지연 vs 무지연 self; 속도·역행 게이트 PASS) |
| dual 3000 none | 0..1000 | 17.2m | policyConflict (interval>2500 stale) | — |

목표(200ms dual ≈ single, pp≤0.5m, 속도±20%): **충족.**  
시작 구간(0–5s) 적응/첫 패킷 점프는 별도 기록하며 warmup 으로 PASS 숨기지 않음.

## 검증 명령과 결과

| 명령 | 결과 |
|------|------|
| `node scripts/peer-sync/peer-spacing-jitter-harness.mjs --graph` | **requiredFail=0**, policyConflict=18 (전부 3000ms), dual200MaxPp=0.259 |
| `node scripts/peer-sync/replay.mjs --check` | **PASS** 19/19 |
| `node --test scripts/peer-sync/rtdb-fs-fallback-source-select.test.mjs` | **PASS** 8/8 |
| `node scripts/peer-sync/rtdb-fs-fallback-harness.mjs` | **PASS** 54/54 (fallback+both-stop) |
| smoothness + liveness + motion-flight (`--experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test …`) | **PASS** 29/29 |
| `npx eslint src/lib/peerMotion/syncFromPresence.ts` | **PASS** exit 0 |
| `npx tsc --noEmit` (apps/web) | **PASS** exit 0 |

## 3000ms / 미해결 분리

- **원인:** 송신 주기 3000ms > RTDB source-stale 2500ms → 정상 순항 중에도 FS 폴백이 반복될 수 있음. 지연 상한(`PEER_INTERP_DELAY_MAX_MS=3000`)과도 맞물림.
- **이번 수정으로 해결하지 않음.** 전송 상수·정책을 늘려 억지 PASS 하지 않음.
- **별도 해결 필요:** stale/지연 상한과 발행 주기의 제품 정책(Supervisor/Chief), 또는 3s 발행을 지원 범위 밖으로 명시.

## 한계·범위 밖

- 실 Firebase RTT 분포 미계측(결정적 sin/bundle).
- 1000ms 간격 pp는 적응형 지연이 무지연 self 대비 평균 뒤처짐을 키운 성분 포함 — stamp 회귀의 주증거는 200ms dual↔single 대칭.
- 두 창 순서 불일치는 **제품 표시 정책을 바꾸지 않음.** 분석·권고만 [06](06-plan-two-view-consistency.md).
- Git: commit/push/merge/배포 금지 준수.
