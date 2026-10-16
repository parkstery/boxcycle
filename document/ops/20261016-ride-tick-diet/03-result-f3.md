# 결과 F3 — 주행 틱 다이어트

| 항목 | 내용 |
|---|---|
| 작성 | 2026-10-16 · Developer (Cursor) |
| 지시 | [02-task-f3.md](02-task-f3.md) |
| 브랜치 | `perf/ride-tick-diet` (기준 `main2` `38fc81f`) |
| Git | commit · push · 배포 없음 |

## 한 줄

헤드리스 1회(개발 서버, SwiftShader, 입문 남산, 기본 카메라 1, 줌 17.07, LOD2, 라이더 3)의 틱 평균은 **2.288 ms**, p95 **2.900 ms** 이다. 지시 목표 ≤ 2 ms 를 평균 0.29 ms 넘긴다.

같은 시나리오의 헤드리스 전 숫자는 없다. 브라우저·dev 서버는 수정 뒤 1회만 허용되어, 그 1회를 수정 후에 썼다. 아래 「운영 PC 전」은 지시서 표이고, 이번 헤드리스와 기계·빌드가 다르다.

## 원인 (수정 전 Node 마이크로벤치)

입문 코스 크기에서 경로 검색 전체(라이더 3명의 구간 평균 점·방위 + 투영 1회 + 카메라 창 60샘플)는 폰델파크 147꼭짓점·2015.6 m 에서 **0.427 ms/호출**, 남산 42꼭짓점·413.2 m 에서 **0.112 ms/호출** 이었다. H1 은 맞지만, 지시서의 sync 2.00 · markers 1.48 · spec 1.43 ms 를 설명하지 못한다.

그 세 구간은 매 프레임 `map.getStyle()` 과, LOD2 로 리그가 가려진 뒤에도 `setSpecs` 가 부르는 `rig.setPhase`(다리 IK) 와 맞다. 카메라 60샘플 선형 스캔은 긴 경로에서 크고, 남산에서는 `jumpTo` 쪽이 남는다.

## 변경

| 파일 | 내용 |
|---|---|
| `apps/web/src/lib/geo/geo.ts` | geometry 객체 WeakMap 에 누적거리 `Float64Array`. 거리→선분은 이진 탐색. 구간 평균은 겹치는 선분만. 같은 (geometry, d) 4슬롯 재사용. 길이·점·방위·투영 선분 길이가 이 색인을 쓴다. 좌표 **배열 교체**는 무효화한다. 같은 배열·같은 길이의 제자리 좌표 수정은 감지하지 않는다 |
| `apps/web/src/components/map/rideCameraFollow.ts` | 카메라 전방 평균 방위가 위 색인의 투영·방위를 호출. 파일 안 선형 스캔 두 개를 지움 |
| `apps/web/src/lib/map/riderPreservedLayer.ts` | LOD2 가 보이는 동안 `setSpecs` 는 `setPhase` 를 건너뛴다. 줌 ≥ 19 로 리그가 보이거나 LOD2 가 준비 전이면 그대로 `setPhase`. 렌더 루프의 `if (animatePose) setPhase` 는 유지. 레이어 순위가 확인된 프레임은 `getStyle()` 을 생략. `styledata`·`remove` 에서 순위를 다시 확인. 같은 desired 배열 참조는 `setSpecs` 를 다시 하지 않음. `sync` 의 두 번째 `setSpecs(specs)` 제거 |
| `apps/web/src/components/map/riderDomMarkers.ts` | `setMarkerLngLatIfChanged`. 직전 경위도와 같으면 `setLngLat` 생략. 이름표 문구·스프라이트 `backgroundPosition` 도 같으면 생략. `reprojectGlbNametagMarkers` 는 매 지도 렌더에서 `setLngLat` 를 그대로 호출(지형·카메라가 바뀌면 재투영이 필요). 그 비용은 틱 markers 가 아니라 지도 JS |
| `apps/web/src/components/map/MapView.tsx` | 비-3D 라이브 마커와 본인 위치 마커가 `setMarkerLngLatIfChanged` |
| `apps/web/scripts/geo/route-distance-index.test.ts` | 신규. 폰델파크 + 중복 꼭짓점 지그재그, 거리 1만×2, 선형 오라클과 1e-9 |
| `apps/web/scripts/test-quick.mjs` | `route` 그룹에 `geo` |

