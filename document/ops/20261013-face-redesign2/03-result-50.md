# 결과50 — 주행 시작 안내 펄스 2회

모델: Auto (Cursor agent router). session: 이 턴 프롬프트에 conversation id 없음. branch `face-redesign2`. HEAD `8b2f6a2a5bd9813a5039db83bcbb11c1346461ba`. 커밋 없음.

`apps/web/src/components/route-dock/RouteDock.css` 시작 안내 구간만 수정.

- `.route-dock__go--setup-a/b` `animation-duration` 600ms → 900ms. `ease-in-out`, `iteration-count: 2` 유지.
- `@keyframes route-dock-go-setup-a`와 `route-dock-go-setup-b`를 동일하게 변경. 0%/100%: `background-color: #2563eb`, `transform: scale(1)`, `box-shadow: 0 3px 12px rgba(37, 99, 235, 0.35), 0 0 0 0 rgba(37, 99, 235, 0)`. 50%: 같은 `#2563eb`, `transform: scale(1.12)`, `box-shadow: 0 4px 16px rgba(37, 99, 235, 0.45), 0 0 0 5px rgba(37, 99, 235, 0.2)`.
- 주석을 900ms 펄스(같은 색, 확대 후 복귀, halo)에 맞춤.
- reduced-motion 1200ms 정적 강조, still 키프레임, disabled opacity, 트리거 클래스, 다른 파일은 그대로.

명령: `git diff --check -- apps/web/src/components/route-dock/RouteDock.css` exit 0.

미검증: 브라우저, WebAnimation, 겹침, 종료, 재시작, 새 경로, disabled, 접기, reduced-motion, 4 viewport. Supervisor 재검증으로 남김.
