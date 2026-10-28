# 계정 버튼 오른쪽 위 정렬 — LOCAL_VERIFIED

2026-10-28 Chief 후속 「계속 진행해. 계정 버튼을 오른쪽 위 구석에 붙여. RouteDock과 미니맵을 왼쪽 가장자리에 붙이는 작업은 이미 구현된 것을 확인했다」에 따라 재개. 이후 제품 변경은 `apps/web/src/components/maphud/MapHud.css`만 수행했다. 왼쪽 패널 구현은 유지했다.

계정의 top/right를 safe-area 끝으로 정렬하고 세로 가운데 정렬·추가 서비스 margin을 제거했다. 좁은 폰 가로 및 긴 거리 수치에서는 기존 flex 줄바꿈이 계정을 둘째 줄로 밀던 문제를 두 열 grid로 교정했다. 첫 줄 지도 조작/계정, 다음 줄 카메라. 닉네임·계정 진입·하단/왼쪽 배치 유지. 작은 CSS 작업으로 Supervisor가 직접 구현·검수, 커밋·푸시·배포 없음.

## 검증

- PASS — Ego 실제 제품 컴포넌트 fixture: 800×360·736×360·699×273·667×300·1280×720 × ready/riding/paused = 15개. 계정 top0/right viewport 끝, 중앙 실제 hit-test, 지도 조작 비겹침. `evidence/geometry.json`.
- PASS — 계정 실제 클릭·Escape·키보드 Enter 진입 2개, 긴 수치800/699폭 2개. `evidence/interactions.json`.
- PASS — 기존 HUD/우상단 회귀 5개(최종 CSS 이후 재실행).
- PASS — `npm run build`(tsc 포함). Vite의 큰 chunk 경고는 빌드 실패가 아니다.
- PASS — `git diff --check -- apps/web/src/components/maphud/MapHud.css`.
- PASS — 대체 Playwright 캡처 `evidence/account-699x300.png` 눈검수: 계정 우상단, 지도 조작 왼쪽·카메라 아래.
- 중간 실패 — 첫 geometry 검사에서 기존 좁은 화면 flex 줄바꿈으로 6개 상태 top>0. grid 교정 후 15/15 통과. 초기 patch는 이미 변경된 왼쪽 CSS 문맥 불일치로 실패, 이후 Chief 지시대로 계정만 진행.
- 도구 실패 — Ego screenshot의 Page.captureScreenshot timeout. 직접 DOM·입력 검증은 통과, Ego 공간9 종료 후 별도 headless Playwright 캡처로 전환했다.
- 미실행 — 실제 폰/노치/실계정·실주행·전체 quick/lint: 배치 CSS에 한정해 관련 화면 회귀와 타입 포함 빌드로 검증. 노치는 CSS env 유지, 실제 기기는 미검증.

## 실행·재확인

폴더 `C:\20.HDev\boxcycle\apps\web`, 기존5031 서버 재사용:

```powershell
Set-Location 'C:\20.HDev\boxcycle\apps\web'
# 기존 서버가 없을 때만 실행
npm run dev:localhost -- --port 5031
```

[실제 앱](http://localhost:5031/) 새로고침 → 대기/주행 계정 오른쪽 위 → 눌러 사용자 정보 확인. [제품 컴포넌트 즉시 확인](http://127.0.0.1:5031/scripts/ui-800x360/preview.html?state=riding)에서 폰 가로699×300도 확인 가능(지도·계정은 fixture).

회귀 재현:

```powershell
Set-Location 'C:\20.HDev\boxcycle\apps\web'
$env:RTW_DEV_PORT='5031'
npx playwright test e2e/ride-ui-moments.spec.ts e2e/compact-controls.spec.ts --grep 'HUD 한 행|우상단 계정' --workers=1 --retries=0
npm run build
```
