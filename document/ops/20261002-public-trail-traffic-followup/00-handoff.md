# Handoff — Public Trail traffic followup

| 항목 | 내용 |
|------|------|
| 문서 유형 | **ops handoff** — 새 창에서 즉시 시작하기 위한 공식 인수인계 |
| 독자 | **AI** (Supervisor · Developer) |
| 최초 작성 | 2026-10-02 |
| 상태 | **진행 중** — 묶음 `READY_FOR_DEVELOPMENT` |
| 연결 문서 | [묶음 README](README.md) · [TASK-01](01-task-remaining-opportunity-audit.md) · [이전 묶음](../20260929-public-trail-traffic/README.md) · [최종 보고](../../archive/261001-Public-Trail-동행-트래픽-개선-결과보고.md) |

---

## 1. 한 줄 요약

이전 Public Trail 트래픽 개선은 **배포 완료·묶음 종료**. 후속은 **추가 저감 여지의 증거 기반 검토**이며, 첫 일은 코드 수정 없는 **잔여 opportunity audit**다.

## 2. 역할

| 역할 | 담당 | 이 묶음에서의 일 |
|---|---|---|
| Chief | 사람 | 제품·구조·비용 의미 있는 구현 승인; 최종 완료 승인 |
| Supervisor | Codex | 범위·게이트·검수; 구현 지시 설계 |
| Developer | Cursor CLI | 지정 지시만 조사·검증·결과 문서 작성 |

## 3. 공식 환경

| 항목 | 값 |
|---|---|
| Worktree | `C:\Users\kdrea\.codex\worktrees\public-trail-traffic-followup\boxcycle` |
| Branch | `codex/public-trail-traffic-followup` |
| Base SHA | `2cdaea6b7ca6468254e239a2fd2b2ab719c27c62` (`origin/main`과 정렬된 시작점) |
| 이전 traffic worktree | **정리됨** — 이 경로가 공식 후속 환경 |
| Stash / 백업 경로 | 이 작업에 불필요. Developer는 **건드리지 말 것**. 비밀·환경값은 문서에 쓰지 말 것 |

제품 코드 기준은 이 worktree의 **현재 main 계열 tip**(시작 시 `2cdaea6`)이다. 이전 묶음 결과의 line/ref는 **당시 SHA**일 수 있으므로, audit에서는 **현재 트리에서 재확인**한 경로·줄을 적는다.

## 4. 확정 baseline vs Chief 후속 관측

### 4.1 확정 (이전 묶음 · 최종 보고)

- 배포 DONE: listing Created/Deleted + Hosting ([37](../20260929-public-trail-traffic/37-result-r2-deploy.md)).
- Emulator **E**: 28D-B(1s)→31B-R(4s) FS writes solo **73.2%** / dual **72.5%**; hub solo **72.3%** / dual **70.1%**. 약칭 ~73% = FS writes만. 비용·production 배수로 쓰지 말 것.
- Production **billed** 1v2: **미측정**.
- 비교 범위 권위: **1 rider / 2 riders only**.
- FS 8–10s throttle: **거부** 증거 유지 ([27](../20260929-public-trail-traffic/27-result-remaining-traffic-audit.md) · 최종 보고).
- `routeActivityOnLivePublicationRideWritten`: listing과 달리 **update마다 invocation 잔존** (handler early-return 가능).

### 4.2 Chief 제공 후속 관측 (독립 계측 검수 전)

정식 귀속·비용 검증과 분리. 사용자 만족·방향성 강한 증거일 뿐, 기술적 「대성공/근본 해결/완벽 통제/누수 완전 해소」로 승격하지 말 것.

| | peak R/W | run R/W |
|---|---:|---:|
| pre 2 riders | 1400 / 280 | 4239 / 855 |
| post 2 riders | 471 / 166 | 1366 / 365 |
| post 3 riders (참고) | 584 / 189 | 1509 / 414 |

post 2 vs pre 2 계산: peak read −66.4% · peak write −40.7% · run read −67.8% · run write −57.3%.  
3 rider는 참고만 — 첫 audit 성능 검증 범위 자동 확대 금지.

## 5. 잔여 후보 (가설 · 결론 아님)

감사 시 우선순위 **가설**로만 다룬다. 결론·채택 결정은 결과 검수 후.

