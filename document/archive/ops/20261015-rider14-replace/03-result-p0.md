# 결과 P0 — 현행 s5 라이더 기준선 측정 (P0-R1)

| 항목 | 내용 |
|---|---|
| 지시 | `02-task-p0.md` + 재지시 `02-task-p0-r1.md` |
| 작업 위치 | `C:\20.HDev\boxcycle-rider14` (worktree, 브랜치 `rider14-replace`) |
| 측정 방식 | 포그라운드 실행, 끝까지 대기 (백그라운드 사용 안 함) |
| 결과 파일 | `document/ops/20261015-rider14-replace/03-result-p0.md` (본 파일, 본 작업트리에 쓰는 유일한 파일) |

## 0. 재지시(P0-R1) 처리 요약

1. `buildResult`·`savePartial` 선언 위치: 디스크상 파일에서 이미 측정 루프보다 앞(106·125행 → 루프 131행)에 있어 TDZ가 성립하지 않음. `node --check` 통과. 코드를 옮길 필요가 없어 다른 로직 변경 없이 둠.
2. 재시도 규칙 보완 완료: `isGpuFailure()` 분류기를 추가해 WebGL 컨텍스트 생성 실패·`CONTEXT_LOST`·흰 화면 패턴(`/webgl|CONTEXT_LOST|context lost|lost context|failed to create.*context|gpu process|ANGLE|EGL|D3D|white|blank/i`)일 때만 SwiftShader로 재시도하고, 그 밖의 예외는 즉시 실패 종료한다. 이번 측정에서 이 규칙이 실제로 동작했다(§8-c).
3. 기존 `.out/rider14/p0/` 의 `z22.png`·`z19.png`를 삭제하고 bench.json 없이 4개 줌을 처음부터 측정했다.
4. 측정은 전부 포그라운드로 실행하고 종료까지 대기했다(1차 실행 exit 1 → 원인 해소 후 2차 실행 exit 0).
5. dev 서버: P0 1차의 5040 vite(08:45 기동)가 측정 중 사망한 것을 확인하고, 동일 명령(`npx vite --port 5040 --strictPort`, cwd `apps/web`)으로 재기동해 이어서 측정했다. 측정 종료 후 **5040 vite(43488)와 그 부모 체인(cmd 35088 → npx 37376)만** 종료했다. 5000번 등 다른 포트 서버는 건드리지 않았다.

## 1. 환경

- Node: `v24.19.0` (bench.json meta 기록)
- Chromium: `149.0.7827.55` (Playwright headless shell, bench.json meta 기록)
- GPU 경로: **default** (`gpuPath=default`). SwiftShader 재시도 미사용. 창 1280×800, headless.
- base URL: `http://localhost:5040` (127.0.0.1:5040은 타 프로세스가 점유해 빈 응답 → 실행기의 기존 BASE 프로브가 localhost로 폴백. §8-g)
- 메모리: 총 16318 MB. 여유 5035 MB(1차 bench 기록 시점) → 5062 MB(최종 bench 기록 시점) → 7076 MB(서버 종료 후).
- 측정 스크립트: `apps/web/scripts/rider-preserve/rider-perf-bench.run.mjs`, bench 페이지: `rider-perf-bench.html/.ts` (감리 합격, 미수정)

## 2. 측정표 (줌 × 라이더 수, 각 120프레임 평균)

drawCallsPerFrame / trianglesPerFrame. 1명당 값은 `(3명−0명)/3` 과 `1명−0명` 두 방식 모두 기록(둘 다 일치).

| 줌 | 0명 dc/f | 1명 dc/f | 3명 dc/f | 1명당 dc (from3 / from1) | tri 0명 | tri 1명 | tri 3명 | 1명당 tri (from3 / from1) |
|---|---|---|---|---|---|---|---|---|
| 22 | 134 | 347 | 773 | 213 / 213 | 144088 | 197602 | 304630 | 53514 / 53514 |
| 19 | 225 | 438 | 864 | 213 / 213 | 104138 | 157652 | 264680 | 53514 / 53514 |
| 17 | 643 | 856 | 1282 | 213 / 213 | 198785 | 252299 | 359327 | 53514 / 53514 |
| 15 | 1316 | 1529 | 1955 | 213 / 213 | 436596 | 490110 | 597138 | 53514 / 53514 |

`__rtwRiderCost.read()` (riders=3, 240프레임):

