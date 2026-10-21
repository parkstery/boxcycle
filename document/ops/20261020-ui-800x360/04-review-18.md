# Supervisor 통합 검수

2026-10-22 · record · LOCAL_VERIFIED / 릴리스 진행. [결과18](03-result-18.md).

검증은 `C:\20.HDev\boxcycle\apps\web`에서 실행했다.

- `node --experimental-strip-types --test scripts/map/map-route-pick-gesture.test.ts`: 12 PASS.
- `npx playwright test e2e/map-route-runtime.spec.ts e2e/address-minimap-width.spec.ts e2e/route-ride-controls.spec.ts --workers=1 --retries=0`: 12 PASS(58.3s). 실제 MapView2/주소1/경로·주행9. 네이티브 CDP touch/pinch 및 마우스 포함.
- 초기 `ui-800x360 + 주소 + 경로` 시험:22 PASS/1 FAIL. 기존 start-only 시험이 숨겨진 수단버튼을 클릭한 실패이며 제품 변경 없이 시험교정 후 재실행 PASS. ui-800x360 13개는 초기 모두 PASS.
- `npm run build`: 타입/프로덕션 번들 PASS. 기존 SADDLE/PELVIS export·큰 번들 경고 유지.
- 개발부산물 등록부 PASS. 변경파일 lint 최초 fixture export 누락1건 교정 후 최종 재실행. `git diff --check` PASS.

LIVE Firebase 에뮬레이터 전용17 e2e 및 예전 popup-title 전체 시나리오는 미실행. 실제 MapView fixture로 입력→출발/도착/방향 흐름을 검증했으나 실제폰/BLE/실제 위성 타일 체감은 Chief 확인 대기. 운영 데이터 쓰기 없음.

직접 실행:

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
npm run dev:localhost -- --port 5002 --strictPort
```

http://127.0.0.1:5002 강력 새로고침 → 짧은 탭은 경로창 없음 → 정지500ms 길게 누르기로 창 열기 → 출발 지정 → 다른 위치 길게누르고 도착 지정 → 메뉴/지도밀기/두손가락 확대에서 위치 미변경 확인. 운영 배포 증거는 별도 릴리스18에 기록한다.
