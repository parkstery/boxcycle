# RESULT-04 단일/이중 수신 시간축 통일 — 최종 검증

담당: Cursor CLI · 지시: [10-task-unify-ingest-axis.md](10-task-unify-ingest-axis.md) · 시각: 2026-10-05  
승인용 계획: [12-plan-common-timeline-final.md](12-plan-common-timeline-final.md)  
08/09 원본 보존. commit/push/merge/배포 없음. **코드 재구현 없음**(확정 계획 1~3은 08에서 이미 반영).

## 판정

| 항목 | 판정 | 비고 |
|------|------|------|
| 구현 재적용 | **불필요** | 모든 선택 패킷 stamp + 단일 소스 맵 유지 이미 존재 |
| 최종 회귀 검증 | **PASS** (아래 일람) | gate/전환 재확인 + 08에서 미실행분 재실행 |
| `test:peer-s3a-replay` 전체 스크립트 | **부분** | replay 19 PASS; `s3-fixture-gate` 의 기존 known-fail `d1` 로 스크립트 exit 1 |
| 승인용 계획 | **작성** | 12 — D=600ms 고정, 09 §4 창별 EMA 폐기 |

제품 self/카메라/wire/`tSrv` **미변경**. 표시 공통 시간축은 12 승인 후.

## 구현 상태 (재확인만)

| 계획 | 코드 | 상태 |
|------|------|------|
| 1 all-source stamp | `syncFromPresence.ts` — 선택 패킷마다 `stampDualSourceIngestPacket` | 이미 구현 |
| 2 단일 소스 맵 유지 | `dualIngestStampByUid.delete` 제거, 주석으로 이유 명시 | 이미 구현 |
| 3 Δt·전환·clamp·liveness | 동일 함수 본문 유지 | 이미 구현 |
| 4 raw→normalized 회귀 | gate PRE FAIL / POST PASS + mutation failcheck | 08에서 고정 |

이번 턴 최소 문서 정합만:

- `stampDualSourceIngestPacket` JSDoc — all-source 적용 명시
- gate report `note` — 「single은 stamp 스킵」오기를 현행 동작으로 수정

## 검증 일람

| 명령 | 결과 |
|------|------|
| `git diff --check` (변경 범위) | **PASS** |
| `node --check` 변경 mjs 5개 | **PASS** |
| `npm run test:peer-spacing` | **PASS** exit 0 — gate requiredFail=0, dual200MaxPp=0.259; transitions 7/7 |
| `npx eslint src/lib/peerMotion/syncFromPresence.ts` | **PASS** |
| `npx tsc -p tsconfig.json --noEmit` | **PASS** |
| smoothness + liveness + motion (`--test` 3파일) | **PASS** 29/29 |
| `node --test …/rtdb-fs-fallback-source-select.test.mjs` | **PASS** 8/8 |
| `node …/rtdb-fs-fallback-harness.mjs` | **PASS** 54/54 |
| `npm run test:next-ride` | **PASS** 338 pass / 0 fail / 4 todo |
| `replay.mjs --check` (19 시나리오) | **PASS** 「전 시나리오 불변식 통과」 |
| `npm run test:peer-s3a-replay` (전체) | **exit 1** — `s3-fixture-gate` `d1-target-vs-applied` (rel≈0.35, knownFails.pass=false). stamp 경로와 무관한 S3 fixture 게이트; 본 변경으로 손대지 않음 |
| pre-push 연결 | **확인** — `githooks/pre-push` L80–81이 web 변경 시 `npm run test:peer-spacing` 실제 호출 |

08에서 유효했던 mutation / two-view / delay suite는 지시대로 **불필요 반복하지 않음**. gate·transitions는 최종 코드 재확인으로 재실행.

### 게이트 수치 (재실행)

| cell | spacePp | 판정 |
|------|---------|------|
| dual 200 off0 sin | 0.259m | PASS (<0.5) |
| dual 200 off0 bundle | 0.019m | PASS |
| single 200 off0 sin | 0.259m | PASS |
| transitions ±30s/0 × frozen/cleared + no-seq | 7/7 | PASS — 역행·부당 순간이동 없음 |

200ms 정상 간격 pp는 08 POST와 동일 수준(악화 없음).

## Git

- 브랜치: `fix/peer-spacing-jitter` (작업 트리 변경 유지)
- commit/push/merge/배포: **하지 않음** (지시 준수)
- 다른 작업 변경 되돌림: 없음

## 한계·다음

- 창 간 표시 일치 제품 미착수 — [12](12-plan-common-timeline-final.md) Chief 승인 대기.
- `test:peer-s3a-replay` 래퍼의 `d1` known-fail는 본 묶음 범위 밖; Supervisor가 별도 추적할지 판단.
- 다음: Supervisor가 11+diff+12 검수 → Chief에게 12 승인 요청.
