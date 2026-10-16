# 결과 T3 — 등록부 · 푸시 게이트 · 측정 스크립트 정식 위치

| 항목 | 내용 |
|---|---|
| 수행 | Developer — Cursor Agent |
| 판정 | 구현·검증까지 완료. commit·push·배포 없음 |
| 브랜치 | `chore/dev-byproducts` |

## 등록부 `apps/web/dev-tools.json`

`dep-layers.json` 과 같이 `$schema`·`왜`·`원칙`을 머리에 둔다. 스키마는 `apps/web/dev-tools.schema.md`. `node scripts/check-dev-tools.mjs --list` 합계 **59** (module 24, query 17, script 18).

| kind | class | 내용 |
|---|---|---|
| module 24 | 전부 `permanent` | `src/lib/debug/` 에 있는 파일 전부. perflab 묶음(`perfLab`·`perfLabFacade`·`perfLabRuntime`·`frameBreakdownProbe`·`riderJitterProbe`·`riderRenderCostProbe`)·`rideCameraLab`·계측(`*Meters`)·`documentVisibilityOverride`·`mapDebugPhase`·`mapTickProbe`. 시험·e2e 가 쓰는 DEV 진단은 `purpose` 에 시험 이름을 적었다 |
| query 17 | `product` 3, `permanent` 14 | 수집 결과와 같다. `subscription`·`trail`·`room`(공유 하위 호환)은 product. `perflab` `mapcut` `labelmode` `labeldist` `labels` `maxdpr` `skin` `camlab` `lightlab` `rideCam` `ridePitch` `riderModel` `sway` `peerSyncLogMs` 는 permanent. `tickTest`·`weather` 는 T1 에서 사라져 등록하지 않았다 |
| script 18 | `permanent` 10, `temporary` 8 | 게이트가 「안 불림」으로 본 비시험 파일 전부. 만료는 `2026-11-17` |

`lightlab` 패널 코드는 `riderPrototype/` 에 있다. 디버그 폴더 파일이 아니라 쿼리로만 등록했다.

안 불리는 스크립트 중 재고 조사 §3 「유지」와 이번 측정 스크립트는 `permanent` 다. `stage-rider14.mjs` 는 그 네 줄에 이름이 없었지만 같은 스테이징 도구이고 게이트가 안 불림으로 봐서 `permanent` 로 넣었다. 나머지는 일회·잔여라 `temporary` 다.

| temporary | 왜 |
|---|---|
| `resume-slot-ui-fixture.html`, `calorie-settings-ui-fixture.html` | UI 캡처 픽스처. 캡처 스크립트는 T1 에서 삭제 |
| `s3b2r-fitcurve.mjs` | 동행 곡선 일회 요약. e2e 가 안 씀 |
| `ride-result-s2-hook-integration-note.md` | 메모. 시험이 이 파일을 열지 않음 |
| `traffic/fixtures/phase-align-*.json` 2개 | phase-aligned 예시 입력. 측정 스크립트는 경로를 인자로 받음 |
| `scripts/ops-relay/check-amend.mjs`, `watch-status.mjs` | 옛 릴레이. 현재 인계는 파일 |

`scripts/check-document-system.mjs` 와 `scripts/verify-gates-alive.mjs` 는 사람이 돌리는 상시 도구다. 규칙상 `document/` 언급은 호출이 아니라서 게이트는 안 불림으로 본다. `permanent` 로 등록했다.

## 게이트 `scripts/check-dev-tools.mjs`

[02-rules §5](02-rules.md) 여섯 조건. 실패는 `FAIL` 한 줄과 `dev-tools.json 에 등록하거나 지운다`. 만료 후 1~30일은 `WARN` 이고 종료 코드 0. 31일째부터 `FAIL`.

