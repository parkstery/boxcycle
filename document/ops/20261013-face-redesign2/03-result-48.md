# 결과48 — 지도 설정(맵 뷰) 밀도 정리

모델: Auto (Cursor agent router). session: `7a60317d-a20c-4bf2-843f-fcd9a212ec3e`. branch `face-redesign2`. HEAD `c6b230e0ba15058e7b2f4a1c0d9d846b152193a5` (커밋 없음).

소유 파일 `apps/web/src/components/map/MapViewSheet.css` 끝에 블록만 추가. 기존 선언은 수정하지 않음. 다른 파일·브라우저·서버·tsc·전체 시험·commit·push 없음.

- `.map-view-sheet__panel`: `padding: 0.4rem 0.55rem 0.55rem`, `gap: 0.35rem`, `max-height: calc(100vh - 1rem)` 다음 줄 `calc(100dvh - 1rem)`.
- `.map-view-sheet__handle`: `display: none`.
- `@media (max-height: 560px)` 안 `.map-view-sheet__panel`: `width: min(25rem, calc(100vw - 1rem))`.
- 같은 특이도의 뒤 규칙이 앞 선언의 해당 속성만 덮는다. 짧은 화면의 기존 `width: min(17rem, …)` 는 끝 미디어 규칙의 25rem 이 덮는다. 데스크톱 기본 `width: min(25rem, calc(100vw - 1rem))` 은 그대로. right/top/safe-area·row wrap·button·font 는 추가 블록에 없음.

명령: `git diff --check -- apps/web/src/components/map/MapViewSheet.css` exit 0. 해당 파일 `M` 한 줄.

미검증: 화면, browser 1/page 1, 기존 5013, 667/740/844/1366 가로 idle/riding, 줌·거리 min/max·선택, 전후 panel/버튼/font/본문·스크롤/잘림, 카메라 8종, 지도 스타일, 노선·3D·POI, ±/slider, 닫기, Escape, 배경 콜백, 실기기, 실지도. Supervisor 검증으로 남김.
