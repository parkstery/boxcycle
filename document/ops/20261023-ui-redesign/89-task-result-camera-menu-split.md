# 지시·결과 89 — 평면 높이·시점 카메라 메뉴 분리

2026-10-26 · Chief 직접 지시 · Supervisor Codex 직접 구현·감리·캡처

## 지시

1. 카메라를 왼쪽 평면 카메라와 오른쪽 시점 카메라 2~6의 두 종류로 구분한다.
2. 평면 카메라는 드롭다운에서 높이를 직접 선택하고 200·300·400·500·1000m를 추가한다.
3. 카메라 2~6의 한글 제목은 아이콘 또는 이미지 도안으로 대체한다.

## 구현

- `CameraViewMenu`: 단일 1~6 메뉴를 두 알약으로 분리.
  - 왼쪽 평면 카메라: 전체 경로·20·200·300·400·500·1000m 직접 선택.
  - 오른쪽 시점 카메라: 2~6을 5개 탑뷰 선형 SVG 도안으로 표시. 화면 한글 제목은 제거하고 접근성 이름에는 「뒤에서·앞에서·왼쪽·오른쪽·뒤고정」을 유지.
- `camera1Mode`: 평면 높이 정본을 7단으로 확장. 1000m를 포함한 preset은 수동 거리 슬라이더 상한을 거치지 않는 기존 평면 카메라 경로로 적용.
- `App`: 평면 메뉴가 선택한 모드를 직접 받아 routeFit 또는 aerial 거리로 전환. 카메라 2~6 야외 고정·주행 종료 평면화(지시88)는 유지.
- 기존 카메라·동행 e2e의 카메라1 연속 클릭을 새 직접 선택 계약으로 갱신.

## 검증

| 항목 | 결과 |
|---|---|
| 타입·빌드 | `npx tsc -b --noEmit`, `npm run build` PASS(대형 chunk 경고만) |
| 카메라 계약 | `npm run test:ride-camera-framing` 99/99 PASS |
| 진입 셀렉터 | `node scripts/ride-verify/verify-selectors.mjs` 19/19 PASS |
| 변경 파일 lint | 오류 0, 기존 `App.tsx` 훅 경고 7 |
| 저장소 게이트 | code-tidy·dependency direction·document system·`git diff --check` PASS |
| Playwright 수집 | `npx playwright test --list` 232개 정상 수집 |
| 실컴포넌트 DOM·화면 | 800×360·667×300 하네스에서 왼쪽/오른쪽 순서, 평면 7개 옵션, 시점 5개 SVG·화면 한글 라벨 0 확인 |
| 자동 화면 시험 | `ui-800x360 --grep Chief 고정22`는 두 차례 브라우저 본문 진입 후 runner가 종료되지 않아 중단. 5분 반복 금지에 따라 기존 서버+Playwright MCP 직접 DOM/캡처로 전환 |

증거:

- `document/ops/20261023-ui-redesign/evidence/instruction89-camera-menus-800x360.png`
- `document/ops/20261023-ui-redesign/evidence/instruction89-camera-menus-667x300.png`

## 운영 규칙 추가

Chief 지시로 `AGENTS.md`와 `CLAUDE.md`에 잔여 토큰 5% 이하 즉시 중단·HANDOFF·보고 규칙을 동일하게 추가했다.

## 상태

LOCAL_VERIFIED / 미커밋·미푸시·미배포.
