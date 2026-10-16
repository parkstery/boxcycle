# 결과 F2 — 프레임 시간 항목별 분해 (perflab)

| 항목 | 내용 |
|---|---|
| 작성 | 2026-10-16 · Developer (Cursor) |
| 지시 | [02-task-f2.md](02-task-f2.md) |
| 브랜치 | `feat/perflab-breakdown` |
| Git | commit · push · 배포 없음 |

## 한 줄

`?perflab=1` 에서만 최근 10초의 틱·지도·React·긴 프레임·GPU 를 패널과 복사 JSON `breakdown` 에 남긴다. 쿼리가 없으면 그 훅은 `performance.now()` 없이 바로 돌아간다.

## 1차 해석 (헤드리스, 실기기 아님)

이 숫자는 헤드리스 Chromium + SwiftShader 다. 폰(Adreno 730, 33–50 ms)이나 PC(GTX 1660, 20–30 ms)가 아니다. GPU 타이머는 미지원이라, 아래 「대기」가 GPU 시간인지는 확인하지 못했다.

카메라 2로 10초 달린 뒤 프레임 간격 평균은 **111 ms**(약 9 fps, p50 100 ms)다. 그중 측정된 JS 는 **33 ms** 이고, 나머지 **78 ms** 는 틱·지도 렌더·React·LoAF blocking 밖에 있다.

같은 10초의 LoAF blocking 합은 207 ms(프레임당 약 2.2 ms)뿐이다. 프레임이 100 ms 로 긴 이유가 메인 스레드를 100 ms 동안 붙잡는 스크립트는 아니다. 라이더 레이어는 **2.3 ms** 로, 이미 아는 약 3 ms 와 같다.

측정된 33 ms 의 구성은 다음과 같다.

| 항목 | 평균 | 읽는 법 |
|---|---|---|
| 지도 JS, 라이더 제외 | 11.7 ms | `map._render` 13.98 − 라이더 2.30 |
| React 커밋 | 10.4 ms/프레임 | 10초 합 967 ms, 초당 8.2회. 93프레임 중 82커밋이라 주행 HUD 가 거의 매 프레임 커밋된다. 개발 서버·StrictMode·Profiler 가 이 값을 키운다 |
| 앱 틱 전체 | 8.7 ms (p95 12.7) | 아래 덩어리의 합 |
| 틱 안 동기화 | 2.6 ms | `syncRiderPreservedModels` |
| 틱 안 마커 | 2.0 ms | 동행 DOM 마커 |
| 틱 안 스펙 | 1.9 ms | 라이더 spec 생성 |
| 틱 안 카메라 | 1.3 ms | 카메라 추종 |
| 본인 샘플 | 0.56 ms | |
| 이름표 갱신 | 0.10 ms | `syncGlbLiveNametagMarker`. 재투영은 지도 렌더 리스너 안에 있어 지도 시간에 포함 |
| 동행 step | 0.07 ms | |
| 페이서 | 0.03 ms | |

폰에서 비는 약 27 ms 를 이 비율로 나누지는 않는다. 이 세션이 말하는 것은, 그 구멍이 본인 샘플·동행 step·페이서·라이더 레이어는 아니라는 쪽이다. 후보 순서는 (1) JS 로 안 잡힌 대기 — 여기선 78 ms 이고 GPU 시간은 미측정, (2) 라이더를 뺀 지도 렌더 JS, (3) 매 프레임에 가까운 React 커밋, (4) 틱 안의 모델 동기화·DOM 마커·스펙 이다.

LoAF 스크립트 상위는 `performWorkUntilDeadline`(React) 513 ms, `mapbox-gl.js` 419 ms, `tick @ MapView.tsx` 225 ms 다. 스타일·레이아웃은 강제 배치 합 17.6 ms/10초라 프레임당 0.2 ms 수준이다.

## 동작

