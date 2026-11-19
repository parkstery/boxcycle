# 스마트폰 3D 부담 — 네 가지 선행 조사

11-19 Chief 「1번 실행해」 후속: `rtwMapConfig.ts` 기본 DPR 상한 **2→1.5** 변경. 원래 DPR≤1.5 유지, 공통 상한이라 고해상도 PC에도 적용. 수동 maxdpr 비교 쿼리는 유지. 로컬 변경·미커밋·미배포. 상한/계측 회귀20/0, tsc·변경파일 ESLint·Vite build 통과(번들 크기 경고), diff 공백 검사 통과. 첫 시험 명령은 루트 폴더에서 경로를 잘못 지정해 미실행, apps/web에서 재실행해 통과. 브라우저 첫 관측은 계측 attached 대기15초 실패; 에뮬레이션 재설정·새로고침 후 직접 조회로 CSS800×360·DPR3에서 **기본1.5·canvas/GL1200×540** 확인. 폰 효과 미측정. 실행 폴더 `C:\20.HDev\boxcycle\apps\web`, 명령 `node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/map/rider-map-pixel-ratio-contract.test.ts scripts/rendering-diagnostics.test.ts scripts/perf-lab.test.ts`. 폰은 기존 운영 `https://boxcycle-dc2df.web.app/?maxdpr=1.5`로 동일 효과 즉시 비교 가능(새로고침, 이전값은 maxdpr=2). 새 기본값의 운영 반영은 아직 없음.

11-19 후속 구현: [전환 원인 기록·DPR/장면 분리 비교 도구](implementation.md). 아래 본문은 구현 전 선행 조사 기록이다.

수행: Codex, 2026-11-19. 제품 코드·설정·시험 코드 작성/수정 없음. 운영 PC 브라우저 관측, 기존 코드·과거 실측 기록 검토, 기존 시험만 실행. 스마트폰 연결이 없어 현재 문제 기기의 실측은 미완료.

## 판정

| 질문 | 확인 결과 | 증거의 범위 |
|---|---|---|
| maxdpr가 Mapbox WebGL에 적용되는가? | **예. 운영 사이트에서 캔버스와 실제 drawing buffer 크기 변화 확인.** | PC Chrome/GTX1660, DPR3 에뮬레이션. 스마트폰 GPU 에뮬레이션은 아님 |
| 현재 스마트폰 적용 DPR은? | **현재 값 미확인. 과거 Chief 폰 기록은 원래3/지도2.** | 2026-10-16 Adreno730. 현 기종·브라우저·URL·실측 필요 |
| 3D가 꺼지는 순간 Context Loss인가? | **미확인. 전환 자체는 Context Loss 없이도 발생하는 앱 정책.** | 현재 폰 사건 기록 없음. 기존 앱에 전환 순간의 loss/restored 이력 계측 없음 |
| 지형/건물/라이더 중 GPU 메모리·렌더 시간 최대는? | **순위 미확정. 기존 계측으로 GPU 메모리의 세 부분 분해 불가.** | 전체 GPU 시간/지도 CPU/라이더 CPU를 구분해야 함 |

## 1. DPR 실측

대상: `https://boxcycle-dc2df.web.app/`, 운영 진입 번들 `assets/index-B8Cpv81F.js`.
Ego 브라우저: Chrome156 Windows, ANGLE NVIDIA GeForce GTX1660 Direct3D11. CDP에서 CSS800×360·deviceScaleFactor3을 지정하고 새로고침. CSS 해상도 미디어쿼리로 native3 확인. WebGL2 `drawingBufferWidth/Height` 직접 조회.

| maxdpr | 페이지 JS DPR | CSS 크기 | 캔버스 크기 | WebGL drawing buffer |
|---|---:|---|---|---|
| 생략(기본2) | 2 | 800×360 | 1600×720 | 1600×720 |
| 1.5 | 1.5 | 800×360 | 1200×540 | 1200×540 |
| 1 | 1 | 800×360 | 800×360 | 800×360 |
| 4 | 약3 | 800×360 | 2400×1080 | 2400×1080 |

maxdpr는 목표 배율 강제가 아니라 **상한**이다. 기본 PC 실측 DPR1.25에서는 상한1.5/4 모두 약1.25로 유지된다. 정수 반올림 때문에 캔버스/CSS 비율에 작은 오차가 있을 수 있다.

설치된 mapbox-gl은3.23.1. `src/lib/map/rtwMapConfig.ts:252`가 지도 생성 전에 JS `window.devicePixelRatio` 접근자를 `min(원래DPR,상한)`으로 감싼다. 공식 Mapbox `pixelRatio` 옵션으로 적용하는 구조는 아니다. 재정의가 차단되면 적용 없이 진행하는 catch가 있으므로 모든 브라우저에서 성공한다고 일반화하지 않는다. 쿼리는 페이지 수명 동안 캐시되어 새로고침 필요.

`src/lib/map/riderPreservedLayer.ts:120`의 three.js 렌더러도 지도 canvas와 GL context를 공유한다. 별도 라이더용 고해상도 캔버스는 없다.

PC 기본 관측 context attributes는 antialias=false, depth=true, stencil=true. three.js 생성자에 antialias=true가 있더라도 이미 생성된 공유 컨텍스트가 실제 MSAA를 사용한다는 증거가 아니다.

## 2. 스마트폰 DPR 기록

