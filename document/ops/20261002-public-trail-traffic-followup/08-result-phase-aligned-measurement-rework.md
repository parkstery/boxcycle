# Result — TASK-02R phase-aligned measurement rework

| 항목 | 내용 |
|------|------|
| 문서 유형 | **ops 결과** — TASK-02 재작업 (06 검수 4결함) |
| 담당 | Cursor CLI Developer |
| 작업일 | 2026-10-02 |
| 상태 | **DEVELOPMENT_DONE** — 재작업·검증 완료, Supervisor 재검수 대기 |
| 지시 | [07-task-phase-aligned-measurement-rework.md](07-task-phase-aligned-measurement-rework.md) |
| 근거 | [06-review-phase-aligned-measurement.md](06-review-phase-aligned-measurement.md) |
| 선행 | [05-result-phase-aligned-measurement.md](05-result-phase-aligned-measurement.md) (틀린 주장만 정정) |

증거 클래스·billed 승격 금지 규칙은 05와 동일. production billed 1v2는 **Ø** 유지.

---

## 1. 메타

| 항목 | 값 |
|---|---|
| Branch | `codex/public-trail-traffic-followup` |
| 제품 런타임 변경 | **없음** |
| commit / push / deploy | **하지 않음** |
| production write / 트리거·전송 주기 | **하지 않음** |
| 기존 dirty 보존 | 02/03/04 및 기타 미관련 변경 **보존** |

---

## 2. 결함별 수정

| # | 06 결함 | 조치 |
|---|---|---|
| 1 | binCount만 같아도 중간 분 누락 시 ok | `expectedContainedMinuteStarts`로 창 안 **모든** 완전 포함 시계분에 정확히 1 bin 요구. 누락 → `insufficient`. 창 밖 무관 bin은 허용·비합산 |
| 2 | 동일 `minuteStartIso` 중복 합산 | overlap 구간 중복 → `insufficient` (`duplicate minuteStartIso`) |
| 3 | 음수·비정수·결측을 조용히 합산/null-ok | `parseOptionalNonNegInt`: 0+ 정수만. 무효 → insufficient. 한쪽 메트릭만 있으면 `comparedMetrics`/`missingMetrics`로 명시 (비율은 해당 메트릭만). solo/dual 메트릭 존재 비대칭 → insufficient |
| 4 | misaligned fixture 근거 없는 수치 | `phase-align-predeploy-misaligned.json`을 archive §1.2만 유지: 363/**118**, 45/1, 1400/280, 1200/252. 삭제: 08:18 `10/1`, 08:25 `800/160`, writes `72` |

---

## 3. 변경 파일

| 경로 | 역할 |
|---|---|
| `apps/web/scripts/traffic/phaseAlignedMeasurement.ts` | 완전 분 커버리지·중복·metric 검증 · `comparedMetrics`/`missingMetrics` |
| `apps/web/scripts/traffic/phase-aligned-measurement.test.ts` | 누락/중복/음수·비정수/writes-only/비대칭/60s misaligned/정상 창 테스트 |
| `apps/web/scripts/traffic/phase-aligned-measurement.mjs` | CLI에 compared/missing metrics 요약 |
| `apps/web/scripts/traffic/fixtures/phase-align-predeploy-misaligned.json` | §1.2 권위 수치만 |
| `…/05-result-phase-aligned-measurement.md` | 초판 한계·fixture 오류 정정 링크만 |
| `…/08-result-phase-aligned-measurement-rework.md` | 본 결과 |
| 묶음 `README.md` · `document/ops/PROGRESS.md` · `document/ops/README.md` | 상태·링크 |

`phase-align-synthetic-ok.json` 수치 변경 없음 (합성 self-check).

---

## 4. 검증

| 명령 | 결과 |
|---|---|
| `cd apps/web && npm run test:traffic-meters` | **PASS** — 32 tests (phase-align 18 + meters/paired 14), fail 0 |
| `npm run traffic:phase-align -- --input scripts/traffic/fixtures/phase-align-synthetic-ok.json` | **ok** — quiet 40 r/min · solo 200/50 · dual 600/120 · readsRatio 3 · writesRatio 2.4 · compared=`[reads,writes]` · `billedPromotion: false` |
| `npm run traffic:phase-align -- --input …/phase-align-predeploy-misaligned.json` | **insufficient** — solo/dual steady 완전 포함 bin 0 (reasons에 zero bins만; quiet 45/1은 §1.2) |
| `npm run lint` (변경 파일) | **미실행** — `eslint` 로컬 binary/`@eslint/js` 미설치 (`'eslint'은(는) … 아님`) |
| `tsc -b` 전량 | **미실행** (지시: 가능 범위). 측정 파일은 `node --experimental-strip-types` + 단위 테스트로 검증 |
| production write / e2e / deploy | **미실행** (금지) |

### 신규·보강 단위 테스트 (고정)

- 중간 분 누락 (`00:00,00:02`만) → insufficient
- `minuteStartIso` 중복 → insufficient
- 음수·비정수 reads/writes → insufficient
- writes-only → ok + `missingMetrics: [reads]`
- solo/dual 메트릭 비대칭 → insufficient
- 무관 분 bin 존재해도 합산 안 함
- 과거 60s misaligned (§1.2 수치) → insufficient
- 정상 완전 포함 창 → ok + ratio

---

## 5. 비목표 준수

- production write / deploy / commit / push: 안 함
- 제품 런타임 FS/RTDB/CF/Rules/주기: 안 함
- A/B/D 최적화 · 3명 이상: 안 함
- 02/03/04 본문 보존 · 05는 틀린 주장만 정정

---

## 한 줄 요약

네 결함(누락 분·중복 분·무효/선택 메트릭·역사 fixture)을 코드·테스트·fixture에서 고쳤고 `test:traffic-meters` 32/32 PASS. production billed 1v2는 **Ø**.