| 줌 | frames | riders | totalMs | msPerFrame | msPerRider | maxFrameMs | poseMs | posePct | windowMs |
|---|---|---|---|---|---|---|---|---|---|
| 22 | 240 | 720 | 4257.6 | 17.74 | 5.9133 | 113.2 | 1528.7 | 35.9 | 71497 |
| 19 | 240 | 720 | 3857.6 | 16.0733 | 5.3578 | 55.3 | 1664.4 | 43.1 | 79111 |
| 17 | 240 | 720 | 1706.7 | 7.1112 | 2.3704 | 95.2 | 0 | 0 | 127433 |
| 15 | 240 | 720 | 2165.2 | 9.0217 | 3.0072 | 41.7 | 0 | 0 | 171125 |

원시값: `C:\20.HDev\boxcycle-rider14\apps\web\scripts\rider-preserve\.out\rider14\p0\bench.json` (bench.json은 git 미추적, `.out` 아래).

## 3. 자산

`window.__rtwBench.assets()` (URL에 `/rider/` 포함, 첫 페이지 기준):

| name | transferSize | encodedBodySize | decodedBodySize | duration(ms) |
|---|---|---|---|---|
| `http://localhost:5040/rider/preserved/candidates/20260921-041426-cd81398e/rider.glb` | 1753192 | 1752892 | 1752892 | 116.2 |
| `http://localhost:5040/rider/preserved/candidates/20260921-041426-cd81398e/guide-weights.json` | 230334 | 230034 | 230034 | 89.9 |
| `http://localhost:5040/src/lib/rider/riderDetailLod.ts` | 5917 | 5617 | 5617 | 30.9 |

(3번째 행은 URL에 `/rider/`가 들어간 dev 소스 파일이라 참고로 함께 기록. 실제 라이더 자산은 위 2건.)

디스크 크기: `rider.glb` 1752892 B, `guide-weights.json` 230034 B, `candidate.json` 956 B.

`state().firstReadyMs` (새 브라우저 컨텍스트 3회, 캐시 비활성, zoom=22·riders=3):

- 1회: 6835.9 ms, 2회: 6305.5 ms, 3회: 7621.8 ms → **중앙값 6835.9 ms**

## 4. 해시 (SHA-256) 와 대조

디렉터리: `apps/web/public/rider/preserved/candidates/20260921-041426-cd81398e/`

| 파일 | SHA-256 | 대조 |
|---|---|---|
| `rider.glb` | `1108aa3e37615eef037984a0cdf80018b840a043c6e62f6750f828646b6b1ffb` | `candidate.json` 안의 `stagedGlbSha256`와 **일치** |
| `guide-weights.json` | `136895c8d9b8bd29e47b0a53ac10a0f8443e93240eb2578330da0581ee840dca` | 기록 (대조 기준 없음) |
| `candidate.json` | `ec527e2be69a4fc4da65bad7da253e133944e68458187194730f39ef0eeffef2` | 기록 (대조 기준 없음) |

## 5. 기존 시험 기준선 (변경 없이 실행만, `apps/web` 기준)

| 명령 | exit code | 마지막 요약 |
|---|---|---|
| `npx tsc --noEmit -p tsconfig.app.json` | 0 | 출력 없음 (에러 없음) |
| `node --test scripts/rider-preserve/preserved-layer-contract.test.mjs` | 0 | tests 5, pass 5, fail 0 |
| `node --experimental-strip-types --test scripts/rider-preserve/rider-visual-kit.test.ts` | 0 | tests 3, pass 3, fail 0 |
| `npx eslint scripts/rider-preserve/rider-perf-bench.html scripts/rider-preserve/rider-perf-bench.ts scripts/rider-preserve/rider-perf-bench.run.mjs` | 0 | 0 errors. html 1 warning (“File ignored because no matching configuration”) |

실패 없음. 지시대로 고치지 않고 그대로 기록.

## 6. 캡처 4장 (animate=0, riders=3)

- `C:\20.HDev\boxcycle-rider14\apps\web\scripts\rider-preserve\.out\rider14\p0\z22.png` (109088 B)
- `C:\20.HDev\boxcycle-rider14\apps\web\scripts\rider-preserve\.out\rider14\p0\z19.png` (336743 B)
- `C:\20.HDev\boxcycle-rider14\apps\web\scripts\rider-preserve\.out\rider14\p0\z17.png` (859993 B)
- `C:\20.HDev\boxcycle-rider14\apps\web\scripts\rider-preserve\.out\rider14\p0\z15.png` (1023145 B)

## 7. 변경 파일 목록