- 틱 시계는 `openFrameBreakdownTick()` 이 쿼리 없을 때 `null` 이다. `MapView` `tickBody` 는 `?.mark` 만 호출한다.
- 구간: 본인 샘플(표시 위치·스프라이트, 카메라 뒤의 방위 포함), 카메라 추종, 동행 step, 페이서, 동행 DOM 마커, spec 생성, `syncRiderPreservedModels`(또는 GLB sync), 본인 이름표. 표시 안 된 잔여는 `other`.
- 지도 CPU 는 perflab 일 때만 `map._render` 를 감싼다. 대입이 실패하면 `events-only` 로 `render`·`idle` 횟수만 남기고 원래 렌더는 그대로다. 라이더 레이어 시간은 같은 호출 안에서 빼 `exRiderMeanMs` 로 둔다. 이름표 재투영 리스너는 지도 시간에 포함된다.
- `renderEvents`·`idleEvents` 는 10초 창이 아니라 지도를 붙인 뒤의 누적이다. 이번 JSON 의 246·1 을 창 안 프레임 93 과 나누면 안 된다.
- React 는 쿼리가 있을 때만 루트 `<Profiler id="app">`. 초당 커밋 수와 커밋 시간 합.
- LoAF 는 `long-animation-frame` 지원 시에만. `styleAndLayoutDuration` 속성이 없으면 스크립트 `forcedStyleAndLayoutDuration` 합, 그것도 없으면 `styleAndLayoutStart` 로 추정한다. 이번 캡처 출처는 `forced`.
- GPU 는 `EXT_disjoint_timer_query_webgl2`, 4프레임마다 한 번. 확장 없음·begin 두 번 실패면 미지원. 이번 캡처는 미지원.
- 합산: `js = 틱 평균 + 지도 평균 + 프레임당 React + 기타 LoAF`, `대기 = max(0, 프레임 간격 평균 − js)`. React 가 틱·지도 안에 겹치면 js 가 커지고 대기가 0 으로 붙을 수 있다. 이번 창은 대기가 78 ms 로 남았다.
- 패널은 기본 접힘. 펼치면 항목마다 한 줄이고, 기존처럼 스크롤된다. 복사 JSON 에 `breakdown` 이 들어간다. 서버 전송은 없다.

## 변경 파일

| 파일 | 내용 |
|---|---|
| `apps/web/src/lib/debug/frameBreakdownProbe.ts` | 신규. 집계, 틱 시계, 지도 래핑, React·LoAF·GPU, 합산 |
| `apps/web/src/lib/debug/riderRenderCostProbe.ts` | `readRiderRenderMsOverlapping`. 쿼리 없으면 0, 시계 호출 없음 |
| `apps/web/src/components/map/MapView.tsx` | 틱 표시와 `attachMapRenderProbe`. 주행 분기는 그대로 |
| `apps/web/src/components/perfLab/PerfLabPanel.tsx` | 항목 줄, 관찰자 시작, 복사 JSON 에 `breakdown` |
| `apps/web/src/components/perfLab/PerfLabPanel.css` | 긴 스크립트 이름이 줄 안에서 줄바꿈 |
| `apps/web/src/main.tsx` | perflab 일 때만 루트 Profiler |
| `apps/web/scripts/frame-breakdown.test.ts` | 신규 10개. `test:quick` tools |
| `apps/web/dep-layers.json` | `debug/frameBreakdownProbe.ts` |

일회 실행 스크립트는 캡처 후 삭제했다.

## 검증

작업 디렉터리 `apps/web`(의존 방향만 저장소 루트). PowerShell.

| 명령 | exit | 요약 |
|---|---|---|
| `npx tsc --noEmit -p tsconfig.app.json` | 0 | 진단 없음 |
| `npx eslint` (변경 ts/tsx 6파일) | 0 | error 0. warning 8은 `MapView.tsx` 기존 `react-hooks/exhaustive-deps` (1776, 1793, 1811, 3000–3003, 3037) |
| 루트 `node scripts/check-dep-direction.mjs --check` | **2** | M0. `lib 파일 전원 도메인 지정` 은 PASS **(0건 미지정)**. 실패 1건은 `scripts/route-token/route-token-onboarding-grant.test.mjs` → `functions/lib/routeTokenCore.js` |
| `npm run test:quick` | **1** | 통과 1148 · 실패 3. tools 34/0 에 신규 10개 포함 |
| `npm run test:rider-preserve` | 0 | 44 + 계약 6 |
| `npm run test:peer-spacing` | 0 | GATE PASS, transitions requiredFail 0, residual requiredFail 0. 로그의 `Port 24678 is already in use` 는 하네스 쪽 경고이고 필수 실패는 0 |
| `npm run build` | 0 | `dist/assets/index-DxZSpKg-.js`. `SADDLE`/`PELVIS` 경고는 기존 `riderRig.ts` |

