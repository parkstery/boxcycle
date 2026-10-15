# 결과 P2b — rider14 팔레트 컬러 키트 (self / peer / pacer)

| 항목 | 내용 |
|---|---|
| 지시 | `02-task-p2b.md` (계획 `01-plan.md` §5.5, 감리 `04-review-p2a.md`) |
| 담당 | Developer — OpenCode Muse Spark |
| 작업 위치 | `C:\20.HDev\boxcycle-rider14` (브랜치 `rider14-replace`) |
| 일자 | 2026-10-15 (KST) |
| 결과 파일 | 본 파일 (`03-result-p2b.md`, UTF-8) |

## 0. 요약

- §0 P2a 보정 4건 완료 (import 확장자 제거·`import.meta.env.DEV`·벤치 패널 candidate 표시·`test:rider-preserve` 스크립트).
- `riderVisualKit.ts` 에 순수 함수 3종(`linearToSrgb8`·`readPaletteSlots`·`paintPaletteKit`) 추가. 기존 export·동작 유지.
- `riderPaletteKit.ts` 신규: 팔레트 텍스처 교체 키트. self=원본 map, peer/pacer=최초 1회 생성 후 참조 교체.
- `RiderModelProfile.createVisualKit` 추가. s5=기존 이름 방식 래핑, rider14=팔레트 머티리얼 1개 확인 후 `RiderPaletteKit`.
- `PreservedRiderRig`: 생성자 끝에서 visualKit 생성, `setVisualKind` 위임, `dispose` 에 visualKit + **전 머티리얼 텍스처 sweep** 추가.
- 시험 19/19 + 계약 5/5 통과. `tsc`·`eslint` exit 0.
- 브라우저: rider14 세 라이더가 **주황(self)/청록(peer)/슬레이트(pacer)** 로 구분 렌더됨을 화면 픽셀 수치로 확인. s5 색상 변화 없음.

## 1. §0 P2a 보정 (지시서 순서대로)

1. `preservedRiderRig.ts`: `from "./riderVisualKit.ts"` → `from "./riderVisualKit"` (완료).
2. `config.ts`: `(import.meta as unknown as …).env?.DEV` → `import.meta.env.DEV` (완료).
3. `rider-perf-bench.ts` `refreshPanel`: 패널 첫 `<code>` 를 `PRESERVED_RIDER_MODELS[resolvePreservedRiderModel()]` 의 `nickname · candidateId` 로 갱신. 벤치 페이지의 다른 부분은 손대지 않음 (완료 — 브라우저에서 `s5 · 20260921-041426-cd81398e` / `rider14 · 20261015-212136-df8de090` 표시 확인, §4).
4. `apps/web/package.json` 에 `"test:rider-preserve"` 추가 (완료). Windows 글롭 미전개 대비 파일명 나열식으로 작성:
   `node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/rider-preserve/rider-visual-kit.test.ts scripts/rider-preserve/rider-model-profile.test.ts scripts/rider-preserve/rider-float32-bake.test.ts scripts/rider-preserve/rider-palette-kit.test.ts && node --test scripts/rider-preserve/preserved-layer-contract.test.mjs`

## 2. 변경 파일

추적 파일 diff (`git diff --stat`):

```text
 apps/web/package.json                              |   1 +
 apps/web/src/lib/riderPrototype/config.ts          |  (보정 1줄)
 apps/web/src/lib/riderPrototype/preservedRiderRig.ts | visualKit 연결 + dispose 텍스처 sweep
 apps/web/src/lib/riderPrototype/riderVisualKit.ts  | +104 (순수 함수 3종)
```

- `apps/web/src/lib/map/riderPreservedLayer.ts` 의 Modified 표시는 P2a 분량(meshopt 디코더·프로필 선택)이다. P2b 에서 이 파일은 손대지 않았고, `rig.setVisualKind(spec.kind ?? "self")` 문자열도 그대로다.

신규·수정(untracked 포함, 줄 수 실측):

| 파일 | 줄 | 내용 |
|---|---:|---|
| `apps/web/src/lib/riderPrototype/riderPaletteKit.ts` | 103 | 신규. `RiderPaletteKit.fromMaterial/apply/dispose` |
| `apps/web/src/lib/riderPrototype/riderModelProfile.ts` | 202 | `RiderVisualKit` 타입 + 양 프로필 `createVisualKit` |
| `apps/web/scripts/rider-preserve/rider-palette-kit.test.ts` | 281 | 신규. 지시 시험 5항 |
| `apps/web/scripts/rider-preserve/rider-glb-test-loader.ts` | 151 | `attachPaletteStubMap` helper 추가 (아래) |
| `apps/web/scripts/rider-preserve/rider-model-profile.test.ts` | 205 | ⑥에 stub 호출 1줄 (서술 변경 없음) |
| `apps/web/scripts/rider-preserve/rider-float32-bake.test.ts` | 119 | 마지막 시험에 stub 호출 1줄 (서술 변경 없음) |
| `apps/web/scripts/rider-preserve/rider-perf-bench.ts` | 314 | 패널 candidate 표시만 (§1-3) |

