# 경로 생성 창 재배치 — LOCAL_VERIFIED

2026-10-29 Chief 「구현해」로 최신 시안 승인. 시안의 가짜 데이터 대신 실제 DOM·콜백을 유지해 반영했다. 커밋·푸시·배포는 하지 않았다.

## 변경

- `mapPopupElements.ts`: 제목 「경로」를 별도 heading으로 두고 모드 버튼을 같은 헤더에 배치. 삭제 버튼을 두 모드 공통 하단의 주행 시작 왼쪽으로 이동. 토큰 안내는 기존 구독·문구를 유지하고 필요할 때 제목 아래 독립 행으로 표시한다.
- `RoutePickPopup.css`: 폭228px·padding10/12px, 헤더 모드38×26px·닫기28px. Start/+WP/End66×28px·gap3px, 거리칩30×28px·양끝 배분. 목표거리14px·700. 수단28px·주행32px 유지. 기본 fixture에서 두 창은 각각228×160/194px. 주소가 길거나 토큰 안내·탐색 상태가 있으면 필요한 높이만 늘어난다.
- 관련 e2e 3파일: 새 위치에 맞는 기대값, 헤더/닫기·하단 비겹침, 5화면 크기(800×360·736×300·699×273·667×300·320×568), 토큰 안내·칩 양끝 정렬·높이 검증. 고정15/49 갱신.

## 검증 명령·결과

실행 폴더: `C:\20.HDev\boxcycle\apps\web`. 기존5031 서버 재사용.

```powershell
cd C:\20.HDev\boxcycle\apps\web
npx tsc -b --noEmit
node scripts/ride-verify/verify-selectors.mjs
npx eslint src/components/map/mapPopupElements.ts e2e/ui-redesign-batch5.spec.ts e2e/route-media-controls.spec.ts e2e/distance-direction-attention.spec.ts
$env:RTW_DEV_PORT='5031'
$env:BATCH5_EVIDENCE_DIR='C:/20.HDev/boxcycle/document/ops/20261029-route-header-layout/evidence/final'
npx playwright test ui-redesign-batch5 route-media-controls distance-direction-attention --workers=1 --retries=0 --reporter=line --global-timeout=180000
$env:BATCH5_EVIDENCE_DIR='C:/20.HDev/boxcycle/document/ops/20261029-route-header-layout/evidence/final-corrected'
npx playwright test ui-redesign-batch5 distance-direction-attention --grep '승인 시안|긴 주소|재배치 후|10-25 Chief' --workers=1 --retries=0 --reporter=line --global-timeout=90000
npm run build
```

- PASS: tsc, 셀렉터20단계, 변경 eslint, 최종 build(tsc 포함). build는 기존 대형 chunk 안내가 있으며 종료0.
- 화면 묶음: 40 PASS/1 FAIL(1.3분). 실패는 이전 하단 순서가 삭제 버튼을 포함하지 않는 기대값. 새 승인 배치에 맞춰 수정했다. 이어 숫자입력 높이를28→26px로 맞춰 거리창194px를 확정했다.
- 최종 영향분 재검: 4 PASS/0 FAIL(17.1초). 실패 항목·5화면×두 모드/첫 팝업 기하·긴 주소/120.0km·토큰 안내/양끝 배분/160·194px 검증. 전체42건 동시 통과로 기록하지 않는다.
- 최초 35건 실행은33 PASS/2 FAIL: 하단 수단 그룹의 기존width100%로94px 넘침. width:auto로 수정 후 위 화면 묶음의 기하·긴 주소 모두 통과.
- 첫 시험 파일 수정 명령은 작업 폴더 기준 경로 오류로 수정 전 실패했다. 루트에서 재실행 후 정상 반영.
- 루트 `node scripts/check-dep-direction.mjs --check`, `node scripts/check-code-tidy.mjs`, `git diff --check` PASS. exports186 기준선 유지.
- 캡처: `evidence/final-corrected/compact-distance-699x273.png` 및 `evidence/final/batch5-location-800x360.png` 직접 눈검수. 기존 작업의 증거는 덮어쓰지 않았다.

실폰·실센서·실Firebase·유료 탐색API는 미실행(이번 변경은 DOM/CSS 배치이며 fixture·실제 MapView 하네스로 확인). 전체quick·서버 시험은 UI 범위여서 생략. 기존 타인 dirty·서버를 보존했다.

## 확인

```powershell
cd C:\20.HDev\boxcycle\apps\web
npm run dev:localhost -- --port 5031
```

이미 서버가 있으면 재사용. http://localhost:5031/ 새로고침 → 지도 길게 누름 → 제목·모드·닫기 한 행 → Start/+WP/End → 거리·방향 전환/거리 입력·칩·± → 하단 수단·삭제·주행 확인.

Firebase 없이 실제 팝업 컴포넌트만 확인하려면 http://localhost:5031/scripts/ui-redesign-batch5/fixture.html?state=location 또는 `?state=distance`.
