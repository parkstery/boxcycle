# 결과 P6 — rider14 승격

| 항목 | 내용 |
|---|---|
| 지시 | [02-task-p6.md](02-task-p6.md) |
| 계획 | [01-plan.md](01-plan.md) §6 P6 · G6 · §9 롤백 |
| 감리 | [04-review-p5.md](04-review-p5.md) — 데스크톱 G5 통과, 실기기 1회만 남음. P6 범위 밖 |
| 작업자 | Developer (Cursor) |
| 작업 위치 | `C:\20.HDev\boxcycle-rider14` 브랜치 `rider14-replace` |
| 서버 | `http://localhost:5040` — 기존 dev 서버(pid 55392, `vite --port 5040 --strictPort`). 새로 띄우거나 끄지 않음 |
| commit · push · 배포 | 하지 않음 |

## 전환

제품 모델은 두 곳만 바꿨다.

1. `apps/web/src/lib/riderPrototype/config.ts`  
   `PRESERVED_RIDER_ACTIVE_MODEL` = `"rider14"`. 주석은 롤백 안내로 둠: 이 한 줄을 `"s5"` 로.
2. `apps/web/public/rider/preserved/candidates/20261015-212136-df8de090/candidate.json`  
   `status` = `"APP_APPROVED_PRODUCT_ACTIVE"`, `appApprovedAtKst` = `"2026-10-16"` (KST 날짜), `appApprovalTarget` = `"rider-perf-bench.html (P4 G4) + local app"`.  
   `rider.glb` · `guide-weights.json` 과 나머지 JSON 필드는 그대로.

s5 후보 `20260921-041426-cd81398e/` 는 파일을 바꾸지 않았다. `git status` 에 그 폴더는 나오지 않는다. s5 프로필 코드도 그대로다.

### 해시 (전환 후)

| 파일 | SHA-256 | 바이트 |
|---|---|---:|
| rider14 `rider.glb` | `df8de090b068f1a8734482ae5698bd578140b387fd3eb1947fd9839d5e4fe54d` | 245120 |
| rider14 `guide-weights.json` | `136895c8d9b8bd29e47b0a53ac10a0f8443e93240eb2578330da0581ee840dca` | 230034 |
| rider14 `candidate.json` | `8b8e911cf2b586960e30e1c3c75382c0358a41d9e4c667dd8d9a9b0db14c5d62` | 1113 |
| s5 `rider.glb` | `1108aa3e37615eef037984a0cdf80018b840a043c6e62f6750f828646b6b1ffb` | 1752892 |
| s5 `guide-weights.json` | `136895c8d9b8bd29e47b0a53ac10a0f8443e93240eb2578330da0581ee840dca` | 230034 |

rider14 GLB 해시는 `sourceGlbSha256` = `stagedGlbSha256`. 가이드 해시는 `guideRuntimeSha256`.

## 계약 시험

`apps/web/scripts/rider-preserve/preserved-layer-contract.test.mjs`

- 하드코딩된 활성 `candidateId` 를 없앰. `config.ts` 텍스트에서 `PRESERVED_RIDER_ACTIVE_MODEL` 과 `PRESERVED_RIDER_MODELS` 의 해당 `candidateId` 를 정규식으로 읽음.
- 그 값이 `rider14` / `20261015-212136-df8de090` 인지 단언.
- 활성 후보: `status === "APP_APPROVED_PRODUCT_ACTIVE"`, GLB SHA = `sourceGlbSha256` = `stagedGlbSha256`, 가이드 SHA = `guideRuntimeSha256`. `schemaVersion === 2` 이므로 `geometryEquivalentTo` = s5 ID `20260921-041426-cd81398e`, `rider14-equivalence.test.ts` 존재. (`schemaVersion === 1` 이면 `pedalReportSha256` 형식 단언은 분기로 남아 있음)
- 롤백 후보: 폴더와 `rider.glb` · `guide-weights.json` · `candidate.json` 존재, GLB SHA 를 `1108aa3e…` 로 고정.
- 제품 GLB 격리, MapView, 렌더 루프, 네임태그 시험은 문구 그대로.

## diff 요약

이번 지시에서 손댄 제품·시험 파일은 세 개다.

| 파일 | P6 변경 |
|---|---|
| `config.ts` | 활성 모델 `"s5"` → `"rider14"`, 롤백 주석 유지. HEAD 대비 `git diff --stat` 은 +25/−1 근처로 더 크다. P6 이전 작업트리의 모델 표가 포함된다 |
| `candidate.json` | 위 세 필드. 후보 폴더가 아직 untracked (`??`) 라 `git diff` 에는 안 잡힌다 |
| `preserved-layer-contract.test.mjs` | 위 계약. `git diff --stat` +59/−6 수준. 이 파일은 P6 전에 수정 목록에 없었다 |

s5 후보 폴더 diff 없음.

## 검사 (PowerShell, `apps/web`, 포그라운드, 한 번에 하나)

| 명령 | exit |
|---|---:|
| `npx tsc --noEmit -p tsconfig.app.json` | 0 |
| `npm run lint` | 1 |
| `npm run test:rider-preserve` | 0 |