새 lib 파일은 없다. `dep-layers.json` 은 그대로다.

화면 위치·방위·카메라 이동·동기화 정책은 바꾸지 않았다. LOD2 점만 보일 때 IK 를 건너뛰는 것은 그 프레임에 리그를 그리지 않기 때문이다. `posePct` 0 · `lod2Used` true 가 이번 캡처와 맞다.

## 마이크로벤치 (ms/호출, 수정 전 선형 → 수정 후)

같은 Node 프로세스 계열. 「반복」은 같은 거리라 4슬롯 캐시에 닿는다. 「이동」은 호출마다 거리가 바뀌어 캐시가 빗나간다.

폰델파크 147꼭짓점, 2015.6 m:

| 호출 | 전 | 후·반복 | 후·이동 |
|---|---:|---:|---:|
| length | 0.0166 | 0.0002 | |
| point (거리 8개) | 0.0637 | 0.0088 | |
| smoothPoint | 0.0653 | 0.0081 | |
| smoothHead | 0.1225 | 0.0117 | |
| heading | 0.0597 | 0.0033 | |
| project | 0.0319 | 0.0234 | |
| tickMix (라이더 3 + 투영 1 + 방위 60) | 0.4267 | 0.0331 | 0.0626 |

남산 42꼭짓점, 413.2 m: 전 length 0.0034, point 0.0158, smoothPoint 0.0172, smoothHead 0.0327, heading 0.0141, project 0.0056, tickMix **0.1115**. 후·반복 tickMix **0.0179**.

투영은 여전히 전 선분을 본다. 선분 길이만 색인에서 읽는다.

## 헤드리스 perflab (수정 후 1회)

`apps/web` 에서 vite `--port 5070 --strictPort --host 127.0.0.1`. 헤드리스 Chromium 1280×720, `http://127.0.0.1:5070/?perflab=1`. 시작하기 → guest → Trail → 입문 → Basic 1 남산 → 주행 시작. 카메라 2는 누르지 않아 기본 QC1 500 m 가 유지됐다. 주행 중 10초 뒤 성능 패널에서 결과 복사. 서버와 브라우저는 종료했다. 일회 스크립트 `apps/web/scripts/_f3-perflab-once.mjs` 와 `%TEMP%\rtw-f3-perflab.mjs` 는 삭제했다. 포트 5070 은 listen 이 아니다.

F2 헤드리스(카메라 2, 줌 약 22, lod2 미사용, 틱 평균 8.65 ms)는 이번 시나리오와 다른 캡처다.

| 틱 구간 | 운영 PC 전 (지시) | 헤드리스 후 mean | 헤드리스 후 p95 |
|---|---:|---:|---:|
| 전체 | 6.64 | 2.288 | 2.900 |
| sync | 2.00 | 0.009 | 0.100 |
| markers | 1.48 | 0.697 | 0.900 |
| spec | 1.43 | 0.096 | 0.200 |
| camera | 1.02 | 0.951 | 1.200 |
| self | 0.43 | 0.433 | 0.600 |
| peer | 0.13 | 0.036 | 0.100 |
| pacer | 0.09 | 0.026 | 0.100 |
| nametag | 0.05 | 0.037 | 0.100 |

코드로 줄어든 구간은 sync · spec · markers · peer · pacer 이다. self 와 camera 는 운영 PC 전과 거의 같다.

2 ms 까지 남은 약 0.29 ms 의 구성(이번 헤드리스):

