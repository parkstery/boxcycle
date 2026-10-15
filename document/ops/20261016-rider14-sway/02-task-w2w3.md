# 지시 W2·W3 — 흔들림 비교 캡처 + 성능

| 항목 | 내용 |
|---|---|
| 발행 | 2026-10-16 · Supervisor (Claude) |
| 대상 | Developer — Cursor Agent CLI |
| 계획 | [01-plan.md](01-plan.md) §3 W2·W3 |
| 작업 위치 | `C:\20.HDev\boxcycle-sway` |
| 결과 파일 | `C:\20.HDev\boxcycle-sway\document\ops\20261016-rider14-sway\03-result-w2w3.md` |

## 준비

- dev 서버를 **포트 5050** 으로 띄운다: `apps/web` 에서 `$env:RTW_DEV_PORT="5050"; npx vite --port 5050 --strictPort`. 끝나면 **반드시 종료**(그 vite·npx 만).
- 주소는 `http://localhost:5050/...` (127.0.0.1 금지).
- 브라우저는 한 번에 하나. 모든 측정 포그라운드.

## W2 비교 캡처 (기록용)

벤치 페이지 `scripts/rider-preserve/rider-perf-bench.html` 를 쓴다. 흔들림 끔은 `&sway=0`.

1. **위상 4점 정지 비교**: `animate=0&riders=1&zoom=22&pitch=78&bearing=0&phase=<0|90|180|270>` 을 `sway=0` 과 기본(켬)으로. 단 `animate=0` 이면 위상이 바뀌지 않아 envelope 이 0 이다 → 이 비교를 위해 벤치 페이지에 **`swayHold=1` 쿼리**를 추가해, 정지 위상에서도 흔들림을 envelope 1 로 보이게 한다. 방법: 벤치에서 `animate=0&swayHold=1` 일 때 매 프레임 위상을 `fixedPhase + 1e-9·(프레임 홀짝)` 처럼 아주 작게 흔들어 envelope 이 1 로 수렴하게 한다(앱 코드 수정 금지, 벤치 페이지만). 2 s 기다린 뒤 캡처.
   - 크롭·DPR 은 `apps/web/scripts/rider-preserve/.out/rider14/p4/capture-p4.mjs` 의 `phase-*` 항목(DPR 4, clip `{x:578,y:282,w:134,h:124}`)을 그대로 쓴다. 이 파일은 본 작업트리 `C:\20.HDev\boxcycle\apps\web\scripts\rider-preserve\.out\rider14\p4\` 에 있다 — 읽기만 하고 새 스크립트는 이 작업트리의 `.out/sway/w2/` 에 만든다.
   - 합본: 좌 끔 / 우 켬, `pair-phase-<n>.png`. 그리고 **차이 확대 이미지**(두 캡처의 픽셀 차 ×8)를 같이 만든다 — 흔들림이 작아 눈으로 구분이 어려우므로.
2. **정면(뒤) 시점 비교**: 좌우 롤이 가장 잘 보이는 뒤쪽 시점. `bearing=90`(라이더가 동쪽을 향하므로 뒤에서 봄), `pitch=70`, `zoom=22`, `riders=1`, 위상 0°/180° 두 점, 끔/켬. 라이더가 화면 어디에 있는지 전체 화면을 한 번 찍어 보고 크롭 범위를 정한다.
3. **움직임 기록**: 같은 뒤쪽 시점, `animate=1`, 켬. 0.8 s 동안 0.1 s 간격 9장(한 회전 ≈ 0.8 s @75 rpm)을 찍어 가로로 이은 `strip-rear.png`. 끔도 같은 방식으로 `strip-rear-off.png`.
4. 각 이미지에서 관찰: 어깨가 좌우로 움직이는지, 자전거가 반대로 기우는지(뒤쪽 시점에서 바퀴 수직선의 기울기), 손·엉덩이가 붙어 있는지.

## W3 성능

`rider-perf-bench.run.mjs` 를 그대로 쓴다(`RTW_BENCH_BASE=http://localhost:5050`).
1. `RTW_BENCH_OUT=w3-sway-on RTW_BENCH_MODEL=rider14`
2. 끔 비교용: 실행기에 환경변수 `RTW_BENCH_EXTRA`(있으면 URL 끝에 그대로 붙임) 하나만 추가해 `RTW_BENCH_EXTRA=&sway=0 RTW_BENCH_OUT=w3-sway-off` 실행.
3. 표: 줌별 1명당 드로우콜·삼각형·ms/rider·자세 비율, 첫 표시. GW3 기준 — 드로우콜 14 그대로, ms/rider 증가 ≤ 5%.

## 결과 파일

캡처·합본·차이·스트립 **전체 경로**, 관찰, W3 표, 벤치 변경 diff, 서버 종료 확인.

## 금지

`apps/web/src/**` 수정, 흔들림 값 변경, commit · push · 배포, 5040·5000 등 다른 포트 사용, 백그라운드 잔류.
