# 감리 → 개발팀장 지시서 (활성) — 멀티라이더 위치 동기화

> S4-1R2 지시서·보고서는 감리가 `INSTRUCTION-S41R2.md` · `REPORT-S41R2.md` 로 보존했다.
> 이번 작업은 **새 `REPORT.md` 를 쓰지 않는다** — §6 의 짧은 결과만 이 파일 아래에 덧붙인다.
> 마치면 이 파일 `상태` → `보고완료`.

- **지시번호**: S4-1R2-C (귀속 분류 · 검증 · **커밋 고정**)
- **발신**: 클로드감리0813 · **일시**: 2026-08-13 · **상태**: 보고완료
- **브랜치**: `fix/multiplayer-position-sync` (base `main2`) · 기준 HEAD `cc64279`

---

## 0. 목적 — 재현 가능한 Git 기준점을 만든다

S4-1R2 는 **WARNING 채택**됐다(`HANDOFF` §3-15). **재개발하지 않는다.**
지금 필요한 것은 하나뿐이다 — **작업 결과를 추적 가능한 커밋으로 고정하는 것.**

```
현재   HEAD cc64279 · S4-1R2 전부 미커밋
문제   워킹트리에 다른 작업선 변경이 섞여 있다. 그대로 커밋하면 남의 작업을 끌고 들어간다
할 일  귀속표대로 골라 담아 커밋한다. 그 외에는 아무것도 하지 않는다
```

**코드를 고치지 마라. 시험을 다시 만들지 마라. 기준을 바꾸지 마라.**

---

## 1. 귀속 — `HANDOFF` §3-16 이 정본이다

### 1-1. 커밋할 것 (13 개)

```
제품 2
  apps/web/src/lib/peerMotion/routePublishFlight.ts
  apps/web/src/hooks/useLiveLocationPublishSession.ts

시험·도구 3
  apps/web/e2e/peer-sync-s41r.spec.ts
  apps/web/e2e/peer-sync-s41.spec.ts
  apps/web/scripts/peer-sync/s41-summarize.mjs

증거 6
  document/ops/sync-relay/S41R-lifecycle.json
  document/ops/sync-relay/S41R2-after-run1-events.json
  document/ops/sync-relay/S41R2-after-run2-events.json
  document/ops/sync-relay/S41R2-after-run3-events.json
  document/ops/sync-relay/S41R2-summary.json
  document/ops/sync-relay/S3-fixture-gate.json        ← generatedAt 만 갱신됐는지 확인하고 담아라

문서 6
  document/ops/sync-relay/HANDOFF.md
  document/ops/sync-relay/INSTRUCTION.md
  document/ops/sync-relay/INSTRUCTION-S41R2.md
  document/ops/sync-relay/REPORT.md
  document/ops/sync-relay/REPORT-S41R.md
  document/ops/sync-relay/REPORT-S41R2.md
```

### 1-2. **절대 담지 마라 (6 개)**

```
CLAUDE.md
document/260707-RTW-결정-로그.md
document/ops/sync-relay/S41-after-run1-events.json
document/ops/sync-relay/S41-after-run2-events.json
document/ops/sync-relay/S41-after-run3-events.json
document/ops/sync-relay/S41-summary.json
```

**`git add -A` · `git add .` · `git commit -a` 를 쓰지 마라.** 경로를 하나씩 지정해 담아라.
`S41-*` 는 S4-1 산출물이고 파일 시각이 S4-1R2 세션보다 **이르다**. 되돌리지도, 담지도 마라.

---

## 2. 커밋 전 검증 — 이미 통과한 것을 다시 만들지 마라

**e2e 를 다시 돌리지 마라.** T1~T5·정상 3 런은 최신 코드로 통과했고 산출물이 남아 있다.
확인할 것은 **워킹트리가 그 산출물과 같은 코드인지**뿐이다.

```
가.  npx tsc -b                         (apps/web)
나.  npx eslint <§1-1 의 제품 2 + 시험·도구 3>
다.  npm run test:peer-s3a-replay       ← d0 PASS · d1 뒤집힘 유지 확인
     ⚠ 이 명령은 S3-fixture-gate.json 의 generatedAt 을 다시 바꾼다. 커밋 전에 돌리고,
       바뀐 파일을 그대로 담아라. 값이 generatedAt 외에 바뀌면 **멈추고 보고하라**
라.  산출물 자기일치 확인 (파일만 읽어라 · 재실행 금지)
     S41R-lifecycle.json      instruction="S4-1R2" · allPass=true · T1~T5 5 건
     S41R2-summary.json       gates.all=true · routeInFlight.after.perRun=[1,1,1]
                              z15.afterMedian depart/cruise D_eff ≤350 · afterMax.max ≤2.5
```

