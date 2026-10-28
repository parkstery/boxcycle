# 중간 감리 메모 — 최종 판정 아님

Codex가 Cursor 구현 중 읽은 순수 로직 기준. 연결 hook/시험 작성 전일 수 있으므로 최종본과 실제 호출 계약으로 재판정한다.

`rideMoments.ts` 검증 필요 사례:

1. running→idle와 ended payload가 같은 render로 도착하면 첫 idle-reset 분기가 종료 이벤트보다 앞서 있어 완주/자발종료가 소실되는지 확인. App 실제 종료 상태/결과 도착 순서로 검증할 것.
2. remainingSec=3 경고를 이미 재생한 상태에서 paused→running 하면 paused 분기가 warnedStep을 null로 지워 같은 전환 경고가 반복되는지 확인. 전환당1회 유지 필요.
3. 큰 시간 점프로 interval.phase=complete에 도달한 틱은 억제돼도 다음 정상 틱에 intervalCompleted=false라서 지난 완료가 지연 재생되는지 확인. 건너뛴 사건은 소비 상태도 갱신해야 함.
4. 완료된 인터벌 구성을 주행 중 변경해 다시 시작할 때 intervalCompleted/intervalStarted/warnedStep을 세션과 별개인 인터벌 실행 단위로 초기화하는지 확인. interval step/phase만으로 새 실행을 확실히 구분할 수 있는지 점검.
5. `intervalTransitionEvent(interval.phase === "warmup" ? "warmup" : "warmup")`는 항상 warmup이며 준비0초 시작에서도 준비부터라는 문구를 낼 수 있음. 실제 시작 구간에 맞출 것.
6. 효과음 AudioContext 생성은 resume.catch 바깥이므로 생성자 예외도 조용히 무시해야 하는지 검증. 느린 resume가 주행 종료 뒤 오래된 효과음을 재생하지 않는지도 확인.
7. 종료 후 idle에서 ended=true를 계속 보존하고 새 running도 next.ended로 차단해 **두 번째 주행의 시작/성취가 모두 억제되는지** 확인. 종료 중복 억제와 새 주행 메모리 초기화를 함께 검증할 것. review-probes.ts에 첫 주행종료→idle→새주행 재현 추가.

아직 제품 수정 요청을 별도 실행자에 중복 발행하지 않았으며, Cursor 완료 후 감리/후속지시에 반영한다.

## 실제 화면 감리

- 첫 제품 프리뷰800×360에서 순위표를 펼치면 제목/행이 카메라·지도·계정 컨트롤과 겹친다. `.lb-glance__panel` top=pad+8px로 옮긴 것이 원인 후보. 실제 캡처 `evidence/supervisor-initial-riding-800x360.png`. 순위 핸들 위치뿐 아니라 **펼친 판 전체 rect 대 우상단 컨트롤/주행제어 rect 비겹침**이 검수 기준이어야 한다. 새 e2e는 현재 핸들 좌표만 검증해 이 회귀를 놓친다. 작은 높이에서는 위쪽 컨트롤 아래~아래쪽 주행제어 위에 판을 제한하고 목록 안만 스크롤해야 한다.
