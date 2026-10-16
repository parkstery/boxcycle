# 결과 P2a — 모델 프로필 · meshopt 디코더 · Float32 변환 · 후보 레지스트리

| 항목 | 내용 |
|---|---|
| 지시 | `02-task-p2a.md` (계획 `01-plan.md` §5.2–§5.4, 감리 `04-review-p0.md` 운영 지적 준수) |
| 담당 | Developer — OpenCode Muse Spark |
| 작업 위치 | `C:\20.HDev\boxcycle-rider14` (브랜치 `rider14-replace`) |
| 일자 | 2026-10-15 (KST) |
| candidateId | `20261015-212136-df8de090` (`03-result-p1.md`에서 읽음) |

## 0. 요약

- `riderModelProfile.ts` 신규(s5 현행 그대로 + rider14 `<그룹>__<재질>` 규칙).
- `preservedRiderRig.ts`: 생성자에 `profile` 추가, 이름 의존 4곳을 프로필 호출로 교체, `bakeFloat32Attributes` export 후 clone 직후 적용.
- `config.ts`: `PRESERVED_RIDER_MODELS` 레지스트리 + `PRESERVED_RIDER_ACTIVE_MODEL = "s5"` 유지 + DEV 전용 `?riderModel=` 전환. 제품 기본값 s5 불변.
- `riderPreservedLayer.ts`: `setMeshoptDecoder(MeshoptDecoder)` + 프로필 선택 생성. 렌더 루프·`setVisualKind` 문자열 불변.
- 신규 시험 11개(기존 3개 포함 총 14개) 전부 통과. 계약 시험 5/5 통과. `tsc`·`eslint` exit 0.
- 브라우저 캡처 2장: s5 213/rider, rider14 **14/rider**(29,604 tri) — 둘 다 `loadState=ready`, 콘솔 오류 0.
- 앱 기본값은 계속 s5. rider14 쪽 3명 전원이 주황(동행색 미적용)은 지시된 정상 상태(컬러 키트는 P2b).

## 1. 변경 파일 (`git diff --stat` + 신규)

```text
 apps/web/src/lib/map/riderPreservedLayer.ts        |   8 +-
 apps/web/src/lib/riderPrototype/config.ts          |  25 +++++-
 apps/web/src/lib/riderPrototype/preservedRiderRig.ts | 100 ++++++++++-----------
 3 files changed, 75 insertions(+), 58 deletions(-)
```

신규(untracked, 줄 수 실측):

| 파일 | 줄 |
|---|---:|
| `apps/web/src/lib/riderPrototype/riderModelProfile.ts` | 141 |
| `apps/web/scripts/rider-preserve/rider-model-profile.test.ts` | 185 |
| `apps/web/scripts/rider-preserve/rider-float32-bake.test.ts` | 109 |
| `apps/web/scripts/rider-preserve/rider-glb-test-loader.ts` (시험 전용 GLB 로더) | 119 |
| `apps/web/scripts/rider-preserve/fixtures/s5-groups.json` (734af62 기준선) | 247 |

구현 중 발견해 고친 것(리그 수학 무관):

1. rig 가 bake 하는 `clone = new Mesh(...)` 은 userData 를 물려받지 않아 rider14 `pedalBind`/`guideMesh` extras 가 소실됐다. 원본 `item.userData` 를 clone 에 `Object.assign` 으로 옮긴다(읽기 전용 복사).
2. Node bare 실행(`--experimental-strip-types`, `--import` 없음)에서 rig 의 값 임포트 `./riderVisualKit` 이 해석되지 않았다. 해당 한 줄만 `./riderVisualKit.ts` 로 명시한다(`import type` 2건은 소거되므로 그대로). tsc(`allowImportingTsExtensions`)·Vite·eslint 모두 통과.
3. `guideKeyOf(name, side, mesh?)` 의 extras 단언은 리그 호출 패턴(다리와 같은 side 로만 조회)에서는 정상이지만, 반대 side 로 조회하면 extras 와 달라 예외가 된다. 시험은 리그와 같은 패턴(legR→R, legL→L, 그 외는 양쪽 null 단언)으로 조회한다.

금지 준수: 리그 수학·`RIG` 관절 좌표·`FOOT_PITCH_DEG` 불변, `ACTIVE_MODEL` 은 `"s5"`, `MapView.tsx`·`riderDomMarkers.ts`·`riderDetailLod.ts`·`riderVisualKit.ts`·`rider-perf-bench.run.mjs` 미수정, 기존 시험 미완화, commit·push·`npm install` 없음.

## 2. 검증 명령 (`apps/web` 기준, 전부 포그라운드·종료 대기)

| # | 명령 | exit | 요약 |
|---|---|---:|---|
| 1 | `npx tsc --noEmit -p tsconfig.app.json` | 0 | 출력 없음 |
| 2 | `npx eslint src/lib/riderPrototype src/lib/map/riderPreservedLayer.ts scripts/rider-preserve` | 0 | 출력 없음 |
| 3 | `node --test scripts/rider-preserve/preserved-layer-contract.test.mjs` | 0 | tests 5, pass 5, fail 0 |
| 4 | `node --experimental-strip-types --test scripts/rider-preserve/rider-visual-kit.test.ts scripts/rider-preserve/rider-model-profile.test.ts scripts/rider-preserve/rider-float32-bake.test.ts` | 0 | tests 14, pass 14, fail 0 (신규 11 + 기존 3) |
| 5 | `npm run test:quick` | 1 | 합계 통과 1079 · 실패 3 — 실패 3건은 `route` 묶음 `route-token/production-surface.test.mjs` 3개 서브테스트, 원인 `functions/lib/index.harness.js` 없음(ENOENT, functions 미빌드). rider 코드 참조 없음(아래 §5). `ride` 묶음(신규 시험 포함)은 통과 711 · 실패 0 |

