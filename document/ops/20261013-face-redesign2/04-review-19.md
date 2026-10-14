# 감리19 — 계정 창 내용 높이·통계 경계

2026-10-14 Supervisor Codex. 판정 APPROVED(구현·검수), AWAITING_CHIEF(사용 확인). 이전 메뉴18은 Chief 채택 완료.

## 실행·범위

Developer OpenCode Muse Spark 1.3. CLI v2.0.24, 모델 `opencode/muse-spark-1.3-contributor-free`, 세션 `ses_ec6ee2fb0ffen1MjetJchdT8tg`, run 종료코드0. 지정모델 실제 응답·편집·결과 확인. [CLI JSONL](muse-19.jsonl), [지시19](02-task-19.md), [결과19](03-result-19.md).

작업 cwd `C:/Users/kdrea/.codex/worktrees/face-redesign2/boxcycle`, branch face-redesign2, HEAD8fdedae. 이번 앱 diff UserInfoSheet.css 한 파일(8추가/4삭제)만. bottom:0 제거·왼쪽 아래 radius12px, 통계 세 정보 열 개별 배경/테두리 제거와 열 사이 세로 구분선 추가. 폰트·버튼·문구·숫자·데이터·TSX·공용인터페이스 불변.

MenuPanel.css/MapView.css/MapHud.css/LocalFirstEntryCard.css는 [수정 전 SHA256](preserved-before-19.json)과 독립 대조하여 모두 동일. 기존 승인·dirty 보존. commit/push/merge/deploy 없음.

## 독립 실행 검수

| 명령 | 결과 | 범위 |
|---|---|---|
| `npx tsc -b --pretty false` (작업 apps/web cwd) | exit0 | TypeScript |
| `git diff --check` (작업 cwd) | exit0 | 실제 diff |
| `node document/ops/20261013-face-redesign2/account-19-qa.cjs` (주 저장소 cwd) | exit0,28상태,errors0 | 실제 React 컴포넌트+mock props·subscription response,740×300/667×300/844×390/1366×768 × Guest/Free/자산/긴 안내/기록펼침/자산+탈퇴확인/Guest로그아웃확인 |
| `node document/ops/20261013-face-redesign2/account-19-live.cjs` (주 저장소 cwd) | exit0,PASS,errors0 | 실제 Guest 앱740×300/844×390,기간탭4개·로그아웃확인/취소·Escape/닫기/scrim |

Mock의 uid는 빈 값으로 Firestore 기록 구독을 막고 subscription은 로컬 응답으로 대체. 실제 Google 연결·결제·로그아웃 확정·탈퇴 실행 시험이 아니다. Live는 새 Guest로 앱에 들어가 계정 패널을 실제 클릭했으며 로그아웃은 확인창을 취소했다.

CSS baseline은 직전 account-before-19.css. 전후 같은 DOM 상태에서 CSS만 교환. Mock은28상태 모두 패널 높이 상한,가로overflow0,마지막행동 접근,스크롤 증가 없음,버튼폭/높이/폰트일치 assertion. Live도 버튼 rect/폰트 동일 확인. 기존22px Chief특정예외 유지,모든터치영역44px충족이라는 주장 아님.

## 측정·시각

| 740×300 상태 | 전 높이 | 후 높이 | 비고 |
|---|---:|---:|---|
| 실제Guest |300|211.56|화면점유36.49%→25.73%,본문스크롤0|
| mock자산 |300|267.47|본문스크롤0|
| mock긴안내 |300|269.41|본문스크롤0|
| mockGuest로그아웃확인 |300|288.84|보존안내·취소·확정행동모두표시|
| mock자산+탈퇴확인 |300|300|본문스크롤92px 필요,마지막행동접근PASS,전보다증가없음|

실제 Guest844 및 mock자산740/로그아웃667 캡처 직접 검수. 메뉴와 같은 패널 마감 모서리,3통계열구분선,자산강조·행동·텍스트 보존 확인. UID이동/연결안내통합은 이번미구현,기능변경을 섞지 않음.

증거: [mock JSON](account-19-shots/mock-states.json)·같은폴더56전후PNG, [live JSON](account-19-live/results.json)·같은폴더4전후PNG. 실기기 터치·실제 등록계정·실제 주행 데이터·모든 오류문구 미검증.

## 사용자 확인

서버 http://127.0.0.1:5013/ 유지. 오른쪽 위 계정 이름을 눌러 확인. 실행위치 `C:/Users/kdrea/.codex/worktrees/face-redesign2/boxcycle/apps/web`.

```powershell
Set-Location 'C:\Users\kdrea\.codex\worktrees\face-redesign2\boxcycle\apps\web'
npm run dev -- --host 127.0.0.1 --port 5013 --strictPort
```

이미 실행 중이면 명령 재실행 불필요. Chief 피드백 전 다음 창 미착수.
