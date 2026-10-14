# 결과36 — 기존 검증 계약 정렬 (Supervisor 소유)

2026-10-14 Codex Supervisor. Developer34/35/37 앱 쓰기와 다른 파일 두 개만 소유, 기존 다른 변경 보존. 구현 담당 결과와 별도 검증 기록.

- scripts/distance-auto-route/distance-auto-route-contract.test.ts: 삭제 버튼이 profile행에 고정된 옛 계약을 공통 headerRow 존재·profile행에서 제거 계약으로 교체. 나머지 알고리즘/입력/토큰 assert 유지, 삭제/skip 없음.
- e2e/ride-summary-compact.spec.ts: 보이는 checkbox/uncheck 대신 거리view 표시·위치view 숨김 → 복귀button 클릭 → 위치view 표시·거리view 숨김 확인. 반경 원/방향 안내 제거·직접 End 지정은 유지. End의 기존 실제 aria 'Set end'에 앵커 정렬.

검증:
- `npm run test:distance-auto-route` exit0, 8파일/19suite/141 PASS·실패0·skip0. [로그](distance-contract-36.log). MODULE_TYPELESS_PACKAGE_JSON 환경 경고는 남음.
- `npx tsc -b --pretty false` exit0.
- `npx eslint src/components/map/mapPopupElements.ts scripts/distance-auto-route/distance-auto-route-contract.test.ts e2e/ride-summary-compact.spec.ts` exit0, [로그](lint-36.log), 오류0.
- `npx playwright test e2e/ride-summary-compact.spec.ts --list` exit0, 5test 정상로드. [목록](e2e-list-36.log). 이 명령은 실제 e2e 실행 성공을 뜻하지 않는다.
- `git diff --check` exit0. 테스트diff는12삽입/7삭제, 대상2파일만.

전체 ride-summary-compact e2e는 실제 주행·결과 생성·Firebase 기록까지 필요하여 이번 scoped UI 검수에서 미실행. 실제 로컬 Guest 화면전환·원거리대기/복귀·삭제·drag는별도 pick-37-live로검증했으며 전체주행PASS로확장보고하지않음. commit/push/deploy없음.
