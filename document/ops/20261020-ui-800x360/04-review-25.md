# 연속 방향 재탐색 검수

2026-10-22 · record · LOCAL_VERIFIED / Chief 재확인 대기. [결과25](03-result-25.md).

## 재현과 교정

거리·방향 모드에서 짧은 클릭과 길게 누르기가 서로 다른 작업으로 갈라졌다. 실제 hook/API adapter/잔액 갱신·Mapbox 엔진을 연결한 시험에서 방향 짧은3회는 재탐색했고, 그 뒤650ms 누른 방향은 applied4에 머무르며 일반 위치 창을 열었다. 현재 모드가 direction이면 기존 방향 탐색 함수를 호출하도록 longpress를 교정, 일반 출발/도착 위치선택은 기존 경로 유지.

이전 알고리즘은 변경하지 않았다. 사용자 신고가 열린창의 짧은 클릭만으로도 생기는지는 미재현이다. 추가 질문(열린창 짧은 클릭/닫은창/길게누름)을 보냈고 답변 대기. 따라서 긴 누름 회귀 교정은 확인됐으나 모든 실제 사용자 시나리오를 확인한 것으로 과장하지 않는다.

## 검증

cwd `C:\20.HDev\boxcycle\apps\web`:

| 명령 | exit | 결과 |
|---|---:|---|
| `npm run test:distance-auto-route` | 0 | 144 PASS |
| `$env:RTW_DEV_PORT='5002'; node scripts/e2e/run-with-deadline.mjs --limit-sec 90 -- node ../../node_modules/@playwright/test/cli.js test e2e/distance-route-continuation.spec.ts e2e/map-route-runtime.spec.ts --workers=1 --retries=0 --reporter=line` | 0 | 3 PASS /19.8s, 전체21.8s. 실제 HTTP adapter·잔액 갱신/일반 지도 모션·다른 방향 연속탐색·수단/삭제/새출발/옛응답·기존 제스처 |
| `npx eslint src/components/map/MapView.tsx scripts/ui-800x360/distance-route-runtime.tsx e2e/distance-route-continuation.spec.ts` | 0 | 오류0/기존 MapView경고8 |
| `npm run build` | 0 | 타입 포함PASS /5.48s, 기존 큰번들·SADDLE/PELVIS 경고 |
| `git diff --check` (repo root) | 0 | PASS |

증거 `.out/step25-longpress-repro.log` FAIL→`.out/step25-final-browser.log` PASS, `.out/step25-distance.log`, `step25-lint.log`, `step25-build.log`.

초기 시도 `step25-repro.log`는 runner 종료가 지연돼 Ctrl+C 중단, PASS로 계산하지 않았다. 프로세스/포트/로그 확인 후 기존5002 재사용·line reporter·90초 외부기한 방식으로 전환했다. 첫 전환은 로컬node_modules 경로가 없어 MODULE_NOT_FOUND→저장소 루트 ../../node_modules 경로로 교정. `step25-repro-reuse.log`·`step25-wire-repro.log` 짧은 연속클릭PASS. `step25-motion-repro.log` 실패는 추가 hit 검사(`step25-hit-repro.log`)로 패널 위 좌표였음을 확인, canvas 여부 assertion과 빈 지도 좌표350,300으로 교정했다. 그 뒤 실제 longpress 미탐색을 재현했다. 실패 종류를 구분해 보존한다.

기존5002/PID17784 보존. 이 검수의 초기 자동5000/PID52920은 중단 시 종료, 이후5002 재사용. 서버·DB·실제경로 API 호출 없이 HTTP를 대체했다. CUA inventory에는 사용자 브라우저가 없어 실제 신고탭 직접 검증은 불가했다. 실제폰/실타일/실 API 응답·신고 누름 길이 미검증. 커밋·푸시·배포 없음.

## Chief 확인

현재 [localhost5002](http://localhost:5002)을 새로고침한다. 필요 시 재실행:

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
npm run dev:localhost -- --port 5002 --strictPort
```

출발 지정/‘여기에서 계속’ → 거리 확정 → 방향 클릭 → 생성 확인 → 창을 연 채 다른 빈 지도 방향을 짧게 클릭 → 다시 생성 확인 → 다른 방향을0.5초 이상 눌러도 생성되는지 확인. 출발/거리/수단 재입력은 필요 없다. 창을 닫은 뒤의 일반 지도 클릭은 별도 기존 popup-bound 정책이며 이번 변경에서 바꾸지 않았다.
