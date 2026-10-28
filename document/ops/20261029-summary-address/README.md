# 주행 결과 주소 표시·행 고정

2026-10-29 Chief 첨부2장 지시: 주소가 버튼처럼 보이지 않게 하고, 모든 화면에서 저장버튼 윗줄에 유지한다. 기존 색상 유지. 소규모 CSS·접근성 속성 변경이라 Supervisor 직접 구현. 구조·저장 의미·공용API 변경 없이 처리한다.

## 변경

- RideSummarySheet의 주소처럼 보이는 요소는 실제 저장될 경로명 입력. 편집·저장은 보존하고 테두리/둥근모서리/배경/그림자/좌우패딩 제거, 전체폭 단독행으로 배치했다. 포커스에서만 파란 outline, aria-label·전체값title 추가.
- 저장버튼행은 항상 경로명 다음행, 오른쪽정렬. 444×194 고정 크기·기존색 보존.
- 게스트 안내가 동시에 표시될 때 넘침을 해결: 문구없는 빈 저장상태행 제거, 안내문과 Google연결을 한행에 배치(문구 줄바꿈은 유지), 세부행간격2px·경로명행16px. 안내/상태/행동을 삭제하지 않았다.
- 별개 계정 시안은 흰색#FFFFFF/연파랑#EEF3FC/강조#2457D6 등 실제 UserInfoSheet 팔레트로 고정. 다크모드에 따라 임의변색되던 light-dark 제거. 계정 제품은 여전히 시안 단계.

## 검증

실행 `C:\20.HDev\boxcycle\apps\web`:

```powershell
cd C:\20.HDev\boxcycle\apps\web
npx tsc -b --noEmit
npx eslint src/components/ride/RideSummarySheet.tsx e2e/ui-redesign-batch3.spec.ts
$env:RTW_DEV_PORT='5031'
$env:BATCH3_EVIDENCE_DIR='C:/20.HDev/boxcycle/document/ops/20261029-summary-address/evidence/verified'
npx playwright test ui-redesign-batch3 --grep '주행 결과|경로명은' --workers=1 --retries=0 --reporter=line --global-timeout=150000
npm run build
```

tsc·eslint PASS. 최종Playwright **8 PASS/0FAIL(13초)**. 일반/저장중/실패상태·게스트안내/저장 동시노출, 신규1770×800/1015×458/800×360/699×273/667×300/390×844에서 짧고긴일본경로명12조합·보더/배경없음·상단행/넘침0·편집·저장클릭 확인. 새캡처 evidence/verified/, 1015×458눈검수. 계정시안QA736/520/320에서 가로넘침0·기록펼침닫기PASS.

실패이력: 최초5PASS/게스트3FAIL(세로46px넘침) → 빈상태행/안내배치/간격보정 후 게스트2px넘침 → 최종간격2px 적용후8PASS. 기대값완화/skip없음. 각 실행로그 .out/summary-address-{test,final-test,verified}.log. 기존증거덮어쓰기없음.

실폰·실Firebase 저장 미실행(UI·fixture저장콜백검증). 커밋·푸시·배포없음.

## 확인

```powershell
cd C:\20.HDev\boxcycle\apps\web
npm run dev:localhost -- --port 5031
```

기존5031서버재사용. http://localhost:5031/ 새로고침 → 주행종료 → 주소가 저장버튼 윗줄의 일반텍스트형인지 확인. 즉시fixture: http://localhost:5031/scripts/ui-800x360/preview.html?state=summary