구현 중 발견해 고친 것(지시 범위 내):

1. rider14 rig 생성은 이제 팔레트 머티리얼의 `map` 을 요구한다. Node 시험 로더는 팔레트 PNG 를 복원하지 못해 텍스처 참조를 제거하므로(`map=null`), 기존 시험 2건(`model-profile` ⑥·`float32-bake` 마지막)이 실패했다. 로더에 `attachPaletteStubMap(scene)` helper 를 두고 두 시험에서 호출한다. stub 은 128×16 빈 `DataTexture` 로, rig 생성(팔레트 머티리얼 1개 확인)·bake 검증까지만 쓴다. 실제 칸 색칠은 `rider-palette-kit.test.ts` 가 순수 함수 + 실 PNG 해독으로 검증한다. 기존 시험의 서술·단언은 그대로다.
2. `rider-perf-bench.ts` 는 `document.querySelector("#panel code)")` (패널 첫 `<code>`=candidate 칸)를 갱신한다. HTML 은 손대지 않았다.

금지 준수: 키트 색 상수 불변, 칸 좌표 하드코딩 없음(시험 기대값 제외), 셰이더 미수정, `PRESERVED_RIDER_ACTIVE_MODEL="s5"` 유지, commit·push·`npm install` 없음, 본 작업트리(`boxcycle`)에는 본 결과 파일만 쓴다.

## 3. 검증 명령 (`apps/web` 기준, 전부 포그라운드·종료 대기)

| # | 명령 | exit | 요약 |
|---|---|---:|---|
| 1 | `npx tsc --noEmit -p tsconfig.app.json` | 0 | 출력 없음 |
| 2 | `npx eslint src/lib/riderPrototype src/lib/map/riderPreservedLayer.ts scripts/rider-preserve` | 0 | 출력 없음 |
| 3 | `npm run test:rider-preserve` | 0 | 아래 §4. 첫 실행에서 기존 시험 1건 실패 → stub 보정 후 재실행 통과 (경위는 §2-1) |

## 4. 시험 개수

`npm run test:rider-preserve` = TS 시험 19개 + 계약(`.mjs`) 5개, 전량 통과:

- `rider-palette-kit.test.ts` 5개(신규): ① `linearToSrgb8` (0→0, 1→255, 0.2158605009317398→128, 0.0031308 경계 양쪽 연속, 음수→0, >1→255) ② `paintPaletteKit` (128×16 균일 입력에 peer: 두 칸 128픽셀만 변경·나머지 1,920픽셀 바이트 동일·입력 불변) ③ self/peer/pacer 각 칸 = 키트 선형값의 `linearToSrgb8` 정확 일치 ④ 실 GLB JSON `palette.colorSlots` → `readPaletteSlots` 통과(`{helmet:{x:0,y:0,w:8,h:8}, jersey:{x:8,y:0,w:8,h:8}}`), 형식 틀린 입력 3종(null·`{}`·칸 필드 누락) 예외 ⑤ 내장 `palette_basecolor` PNG 를 `zlib` 직접 해독(IHDR 128×16·RGBA8 확인, 필터 0–4 처리) → helmet·jersey 8 모서리 픽셀 `[255,128,0,255]` 확인 + `paintPaletteKit(…, "self")` 결과와 칸 바이트 동일 (self=원본 map 그대로의 근거).
- `rider-visual-kit.test.ts` 3개: **수정 없이** 통과.
- `rider-model-profile.test.ts` 6개 + `rider-float32-bake.test.ts` 5개: 통과 (stub 호출만 추가, 단언 불변).
- `preserved-layer-contract.test.mjs` 5개: 통과.

## 5. 브라우저 확인 (dev 서버 `http://localhost:5040` 그대로 사용, 재시작 없음)

- 실행기: 임시 스크립트 `apps/web/scripts/rider-preserve/.out/rider14/p2b/capture-p2b.mjs` (git 미추적 `.out` 아래). Chromium headless, 1280×800, `?animate=0&zoom=22`, 60프레임 측정. 프로세스 확인: 5040 = worktree vite (P2a 와 동일 PID 26964 계열). 본 작업트리 vite 는 건드리지 않음.
- 캡처: `.out/rider14/p2b/s5-z22.png`, `.out/rider14/p2b/rider14-z22.png` (원시값 `p2b-captures.json`).

