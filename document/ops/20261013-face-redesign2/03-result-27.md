# 결과27 — 입문 경로 목록 (CSS 1파일, 입문 aria 범위만 append)

- 지시: `02-task-27.md` (2026-10-14, Chief 두목록26 통과·다음 계속). Supervisor Codex / Developer Muse Spark 1.3.
- 일자: 2026-10-14 / branch: `face-redesign2`, HEAD `8fdedae` (작업 전 확인).
- cwd: `C:/Users/kdrea/.codex/worktrees/face-redesign2/boxcycle`.
- 베이스라인 보존: `document/ops/20261013-face-redesign2/intro-before-27.css` (작업 전 현행 복사, 8900 bytes).
- 사전 dirty(메뉴/계정/두목록26 외 CSS·`UserInfoSheet.tsx`·PROGRESS/README) 무변경·보존. TSX 쓰기 없음.

## 1. 변경 범위 (허용 1파일의 입문 범위만)

- `apps/web/src/components/ride/OfficialCourseListModal.css` — 파일末尾에 입문 override 블록만 append.
- 공용 base(`.oc-modal*` 무라벨 1~274행) 무변경, `aria-label="퍼블릭 경로"` 기존 rule 무변경.
- TSX·문구·폰트크기·색·props·콜백·검색/정렬/로드·인증·주행: 무변경 (TSX는 읽기만 — 정렬 조건 `sortableCount > 2` 확인용).
- `display: contents` 미사용. 44px hitbox 덧씌우기 없음.

## 2. 추가 내용 (입문 `[aria-label="입문 경로"]` 범위만)

1. 창: overlay `padding: 8px`, modal `width: min(460px, calc(100vw - 16px))`,
   `max-height: calc(100vh - 16px)` + `calc(100dvh - 16px)`, `position: relative`(sortbar 앵커).
   높이 고정 없음 — 0/1/2/빈은 내용 높이로 끝남.
2. 헤더 한 행: head `padding: 0.5rem 2.4rem 0.5rem 0.65rem`, body `padding: 0.5rem 0.6rem 0.6rem`
   (퍼블릭 compact값 참고). sortbar `absolute, top:0, right:2.4rem, height:3rem`.
   `:has(.oc-modal__sortbar)`일 때만 search `margin-right: 6.5rem` — 정렬 없음(0/1/2개)은 검색 전체 가용폭.
   검색/정렬/닫기 높이·font·동작 불변.
3. 행: list `gap: 0` + `border-top`, item 카드해제(`border:none`+`border-bottom`, `radius:0`, 투명),
   `box-sizing: border-box`, `min-height: 44px` 유지 + `height: auto`,
   `padding: 2px 0.55rem`(padding-block 2px). name/sub `line-height: 1.2`(지시 허용 1.15~1.2),
   sub `margin-top: 1px`. hover `#EFF6FF`, 선택 `inset 3px` 파랑 좌측 표시·focus 유지.
   긴 이름/등록자 wrap(`overflow-wrap: anywhere`, sub `flex-wrap`, publisher 우측 wrap).
   전체 텍스트·수단거리·활동 badge 구조 보존. 32px 예외 미적용(Chief 지정 내경로/퍼블릭만).
4. 선택 안내·나가기 그대로(치수·색·문구 불변). hint에 `overflow-wrap: anywhere`만(가로 넘침 방지).
   `body:has(.oc-modal__error)` 본문 스크롤 예외 복사(입문 현행 오류 UI 없음, 미래 대비).
   일반은 list만 scroll·header(본문 밖) 고정 — base 구조 그대로.

## 3. 행 높이 추정치 (16px root 기준, 실측은 Supervisor)

- 짧은 행 내용합: pad 4 + 이름 15.74 + sub간격 1 + sub 13.82 ≈ 34.6px → 하한 44px 지배, 행 외형 44px.
- 목록 3행 ≈ 132 + list 상단선 1 = 약 133px.
- 헤더 약 48px + body 상하 패딩 약 17.6px.
- 667×300(높이 300): modal 상한 284px. 선택안내+나가기 없음 → list 가용 약 218px → 3행 완전표시(남음 약 85px).
  선택안내+나가기 있음 → 가용 약 158px(추정) → 3×44=132 < 158 으로 스크롤 없이 완전표시 추정.
  긴 이름/등록자 wrap 시 행이 44px 위로 증가하며 list 내부 스크롤로 접근.
- 정직 보고: 완전표시수·면적은 계산 추정치이며, 브라우저 실측은 Supervisor 대기.

## 4. 검수 상태 (Developer: 정적 검증까지, 브라우저/tsc는 Supervisor)

- [x] `git diff --check` 1회: 통과(출력 없음, exit 0).
- [x] 단일 파일 diff 확인: `git diff --stat -- apps/web/src/components/ride/OfficialCourseListModal.css` → 1 file.
  단, HEAD 대비 해당 파일 diff는 215 insertions로 표시됨. 내역: 작업 전 dirty였던
  지시23 퍼블릭 블록(약 140행, 두목록26 보존분) + 이번 지시27 입문 블록(약 75행).
  이번 작업 append분은 `intro-before-27.css` 대비 입문 블록만(기존행 무수정).
- [x] 추가 선택자 전수 `[aria-label="입문 경로"]` 범위 — 퍼블릭/내경로 전체 DOM rect 영향 없음(구조상 보장, 실측은 Supervisor).
- [x] TSX 쓰기 0건. font-size +/- 0건(입문 블록 내 font 선언 없음).
- [x] 행 ≥ 44px(`min-height: 44px` + `height: auto`) — 잘라 숨김 없음.
- [ ] 740/667/800/844/PC: 3입문·selected+joined·disabled·0/1·긴이름/검색0/1/정렬3·1click load+close·나가기+close/escape,
  퍼블릭/내경로 rect 불변 실측 — **Supervisor 대기**.
- [ ] tsc·브라우저 검증 — **Supervisor**.
