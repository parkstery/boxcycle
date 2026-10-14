# 결과20 — 계정 창 compact 2컬럼 재구성

- 변경 파일(허용 2개만): `apps/web/src/components/UserInfoSheet.tsx`, `apps/web/src/components/UserInfoSheet.css`
  - TSX: 레이아웃 wrapper·기존 JSX 블록 위치 조정만. state/효과/데이터/콜백/props타입/문구/aria/인증/결제/탈퇴/로그아웃 정책 변경 없음. JSX 중복 렌더 없음(참고 worktree의 renderLastRideToggle식 이중 렌더 복사하지 않음, 단일 마지막주행 버튼 유지).
  - 실제 변경 (`git diff` 확인):
    - `scroll-body` 직계에 `columns` wrapper + `col--account`(左: 플랜·구독안내·자산·마지막주행) / `col--stats`(右: 기간탭·통계카드) 신설. 헤더(이름/프로필/닫기) 전체폭 유지. 펼침목록(`history-list`)·계정행동/로그아웃·탈퇴 확인은 본문 직계 전체폭 그대로.
    - 마지막주행 버튼 블록을 자산 뒤(左열)로 이동. 전체클릭·`aria-expanded`/`aria-controls`·문구·조건식 동일.
    - CSS: 창폭 `min(20rem, 92vw)` → `min(460px, calc(100vw - 16px))` (참고 760px 대비 작게). 우상단 anchor(`top:0; right:0`)·높이상한(`max-height: 100vh/dvh`)·내용높이 종료(19 유지)·하단모서리·패딩·폰트·색(새도로파랑 `#2563EB` 유지)·22px 컨트롤 유지.
    - 지시09 row합체 grid + scroll-body 직계 placement 제거 → 본문 기존 flex column 흐름 복귀, `columns` 2열(`minmax(0,1fr)` ×2, `gap:0.35rem`, `align-items:start`, 짧은열 강제늘림 없음). 중첩스크롤 추가 없음(본문만 스크롤).
    - 마지막주행만 내용높이 허용(`height:auto; min-height:22px`), body 세로쌓기 + summary 줄바꿈 허용(header+summary 2줄, font/line-height 불변). stats 3열은 지시19 plain 유지. 탭 내용폭·확인행 내용폭·확인패널 여백(09 잔여)은 유지.
    - 480px 미만 fallback 단열 추가. 667x300/740x300/800x360/844x390·PC는 2열.
    - 참고 worktree 읽기만 사용, 해당 worktree 수정/병합 없음. 큰폭·큰버튼·주황/청록·이력재구성·기능 복사 없음.
  - 보존: 지시19 diff(`bottom:0` 제거·하단모서리·stats plain 3열+구분선) 그대로 유지. 타인 dirty(`MenuPanel.css`, `MapView.css`, `MapHud.css`, `LocalFirstEntryCard.css`, `PROGRESS.md`, `README.md`) 손대지 않음. 수정전 2파일은 `account-before-20.css/tsx`로 보존됨(작업 전 해시 일치 확인).
- 명령·종료코드:
  - `git diff --check` → 종료코드 0 (출력 없음, 1회)
  - `git diff -- apps/web/src/components/UserInfoSheet.tsx apps/web/src/components/UserInfoSheet.css` → 위 변경 확인 (종료코드 0, stat: 2 files, +92/-76 — 19분 포함)
  - `git status --short` → 허용 2파일 외 기존 dirty만, 추가 변경 없음 확인 (종료코드 0)
  - 참고 읽기: mobile-ui-redesign `UserInfoSheet.tsx` columns 구조 + CSS 773~833 (읽기만)
  - commit/push/merge/deploy·서버조작·하위agent 미수행. 다른 ops 탐색 미수행.
- 미검증 사항 (Supervisor 수행): 브라우저 검수(참고창과 같은 2열 역할·460px compact, 4 폰가로+PC 가로넘침 0, 통계내용/자산/버튼 접근, 글자·숫자·최소버튼높이, 긴스토리/칼로리미산정/Guest·Free/자산없음·있음/확인·기록펼침 대응, 형식상 넓어짐에 따른 지도점유 수치 정직 보고), `tsc` (TSX 구조 변경 있음).
