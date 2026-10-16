# 지시 L1 — LOD2 스테이징·정적 메시·원거리 전환 + 시험

| 항목 | 내용 |
|---|---|
| 발행 | 2026-10-16 · Supervisor (Claude) |
| 대상 | Developer — Cursor Agent CLI |
| 계획 | [01-plan.md](01-plan.md) — **먼저 전부 읽을 것** |
| 작업 위치 | `C:\20.HDev\boxcycle-lod` (브랜치 `feat/rider14-lod2`). 본 작업트리 `C:\20.HDev\boxcycle` 는 읽기만 |
| 결과 파일 | `C:\20.HDev\boxcycle-lod\document\ops\20261016-rider14-lod2\03-result-l1.md` |

## 1. 스테이징 (계획 §2.1)

- 원본(읽기 전용): `C:\Users\kdrea\OneDrive\Documents\img\helmet_fix\revision\20260919-natural_joint_skin\20261015_01-s6-poly-drawcall-reduction\out\rider_s6_LOD2_meshopt.glb` — 기대 SHA `14c5956eb3a461e87c1e86df095be877e9e2645cbd3216ea55a0e8d3f5c10668`.
- `apps/web/scripts/rider-preserve/stage-rider14-lod2.mjs`(신규, Node 내장만): 원본 해시 검증 → 대상 `candidates/20261015-212136-df8de090/rider-lod2.glb` 가 이미 있으면 거부 → `copyFileSync` → 사후 해시 → `candidate.json` 에 `files.lod2`, `lod2SourceSha256`, `lod2StagedSha256` 추가(기존 필드·키 순서 보존, 2칸 들여쓰기). 실패 시 만든 파일만 지운다.
- 한 번 실행하고, 같은 인자로 다시 실행해 거부되는지 확인.
- 계약 시험 `preserved-layer-contract.test.mjs` 의 활성 후보 시험에 "`files.lod2` 가 있으면 그 파일 SHA = `lod2StagedSha256` = `lod2SourceSha256`" 단언을 추가.

## 2. 코드 (계획 §2.2–2.4)

1. `config.ts`: `PRESERVED_RIDER_MODELS.rider14` 에 `lod2: "rider-lod2.glb"`. `preservedRiderAssetUrl` 의 파일명 유니온에 `"rider-lod2.glb"` 추가.
2. `riderPrototype/preservedRiderStatic.ts`(신규): `class PreservedRiderStatic { readonly object: Group; constructor(source: Object3D, profile: RiderModelProfile); setVisualKind(kind); dispose(); }` — bake 는 리그와 같은 함수(`bakeFloat32Attributes`)를 재사용(필요하면 공용 모듈로 빼되 리그 동작 불변).
3. `riderPrototype/riderDetailLod.ts` 또는 새 순수 함수: `shouldUseRiderLod2(lod2Ready: boolean, animatePose: boolean): boolean` — `lod2Ready && !animatePose`.
4. `map/riderPreservedLayer.ts`:
   - LOD0 로드가 `ready` 가 된 뒤, 모델에 `lod2` 가 있으면 백그라운드로 LOD2 로드(같은 `GLTFLoader` + `MeshoptDecoder`, `generation` 검사). 성공 시 `PreservedRiderStatic` 을 `riderRoot` 에 추가(처음엔 숨김). 실패는 DEV `console.warn` 만, 상태는 LOD0 유지.
   - 그리기 루프에서 라이더마다 `useLod2` 면 리그 `object.visible = false`, 정적 `object.visible = true`, `static.setVisualKind(kind)`; 아니면 반대. 그 외 행렬·lean·흔들림 처리는 지금 그대로(LOD2 일 때 흔들림 envelope 은 0 이므로 `bikeRoll` 도 0).
   - `onRemove`/교체 시 정적 메시도 `dispose`.
   - 계약 시험이 찾는 문자열(`for (const spec of this.specs)`, `rig.setPhase(spec.phaseRev ?? 0)`, `rig.setVisualKind(spec.kind ?? "self")`, `queryTerrainElevation`, `90 - spec.bearingDeg`, `spec.leanDeg`) 유지. `riderDetailLod` 계약 시험(`scripts/ride-hierarchy/rider-detail-lod-contract.test.ts`)도 통과 유지.
   - 디버그 상태 `getDebugState()` 에 `lod2State: "none" | "loading" | "ready" | "error"` 추가(벤치·시험용).
5. 벤치 패널(`rider-perf-bench.ts`)에 `lod2State` 표시 한 줄(벤치 페이지만).

## 3. 시험 (`scripts/rider-preserve/rider-lod2.test.ts` 신규, `test:rider-preserve` 에 추가)

1. 스테이징: `rider-lod2.glb` SHA = 기대값, `candidate.json` 필드.
2. 정적 메시: 시험 로더로 LOD2 를 열어(`attachPaletteStubMap` 필요 시) `PreservedRiderStatic` 생성 → 메시 1개, 삼각형 5,648, 정점 6,644, position/normal 이 비정규화 Float32, bake 후 bbox 가 LOD0 리그 `setPhase(0)` 의 bbox 와 각 축 5 cm 이내(같은 자리·크기에 있음을 확인).
3. 키트: `setVisualKind("peer")` 후 머티리얼 map 이 원본이 아닌 키트 텍스처, `"self"` 면 원본(브라우저 캔버스가 없으면 키트 생성부를 시험에서 주입 — P3 §0 방식 참고).
4. 선택 규칙: `shouldUseRiderLod2` 진리표 4칸.
5. 해제: `dispose` 후 지오메트리·텍스처 dispose 이벤트.

## 4. 검증 (PowerShell, `apps/web`)

`npx tsc --noEmit -p tsconfig.app.json` · 변경 파일 eslint · `npm run test:rider-preserve` · `node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/ride-hierarchy/rider-detail-lod-contract.test.ts` · `npm run build` 후 `dist/rider/preserved/candidates/20261015-212136-df8de090/rider-lod2.glb` 존재.

브라우저 확인은 L2 에서. dev 서버가 꼭 필요하면 포트 **5060**, 끝나면 반드시 종료.

## 결과 파일

변경 파일·줄 수, 명령 exit code, 시험 개수, 스테이징 해시, 판단 사항, 남은 문제.

## 금지

리그 수학·흔들림 값 변경, LOD0 자산·s5 자산 변경, rider 작업 폴더 쓰기, 기존 시험 완화, commit · push · 배포 · `npm install`, 백그라운드 잔류.
