# 결과 W2·W3 — 흔들림 비교 캡처 + 성능

| 항목 | 내용 |
|---|---|
| 작성 | 2026-10-16 · Developer (Cursor Agent CLI) |
| 지시 | [02-task-w2w3.md](02-task-w2w3.md) |
| 계획 | [01-plan.md](01-plan.md) §3 W2·W3 |
| 작업 위치 | `C:\20.HDev\boxcycle-sway` |
| 서버 | `http://localhost:5050` · Vite 8.0.11 · 측정 후 TCP listen 종료 |
| commit | 하지 않음 |

`apps/web/src/**` 는 이번 지시에서 고치지 않았다. 흔들림 기본값도 그대로다. 벤치 페이지와 실행기만 바꿨다.

## 서버

`apps/web` 에서 `$env:RTW_DEV_PORT="5050"; npx vite --port 5050 --strictPort`.

- 기동 로그: `Local: http://localhost:5050/`
- 종료: vite node PID 55328 (`vite.js --port 5050 --strictPort`) 를 끝냈다. 부모 cmd 46468·띄운 PowerShell 712 도 함께 사라졌다.
- 확인: `netstat` 에 `TCP …:5050 … LISTENING` 없음.

## 벤치 변경

정지 캡처는 `animate=0` 이면 위상이 고정되어 envelope 이 0 이다. `swayHold=1` 일 때 매 프레임 `fixedPhase + 1e-9·(홀짝)` 으로만 흔든다. 앱 셰이더·수식은 그대로다.

실행기는 `RTW_BENCH_EXTRA` 가 있으면 URL 끝에 그대로 붙인다. 비어 있으면 이전 URL 과 같다.

```diff
--- a/apps/web/scripts/rider-preserve/rider-perf-bench.run.mjs
+++ b/apps/web/scripts/rider-preserve/rider-perf-bench.run.mjs
@@ -29,7 +29,9 @@ for (const candidate of BASES) {
   }
 }
 console.log(`base=${BASE}`);
-console.log(`out=${path.basename(outDir)} model=${process.env.RTW_BENCH_MODEL || ""}`);
+console.log(
+  `out=${path.basename(outDir)} model=${process.env.RTW_BENCH_MODEL || ""} extra=${process.env.RTW_BENCH_EXTRA || ""}`,
+);
 function benchUrl(zoom, riders, animate) {
   const model = process.env.RTW_BENCH_MODEL;
+  const extra = process.env.RTW_BENCH_EXTRA || "";
   return (
     `${BASE}/scripts/rider-preserve/rider-perf-bench.html` +
     `?zoom=${zoom}&pitch=67&bearing=-32&riders=${riders}&animate=${animate}` +
-    (model ? `&riderModel=${model}` : "")
+    (model ? `&riderModel=${model}` : "") +
+    extra
   );
 }
```

`rider-perf-bench.ts` 요지: `swayHold` 는 `animate=0` 이고 쿼리가 0 이 아닐 때만 켜진다. `tick` 에서 홀짝을 올리고 `displayedPhase()` 를 `syncRiderPreservedModels` 에 넘긴다. 패널 READY 문구에 `swayHold=0|1` 을 붙였다. 캡처 스크립트는 그 문구에 `swayHold=1` 이 있을 때만 정지 컷을 저장했다.

전체 diff: `git diff -- apps/web/scripts/rider-preserve/rider-perf-bench.ts apps/web/scripts/rider-preserve/rider-perf-bench.run.mjs`

## W2 캡처

스크립트 `apps/web/scripts/rider-preserve/.out/sway/w2/capture-w2.mjs` (gitignore `.out`). 뷰포트 1280×800, headless Chromium 하나, 페이지는 순차. 주소는 `http://localhost:5050/scripts/rider-preserve/rider-perf-bench.html`. 모델 쿼리 `riderModel=rider14` (제품 기본값과 같다). 콘솔 오류 0건 (`captures-phase.json`, `captures-rear.json`, `captures-strip.json`).

정지 컷은 ready 이후 2초를 기다린 뒤 패널을 숨기고 찍었다. 합본은 왼쪽 끔, 오른쪽 켬, 간격 없음. 차이 이미지는 채널별 `|켬−끔|×8` (255에서 자름).

### 위상 4점 (측면)

