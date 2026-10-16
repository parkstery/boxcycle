# 지시 P0 — 현행 s5 라이더 기준선 측정

| 항목 | 내용 |
|---|---|
| 발행 | 2026-10-15 · Supervisor (Claude) |
| 대상 | Developer — OpenCode Muse Spark (`opencode/muse-spark-1.3-contributor-free`) |
| 계획 | [01-plan.md §6 P0](01-plan.md) |
| 작업 위치 | **`C:\20.HDev\boxcycle-rider14`** (worktree, 브랜치 `rider14-replace`, 기준 `734af62`). `C:\20.HDev\boxcycle` 본 작업트리는 **읽지도 쓰지도 않는다** |
| 결과 파일 | `C:\20.HDev\boxcycle\document\ops\20261015-rider14-replace\03-result-p0.md` (결과 파일만 이 경로에 쓴다) |

## 목적

rider14 로 바꾸기 **전** 의 수치를 남긴다. P5 에서 같은 도구·같은 조건으로 다시 재서 비교한다. 이번 지시에서 앱 코드(`apps/web/src`)는 **한 줄도 바꾸지 않는다.**

## 만들 것 (신규 2파일만)

`apps/web/scripts/rider-preserve/rider-perf-bench.html` / `rider-perf-bench.ts`

기존 `preserved-app-validator.html/.ts` 를 본떠 만든다(기존 파일은 수정 금지).

1. 지도: `mapbox://styles/mapbox/outdoors-v12`, 중심 `[127.035, 37.505]`, `antialias: true`. URL 쿼리 `zoom`(기본 22)·`pitch`(기본 67)·`bearing`(기본 -32)·`riders`(0~3, 기본 3)·`animate`(0/1, 기본 1)를 읽는다.
2. 라이더 3명을 `syncRiderPreservedModels(map, specs)` 로 올린다. `riders` 값만큼 앞에서부터 쓴다.
   - `{ id:"self",  kind:"self",  lngLat:중심,                         bearingDeg:90, phaseRev:p }`
   - `{ id:"peer",  kind:"peer",  lngLat:중심에서 서쪽 3 m·남쪽 1.2 m, bearingDeg:90, phaseRev:(p+0.33)%1 }`
   - `{ id:"pacer", kind:"pacer", lngLat:중심에서 서쪽 6 m,             bearingDeg:90, phaseRev:(p+0.66)%1 }`
   - `animate=1` 이면 p 를 75 rpm 으로 증가시키고 매 프레임 `map.triggerRepaint()`. `animate=0` 이면 p=0.125 고정.
3. **드로우콜 계수**: 페이지 시작 시(지도 생성 전) `WebGL2RenderingContext.prototype` 의 `drawElements`·`drawArrays`·`drawElementsInstanced`·`drawArraysInstanced`·`drawRangeElements` 를 감싸 호출 수와 삼각형 수(`count/3`, instanced 는 `×instanceCount`, 모드가 TRIANGLES 일 때만)를 누적한다.
4. `window.__rtwBench` 를 노출한다:
   - `state()` → `{ loadState, firstReadyMs }` — `firstReadyMs` 는 `getRiderPreservedDebugState(map).loadState` 가 처음 `"ready"` 가 된 시점의 `performance.now()`
   - `async measure(frames=120)` → 지도 `idle` 을 기다린 뒤 `frames` 프레임 동안 누적한 `{ frames, drawCallsPerFrame, trianglesPerFrame }` (평균, 소수 1자리)
   - `setRiders(n)` → 라이더 수를 바꾼다(다시 `syncRiderPreservedModels`)
   - `assets()` → `performance.getEntriesByType("resource")` 중 URL 에 `/rider/` 가 들어간 항목의 `{ name, transferSize, encodedBodySize, decodedBodySize, duration }`
5. 패널에 상태·라이더 수·최근 측정값을 표시한다. 캡처에 패널이 들어가도 된다.

## 측정 절차