`test:quick` 실패 3건은 이번 diff 밖이다. `functions/lib` 가 없다.

- `scripts/route-token/harness-active.test.mjs` — `Cannot find module '../../../../functions/lib/harnessActive.js'`
- `scripts/route-token/production-surface.test.mjs` — `functions/lib/index.js`, `functions/lib/index.harness.js` ENOENT

`route-token-onboarding-grant.test.mjs` 는 같은 이유로 건너뜀.

신규 시험 10개(별도 실행도 exit 0, `test:quick` tools 에도 포함):

- 평균·p95. `[10,20,30,40,100]` → 평균 40, p95 100. 빈 배열·NaN·음수는 제외
- 상위 5. 여섯 출처 중 합이 가장 작은 하나 탈락
- `styleAndLayoutDuration` 우선, 없으면 강제 배치 합, 없으면 `styleAndLayoutStart` 추정
- 지도 ms 에서 라이더 ms 를 빼고, 라이더가 더 크면 0
- 합산. 간격 40, 틱 5, 지도 10 → JS 15, 대기 25. React 가 틱·지도와 겹치면 대기 0
- 쿼리 없음 → 틱 시계 null, 지도 래핑 없음, React·LoAF·관찰자·겹치는 라이더 조회·`readFrameBreakdown` 이 `performance.now()` 0회
- perflab 틱 두 개의 평균·p95
- `map._render` 래핑과, 대입 실패 시 `events-only`
- 같은 호출의 라이더 4 ms 를 지도 30 ms 에서 빼 26 ms
- React 커밋 합·초당 횟수, LoAF 스크립트 상위 5, 쿼리의 `token` 은 출처에서 빠짐

## 데스크톱 헤드리스 1회

`vite --port 5070 --strictPort --host 127.0.0.1`. 첫 기동은 `apps/web/node_modules/vite` 경로가 없어 서버가 바로 죽었고, 브라우저는 열리지 않았다. 이어서 루트 `node_modules/vite` 로 서버 1번, 헤드리스 Chromium 1번.

1280×720, `http://127.0.0.1:5070/?perflab=1`. 소개 「시작하기」→ 게스트 「시작」→ Trail 메뉴 → 입문 → `Basic 1 · 서울 남산공원길` → 「주행 시작」→ 「카메라 2」(`aria-pressed=true`) → 10초 → 「결과 복사」.

끝난 뒤 5070 은 LISTEN 이 없고 TIME_WAIT 만 남아 있었다. 브라우저 프로세스도 닫았다.

주행 직후 콘솔에 기존 경고가 있었다. `Style is not done loading`, heat/red dot addSource 실패, style diff `setSprite`. 페이지 예외로 캡처가 끊기지는 않았다.

복사 JSON:

