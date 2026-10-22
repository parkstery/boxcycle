# 다섯 위치·미디어 버튼 구현 결과

2026-10-22 · record. Codex 단일 writer. [지시29](02-task-29.md).

- 출발·도착 탭에 출발/W1/W2/W3/도착을 항상 표시. +경유지 제거. 기존 순차 추가/기존 슬롯 교체 계약 유지, 아직 선행 슬롯이 없는 W2/W3는 비활성. 한 행에서 각44px 터치 영역 확보.
- 공통 하단 마지막 행에 녹색 텍스트 없는 재생 왼쪽·기존 삭제 오른쪽. 수단 선택은 바로 위 행. App의 handleStartRide와 ready-to-start/경로·주행입력/편집잠금 조건 연결. MapView ref와 popup UI sync로 열린 창에서도 활성/비활성 전환.
- 우하단 공통 흰 테두리·배경·그림자 제거. 재생/재개 녹색, 일시정지 파랑, 종료 빨강의44px 원형과 흰 아이콘·광택 CSS. 텍스트 없이 aria-label·포커스·키보드·기존 이어달리기/정지 콜백 유지.
- 실제 MapView fixture에 시작 준비 전환과 경유지 슬롯 교체를 연결. 기존 시작 셀렉터는 주행 제어 그룹으로 scope해 추가 재생 버튼과 strict 충돌 방지. ride-verify 기존 start-ride 계약에 경로창 연결/게이트/실시간 동기화 앵커 추가.

## 실행 검증

cwd `C:\20.HDev\boxcycle\apps\web`:

| 명령 | 결과 |
|---|---|
| `node scripts/ride-verify/verify-selectors.mjs` | exit0, 19단계 PASS |
| `npm run test:distance-auto-route` | exit0, 145 PASS |
| `npm run build` (저장소 루트) | exit0, 타입·빌드 PASS |
| `npx eslint src/App.tsx src/components/map/MapView.tsx src/components/map/mapPopupElements.ts src/components/ride/RideControlBar.tsx scripts/ui-800x360/map-route-runtime.tsx e2e/route-media-controls.spec.ts e2e/route-ride-controls.spec.ts e2e/ride-entry.spec.ts` | exit0, 오류0/기존 App7+MapView8 경고 |
| 아래 브라우저 명령 | exit0, 14 PASS/53.6s |
| `git diff --check` (저장소 루트) | exit0 |

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
$env:RTW_DEV_PORT='5002'
node scripts/e2e/run-with-deadline.mjs --limit-sec 150 -- node ../../node_modules/@playwright/test/cli.js test e2e/route-media-controls.spec.ts e2e/route-ride-controls.spec.ts e2e/map-route-runtime.spec.ts e2e/distance-route-continuation.spec.ts --workers=1 --retries=0 --reporter=line
```

첫 브라우저13 PASS/1 FAIL은 기존 센서 단독 단계의 투명 컨테이너 폭0을 가시성 실패로 판정한 옛 시험. 센서는 독립 fixed 배치이고 정상 표시되므로 센서 가시성과 컨테이너 존재를 검사하도록 갱신. 후속9 PASS, CSS 최종 반영 후 전체14 PASS. 실패/후속 로그를 보존했다. 정적 계약은 +경유지→항상 세 슬롯 표시로 갱신.

증거 `.out/step29-{selectors,distance,lint,browser,browser-final,controls-final,build-final}.log`. 직접 캡처 검수 `.out/step29-popup-800.png`·667/844, `.out/ui-route-ride-20261021/bar-{ready,riding,paused}-800.png`. 위치5개 추가/교체·열린창 입력 준비 토글·시작1회·삭제/재생성·늦은응답 차단·이어달리기/재개/종료/짧은주행종료, 3viewport×5상태 가림/크기 확인.

실제폰·실센서 미검증. Auth9099/Firestore8080/RTDB9000 모두 비수신 확인해 Firebase live 진입 E2E는 미실행. 실제 MapView/Mapbox 엔진 시험의 타일/HTTP는 stub, 서버 쓰기 없음. 이번 범위는 커밋·푸시이며 배포 없음. 최종 Git 결과는 [검수29](04-review-29.md).
