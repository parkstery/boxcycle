# 결과 07 — 사용자 정보창 공간밀도 보정

- 지시: `document/ops/20261013-face-redesign2/02-task-07.md`
- 담당: Cursor CLI. 프로필 작업06 이후 사용자 정보창만.
- 위치: `C:/Users/kdrea/.codex/worktrees/face-redesign2/boxcycle`, 브랜치 `face-redesign2`
- 상태: 미커밋·미푸시·미배포. 브라우저·서버·로그아웃·탈퇴·결제 없음.

## 이번 턴에서 바꾼 선언

파일: `apps/web/src/components/UserInfoSheet.css`만. TSX·문구·폰트 크기·색·다른 CSS는 수정하지 않았다. 시트 `width: min(20rem, 92vw)`와 위치, `overflow: hidden`, 스크롤 본문 `overflow-y: auto`는 유지했다. 기간 탭과 플랜 행동 버튼의 `min-height: 44px`도 유지했다.

| 선언 | 이번 턴 전 | 이번 턴 후 |
|---|---|---|
| `.user-info-sheet` `padding` | `0.75rem 0.85rem` | `0.55rem 0.85rem 0.28rem` |
| `.user-info-sheet` `gap` | `0.55rem` | `0.55rem` (유지. 닫기·프로필 수정 44px 히트가 플랜 행과 겹치거나 잘리지 않게) |
| `.user-info-sheet__head` `gap` | `0.55rem` | `0.7rem` |
| `.user-info-sheet__scroll-body` `gap` | `0.55rem` | `0.24rem` |
| `.user-info-sheet__close` | 보이는 원 `1.9rem` | `position: relative` 추가. 보이는 크기·색·글자 크기 유지 |
| `.user-info-sheet__close::after` | 없음 | `44px` 정사각, `right: -0.85rem`, 세로 중앙. 히트를 오른쪽 패딩 쪽으로 |
| `.user-info-sheet__plan` | `gap: 0.5rem`, `padding: 0.4rem 0.55rem` | `gap: 0.4rem`, `padding: 0.2rem 0.5rem` |
| `.user-info-sheet__stats-head` `margin-top` | `0.15rem` | `0` |
| `.user-info-sheet__stats-note` `margin` | `0.15rem 0 0` | `0` |
| `.user-info-sheet__stats` `gap` | `0.35rem` | `0.22rem` |
| `.user-info-sheet__stats > div` | `padding: 0.35rem 0.45rem`, `gap: 0.1rem` | `padding: 0.16rem 0.35rem`, `gap: 0.04rem` |
| `.user-info-sheet__h` `margin` | `0.4rem 0 0` | `0.16rem 0 0` |
| `.user-info-sheet__h-toggle` | `gap: 0.45rem`, `margin: 0.4rem 0 0`, `padding: 0.4rem 0.55rem` | `gap: 0.35rem`, `margin: 0.16rem 0 0`, `padding: 0.2rem 0.5rem` |
| `.user-info-sheet__list` `gap` | `0.3rem` | `0.2rem` |
| `.user-info-sheet__item` | `gap: 0.25rem`, `padding: 0.45rem 0.5rem` | `gap: 0.14rem`, `padding: 0.28rem 0.45rem` |
| `.user-info-sheet__empty` `padding` | `0.45rem 0.55rem` | `0.2rem 0.4rem` |
| `.user-info-sheet__actions` | `margin-top: 0.4rem`, 세로 `column` | `margin-top: 0`, `flex-flow: row wrap`, `gap: 0.28rem 0.35rem` |
| `.user-info-sheet__btn` | `padding: 0.5rem 0.7rem` | `inline-flex`, `min-height: 44px`, `padding: 0.35rem 0.7rem` |
| `.user-info-sheet__actions > .user-info-sheet__btn` | 없음(열에서 늘어남) | `flex: 0 0 auto`, `width: auto` |
| `.user-info-sheet__logout-confirm` | `gap: 0.4rem`, `padding: 0.5rem 0.6rem` | `flex: 1 0 100%`, `width: 100%`, `min-width: 0`, `gap: 0.28rem`, `padding: 0.35rem 0.5rem`. 세로는 유지 |
| `.user-info-sheet__confirm-input` `margin-top` | `0.3rem` | `0.16rem` |
| `.user-info-sheet__logout-confirm-row .user-info-sheet__btn` | `flex: 1` | `flex: 1 1 0`, `min-width: 0`, `justify-content: center` |
| `.user-info-sheet__item-actions` | `gap: 0.3rem`, `margin-top: 0.2rem` | `gap: 0.28rem`, `margin-top: 0.1rem` |
| `.user-info-sheet__assets` `gap` | `0.4rem` | `0.24rem` |
| `.user-info-sheet__asset` | `gap: 0.12rem`, `padding: 0.45rem 0.55rem` | `gap: 0.06rem`, `padding: 0.28rem 0.45rem` |
| `.user-info-sheet__stats-card` | `gap: 0.4rem`, `padding: 0.55rem 0.6rem` | `gap: 0.16rem`, `padding: 0.26rem 0.5rem 0.2rem` |
| `.user-info-sheet__stats-story` `margin` | `0.2rem 0 0` | `0` |
| `.user-info-sheet__last-ride` | `min-height: 52px`, `gap: 0.5rem`, `padding: 0.5rem 0.6rem` | `min-height: 44px`, `gap: 0.35rem`, `padding: 0.2rem 0.55rem` |
| `.user-info-sheet__last-ride-body` `gap` | `0.14rem` | `0.04rem` |