## 3. 시험 개수

- `rider-model-profile.test.ts` 6개: ① 메시 14개·그룹 분포(static 1, legR 3, legL 3, wheelRear 1, wheelFront 1, crank 1, pedalR 1, pedalL 1, footR 1, footL 1) ② pedalBind R/L ±1e-6 ③ guide 키 2·thighOnly 2·sock 2 ④ `unknown__X` 예외·extras 제거 장면 예외 ⑤ s5 fixture 일치(아래) ⑥ 양쪽 리그 생성 + `setPhase(0.25)` 전 정점 유한.
- `rider-float32-bake.test.ts` 5개: ① 정규화 Int16 + 스케일·이동 → 1e-5 이내·`Float32Array` ② 이미 Float32 면 동일 객체 유지 ③ rider14 다리 메시 bake 월드 좌표 = 미변환 계산값 1e-6 이내 ④ 미변환 `applyMatrix4` 깨짐 재현(three 동작 변경 감지용) ⑤ rig 전체 14메시 position·normal Float32 비정규화.
- `rider-visual-kit.test.ts` 3개(기존, 그대로 통과).

## 4. 옮기기 전후 s5 그룹 비교

- fixture `fixtures/s5-groups.json` 은 `git show 734af62:...preservedRiderRig.ts` 텍스트에서 `RIG.groups` 리터럴과 `groupForName` 폴백 정규식 3개를 추출해 만든 분류기로 s5 GLB 를 판정한 것(추출 검증: 그룹 9종·폴백 3종 일치).
- 결과: **메시 213개(고유명 213), 신 프로필 판정과 213/213 일치.** 그룹별 개수: `static 75, bike 38, legL 3, legR 3, wheelRear 41, crank 7, wheelFront 30, pedalR 2, pedalL 2, footR 6, footL 6`. s5 `pedalBind` 는 옮기기 전 값과 1e-9 이내(R/L 모두).
- 지시서에는 "210 메시 노드"로 적혀 있으나 실측(옮기기 전 코드·신 코드 동일)은 **213**이다. 구 코드도 213을 내므로 회귀가 아니라 표기 차이로 기록한다.

## 5. 브라우저 확인 (Supervisor dev 서버 `http://localhost:5040` 그대로 사용, 새로 띄우거나 끄지 않음)

- 실행기: 임시 스크립트 `scripts/rider-preserve/.out/rider14/p2a/capture-p2a.mjs` (git 미추적 `.out` 아래, `rider-perf-bench.run.mjs` 미수정). Chromium 149 headless, GPU 기본 경로, 1280×800, `?animate=0&zoom=22`, 60프레임 측정.
- 프로세스 확인: 5040 = worktree(`boxcycle-rider14`) vite(PID 26964). 본 작업트리(`boxcycle`) vite(PID 40520)는 건드리지 않음. `127.0.0.1:5040` 미사용(P0 감리 지적 준수).

| 모델 | loadState | 1명당 드로우콜 (from3 / from1) | 1명당 tri | 콘솔 오류 |
|---|---|---:|---:|---|
| s5 (기본) | ready | 213 / 213 | 53,514 / 53,514 | 없음 |
| rider14 (`&riderModel=rider14`) | ready | **14 / 14** | **29,604 / 29,604** | 없음 |

- 캡처: `.out/rider14/p2a/s5-z22.png`, `.out/rider14/p2a/rider14-z22.png` (원시값 `p2a-captures.json`).
- rider14 캡처에 라이더 3명이 정상 자세(안장·페달)로 그려진다. 3명 모두 주황인 것은 컬러 키트 미이식 상태의 정상 결과(P2b 범위)다.
- rider14 tri 29,604 = 계획 §0 LOD0 값과 일치. s5 213/53,514 = P0 기준선·Supervisor 재측정값과 일치.

## 6. 경고 출력 사실 (지시 §5 요구 기록)

- rider14 GLB 는 Node 에서 `GLTFLoader.parse` 가 `self is not defined`(팔레트 PNG 이미지 로드 경로)로 실패하므로, 시험 전용 로더가 `images/textures/samplers` + 머티리얼 텍스처 참조를 지운 사본으로 재parse 한다. 이때 `[rider-test] ... texture is null after strip fallback (allowed)` 경고를 출력한다(시험 1회 실행당 rider14 로드 횟수만큼, s5 는 해당 없음).
- 노드명·extras(`pedalBind`·`guideMesh`·`palette.colorSlots`)·정점 속성은 사본에서도 그대로 유지됨을 시험이 단언한다.

## 7. 남은 문제

1. `test:quick` route 실패 3건 = `functions` 미빌드(환경 전제) — P2a 범위 밖, 손대지 않고 기록만 한다. P0 결과에는 `test:quick` 기준선이 없어 대조 대신 원인·무관함을 적시한다.
2. 지시서 "210 메시 노드" 표기와 실측 213의 차이(§4) — 감리 확인 요청.
3. rider14 동행색 미적용(주황 고정) — P2b에서 팔레트 키트로 해결 예정. 이번 지시대로 앱 기본값 s5이므로 제품 화면 변화 없음.
