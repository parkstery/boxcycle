# RESULT-01 실제 수신 경로 진동 재현

담당: Cursor CLI · 지시: [01-task-investigate.md](01-task-investigate.md) · 시각: 2026-10-05

## 판정

**재현 성공.** 프로덕션 5Hz(200ms)에서 RTDB+FS 이중 소스가 있으면 `stampDualSourceIngestPacket` 이 내용 변화마다 `serverAtMs := nowMs`(수신 시각)로 덮어, 송신 `t` 보간이 무력화된다. 도착 지터·묶음 도착이 그대로 화면 속도 역행·간격 피크-피크로 나타난다. 단일 스트림(FS 없음 → stamp 우회) 동일 입력은 통과한다.

기존 `replay --check` / smoothness / fallback·liveness 는 **이 경로를 안 타서 전부 통과**한다 — 회귀 사각이다.

프로덕션 코드는 수정하지 않았다. 구현은 다음 지시 대기.

## 원인 (코드)

송신 `t` 생성: `encodePayload` → `t: Date.now()` ([rtdbTrailMotion.ts](../../../apps/web/src/lib/peerMotion/repo/rtdbTrailMotion.ts)).

수신 경로:

```text
PublicationSharedPresence
  → syncPeerMotionFromPresence
  → selectPeerMotionPacketForIngest (RTDB-first if local obs fresh)
  → stampDualSourceIngestPacket  ※ 둘 다 있을 때만
  → Registry.ingest → applyPeerMotionIngest → step → render
```

`stampDualSourceIngestPacket` ([syncFromPresence.ts](../../../apps/web/src/lib/peerMotion/syncFromPresence.ts)):

- 핑거프린트 변경 시 `normalizedServerAtMs = nowMs`, 반환 패킷 `serverAtMs: nowMs`
- 동일 내용 재배달·같은 자세 소스 전환은 stamp 유지 (TASK-30C liveness)
- 주석 의도: ±30s 송신 시계 + 소스 전환 시 integrator `clockOffset` 점프 방지

부수효과: integrator 타임라인(`srcAtMs + clockOffset`)이 **수신 도착 시각축**이 된다 → smoothness 계약이 막으려던 「망 지터 = 속도 지터」가 이중 소스에서만 재발.

단일 소스(RTDB만 또는 FS만)는 stamp 분기 자체를 건너뛰어 송신/FS 시각이 그대로 들어간다. 주식 `replay.mjs`·`interp-smoothness-contract` 도 이 경로.

## 실행 명령과 결과 구분

| 묶음 | 명령 | 결과 | 의미 |
|------|------|------|------|
| replay/check | `cd apps/web && node scripts/peer-sync/replay.mjs --check` | **PASS** 19/19 | 단일 병합 스트림 불변식. dual stamp 미포함 |
| smoothness | `node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/peer-sync/interp-smoothness-contract.test.ts` | **PASS** 15/15 | 송신 t 직접 ingest. dual 우회 |
| liveness | 동 로더 `peer-liveness-contract.test.ts` | **PASS** 7/7 | Registry 15s·무src. stamp 축 아님 |
| stamp 단위 | `node --test scripts/peer-sync/rtdb-fs-fallback-source-select.test.mjs` | **PASS** 8/8 | freeze 재배달·±30s 선택. **등속 지터 간격 미측정** |
| fallback both-stop | `node scripts/peer-sync/rtdb-fs-fallback-harness.mjs --suite both-stop` | **PASS** 6/6 | freeze 후 15s 소멸. 지터 없음 |
| **본 재현** | `node scripts/peer-sync/peer-spacing-jitter-harness.mjs` | **FAIL** 42/72 (의도된 수정 전 실패) | 실제 sync→Registry, dual/single 대조 |

JSON 원시: `apps/web/scripts/peer-sync/.out/peer-spacing-jitter-metrics.json`

하네스 추가(프로덕션 무수정): `peer-spacing-jitter-harness.mjs`, HARNESS.md 한 절.

## 재현 행렬 요약

조건: 등속 **20 km/h** (5.556 m/s), FS 행 4s 유지(dual 강제), RTT 140ms, warmup 5s / run 35s.  
임계: spacing peak-peak >1m · screen speed ∉ (0, 2.5×송신] · 역행>0.5m · 텔레포트.

