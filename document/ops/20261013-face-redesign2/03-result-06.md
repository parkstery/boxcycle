# 결과 06 — 프로필 밀도 마감 보정

- 지시: `document/ops/20261013-face-redesign2/02-task-06.md`
- 담당: Cursor CLI. Chief 코드전송·교대 승인 후 단일 작성자. Muse 재실행 없음.
- 위치: `C:/Users/kdrea/.codex/worktrees/face-redesign2/boxcycle`, 브랜치 `face-redesign2`
- 상태: 미커밋·미푸시·미배포. 브라우저·검사도구·서버 조작 없음.

## 이번 턴에서 바꾼 선언

파일: `apps/web/src/components/ProfileEditSheet.css`만.

작업 트리에 이미 있던 scoped 블록의 패널 값만 지시 수치로 맞췄다.

| 선언 | 이번 턴 전 | 이번 턴 후 |
|---|---|---|
| `.profile-edit-sheet .ride-settings-sheet__panel` `padding` | `0.32rem 0.7rem 0.48rem` | `0.4rem 0.7rem 0.5rem` |
| 같은 규칙 `gap` | `0.32rem` | `0.3rem` |

이미 있어 유지한 scoped 규칙:

- `.profile-edit-sheet .ride-settings-sheet__handle { display: none; }` — 프로필 시트만. `RideSettingsSheet.css`의 공용 handle 규칙은 미변경. `ProfileEditSheet.tsx`의 handle은 `aria-hidden`이며 TSX는 미변경.
- `.profile-edit-sheet .ride-settings-sheet__group { gap: 0.2rem; }`
- `.profile-edit-sheet .ride-settings-sheet__chips`와 `__chip` 모두 `flex: 0 0 auto`
- `max-height`는 `100vh`/`100dvh`에서 safe-area를 뺀 가용 높이. `overflow-y: auto` 유지.
- 입력·체중 입력·강도 칩·취소/저장 버튼 `min-height: 44px` 유지. 이번 턴에 `font-size`·색 선언을 바꾸지 않음.

HEAD 대비 diff에는 위 밀도 블록과 함께, 입력 테두리/바탕/글자색이 CSS 변수에서 `#CBD5E1` / `#FFFFFF` / `#1F2937`로 바뀐 줄이 있다. 그 색 줄은 이번 턴 시작 시 작업 트리에 이미 있던 선행 컬러 변경이다. 이번 지시는 그 색을 되돌리거나 다시 칠하지 않았다.

## 검증 명령

| 명령 | cwd | 결과 |
|---|---|---|
| `git diff --check -- apps/web/src/components/ProfileEditSheet.css` | worktree 루트 | exit 0. 공백 오류 출력 없음. |
| `node C:/20.HDev/boxcycle/node_modules/typescript/bin/tsc -b --pretty false` | 호출 시 `apps/web` 지정. 셸 메타데이터 cwd는 루트로 남아 확정 불가 | 출력 `TSC_EXIT:0`, 프로세스 exit 0, 약 86초. cwd가 불명확해 아래 재실행을 기준으로 함. |
| `Set-Location apps/web` 후 같은 `tsc -b --pretty false` | 출력 `CWD:.../apps/web` | 출력 `TSC_EXIT:0`, 프로세스 exit 0, elapsed 143966ms. 진단 출력 없음. |
| `git diff --check` (작업 트리 전체) 후 `git diff -- apps/web/src/components/ProfileEditSheet.css` | worktree 루트 | exit 0. 위 프로필 CSS diff만 확인. |

## 미검증

- 800×360 Guest 패널 높이 `<=198.9px`(15% 감소)는 측정하지 않았다. 지시는 브라우저·검사도구를 금지하고 실측은 Supervisor headless로 둔다. 이번 턴의 padding은 직전 `0.32rem 0.7rem 0.48rem`보다 위·아래가 크고, gap만 `0.32rem`에서 `0.3rem`으로 줄었다. 픽셀 높이가 목표에 들어갔는지는 이 결과로 단정하지 않는다.
- 정식 닉네임 입력·긴 잠금·오류 상태의 잘림, 강도 칩의 내용 폭, 공용 주행 설정 26요소 geometry는 렌더하지 않았다.
- 로그인·저장·배포 없음. 5013 미조작.

다른 창 CSS는 이번 턴에 수정하지 않았다. 작업 트리에 남아 있는 그 파일들의 선행 변경은 보존했다.
