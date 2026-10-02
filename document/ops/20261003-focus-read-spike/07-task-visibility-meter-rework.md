# TASK-02R — visibility meter 정확도 재작업

Owner: Cursor CLI Developer. [06 검수](06-review-visibility-meter.md)의 네 결함만 수정하라.

허용 파일은 TASK-02에서 만든/수정한 계측·테스트·E2E·ops 결과와, 실제 routeActivity network call 계수에 필요한 최소 repo 파일이다. 제품 listener 정책, poll 주기, catalog 동작, 데이터 모델, Rules는 바꾸지 말라. production 접속·commit·push·deploy 금지.

## 완료 조건

- routeActivity batch invocation과 실제 cache-miss `getDoc` proxy를 혼동하지 않는다.
- 모든 network proxy 계측 위치가 cache guard 뒤, Firebase 호출 바로 앞임을 테스트 또는 코드 근거로 확인한다.
- production에서 visibility override subscribe/set은 완전 no-op이다.
- N=3 Emulator 검증을 시도한다. 성공하면 10 cycles 기대 delta를 기록하고, 실패/비현실적이면 순수 모델임을 명시하고 기존 E2E와 섞지 않는다.
- focused tests, s42 meters, dep check, tsc, changed-file lint, focused E2E를 재실행한다.
- 결과는 `08-result-visibility-meter-rework.md`에 작성하고 05의 과장된 문구는 정정 링크를 남긴다.

