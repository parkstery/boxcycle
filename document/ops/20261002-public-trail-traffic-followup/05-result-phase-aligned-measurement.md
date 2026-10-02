# Result — Phase-aligned measurement tooling (TASK-02)

| 항목 | 내용 |
|------|------|
| 문서 유형 | **ops 결과** — TASK-02 측정 도구·테스트·절차 |
| 담당 | Cursor CLI Developer |
| 작업일 | 2026-10-02 |
| 상태 | **SUPERSEDED_IN_PART** — 초판 도구 완료 후 [06 검수](06-review-phase-aligned-measurement.md) REWORK → [08 재작업 결과](08-result-phase-aligned-measurement-rework.md) |
| 지시 | [04-task-phase-aligned-measurement.md](04-task-phase-aligned-measurement.md) |
| 연결 | [README](README.md) · [TASK-01 결과](02-result-remaining-opportunity-audit.md) · [검수](03-review-remaining-opportunity-audit.md) · [06](06-review-phase-aligned-measurement.md) · [08](08-result-phase-aligned-measurement-rework.md) |

증거 클래스: **P** console/Monitoring · **E** emulator client meter · **L** Chief/human · **H** harness · **C** code · **Ø** not measured.  
본 TASK는 **도구와 절차 검증**이다. 기존 Chief **L** 숫자에 정식 귀속·billed 판정을 부여하지 않는다.

---

## 1. 메타

| 항목 | 값 |
|---|---|
| Branch | `codex/public-trail-traffic-followup` |
| HEAD (시작) | `68f0f11c9a1f8c1343c70bbeec28647bb8214663` |
| Dirty 보존 | 기존 미커밋 `02`/`03`/`04`·ops README/PROGRESS/묶음 README **보존**. 본 TASK는 측정 도구·테스트·본 결과만 추가 |
| 제품 런타임 변경 | **없음** (Firestore/RTDB/CF/Rules/주기 미변경) |
| commit / push / deploy | **하지 않음** |
| production write / 실주행 자동 측정 | **하지 않음** |

### 읽은 문서

1. 묶음 `README.md` · `00-handoff.md` · `01`–`04`
2. `document/archive/261001-Public-Trail-동행-트래픽-개선-결과보고.md` Part A · Part B §1·§4·§7·§8.1
3. `document/ops/20260929-public-trail-traffic/08-review-measurement.md`
4. `apps/web/scripts/traffic/*` · `apps/web/e2e/public-trail-traffic-1-2.spec.ts` · phase JSONL 샘플

---

## 2. 변경 파일

| 경로 | 역할 |
|---|---|
| `apps/web/scripts/traffic/phaseAlignedMeasurement.ts` | 완전 포함 시계분 bin 귀속·1v2 방향 비교·insufficient 판정 (순수 함수) |
| `apps/web/scripts/traffic/phase-aligned-measurement.test.ts` | 단위 테스트 |
| `apps/web/scripts/traffic/phase-aligned-measurement.mjs` | 오프라인 CLI |
| `apps/web/scripts/traffic/fixtures/phase-align-predeploy-misaligned.json` | 배포 전 60s 창 → insufficient 재현 fixture (**초판에 근거 없는 08:18/08:25 수치·writes=72 포함 → [08](08-result-phase-aligned-measurement-rework.md)에서 §1.2만 남김**) |
| `apps/web/scripts/traffic/fixtures/phase-align-synthetic-ok.json` | 도구 self-check용 합성 ok fixture (**production 관측 아님**) |
| `apps/web/package.json` | `test:traffic-meters`에 신규 테스트 추가 · `traffic:phase-align` script |
| `document/ops/20261002-public-trail-traffic-followup/05-result-phase-aligned-measurement.md` | 본 결과 |
| 묶음 `README.md` · `document/ops/PROGRESS.md` · `document/ops/README.md` | 상태·링크만 갱신 (02/03 본문 미수정) |

---

## 3. 입력 계약 · 사용법

### 3.1 입력 JSON