1. dev 서버: `apps/web` 에서 `$env:RTW_DEV_PORT="5040"; npx vite --port 5040 --strictPort` (백그라운드). 다른 포트·서버는 건드리지 않는다.
2. Playwright(저장소의 `@playwright/test` 의 chromium, headless, 창 1280×800, `--use-angle=swiftshader` 금지 — 기본 GPU 경로 사용. 실패하면 SwiftShader 로 재시도하고 그 사실을 기록) 로 다음을 **순차 실행**하는 스크립트 `apps/web/scripts/rider-preserve/rider-perf-bench.run.mjs` 를 만든다(신규 3번째 파일 허용).
   - URL: `http://127.0.0.1:5040/scripts/rider-preserve/rider-perf-bench.html?...`
   - 줌 4단: **22, 19, 17, 15**. 각 줌마다:
     - `riders=3` 측정 → `setRiders(0)` 측정 → `setRiders(1)` 측정 (각 120프레임)
     - **라이더 1명당 드로우콜** = (3명 값 − 0명 값) / 3, 1명 값 − 0명 값도 함께 기록
     - `window.__rtwRiderCost.reset()` 후 `riders=3` 으로 240프레임 → `read()` 결과 전체 기록
     - `animate=0` 으로 새로 열어 캡처 1장: `.out/rider14/p0/z<줌>.png`
   - 처음 연 페이지의 `state().firstReadyMs` 와 `assets()` 기록. 같은 측정을 **새 브라우저 컨텍스트로 3회** 반복해 `firstReadyMs` 중앙값을 낸다(캐시 비활성: `route` 없이 컨텍스트를 새로 만들면 된다).
   - 원시값은 `apps/web/scripts/rider-preserve/.out/rider14/p0/bench.json` 에 저장.
3. 현 자산 해시(SHA-256): `apps/web/public/rider/preserved/candidates/20260921-041426-cd81398e/` 의 `rider.glb`·`guide-weights.json`·`candidate.json`. `rider.glb` 는 직전 교체 보고 기준값과 대조한다(`candidate.json` 안의 `stagedGlbSha256` 와 같아야 한다).
4. 끝나면 dev 서버를 종료한다.

## 기존 시험 기준선 (변경 없이 실행만)

`apps/web` 에서:
- `npx tsc --noEmit -p tsconfig.app.json`
- `node --test scripts/rider-preserve/preserved-layer-contract.test.mjs`
- `node --experimental-strip-types --test scripts/rider-preserve/rider-visual-kit.test.ts`
- 신규 3파일만 `npx eslint <파일들>`

각 명령의 exit code 와 마지막 요약 줄을 기록한다. 실패해도 고치지 말고 그대로 기록한다.

## 결과 파일 `03-result-p0.md` 형식

1. 환경: Node·Chromium 버전, GPU 경로(기본/SwiftShader), 메모리 여유
2. 표: 줌 × { 0명/1명/3명 drawCallsPerFrame, 1명당 drawCall, trianglesPerFrame 1명당, msPerFrame, msPerRider, poseMs 비율 }
3. 자산: 파일명·디스크 크기·transferSize, `firstReadyMs` 3회와 중앙값
4. 해시 3종과 대조 결과
5. 시험 명령 exit code
6. 캡처 4장 전체 경로
7. 변경 파일 목록(`git -C C:\20.HDev\boxcycle-rider14 status --short` 출력 그대로)
8. 이상·막힌 점

## 금지

- `apps/web/src/**`, 기존 시험·검증기·`public/**` 수정 금지
- commit · push · 배포 · `npm install` 금지
- 본 작업트리(`C:\20.HDev\boxcycle`) 와 rider 작업 폴더(`...\20261015_01-s6-poly-drawcall-reduction`) 쓰기 금지
- 측정이 메모리 부족으로 죽으면 줌 단위로 나눠 다시 돌리고, 그래도 안 되면 그 지점까지 기록하고 종료
- 범위 밖 문제는 결과 파일 8번에 적기만 한다