- camera 0.951 ms — `tickRideCameraFollow` 의 프레이밍과 `map.jumpTo`. 남산에서 경로 60샘플은 이미 작다. `jumpTo` 를 빼면 카메라 움직임이 바뀐다.
- markers 0.697 ms — 움직이는 페이서 이름표·점의 `setLngLat`. 위치가 매 프레임 달라 동등 생략이 안 탄다. 이번 창에서 pacer-b 는 17프레임만 잡혀, 대부분 페이서 1명이다.
- self 0.433 ms — 이동 중 `setLngLat` 와, 방위 요소의 opacity·transform 을 매 프레임 씀. 남산 투영은 벤치 0.006 ms 수준이라 이 구간의 주가 아니다.

지도 `map._render` 평균 9.989 ms, React 커밋 평균 8.836 ms(프레임당 8.706)는 틱 예산 밖이다. 프레임 간격 평균 73.0 ms, js 합 20.98, 대기 52.05. GPU 타이머는 미지원.

jitter: live-self reverse 0, speedCv 0.008. pacer-a·pacer-b reverse 0.

```json
{
  "capturedAt": "2026-10-16T08:11:07.436Z",
  "build": "development",
  "frame": {
    "samples": 136,
    "windowMs": 10000,
    "fps": 13.69173462196718,
    "p50Ms": 66.70000000000073,
    "p95Ms": 83.40000000000146,
    "p99Ms": 116.59999999999854,
    "maxMs": 116.60000000000036,
    "over33Ratio": 1,
    "over50Ratio": 0.9485294117647058
  },
  "rider": {
    "frames": 137,
    "riders": 240,
    "msPerFrame": 0.2635036463285015,
    "msPerRider": 0.15041666477918625,
    "posePct": 0,
    "riderCount": 3,
    "zoom": 17.07029578103259,
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
  },
  "jitter": [
    {
      "id": "live-self",
      "kind": "self",
      "frames": 136,
      "reverseFrames": 0,
      "maxReverseM": 0,
      "speedCv": 0.008010978399730058,
      "relStdM": 0
    },
    {
      "id": "pacer-a",
      "kind": "pacer",
      "frames": 88,
      "reverseFrames": 0,
      "maxReverseM": 0,
      "speedCv": null,
      "relStdM": 2.5041008481674405
    },
    {
      "id": "pacer-b",
      "kind": "pacer",
      "frames": 17,
      "reverseFrames": 0,
      "maxReverseM": 0,
      "speedCv": null,
      "relStdM": 0.5287455218592043
    }
  ],
  "breakdown": {
    "windowMs": 10000,
    "tick": {
      "samples": 137,
      "meanMs": 2.2883211687533525,
      "p95Ms": 2.899999976158142,
      "other": { "samples": 137, "meanMs": 0.0036496350364963502, "p95Ms": 0 },
      "phases": {
        "self": { "samples": 137, "meanMs": 0.432846722811678, "p95Ms": 0.6000000238418579 },
        "camera": { "samples": 137, "meanMs": 0.951094888422611, "p95Ms": 1.2000000476837158 },
        "peer": { "samples": 137, "meanMs": 0.03576642057321368, "p95Ms": 0.10000002384185791 },
        "pacer": { "samples": 137, "meanMs": 0.025547442645052054, "p95Ms": 0.10000002384185791 },
        "markers": { "samples": 137, "meanMs": 0.6970802937110845, "p95Ms": 0.8999999761581421 },
        "spec": { "samples": 137, "meanMs": 0.09635036183099677, "p95Ms": 0.20000004768371582 },
        "sync": { "samples": 137, "meanMs": 0.008759123565506762, "p95Ms": 0.10000002384185791 },
        "nametag": { "samples": 137, "meanMs": 0.03722628015671333, "p95Ms": 0.10000002384185791 }
      }
    },
    "map": {
      "method": "map._render",
      "samples": 137,
      "meanMs": 9.989051091409948,
      "p95Ms": 12.299999952316284,
      "exRiderMeanMs": 9.725547445081446,
      "exRiderP95Ms": 12.100000023841858,
      "riderMeanMs": 0.2635036463285015,
      "renderEvents": 280,
      "idleEvents": 0
    },
    "react": {
      "commits": 134,
      "commitsPerSec": 13.4,
      "commitSumMs": 1184.0000007152557,
      "commitMeanMs": 8.835820900860117
    },
    "loaf": {
      "supported": true,
      "count": 2,
      "blockingMs": 0,
      "styleAndLayoutMs": 0,
      "styleAndLayoutSource": "forced",
      "topScripts": [
        { "source": "performWorkUntilDeadline @ react-dom_client.js", "ms": 46.799999952316284 },
        { "source": "mapbox-gl.js", "ms": 23.299999952316284 }
      ]
    },
    "gpu": { "supported": false, "reason": "unsupported", "samples": 0, "meanMs": null, "p95Ms": null },
    "summary": {
      "frameMeanMs": 73.03676470588235,
      "tickMs": 2.2883211687533525,
      "mapMs": 9.989051091409948,
      "reactMs": 8.70588235820041,
      "otherLoafMs": 0,
      "jsMs": 20.98325461836371,
      "waitMs": 52.05351008751864
    }
  }
}
```