`animate=0&swayHold=1&riders=1&zoom=22&pitch=78&bearing=0&phase=<0|90|180|270>`. 끔은 `&sway=0`. DPR 4, clip `{x:578,y:282,width:134,height:124}` (`capture-p4.mjs` 의 `phase-*`).

| 파일 | 경로 |
|---|---|
| 끔/켬 | `C:\20.HDev\boxcycle-sway\apps\web\scripts\rider-preserve\.out\sway\w2\phase-<0\|90\|180\|270>-<off\|on>.png` |
| 합본 | `…\w2\pair-phase-<0\|90\|180\|270>.png` |
| 차이 ×8 | `…\w2\diff-phase-<0\|90\|180\|270>.png` |

차이 통계 (×8 뒤 평균, 최대, 평균≥16 인 픽셀, 세로 3등분 평균):

| 위상 | mean | max | hot | 상·중·하 |
|---:|---:|---:|---:|---|
| 0 | 3.62 | 255 | 8463 | 2.56 · 4.02 · 4.27 |
| 90 | 6.85 | 255 | 15401 | 3.96 · 8.06 · 8.53 |
| 180 | 3.26 | 255 | 7778 | 1.31 · 4.15 · 4.31 |
| 270 | 6.20 | 255 | 13931 | 1.55 · 8.47 · 8.57 |

### 뒤 시점

전체 화면 `rear-locate.png` (DPR 1) 에서 주황 저지 덩어리는 x 600–680, y 280–400. 헬멧 위와 바퀴 아래를 넣어 CSS clip `{x:575,y:250,w:140,h:220}` (`rear-clip.json`). 조건 `bearing=90&pitch=70&zoom=22&riders=1&animate=0&swayHold=1`, 위상 0°·180°, DPR 4.

| 파일 | 경로 |
|---|---|
| 위치 확인 | `…\w2\rear-locate.png` |
| 끔/켬 | `…\w2\rear-phase-<0\|180>-<off\|on>.png` |
| 합본 | `…\w2\pair-rear-phase-<0\|180>.png` |
| 차이 ×8 | `…\w2\diff-rear-phase-<0\|180>.png` |

차이 통계: 위상 0 mean 2.62, 상·중·하 2.35 · 5.36 · 0.13. 위상 180 mean 2.53, 2.38 · 5.10 · 0.12. 아래 1/3 은 도로라 차이가 거의 없다. 차이는 라이더 위에 있다.

DPR 4 픽셀에서 켬−끔 중심 이동 (화면 오른쪽이 +). 어깨는 주황 박스 위 35% 중심, 엉덩이는 그 아래 어두운 픽셀, 바퀴는 주황 박스 아래 어두운 선의 x 중심.

| 위상 | 어깨 | 엉덩이 | 바퀴 |
|---:|---:|---:|---:|
| 0° | +0.57 | +0.38 | +0.17 |
| 180° | −0.72 | −0.04 | −0.40 |

0.57 device px 는 CSS 약 0.14 px 이다.

### 움직임 스트립

같은 뒤 clip, `animate=1`, 위상 시작 0. ready 후 2초(envelope 이 살아 있는 구간) 뒤에 Playwright clock 을 멈추고, 스크린샷 → `runFor(100)` 을 8번 했다. 시각은 0, 100, …, 800 ms. DPR 4 전체 화면 스크린샷은 한 장에 약 9초가 걸려 0.1초 간격을 지키지 못해, 스트립만 DPR 1 로 바꿨다. 로그 `captures-strip.json`.

| 파일 | 경로 |
|---|---|
| 켬 9장 | `…\w2\frames-rear-on\f0.png` … `f8.png` |
| 끔 9장 | `…\w2\frames-rear-off\f0.png` … `f8.png` |
| 이어 붙임 | `…\w2\strip-rear.png`, `…\w2\strip-rear-off.png` |

## 관찰

합본만 보면 끔과 켬이 같다. 0.5°·0.4°·2 mm 는 이 크기에서 윤곽이 한 픽셀 안쪽이다. ×8 차이는 헬멧·어깨·팔·손·프레임·바퀴 살의 가장자리만 밝고, 지도 배경은 검다.

