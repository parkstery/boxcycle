# 감리31 — 터치·기능 통과, 실제 펼침 배치 재작업

2026-10-14 Supervisor Codex. pick-31-qa.cjs 4viewport×5상태20 PASS. 토글 두 개44px 및 같은 y좌표, 기능/입력보존/키보드/오류/토큰 PASS. 실제 Guest 위치→거리→위치 및 bridge 종료 두 viewport PASS.

REWORK_REQUIRED: 실제740×300 distance 캡처에서 dock는 기존 top132를 유지해 늘어난 내용 하단이 화면 밖으로 나감. live script의 초기 판정은 기능만 검증했으며 화면 잘림 합격은 아니다. [지시32](02-task-32.md)에서 dock 크기 변화 관측을 기존 위치 계산에 연결, rect 경계 검증 추가. 실기기/방향 클릭 후 원격 탐색/주행 미검증.
