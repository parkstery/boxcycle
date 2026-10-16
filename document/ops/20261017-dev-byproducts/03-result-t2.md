# 결과 T2 — 측정·조절 패널을 운영 기본 번들에서 분리

| 항목 | 내용 |
|---|---|
| 수행 | Developer — Cursor Agent |
| 판정 | 구현·검증까지 완료. commit·push·배포 없음 |
| 브랜치 | `chore/dev-byproducts` |

## 설계

세 패널은 `DevLabPanels`에서 `React.lazy` + `Suspense(fallback=null)`이다. 각 스위치가 켜진 패널만 렌더하므로, 꺼진 패널의 import는 시작하지 않는다.

| 스위치 | 판정 위치 | 기본 청크 | 별도 청크 |
|---|---|---|---|
| `?perflab=1` | `perfLabFacade.ts`의 `isPerfLabEnabled` | 판정 + 빈 함수 | 패널, `perfLabRuntime`, 계측(`frameBreakdownProbe` 청크에 perfLab·jitter·render cost가 합쳐짐) |
| `?camlab=1` | 기존 `rideCameraLab.ts` | 카메라 추종이 쓰는 getter·상태 | 패널 UI만 |
| `?lightlab=1` | 새 `riderLightLabSwitch.ts` | 쿼리 판정만 | 패널과 프리셋·저장(`riderLightLab.ts`) |

perflab 창구(`perfLabFacade.ts`)는 제품 경로가 부르는 함수를 `export let`으로 둔다. 꺼져 있으면 그 바인딩이 빈 함수라서 매 프레임 비용은 호출 1회다. `measureRiderRenderFrame`·`measureRiderPose`의 빈 구현은 콜백은 그대로 실행한다. `?perflab=1`일 때만 `perfLabRuntime.ts`를 동적 import 하고, 도착하면 바인딩을 실제 함수로 바꾼다. 그 전에 지도에 붙여 둔 `attachMapRenderProbe`는 도착 뒤 한 번 다시 붙인다. 청크가 오기 전의 프레임 기록은 버린다. import 실패는 삼킨다.

시험은 계측 모듈을 그대로 직접 import 한다. 시험 파일은 수정하지 않았다.

## 변경 파일

| 파일 | 내용 |
|---|---|
| `apps/web/src/lib/debug/perfLabFacade.ts` | 새 창구 |
| `apps/web/src/lib/debug/perfLabRuntime.ts` | 동적 import 진입 |
| `apps/web/src/components/devLabs/DevLabPanels.tsx` | lazy 패널 3개 |
| `apps/web/src/lib/riderPrototype/riderLightLabSwitch.ts` | lightlab 쿼리 판정 |
| `apps/web/src/lib/riderPrototype/riderLightLab.ts` | 판정을 스위치 파일에서 다시 export |
| `apps/web/src/App.tsx` | 정적 패널 3개 → `DevLabPanels` |
| `apps/web/src/main.tsx` | Profiler 콜백을 창구로 |
| `apps/web/src/components/map/MapView.tsx` | jitter·프레임 분해를 창구로 |
| `apps/web/src/lib/map/riderPreservedLayer.ts` | 렌더 비용 계측을 창구로 |
| `apps/web/dep-layers.json` | `perfLabFacade.ts`, `perfLabRuntime.ts` |

`riderLightLabSwitch.ts`는 `riderPrototype/` 접두 배정이라 파일명 나열은 하지 않았다.

## 번들 비교

Vite 크기(소수점 kB). 전은 T1 결과의 단일 기본 청크.

| 청크 | 전 | 후 |
|---|---:|---:|
| `index-*.js` | 3,731.24 | 3,692.28 |
| `jsx-runtime-*.js` | (index 안) | 8.44, `index.html`이 modulepreload. 실험실 문구 없음 |
| `frameBreakdownProbe-*.js` | — | 16.04 |
| `PerfLabPanel-*.js` + css | — | 10.04 + 2.14 |
| `RiderLightLabPanel-*.js` + css | — | 3.79 + 2.28 |
| `RideCameraLabPanel-*.js` + css | — | 3.25 + 2.40 |
| `perfLabRuntime-*.js` | — | 0.32 |

Rolldown은 `webpackChunkName` 주석을 쓰지 않고 모듈 이름으로 청크를 나눴다. 항상 받는 JS는 index + jsx-runtime = 3,700.72 kB이다.

