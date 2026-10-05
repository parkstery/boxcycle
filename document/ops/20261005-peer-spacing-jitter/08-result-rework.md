# RESULT-03 재작업 A/B · 계획 C

담당: Cursor CLI · 지시: [07-review-and-rework.md](07-review-and-rework.md) · 시각: 2026-10-05  
승인용 계획: [09-plan-common-timeline.md](09-plan-common-timeline.md)  
06 원본 보존. commit/push/merge/배포 없음.

## 판정

| 항목 | 판정 | 비고 |
|------|------|------|
| A1 게이트 연결 + mutation FAIL 증명 | **PASS** | `test:peer-spacing` → pre-push. 변이 시 gate exit 1 |
| A2 RTDB↔dual↔FS 전환·±30s·no-seq | **PASS** (수정 후 full) | 전환 7/7. 발견 결함은 최소 내부 수정으로 해소 |
| A3 1s pp 제외 이유·지연 수렴 | **보고 완료** | 6.71m를 안정 간격으로 승인하지 않음 |
| A4 같은 fixture PRE/POST | **PASS** | rework-pre/post/compare JSON |
| B 두 창 재생·수치 | **측정 PASS** | 제품 표시 정책 미변경 |
| C 승인용 계획 | **작성** | `09-plan-common-timeline.md` |

수신 stamp(TASK-02) + 단일 소스 stamp 유지(TASK-03 A2)는 게이트·전환·fallback 회귀를 통과했다.  
**창 간 순서 일치 제품 구현은 미착수** — 09 승인 대기.

## 변경 요약

| 파일 | 내용 |
|------|------|
| `syncFromPresence.ts` | **A2 최소 수정**: 단일 소스도 `stampDualSourceIngestPacket` 적용. 단일 소스 탈락 시 stamp 맵 삭제 제거(RTDB-only→dual +30s clockOffset 붕괴 방지) |
| `peer-spacing-jitter-harness.mjs` | `--gate` · `--suite transitions` · `--suite delay` · 지연 수렴 지표 |
| `peer-spacing-mutation-failcheck.mjs` | 신규 — stamp 함수만 변이→FAIL 확인→복원→POST |
| `two-view-order-harness.mjs` | 신규 — 독립 Vite 모듈 그래프 2개 두 창 재생 |
| `package.json` | `test:peer-spacing` · `:mutation` · `test:peer-two-view` |
| `githooks/pre-push` | web 변경 시 `test:peer-spacing` 호출(mutation/two-view 제외) |
| `HARNESS.md` | 실제 게이트·pp 제외 이유·전환 수정 기록 |

공용 wire/API/Rules/송신주기/카메라·HUD·self 표시 정책 **미변경**.

## A1 — 자동 게이트

```bash
cd apps/web && npm run test:peer-spacing
# = --gate && --suite transitions
```

게이트 셀: dual 200 × off ±30s/0 × none/sin/bundle + single 200 sin + no-seq.  
3000ms는 게이트에 없고 policyConflict를 성공으로 부르지 않는다.

### mutation 생존 증명

| 명령 | exit | 내용 |
|------|------|------|
| `npm run test:peer-spacing:mutation` | **0** | 변이 중 gate **exit 1** (requiredFail=8) → 복원 해시 일치 → POST gate exit 0 |

변이(내용 변경마다 `serverAtMs=nowMs`)는 dual sin/bundle·single·no-seq를 실제로 FAIL시킨다. none 지터만 도착축 영향이 없어 PASS(의도).

## A2 — 소스 전환

전환 시퀀스(실제 sync→Registry): RTDB-only → dual → FS-only → dual again.  
±30s × frozen/cleared + no-seq = 7셀.

### 발견·수정 (GATE → full PASS)

| 증상 | 원인 | 수정 |
|------|------|------|
| +30s 송신시계에서 RTDB-only→dual 진입 시 속도 0~13.9 m/s, peer 선행 ~5m | 단일 소스는 stamp 스킵 + 맵 삭제 → dual 첫 stamp가 now 앵커만 해 clockOffset 붕괴 | 단일 소스도 stamp · 맵 유지 |

수정 후 전환 **requiredFail=0 / 7**. known-fail로 숨기지 않음.

| 명령 | exit |
|------|------|
| `npm run test:peer-spacing` | **0** |
| `node --test scripts/peer-sync/rtdb-fs-fallback-source-select.test.mjs` | **0** (8/8) |
| `node scripts/peer-sync/rtdb-fs-fallback-harness.mjs` | **0** (54/54) |

## A3 — 1s 간격 pp · 지연 수렴

**pp 게이트를 interval≥1000ms에 두지 않는 이유** (안정 간격이 아님):

- 적응 지연 ≈ gap×2.2 → 1s 송신이면 목표 ~2200ms.
- self는 지연 0이므로 self−peer 평균 뒤처짐 ≈ v·D ≈ 12m @20km/h.
- 재생 시계는 목표를 ±10%/s로만 따라가 **12–25s에도 아직 이동**한다.
- 따라서 pp는 stamp 회귀 신호가 아니라 **지연 정책+재생 시계 수렴**의 산물. **6.71m를 안정 간격으로 승인하지 않는다.**

실측 (`--suite delay`, dual sin off0, exit 0):

