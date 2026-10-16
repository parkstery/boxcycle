# 결과 L1 — LOD2 스테이징·정적 메시·원거리 전환 + 시험

| 항목 | 내용 |
|------|------|
| 작성 | 2026-10-16 · Developer (Cursor Agent CLI) |
| 지시 | [02-task-l1.md](02-task-l1.md) |
| 계획 | [01-plan.md](01-plan.md) §2.1–2.4 |
| 작업 위치 | `C:\20.HDev\boxcycle-lod` · 브랜치 `feat/rider14-lod2` |
| 판정 | 구현·지정 검증 완료. commit · push · 배포 하지 않음. 브라우저 확인은 L2. |

## 변경 파일

| 파일 | 줄 |
|------|----|
| `apps/web/scripts/rider-preserve/stage-rider14-lod2.mjs` | 신규 116 |
| `apps/web/src/lib/riderPrototype/preservedRiderStatic.ts` | 신규 74 |
| `apps/web/scripts/rider-preserve/rider-lod2.test.ts` | 신규 170 |
| `apps/web/public/rider/preserved/candidates/20261015-212136-df8de090/rider-lod2.glb` | 신규 63,424 B |
| `apps/web/public/.../candidate.json` | +5 / −2 |
| `apps/web/src/lib/map/riderPreservedLayer.ts` | +58 / −4 |
| `apps/web/src/lib/rider/riderDetailLod.ts` | +8 |
| `apps/web/src/lib/riderPrototype/config.ts` | +4 / −2 |
| `apps/web/scripts/rider-preserve/rider-glb-test-loader.ts` | +4 / −4 |
| `apps/web/scripts/rider-preserve/rider-perf-bench.ts` | +4 |
| `apps/web/scripts/rider-preserve/rider-perf-bench.html` | +1 |
| `apps/web/scripts/rider-preserve/preserved-layer-contract.test.mjs` | +5 |
| `apps/web/package.json` | `test:rider-preserve` 에 `rider-lod2.test.ts` 추가 (+1 / −1) |

`preservedRiderRig.ts` · LOD0 `rider.glb` · s5 자산은 diff 없음.

## 스테이징

원본 `…\out\rider_s6_LOD2_meshopt.glb`.

| 실행 | exit | 결과 |
|------|------|------|
| `node stage-rider14-lod2.mjs --source "<원본>"` 1회 | 0 | 복사·`candidate.json` 기록 |
| 같은 인자 2회 | 1 | `target exists, refusing to overwrite: …\rider-lod2.glb` |

| 해시 | 값 |
|------|----|
| `lod2SourceSha256` | `14c5956eb3a461e87c1e86df095be877e9e2645cbd3216ea55a0e8d3f5c10668` |
| `lod2StagedSha256` | 동일 |
| 파일 크기 | 63,424 B |

`files.lod2` = `rider-lod2.glb`. 기존 필드·키 순서는 유지했다. 2회차에서 만든 파일은 없다(거부 시점이 복사 전).

## 검증

작업 디렉터리 `apps/web`. PowerShell, 포그라운드.

| 명령 | exit | 요약 |
|------|------|------|
| `npx tsc --noEmit -p tsconfig.app.json` | 0 | 진단 없음 |
| `npx eslint` (아래 7파일) | 0 | 진단 없음 |
| `npm run test:rider-preserve` | 0 | TS 42 통과, 계약 mjs 6 통과. 실패 0 |
| `node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/ride-hierarchy/rider-detail-lod-contract.test.ts` | 0 | 7 통과. 실패 0 |
| `npm run build` | 0 | `dist/assets/index-COHOzn_2.js` |

eslint 대상: `preservedRiderStatic.ts`, `config.ts`, `riderDetailLod.ts`, `riderPreservedLayer.ts`, `rider-perf-bench.ts`, `rider-lod2.test.ts`, `rider-glb-test-loader.ts`.

시험 개수: 기존 TS 37 + 신규 5 + 계약 6 = **48 통과**. 신규 5는 스테이징 1, 정적 메시 1, 키트 1, `shouldUseRiderLod2` 진리표 1(4칸), dispose 1. 자세 LOD 계약 7은 위 48에 별도다.

빌드 산출 `dist/rider/preserved/candidates/20261015-212136-df8de090/rider-lod2.glb` 존재. SHA 동일, 63,424 B.

`npm run build` 로그의 `riderRig.ts` `SADDLE`·`PELVIS` import 경고는 이번 변경 파일이 아니다. dev 서버는 띄우지 않았다.

## 구현 중 판단

**`shouldUseRiderLod2` 위치.** `src/lib/rider/riderDetailLod.ts` 에 두었다. 줌으로 자세를 풀지 말지를 이미 이 파일이 정하고, 레이어와 자세 LOD 계약이 여기를 본다. `riderPrototype/riderDetailLod.ts` 를 새로 두면 같은 규칙이 두 모듈로 갈린다.

**bake.** `bakeFloat32Attributes` 는 리그에서 그대로 import 했다. 공용 모듈로 빼지 않아 리그 파일은 안 바뀌었다.

**`candidate.json` 기록.** `JSON.stringify` 는 줄바꿈을 LF 로 다시 써서 기존 CRLF 전체를 바꾼다. 그래서 `guideWeights` 줄 뒤에 `files.lod2` 를 넣고, 루트 끝에 해시 두 줄을 끼웠다. 기존 키 순서·값은 그대로다.

**그리기.** 라이더 루프 안에서 `useLod2` 이면 리그를 숨기고 정적 메시에 `setVisualKind`, 아니면 그 반대. `setPhase`·흔들림·lean·행렬은 기존 줄 그대로다. `useLod2` 는 `animatePose === false` 일 때만이라 흔들림 `enabled` 가 꺼지고, envelope 이 0 으로 가면서 `bikeRoll` 도 0 이 된다. 별도 분기는 없다.

**로드.** LOD0 `loadState = "ready"` 다음에 LOD2 를 받는다. 실패는 `lod2State = "error"` 와 DEV `console.warn` 만 하고 리그는 유지한다. s5 에는 `lod2` 가 없어 `lod2State` 는 `"none"` 이다. 벤치 패널에만 `lod2` 한 줄을 넣었다.

**키트 시험.** Node 에는 캔버스가 없어 `RiderPaletteKit.injectKitTextureForTests("peer", …)` 로 키트 텍스처를 넣었다. `peer` 면 그 텍스처, `self` 면 원본 map 이다.

## 남은 문제

- L2 육안·성능(줌 17·15 드로우콜 1, 줌 19·22 는 14, 경계에서 다리 자세가 바뀌는지)은 하지 않았다.
- 줌 19 경계 히스테리시스는 넣지 않았다. 계획 기본값은 없음.
