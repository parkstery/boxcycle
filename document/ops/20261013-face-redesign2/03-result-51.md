# 결과51 — 지명 검색 결과 표시 공간 정리

모델: Auto (Cursor agent router). session: 이 턴 프롬프트에 conversation id 없음. branch `face-redesign2`. HEAD `81dcce6c5e4704e7bed99b456366471a03cefade`. 커밋 없음.

쓰기 소유 두 CSS 파일 끝에만 추가. 기존 규칙·TSX·검색 서비스/정책은 그대로.

`apps/web/src/components/PlaceSearchPanel.css`

- `.place-search-panel`: `width: min(30rem, calc(100vw - 1.3rem))`. `max-height`는 `100vh` 식 다음 줄에 같은 식의 `100dvh`. 감산은 `var(--hud-pad-top, 0.65rem) + 2.55rem + max(0.65rem, env(safe-area-inset-bottom, 0px))`. top/left/외관 선언은 기존 규칙에 유지.
- `.place-search-panel__head`: `flex-shrink: 0`.
- `.place-search-panel__body`: `display: flex; flex-direction: column; min-height: 0; overflow: hidden`.

`apps/web/src/components/MenuPlaceSearch.css`

선택자는 모두 `.place-search-panel__body` 하위.

- `.menu-place-search--panel`: `display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; overflow: hidden; background: transparent; border-bottom: 0`.
- `.menu-place-search__input-wrap`, `.menu-place-search__hint`, `.menu-place-search__status`: `flex-shrink: 0`.
- `.menu-place-search__list`: `flex: 0 1 auto; min-height: 0; max-height: none; border-radius: 0; border: 0; box-shadow: none`. `overflow`와 항목 구분선은 기존 규칙에 유지.

명령: `git diff --check -- apps/web/src/components/PlaceSearchPanel.css apps/web/src/components/MenuPlaceSearch.css` exit 0.

미검증: 지도 없는 fixture의 네 viewport, 빈 입력/토큰 없음/로딩/긴 오류/1개/여러 긴 결과, 검색어·닫기 고정, 완전 표시 행수, 목록 스크롤·마지막 결과, 선택 콜백/상세 조회/오류 fallback/검색어 보존, 본문·폰트·닫기/입력 높이, 다른 임베드 CSS, pageerror. 실 API·실기기 키보드. Supervisor 재검증으로 남김.