| 모델 | loadState | 패널 candidate 표시 | 1명당 드로우콜 | 1명당 tri | 콘솔 오류 |
|---|---|---|---:|---:|---|
| s5 (기본) | ready | `s5 · 20260921-041426-cd81398e` | 213 / 213 | 53,514 / 53,514 | 없음 |
| rider14 | ready | `rider14 · 20261015-212136-df8de090` | 14 / 14 | 29,604 / 29,604 | 없음 |

세 라이더 색 구분 (동일 카메라·동일 위상이므로 좌표 직접 대조, 화면 픽셀 실측):

- self: 양쪽 모두 주황. s5-주황 픽셀 805개 중 r14 에서도 주황인 것 797개(차이는 형상 스무딩 경계, 색 회귀 아님). 예 `(656,300)` s5=`[186,104,47]` r14=`[168,92,33]`.
- peer(동행): 양쪽 모두 청록. r14 동행 저지 594픽셀 청록. 동일 좌표 대조 예 `(437,286)` r14=`[80,141,142]` s5=`[82,142,142]`, `(440,287)` r14=`[88,152,153]` s5=`[89,152,153]` — 머티리얼 `color` 방식(s5)과 팔레트 텍스처 방식(rider14)이 같은 선형값을 가리키므로 렌더값이 ±3 이내로 일치한다.
- pacer(페이서): 양쪽 모두 슬레이트. 페이서 영역(x300–390, y232–330) 저채도 픽셀 평균이 s5=`[144,147,147]`·r14=`[145,147,147]`로 일치하고, 샘플 10점 좌표·값이 바이트 동일하다. 예 `(303,235)` 양쪽 `[184,184,178]`.
- 판정: **rider14 세 라이더가 주황/청록/슬레이트로 구분된다.** P2a 의 "3명 모두 주황" 회귀가 해소됐다.
- `?riderModel=s5` 쪽은 기존 키트 경로(`createVisualKit` 이 `applyRiderVisualKit` 래핑)를 그대로 타며, 주황/청록/슬레이트 배치가 P2a 캡처와 같다. P0 수치(213콜·53,514tri)와도 일치한다.

보조 검증 (같은 `.out` 아래 임시 스크립트, 화면 판단이 아닌 수치 대조용):

- `palette-debug.html` (+ Playwright 판독): 실 rider14 GLB 를 브라우저에서 열어 `fromMaterial` → 원본 슬롯 픽셀 `[255,128,0,255]` 확인 → `apply("peer")` 후 텍스처 helmet `(77,150,147)`·jersey `(69,181,175)`·비대상 칸 `(36,40,44)` 유지, `colorSpace=srgb·Nearest/Nearest·mipmaps=false·flipY=false·wrap=원본(1001/1001)` 확인 → peer 재적용은 동일 텍스처(참조 교체만) → `apply("self")` 원본 복귀 → `dispose` 정상. rig 전체 경로(`new PreservedRiderRig` + `setVisualKind` peer/pacer/self)도 동일 결과. 콘솔 오류 0.
- 판독 과정에서 착각 1건을 바로잡음: 전 화면 색 집계에서 s5 샷에도 청록(155px)이 보여 키트 미적용으로 의심했으나, 이는 s5 동행의 기존 청록(구 키트 정상 동작)이었다. 동일 좌표 대조로 해소하고 본문에 수치로 기록했다.

## 6. 남은 문제

1. `rider-palette-kit` 의 페이서 슬레이트는 지도 배경(회색 도로·건물)과 hue 가 가까워 전 화면 자동 집계로는 분리되지 않는다. 이번에는 페이서 실루엣 영역 + s5 대조로 확인했다. P4 픽셀 샘플 게이트에서는 동행·페이서 실루엣을 `riders=1/2/3` 차분(`capture-riders12.mjs`·`locate-riders.mjs` 패턴)으로 먼저 특정할 것을 권장한다.
2. `test:quick` 전체 실행은 P2b 에서 돌리지 않았다(P2a 에서 rider 무관 route 3건 실패를 확인済. 필요하면 P6 에서 functions 빌드 후 재확인).
3. 임시 스크립트·캡처·원시 JSON 은 `apps/web/scripts/rider-preserve/.out/rider14/p2b/` 아래에 두었다(gitignore 대상, 커밋 안 됨): `capture-p2b.mjs`·`p2b-captures.json`·`s5-z22.png`·`rider14-z22.png`·`rider14-riders1.png`·`rider14-riders2.png`·`palette-debug.html`·분석용 `dump-band`·`probe-*`·`diff-shots`·`locate-riders`·`census-colors.mjs`.