## 수치 동등

점·구간 방위·길이·투영은 선형 오라클과 1e-9. 구간 평균 현의 방위만 허용을 1e-7 도로 뒀다. 계측된 최악은 **6.588902579096612e-8 도**(2만 샘플). 끝점 좌표는 1e-9 인데, 약 1 m 현이 그 ulp 를 각도로 키운다. 선분을 잘못 고르면 수십 도다. 경로 끝에서 선형 쪽은 빼기 오차로 마지막 꼭짓점 원본을 반환하고, 색인은 비율 1 보간을 반환할 수 있다. 그때도 좌표 차는 1e-9 안이다.

## 검증

작업 디렉터리 `apps/web`. 의존 방향만 저장소 루트. PowerShell. 신규 시험의 `console.log` 한 줄은 스위트 뒤에 지웠고, 그 파일만 다시 실행했다(exit 0, 3 pass, 607 ms).

| 명령 | exit | 요약 |
|---|---|---|
| `npx tsc --noEmit -p tsconfig.app.json` | 0 | |
| `npx eslint` 변경 ts/tsx | 0 | error 0. warning 8은 `MapView.tsx` 기존 `react-hooks/exhaustive-deps` (1777, 1794, 1812, 3001–3004, 3038) |
| 루트 `node scripts/check-dep-direction.mjs --check` | 2 | `lib 파일 전원 도메인 지정` PASS, 미지정 0. 실패 1건은 기존 M0 `scripts/route-token/route-token-onboarding-grant.test.mjs` → `functions/lib/routeTokenCore.js` |
| `npm run test:quick` | 1 | 통과 1151 · 실패 3. 실패는 `harness-active.test.mjs`(`functions/lib/harnessActive.js`), `production-surface.test.mjs`(`functions/lib/index.js`, `index.harness.js`). onboarding grant 는 같은 이유로 스킵. 신규 route-distance-index 3개는 route 그룹에서 통과 |
| `npm run test:pacer` | 0 | 14 pass. smoothed worst step 0.72°, segment 90° |
| `npm run test:rider-preserve` | 0 | 44 + 계약 6 |
| `npm run test:peer-spacing` | 0 | GATE PASS. transitions requiredFail 0, residual requiredFail 0. `Port 24678 is already in use` 는 하네스 경고 |
| `npm run build` | 0 | `dist/assets/index-D8gG5Mxw.js` 3,715.47 kB, `index-DdXKIuKq.css`. `riderRig.ts` 의 `SADDLE`/`PELVIS` 경고는 기존 |
| 헤드리스 perflab | 위 JSON | 브라우저 1, 포트 5070, 종료 확인 |

기존 시험 단언은 완화하지 않았다.