문자열 위치(토큰 없는 최종 빌드, `node`로 `includes` 확인):

| 문구 | `index-*.js` | 있는 청크 |
|---|---|---|
| `결과 복사`, `성능 펼치기`, `프레임(ms)` | 없음 | `PerfLabPanel-*.js` |
| `캠 조절` | 없음 | `RideCameraLabPanel-*.js` |
| `조명 조절판` | 없음 | `RiderLightLabPanel-*.js` |

## 동작 확인

브라우저 1개(Playwright Chromium, headless). `vite preview --port 5070 --strictPort`. 지도가 뜨도록 확인 빌드 직전에만 `C:\20.HDev\boxcycle\apps\web\.env`를 worktree `apps/web/.env`로 복사했다. 확인이 끝난 뒤 그 복사본을 지웠고, 토큰이 dist에 남지 않도록 `.env` 없이 다시 빌드했다. 포트 5070 LISTENING 없음.

| 주소 | 결과 |
|---|---|
| 쿼리 없음 | 패널 0. perflab·camlab·lightlab·runtime·probe 청크 요청 0 |
| `?perflab=1` | `[data-perflab-panel]` 보임. 요청: `perfLabRuntime`, `frameBreakdownProbe`, `PerfLabPanel` js·css. 펼친 뒤 채워진 줄: fps `14`, 프레임(ms) `66.70 83.40 166.60`, `>33 99%`, 틱 `1.02 1.60`, 본인·카메라·동행·페이서·마커·스펙·동기·이름·나머지, 지도 `5.79 7.20`, 지도자체, React `0.0/s · 0.00`, LoAF, 합 간격. `—`로 남은 줄: `라이더(ms) — — 자세 —`(명 0, 주행 없음), `떨림 —`. GPU는 헤드리스 SwiftShader에서 `미지원` |
| `?camlab=1` | `캠 조절` 보임. 요청은 camlab js·css만 |
| `?lightlab=1` | `조명 조절판` 보임. 요청은 lightlab js·css만 |

지도 `5.79`가 나왔다는 것은 런타임 청크가 도착한 뒤 `attachMapRenderProbe`가 연결됐다는 뜻이다.

## 시험

| 명령 | 결과 |
|---|---|
| `apps/web` `npx tsc -b` | 0. 이어서 `npm run build`의 `tsc -b`도 0 |
| 변경 파일 `npx eslint` | 오류 0. 경고 15는 `App.tsx`·`MapView.tsx`의 기존 react-hooks 경고. 새 파일 경고 없음 |
| 루트 `node scripts/check-dep-direction.mjs --check` | exit 2. M0 「lib 파일 전원 도메인 지정」은 PASS(0건). 실패는 깨진 경로 1건: `scripts/route-token/route-token-onboarding-grant.test.mjs` → `functions/lib/routeTokenCore.js` (worktree에 `functions/lib` 없음). 도메인 위반 목록은 M0에서 중단되어 나오지 않음. 이번 새 파일은 debug(방향 검사 제외)와 `riderPrototype/` |
| 루트 `npm run test:quick` | 통과 1217 · 실패 5. route 3 = `functions/lib` 모듈 없음(보인 스택: `functions/lib/harnessAc...`). map 2 = Mapbox 토큰 공백(`mapbox-token-per-mode.test.ts`). 지시의 worktree 환경 실패와 같음 |
| `apps/web` `npm run test:rider-preserve` | 통과 57 + 계약 6, 실패 0 |
| `npm run build` | 0. 기존 `SADDLE`·`PELVIS` import 경고는 이번 변경 밖 |

## 미해결

- `check-dep-direction --check` 전체 exit 0은 `functions/lib`가 없어서 불가. T2 파일의 도메인 미지정은 없다.
- `?perflab=1`이 아니면 계측 청크를 받지 않는다. 그래서 `vite dev`에서도 쿼리 없이는 `window.__rtwRiderCost`가 설치되지 않는다. 운영 빌드(`import.meta.env.DEV === false`)는 원래도 쿼리 없으면 콜백만 실행했다.
- 주행이 없어 라이더(ms)·떨림은 `—`이다. 헤드리스 GPU 타이머는 `미지원`이다.
- commit·push·배포하지 않았다.
