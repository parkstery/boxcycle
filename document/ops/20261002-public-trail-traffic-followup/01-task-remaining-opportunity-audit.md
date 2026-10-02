# TASK-01 — Remaining opportunity audit (read-only)

| 항목 | 내용 |
|------|------|
| 담당 | Cursor CLI Developer |
| Supervisor | Codex |
| 상태 | `READY_FOR_DEVELOPMENT` |
| 보고 경로 | 같은 폴더의 **`02-result-remaining-opportunity-audit.md`** (신규 작성만) |
| 작업일 | 2026-10-02 이후 |

---

## 목표

배포 완료된 Public Trail 동행 트래픽 개선 **이후**, 추가 저감 여지가 있는지 **증거 기반으로 검토**한다. 이 TASK는 **read-only audit**다. 코드·배포·production write 없음.

사용자 요구의 요지: 현재 트래픽은 많이 줄었으나, 더 줄일 여지가 있는지 **아직 검증하지 않은 사항**을 이전 묶음과 같은 방식의 조사로 이어 간다.

## 허용

- 저장소 **읽기** (현재 worktree tip = main 계열 코드 기준).
- `git` 조회 (`status` / `log` / `show` / `grep` 등 **읽기 전용**).
- 정적 코드·기존 ops/archive 문서 대조.
- 결과 문서 **`02-result-remaining-opportunity-audit.md` 한 파일만** 신규 작성.

## 금지

- 제품 코드 · 테스트 코드 · 설정 · Rules · Functions · Hosting 등 **모든 수정**
- commit / push / amend / force
- production 또는 emulator **deploy / write / billed 변경**
- 즉시 throttle 변경 · trigger 삭제 · RTDB rate 변경 · schema/rules/data migration
- 3명 이상 최적화 **구현**
- 잔여 최적화 감사 범위를 넘어선 구현·실험 실행
- 이전 worktree · stash · 백업 경로 탐색·복원 (불필요; 비밀·환경값 기록 금지)
- Chief 관측 숫자를 production billed 확정·emulator 표와 **한 표로 혼합**

## 환경

| 항목 | 값 |
|---|---|
| Worktree | `C:\Users\kdrea\.codex\worktrees\public-trail-traffic-followup\boxcycle` |
| Branch | `codex/public-trail-traffic-followup` |
| Base | `origin/main` @ `2cdaea6b7ca6468254e239a2fd2b2ab719c27c62` |
| 이전 묶음 | [20260929-public-trail-traffic](../20260929-public-trail-traffic/README.md) — **CLOSED** |
| 최종 보고 | [261001-…결과보고](../../archive/261001-Public-Trail-동행-트래픽-개선-결과보고.md) |

시작 전 `git status` / `git rev-parse HEAD`를 결과에 기록한다. dirty가 있으면 **자신의 변경으로 주장하지 말고** 사실만 적는다.

## 읽기 필수 (순서)

1. [README.md](README.md) · [00-handoff.md](00-handoff.md)
2. [최종 보고](../../archive/261001-Public-Trail-동행-트래픽-개선-결과보고.md) — Part A baseline · Part B §2·§4·§7
3. [27-result-remaining-traffic-audit.md](../20260929-public-trail-traffic/27-result-remaining-traffic-audit.md)
4. [30-result-rtdb-fs-fallback.md](../20260929-public-trail-traffic/30-result-rtdb-fs-fallback.md) · [30c-result-dual-source-liveness.md](../20260929-public-trail-traffic/30c-result-dual-source-liveness.md)
5. [31b-result-meter-4s.md](../20260929-public-trail-traffic/31b-result-meter-4s.md) (및 필요 시 31a)
6. [37-result-r2-deploy.md](../20260929-public-trail-traffic/37-result-r2-deploy.md)
7. 현재 트리의 관련 소스 (아래 후보 A–F에 대응하는 파일; **현재 line/ref**)

## 확정 baseline (결과에 그대로 보존)

| 주장 | 취급 |
|---|---|
| Emulator 1s→4s FS writes solo 73.2% · dual 72.5%; hub solo 72.3% · dual 70.1% | **E 확정**. ~73% = FS writes만. 달러·묶음 총효과 금지 |
| Production billed 1v2 | **미측정** |
| Listing Created/Deleted 배포 | **DONE** (37) |
| 비교 범위 | **1/2 riders only** (권위) |

### Chief 제공 후속 관측 — 독립 계측 검수 전

