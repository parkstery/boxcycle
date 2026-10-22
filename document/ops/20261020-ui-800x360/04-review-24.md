# 거리 자동 생성·재시작 최종 검수

2026-10-22 · record · LOCAL_VERIFIED / Chief 실제 화면 확인 대기. [결과24](03-result-24.md).

Chief 신고 두 흐름을 실제 `useDistanceAutoRoute`·bridge·MapView로 검증했다. 기존23 시험은 UI callback fixture라 실제 결과 적용의 profile 경합을 놓쳤다. 이번에는 네트워크 API만 대체하고 `onApplyRoute`·핀·geometry 반영까지 검사한다. 방향 클릭으로 자동 생성하고, 이동수단 버튼은 같은 방향의 재탐색에 사용한다. 기본·승계 수단을 사용하므로 도착점을 다시 확정하는 단계가 없다.

cwd `C:\20.HDev\boxcycle\apps\web`:

| 명령 | exit | 결과 |
|---|---:|---|
| `npm run test:distance-auto-route` | 0 | 144 PASS |
| `npx playwright test e2e/distance-route-continuation.spec.ts e2e/distance-direction-attention.spec.ts e2e/map-route-runtime.spec.ts e2e/route-ride-controls.spec.ts --workers=1 --retries=0` | 1 | 11 PASS/2 FAIL. 나머지2는 구형 ‘출발·도착 탭에서 설정’ 안내를 기대한 DOM assertion. 새 출발 버튼 계약으로 교정 |
| `npx playwright test e2e/route-ride-controls.spec.ts e2e/distance-target-arrows.spec.ts --workers=1 --retries=0` | 0 | 10 PASS /33.1s |
| `npx playwright test e2e/distance-route-continuation.spec.ts --workers=1 --retries=0` | 0 | 최종1 PASS /7.4s. 탐색 중 삭제·새 요청 완료 후 옛 응답 도착 무시까지 포함 |
| `npx tsc -p tsconfig.json --noEmit` | 0 | PASS. 최종 build에서도 재확인 |
| `npx eslint src/App.tsx src/components/map/MapView.tsx src/components/map/mapPopupElements.ts src/hooks/useDistanceAutoRoute.ts src/lib/debug/distanceAutoRouteClickDebugMarker.ts scripts/ui-800x360/distance-route-runtime.tsx e2e/distance-route-continuation.spec.ts e2e/distance-direction-attention.spec.ts e2e/route-ride-controls.spec.ts` | 0 | 오류0 / 기존 App7+MapView8경고 |
| `npm run build` | 0 | 최종2.83s, 기존 큰번들·SADDLE/PELVIS 경고 |
| `git diff --check` (repo root) | 0 | PASS |

고유 브라우저14종 분할 통과(기존수동9·지도제스처2·펄스/직접탐색1·실제hook1·화살표1). 초기 실제hook 시험에서 결과 profile cycling/driving 경합 FAIL→코드 교정. 다음 새 출발 위치 검사는 시험 좌표가 패널에 겹쳐 FAIL→빈 지도 좌표300,80과 임시마커1 확인으로 교정. 초기 lint는 fixture Runtime 미export1오류→export 후PASS. 실패를 최종 통과와 구별해 남긴다.

증거 `.out/step24-distance.log`, `step24-final-browser.log`, `step24-regression.log`, `step24-cancel-final.log`, `step24-lint.log`, `step24-build-final.log`. 초기 조사 `step24-browser.log`, `step24-hook-final.log`. 캡처 `.out/step24-distance-start.png`(거리 탭 유지·기존 출발 버튼), `.out/step24-distance-generated.png`(새 출발 S·자동 도착 E·경로·이동수단) 직접 확인. 최소 지도 스타일이므로 실제 타일·실기기 외관 검증으로 간주하지 않는다.

최종5002 모듈 HTTP200·신규 출발 안내 포함 확인. 기존5002/PID27008 보존. Playwright가 이번 실행에서 기동한5000/PID27780만 종료했다. 기존 dirty/evidence/다른 서버 보존, 커밋·푸시·배포 없음. 미실행: 실제폰·실 Firebase API 경로 응답·실주행/BLE·추가 비용계측. 서버/API/탐색 알고리즘 변경0.

Chief 직접 검증: 현재 [localhost5002](http://localhost:5002)을 새로고침한다. 서버를 다시 시작해야 할 때만:

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
npm run dev:localhost -- --port 5002 --strictPort
```

확인 순서:

1. ‘여기에서 계속’ → 거리·방향 탭/승계 출발 확인 → 필요하면 목표 거리 확정 → 지도 방향 클릭 → 자동 도착/경로 생성 확인.
2. 이동수단 버튼 클릭 → 같은 방향으로 수단 변경 재탐색 확인.
3. 경로 삭제 → 거리 탭 유지·출발 버튼 확인 → 지도 새 위치 길게누르기 → 출발 → 목표 거리 확정 → 방향 클릭 → 새 경로 생성.
4. 탐색 중 삭제 후 같은 순서로 재시작 → 옛 결과가 새 경로를 덮지 않는지 확인.
