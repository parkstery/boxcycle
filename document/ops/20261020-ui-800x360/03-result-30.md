# 적용 수단·결과창 압축 구현 결과

2026-10-22 · record. Codex 단일 writer. [지시30](02-task-30.md).

- 자동 방향 탐색의 성공이 profileChosen을 갱신하지 않아 세 수단이 회색으로 남는 분기를 교정. 성공 시 현재 탐색 수단을 선택 표시하며 aria-pressed도 동기화한다. 실제 geometry가 있는 창을 다시 열면 routeProfile을 강조. 준비 중 안내를 생성 완료로 잘못 초기화하지 않게 initialHasRoute 조건 추가. 탐색 전 기본값은 강조하지 않는다.
- 두 모드의 공통 profileBottomRow에 이동수단3개→재생→경로삭제를 배치. 이전 두 행은 한 행으로 복귀. 주행 시작 조건·콜백·원형 제어는 유지.
- offered formatter를 `클릭 지점까지 도로로 0.8km` + 개행 + `목표 0.5 km 지점에서 종료.`로 변경. 상태 문구에 pre-line 적용. 팝업은 viewport 제한을 둔280px 폭으로 고정해 결과 내용에 따른 가로 확장 방지.
- 거리 runtime fixture에 실제 재생 UI와 경로 보존 재열기 추가. 높이300px에서는 실제 앱의 app-shell--map-first 부모가 적용하는 지도 min-height 해제 규칙을 재사용하도록 fixture 부모 클래스 보강. 제품 높이 규칙은 변경하지 않았다.

## 검증

cwd `C:\20.HDev\boxcycle\apps\web`:

| 명령 | 결과 |
|---|---|
| `node scripts/ride-verify/verify-selectors.mjs` | exit0, 19단계 PASS |
| `npm run test:distance-auto-route` | exit0, 146 PASS |
| `npm run build` (저장소 루트) | exit0, 타입·빌드 PASS/기존 rig·번들 경고 |
| 변경 MapView/popup/formatter/fixture/spec eslint | exit0, 오류0/기존 MapView경고8 |
| 아래 브라우저 명령 | exit0, 17 PASS/56.0s |
| `git diff --check` (저장소 루트) | exit0 |

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
$env:RTW_DEV_PORT='5002'
node scripts/e2e/run-with-deadline.mjs --limit-sec 160 -- node ../../node_modules/@playwright/test/cli.js test e2e/distance-route-result-layout.spec.ts e2e/route-media-controls.spec.ts e2e/route-ride-controls.spec.ts e2e/map-route-runtime.spec.ts e2e/distance-route-continuation.spec.ts --workers=1 --retries=0 --reporter=line
```

실제 useDistanceAutoRoute/MapView/HTTP adapter로 cycling→driving→walking 각 적용 후 파란 버튼1개/aria-pressed, 창 닫기·재열기 후 적용 수단 보존 확인. offered500m/직접도로800m 응답으로 요청 문구 정확성·실제2줄/전후폭차1px미만·제어5개 같은행·패널 viewport내/가로overflow0 확인. 800×360/667×300/844×390. 수동 모드도 같은 행 확인. 기존 재탐색/삭제/늦은응답/주행 제어/지도 제스처 회귀 포함.

실패도 보존: 최초 layout3건은 선택 버튼 hover의 진한 파랑을 기본 파랑과 비교한 시험 문제, 포인터를 지도 쪽으로 이동 후 검사. 후속 layout1건은 실제 앱 부모 없는 fixture가 지도 min-height320을 유지한 것. 전체시험 첫 시도15 PASS/2 FAIL은 이 fixture와 기존 고정 클릭650,210이 새 팝업의 제어행 위에 놓인 문제. `step30-click-repro.log`에서 elementFromPoint가 map-view__pick-profile-bottom-row임을 확인 후 빈 지도400,300 좌표·canvas assertion으로 교정. 제품 방향탐색 우회/알고리즘 변경 없음.

증거 `.out/step30-{selectors,distance,build-final,lint-final,spec-lint,browser-verified}.log`. 캡처 `.out/step30-distance-{800,667,844}.png` 및 `.out/step30-manual-{800,667,844}.png`, 800/667거리·800수동 직접 시각 확인. 이전 실패 `.out/step30-layout.log`, `step30-layout-final.log`, `step30-browser-final.log`, `step30-click-repro.log` 보존.

Mapbox 타일·경로 HTTP는 stub, 실제폰/BLE·Firebase 전체진입 미실행. 기존5002 서버·다른 dirty 유지. 커밋·푸시·배포 없음.
