# 결과23 — 퍼블릭 경로 목록 (지시23)

- 변경 파일(허용 1개만): `apps/web/src/components/ride/OfficialCourseListModal.css` — base 273줄 뒤에 퍼블릭 한정 override 100줄 추가(append only, 기존 base 0삭제)
  - 실제 변경 (`public-before-23.css` 대비, worktree·주저장소 양쪽 보존됨 확인):
    - 폭/높이: `.oc-modal-overlay:has(.oc-modal[aria-label="퍼블릭 경로"])` → `padding: 8px`. `.oc-modal[aria-label="퍼블릭 경로"]` → `position: relative; width: min(560px, calc(100vw - 16px)); max-height: calc(100vh - 16px)` → `calc(100dvh - 16px)`. 0/1/2/빈/로딩은 내용 높이, 많으면 상한까지.
    - 한 행 정리(CSS-only): `.oc-modal__sortbar` → `position: absolute; top: 0; right: 2.4rem; height: 3rem; margin: 0` + flex 중앙정렬·nowrap. 닫기(우 0.3rem·폭 1.9rem)와 0.2rem 간격. 검색은 정렬 있을 때만 `:has(.oc-modal__sortbar)` 조건으로 `margin-right: 9rem` 예약(정렬 실폭 약 91px 대비 여유). 0/1/2개(정렬 없음)는 예약 없음. base 버튼/input 높이·폰트·padding 미변경.
    - 행 밀도(내 경로와 같이): `.oc-modal__list` → `gap: 0` + `border-top: 1px solid #E2E8F0`. `.oc-modal__item` → 카드 테두리/둥근 제거(`border: none; border-radius: 0; background: transparent`) + `border-bottom` 구분선 + `min-height: 44px; box-sizing: border-box`. item padding은 base 유지(축소 없음). 선택 `background: #EFF6FF` + 좌측 파랑 바(`inset 3px 0 0 0 #2563EB`), hover `#EFF6FF`, focus-visible은 base outline 그대로.
    - 정보 보존: 이름/수단/거리/활동 badge/등록자 숨김·축약·재작성·line-clamp 없음. 이름은 `overflow-wrap: anywhere; word-break: break-word`로 전체 표시. 긴 등록자 이름은 `.oc-modal__item-sub { flex-wrap: wrap }` + publisher `flex-shrink: 1; white-space: normal; overflow-wrap: anywhere` 로 메타 안에서 줄바꿈, 가로 overflow 방지.
    - 여백: head `0.5rem 2.4rem 0.5rem 0.65rem`(닫기 자리 유지), body `0.5rem 0.6rem 0.6rem` — 퍼블릭 한정, 폰트·버튼 높이 불변.
    - 스크롤: 일반 상태는 base 그대로(본문 고정·목록만 스크롤). 긴 오류만 `.oc-modal__body:has(.oc-modal__error)` → `overflow-x: hidden; overflow-y: auto` 예외 + `.oc-modal__error { flex-shrink: 0 }` + detail `overflow-wrap: anywhere`. 헤더(본문 밖) 고정.
  - 불변: TSX/공용 props/검색·정렬·선택·로드/문구/font-size/폰트/색(팔레트 내 기존값만 재사용)/계정 데이터. 입문(`입문 경로`)·내 경로는 셀렉터가 `aria-label="퍼블릭 경로"` 정확일치라 영향 없음. 행 클릭 기존 1회 load+close(TSX 미변경). 기존 타인 dirty 보존, commit/push/merge/deploy·서버조작·하위agent 미수행.
- 명령·종료코드:
  - `git diff --check` → 출력 없음, 종료코드 0 (1회)
  - 단일파일 diff 확인: `git diff --stat -- apps/web/src/components/ride/OfficialCourseListModal.css` → 1 file, 100 insertions(+), 0 deletions, 종료코드 0. `git diff -- <동일파일>` 전문으로 base 무삭제·단일파일 확인.
  - 수정 전 CSS `public-before-23.css`는 주저장소·worktree ops에 기보존됨(편집 전 worktree 현행 CSS와 동일 base 273줄 확인).
- 미검증 사항 (Supervisor 수행): 브라우저 검수(740×300/667×300/800×360/844×390/PC — 목록 height/완전 행수·지도 점유면적 전후, 검색 0건·로딩·미연결·오류·0/1/2/20개·long 제목/등록자·selected/disabled(주행중) 상태, 740/667 검색·정렬·닫기 겹침 없음, 입문·내 경로 동일 DOM CSS 전후 rect 불변, 행 클릭 1회 load+close), `tsc` (CSS만 변경이라 영향 예상 없음).
