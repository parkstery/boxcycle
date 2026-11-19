# 주행 결과 창 구현 결과

2026-11-19 · Codex 직접 구현/검증 · Chief 요청으로 로컬 커밋·미배포.

Chief 시안 승인 후 추가 지시: 계기판 UI 형태·기능 변경 금지. 완주 문구는 `완주했어요. 내 도로망이 {새 도로} 더 늘어났어요.`

## 반영

- 결과 창 344px 단일 열, 제목 옆 실제 사용자 닉네임(selfRiderDisplayName: Guest 포함), S/E 주소 두 줄. 경로명 input은 저장 버튼 위에서 별도 편집 가능. 긴 주소는 폭을 늘리지 않고 해당 주소 안에서 줄바꿈한다.
- 시간·평균·거리·새 도로 히어로를 결과 창에서 제거. 완주+새 도로 확정 예시 `완주했어요. 내 도로망이 4.86 km 더 늘어났어요.` 미완주는 `주행을 마쳤어요.`로 시작하며, 미확정/0/기존 50m 미만 정책에서는 증가를 꾸며내지 않는다. 비동기 서버 확인이 도착하면 문장을 갱신한다.
- 기존 계기판 CSS·각 셀 렌더·센서 버튼/LED/설정 콜백은 보존. summary에서도 같은 active-ride 클래스와 센서 셀을 유지하고 종료 스냅샷의 거리/속도/새 도로·결과 시간/평균을 전달한다. 과거 최대 진행률로 종료 위치를 덮어쓰지 않는다. `이미 내 도로` 힌트도 유지한다.
- 종료 시점 UI 스냅샷(hudSnapshot·출발/도착 지명)을 메모리 RideEndResult에 추가. Firestore 저장 payload/Rules/동기화/외부 조회 정책은 변경하지 않았다. 기존 역지오코딩 응답으로 주소를 갱신한다.
- 결과 영역/스크림은 상단 safe-area+76px 아래. 기존 계기판이 어둡게 가려지지 않고 한 줄 그대로 유지된다. 결과 저장 성공/저장 안 함/닫기/바깥/Escape는 기존 closeSummaryAndReturnToIdleMap 경로로 결과와 주행 지표를 함께 해제한다. 체중·체력 설정·추정 칼로리·Guest 연결·저장 상태·실패·중복 경로 업데이트 기능은 보존. 추가 안내가 많거나 긴 주소면 결과 창 내부 세로 스크롤 가능.

## 파일

`RideSummarySheet.tsx/.css`, `MapHud.tsx`(표시 조건/기존 클래스 유지), `appHudValues.ts`, `useRideEndAndPersistence.ts`, `rideEndResult.ts`, `App.tsx`. 검증용 preview·신규 ride-summary-hud/summary-hud-lifetime·기존 batch3·entry-contract 갱신. 고정24를 고정84가 대체하며 고정50(편집·버튼 윗줄)을 유지.

## 검증

실행 폴더 `C:\20.HDev\boxcycle\apps\web`.

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/ride-result/summary-hud-lifetime.test.ts
node scripts/ride-verify/verify-selectors.mjs
$env:BATCH3_EVIDENCE_DIR='C:/20.HDev/boxcycle/tmp/ride-summary-20261119/regression'
$env:SENSOR_DOCK_EVIDENCE_DIR='C:/20.HDev/boxcycle/tmp/ride-summary-20261119/sensor'
node ../../node_modules/@playwright/test/cli.js test ride-summary-hud ui-redesign-batch3 sensor-dock --grep '종료 계기판|미완주·확인|결과창 닫는|주행 결과|경로명은|게스트 기록|센서 계기판' --workers=1 --retries=0
node ../../node_modules/typescript/bin/tsc -b --noEmit
node ../../node_modules/eslint/bin/eslint.js src/App.tsx src/app/appHudValues.ts src/components/ride/RideSummarySheet.tsx src/components/maphud/MapHud.tsx src/hooks/useRideEndAndPersistence.ts src/lib/ride/rideEndResult.ts scripts/ui-800x360/preview.tsx e2e/ride-summary-hud.spec.ts e2e/ui-redesign-batch3.spec.ts
node ../../node_modules/vite/bin/vite.js build
Set-Location C:\20.HDev\boxcycle
node scripts/check-dep-direction.mjs --check
```

통과: 단위3/3(실시간 초기화·누적 위치 vs 과거 진행률·닫힘·주행 중 기존 입력), 진입 계약21/21, UI28/28(가로4크기·주행 중과 완료 계기의 한 줄 배치/글자 크기 동일·센서 칸·문구·주소·닫힘5경로·기존 센서10건·경로명6크기·Guest/저장 상태). tsc·ESLint(오류0, App 기존 hook 경고7)·build(기존 큰 chunk 경고)·의존성 방향·diff check 통과. 800/667px 캡처 눈검수.

초기 실패: UI8건(새 도로 표시 조건에 summary 누락4·preview가 닫힌 뒤에도 경로 계기를 표시4), 진입 계약1건(제거한 히어로 앵커) → 수정 후18/18. 캡처에서 summary의 비주행 CSS가 두 줄로 바꾸는 것을 발견해 기존 active-ride 클래스를 유지하고 센서·실제 셀 위치/폰트 비교 단언을 추가 → 최종28/28. 기존 시험 기대는 Chief 새 지시에 맞게 갱신했으며 skip/기대 완화로 숨기지 않았다.

증거 `C:\20.HDev\boxcycle\tmp\ride-summary-20261119\completed-{800,736,699,667}.png`, `regression\`. 실제 컴포넌트 메모리 하네스이며 서버 쓰기 없음. 실 Firebase 주행 저장·실폰·실센서·전체quick 미실행(이번 종료 표시/UI 범위의 관련 단위·회귀 실행). 실앱 서버 저장·센서 하드웨어 검증으로 과장하지 않는다.

## 확인

로컬 서버 `http://127.0.0.1:5000` 실행 중, preview HTTP200 확인. 서버 로그 `tmp/ride-summary-20261119/dev-server{,-error}.log`. 꺼졌다면:

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
node ../../node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5000 --strictPort
```

1. 실제 앱: `http://127.0.0.1:5000/`에서 주행 → 종료 → 계기판 유지/닉네임/주소/새 도로 확인 후 문구 → 결과 닫힘과 함께 주행 지표 해제.
2. 서버 저장 없이 표시 확인: `http://127.0.0.1:5000/scripts/ui-800x360/preview.html?state=summary&completed` → 저장 안 함. 예시 지명/데이터이며 실제 저장 없음.

기존 타 작업 변경은 보존. 커밋·푸시·Hosting 배포는 하지 않았다.