- 「불린다」: 저장소 상대 경로, 또는 파일 이름(확장자 포함·제외)이 토큰으로 `apps/web/package.json`, 루트 `package.json`, `githooks/`, `.claude/`, `.cursor/`, `apps/web/src`, `apps/web/scripts`, `apps/web/e2e`, 루트 `scripts/` 의 **다른** 파일에 있을 때. `document/` 는 검색하지 않는다. `.out`·`node_modules`·`dist` 제외.
- 이름 토큰은 앞뒤가 식별자 문자가 아닐 때다. `stage-rider14` 가 `stage-rider14-lod2` 안에 묻혀 호출된 것으로 치지 않는다.
- 쿼리 키: `apps/web/src` 의 `.get("키")`, `*_QUERY_KEY = "키"`, `*_QUERY_KEYS = ["키", …]`. 시험 파일 제외. 그래서 `trail`·`room` 이 잡힌다.
- `.out` 안 파일은 3번 목록에서 뺀다. 지워도 되는 산출물이고, git 이 추적하면 4번이 막는다.
- `--check` 와 `--list`. 인자가 없으면 종료 코드 2.
- 자기 시험 `apps/web/scripts/tools/check-dev-tools.test.mjs`. 합성 입력으로 6조건 각각 실패·통과, 만료 30일 경계는 경고. `scripts/test-quick.mjs` 의 `tools` 묶음에 `tools` 폴더를 넣어 `test:quick` 에 들어간다.
- `githooks/pre-push` 의 `check-dep-direction` 블록 옆에 같은 `if` 로 추가했다. `apps/web` 의 ts/tsx 변경, `dev-tools`, `src/lib/debug/`, `apps/web/scripts/`, 루트 `scripts/` 변경 때 돈다.

## 측정 스크립트

`C:\20.HDev\boxcycle\apps\web\scripts\rider-preserve\.out\mapcut\run-mapcut.mjs` 를 읽어 복사했다. 원본은 수정하지 않았다(첫 줄이 그대로 `Supervisor 직접 측정…`).

정식 위치 `apps/web/scripts/perf/run-real-gpu.mjs` (git 추적). 결과만 `apps/web/scripts/perf/.out/<YYYYMMDD-HHmmss>/` 로 쓴다. `apps/web/.gitignore` 의 `/scripts/*/.out/` 에 걸린다. 머리 주석에 `BASE`(기본 운영 `https://boxcycle-dc2df.web.app`)·`COURSE`·`VARIANTS`, 변형 이름(`none`, `labelsOn`, `mode-X[@D]`, `deco`, `skin-cpu|gpu[N]`, 그 밖 mapcut 키), headed·실제 GPU, 운영 URL 대상을 적었다. 측정 루프는 복사본 그대로다. 등록부 `run-real-gpu` 는 `permanent`, `enable` 은 `node apps/web/scripts/perf/run-real-gpu.mjs`.

`document/archive/reports/261017-RTW-성능-측정-방법-perflab.md` §3 경로와 출력 위치를 새 경로로 고쳤다.

이 스크립트는 실행하지 않았다. 브라우저·headed GPU·운영 URL 이 필요하고, 이번 지시는 브라우저를 쓰지 않는다.

## `mapTickProbe.ts` 제품 로직

`isFollowCameraJump`·`beginFollowCameraJump`·`endFollowCameraJump` 와 깊이 카운터를 `apps/web/src/components/map/followCameraJump.ts` 로 옮겼다. 호출처는 `MapView.tsx`(판정)와 `rideCameraFollow.ts`(begin/end)만이고 import 만 바꿨다. `lib/` 밖이라 `dep-layers.json` 배정은 없다. 두 호출처가 같은 모듈을 보므로 깊이는 이전과 같이 하나다.

`mapTickProbe.ts` 에 남은 것은 DEV 계측뿐이다(`start`/`stop`/`snapshot`, `note*`, `assertMapTickT0`, `window.__RTW_MAP_TICK_*`). 제품 분기는 없다. e2e `u2-map-render-tick`·`u3-camera-trace`·`u5-shots` 가 그 window 를 쓰므로 등록부는 `permanent`.

