# 지도 이정표 인수·회귀 확인

2026-11-20, 수행 agent: Codex. 실행 폴더 `C:\20.HDev\boxcycle`.

**11-22 상태 정정:** 이정표·FINISH·축하 동작은 후속 `542d04cb`로 커밋·배포됐다. 아래는 11-20 인수 당시 기록이며 당시 미커밋/미배포 표현을 현행 상태로 읽지 않는다. 반복 렌더링 제보의 원인과 실기기 검증은 여전히 미확정이다.

## 기준과 범위(인수 당시)

시작 시 AGENTS.md, HANDOFF, README의 「다른 계정의 Codex에 인계」와 `02b-result-codex.md`를 확인했다. `node scripts/handoff-check.mjs` 통과. `git status --short --branch`는 `main2`, `origin/main2` 대비 ahead 1, HEAD `6c308458`이었다. 초기 변경은 수정 31개·비추적 47개였다. 운영 자동 종료·구간 저장의 배포 기준은 기존 기록의 `9ff9b78f`이며 이번에 운영 배포를 다시 수행하거나 검증하지 않았다.

미커밋 이정표 코드와 자산은 이 폴더에 모두 있다. 새 복제본에서는 다음 비추적 파일이 없을 수 있으므로 원래 작업 폴더 또는 별도 커밋이 필요하다.

| 구분 | 파일 (`apps/web/` 기준) | 동작 |
|---|---|---|
| 신규 | `src/lib/route/rideMilestones.ts` | 전체 경로 ¼·HALF·¾·FINISH 위치·방향, 재개·거리 보정·희소 샘플 처리 |
| 신규 | `src/components/map/useRideMilestoneMap.ts`, `rideMilestone.css` | 120m 전 표시, FINISH 180m 전 표시, 통과 펄스 1,150ms, 재개 시 지난 지점 생략 |
| 신규 | `src/lib/map/rideMilestoneLayer.ts` | Three.js 게이트·거리 라벨·피니시 카메라·축하 라이더, 지도 스타일 교체 재부착·자원 해제 |
| 신규 | `public/rider/celebration/rider15-gestures.glb` | 927,208 bytes, GLB v2, `Celebrate_Open` 클립 존재(헤더·JSON 확인) |
| 수정 | `src/App.tsx`, `src/components/map/MapView.tsx` | 거리·시작 오프셋 전달, 완주 연출 동안 지도 주행 상태 유지·결과창 표시 지연 |
| 수정 | `src/features/ride-feedback/useRideArrivalAutoEnd.ts` | 경로 도착 즉시 종료, 조건이 맞으면 2,750ms 완주 연출; 모션 감소·탭 숨김 대응 |
| 수정 | `src/lib/map/layerOrder.ts`, `src/lib/riderPrototype/preservedRiderRig.ts` | 이정표 rank 890, 축하 자산용 visualKit 없는 자원 해제 허용 |
| 시험 | `scripts/geo/ride-milestones.test.ts`(신규), `scripts/map/ride-terrain-lifecycle.test.mjs`, `e2e/quick-interval-end-cut.spec.ts` | 거리·통과·재개, 완주 연출 뒤 3D 해제, ¼·HALF 표시 및 통과 후 제거 |

이정표는 간편 인터벌 전용이 아니라 경로가 있는 주행에 연결돼 있다. FINISH 연출은 **경로 끝에 도착할 때**의 동작이며, 간편 인터벌이 경로 중간에서 프로그램을 마치면 기존 자동 종료·구간 저장으로 끝난다.

`App.tsx`의 거리 부족 안내(`IntervalRouteHint`, `useIntervalRouteHint`, 25km/h 판정)와 시작 3D ON은 별도 변경이다. 표고 timeout·RPM·센서 UI·문서·도구 변경도 별도이며 모두 보존했다. 이정표만 커밋할 경우 App의 혼합 hunk와 신규 GLB·CSS·hook 누락을 주의해야 한다. 제품 코드·시험 코드는 이번 인수에서 수정하지 않았다. 커밋·푸시·배포도 하지 않았다.

