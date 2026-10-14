# 감리18 — 메뉴 창 내용 높이

2026-10-14 Supervisor Codex. 판정: APPROVED(구현·검수), 상태 AWAITING_CHIEF(사용 확인). Chief 요청: Muse Spark에 지시·검수하여 창 하나씩 완료 보고. 이번 단위는 메뉴 창 높이 정리다.

## 실행 및 범위

작업 cwd `C:/Users/kdrea/.codex/worktrees/face-redesign2/boxcycle`, branch `face-redesign2`, HEAD `8fdedae`. 기존 dirty MapView.css/MapHud.css/LocalFirstEntryCard.css와 문서 보존. 새 앱 변경은 MenuPanel.css만, 15줄 추가/3줄 제거. TSX·데이터·기능 변경 없음. commit/push/merge/deploy 없음.

CLI v2.0.24에서 아래 명령 실행. 세션 `ses_ec7187eceffePjj6QZTGe2B0LQ`, 실제 모델 응답·도구 실행·결과 파일 확인, 종료코드 0. 모델 ID를 지정해 실행했고 다른 모델로 교대하지 않았다.

```powershell
& 'C:/Users/kdrea/AppData/Roaming/ai.opencode.desktop/cli/2.0.24/opencode-cli.exe' run --model opencode/muse-spark-1.3-contributor-free --title 'RTW menu window task18' --format json --file C:/20.HDev/boxcycle/document/ops/20261013-face-redesign2/02-task-18.md '첨부 지시18을 읽고 지정 CSS 한 파일만 수정하고 결과를 기록하라.'
```

Developer [결과18](03-result-18.md)과 실제 diff 일치. bottom 고정 제거, viewport 높이 상한, 내용 높이 flex, 헤더 축소 방지, 본문 ride-panel 기존 scroll 보존, 오른쪽 아래 모서리 12px.

## 독립 검수

- `npx tsc -b --pretty false` (작업 worktree apps/web cwd): 종료코드 0.
- `git diff --check` (작업 worktree cwd): 종료코드 0.
- `node document/ops/20261013-face-redesign2/menu-18-qa.cjs` (주 저장소 cwd): 최종 종료코드 0, PASS. 4 viewport × live/summary/long 12상태와 viewport별 기능 검증 4건, runtimeErrors 0. 긴 내용 실제 wheel 스크롤, 헤더 고정, 메뉴 Escape/닫기 버튼/scrim 및 내 경로 목록 진입 통과. 실행 앱의 새 Guest 진입 후 메뉴 조작. CSS baseline은 수정 전 복사한 menu-before-18.css. 각 상태에서 CSS만 교환하므로 다른 색상·데이터 상태가 전후 비교에 섞이지 않음.
- 최초 harness는 인증 진입 창 출현 전 메뉴 버튼을 클릭해 timeout. 이를 통과로 처리하지 않았다. Guest 시작 창의 출현·닫힘을 기다리도록 검증 스크립트 수정. 첫 긴 내용 fixture가 ride-panel 밖에 있어 실제 scroll 소유자를 반영하지 못한 점도 수정; 최종은 ride-panel 안의 긴 내용과 실제 wheel 입력으로 검증한다.

## 대표 측정

740×300에서 실제 Trailhead 메뉴: 207.89×300 → 207.89×157.78px, 화면 점유율 28.09% → 14.78%. 긴 경로 요약을 DOM으로 주입한 상태: 높이 183.72px, 점유율 17.20%. DOM fixture는 실제 Trail 생성·주행 검증이 아니다.

전후 글자·버튼 폭/높이·텍스트 일치, 가로 overflow와 viewport 높이 초과 없음. 기존 작은 버튼을 이번에 더 줄이지 않았다. 기존 터치 타깃 전체가 44px 이상이라는 주장은 하지 않는다.

740×300,667×300,844×390,1366×768의 live/summary/long 전후 캡처와 rect·점유율·scroll·controls는 [증거 JSON](menu-18-shots/results.json) 및 같은 폴더 PNG. 740 live/summary 전후 이미지 직접 검수: 하단 빈 배경 제거, 폰트·버튼 유지, 오른쪽 하단 모서리 정상.

## 실행 위치

확인 서버 http://127.0.0.1:5013/ — face-redesign2 apps/web cwd에서 Vite 실행 중. 재실행:

```powershell
Set-Location 'C:\Users\kdrea\.codex\worktrees\face-redesign2\boxcycle\apps\web'
npm run dev -- --host 127.0.0.1 --port 5013 --strictPort
```

서버가 이미 실행 중이면 재실행할 필요 없이 URL을 열고 왼쪽 위 RTW로 메뉴 진입한다. 실기기 터치·Bluetooth·실제 주행/긴 Trail 목록은 미검증. 다음 창은 Chief가 이번 화면을 확인하고 피드백한 뒤 착수한다.
