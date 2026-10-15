# 검수63·64 — 주행 계기판 UI 조화

2026-10-15 Supervisor Codex, APPROVED / Chief 확인 대기. Cursor 구현63 및 여백재지시64. 사용자 허용 크기변화 각축20%이내.

MapHud.css 계기판전용규칙만변경. 흰색면·옅은슬레이트inset테두리·둥근모서리·작은그림자. 검정방사형배경/글자키라인·헤일로제거. 숫자진한색, 거리/새도로파랑, 라벨/단위슬레이트. 읽기대비를위해preview/이미내도로opacity1. 폰트크기/굵기/셀고정폭/포맷/값/콜백/ARIA/새도로펄스/코칭/다음주행카드불변.

검증:
- `node document/ops/20261013-face-redesign2/hud-63-qa.cjs` 최종exit0. 실제MapHud,폰667×300/740×300/844×390/짧은740×180/PC1366×768 × preview/riding/paused/long/owned × 밝음/어두움=50상태. 전후텍스트동일/셀폭높이동일/가로overflow0/수치캡슐내/모든라벨·값·단위대비4.5이상/text-shadow없음 PASS. 밝고어두운패턴은합성지도배경,실지도검증아님.
- 폰주행표시278.671875×24.828125px 전후동일. PC주행333.484375×50.828125→343.078125×50.828125px,가로약2.88%/높이0%. 전체50상태최대가로증가3.53%,높이변화0%,허용20%이내.
- 초기검수에서PC긴수치123.45/234.56km가좌측3.40625px나옴(baseline동일). 지시64로기본좌우padding0.15rem→0.45rem보정,반응형폰여백유지. 재검증50상태PASS. 글자축소없음.
- `node document/ops/20261013-face-redesign2/composition-63-qa.cjs` exit0. 실제HUD/RouteDock/미니맵/설정/메뉴조합36상태,폰3종+PC. 상단계기판과우상단조작부겹침0/조작버튼가림0/pageerror0.
- `node scripts/ride-verify/verify-selectors.mjs` exit0,15계약유효.
- `git diff --check -- apps/web/src/components/maphud/MapHud.css` exit0. CSS전용변경이라tsc/eslint재실행불필요(로직/selector불변).

전후/상세스크린샷 `hud-63-shots/`,결과JSON동일폴더. 740상세시각확인완료. 기존5013서버중지확인후같은worktree에서재시작. fixture는main스크립트차단으로실인증/Firebase요청없음. 실기기/실지도/주행/BLE미검증. push/merge/deploy없음.

코드커밋 f623d8d style(hud): align ride metrics with white and blue interface.

