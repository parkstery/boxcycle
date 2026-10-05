# TASK-01 실제 수신 경로 진동 재현

담당: Cursor CLI. Supervisor Codex와 같은 작업 디렉터리를 사용한다. 다른 변경을 되돌리지 않는다.

사용자 증거: 2026-10-05 두 창의 등속 약 20km/h 주행에서 Guest와 상대의 간격이 수초 주기로 겹침/벌어짐을 반복한다. 이미지로 실제 패킷 지연 수치는 확정할 수 없다.

먼저 AGENTS.md, peer-sync SKILL.md/HARNESS.md를 읽는다. 이전 sync-relay 대기 지시는 적용하지 않는다.

조사 대상: 송신 좌표와 t의 생성, syncPeerMotionFromPresence → stampDualSourceIngestPacket → Registry → integrator → renderer. 특히 두 소스가 있으면 serverAtMs를 nowMs로 덮는 경로가 송신 시각 보간을 무력화하는지. 단일 스트림 시험은 이 경로를 우회한다.

허용: scripts/peer-sync의 결정적 회귀 재생/시험 추가, 조사 결과 기록. 프로덕션 코드는 이 단계에서 수정하지 않는다. git commit/push/merge/배포 금지. 네트워크 문헌 검색 불필요: 저장소 실행 근거로 판정.

완료 조건: 실제 syncPeerMotionFromPresence/Registry를 통과하는 등속 두 소스 재생에서 100/200/1000/3000ms 간격과 지연 jitter/묶음 도착, ±30s 송신 시계 조건을 조사한다. 안정화 뒤 자기 등속 대비 상대 간격 폭, 화면 min/max speed, 역행/순간이동을 정량화한다. 기존 replay/check와 smoothness/fallback/liveness 시험 결과를 구분한다. 재현 실패를 숨기거나 known-fail로 회피하지 않는다. 재현 시험은 수정 전 실패를 보여야 한다.

수정 제안은 기존 송신 t와 liveness 관측을 구분하고, 소스 전환 시 시계 차이와 freeze 후 15s 소멸을 보존하는 최소 변경으로 작성한다. 공용 interface/schema/동기화 구조 변경이 필요한지 보고하고 구현은 다음 지시를 기다린다.

결과: document/ops/20261005-peer-spacing-jitter/02-result-investigate.md. 실행 명령·통과/실패·원시 수치·한계·추천 범위를 적는다.

## Chief 추가 증거 (조사 중)

속도 변경이 자기 창과 상대 창에 다른 시점에 반영되고, 양쪽 창에서 주행 순서가 반대로 보인다. 이 역시 분석 대상. 현재 self 즉시 / peer 과거 보간 구조와 jitter 결함을 구분한다. 두 창 재생이 가능하면 자기/상대의 두 표시 거리 차이와 순서 불일치 구간을 기록한다. 공통 과거 시점 표시 vs 현재 위치 예측은 Supervisor가 Chief에게 선택을 요청한 상태이며, 렌더 정책/아키텍처는 아직 변경하지 않는다.
