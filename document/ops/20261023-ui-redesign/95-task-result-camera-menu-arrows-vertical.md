# 지시·결과95 — 카메라 메뉴 화살표·세로 배열·평면 폭 정리

## Chief 지시 (2026-10-27)

1. 카메라 2·3·4·5·6의 기존 카메라-라이더 도안은 제거하고, `카메라 방향표시.svg`의 방향이 명확한 화살표와 `파란색 그라데이션 화살표 아이콘.png`의 파란 그라데이션 인상을 적용한다.
2. 카메라 2~6 메뉴는 가로 5칸이 아니라 세로 5행 드롭다운으로 표시한다.
3. 카메라1 높이 메뉴는 `1000m`를 기준으로 좌우 여백이 같도록 전체 폭을 줄인다.
4. 카메라1 높이 라벨은 `1000m` 폭의 한 열에서 오른쪽 정렬한다.

## 범위·금지

- 범위: `CameraViewMenu.tsx/.css`, 해당 800×360·묶음2 화면 계약.
- 카메라 슬롯의 실제 동작·튜닝·야외 지도 고정 정책은 바꾸지 않는다.
- 고정1~21·23~26과 접근성 이름(뒤에서·앞에서·왼쪽·오른쪽·뒤고정)은 바꾸지 않는다.
- 커밋·푸시·배포하지 않는다.

## 구현

- 2~6 도안은 제공 SVG와 같은 방향 순서(위·아래·오른쪽·왼쪽·오른쪽 아래 대각선)로 교체했다.
- 화살표는 밝은 하늘색→파랑→남색의 선형 그라데이션과 작은 광채를 가진 굵은 둥근 선으로 만들었다. 번호는 슬롯 식별을 위해 유지했다.
- 시점 메뉴를 `56px` 한 열, 항목당 `38px`인 세로 5행으로 바꿨다.
- 평면 메뉴 폭을 처음 `116px`로 줄인 뒤, 2026-10-27 00:28 Chief 후속 지시로 아이콘과 높이값 사이 빈 공간을 더 줄이기 위해 정확히 20px 줄인 `96px`로 확정했다. 라벨 열은 `5ch`, 오른쪽 정렬을 유지하며 모든 라벨의 오른쪽 끝이 같다.
- 선택 후 트리거 접근성 이름이 바뀌어도 반복 선택 시험이 같은 버튼을 안정적으로 찾도록 오래된 시험 locator를 교정했다.

## 검증·감리

- `npx tsc -b --noEmit` — PASS(exit 0).
- `npx playwright test ui-800x360.spec.ts ui-redesign-batch2.spec.ts --grep "카메라 메뉴|Chief 고정27" --workers=1 --retries=0` — PASS, 2/2.
- `npm run test:ride-camera-framing` — PASS, 99/99.
- `npm run build` — PASS(청크 크기 기존 경고만).
- `node scripts/ride-verify/verify-selectors.mjs` (`apps/web`) — PASS, 19/19.
- 변경 3파일 ESLint — PASS, 오류·경고 0.
- `npm run test:quick` — **FAIL, 1378 PASS / 3 FAIL**. 제품·카메라군은 전부 통과했으나 `e2e-deadline-watchdog` 3건이 Windows 프로세스 종료 권한 거부/20초 timeout으로 실패했다. 이번 UI 변경과 무관하며 성공으로 보고하지 않는다.
- `check-code-tidy`·`check-dep-direction --check`·`check-document-system` — PASS.
- `git diff --check` — PASS(기존 dirty 파일의 LF→CRLF 안내만 있음).
- 첫 ESLint 명령은 `npm run lint -- ...`가 전체 `eslint .`도 실행해 저장소 기존 경고 39·오류 0. 이후 변경 3파일 직접 실행은 오류·경고 0.
- 800×360 렌더 직접 확인:
  - 시점 메뉴: 번호 2~6과 위·아래·오른쪽·왼쪽·대각선 파란 화살표가 한 열로 표시되고 화면 안에 모두 들어옴.
  - 평면 메뉴: 폭 96px, `전체`부터 `1000m`까지 오른쪽 끝 일치, 아이콘과 높이값 사이 빈 공간 축소.
- Ego Lite 캡처는 `Page.captureScreenshot` 시간 초과로 중단하고 작업 공간을 정상 종료했다. 같은 시도를 반복하지 않고 Playwright 캡처와 DOM 측정으로 전환했다.

### 00:28 후속 폭 축소 검증

- `ui-800x360.spec.ts --grep "Chief 고정27"` — 시험 본문 **1/1 PASS**. 두 실행 모두 Playwright 플러그인 종료 단계가 멈췄고, 전용 포트 5021·60초 전역 제한 실행은 `Timed out waiting 60s for the teardown for plugin setup to run`으로 최종 exit는 실패했다. UI 단언 실패는 아니다.
- `npx tsc -b --noEmit` (`apps/web`) — PASS.
- 변경 e2e ESLint — PASS. CSS는 ESLint 설정 대상이 아니어서 ignored 경고 1.
- `git diff --check`·문서 검사 — PASS.

## 상태

**LOCAL_VERIFIED / 미커밋·미푸시·미배포 (2026-10-27 00:33 KST).** 구현·시험·시각 감리는 Codex Supervisor가 직접 수행했다.
