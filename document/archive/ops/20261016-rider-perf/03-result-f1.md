# 결과 F1 — 운영용 실측 패널 `?perflab=1`

| 항목 | 내용 |
|---|---|
| 작성 | 2026-10-16 · Developer (Cursor) |
| 지시 | [02-task-f1.md](02-task-f1.md) |
| 계획 | [01-plan.md](01-plan.md) §2 |
| 브랜치 | `feat/rider-perflab` |
| Git | commit · push · 배포 없음 |

## 한 줄

`?perflab=1` 일 때만 최근 10초 프레임 분포·라이더 비용·기기 정보를 구석 패널에 보여주고, 결과 JSON 은 클립보드로 복사한다. 쿼리가 없는 운영에서는 계측이 `performance.now()` 없이 콜백만 반환한다.

## 동작

- `isPerfLabEnabled()` 는 페이지 수명 동안 `perflab=1` 을 한 번 읽어 캐시한다. 패널이 마운트될 때만 rAF 1개가 돈다.
- 프레임 통계는 최근접 순위다. `index = ceil(p/100 × n) − 1`. 비율은 `dt > 33`, `dt > 50` (경계값은 초과가 아님). fps 는 창 안 간격의 평균으로 `1000/mean`. 5초를 넘는 간격은 숨은 탭으로 보고 뺀다.
- 라이더 비용은 같은 10초 창이다. DEV 이고 쿼리가 없으면 기존 `window.__rtwRiderCost` 수명 누적만 유지하고 창 버퍼는 채우지 않는다. `window.__rtwRiderCost` 설치는 계속 DEV 전용이다.
- 라이더가 0명이면 렌더 루프는 그대로 반환하고, perflab 일 때만 줌·LOD2 상태·인원 0을 남긴다. 리그·흔들림·LOD 판정·코너 로직은 바꾸지 않았다.
- 패널은 기본 접힘. 펼치면 화면 위 가운데(계기·QC·경로·주행 버튼이 있는 귀퉁이를 비움). 「결과 복사」가 실패하면 선택 가능한 텍스트 상자를 연다. 서버 전송은 없다.
- 빌드 식별은 운영 번들의 `/assets/index-<해시>.js` 이고, dev 는 `import.meta.env.MODE` (`development`)다.

## 변경 파일

| 파일 | 내용 |
|---|---|
| `apps/web/src/lib/debug/perfLab.ts` | 신규. 쿼리 게이트, 10초 통계, rAF 시계, 기기·WebGL, 빌드 식별 |
| `apps/web/src/lib/debug/riderRenderCostProbe.ts` | DEV 동작 유지. perflab 이면 운영에서도 누적·10초 창. 둘 다 아니면 콜백만 |
| `apps/web/src/components/perfLab/PerfLabPanel.tsx` | 패널. 1초 갱신, 복사, 접기 |
| `apps/web/src/components/perfLab/PerfLabPanel.css` | 위 가운데, 접힘 기본, 복사 버튼만 풀 폭, 버튼 높이 44px |
| `apps/web/src/App.tsx` | 기존 lab 패널 옆에 `<PerfLabPanel mapZoom={mapZoom} />` (+2줄) |
| `apps/web/src/lib/map/riderPreservedLayer.ts` | 줌 지역 변수, 계측에 줌·`lod2State` 전달, 인원 0일 때 perflab 장면 기록 |
| `apps/web/scripts/perf-lab.test.ts` | 신규 9개. `test:quick` tools 묶음(스크립트 최상위) |
| `apps/web/dep-layers.json` | `debug/perfLab.ts` 배정 |

`git diff --stat` (추적 파일): 4 files, 154 insertions, 18 deletions. 신규 파일은 untracked.

## 검증

작업 디렉터리 `apps/web`. PowerShell.

| 명령 | exit | 요약 |
|---|---|---|
| `npx tsc --noEmit -p tsconfig.app.json` | 0 | 진단 없음 |
| `npx eslint` (변경 ts/tsx 6파일) | 0 | error 0. warning 7은 `App.tsx` 기존 `react-hooks/exhaustive-deps` (719, 1182, 1219, 1235, 1277, 1358, 2821) |
| `npm run test:quick` | **1** | 통과 1121 · 실패 3. 아래 |
| `npm run test:rider-preserve` | 0 | 42 + 계약 6, 전부 pass |
| `node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/ride-hierarchy/rider-detail-lod-contract.test.ts` | 0 | 7 pass |
| `npm run build` | 0 | `dist/assets/index-CVgjzurr.js`. `SADDLE`/`PELVIS` 경고는 기존 `riderRig.ts` |

`test:quick` 묶음: ride 744/0, map 68/0, peer 72/0, meters 58/0, tools 20/0 (`scripts/perf-lab.test.ts` 9개 포함). route 만 159 pass · **3 fail**.

실패 3건은 이번 diff 밖이다. `functions/lib` 가 없다.

