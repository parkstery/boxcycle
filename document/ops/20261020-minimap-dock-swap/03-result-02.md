# 결과02 — 미니맵 접기·펼치기

2026-10-20. Cursor 기본 실행1회 exit1 `uv_os_get_passwd returned ENOMEM`, 실제 응답·모델/세션 없음. Codex 직접 구현. 기존 dirty 보존, 제품 변경은 RouteMinimap.tsx/css 두 파일에 추가.

기본 펼침, 우하단 화살표 버튼으로 접기. 접으면 미니맵 글자와 위쪽 화살표 버튼만 남는다. 재클릭으로 펼친다. expanded 로컬 상태, aria-expanded/aria-controls/useId 및 group 접근성 적용. 부모 이벤트 차단은 버튼의 기본 터치·키보드 동작을 허용한다. 내용은 hidden으로 보존하여 이미지/SVG DOM·현재 위치 갱신을 유지한다. RouteDock 접기와 독립.

실행 C:\20.HDev\boxcycle\apps\web:
- `node scripts/ride-verify/verify-selectors.mjs`: exit0 /19 PASS.
- `npx tsc -b`: exit0.
- `npx eslint src/features/map-overlays/RouteMinimap.tsx`: exit0 /출력없음.
- 루트 `git diff --check`: exit0.

실제 컴포넌트·제품 CSS를 localhost5000 Vite에서 메모리 fixture로 렌더링, headless Chromium hasTouch:true. 지도 이미지는 네트워크 라우트로 1px PNG 대체, 외부 API 호출 없음. 실제 Firebase·전체 App 진입 시험이 아니다.

|뷰포트|펼침 크기|접힘 크기|버튼 최소 크기|토글 추가 이미지 요청|
|---|---|---|---|---|
|667×300|196×88|66.91×44|44×44|0|
|740×300|217×88|66.91×44|44×44|0|
|844×390|248×114|66.91×44|44×44|0|

세 크기 모두 터치 접기·펼치기, Enter 펼침·Space 접힘, paused 중 토글, RouteDock 접힘 상태에서 미니맵 토글 PASS. 버튼 역할·이름으로 접근 가능, 숨겨진 이미지 content 미표시 확인. 이미지 DOM 동일 노드·추가요청0·상자 내부 containment PASS. RouteDock과8px 간격, 화면 하단 잘림없음, pageerror0.

캡처: [펼침](evidence/toggle-expanded.png) / [접힘](evidence/toggle-collapsed.png), 844×390·RouteDock 접힘·지도 이미지 스텁 조건. 실기기·실제 Mapbox 배경·전체 build·Firebase e2e 미실행. 커밋·푸시·배포 없음.
