# 감리20 — 계정 compact 2컬럼

2026-10-14 Supervisor Codex. APPROVED(구현·검수), AWAITING_CHIEF(사용확인). Chief가 계정19의 단열 대신 mobile-ui-redesign의 2컬럼 구조를 요청하여 이번 결과가 계정19 레이아웃을 대체한다. 당시 감리는 보존.

## 실행·실제 diff

OpenCode Muse Spark1.3,모델 opencode/muse-spark-1.3-contributor-free,세션 ses_ec6d15432ffepiJZZlq62J7imi. run 종료코드0,실제응답·편집·결과확인. [지시20](02-task-20.md) → [결과20](03-result-20.md), [실행로그](muse-20.jsonl).

cwd C:/Users/kdrea/.codex/worktrees/face-redesign2/boxcycle,branch face-redesign2 HEAD8fdedae. UserInfoSheet.tsx/css만 변경. TSX diff는 columns/좌우col wrapper 추가와 기존 마지막주행 JSX 그대로 이동. state/effect/props/콜백/데이터조건/aria/문구 불변. 통계 단위·미산정 안내·Google보존안내·확인 버튼 보존.

왼쪽 플랜·구독안내·자산·마지막주행 / 오른쪽 기간탭·통계카드. 헤더·기록목록·계정행동·로그아웃/탈퇴확인은 전체폭. 본문 scroll-body의 이전 직계grid배치를 flex흐름+2열grid로 교체. 마지막주행만 내용높이/줄바꿈으로 좁은열에서정보접근 유지. 폭460px,우상단anchor·내용높이종료·하단모서리 유지. font/색/기존22px예외 유지. 참고창의주황/청록·760px폭·44px큰버튼·관련기능은복사하지않음. 참고worktree는읽기만.

MenuPanel.css/MapView.css/MapHud.css/LocalFirstEntryCard.css는 preserved-before-19.json SHA256과독립대조 전부동일. commit/push/merge/deploy없음.

## 독립 검증

| 실행 명령 | 결과 | 내용 |
|---|---|---|
| npx tsc -b --pretty false (작업 apps/web cwd) | exit0 | JSX구조·TS |
| git diff --check (작업 cwd) | exit0 | 최종diff |
| node document/ops/20261013-face-redesign2/account-20-qa.cjs (주저장소 cwd) | exit0,PASS,errors0 | 740×300/667×300/800×360/844×390/1366×768 ×8상태=40, 실제컴포넌트+mock props/subscription |
| node document/ops/20261013-face-redesign2/account-20-live.cjs (주저장소 cwd) | exit0,PASS,errors0 | 실제Guest740×300/800×360,기간4탭·기록토글·로그아웃확인취소·Escape/닫기/scrim |

Mock상태: Guest/Free/자산/긴안내/기록펼침(빈목록)/자산+탈퇴확인/Guest로그아웃/긴이름+긴스토리+연간수치+칼로리미산정문구. rich는DOM으로실제컴포넌트에문자만주입한밀도fixture,실제주행통계검증아님. 빈uid로Firestore통계구독막고subscription응답은로컬대체. 실제결제·연결·로그아웃확정·탈퇴실행없음.

모든상태 폭460/높이상한,좌우열같은시작점·가로넘침0,마지막행동접근.기본/자산/rich는스크롤0. 이전19검수와공통상태의버튼라벨/폰트/최소높이및스크롤증가없음대조. source구조변경이있으므로CSS만바꾼동일DOM전후라는주장은하지않음. prior19 JSON과동등한상태검증·이번rect을따로기록.

## 크기·시각 판단

참고 CSS v41 폭760px → 현재460px(39.5%축소). 기존단열270px보다넓다. 지도면적이모든상태에서줄었다고평가하지않는다. 두컬럼으로정보를나란히보려는Chief방향에맞춰전체높이와reference대비폭을절제했다.

| 800×360 상태 | 이번 크기 | 화면점유 | 본문스크롤 |
|---|---|---|---|
| 실제Guest |460×186.33|29.76%|0|
| mock자산 |460×186.33|29.76%|0|
| mockrich(246.77km,24h13m,미산정안내) |460×245.38|39.19%|0|
| mockGuest로그아웃확인 |460×263.61|42.10%|0|
| mock자산+탈퇴확인 |460×295.73|47.24%|0|

667×300 rich245.38px/탈퇴295.73px도스크롤0. PC는루트폰트16px로높이가더크며폭은460px고정. rich800·자산740·실제Guest800이미지직접검수: 요구2열역할·문구/버튼접근·파랑자산강조·미산정안내유지.

증거 [mock JSON](account-20-shots/results.json)·같은폴더대표PNG, [live JSON](account-20-live/results.json)·동폴더PNG. baseline2파일 account-before-20.css/tsx 보존. 실기기·실제등록계정·실제많은기록행·모든오류/키보드높이상태는미검증.

## 확인 위치

http://127.0.0.1:5013/ 오른쪽위계정명. 서버유지,다음창은Chief피드백후.

```powershell
Set-Location 'C:\Users\kdrea\.codex\worktrees\face-redesign2\boxcycle\apps\web'
npm run dev -- --host 127.0.0.1 --port 5013 --strictPort
```
