# 검수15a — 위치 버튼 테두리 / 문구 결정 대기

2026-10-18 Codex Supervisor. Developer Cursor Auto, 세션 `b6f0ab2e-f715-44d3-82ae-404ce743c20b`.

기본 위치 버튼 테두리 `#cbd5e1` → `#2563eb` 수정 확인. 기존 CSS 다른 선언 및 TSX 유지. Edge headless 계산 스타일: 667×300, 740×300, 1366×768 모두 rgb(37,99,235), 터치 높이44px, 화면 안 배치 PASS. 증거 `.out/entry-location-15/border-check.json`. inline Playwright Node 검증 종료0. CSS 색 한 선언으로 빌드/인증/실GPS 시험은 미실행. 커밋/푸시/배포 없음.

첫 버튼 두 줄은 미구현. Native geolocation의 문구가 브라우저 제어이며 지원 시 자식이 렌더되지 않음. 일반 버튼 대체는 이전 지시10·11의 차단 복구 동작과 충돌하므로 Chief 선택 질문 발송, 답변 대기. 공식 근거와 허용 범위는 [지시15](02-task-15.md).

Chief 확인: PowerShell에서 `Set-Location C:\20.HDev\boxcycle\apps\web` 다음 `npm run dev -- --host 127.0.0.1 --port 5000` (기존5000서버가 있으면 재사용). http://127.0.0.1:5000/ → 게스트로 시작 → 위치 선택 창의 기본 위치 버튼 파란 테두리 확인. 실제 위치 차단 복구/스마트폰 수동 검증 미실행.
