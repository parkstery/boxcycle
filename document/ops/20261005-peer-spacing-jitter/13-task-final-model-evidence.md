# TASK-05 승인 전 모델 실행 근거만 보완

Supervisor Codex / Developer Cursor CLI. 11 코드 최종 검증 PASS와 실제 all-source stamp diff를 확인했다. **제품 코드/수신 코드 변경·기존 전체 검증 반복 금지**. 이번은 아래 세 항목만 구현/측정/기록한다. 다른 작업 untracked 파일(focus-read 관련)이 생겼으므로 건드리거나 git add 하지 않는다. commit/push/배포 금지.

1. `two-view-order-harness.mjs`에 common-timeline D=600ms 모델을 **실제로 실행**하라. 문서의 사고실험 표만으로 10 지시의 ε 행렬을 완료했다고 보지 않는다. 송신 샘플 timestamp = real capture + sender clock-estimate error, 각 창 renderTime = real now + viewer clock-estimate error −600. self도 동일 샘플/시계 규칙. 두 clock error 0/±50/±100ms 조합(특히 +100/-100, 그 반대)에서 등속 1m/15m 간격·추월·20→30→10·비대칭 링크·한쪽 stall을 기존 시나리오로 재생. 제품 `tSrv` wire 구현 시험과 구분해 **모델**이라고 표시. 양쪽 순서 mismatch뿐 아니라 truth와의 거리/순서 오차, tie 제외/포함 수치를 측정하고 자기 검산을 넣는다. 실제 캡처/도착 이벤트 버퍼를 사용해 미래/미수신 표본을 몰래 사용하지 않는다.
2. tie 계산은 **두 기기의 시계 오차 합**과 관련 속도·거리 양자화 등을 고려하라. ε_budget=100ms를 한 기기 오차로 넣어 tie≈0.83m라고 쓰면 +100/-100의 차이 200ms를 빠뜨린다. 0.5m 하한과 둘의 불확실성 합을 반영한 보수적 기준을 명시한다. 실제 SDK offset 오차가 100ms 이내라고 보장하지 않는다.
3. 계획 정정: 공통 D이면 self와 peer 모두 늦춰 그리므로 **상대 간격은 D×v만큼 벌어지지 않는다**. 12 §7의 「1초 송신 D≈2.2s이면 상대가12m 뒤처짐」처럼 읽히는 표현을 바로잡는다. D×v는 **각 rider가 현재 진실보다 지연된 거리**, 자기 반응 지연의 체감 문제와 별개다. `tSrv`는 「수 바이트/미미」대신 JSON timestamp key+13자리 값의 대략 **20~25 raw bytes/update**, 5Hz 약0.36~0.45MB/hour/rider(프레이밍·압축·fanout 제외)로 정량화하고 실제 값은 encode 계측 필요라고 쓰라. 송신 횟수·FS r/w 증분은 없음.

기존 12는 보존. 결과·정정·승인용 권고안을 **14-result-model-and-final-plan.md 한 파일**로 간결히 작성한다. 원시 지표 JSON은 `.out`와 ops 요약에 보존. 변경 하네스 실행/문법 검사만 수행하고 종료. Supervisor가 14와 실제 하네스 diff/원시 수치를 검수 후 Chief에게 표시 정책 승인을 요청한다.
