# 경로창 가장자리 유지 결과

2026-10-22 · record. [지시27](02-task-27.md).

기존 후보 중 HUD와 충돌하지 않는 좌우 가장자리 후보를 상하 중앙보다 먼저 선택한다. 좌우가 모두 막히면 기존 HUD collision-free 후보로 fallback한다. 최초 배치 결과를 저장해 경로/토큰 문구 높이 변경·재탐색 때 초점 점수가 바뀌더라도 창을 재배치하지 않는다. 사용자 드래그 위치도 같은 저장/clamp 경로로 보존한다. 창 닫기/새 위치창은 기존 초기화 유지, 화면 크기 밖은 clamp한다.

거리145 PASS(가장자리 우선1회귀 추가), 실제hook/browser4 PASS(연속방향 재탐색에도 가장자리x변화≤1px), build exit0/4.02s·타입포함. 개발등록부에서24에 추가한 distanceRouteDebug query 미등록1 FAIL을 발견해 기존 module enable 설명과 query 항목을 등록, check-dev-tools PASS/WARN0. 커밋 게이트 lint·푸시 전체 게이트는 검수27에 기록. 기존 공용ops2 dirty·out/cdbox/이전evidence 제외, 이번 제품/시험/개별ops만 선별 반영.
