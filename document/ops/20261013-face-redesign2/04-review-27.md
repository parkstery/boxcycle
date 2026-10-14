# 감리27 — 입문 경로 목록

2026-10-14 Supervisor Codex. 판정 APPROVED(구현·검수), AWAITING_CHIEF(사용 확인). 이전 두 목록26은 Chief 승인. 이번 검수 대상은 입문 창 한 개다.

Developer OpenCode Muse Spark1.3, 모델 `opencode/muse-spark-1.3-contributor-free`, 세션 `ses_ec66a9f0affeGwIDSIOsCbVkwe`, run 종료코드0. 실제 응답·편집·[결과27](03-result-27.md) 확인. 실행로그 muse-27.jsonl 보존. [지시27](02-task-27.md).

작업 위치 face-redesign2/boxcycle, branch face-redesign2, HEAD8fdedae. OfficialCourseListModal.css 한 파일에 입문 aria 범위 override만 추가했다. 폭460px·내용 높이 종료·검색/정렬 한 행·행 구분선·여백 절제. 공용 base와 퍼블릭 기존 규칙은 그대로다. 입문 선택행은 최소44px 유지, 내 경로/퍼블릭의32px 예외를 확대하지 않았다. 폰트·문구·TSX·데이터·콜백·인증·주행 로직 불변. commit/push/merge/deploy 없음.

## 독립 검증

- `npx tsc -b --pretty false` (작업 apps/web): 종료코드0.
- `git diff --check` (작업 cwd): 종료코드0.
- `node document/ops/20261013-face-redesign2/intro-27-live.cjs`: 종료코드0, PASS, runtimeErrors0. 실제 Guest740×300의 입문 진입/검색/정렬3종/Escape 닫기, 퍼블릭·내 경로 같은 DOM에서 CSS 교환 전후 전체 rect 동일.
- `node document/ops/20261013-face-redesign2/intro-27-qa.cjs`: 최종 종료코드0, PASS, runtimeErrors0. 740×300/667×300/800×360/844×390/1366×768 × 7상태=35 및 기능5묶음. 실제컴포넌트 mockprops의3개·긴이름/등록자·선택+나가기·disabled·0/1개·퍼블릭회귀. text/font동일·행≥44·가로넘침0·검색/정렬/닫기겹침없음·퍼블릭전체rect동일. 정렬3·검색0/1·1click load:p1+close·나가기+close·Escape 콜백 통과.

Mock3개기본740 높이237.27→197.16px, 긴이름 완전2→3개, 선택+나가기 완전2→3개. 실제자료4개는본문에모두표시하며목록개수와mock차이를구분한다.

최초 mock driver는 나가기 콜백 기록을 다음 기능 검증에서 초기화하지 않아 load+close 기대값에 앞선 leave+close가 섞여 assertion 실패했다. 앱 변경 없이 검증 상태 초기화 후 재실행했다. 최초 결과는 intro-27-shots/results-initial-27.json에 보존, 성공으로 보고하지 않는다.

실제 입문 카탈로그는 현재4개다. 740×300 창420×255→460×241.16px, 목록 높이166→182px, 완전 표시3→4개. 화면 점유율48.24%→49.97%로 약간 증가하며, 지도 가림 감소라고 보고하지 않는다. 실제740 캡처 직접 확인: 현재4개 모두 표시, 검색·정렬·닫기 겹침 없음, 경로명/수단/거리/활동 안내 보존.

증거 [실제앱 JSON](intro-27-live/results.json) 및 같은 폴더 전후PNG, [mock JSON](intro-27-shots/results.json) 및 대표PNG. 실제 경로 로드·주행·실기기 터치·키보드 높이 변화는 미검증. Mock에서는 실제 컴포넌트와 localprops/콜백으로 검증한다.

## 확인

http://127.0.0.1:5013/ → RTW → 입문. 서버 실행 위치는 기존 worktree apps/web이며 다음 창은 Chief 피드백 후 진행한다.

```powershell
Set-Location 'C:\Users\kdrea\.codex\worktrees\face-redesign2\boxcycle\apps\web'
npm run dev -- --host 127.0.0.1 --port 5013 --strictPort
```