바닥의 Google 연결·로그아웃·계정 탈퇴는 내용 폭으로 한 줄에 두고, 좁으면 `flex-wrap`으로 다음 줄에 내려간다. 로그아웃/탈퇴 확인 그룹은 `flex-basis: 100%`라 설명·입력·취소·실행이 같은 행의 칩에 잘리지 않는다. 목록 행의 작은 액션에는 `min-height: 44px`를 넣지 않았다. 목록이 길면 스크롤로 도달한다.

HEAD 대비 이 파일에는 이번 여백 변경 앞에 이미 있던 색 변경이 남아 있다. 이번 턴은 그 색을 되돌리거나 다시 칠하지 않았다. 다른 파일의 선행 변경도 보존했다.

## 검증 명령

| 명령 | cwd | 결과 |
|---|---|---|
| `git diff --check` | 작업 트리 루트 | exit 0. 공백 오류 출력 없음. elapsed 6961ms. |
| `node C:/20.HDev/boxcycle/node_modules/typescript/bin/tsc -b --pretty false` | 호출 인자 `working_directory`는 `apps/web`. 완료 메타데이터 cwd는 작업 트리 루트 | exit 0. 진단 출력 없음. elapsed 16225ms. |

tsc는 위 한 번만 실행했다. `git diff --check`와 동시에 돌려 완료 메타데이터의 cwd가 루트로 남았다. `apps/web`에서 실행됐는지는 그 메타데이터만으로 단정하지 않는다. 지시가 재실행을 금해서 다시 돌리지 않았다.

## 미검증

- 800×360 기본 Guest/Free의 자연 콘텐츠 높이와 `scrollHeight - clientHeight`는 측정하지 않았다. 브라우저·검사 도구는 Supervisor 담당이다. 스크롤 0이나 15% 감소를 이 결과로 단정하지 않는다.
- 667×300의 감소량과 잔여 스크롤도 측정하지 않았다.
- 의도한 방향만 적는다. 시트·카드·통계 안쪽 여백을 줄이고, 바닥 일반 버튼은 한 줄로 모아 기본 상태의 세로 점유를 줄인다. 자산·긴 안내·주행 목록·확인 상태는 `overflow-y: auto`로 스크롤해 컨트롤에 도달한다.
- 닫기 버튼의 실제 44px 히트가 이웃 버튼과 겹치지 않는지, 확인 문구가 잘리지 않는지는 렌더하지 않았다.
- 로그인·로그아웃·탈퇴·결제·배포 없음. 서버 미조작.
