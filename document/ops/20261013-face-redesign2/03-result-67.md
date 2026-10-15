# 결과67 — 확대 맵 선택폭·좁은폰충돌 마감

모델: Auto (Cursor agent router). session: 이 턴 프롬프트에 conversation id 없음. branch `main2`. HEAD `c48e2198d32fac59482dec6fa5a6cc1631557682`. 커밋·푸시 없음. 지시67 파일은 수정하지 않음. 작업 트리 `C:/20.HDev/boxcycle` (별도 worktree 없음).

변경: `apps/web/src/components/maphud/MapHud.css`만. 지시66 dirty(TSX·CSS)는 유지.

- width 900 / height 560 미디어의 `.hud-ride-map-controls__style` 에 `font-size: 0.65rem` 유지, `padding: 0 0.414rem` 추가. 공유 규칙의 줌 padding `0 0.264rem`·숫자 font·다른 버튼 규칙은 그대로.
- 파일 끝 `@media (max-width: 740px) and (max-height: 560px)`. 계기판이 있을 때만 `.hud-quick-camera` 를 `position: absolute; top: calc(100% + 1.2rem); right: 0` 으로 우상단 다음 행에 배치(앵커 `.map-hud__tr`). 계기·카메라가 둘 다 있을 때만 `.map-hud__tr-under` 의 `top` 을 `calc(var(--hud-pad-top) + 44px + 4.1rem)`. 이유 주석을 규칙 위에 둠.

명령: `git diff --check -- apps/web/src/components/maphud/MapHud.css` exit 0. `git diff --stat` 은 이 파일 57 insertions / 29 deletions (HEAD 대비, 지시66 CSS dirty 포함). 이번 추가는 스타일 padding 2줄과 파일 끝 미디어 19줄.

미검증: 브라우저·서버·selector/tsc/eslint·전체 시험 없음. 각 버튼 rect 교차(부모 bbox 아님)·폭 비율(자연폭 약 31.36px / 기존 26.125의 1.2배)·맵 버튼·키보드·터치 콜백 40상태는 Supervisor 검증으로 남김.
