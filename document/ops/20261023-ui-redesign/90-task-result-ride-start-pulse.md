# 지시·결과 90 — 경로 탐색 완료 뒤 주행 버튼 5회 펄스

2026-10-26 · Chief 직접 지시 · Supervisor Codex 직접 구현·감리

## 지시

1. 경로 탐색이 끝나면 「주행」 버튼을 다섯 번 펄싱한다.
2. 펄싱 도중 클릭해도 주행이 시작되어야 한다.
3. 경로 생성 창과 우측 하단에 별도로 배치된 주행 버튼 모두 같은 동작을 적용한다.

## 구현

- `RideMediaButton.css`에 공용 `ride-start-ready-pulse`를 추가했다. 0.82초 주기, `animation-iteration-count: 5`, 1.0→1.1배 확대와 파란 광륜을 사용한다.
- 애니메이션은 버튼 자체에만 적용하고 별도 overlay를 만들지 않아 클릭 hit target을 막지 않는다. `pointer-events: auto` 계약을 명시했다.
- 우측 하단 `RideControlBar`의 기존 새 경로 토큰당 큐를 공용 펄스로 교체했다. 클릭 시 큐를 끝내고 기존 `onStartRide`를 그대로 호출한다.
- 경로 생성 창의 버튼은 비활성→활성 전환 때 한 번만 펄스를 시작한다. 펄스 도중 클릭하면 클래스를 제거하고 기존 시작 콜백을 호출한다.
- `prefers-reduced-motion: reduce`에서는 종전 정책대로 애니메이션을 생략한다.

## 검증

| 항목 | 결과 |
|---|---|
| 타입·변경 파일 lint | `npx tsc -b --noEmit` PASS, ESLint 오류 0 |
| 프로덕션 빌드 | `npm run build` PASS(대형 chunk 경고만) |
| 실주행 진입 셀렉터 | `node scripts/ride-verify/verify-selectors.mjs` 19/19 PASS |
| 저장소 게이트 | code-tidy·dependency direction·document system·`git diff --check` PASS |
| 경로 창 브라우저 계약 | 활성 버튼의 animation name·횟수·pointer-events = `ride-start-ready-pulse`·`5`·`auto`; 펄스 중 클릭 뒤 `starts:1` 확인 |
| 우측 하단 브라우저 계약 | 펄스 중 클릭 뒤 `data-ui-stage=riding`, 일시정지 버튼 표시 확인 |
| Playwright 자동 시험 | 두 시험 본문이 순서대로 진입했으나 마지막 뒤 runner 종료 지연으로 중단(exit 1). 성공으로 계산하지 않고 동일 하네스를 ego-browser로 직접 재검증 |

## 상태

LOCAL_VERIFIED / 미커밋·미푸시·미배포.