**하나라도 어긋나면 커밋하지 말고 보고하라.** 통과시키려고 손대지 마라.

---

## 3. 커밋 — 3 개로 나눈다

```
① fix(sync): S4-1R2 route 큐 수명주기 — 지연 정리·세션 소유권
     제품 2 파일

② test(sync): S4-1R2 T1~T5 강화 + S41 산출물 태그 분리
     시험·도구 3 파일

③ docs(sync): S4-1R2 WARNING 채택 — 증거·보고·귀속표
     증거 6 + 문서 6
```

**훅을 우회하지 마라.** `--no-verify` 금지. 훅이 막으면 **고치지 말고 그 출력을 그대로 보고**하라.
**푸시하지 마라. `main2` 에 병합하지 마라. PR 도 만들지 마라.**

커밋 메시지 본문에는 **WARNING 2 건**을 한 줄씩 남겨라.

```
W-1 deferred 실행(run>0) 경로가 카운터로 직접 증명되지 않음 — 행 부재로 간접 확인
W-2 삭제 시각과 늦은 쓰기 완료 시각의 선후를 기록하지 않음 — 최종 상태만 관측
```

---

## 4. 커밋 후 확인

```
git status --short   →  §1-2 의 6 개만 남아 있어야 한다. 그 외가 남으면 보고하라
git log --oneline -3 →  커밋 3 개
```

**남은 6 개를 stash·checkout·reset 으로 치우지 마라.** 다른 작업선의 살아 있는 변경이다.

---

## 5. 금지

- **코드·시험 수정 일체** (이번은 검증과 커밋뿐이다)
- **S4-2 · S4-3 착수** · motion 경로 수정 · 위치 산식 · 예산 · 판정 기준 변경
- `ROUTE_FLIGHT_DRAIN_TIMEOUT_MS` 변경 · 시험 지연값(3,500 / 6,000 ms) 변경
- **기존 산출물 삭제·덮어쓰기** — 특히 `S41R-lifecycle-baseline.json`(수정 전 반례)과 `S41-*`
- e2e 재실행으로 산출물 갱신 (필요하다고 판단되면 **먼저 보고**하라)
- `git add -A` · `git add .` · `git commit -a` · `--no-verify` · push · `main2` 병합 · PR
- Orchestrator·오케스트레이션 문서 수정 · cyclefit 일체

---

## 6. 보고 — 이 파일 아래에 짧게 덧붙인다

**새 `REPORT.md` 를 만들지 마라.** `REPORT.md` 는 S4-1R2 본문이다.

```
- 커밋 3 개의 해시와 각 커밋에 담긴 파일 수
- §2 가~라 검증 결과 (통과/불통과, 불통과면 출력 그대로)
- git status --short 잔여 목록 (§1-2 의 6 개와 일치하는지)
- 이견·실패 전수
```

---

## S4-1R2-C 결과 (2026-08-13)

### 커밋

| # | 해시 | 파일 수 |
|---|---|---:|
| ① | `b3336ed` | 2 |
| ② | `8b238a8` | 3 |
| ③ | 이 커밋 | 12 (증거 6 + 문서 6) |

### §2 가~라

- **가** `npx tsc -b` (apps/web) — 통과 (exit 0)
- **나** eslint 제품 2 + 시험·도구 3 — 통과 (exit 0)
- **다** `npm run test:peer-s3a-replay` — 통과. d0 `pass: true` · d1 `pass: true`(뒤집힘 유지). `S3-fixture-gate.json` 은 `generatedAt` 만 `2026-08-12T21:22:04.829Z` → `2026-08-12T23:59:12.534Z`
- **라** `S41R-lifecycle.json` `instruction="S4-1R2"` · `allPass=true` · T1~T5 전부 `pass=true`. `S41R2-summary.json` `gates.all=true` · `routeInFlight.after.perRun=[1,1,1]` · afterMedian D_eff depart/cruise **240/240** ≤350 · afterMax.max depart **2.317** / cruise **1.319** ≤2.5

### git status 잔여 (③ 후 기대 = §1-2 6개)

`CLAUDE.md` · `document/260707-RTW-결정-로그.md` · `S41-after-run{1,2,3}-events.json` · `S41-summary.json`

### 이견 · 실패

실패 없음. 이견: `S41R2-summary.json` 최상위 `instruction` 필드는 `"S4-1"` (지정 게이트는 충족).