`../20261016-map-cut/04-review-m2.md`에 Chief 폰 Adreno730·원래DPR3·mapPixelRatio2 확인 기록이 있다. 같은 기록의56.5fps는 그때의 코스·배포·카메라에 한정된다. 현재 폰 값으로 대체하지 않는다.

현재 `adb devices -l`은 연결 기기0개. 폰 기종/브라우저/연결 가능 여부를 비동기 질문했다. 현재 적용값은 폰의 `?perflab=1` 패널의 `지도Nx` 및 결과 JSON `device.mapPixelRatio`로 확인 가능하다. `device.devicePixelRatio`는 상한 전 원래DPR를 보고하도록 구현되어 있어 두 필드를 구분한다.

## 3. 자동 평면과 Context Loss

`src/components/map/rideTerrainGuard.ts`는250ms마다 지형 높이/카메라 시야를 관측한다. 지형 결측 또는 시야 가림이750ms 연속이면 자동 평면, 평면을 최소4초 유지하고2.5초 연속 정상이면 복귀(전환 직후1초 안정화)한다. GPU 시간·fps·메모리·Context Loss를 직접 조건으로 쓰지 않는다.

`MapView.tsx:3329`의 자동평면은 terrain exaggeration0 + 건물 제거이며 DEM/terrain 연결을 유지한다. 수동OFF는 terrain null. 따라서 자동2D 전환을 GPU 고장이나 GPU 자원 해제로 해석하면 안 된다. Context Loss가 지형 조회 실패에 영향을 줄 가능성까지 배제하는 것은 아니다.

현재 앱/패널에는 문제 순간 `webglcontextlost/restored`와 지형판정 원인을 함께 보존하는 기록이 없다. PC DPR 비교 시점의 `isContextLost()`는 모두false였지만, 스마트폰 꺼짐 순간을 관측한 결과는 아니다.

확정하려면 문제 폰에서 canvas의 loss/restored 이벤트와 `data-terrain-view`, terrain 배율, 지형 조회값, 시각을 함께 관측해야 한다. 복구 후 isContextLost=false 한 번만 읽어서는 이전 loss를 부정할 수 없다.

## 4. GPU 시간과 메모리

기존 `src/lib/debug/frameBreakdownProbe.ts:488`는 Mapbox `_render` 전체를 감싸며 GPU timer 지원 시4프레임마다 측정한다. 전체에는 라이더 커스텀 레이어도 포함된다. `riderRenderCostProbe.ts`의 라이더ms는 JS/CPU 구간 시간이며 라이더만의 GPU 시간이 아니다. `frame간격−JS`도 GPU 전용 시간이 아니라 프레임 스케줄링·합성 대기가 섞인 잔여다.

과거 Chief 폰 기록은 지도JS(라이더 제외)5.2ms, 라이더CPU2.2ms. 이것으로 지도 전체 CPU가 더 컸다는 당시 관측은 가능하지만 **지형/건물/라이더 GPU 순위**는 알 수 없다. 당시 폰의 GPU timer는 미지원이었다. 현재 지원 여부도 다시 확인해야 한다.

GPU 메모리 바이트를 지형/건물/라이더별로 집계하는 도구는 현재 앱에 없다. deviceMemory는 기기 RAM 참고값이며 GPU 메모리 사용량이 아니다. GLB 파일 크기/텍스처·메시 개수도 VRAM 사용량과 같지 않다. WebGL에 이 세 부분의 실제 물리GPU 메모리 사용량을 즉시 알려주는 표준 조회는 없으므로 버퍼·텍스처 할당량 추적/추정 및 필요한 경우 기기 도구가 필요하다.

향후 시간 비교는 동일 기기·경로·카메라·DPR·3D상태·라이더 수에서 초기 로딩을 제외하고 반복해야 한다. 지형OFF/건물OFF/라이더OFF 상태를 매 측정에서 실제 검증해야 한다. 특히 현재 mapcut에는 라이더OFF 키가 없고 자동평면도 terrain/building 상태를 바꾸므로, 쿼리 이름만 보고 분리 측정에 성공했다고 판정하면 안 된다. 레이어 visibility를 숨겨 얻는 시간 차이를 GPU 메모리 해제량으로 해석하지 않는다.

공식 근거: [MDN WebGL best practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices), [GPU timer](https://developer.mozilla.org/en-US/docs/Web/API/EXT_disjoint_timer_query), [context lost event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/webglcontextlost_event).

## 실행·검증

실행 폴더 `C:\20.HDev\boxcycle\apps\web`:

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/map/rider-map-pixel-ratio-contract.test.ts scripts/map/ride-terrain-guard.test.ts scripts/map/ride-terrain-lifecycle.test.mjs
```

**21통과/0실패.** 기존 정책·effect/fake-map 검증이며 문제 폰의 GPU 사건 재현 시험이 아니다. 운영 실제 WebGL DPR 관측은 위 표로 별도 구분. 폰 현재DPR/전환순간/컴포넌트GPU시간·VRAM 실측 미실행(기기 연결 없음). 제품 코드 변경이 없어 build/전체quick 미실행. 커밋/푸시/배포 없음.

확인 주소 `https://boxcycle-dc2df.web.app/?perflab=1`. 문제 폰에서 패널 펼침→기기/지도 배율→같은 코스·카메라에서 증상 재현→결과 복사. JSON만으로 과거 Context Loss 이력이나 컴포넌트VRAM 순위가 확정되지는 않는다.
