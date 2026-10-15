# 결과66 — 상단 맵 줌 순서·카메라/맵 버튼 1.2배

모델: Auto (Cursor agent router). session: 이 턴 프롬프트에 conversation id 없음. branch `main2`. HEAD `c48e2198d32fac59482dec6fa5a6cc1631557682`. 커밋·푸시 없음. 지시66 파일은 수정하지 않음. 작업 트리 `C:/20.HDev/boxcycle` (별도 worktree 없음).

변경: `apps/web/src/components/maphud/MapHud.tsx`, `apps/web/src/components/maphud/MapHud.css`만.

- TSX 맵 제어 버튼 순서 `[style, 줌 축소 −, 줌 확대 +]` → `[style, 줌 확대 +, 줌 축소 −]`. 각 버튼의 aria/title/disabled/onClick/pointer/touch 는 블록째 유지. 카메라 1~6 순서 불변. Mapbox 세로 컨트롤(`MapViewSheet`) 미수정.
- CSS 3구간 min-width·height 를 layout 값으로 1.2배. 기본 2.325→2.79rem, c1 active 2.775→3.33rem. height420 2.025→2.43rem, c1 active 2.325→2.79rem. 폰(width900·height560) 1.55→1.86rem, c1 active 1.85→2.22rem.
- 좌우 padding만 기본 0.42→0.504rem, 폰 0.22→0.264rem. c1 padding-bottom, 숫자 font, gap, 색, 테두리, radius, `::after` 44px 히트, 이벤트 전파 차단은 그대로. transform/zoom 미사용. 주석을 지시66 수치로 갱신.

명령: `git diff --check -- apps/web/src/components/maphud/MapHud.tsx apps/web/src/components/maphud/MapHud.css` exit 0. `git diff --stat` 은 위 2파일만(CSS 49/42, TSX 포함 합 49 insertions / 42 deletions).

미검증: 브라우저·서버·selector/tsc/eslint·전체 시험 없음. 3폰+짧은폰+PC, active 1/2/6·카메라 1 각 mode, disabled 줌, 야외/위성, 긴 계정, 긴 계기값, 전후 bbox 약 1.2배, 순서 +−, callback/keyboard/pointer 히트, 좌우 HUD 비중복은 Supervisor 검증으로 남김.