- `scripts/route-token/harness-active.test.mjs` — `Cannot find module '../../../../functions/lib/harnessActive.js'`
- `scripts/route-token/production-surface.test.mjs` — `functions/lib/index.js`, `functions/lib/index.harness.js` ENOENT

`route-token-onboarding-grant.test.mjs` 는 같은 이유로 건너뜀. functions 빌드는 이 지시 범위 밖이라 하지 않았다.

신규 시험 9개(별도 실행도 exit 0):

- 합성 간격 `[10,20,30,40,100]` → p50 30, p95/p99/max 100, >33 0.4, >50 0.2, fps 25
- 창 밖 제외. 33 은 >33 이 아니고 50 은 >50 이 아니다 (50 은 >33 이라 >33 비율 0.5)
- 빈 샘플은 비율 null
- 쿼리 없음 → `isPerfLabEnabled()` false, 캐시됨
- DEV 끄고 쿼리 없음 → `measureRiderRenderFrame`·`measureRiderPose`·`noteRiderPerfScene` 이 `performance.now()` 0회, frames/pose 0
- DEV 이고 쿼리 없음 → 수명 누적 1프레임, 10초 창은 0
- perflab 이고 DEV 끔 → 누적·창·줌 20.1·lod2 `ready`
- 라이더 비용 창: ms/프레임 3, ms/명 2, 자세 100/3 %, 마지막 인원 2

시험 로더가 `import.meta.env.DEV` 를 true 로 바꾸므로, 운영 분기는 `setRiderCostDevOverrideForTests(false)` 로 재현했다. 운영 번들에서는 그 오버라이드가 없고 `import.meta.env.DEV` 가 false 다.

레이어 계약 문자열은 유지됐다. `if (animatePose) measureRiderPose(() => rig.setPhase(...))`, `shouldAnimateRiderPose(`, `rig.setPhase(spec.phaseRev ?? 0)`, `queryTerrainElevation`, `spec.leanDeg`.

## 데스크톱 캡처

`npx vite --port 5070 --strictPort --host 127.0.0.1`. 헤드리스 Chromium 1280×720, `http://127.0.0.1:5070/?perflab=1`. 소개 「시작하기」→ 게스트 「시작」까지 눌렀다. 경로가 없어 「주행 시작」버튼은 없었다. 지도(콜로세움 부근, Trailhead·첫 주행 안내)가 뜬 뒤 패널을 펼쳐 캡처했다. 캡처 후 5070 LISTEN 은 없다.

캡처: `apps/web/scripts/rider-preserve/.out/perf/perflab-desktop.png` (git 제외 폴더로 이동 — Supervisor)

펼친 패널 rect: x 496, y 6, 288×230. 접힘이 기본이라 계기·우측 버튼·좌하단 첫 주행 안내를 가리지 않는다. 이 샷은 내용을 보이게 펼친 것이다.

이 순간의 라이더 렌더 프레임은 0이다. 인원 0, 줌 15, LOD2 는 ready 라 그리면 LOD2 를 쓰는 판정(`lod2Used: true`)이다. 프레임 p50 50 ms 는 지도가 올라오는 10초 창이다.

「결과 복사」JSON (`perflab-copy-sample.json` 과 동일):

```json
{
  "capturedAt": "2026-10-16T00:13:14.220Z",
  "build": "development",
  "frame": {
    "samples": 189,
    "windowMs": 10000,
    "fps": 18.651929339780914,
    "p50Ms": 50,
    "p95Ms": 83.39999999999782,
    "p99Ms": 149.90000000000146,
    "maxMs": 1033.2999999999993,
    "over33Ratio": 0.8359788359788359,
    "over50Ratio": 0.31746031746031744
  },
  "rider": {
    "frames": 0,
    "riders": 0,
    "msPerFrame": null,
    "msPerRider": null,
    "posePct": null,
    "riderCount": 0,
    "zoom": 15,
    "lod2State": "ready",
    "lod2Used": true
  },
  "device": {
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.7827.55 Safari/537.36",
    "hardwareConcurrency": 12,
    "deviceMemory": 16,
    "devicePixelRatio": 1,
    "screenWidth": 1280,
    "screenHeight": 720,
    "innerWidth": 1280,
    "innerHeight": 720,
    "webgl": {
      "unmaskedRenderer": "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)",
      "maxVertexUniformVectors": 4096,
      "vertexHighFloatPrecision": 23,
      "vertexHighFloatRangeMin": 127,
      "vertexHighFloatRangeMax": 127
    }
  }
}
```

## 미검증

- 실기기. 위 JSON 은 데스크톱 헤드리스 SwiftShader 다.
- 주행을 시작해 라이더가 그려지는 동안의 ms/프레임. 이번 캡처는 경로 선택 전이라 렌더 프레임이 0이다.
- 클립보드가 막힌 폰에서 텍스트 상자 폴백이 길게 눌러 복사되는지. 코드 경로는 있고, 이 캡처는 클립보드 쓰기가 성공했다.