결과에 아래 라벨로 **별 섹션**에만 인용한다. 정식 귀속/비용 검증과 구분. 「대성공/근본 해결/완벽 통제/누수 완전 해소」를 기술적 확정으로 쓰지 말 것.

| | peak read/write | run read/write |
|---|---:|---:|
| pre-change 2 riders | 1400 / 280 | 4239 / 855 |
| post-change 2 riders | 471 / 166 | 1366 / 365 |
| post-change 3 riders | 584 / 189 | 1509 / 414 |

계산 (post 2 vs pre 2): peak read **−66.4%** · peak write **−40.7%** · run read **−67.8%** · run write **−57.3%**.
3 rider = **참고 관측** — 이 audit의 성능 검증·비용식 권위 범위를 3명으로 확대하지 말 것.

## 잔여 후보 (우선순위 가설 — 결론으로 쓰지 말 것)

| ID | 가설 |
|---|---|
| A | `routeActivityOnLivePublicationRideWritten` 잔존 invocation 및 mid-ride pulse/anchor 의미 |
| B | FS 4s heartbeat 추가 조정 가능성 및 fallback/stale 품질 경계; 기존 **8–10s 거부** 증거 보존 |
| C | 현재 Trail FS `onSnapshot` read fanout과 RTDB primary / FS fallback 구조 |
| D | RTDB 5Hz의 정지/저속 적응형 cadence 가능성 |
| E | 메뉴 재개방 / Trail 전환 / Stop·완주 후 listener cleanup |
| F | production metrics 귀속을 위한 phase-aligned 측정 / Cloud Monitoring |

각 후보는 **가설**이다. 감사 결과가 “하지 않음(수정 없음)”일 수 있다.

## 결과 문서 필수 목차 (`02-result-…`)

아래 항목을 빠짐없이 채운다. 추측과 근거를 분리한다. 증거 클래스: **C** code/static · **E** emulator · **H** harness · **P** production console · **L** human/Chief observation · **Ø** not measured.

1. **메타** — HEAD SHA · branch · dirty 요약 · 읽은 문서 경로 · 실행한 명령 · **테스트 미실행**(또는 실행했다면 명령·결과; 기본은 미실행).
2. **경로 지도 (현재 tip)** — 후보 A–F에 해당하는 쓰기·구독·CF·정책 파일을 **실제 path:line**으로. 이전 27의 줄 번호가 바뀌었으면 **현재**를 권위로.
3. **후보별 표** (A–F 각각):
   - 이론 비용식 — **1명 / 2명만** 권위 비교 (3명은 참고 각주만 허용)
   - 이미 검증됨 / 미검증
   - 기대효과 (정성·상한; billed 확정 금지)
   - 기능 위험 (fallback·stale·pulse/anchor·동행 품질)
   - 필요 증거 (다음 TASK가 뭘 재야 하는지)
   - Chief 결정 필요 여부 (예/아니오 + 이유 한 줄)
4. **추천 순위** — 가설 순위와 근거; **수정 없음** 선택지를 명시적으로 포함.
5. **비목표 준수 선언** — 이 TASK에서 코드를 바꾸지 않았고, throttle/trigger/RTDB/schema/deploy를 하지 않았음.
6. **범위 밖 발견** — 있으면 구현하지 말고 기록만.
7. **다음 행동 제안** — Supervisor용 (구현 지시 초안이 아니라, 측정·설계·Chief 질문 중 무엇을 열지).

## 완료 조건

- `02-result-remaining-opportunity-audit.md`가 존재하고 위 목차를 충족.
- git에서 **결과 md 외 제품/테스트 변경 없음** (이 TASK 범위에서는 결과 파일만 추가되는 것이 정상; commit은 **이 TASK에서 하지 말 것** — Supervisor가 후속 지시).
- Chief 관측과 emulator/billed를 섞어 “절감 확정”하지 않음.
- 8–10s 거부와 production billed 미측정을 결과에 유지.

## Chief 결정 게이트 (구현 전 — 이 TASK에서는 구현 안 함)

Public Trail 동기화 의미 · Firestore/RTDB 구조 · CF 트리거 의미 · 비용↔fallback 품질을 바꾸는 구현은, 본 audit을 Supervisor가 검수한 뒤 **Chief 승인 전 금지**.

막히면 `BLOCKED` 사유를 결과에 적고 중단한다. 승인 대상 구현을 임의로 시작하지 말 것.
