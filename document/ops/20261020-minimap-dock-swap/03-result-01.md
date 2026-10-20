# 결과01 — 위 RouteDock / 아래 미니맵

2026-10-20. branch main2, HEAD 6cd54e27. 시작 시 AGENTS·CLAUDE·ride-result 시험4파일·ops README/PROGRESS 및 여러 untracked 파일이 dirty였고 보존했다.

Cursor 실행: `agent -p --workspace C:\20.HDev\boxcycle "document/ops/20261020-minimap-dock-swap/README.md와 02-task-01.md를 읽고 지정 범위만 구현·검증한 뒤 03-result-01.md를 한국어로 작성하라."`. exit1, `uv_os_get_passwd returned ENOMEM`. 실제 모델 응답·세션 생성 없음. Codex가 직접 구현·검증했다.

변경: App.tsx에서 미니맵을 MapBottomLeftStack의 마지막 자식으로 이동. MapBottomLeftStack.css에서 최소8px 간격·미니맵 position:relative 적용. RouteMinimap.tsx의 dock 위 절대좌표 측정 제거, 스택 bottom−dock 실측 높이−HUD 경계로 가용 높이 계산. RouteMinimap.css의 과거 좌표 폴백 제거. 새 API·디버그 주소·영구 스크립트 없음.

명령(실행 폴더 C:\20.HDev\boxcycle\apps\web):
- `node scripts/ride-verify/verify-selectors.mjs`: exit0, 19단계 PASS.
- `npx tsc -b`: exit0.
- `npx eslint src/App.tsx src/features/map-overlays/RouteMinimap.tsx`: exit0, 오류0/기존 App 훅 경고7.
- 저장소 루트 `git diff --check`: exit0.

브라우저: 기존 http://127.0.0.1:5000 Vite를 재사용하고 네트워크 라우트로 메모리 전용 HTML을 제공해 실제 RouteDock·RouteMinimap·MapBottomLeftStack과 제품 CSS를 렌더링했다. Firebase·App 전체 진입은 실행하지 않았다. Chromium headless, 긴 주소, riding 펼침/접힘·paused·ready-to-start·idle 확인. pageerror0. 5개 뷰포트에서 정렬·8px 간격·화면 경계 PASS.

| viewport | 펼친 dock y/높이 | 미니맵 y/크기 |
|---|---|---|
|667×300|104.38 / 85.56|197.94 / 196×88|
|740×300|103.36 / 85.56|196.92 / 217×88|
|844×390|166.25 / 85.56|259.81 / 248×114|
|1014×462|217.25 / 85.56|310.81 / 298×135|
|1366×768|350.06 / 125.34|483.41 / 401×225|

[1014×462 실제 컴포넌트 캡처](evidence/1014x462.png). 지도 토큰 없는 폴백 fixture이며 위성지도/실제 주행 화면 캡처가 아니다. 별도 배경 이미지 스텁 검사 시도는30초 timeout으로 미완료, kernel 종료 후 폴백 캡처는 새 브라우저에서 성공했다. 배경 이미지 스텁 검사를 PASS로 주장하지 않는다.

전체 build·실제 Firebase e2e·휴대전화 실기기는 미실행. 변경 소스 타입 검사·지정 lint·실컴포넌트 DOM 검증을 수행했다. 커밋·푸시·배포 없음.
