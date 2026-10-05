# TASK-02 수신 시간축 복구와 양쪽 창 표시 계획

담당 Cursor CLI / Supervisor Codex. 01 지시·02 결과·03 감리 메모·AGENTS.md와 peer-sync 스킬을 읽는다. 다른 편집을 되돌리지 않는다. Chief는 코드·시험을 Cursor가 수행하고 Codex는 계획·지시·감리만 수행하라고 명시했다.

## Supervisor 판정

200ms dual/single 대조로 stamp가 송신 시간축을 도착 시간축으로 바꾸는 결함은 재현됐다. 수정 승인 범위는 **기존 송신 시각 보간 계약의 복구**다. RTDB/Firestore 전송 구조·송신 빈도·wire schema·Rules·기능 의미를 바꾸지 않는 클라이언트 내부 결함 수정이므로 별도 Chief 승인 불필요. 공유 타입/Registry의 외부 호출 계약을 넓히지 않는 방법을 우선한다. 타입 확대·공용 API 변경이 반드시 필요하면 구현 전에 구체안으로 보고한다.

02 결과의 72셀 FAIL을 모두 이 원인으로 해석하지 않는다. 03 감리의 계측/초기 적응/3초 stale 충돌을 분리한다. 기존 결과는 덮어쓰지 않고 수정 전 수치를 별도 보존한다.

## 허용 범위

1. scripts/peer-sync 재현 하네스의 fixture/계측 개선. t=0 FS 생성 때 `max(intervalMs, ...)`로 미래 좌표를 만들고 있다. 수신 전에 미래 위치가 들어가지 않게 수정하고, 신규 재현기의 무지터·등속 대조 검산을 추가한다. 실제 이벤트마다 sync 호출(한 프레임 여러 도착을 하나로 합쳐 없애지 않는다). 초반 적응과 충분한 안정 구간을 별도로 기록한다. 시작 결함을 warmup으로 숨기지 않는다.
2. `syncFromPresence.ts` 및 integrator/Registry 내부의 필요한 최소 수정. **한 소스에서 t 증가량을 보존**하고, 소스 바뀔 때만 각각의 시계 기준을 정렬한다. 수신 관측 liveness는 freeze 재배달에 갱신되지 않게 유지한다. 한 구현 후보는 stamp 함수에서 source별 원본 시각을 일정 offset으로 receiver 축에 매핑하고 동일 source 동안 `nativeTime + offset`을 유지하는 것이다. 매 신규 패킷 `nowMs` 재지정은 금지. 현재 API를 유지하면서 가능한지 먼저 판단한다. 더 적합한 최소 수정이 있다면 근거를 기록한다.
3. 정상 dual/single 및 RTDB-only↔dual↔FS-only, silent freeze·hard error·recovery, stationary/paused/completed, ±30s 시계 회귀. production 패킷의 seq는 DEV-only이므로 seq가 없는 입력도 검증한다.
4. scripts/peer-sync/scenarios.mjs에 이번 결함의 재현을 고정하거나, 실제 두 소스 하네스를 별도 필수 gate로 연결한다. 현재 stock replay가 두 소스 경로를 우회하는 사각을 문서화한다. `--graph` PNG로 전후 간격/속도 시각 비교를 생성하고 확인한다.

## 완료 조건과 검증

- 100/200/1000ms의 등속 sin/bundle + 양쪽 skew에서 안정 구간 역행·텔레포트 없이, 수정 전/후 속도 폭·간격 pp를 비교한다. 200ms dual은 single 수준(간격 pp ≤0.5m, 안정 속도 약 ±20%)을 목표로 한다. 실패 게이트를 현재 catchup 한도에 맞춰 느슨하게 하거나 known-fail로 숨기지 않는다.
- 3000ms는 현재 source-stale 2500ms와 지연 상한의 지원 범위 충돌을 보고한다. 전송 상수/정책 상한을 바꾸어 억지 PASS를 만들지 않는다. 이번 수정으로 해결되지 않는 셀은 원인과 별도 해결 필요를 명시하며 all-pass로 보고하지 않는다.
- `node scripts/peer-sync/replay.mjs --check` 전체, 기존 smoothness/liveness/source-select, `rtdb-fs-fallback-harness.mjs` 전체 suite, motion publish 관련 계약, 변경 파일 eslint, `npx tsc --noEmit` 실행. 결과 명령/exit/미실행 이유를 기록한다.

## 양쪽 창 문제: 분석·구체 계획만

Chief가 두 창의 순서/위치 불일치를 추가 제보했다. 현재 self 즉시 / peer 과거 보간 차이를 **두 창 재생**으로 거리 격차·역순 구간·속도 변경 반영 지연으로 보여라. 두 방향의 네트워크 지연/시계 차이도 넣는다. renderer 카메라/좌표 변환과 publication geometry 동일성 문제 가능성도 코드 근거로 구분한다. 색상은 self/peer에 따라 다르므로 이름표·uid·경로 거리를 기준으로 비교한다.

표시 정책 선택(공통 과거 시점 vs 현재 위치 예측)은 Chief 미선택 상태다. 이 단계에서 제품 표시 정책/카메라/HUD를 바꾸지 않는다. **권고안 하나와 구체 변경 파일·지연 예산·서버 공통 시계 확보 방법·네트워크 stall의 한계·트래픽 증분·검증 완료 조건**을 06-plan-two-view-consistency.md에 작성한다. 현실의 지연이 있다는 사실과 현재의 큰 역순 오류를 혼동하지 말고, 공통 지연도 양쪽이 독립적으로 다르면 순서 일치를 보장하지 못함을 반영한다. 예측 방식의 전후 수치를 오프라인 비교할 수 있으면 비교한다.

## Git / 보고

현재 브랜치 fix/peer-spacing-jitter(main2와 동일한 base에서 생성). commit/push/merge/배포 금지. 결과 05-result-fix.md, 승인용 계획 06-plan-two-view-consistency.md. ops 색인/PROGRESS는 Supervisor가 갱신한다. 범위 밖 발견은 보고하며 확장하지 않는다.
