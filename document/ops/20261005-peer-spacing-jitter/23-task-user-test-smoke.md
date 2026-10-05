# 사용자 테스트 진입 smoke — 짧게

Codex · 2026-10-05. 22의 정상 동행 개선은 사용자 사전 테스트 후보로 인정한다. 운영 완료/배포 승인 아님. oneWayStall39.8%, clockJump3.45m는 남은 결함/한계이며 PASS로 이름 바꾸지 않는다.

1. 정상 후보 test gate가 상대 간격 오차/peer점프보다 순서만 검사하는 한계와 누락된 queue/coalescing/route전환/±30s 기기skew는 결과24에 정확히 미실행으로 기록한다. 수정 없는 전체 반복 금지.
2. 사용자 안내 명령이 실제 작동하는지 짧게 확인한다. 현재 cwd `C:\20.HDev\boxcycle` 루트에서 `npm run dev -- --host 127.0.0.1 --port 5010 --strictPort`를 시작해 HTTP200 및 앱 entry/module 컴파일 확인. 서버 준비까지 최대60초, 필요하면 clean 종료. 충돌이면 프로세스 종료하지 말고 다른 명시 port로 변경. 포트·start명령·선택모드·동일Trail 두독립브라우저프로필(서로 다른uid; 같은인증공유창만쓰면안됨)을 사용자 절차에 기록. 비밀 출력 금지. 브라우저 실주행은 하지 않는다. 실제 환경이 production모드인지 확인하고, local URL이 운영Firebase 데이터를 사용함을 명시한다. emulator 시작 명령 없이 emulator만 안내하지 않는다.
3. 결과24에는 테스트가능 경로(기존 checkout이며 타작업 혼재), 확인된 command/URL/HTTP 및 compile진단, 남은 결함/미실행을 간단히 쓴다. 이단계 제품 코드 변경/commit/push/deploy 없음. 장시간 대기금지.