| 필드 | 필수 | 의미 |
|---|---|---|
| `evidenceClass` | 예 | `P` / `E` / `L` / `H` / `C` / `Ø`. `Ø`면 비교 insufficient |
| `deployLabel` | 예 | 배포/코드 상태 라벨. 1v2는 **동일 라벨**에서만 |
| `calendarDate` | 예 | `YYYY-MM-DD`. 날짜 혼합 금지 |
| `quiet` | 권장 | `{ startIso, endIso }` — ensureRiding **전** 또는 publish 중지 후 |
| `solo` / `dual` | 비교 시 | `start?` / **`steady`** / `end?` 각 `{ startIso, endIso }` |
| `minuteBins[]` | 예 | `{ minuteStartIso, reads?, writes? }` — **시계분 정각**만 |

규칙:

1. **완전 포함**된 시계분 bin만 합산 (`[binStart, binEnd) ⊆ [windowStart, windowEnd)`).
2. 부분 겹침은 `excludedPartialBins`로 기록하고 **선형 배분하지 않음**.
3. solo.steady와 dual.steady의 **완전 포함 분 개수(binCount)가 다르면** insufficient (창 길이 합쳐 효과 추정 금지).
4. solo/dual steady **교차**·빈 bins·누락 interval → insufficient.
5. `billedPromotion`은 항상 `false`.

> **초판 한계 (06 검수):** binCount 동일만 보면 중간 분 누락·중복 합산·무효 metric을 놓칠 수 있음. 보정은 [08](08-result-phase-aligned-measurement-rework.md) — 창 안 **모든** 시계분에 정확히 1 bin, 중복/음수·비정수 insufficient, 선택 메트릭은 결측 명시.

### 3.2 명령

```text
cd apps/web
npm run test:traffic-meters
npm run traffic:phase-align -- --input scripts/traffic/fixtures/phase-align-synthetic-ok.json
npm run traffic:phase-align -- --input scripts/traffic/fixtures/phase-align-predeploy-misaligned.json
```

정량 출력(요약 + JSON): 원본 count 합 · bin 개수/길이 · rate(/min) · quiet baseline · 1v2 방향 ratio/Δ · evidenceClass/deployLabel/calendarDate.

### 3.3 권장 운영 절차 (배포 후 1명/2명 · write 없음)

1. 동일 `deployLabel`·동일 `calendarDate`에서 quiet → solo steady → dual steady를 **시계분에 맞춰** 길게 잡는다 (steady ≥ 2 완전 분 권장, 가능하면 더).
2. quiet는 ensureRiding 전 또는 publish 중지 후. UI quiet ≠ Firebase silence (08-review).
3. Console 지난 60분 **분당 호버** 또는 Cloud Monitoring 분 해상도 값을 `minuteBins`로 옮긴다 (수동 전사 허용).
4. phase ISO와 bins를 위 JSON으로 넣고 CLI 실행. `insufficient`면 창을 늘리거나 정각 정렬 후 재측정.
5. 결과를 **P** 섹션에만 기록. emulator **E**·Chief **L**과 한 표로 비율화하지 않음.
6. CF/RTDB는 별 series로만 병기 (`seriesNotes`). Firestore rate에 섞지 않음.

---

## 4. 검증

| 명령 | 결과 |
|---|---|
| `cd apps/web && npm run test:traffic-meters` | **PASS** — 당시 23 tests (phase-align 9 + meters/paired 14). 재작업 후 건수는 [08](08-result-phase-aligned-measurement-rework.md) |
| CLI synthetic ok fixture | **ok** — quiet 40 r/min · solo 200/50 · dual 600/120 · readsRatio 3 · writesRatio 2.4 · `billedPromotion: false` |
| CLI pre-deploy misaligned fixture | **insufficient** — solo/dual steady 완전 포함 bin 0 (60s 창 한계). **초판 fixture의 10/800·writes=72 등은 문서 비권위 → 08에서 삭제·118로 정정** |
| 제품 e2e / production 실주행 | **미실행** (지시: production 자동 측정·write 금지) |
| lint/typecheck | 신규 파일은 `node --experimental-strip-types` + 단위 테스트로 검증. 별도 `tsc -b`/eslint 전량 미실행 |

---

## 5. 읽기 전용 production metric 접근