## 검증

작업 위치는 아래 명령에서 변경한다.

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
node scripts/ride-verify/verify-selectors.mjs
node scripts/test-quick.mjs route map
node ../../node_modules/typescript/bin/tsc -b --pretty false
```

- 진입 셀렉터 계약: 21/21 통과.
- 경로·지도 회귀: route 194, map 180, 합계 374 통과·실패 0. 이정표 단위 시험 3개와 지도 수명주기 시험 포함. 실행기가 에뮬레이터·전체 하네스 7파일을 제외하며, 미등록 `interval-route-hint` 폴더 경고를 출력한다.
- 타입 검사: 루트에 설치된 TypeScript 경로로 통과. 최초 `node node_modules/typescript/bin/tsc ...` 시도는 apps/web 아래 모듈이 없어 실패했으며 위 경로로 바로잡았다.
- 추가 인터벌·종료 정북·카메라·라이더 회귀: 261 통과·실패 0·skip 0. 로그 `tmp/milestone-handoff-regression-20261120.log`.

```powershell
$testFiles=Get-ChildItem scripts/ride-interval,scripts/ride-end-north-up,scripts/ride-camera-framing,scripts/rider-preserve -File | Where-Object { $_.Name -Match '\.test\.(ts|mjs)$' -and $_.Name -NotMatch '\.emulator\.' } | ForEach-Object FullName
node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test --test-reporter=spec @testFiles
```

첫 추가 회귀 실행에는 `interval-workout-firestore.emulator.test.mjs`를 잘못 포함해 1파일 실패했다. 이 파일은 시작 시 `FIRESTORE_EMULATOR_HOST`를 필수 검사한다. 에뮬레이터 전용 파일을 제외한 위 명령은 통과했다. 이 전용 저장소·Rules 시험은 이번에 올바른 환경으로 재실행하지 않았다.

E2E는 **4/4 통과·실패 0**(Playwright 4.2분, 에뮬레이터 포함 전체 약 307초). 800×360 Chromium에서 ¼·HALF 표시/제거, 간편 인터벌 자동 종료·실제 구간 저장, 수동 종료·실제 구간 저장, 일반 경로 교체 후 인터벌 완료에도 계속 주행을 확인했다. 저장 검증은 에뮬레이터 문서의 완주 상태·좌표·거리·Ride 계획 거리를 검사한다. `ride-verify` 스킬의 셀렉터 계약→격리 E2E 순서를 적용했다.

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
$env:PATH=(Join-Path (Get-Location) 'node_modules/.bin')+';'+(Join-Path (Get-Location) '../../node_modules/.bin')+';'+$env:PATH
$env:RTW_DEV_PORT='5201'
node scripts/e2e/run-with-deadline.mjs --limit-sec 480 -- node scripts/e2e/run-with-functions-emulator.mjs 'playwright test quick-interval-end-cut --workers=1 --retries=0'
```

결과는 `apps/web/playwright-report/`, `apps/web/test-results/.last-run.json`, 결과 캡처는 `tmp/quick-interval-end-cut/`에 있다. 전용 Vite 5201과 이번에 띄운 에뮬레이터는 래퍼가 종료했다. 실행 초반 일부 Functions의 `Failed to load function`, 지도 스타일 재로딩 중 `Style is not done loading`, ActivityWorld 경고가 있었다. 관련 사용자 동작 4개는 통과했지만 로그가 깨끗한 것으로 판정하지 않는다. 별도 원인 수정은 하지 않았다.

## 검증 한계와 실기기

