# 지시 T3 — 등록부 `dev-tools.json` + 푸시 게이트 + 측정 스크립트 정식 위치

| 항목 | 내용 |
|---|---|
| 발행 | 2026-10-17 · Supervisor (Claude) |
| 대상 | Developer — T2 와 같은 에이전트(교대 규칙에 따름) |
| 작업 위치 | `C:\20.HDev\boxcycle-devtools` (T2 병합 뒤 main2 기준) |
| 결과 파일 | `document/ops/20261017-dev-byproducts/03-result-t3.md` |
| 근거 | [02-rules](02-rules.md) §2·§3·§5 |

## 1. 등록부 `apps/web/dev-tools.json`

[02-rules §2](02-rules.md) 형식. `$schema`·`왜`·`원칙`을 `dep-layers.json` 처럼 머리에 둔다. **현재 남아 있는 것 전부**를 등록한다.

- `module`: `apps/web/src/lib/debug/` 의 모든 파일(T2 로 생긴 창구·계측 파일 포함). perflab 묶음·camlab·lightlab·계측(`*Meters`)·`documentVisibilityOverride`·`mapDebugPhase` 는 `permanent`. 나머지 DEV 진단(`peerIngestDiag`, `hudCompanionDiag`·`installHudCompanionDebug`, `install*ExistsDebug`, `installReadSubscriptionDebug`·`installTouchActivityDebug`·`installTrafficPublishDebug`, `trafficPairedCapture`, `distanceAutoRouteClickDebugMarker`)는 시험·e2e 가 쓰므로 `permanent` + `purpose` 에 사용하는 시험 이름.
- `query`: 재고 조사 §2 의 스위치 전부. `subscription`·trail 공유 키는 `product`. `perflab mapcut labelmode labeldist labels maxdpr skin camlab lightlab rideCam ridePitch riderModel sway peerSyncLogMs` 는 `permanent`.
- `script`: package.json·다른 코드·e2e 가 부르지 않는 비시험 스크립트 전부(재고 조사 §3 의 "유지" 항목 + 새 측정 스크립트). 일회성이면 `temporary` + `expires`.

## 2. 게이트 `scripts/check-dev-tools.mjs`

[02-rules §5](02-rules.md) 의 6개 조건을 그대로 구현한다.

- "불린다"의 판정: 파일 경로 또는 파일 이름(확장자 제외)이 `apps/web/package.json`, 루트 `package.json`, `githooks/`, `.claude/`, `.cursor/`, `apps/web/src`, `apps/web/scripts`, `apps/web/e2e`, 루트 `scripts/` 의 다른 파일에 나타나면 불린 것. `document/` 언급은 불린 것이 아니다. `.out`·`node_modules`·`dist` 제외.
- 쿼리 키 수집: `apps/web/src` 에서 `.get("키")`, `*_QUERY_KEY = "키"` (그리고 같은 형태의 상수). 시험 파일 제외.
- 출력: 실패는 항목별 한 줄 + 고치는 법("dev-tools.json 에 등록하거나 지운다"). 경고(만료~30일)는 실패와 구분.
- `--check`(게이트) 와 `--list`(등록부 요약 표 출력) 두 모드.
- 자기 시험: `apps/web/scripts/tools/` 아래에 게이트 시험(합성 입력으로 6조건 각각 실패·통과)을 두고 `test:quick` 에 들어가게 한다(폴더 규칙은 `scripts/test-quick.mjs` 참고).
- `githooks/pre-push` 의 `check-dep-direction` 블록 옆에 같은 형태로 추가.

## 3. 측정 스크립트 정식 위치

- `apps/web/scripts/rider-preserve/.out/mapcut/run-mapcut.mjs` → **`apps/web/scripts/perf/run-real-gpu.mjs`** (git 추적). 결과 출력 경로는 `apps/web/scripts/perf/.out/<날짜시각>/` 로. 파일 머리 주석에 사용법: 환경 변수(`VARIANTS`, `COURSE`), 변형 이름 규칙(`none`, `labelsOn`, `mode-X[@D]`, `deco`, `skin-cpu|gpu[N]`, mapcut 키), headed·실제 GPU 필요, 운영 URL 대상.
- 등록부에 `permanent` 로 등록, `enable` 에 실행 명령.
- 원본 `.out` 파일은 그대로 둔다(이동 아님 — 복사 후 수정).
- `document/archive/reports/261017-RTW-성능-측정-방법-perflab.md` §3 의 경로를 새 위치로 고친다.

## 4. `mapTickProbe.ts` 의 제품 로직 분리

`isFollowCameraJump`·`beginFollowCameraJump`·`endFollowCameraJump`(운영 카메라 추종이 사용)를 제품 쪽 파일(예: `apps/web/src/components/map/followCameraJump.ts` 또는 map 도메인 lib — dep-layers 규칙에 맞게)로 옮기고 호출처 import 를 바꾼다. 동작 무변경. `mapTickProbe.ts` 에 남는 것이 DEV 계측뿐인지 확인해 등록부 분류를 정한다.

## 5. 문서

- `document/ops/README.md` 「새 작업 묶음」 단락 끝에 한 문장: 작업 지시에 [02-rules §8](20261017-dev-byproducts/02-rules.md) 문장을 넣는다.
- 「규칙 (요약)」 2번(종료) 뒤에: 종료 시 [02-rules §6](20261017-dev-byproducts/02-rules.md) 정리.

## 검증

`tsc -b` 0, 변경 파일 eslint 오류 0, `check-dep-direction --check` PASS, **`node scripts/check-dev-tools.mjs --check` PASS**, 게이트 시험 통과, `test:quick`(worktree 환경 실패 외 0), `npm run build` 0, `check-document-system` newErrors 0(worktree 환경 1건 외). 게이트가 실제로 막는지: 임시로 `src/lib/debug/zz-temp.ts` 를 만들어 `--check` 실패를 확인하고 지운다(결과에 출력 첨부).

## 금지

등록부 등록을 피하려고 파일을 지우거나 옮기는 것(삭제는 T1 에서 끝), 제품 동작 변경, commit · push · 배포, 백그라운드 잔류.
