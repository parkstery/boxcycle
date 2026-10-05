# TASK-36 — Supervisor 검수 보완

담당 Cursor CLI. 35 결과와 실제 소스 검수 후 REWORK_REQUIRED. 기존 구현·주기·D600·타 작업 변경을 보존한다. Chief 추가 승인 불필요: 승인 범위 내 진단 정확성 및 비용 검증. commit/push/deploy/실주행 금지.

1. `notePeerFrameDiag`의 capture 간격 판단은 직전 **실제 프레임** dtMs를 사용한다. 60fps라면 첫 표본 뒤 매 프레임 dt<40으로 계속 누락된다. 마지막 **capture에 저장한 표본** 시각을 UID별로 추적해 40ms 간격을 판단하라. capture마다 초기화하고 실제 dtMs 필드는 그대로 보존한다. fake clock 20초 60fps 및 120fps, 두 UID에서 시간 범위가 끝까지 남는지 행동 시험하라(상한 전체 500 의미를 명시). 완료 뒤 live 덮어쓰기, reset, 반복 호출, download의 실제 Blob JSON 내용까지 확인.
2. 완료 capture export는 저장 당시 카운터/maxJump를 보존하라. 현재 live 카운터로 바꾸면 과거 capture 프레임과 서로 다른 시간 구간이 섞인다. 필요하면 live 지표를 별도 명시하되 간결하게 유지.
3. 거리 정밀도 변경 전후 실제 encodePayload JSON UTF-8 바이트를 동일 표본/송신 횟수로 측정하라. 평균·최대 delta와 5회/초 rider 한 명 시간당 증분(전송 overhead 제외)을 기록. 송신 횟수/주기 불변 확인.
4. 현재 quantize harness는 원본 JSON을 읽지 않는 등속 합성 시나리오다. 제품 함수 사용은 적절하지만 실측 파일 자체의 before/after replay 또는 유일 확정 원인으로 보고하지 말라. 실측 관찰과 실측 조건 기반 합성 재현을 분리하고, 후자는 양자화의 인과적 기여 증거로 한정. 원본 반올림 전 거리는 복구 불가. 35는 보존하고 37에서 정정.
5. skill 그래프 검수를 위해 실측 running 상대간격과 합성 before/after 전체 시계열을 저장하고 PNG 비교 그래프를 생성(기존 plotting 환경 활용). 프레임/표본의 시간축 및 양자 비트를 볼 수 있어야 한다. 짧은 여러 publish phase(0/40/80/120/160ms)와 속도(5/6/20km/h)에서 0.01m가 악화하지 않는지 검사하라. 과도한 임계 완화 금지.

완료: 새 행동 시험, quantize gate/mutation, 관련 회귀 및 실제 tsc-b. 명령별 120초; 10분 내 중간 증거; 브라우저 대기 없음. `37-result-review-capture-and-evidence.md`에 사실·실패·미실행 분리. README/PROGRESS 갱신.