뒤 시점 위상 0°에서 어깨가 오른쪽으로 0.57 px, 180°에서 왼쪽으로 0.72 px 움직인다. 반 바퀴마다 어깨 방향이 바뀐다. 엉덩이와 바퀴도 같은 쪽으로 움직이고, 이동량은 어깨보다 작다. 바퀴가 어깨의 반대쪽으로 기우는 각은 이 컷의 중심 이동으로는 나오지 않았다. 바퀴 수직선의 기울기 맞춤은 다리 자세에 끌려 위상마다 기준각이 달라, 각도 차이는 흔들림 증거로 쓰지 않았다.

손은 합본에서 핸들바 위 후드에 있다. ×8 이미지는 손 가장자리 선이지, 손과 바 사이에 새로 생긴 빈 구멍이 아니다. 엉덩이는 안장에 붙어 있고, 이동이 어깨보다 작다. 안장 위로 뜬 틈은 차이 이미지에 없다.

스트립 9장은 한 회전(75 rpm, 0.8 s) 동안 다리·페달 위치가 바뀐다. 상체 좌우 롤은 스트립을 나란히 봐도 정지 합본과 같이 작다. 롤의 근거는 뒤 시점 차이 이미지와 위 픽셀 이동이다.

## W3 성능

`apps/web` 에서 한 번에 하나. Chromium 149.0.7827.55 headless, Node v24.5.0, 1280×800, `gpuPath=default`. SwiftShader 로 넘어가지 않았다.

| 회차 | 명령 환경 | 벽시계 | `meta.at` (UTC) |
|---|---|---:|---|
| 켬 | `RTW_BENCH_BASE=http://localhost:5050` `RTW_BENCH_OUT=w3-sway-on` `RTW_BENCH_MODEL=rider14` `RTW_BENCH_EXTRA` 없음 | 757 s | 2026-10-15T17:43:31.379Z |
| 끔 | 위와 같고 `RTW_BENCH_EXTRA=&sway=0` `RTW_BENCH_OUT=w3-sway-off` | 758 s | 2026-10-15T17:56:17.046Z |

로그에 `base=http://localhost:5050`, 켬 `extra=` 비어 있음, 끔 `extra=&sway=0`. 자산은 둘 다 `20261015-212136-df8de090` 의 `rider.glb` 245,420 B + `guide-weights.json` 230,334 B.

1명당 드로우콜·삼각형은 4줌 모두 켬·끔이 같고, 3명 차분과 1명 차분이 같다. 드로우콜 14, 삼각형 29,604.

| 줌 | 1명당 드로우콜 | 1명당 삼각형 | ms/rider 켬 | ms/rider 끔 | 켬÷끔−1 | 자세 비율 켬 | 자세 비율 끔 |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 22 | 14 | 29,604 | 0.9326 | 0.9419 | −1.0% | 83.8% | 83.1% |
| 19 | 14 | 29,604 | 0.9204 | 0.9317 | −1.2% | 83.7% | 84.3% |
| 17 | 14 | 29,604 | 0.1246 | 0.1172 | +6.3% | 0% | 0% |
| 15 | 14 | 29,604 | 0.1156 | 0.1179 | −2.0% | 0% | 0% |

프레임당 ms (3명): 켬 z22 2.7979 · z19 2.7612 · z17 0.3737 · z15 0.3467. 끔 2.8258 · 2.795 · 0.3517 · 0.3538.

첫 표시 (ms): 켬 3662 / 3423 / 3349, 중앙값 3422.9. 끔 3434 / 3344 / 3460, 중앙값 3433.9.

원시 파일:

- `C:\20.HDev\boxcycle-sway\apps\web\scripts\rider-preserve\.out\rider14\w3-sway-on\bench.json`
- `C:\20.HDev\boxcycle-sway\apps\web\scripts\rider-preserve\.out\rider14\w3-sway-off\bench.json`

GW3 숫자: 드로우콜은 14 로 같다. ms/rider 는 z22·z19·z15 에서 켬이 끔보다 짧다. z17 만 +6.3% (0.1172 → 0.1246, 차 0.0074 ms) 로 5% 를 넘는다. z17·z15 는 자세 계산 0% 다. 합격 판정은 Supervisor.

## 범위

- 캡처·벤치 보조 스크립트는 `.out/sway/w2/` (`capture-w2.mjs`, `analyze-w2.mjs`, `rear-clip.json`). gitignore 라 커밋 대상이 아니다.
- 실제 앱 주행 화면 캡처는 이 지시에 없다.
- commit · push · 배포 하지 않음.
