# 결과53 — HUD 중앙 안내 카드 여백 정리

모델: Auto (Cursor agent router). session: 이 턴 프롬프트에 conversation id 없음. branch `face-redesign2`. HEAD `6e89efa9a36896a9e4ebfd15b536fa6eb7228207`. 커밋 없음.

쓰기 소유: `apps/web/src/components/maphud/MapHud.css` 끝에 규칙 한 줄만 추가. 기존 선언은 그대로.

- `.map-hud__mc .hud-action { padding: 0.4rem 0.6rem; gap: 0.3rem; }`

명령: `git diff --check -- apps/web/src/components/maphud/MapHud.css` exit 0.

미검증: 4 viewport × paused/짧은 오류/긴 오류/riding 코칭, 전후 카드 면적·본문·font·버튼 크기, 계기·코칭 불변, 기능 콜백·오버플로·viewport 표시. 실기기·실주행. Supervisor 재검증으로 남김.
