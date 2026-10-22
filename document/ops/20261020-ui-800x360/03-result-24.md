# 거리 자동 생성·삭제 후 재시작 결과

2026-10-22 · record · Codex 직접 교정. [지시24](02-task-24.md).

- 최신 Chief 요구에 따라 방향 클릭에서 보관 후 대기하던23 동작을 자동 탐색으로 대체. 현재 수단으로 `handleMapPick`→`onApplyRoute`까지 진행하며 수단 버튼은 표시·기존2사이클 강조 후 같은 방향 재탐색에 사용한다. ‘여기에서 계속’의 승계 거리는 확정값으로 취급하고, programmatic popup은 거리 탭을 명시한다.
- 거리 탭에서 경로 삭제 시 창을 닫거나 위치 탭으로 강제 전환하지 않는다. 출발 미지정 안내·기존 출발 버튼을 표시한다. 새 위치를 길게 눌러 popup을 재개해도 거리 탭을 보존하고 같은 출발 버튼으로 지정한다. 새 복제 버튼/별도 endpoint UI 없음.
- popup 교체·닫기에서 이전 AbortController를 정리해 구독·이전 DOM 콜백을 남기지 않는다. App 경로 삭제 시 continuation 고정 anchor도 해제한다.
- 실제 hook 통합 검수에서 자동차 재탐색 API는 driving인데 결과 적용은 stale cycling인 경합 재현. 요청 당시 profile/목표거리를 스냅샷으로 사용하고 결과도 같은 profile로 적용한다.
- 탐색 중 삭제 시 hook requestId를 무효화하고 MapView busy를 즉시 해제. 옛 응답/실패가 새 UI·경로에 적용되지 않도록 sequence를 비교한다. 취소 전 이미 발생한 서버 요청을 취소하거나 환불하는 변경은 아니다.
- raw 클릭 디버그 마커는 일반 개발 화면에서도 숨기고 DEV + `?distanceRouteDebug=1`에만 표시한다. production 차단 유지. 일반 방향 클릭에는 임시 도착 마커가 필요 없다.

실제 hook/bridge/MapView 통합 fixture 추가, 경로 API/prewarm만 대체. ‘계속’ 자동 생성→수단 변경→삭제→새 출발→생성, 탐색 중 삭제→즉시 재시작→옛 응답 도착 무시까지 PASS. 거리144·브라우저14종 분할·타입/lint/build/diff PASS. 실제폰/실 API/실 주행은 미검증. 기존5002 최신 코드 HTTP200 확인·보존, 이번 Playwright가 시작한5000(PID27780)만 종료. 커밋·푸시·배포 없음.
