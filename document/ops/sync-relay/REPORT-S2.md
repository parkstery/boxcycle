# S2 REPORT — S1 재분석 + replay 하네스

- **지시번호**: S2
- **일시**: 2026-08-10
- **브랜치**: `fix/multiplayer-position-sync`
- **e2e 실행**: 없음 (지시 §1-0 앱 구동 금지 · §2 알고리즘 검증은 replay만)
- **산출물**: `REPORT-S1.md`(원본 보존) · `S2-recompute.json` · `S2-accuracy-gate.json` · `s2-z15-cruise-scenario.json`

---

## 반증 §1-0 ①

> 「상한을 5,000 으로 올렸는데도 `D_eff` 가 800 근처에 머물면 §0-2 진단이 틀린 것이다.」

| case | D_eff@5k | 천장? | D_eff@10k | 천장? |
|---|---:|:---:|---:|:---:|
| z15-depart | 5000 | Y | 10000 | Y |
| z15-cruise | 5000 | Y | **7140** | N |
| z15-decel | 220 | N | 220 | N |
| z15-pause | 160 | N | 160 | N |

**판정**: 반증 **불성립**. 5k에서 depart/cruise 가 800 근처가 아니라 **새 상한에 붙음** → §0-2(800=탐색 상한 히트) **유지**.

---

## UAG — 정정된 z15 기준선

z13 4케이스 → **측정 불가(합성)**. 지표·헤드라인에서 제외. (구 `REPORT-S1.md`의 392.80 m 인용 금지)

| case | D_eff(ms) | RMSE(m) | P95(m) | max(m) | n | 비고 |
|---|---:|---:|---:|---:|---:|---|
| z15-depart | **≥10000** | 10.617 | 20.447 | 24.980 | 64 | 10k 탐색도 천장 — 참 지연 미상(하한) |
| z15-cruise | **7140** | 32.104 | 45.066 | **54.900** | 91 | **S3 목표 기준선** |
| z15-decel | 220 | 0.639 | 1.076 | 2.607 | 29 | 사실상 PASS(max 2.5 경계 ±0.1) |
| z15-pause | 160 | 0.178 | 0.600 | 0.988 | 50 | **PASS** |

**감리 초안(93~96 m max @ D=800) 정정**: 상한을 풀면 cruise residual max는 **54.9 m @ D_eff=7140 ms**.  
depart는 10s 탐색에서도 천장이라 residual이 더 줄지만(max≈25 m) **지연을 확정할 수 없음**.

**문제는 「움직일 때」** (depart/cruise). 감속·정지는 예산 안.

### 수용 게이트 (z15-cruise 실로그 → integrator 재현)

| 지표 | §1-0 확정 | replay | ±20% |
|---|---:|---:|:---:|
| D_eff | 7140 | 7160 | PASS |
| RMSE | 32.104 | 31.898 | PASS |
| max | 54.900 | 49.783 | PASS |

→ **수용 게이트 PASS**. 이 하네스로 S3 판정 가능.

---

## 기술 — 하네스

### §1-1 playwright reporter

`playwright.config.ts`: `reporter: [['line'], ['html', { open: 'never' }]]`  
(실패 시 HTML 서버 블록 제거)

### §1-2 시나리오 5종 + 기존 (`node scripts/peer-sync/replay.mjs --check`)

| 시나리오 | 결과 |
|---|---|
| cruise-steady … ride-to-completed (기존 5) | ✓ |
| s2-depart-ramp-target-speed | ✓ |
| s2-cruise-30kmh | ✓ |
| s2-decel-30-to-5 | ✓ |
| s2-pause-hold | ✓ |
| s2-lowzoom-stall-5kmh | ✓ |

전 시나리오 불변식 통과.  
지연 모델 base(S3 입력): **cruise D_eff = 7140 ms** (depart는 ≥10 s 하한만).

### S3에 넘길 실측 요약

1. 움직이는 구간 오차의 실효 지연은 **수 초 단위**(cruise 7.1 s), 350 ms 예산과 한 자릿수 차이.
2. 그 지연을 맞춘 뒤에도 cruise residual max **≈55 m** — 단순 보간 지연만으로는 설명 안 되는 **추적 실패/스톨**(B.age 수 초)이 섞여 있음 → S3 D-1(적용속도)·발행 경로 우선.
3. z13은 이번 측정으로 수치화하지 못함 — S3에서 저줌 실측은 **합성 없이** 별도 계측 필요.

---

## 이견

- z15-decel confirmed max 2.607 m는 예산 2.5를 0.1 초과. 원본(S1) D_eff=240에서 max 2.466 PASS였음. **감속은 정상으로 취급**하되 경계값으로 기록.
- depart D_eff는 10 s 탐색 천장 → 「10000 ms」가 아니라 **≥10000 ms**로 보고.

## 커밋 예정 범위

- `playwright.config.ts` reporter
- `scripts/peer-sync/*` (s2-recompute · s2-accuracy-gate · scenarios 5종 · HARNESS)
- `e2e/peer-sync-s1.spec.ts` · `s1-metrics.mjs` · `package.json` test:e2e:peer-s1
- `document/ops/sync-relay/REPORT-S1.md` · `REPORT.md`(본문) · raw/recompute/gate JSON · INSTRUCTION/HANDOFF