| ID | 가설 주제 |
|---|---|
| A | `routeActivityOnLivePublicationRideWritten` 잔존 invocation · mid-ride pulse/anchor 의미 |
| B | FS 4s heartbeat 추가 조정 가능성 · fallback/stale 품질 경계 (8–10s 거부 증거 보존) |
| C | 현재 Trail FS `onSnapshot` read fanout · RTDB primary / FS fallback 구조 |
| D | RTDB 5Hz의 정지/저속 적응형 cadence 가능성 |
| E | 메뉴 재개방 / Trail 전환 / Stop·완주 후 listener cleanup |
| F | production metrics 귀속을 위한 phase-aligned 측정 / Cloud Monitoring |

## 6. 첫 TASK 산출물 요구 (요약)

Developer는 [01-task-remaining-opportunity-audit.md](01-task-remaining-opportunity-audit.md)에 따라 `02-result-remaining-opportunity-audit.md`만 작성한다.

필수 포함: 현재 main 코드 기준 경로 지도 · 후보별 이론 비용식(**1명/2명만** 권위 비교) · 이미 검증/미검증 · 기대효과·기능위험·필요 증거·Chief 결정 필요 여부 · 추천 순위 · **수정 없음** 선택지 · 실제 line/ref·명령 · 테스트 미실행 사실을 사실대로.

금지: 코드/테스트 수정 · commit · push · deploy · production write · 즉시 throttle/trigger/RTDB rate 변경.

## 7. Chief 결정 게이트

다음을 **바꾸는 구현**은 audit + Supervisor 검수 후 **Chief 승인 전 금지**:

- Public Trail 동기화 의미
- Firestore / RTDB 구조
- Cloud Function 트리거 의미
- 비용과 fallback 품질 트레이드오프

## 8. 이전 묶음 필수 읽기 (근거)

| 문서 | 왜 |
|---|---|
| [최종 보고](../../archive/261001-Public-Trail-동행-트래픽-개선-결과보고.md) | 확정 baseline · 말할 수 있음/없음 |
| [27-result](../20260929-public-trail-traffic/27-result-remaining-traffic-audit.md) | 잔여 경로·8–10s 거부·routeActivity Written |
| [30 / 30c](../20260929-public-trail-traffic/30-result-rtdb-fs-fallback.md) | RTDB→FS fallback · dual-source liveness |
| [31b](../20260929-public-trail-traffic/31b-result-meter-4s.md) | 4s after meters (권위 표) |
| [37](../20260929-public-trail-traffic/37-result-r2-deploy.md) | production 배포 inventory |

---

## 9. 새 창 시작용 짧은 프롬프트

아래를 그대로 새 Supervisor/Developer 창에 붙여 넣는다.

### 9.1 Supervisor가 읽을 파일 순서

1. `document/ops/README.md`
2. `document/ops/PROGRESS.md`
3. `document/ops/20261002-public-trail-traffic-followup/README.md`
4. `document/ops/20261002-public-trail-traffic-followup/00-handoff.md`
5. `document/ops/20261002-public-trail-traffic-followup/01-task-remaining-opportunity-audit.md`
6. (근거) `document/archive/261001-Public-Trail-동행-트래픽-개선-결과보고.md`
7. (근거) `document/ops/20260929-public-trail-traffic/27-result-remaining-traffic-audit.md` · `30-result-rtdb-fs-fallback.md` · `30c-result-dual-source-liveness.md` · `31b-result-meter-4s.md` · `37-result-r2-deploy.md`

### 9.2 Cursor CLI Developer 호출 순서

워크스페이스: `C:\Users\kdrea\.codex\worktrees\public-trail-traffic-followup\boxcycle`  
브랜치: `codex/public-trail-traffic-followup`

```text
document/ops/20261002-public-trail-traffic-followup/01-task-remaining-opportunity-audit.md 를 읽고 지시된 범위만 수행하라. 제품·테스트 코드는 수정하지 말고, 조사 후 02-result-remaining-opportunity-audit.md 만 작성하라. commit/push/deploy 금지. 테스트는 지시가 요구하지 않으면 실행하지 말고 미실행으로 기록하라.
```

로컬 `agent` 예시 형태(옵션은 `agent --help` 확인):

```text
agent -p --workspace C:\Users\kdrea\.codex\worktrees\public-trail-traffic-followup\boxcycle "document/ops/20261002-public-trail-traffic-followup/01-task-remaining-opportunity-audit.md 를 읽고 지시된 범위만 수행한 뒤 02-result-remaining-opportunity-audit.md 를 작성하라"
```

Developer 종료 후 Supervisor는 `02-result-…`와 git status(코드 diff 없어야 함)를 검수한다.
