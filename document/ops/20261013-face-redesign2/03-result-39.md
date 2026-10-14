# 결과39 — 캐럿 UI에 기존 검증 계약 정렬

2026-10-14 Supervisor Codex 소유 테스트2파일, Developer38 앱2파일과 분리. 다른 dirty를 되돌리지 않았으며 commit/push/merge/deploy 없음.

1. distance-auto-route-contract.test.ts: `stepTargetKm`의 옛 mode=false 즉시return 가드를 Start/거리기능 전제 확인과 대기 승격 helper로 정렬. step과 활성화 helper 양쪽에 provider/지도방향탐색 직접호출 없음 검증, 기존 알고리즘 assert 유지. 테스트 삭제/skip 없음.
2. ride-summary-compact.spec.ts: 제거된 텍스트 복귀 버튼 대신 위치 캐럿→위치 컨트롤 추가→Set start 선택으로 거리 대기 해제. 펼침 자체는 거리 내용/안내 유지, 실제 위치 선택 후 원/방향 안내 제거와 이후 End 직접지정 검증 유지. 동반 거리 영역은 접지 않는 새 표시 계약 확인. describe 명칭도 새 행동에 맞춤.

| 실행(작업 web) | 결과 | 증거 |
|---|---|---|
| `npm run test:distance-auto-route` | exit0, 8파일/19suite/141 PASS, 실패·skip0 | [로그](distance-contract-39.log) |
| `npx tsc -b --pretty false` | exit0 PASS | 최종38 앱/테스트 포함 |
| `npx eslint src/components/map/mapPopupElements.ts scripts/distance-auto-route/distance-auto-route-contract.test.ts e2e/ride-summary-compact.spec.ts` | exit0 PASS | [로그](lint-39.log), 오류0 |
| `npx playwright test e2e/ride-summary-compact.spec.ts --list` | exit0, 5test 정상로드 | [로그](e2e-list-39.log), 실제전체e2e 실행 아님 |
| `git diff --check` | exit0 PASS | CRLF 변환 경고만, whitespace 오류 없음 |

전체 ride-summary e2e는 주행/결과/Firebase 기록까지 필요하여 이번 scoped UI 검수에서 미실행. 실제 Guest 전환·거리 재활성·삭제/drag는38-live 별도 범위로 검증했으며 전체 주행 PASS로 보고하지 않음. 기존 MODULE_TYPELESS_PACKAGE_JSON 환경 경고는 유지.