| 간격 | 목표 delay | 12–40s delay pp | convergeTime | renderLag 창별 mean |
|------|------------|-----------------|--------------|---------------------|
| 200ms | ~440ms | **46ms** | **2.6s** | 0–5:341 · 5–12:440 · 12–25:440 · 25–40:440 |
| 1000ms | ~2200ms | **223ms** (delay) / renderLag pp **1214ms** | **15.2s** | 0–5:241 · 5–12:753 · 12–25:1728 · 25–40:2199 |

1000ms는 **25s 이후에야** 목표에 수렴. 12–40s 구간에서 반복 진동(delay pp 223ms)은 남으나 속도·역행·텔레포트 게이트는 PASS.  
이 수렴을 알고리즘으로 더 줄이려면 별도 제안(09 비범위 / catchup rate 재검토)이 필요하다 — 이번 재작업에서 바꾸지 않음.

## A4 — 같은 fixture PRE/POST

기존 `peer-spacing-jitter-metrics-pre-fix.json` / `post-fix.json` **보존**.  
같은 `--gate` 하네스·같은 셀·같은 안정 창(12–40s)으로 재측정:

| 산출 | 경로 |
|------|------|
| PRE(변이) | [peer-spacing-jitter-metrics-rework-pre.json](peer-spacing-jitter-metrics-rework-pre.json) |
| POST | [peer-spacing-jitter-metrics-rework-post.json](peer-spacing-jitter-metrics-rework-post.json) |
| 표 | [peer-spacing-jitter-metrics-rework-compare.json](peer-spacing-jitter-metrics-rework-compare.json) |

| cell (dual 200 off0) | PRE spd | PRE spacePp | POST spd | POST spacePp |
|----------------------|---------|-------------|----------|--------------|
| sin | 4..8.148 | **0.617m FAIL** | 5..6.111 | **0.259m PASS** |
| bundle | 2.727..13.889 | **0.763m FAIL** | 5..6.111 | **0.019m PASS** |

원시 타임라인은 `.out/`(gitignore). 거대한 타임라인은 git에 넣지 않음.

참고: 초기 조사 PRE(다른 계측/구간)의 dual200 sin pp 1.21m 등과 **숫자가 다를 수 있다**. 이번 표만 동일 fixture 전후 비교로 쓴다. 구 수치는 역사 보존.

## B — 두 창 재생

```bash
cd apps/web && npm run test:peer-two-view   # exit 0, 측정 하네스(불변식만 강제)
```

요약: [two-view-order-metrics.json](two-view-order-metrics.json)

- 독립 Vite SSR 모듈 그래프 2개 → Registry·dualStamp 맵·singleton 충돌 없음 확인.
- 비교 키: **uid·경로 거리**. 색/카메라 좌우 아님.
- 현행 = self 즉시 / peer 과거. `--policy common-timeline`은 오프라인 이상화(제품 미적용).

### 06 주장 정정 (실행 수치)

**「D_A≠D_B일 때만 역순」은 틀림.**  
대칭 링크(D_A≈D_B≈440ms, L≈v·D≈3.1m)에서 진실 간격 |g|<L 이면 **양쪽 모두 「내가 앞」** (oppositeSign).

| 시나리오 | 현행 mismatch | common D=300 | common D=500 |
|----------|---------------|--------------|--------------|
| 간격 15m (>L) | 0/1800 | 0 | 0 |
| 간격 1m (<L) | **1800/1800** | 0 | 0 |
| 추월 | 98/1800 | 0 | 0 |
| 속도 20→30→10 | 184/1800 | 0 | 0 |
| 비대칭 지연 | 0/1800 (이 셀은 순서 유지) | 0 | 0 |
| ±30s 시계 | 0/1800 | 0 | 0 |
| 한쪽 stall | **197/1800** | 179 | 167 |

속도 반영: self t50≈0–17ms. peer 창 t50≈0.23–0.70s (버퍼+지연).

stall은 공통 타임라인으로도 mismatch가 남는다 — 「현재 진실」을 확정할 수 없음(09에서 처리).

## C — 계획

[09-plan-common-timeline.md](09-plan-common-timeline.md) — 권고안 하나로 좁힘. 06 보존. Chief 승인 전 제품 표시 코드 변경 없음.

## 검증 일람

| 명령 | 결과 |
|------|------|
| `npm run test:peer-spacing:mutation` | **PASS** exit 0 (변이 중 gate FAIL 증명) |
| `npm run test:peer-spacing` | **PASS** exit 0 |
| `node … --suite delay` | **PASS** exit 0 |
| `npm run test:peer-two-view` | **PASS** exit 0 (측정+불변식) |
| `rtdb-fs-fallback-source-select.test.mjs` | **PASS** 8/8 |
| `rtdb-fs-fallback-harness.mjs` | **PASS** 54/54 |
| replay / smoothness·liveness·motion / eslint / tsc | **이번 턴 미재실행** (TASK-02에서 통과·본 변경은 stamp 적용 범위만 확대). Supervisor 검수 시 필요하면 재실행 |

## 한계·다음

- 제품 self/카메라 공통 시점 미구현(09 승인 후).
- 1s 송신의 긴 지연 수렴은 알고리즘 변경 없이 보고만.
- Git: commit/push 금지 준수.
- 다음: Supervisor 검수 → Chief에게 09 승인 요청.