## 문서

- `document/ops/README.md` 「새 작업 묶음」 단락 끝: 작업 지시에 [02-rules §8](02-rules.md) 문장을 넣는다.
- 「규칙 (요약)」 2번 끝: 종료 시 [02-rules §6](02-rules.md) 정리.

`02-task-t3.md` 는 이 작업 전에 이미 수정돼 있었다. 이번 변경에 포함하지 않았다.

## 게이트가 막는지

`apps/web/src/lib/debug/zz-temp.ts` 를 만든 뒤 `--check`, 그리고 삭제. 삭제 후 파일 없음.

```
FAIL debug 미등록 apps/web/src/lib/debug/zz-temp.ts — dev-tools.json 에 등록하거나 지운다
check-dev-tools: FAIL 1 · WARN 0
```

종료 코드 1. 지운 뒤 `--check` 는 `PASS · WARN 0`.

## 시험

| 명령 | 결과 |
|---|---|
| `apps/web` `npx tsc -b` | 0. 이어서 `npm run build` 의 `tsc -b` 도 0 |
| 변경 파일 `npx eslint` (`followCameraJump.ts`, `MapView.tsx`, `rideCameraFollow.ts`, `mapTickProbe.ts`, `scripts/tools/check-dev-tools.test.mjs`, `scripts/test-quick.mjs`, `scripts/perf/run-real-gpu.mjs`) | 오류 0. 경고 8은 `MapView.tsx` 의 기존 react-hooks. 새 파일 경고 없음 |
| 루트 `scripts/check-dev-tools.mjs` | `node --check` 0. web eslint 기준 경로 밖이라 그 설정으로는 검사 대상이 아님(강제 시 "outside of base path" 경고 1, 오류 0) |
| `node scripts/check-dev-tools.mjs --check` | PASS · WARN 0 |
| `node --test apps/web/scripts/tools/check-dev-tools.test.mjs` | 통과 7, 실패 0 |
| 루트 `node scripts/check-dep-direction.mjs --check` | 종료 2. M0 「lib 파일 전원 도메인 지정」은 PASS(0건). 실패는 깨진 경로 1건: `scripts/route-token/route-token-onboarding-grant.test.mjs` → `functions/lib/routeTokenCore.js`. worktree 에 `functions/lib` 가 없다. `functions` 에서 `npm run build` 는 `node_modules` 가 없어 `firebase-functions` 등을 못 찾고 실패. 도메인 위반 목록은 M0 에서 중단 |
| 루트 `npm run test:quick` | 통과 1232 · 실패 2. 둘 다 `mapbox-token-per-mode.test.ts` 의 토큰 공백(기본·emulator). `route-token-onboarding-grant.test.mjs` 는 `functions/lib` 가 없어 건너뜀(실패 아님). `tools` 묶음 7파일 통과 41, 그 안에 `scripts/tools/check-dev-tools.test.mjs` |
| `apps/web` `npm run build` | 0. `index-*.js` 3,692.34 kB. 기존 `SADDLE`·`PELVIS` import 경고는 이번 변경 밖 |
| `node scripts/check-document-system.mjs` | newErrors 1. `document/ops/20261009-mobile-design-collaboration/16-result-preparation-sensor.md` → gitignore 된 `muse-task-04-output.log` (worktree 에 없음). 이번 문서 링크는 여기에 없다 |

브라우저·dev 서버는 쓰지 않았다. 실GPU 스크립트도 실행하지 않았다.

## 미해결

- `check-dep-direction --check` 전체 종료 0은 `functions/lib` 와 functions `node_modules` 가 없어서 불가. 이번 파일의 도메인 미지정은 없다(`followCameraJump.ts` 는 `lib/` 밖).
- `test:quick` 실패 2와 문서 newErrors 1은 위 worktree 환경이다.
- commit·push·배포하지 않았다.