- 기존 이정표 E2E는 ¼·HALF 라벨의 표시와 제거를 확인한다. ¾·FINISH의 WebGL 외형, 축하 동작, 완주 카메라·결과창 지연, 모션 감소·탭 숨김·스타일 교체 시각 품질을 끝까지 검증하는 E2E는 없다. 단위 시험·정적 확인을 시각 검증으로 간주하지 않는다.
- 실폰 가로 화면과 실물 케이던스 센서 연결·끊김·재연결은 이전 인계부터 **확인 대기**, 이번에도 미실행이다. 페달 확인 시간·추정 kcal·실제 소비 열량 비교는 확인하지 않았다.
- 운영 확인 주소: `https://boxcycle-dc2df.web.app/`. INT → 간편 인터벌 → 출발지 선택(필요 시) → 경로 표시 → 주행 시작 → 프로그램 완료 자동 종료 → 「내 경로로 저장」 → 사용자 정보 「인터벌 기록」 수행·기간 조회 순으로 확인한다. 운영에는 이번 미커밋 이정표가 배포되지 않았다.
- 기존 로컬 Vite `http://127.0.0.1:5199/`(PID 41576)는 보존했다. 이 서버의 실폰 접근·Firebase 연결 대상은 이번에 검증하지 않았다.

## 후속 오류 제보 조사 (11-20)

Chief가 FINISH 게이트를 보려고 도착 직전에 **직접 일시정지**한 화면을 제보했다. 정지 상태·결과창 미표시를 자동 종료 실패로 해석하지 않는다. 제보한 콘솔 메시지는 로그인 팝업의 COOP `window.closed`/`window.close` 메시지와 React `Maximum update depth exceeded`이다. 실제 수정 대상 후보는 후자의 반복 렌더링이며, 현재 스택의 `client:510`은 Vite 콘솔 중계 위치라 제품의 setState 호출 위치를 특정하지 못한다. COOP 설정이나 도착 거리 조건은 변경하지 않았다.

후속 조사에서는 `e2e/quick-interval-end-cut.spec.ts`에 FINISH 접근 → 일시정지 → 재개 → 결과창 사례와 최대 업데이트 깊이 오류 스택 수집을 추가했다. 기존 beforeEach의 출발지 안내가 빠르게 제거되는 경우 `not.toHaveText`가 요소 부재로 실패하던 대기를, 요소 제거도 허용하는 poll로 보완했다.

- 첫 시험: 안내 요소가 이미 제거된 상태의 대기 실패. 로그 `tmp/milestone-finish-error-e2e.log`.
- 두 번째·세 번째 시험: 주행 버튼 자동 숨김/지도 클릭 가로채기 및 숨은 버튼 포커스 대기에서 실패. 반복 렌더링 오류 재현 성공으로 보지 않는다. 로그 `tmp/milestone-finish-error-e2e-r2.log`, `-r3.log`.
- 기존 `ride-controls-autohide.spec.ts`의 `body[data-ride-controls="hidden"]` 계약에 맞춰 숨김일 때만 지도 탭으로 깨우도록 시험을 보완했다.
- 타입 검사는 후속 시험 추가 뒤에도 통과했다.
- 네 번째 시험: **1/1 통과**(Playwright 1.6분, 전체 약 137초). FINISH 접근·일시정지·재개·도착 결과창을 확인했고 수집된 `Maximum update depth`는 0건이었다. 로그 `tmp/milestone-finish-error-e2e-r4.log`. `test-results/.last-run.json`도 passed이다. 앞의 실패 3건을 통과로 바꿔 기록하지 않는다. 기존 4개 사례는 이번 후속 조사에서 다시 돌리지 않았다.
- 실행 명령은 위 E2E 명령에서 `--grep FINISH`를 추가한 `playwright test quick-interval-end-cut --grep FINISH --workers=1 --retries=0`이다.
- 실제 5199 화면에는 새로고침 없이 console.error의 호출 스택을 수집하는 Console 코드와 최초 발생 시점을 요청했다. 에뮬레이터의 새 Guest·단독 주행으로 통과했으며, Chief의 기존 로그인 세션·실제 Trail 상태를 동일하게 재현한 것은 아니다. 따라서 **제보한 반복 렌더링의 원인은 미확정·제품 수정은 미실행**이다. 실제 호출 스택이 확보되면 해당 effect/상태 갱신을 다음 조사 지점으로 삼는다. 푸시·배포 없음.
