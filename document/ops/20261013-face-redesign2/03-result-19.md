# 결과19 — 계정 창 내용 높이와 통계 경계 정리

- 변경 파일: `apps/web/src/components/UserInfoSheet.css` 1개만 (TSX·문구·UID·계정/결제/로그아웃/탈퇴·데이터/통계 계산 변경 없음)
- 실제 변경 (`git diff` 확인):
  - `.user-info-sheet`: `bottom: 0` 제거 → 내용이 끝나면 패널도 끝남. `top: 0`·`right: 0`·폭(`min(20rem,92vw)`)·`max-height: 100vh` + `max-height: 100dvh` 상한·패딩·폰트·색·버튼·`overflow: hidden` 보존. `border-bottom-left-radius: 12px` 추가 (지시 허용, 왼쪽 아래 모서리 정리). 고정 height/min-height 추가 없음.
  - `.user-info-sheet__stats > div` (시간/평속/칼로리 3박스만): `background: transparent`·`border: none`·`border-radius: 0`으로 개별 둥근 테두리·배경 제거. `padding(0.16rem 0.35rem)`·`display: flex; flex-direction: column; gap: 0.04rem` 보존.
  - `.user-info-sheet__stats > div + div`: `border-left: 1px solid #E2E8F0` 옅은 세로 구분선 신규 (열 사이 구분만, 박스 테두리 부활 아님).
  - 보존: `.user-info-sheet__stats` 3열 grid·gap·폰트 크기, `span/strong/stat-note` 숫자·라벨·미산정 안내·단위, 부모 `.user-info-sheet__stats-card`·자산(`assets/asset/conquest`) 강조, 다른 정보 카드·버튼 (`item/plan/last-ride/actions`) 손대지 않음.
  - 보존: `.user-info-sheet__head` 기존 `flex-shrink: 0` (헤더 축소 금지), `.user-info-sheet__scroll-body` 기존 `flex: 1 1 auto`·`min-height: 0`·`overflow-y: auto` + grid `align-items: start`·`grid-auto-rows: max-content` (높이 초과 시 상한까지 사용 후 본문 스크롤, flex 자식이 정보·버튼 찌그러뜨리지 않음). 정보 숨김·line-clamp·폰트 축소 없음.
- 조사만 수행 (변경 없음): `UserInfoSheet.tsx` — `head`(avatar/id/edit/close) + `scroll-body`(plan/subscription-note/assets/stats-head/stats-card/last-ride/history-list/actions) 구조, stats 3박스(시간/평속/칼로리 + 미산정 안내) 확인.
- 명령·종료코드:
  - `git diff --check` → 종료코드 0 (출력 없음, 1회)
  - `git diff -- apps/web/src/components/UserInfoSheet.css` → 위 diff 확인 (종료코드 0)
  - `git status --short` → UserInfoSheet.css 외 기존 dirty(MenuPanel.css/MapView.css/MapHud.css/LocalFirstEntryCard.css, ops 문서) 그대로 보존 확인. commit/push/merge/deploy 미수행. 서버5013 미조작.
- 미검증 사항 (Supervisor 수행): 브라우저 검수 (메뉴 승인 디자인 보존, 빈 하단 면적 제거, 헤더·기간탭·Google 연결·로그아웃/취소·탈퇴 확인 행동·통계 보존, 단순상태 740x300/667x300 스크롤 증가 없음, 844x390/PC 내용높이 종료, 등록회원/Guest/통계없음/자산/긴 안내/확인 상태에서 상한+스크롤 접근), `tsc` (본 작업 CSS만이라 TSX 영향 없음).
