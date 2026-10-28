# 거리·방향 첫 진입 펄스 누락 수정 — 2026-10-28

Chief 지시: 「여기에서 계속」으로 거리·방향 탐색을 호출할 때도 첫 안내 펄스5회를 빼먹지 않는다. 범위는 기존 원·화살표 안내의 시작 누락 수정이며 UI 배치/탐색 의미/서버/DB/Rules/토큰 정책은 유지한다. 직접 지시 범위라 별도 제품 결정은 필요하지 않다.

원인: App의 이어 가기는 거리·출발점을 먼저 arm한 뒤 팝업을 연다. popup은 초기 세션과 원 표시를 복원하지만, 기존 원 펄스 호출은 거리 입력 확정(`commitDistanceInput`)에만 있어 이 경로는 호출하지 않았다.

구현: `mapPopupElements.ts`에서 일반 거리탭 진입과 초기 armed 세션 복원 microtask 완료 뒤, 출발점·방향대기가 유효하면 첫 펄스를5회 시작한다. microtask는 abort를 확인하고 초기bridge/늦은bridge 모두 처리한다. 방향 클릭 전 원격 경로 탐색을 추가하지 않는다. 기존 거리 재확정의 반복 펄스·방향 클릭/탭전환/abort 취소·reduced-motion 존중은 유지. `distanceCircleAttention.ts`는 선택적 반복 횟수만 추가하고 기본 무한 반복은 보존한다. 진입5회(각1.5초) 종료 후 원·화살표 원래크기 복원·rAF예약0.

검증용 runtime에 App과 같은 「미리arm→openRoutePickRequest」 진입 버튼을 추가했다. 실제App 인증/저장/API 호출은 대신하지 않으며 실제MapView·popup·Mapbox 원geometry를 사용한다.

## 명령·결과

실행 폴더 `C:\20.HDev\boxcycle\apps\web`:

```powershell
cd C:\20.HDev\boxcycle\apps\web
npm run test:distance-auto-route
$env:RTW_DEV_PORT='5031'
node scripts/e2e/run-with-deadline.mjs --limit-sec 70 -- npx playwright test distance-direction-attention --grep '여기에서 계속' --workers=1 --retries=0
$env:BATCH5_EVIDENCE_DIR='C:/20.HDev/boxcycle/document/ops/20261028-distance-entry-pulse/evidence'
node scripts/e2e/run-with-deadline.mjs --limit-sec 90 -- npx playwright test distance-direction-attention --grep-invert '여기에서 계속' --workers=1 --retries=0
npx eslint src/components/map/mapPopupElements.ts src/components/map/MapView.tsx src/lib/map/distanceCircleAttention.ts
node scripts/ride-verify/verify-selectors.mjs
```

- 단위146PASS/0FAIL. 기존 펄스 무한반복·취소·reduced-motion 계약 안에5회봉우리·복원·rAF0검증 추가.
- 신규실제Mapbox1PASS/13.3초.699×273,미리arm한3km·종료점에서팝업열기→거리탭선택→8초간원geometry실측봉우리정확히5개/최대1.1배/최종1배,탐색호출0. 토큰·타일은mock.
- eslint 오류0/기존MapView경고10. 셀렉터19단계PASS.
- 기존거리·방향UI회귀3PASS/19.2초(전체고유UI4PASS). 출발·도착 수단강조,거리재확정펄스/방향클릭탐색/멈춤,수단선택·재탐색·두탭하단행계약유지. 새PNG1개는이번evidence에만기록.

실행 폴더 `C:\20.HDev\boxcycle`:

```powershell
cd C:\20.HDev\boxcycle
npm run build -w boxcycle-web
npm run check:dep
git diff --check -- apps/web/src/components/map/mapPopupElements.ts apps/web/src/components/map/MapView.tsx apps/web/src/lib/map/distanceCircleAttention.ts apps/web/scripts/distance-auto-route/distance-auto-route-contract.test.ts apps/web/e2e/distance-direction-attention.spec.ts apps/web/scripts/ui-800x360/map-route-runtime.tsx
```

타입/Vite빌드PASS(기존큰청크경고),의존위반0/순환0,diff검사PASS(LF→CRLF안내만). 일부PowerShell와일드카드검색실패는실제파일경로로교정. 실계정버튼·실폰·실Firebase경로API·전체quick미실행. 기존dirty·기존증거보존,커밋푸시배포없음.

## Chief 확인 순서

```powershell
cd C:\20.HDev\boxcycle
npm run dev:localhost -- --port 5031
```

기존서버가있으면재사용. `http://localhost:5031/` 새로고침→「여기에서 계속」→거리·방향창/빨간원·화살표즉시5회펄스확인→지도방향클릭하여기존경로탐색. 모션감소설정에서는기존정책대로펄스생략. 운영배포없음.