`git -C C:\20.HDev\boxcycle-rider14 status --short` 출력 그대로 (측정 종료 후):

```text
?? apps/web/public/rider/preserved/candidates/20261015-212136-df8de090/
?? apps/web/scripts/rider-preserve/rider-perf-bench.html
?? apps/web/scripts/rider-preserve/rider-perf-bench.run.mjs
?? apps/web/scripts/rider-preserve/rider-perf-bench.ts
?? apps/web/scripts/rider-preserve/stage-rider14.mjs
```

- 본 지시에서 만든 것은 `rider-perf-bench.html`·`.ts`·`.run.mjs` 3파일(신규 허용 범위)뿐이다.
- `.run.mjs`에는 재지시 #2의 `isGpuFailure` 분류기 + 재시도 조건 변경만 들어 있다(감리 합격 판정된 html/.ts는 미수정).
- `stage-rider14.mjs`, `candidates/20261015-212136-df8de090/`는 본인이 만들지 않은 untracked 항목(타 작업 산출물로 추정)으로 손대지 않았다.
- `.out/rider14/p0/` (bench.json·png 4장)는 git 미추적이라 위 목록에 나타나지 않는다.

## 8. 이상·막힌 점

- a. 재지시 불합격 1(TDZ `savePartial`): 디스크상 파일은 `buildResult`(106행)·`savePartial`(125행)이 측정 루프(131행)보다 앞에 있어 TDZ가 성립하지 않고, `node --check`도 통과한다. P0 1차 종료 직전 09:04에 백그라운드 재실행 흔적(아래 b)이 있어 1차 세션 말미에 순서가 바로잡힌 것으로 추정된다. 지시 #1은 “이미 충족”으로 판정하고 선언부를 움직이지 않았다.
- b. P0 1차의 백그라운드 잔류 프로세스(09:04 기동: powershell 22964 → node 32772 → headless-shell 28112, SwiftShader 플래그 부착)를 발견하고, 지시 #3·#4에 따라 중지했다. 같은 outDir에 쓰면서 포그라운드 측정을 오염시킬 수 있었기 때문이다. 중지 후 png 2장을 삭제하고 bench.json 없이 22/19/17을 포그라운드에서 처음부터 다시 쟀다.
- c. 1차 포그라운드 실행에서 줌 22/19/17 측정 후 줌 15 `page.goto`가 `net::ERR_EMPTY_RESPONSE`로 실패했다. 새 재시도 규칙상 GPU 실패가 아니므로 SwiftShader 재시도 없이 즉시 실패 종료했고(exit 1), 부분결과(22/19/17 + firstReady 3회)는 bench.json에 보존됐다. 원인은 5040 vite(P0 1차의 08:45 기동분)가 사망한 것(프로세스 소멸 확인). 동일 명령으로 재기동한 뒤 재실행이 bench.json을 이어받아 줌 15만 측정하고 exit 0으로 끝났다. 4개 줌 모두 기본 GPU 경로·동일 조건이다.
- d. `poseMs`/`posePct`가 줌 15·17에서 0(0%), 줌 19·22에서 43.1%·35.9%로 갈린다. `__rtwRiderCost.read()` 값을 그대로 기록했으며 원인 분석은 범위 밖이라 하지 않았다.
- e. 1명당 드로우콜 213, 1명당 삼각형 53514가 4개 줌에서 완전히 동일하다. 수치 가공 없이 원시값 그대로 기록한다.
- f. `127.0.0.1:5040`은 10-05부터 존재하는 식별 불가 프로세스(PID 9652)가 점유해 빈 응답을 돌려준다. 실행기의 기존 BASE 프로브가 `localhost:5040`으로 폴백해 측정했다(bench.json `base` 기록). P5 비교 측정 때도 같은 조건(localhost)을 써야 한다.
- g. dev 서버 재기동 시 백그라운드 shell 1건이 “Port 5040 is already in use”(본 작업트리 아닌 `C:/20.HDev/boxcycle`의 vite 경로 표시) 오류로 끝났다는 알림이 왔으나, 실제로는 rider14 vite(43488)가 정상 기동·리스닝했고 프로브 200을 확인한 뒤 측정했다. 측정 종료 후 5040 체인을 전부 종료했고, 5040 리스너는 PID 9652만 남았다(vite/npx가 아니라 손대지 않음).
- h. 범위 밖 문제는 손대지 않고 위와 같이 기록만 한다. 앱 코드·기존 시험·검증기·`public/**` 수정 없음. commit·push·`npm install` 없음.