```json
{
  "capturedAt": "2026-10-16T07:21:36.132Z",
  "build": "development",
  "frame": {
    "samples": 93,
    "windowMs": 10000,
    "fps": 9.014859978868394,
    "p50Ms": 100,
    "p95Ms": 150,
    "p99Ms": 749.9000000000015,
    "maxMs": 749.9000000000015,
    "over33Ratio": 1,
    "over50Ratio": 1
  },
  "rider": {
    "frames": 93,
    "riders": 171,
    "msPerFrame": 2.296774192522931,
    "msPerRider": 1.2491228064598396,
    "posePct": 71.02059891430207,
    "riderCount": 3,
    "zoom": 22.246752829335193,
    "lod2State": "ready",
    "lod2Used": false
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
  },
  "jitter": [
    {
      "id": "live-self",
      "kind": "self",
      "frames": 93,
      "reverseFrames": 0,
      "maxReverseM": 0,
      "speedCv": 0.0000010241652661881939,
      "relStdM": 0
    },
    {
      "id": "pacer-a",
      "kind": "pacer",
      "frames": 67,
      "reverseFrames": 0,
      "maxReverseM": 0,
      "speedCv": 2.423408301068257,
      "relStdM": 2.446559944419647
    },
    {
      "id": "pacer-b",
      "kind": "pacer",
      "frames": 13,
      "reverseFrames": 0,
      "maxReverseM": 0,
      "speedCv": 2.958364181427382,
      "relStdM": 0.5377393164728232
    }
  ],
  "breakdown": {
    "windowMs": 10000,
    "tick": {
      "samples": 93,
      "meanMs": 8.654838699166493,
      "p95Ms": 12.699999928474426,
      "other": {
        "samples": 93,
        "meanMs": 0.007526883514978553,
        "p95Ms": 0.10000002384185791
      },
      "phases": {
        "self": { "samples": 93, "meanMs": 0.5591397849462365, "p95Ms": 0.8999998569488525 },
        "camera": { "samples": 93, "meanMs": 1.2827956945665422, "p95Ms": 1.899999976158142 },
        "peer": { "samples": 93, "meanMs": 0.0666666607702932, "p95Ms": 0.19999992847442627 },
        "pacer": { "samples": 93, "meanMs": 0.029032258577244258, "p95Ms": 0.10000002384185791 },
        "markers": { "samples": 93, "meanMs": 2.0494623722568637, "p95Ms": 3.100000023841858 },
        "spec": { "samples": 93, "meanMs": 1.9494623637968493, "p95Ms": 3.1999999284744263 },
        "sync": { "samples": 93, "meanMs": 2.612903215551889, "p95Ms": 4.399999976158142 },
        "nametag": { "samples": 93, "meanMs": 0.09784946518559609, "p95Ms": 0.20000004768371582 }
      }
    },
    "map": {
      "method": "map._render",
      "samples": 93,
      "meanMs": 13.978494626219554,
      "p95Ms": 20.699999928474426,
      "exRiderMeanMs": 11.681720433696624,
      "exRiderP95Ms": 19.299999833106995,
      "riderMeanMs": 2.296774192522931,
      "renderEvents": 246,
      "idleEvents": 1,
      "limit": "지도 CPU는 map._render 한 번의 JS다. 커스텀 라이더 레이어와 render 리스너(네임태그 재투영)가 포함된다. exRiderMeanMs 는 그 호출 안의 라이더 레이어 시간을 뺀 값이다. 래핑이 실패하면 method 는 events-only 이고 시간은 없다. GPU 는 EXT_disjoint_timer_query_webgl2 로 4프레임마다 한 번이며, 실패·disjoint 샘플은 버린다."
    },
    "react": {
      "commits": 82,
      "commitsPerSec": 8.2,
      "commitSumMs": 967.3000005483627,
      "commitMeanMs": 11.796341470101984
    },
    "loaf": {
      "supported": true,
      "count": 23,
      "blockingMs": 206.89999999999998,
      "styleAndLayoutMs": 17.599999999999998,
      "styleAndLayoutSource": "forced",
      "topScripts": [
        { "source": "performWorkUntilDeadline @ react-dom_client.js", "ms": 513.1999998092651 },
        { "source": "mapbox-gl.js", "ms": 419.10000014305115 },
        { "source": "tick @ MapView.tsx", "ms": 225.0999995470047 },
        { "source": "receive @ mapbox-gl.js", "ms": 91 },
        { "source": "dispatchDiscreteEvent @ react-dom_client.js", "ms": 28.800000071525574 }
      ]
    },
    "gpu": {
      "supported": false,
      "reason": "unsupported",
      "samples": 0,
      "meanMs": null,
      "p95Ms": null
    },
    "summary": {
      "frameMeanMs": 110.92795698924729,
      "tickMs": 8.654838699166493,
      "mapMs": 13.978494626219554,
      "reactMs": 10.401075274713579,
      "otherLoafMs": 0,
      "jsMs": 33.034408600099624,
      "waitMs": 77.89354838914767
    },
    "note": "js = 틱 평균 + 지도 평균 + 프레임당 React + 기타 LoAF. 기타 LoAF = max(0, LoAF blocking/프레임 − 틱 − 지도 − React). 대기 = max(0, 프레임 간격 평균 − js). React 는 틱·지도 안에 겹칠 수 있어 js 가 간격을 넘으면 대기는 0 이다."
  }
}
```

## 미검증

- 실기기(GTX 1660, Adreno 730). 위 대기가 그 기기의 27 ms 와 같은 자리인지는 이 캡처로 확정하지 못한다.
- GPU 시간. SwiftShader 에서 `EXT_disjoint_timer_query_webgl2` 미지원.
- 운영 번들의 React 커밋 비용. 이번 값은 development + StrictMode + Profiler 다.
- 740×300 전후 캡처. 패널은 기존처럼 기본 접힘이고, 추가 줄은 펼친 뒤 스크롤 안이다.