| 소스 | 접근 | 세분성 | 비고 |
|---|---|---|---|
| Firebase CLI (`firebase projects:list`, `firestore:databases:list --project boxcycle-dc2df`) | **가능** (인증됨, current=`boxcycle-dc2df`) | DB inventory 수준 | write/delete **안 함** |
| `gcloud` / Cloud SDK | **불가** | — | PATH에 없음 · `%LOCALAPPDATA%\Google\Cloud SDK` 없음 |
| Cloud Monitoring time series (Firestore read/write per minute) | **불가** | 분 해상도 API 미도달 | gcloud/Monitoring client 부재 |
| Firestore Console 분당 호버 | 이 환경에서 자동화 **불가** | 분 | 수동 전사 절차만 준비됨 |
| RTDB / CF billed minute series | **Ø** | — | 동일 이유로 자동 pull 없음 |

**결론:** 현재 worktree에서 production **분당 ops를 자동 수집할 수 없다**. 도구는 입력이 오면 정렬·비교할 수 있으나, 실제 배포 후 1v2 **P** 숫자는 Chief/운영자 수동 제공 전까지 **Ø**.

---

## 6. 정렬 창 확보 현황

| 창 | 상태 |
|---|---|
| 배포 전 Console 60s ride 창 (08:18:56–08:19:56 / 08:24:28–08:25:28) | fixture로 **insufficient** 확인 — 정식 1v2 귀속 **불가** (08-review와 일치) |
| 기존 e2e phase JSONL (`solo_measure_*` / `dual_measure_*`, ~45s) | 완전 시계분 포함 불가 → production Console 귀속용으로 **부적합** (emulator **E** 창과는 별개) |
| 배포 후 phase-aligned 1v2 **P** 창 | **없음** (분당 시리즈 + ISO phase 미제공) |
| Chief 후속 **L** (peak/run R/W) | phase ISO·분 bin 없음 → 도구에 넣지 않음 · 정식 귀속 **하지 않음** |
| 합성 fixture | 도구 self-check만. production/billed 주장 **금지** |

**1명/2명 비교 가능 여부 (지금):** 도구·계약상 **가능**. 실제 production 입력 부재로 **미실시 (Ø)**.

Production billed 1v2: **Ø** 유지.

---

## 7. 한계 · 다음에 필요한 Chief 입력

한계:

- Console/Monitoring 값을 이 환경이 pull하지 못함.
- 완전 포함 규칙이라 steady가 시계분을 덮지 않으면 항상 insufficient (의도적).
- emulator meter(**E**)와 console(**P**)·Chief(**L**)를 한 효과로 합치지 않음.
- CF invocation / RTDB download은 별도 series 입력이 필요; 이번 도구는 Firestore read/write bin 중심.

Chief에게 필요한 입력 (관측 실행 시):

1. 동일 배포 상태 라벨과 날짜.
2. quiet / solo.steady / dual.steady의 **ISO 시작·끝** (가능하면 start/end phase도).
3. 해당 구간의 **분당** read·write (및 가능하면 CF begin·RTDB) 표.
4. 창 길이: solo·dual steady가 **같은 개수의 완전 분**을 포함하도록 정렬.

구현(A/B/D)·deploy·트리거/전송 주기 변경은 본 결과 범위 밖이며 Supervisor 검수·Chief 게이트 대상.

---

## 8. 비목표 준수

- production write / 게스트 생성 / 실주행 자동 측정: 안 함
- deploy / commit / push: 안 함
- 제품 런타임 FS/RTDB/CF/Rules/주기 변경: 안 함
- A/B/D 최적화 구현: 안 함
- 3명 이상 비교: 안 함
- 기존 02/03 감사·검수 문서 본문 수정: 안 함
- Chief **L** → billed/인과 절감률 확정: 안 함

---

## 한 줄 요약

완전 포함 시계분 기준 phase-align 도구·테스트·CLI를 넣었고 `test:traffic-meters` 23건 PASS. production 분당 metric 자동 접근은 gcloud/Monitoring 부재로 불가하며, 배포 후 정렬 1v2 **P**/billed는 입력 없어 **Ø**로 남긴다.