전체: pass 30 / fail 42. dual 실패 24 · single 실패 18. dual+지터 실패 18 · single+지터 실패 12(전부 1000/3000ms 성긴 주기).

### 생산 주기 200ms (핵심)

| mode | jitter | off | min..max m/s | spacePp m | stampNow | pass |
|------|--------|-----|--------------|-----------|----------|------|
| dual | none | 0/±30s | 5.11..5.56 | 0.66 | ~0.99 | ✓ |
| dual | sin | 동일 | 4.00..8.15 | **1.21** | ~0.99 | **✗** |
| dual | bundle | 동일 | **-12.95..13.89** | **1.54** | ~0.99 | **✗** (역행) |
| single | none/sin/bundle | 전부 | 5.00..6.11 | ≤0.26 | 0 | ✓ |

- `stampNow≈0.99`: dual에서 거의 모든 신규 패킷이 수신 now 로 찍힘.
- ±30s 오프셋 셀 **수치가 동일**: 송신 시계는 stamp 뒤 보간에 영향 없음.
- single 대조 통과 → integrator/smoothness 자체 결함이 아니라 **dual stamp**가 차별 요인.

### 100 / 1000 / 3000ms

- **100ms dual+지터**: 임계는 통과하나 dual 속도폭(0.45..13.9) ≫ single(5..6.1). stampNow≈1.
- **1000·3000ms**: dual·single 모두 spacing 실패. single은 속도 대역은 대체로 유지(지연 EMA vs 무지연 self 간격 계측 성분). dual 1000ms는 역행(-13.9), dual 3000ms는 jump≈16.7m 텔레포트 프레임 — stamp+성긴 도착+FS 공존이 악화. **사용자 보고(약 5Hz)와 직접 대응은 200ms 셀.**

## 수정 제안 (구현 금지 · 범위만)

**목표:** 송신 `t`(보간 시간축)와 liveness 관측(수신 로컬)을 분리. 소스 전환 시 시계 점프·freeze 후 15s 소멸은 유지.

최소 변경 후보:

1. `stampDualSourceIngestPacket` 이 integrator 에 넘기는 `serverAtMs` 를 송신/FS 원본으로 두고, Registry liveness 만 수신 관측 시각(`seenLocalMs` / content obs)으로 판정 — **이미** `noteRtdbContentObservation`·`changed` 핑거프린트가 있음.
2. 소스 전환(RTDB↔FS) 때 `clockOffset` 재정렬은 ingest 측에서 Δ만 보정(기존 renderClock 동반 이동)하고, **매 패킷 now 덮어쓰기 금지**.
3. 같은 자세 소스 전환·frozen 재배달 stamp 유지·15s 소멸 계약은 현 unit/both-stop 으로 회귀 고정.

**공용 interface / wire schema / Rules:** 변경 **불필요**. RTDB `t`·FS `lastSeenAt` 유지. 클라이언트 ingest·liveness 내부만. `PeerMotionPacket`에 관측 필드를 명시 분리하면 타입이 조금 넓어질 수 있으나 wire 계약은 동일 → Supervisor가 타입 노출 범위만 확인하면 됨.

**검증:** 본 하네스 dual 200ms sin/bundle 이 PASS로 바뀌고, single·replay·smoothness·both-stop·stamp freeze unit 이 회귀 통과해야 함. known-fail 로 숨기지 말 것.

## 한계

- 실 Firebase RTT/지터 분포는 미계측(사용자 이미지도 지연 수치 미확정). 하네스는 결정적 sin/bundle.
- 간격은 「무지연 self − peer display」. 정상 보간 지연(수백 ms)의 평균 뒤처짐은 spaceMean에 포함; 판정은 peak-peak.
- 1000/3000ms single spacing 실패는 지연 적응 성분 포함 — dual-stamp 재현의 주증거로 쓰지 말 것.
- 두 창 실주행 e2e는 이 단계에서 미실행(지시: 저장소 실행 근거).

## 산출물

- `apps/web/scripts/peer-sync/peer-spacing-jitter-harness.mjs` (신규)
- `apps/web/scripts/peer-sync/HARNESS.md` (절 추가)
- `.out/peer-spacing-jitter-metrics.json` (gitignore 휘발)

다음: Supervisor 검수 → 수정 지시. commit/push 없음(지시 준수).
