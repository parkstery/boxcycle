# 길게 누르기 초안 검수

2026-10-22 · record · REWORK_REQUIRED. Cursor CLI 초안의 단위10/타입 PASS를 확인했으나 Supervisor 실제 MapView 시험에서 메뉴 열린 상태의 지도 길게누르기가 경로창을 여는 실패를 재현했다. 경로창 자체를 overlay로 차단하면 열린 거리·방향 선택까지 막히는 코드 문제와 pan/zoom 시작시각만 기준으로 억제하는 문제도 확인했다. 후속18에서 Codex가 직접 교정하고 재검수한다. Cursor 프로세스 종료 exit0 후 writer 교대, 같은 파일 동시 수정 없음.
