# 결과03 — 좌상단 소형 좌우 캐럿

2026-10-20. Cursor 실행1회 exit1 ENOMEM,실제 모델응답 없음. Codex 직접 수정. RouteMinimap.tsx/css: 44px우하단/상하캐럿→24px좌상단/좌우캐럿. 펼침 ‹ / 접힘 ›,접힘 텍스트 제거. 접힘에서도 높이를 보존해 캐럿과 RouteDock의 세로 위치를 유지하고 폭만24px로 축소한다. 빈 접힘 영역은 투명·pointer-events:none,버튼만 터치 가능.24px소형화는Chief명시 요청. aria-label/expanded/controls·키보드 보존.

검증 실행 C:\20.HDev\boxcycle\apps\web: `npx tsc -b`, `npx eslint src/features/map-overlays/RouteMinimap.tsx` exit0. 루트 `git diff --check` exit0.

Chromium실컴포넌트fixture 667×300/740×300/844×390: 버튼24×24,미니맵좌상단오프셋0,터치접기·Enter펼침·좌우path검증PASS. 접힘전후캐럿x/y동일·RouteDock y동일. 기존localhost5000재사용,외부지도요청차단. 실주행·실기기미검증.

[펼침](evidence/caret-left-top.png) · [접힘](evidence/caret-collapsed.png). 제품전체화면이 아닌실컴포넌트fixture. 커밋·푸시·배포없음.
