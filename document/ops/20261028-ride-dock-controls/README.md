> 최신 정정: 종료 후 경로가 남으면 시작 버튼이 다시 나타나야 한다. 아래의 기존 「짧은 종료 상태 보존」은 버튼을 영구 숨기는 상태까지 보존한 잘못된 검증이었다. 이번 재주행 요구와 다음 결과가 이를 대체한다.

## 종료 후 재주행 수정

원인: `RideControlBar`의 `endedRoute`가 같은 경로 토큰을 계속 차단했다. 앱의 `useRideUiStage`는 idle+경로있음이면 이미 ready-to-start를 반환하며, `handleStartRide`는 새 주행 시작 시 거리·시간을 초기화한다. 종료 이력에 따른 별도 표시 차단을 제거하고 stage를 따른다. 결과 시트가 열려 있으면 기존대로 숨기며, 결과를 닫거나 짧은 주행을 종료하면 같은 경로의 시작 버튼을 다시 표시한다. 경로·데이터 저장·Trail 정책 변경 없음.

검증: selector19 PASS, 변경 RideControlBar/관련e2e eslint PASS, TypeScript포함 build PASS. Playwright 첫 실행9PASS/1FAIL(결과 닫은 뒤 접힌 상태를 가정한 기존 테스트), 펼침 여부와 무관하게 시작 버튼·실제 재시작을 검증하도록 교정 후 해당1PASS. 최종10건 모두 검증: 4개 가로 배치/10명, 이어달리기선택/짧은종료재시작, 기존상태별배치, 결과닫기재시작, 입력차단, 주행중/일시정지중 종료 각3회반복. 결과 `.out/ride-restart-results`, 캡처 `.out/ride-restart-evidence`. 전체동시10PASS라고 보고하지 않는다. Firebase 실제 인증/실센서/실폰은 미실행.

현재 로컬 적용, 미커밋·미배포. 실행 폴더 `C:\20.HDev\boxcycle\apps\web`, 기존 http://localhost:5031/ 재사용. 새로고침 → 경로 설정 → 시작 → 종료 → 결과 닫기(나타난 경우) → 같은 경로 시작 버튼 → 다시 주행. 접힌 상태도 LED 옆 시작 버튼 확인.

재검증 시 기존 명령의 grep에 `종료 후 남은`을 포함한다.

# RouteDock 주행 제어 통합

상태: LOCAL_VERIFIED / 미커밋·미배포. 기존 배포 커밋은 `49d770f8`.

Chief 최종 지시: 펼친 RouteDock의 센서는 왼쪽, 시작·일시정지·재개·종료 묶음은 오른쪽 끝(안쪽8px)에 한 줄로 배치한다. 원형32px, 두 버튼 묶음70px의 첫 칸을 시작/일시정지/재개가 공유한다. 접힌 상태는 LED와 주행 제어 사이32px. 날짜/시간 제거, 주행 중 실제 참가자10명 이상이면10명 동시 표시.

주행 제어를 접힘 여부와 무관한 같은 React 위치에 두어 이어 달리기 선택 및 짧은 종료 상태를 보존했다. 기존 순위 계산의 주변5명 제한에 표시 개수 옵션을 추가하고 주행 패널은10명을 요청한다. 참가자가 부족하면 실제 인원만 표시한다. 10행 검증은 DOM 복제가 아닌 React fixture 데이터로 수행했다.

## 검증

- PASS: `node scripts/ride-verify/verify-selectors.mjs` — 19단계.
- PASS: `node --experimental-strip-types --test scripts/ride-stats/leaderboard-live-rank.test.ts` — 7건, 상단/중간/마지막 내 순위·부족 인원 포함.
- PASS: `npx eslint src/components/route-dock/RouteDock.tsx src/components/leaderboard/LeaderboardGlance.tsx src/components/leaderboard/leaderboardLiveRank.ts e2e/ride-dock-layout.spec.ts`.
- PASS: `npm run build` — TypeScript 포함. 기존 큰 번들 경고.
- PASS: Playwright 9건(48초). 새 배치4크기/실제10행/시계제거4건 + 접기상태유지1건 + 기존 주행제어4건. 기존5031 서버를 사용한 임시 설정으로 실행했고 설정은 제거했다. 결과 `.out/ride-dock-results/.last-run.json`, 캡처 `.out/ride-dock-evidence`.
- 미실행: 전체quick, 실폰·실센서, Firebase 실제 인증 진입. 화면fixture 검증으로 실제 인증·센서 결과를 대체하지 않는다.

## 실행·확인

실행 폴더 `C:\20.HDev\boxcycle\apps\web`.

```powershell
cd C:\20.HDev\boxcycle\apps\web
npm run dev:localhost -- --port 5031
```

기존 서버가 있으면 재사용한다. http://localhost:5031/ 새로고침 → 경로 설정 → 시작 버튼 위치 → 시작 → 접기/펼치기 → 일시정지/재개/종료.

회귀 재실행:

```powershell
$env:RTW_DEV_PORT = '5031'
$env:UI_REVALIDATION_EVIDENCE_DIR = 'C:\20.HDev\boxcycle\.out\ride-dock-evidence'
npx playwright test ride-dock-layout.spec.ts route-ride-controls.spec.ts --grep 'RouteDock|접기·펼치기|주소 접기|준비되지|짧은' --workers=1 --retries=0
```
