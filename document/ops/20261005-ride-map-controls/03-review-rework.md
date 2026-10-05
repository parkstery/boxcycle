# 첫 검수 — 재작업 필요

| 항목 | 내용 |
|---|---|
| 문서 유형 | execution — Codex Supervisor 검수 |
| 최초 작성 | 2026-10-05 |
| 상태 | REWORK_REQUIRED |

토글과 배치는 확인됐고 selectors/typecheck/framing 검증은 보고됐다. 하지만 거리 상태 변경만으로는 Chief가 요청한 줌 동작을 만족하지 않는다.

1. `+`가 멀게·`−`가 가깝게 동작한다. 줌 UI는 `+` 확대·`−` 축소가 되어야 한다.
2. QC2/3은 product tune 거리 덮어쓰기, QC1 routeFit은 free여서 화면이 바뀌지 않는다. 기존 한계를 그대로 복제한 버튼은 기능 완료가 아니다.
3. 보고된 overlap은 visual rect만이며 pseudo 44px 터치 영역의 이웃 버튼 침범도 확인해야 한다. 전 캡처는 추정치이므로 실제 전 캡처로 표기하지 않는다.

사용자가 줌 제어를 요청했으므로 **명시적 사용자 줌을 기존 preset 기본값보다 우선**하게 연결하는 최소 수정은 승인된 범위다. 제품 preset 자체·pitch·bearing·앵커·기본 진입값·sync 알고리즘을 바꾸지 않는다. [04 재지시](04-task-zoom-rework.md)를 따른다.