`test:rider-preserve`: TS 25/25, 계약 6/6 (기존 5개 + s5 롤백 후보 1개). fail 0.

lint 실패는 P6 파일이 아니다. error 16개는 `scripts/ride-result/*.test.ts` 의 unused / `any`. warning 40개는 App·MapView 등 기존 훅 의존성. P6 diff 에 그 파일은 없다.

## 번들 (두 번 빌드)

둘 다 `npm run build` (`tsc -b && vite build`), exit 0. 로그:

- s5: `apps/web/scripts/rider-preserve/.out/rider14/p6/build-s5.log` — built in 1.96s
- rider14 (최종): `…/p6/build-rider14.log` — built in 1.66s

비교를 위해 활성 모델을 잠시 `"s5"` 로 두고 빌드한 뒤 다시 `"rider14"` 로 되돌렸다. 최종 소스 줄은 `"rider14"` 다. `dist/assets` JS 는 청크 1개.

| | s5 | rider14 | 차 |
|---|---:|---:|---:|
| JS 합계 (바이트) | 3,680,913 | 3,680,928 | +15 |
| 가장 큰 청크 | `index-B_sL_CY9.js` 3,680,913 | `index-CrSGmUCb.js` 3,680,928 | +15 |
| vite 표기 | 3,680.91 kB · gzip 1,034.66 kB | 3,680.92 kB · gzip 1,034.68 kB | gzip +0.02 kB |

두 후보 ID 는 `PRESERVED_RIDER_MODELS` 에 항상 들어 있어서, 활성 문자열만 바뀐 증가분이다. meshopt 디코더는 P2a 부터 번들에 있다. `main2` 대비 증가는 여기서 재지 않았다.

### `riderModel` (최종 dist)

`dist/assets/*.js` 에서 문자열 `riderModel` = **0건**. (`index-CrSGmUCb.js`)

### 빌드 경고 중 rider 관련 (두 빌드 동일)

`meshopt`, `rider-preserve` 경고는 없다.

1. `[IMPORT_IS_UNDEFINED]` `SADDLE` — `src/lib/riderPrototype/riderRig.geometry.mjs` 에 export 없음, `riderRig.ts:8`
2. 같은 경고 `PELVIS` — `riderRig.ts:11`

계획 §11.3 에 적힌 기존 경고다. 이번 범위에서 고치지 않았다.

rider 가 아닌 경고: 청크가 minify 후 500 kB 초과 (단일 `index-*.js`).

## 로컬 앱

에뮬레이터 e2e 는 돌리지 않았다. 기존 `http://localhost:5040/?lightlab=1` 에서 게스트 진입 → 센서 없음 → 입문 코스 → 주행 시작까지 한 브라우저로 끝났다. 서버를 추가로 띄우지 않았고, 끝난 뒤 `capture-app` 프로세스와 시험용 서버는 없다. 5040 listen 은 그대로다 (pid 55392).

스크립트: `apps/web/scripts/rider-preserve/.out/rider14/p6/capture-app.mjs`  
기록: `…/p6/capture-app.json` (error null)

네트워크 응답 (response listener):

| status | URL |
|---:|---|
| 200 | `http://localhost:5040/rider/preserved/candidates/20261015-212136-df8de090/rider.glb` |
| 200 | `http://localhost:5040/rider/preserved/candidates/20261015-212136-df8de090/guide-weights.json` |

같은 두 URL 이 카메라 2 전환 뒤에 한 번 더 200 으로 찍혔다. s5 후보 URL 은 없었다.

`performance.getEntriesByType("resource")` 를 주행 직후 한 번 걸러 본 목록은 비어 있다 (`performanceRiderUrls: []`). 위의 200 응답이 네트워크 기록이다.

`window.__rtwPacerDiag()` (dev): `enabled true`, `visible true`, `count 2`, `gaps` 약 −16.5 m · −18.0 m, `companionDelayMs` 0. 본인 + 페이서 2.

캡처:

- `apps/web/scripts/rider-preserve/.out/rider14/p6/app-after-entry.png` — 진입 후, 조명 조절판을 펼친 지구 뷰
- `apps/web/scripts/rider-preserve/.out/rider14/p6/app-riding-lightlab.png` — 주행 중, 카메라 2, 조명 조절판 펼침 (주변광 0.90, 반구광 1.20, 주광 1.60, 방위각 329°, 고도각 54°)

`npm run test:e2e:pacer` 는 실행하지 않았다. 5040 에서 페이서 2명까지 확인돼서, 에뮬레이터 서버를 대신 띄울 필요가 없었다.

## 롤백

`config.ts` 의 `PRESERVED_RIDER_ACTIVE_MODEL` 한 줄을 `"s5"` 로 되돌리면 s5 다. s5 후보 폴더와 s5 프로필 코드는 승격 후에도 그대로 있다 (계획 §9).

## 이상

- `npm run lint` exit 1. P6 파일 밖 기존 오류. 위 표.
- Resource Timing 의 rider URL 목록이 비었다. 네트워크 응답 200 과는 별개로 적는다.
- 번들 +15 B 는 활성 모델 문자열 차이만 반영한다. meshopt 디코더 크기는 이 두 빌드 비교에 들어 있지 않다.
