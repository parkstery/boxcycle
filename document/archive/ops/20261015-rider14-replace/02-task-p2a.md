# 지시 P2a — 모델 프로필 · meshopt 디코더 · Float32 변환 · 후보 레지스트리

| 항목 | 내용 |
|---|---|
| 발행 | 2026-10-15 · Supervisor (Claude) |
| 대상 | Developer — OpenCode Muse Spark |
| 선행 | P1 완료(rider14 candidateId 는 [03-result-p1.md](03-result-p1.md) 에서 읽는다) |
| 계획 | [01-plan.md §5.2–5.4](01-plan.md) |
| 작업 위치 | **`C:\20.HDev\boxcycle-rider14`** (브랜치 `rider14-replace`) |
| 결과 파일 | `C:\20.HDev\boxcycle\document\ops\20261015-rider14-replace\03-result-p2a.md` |

## 원칙

- **리그 수학(IK·DQS·발목표·관절 좌표·크랭크 위상/반경 계산식)은 한 글자도 바꾸지 않는다.** 바꾸는 것은 "이름으로 찾는 곳"과 "속성 형식"뿐이다.
- s5 동작은 완전히 그대로여야 한다(s5 프로필 = 현행 코드를 옮긴 것).
- 앱 기본값은 **계속 s5**. 이번 지시로 제품 화면이 바뀌면 안 된다.

## 1. `apps/web/src/lib/riderPrototype/riderModelProfile.ts` (신규)

```ts
export type RiderModelProfileId = "s5" | "rider14";
export type RiderRigGroup =
  | "crank" | "pedalR" | "pedalL" | "footR" | "footL"
  | "legR" | "legL" | "wheelFront" | "wheelRear" | "bike" | "static";
export type BakedMesh = { name: string; mesh: Mesh; geometry: BufferGeometry };
export interface RiderModelProfile {
  readonly id: RiderModelProfileId;
  groupOf(name: string): RiderRigGroup;
  pedalBind(baked: readonly BakedMesh[], side: "R" | "L"): [number, number, number];
  guideKeyOf(name: string, side: "R" | "L"): string | null; // guide-weights.json 키
  isThighOnly(name: string): boolean;
  isSock(name: string): boolean;
}
export function getRiderModelProfile(id: RiderModelProfileId): RiderModelProfile;
```

**s5 프로필** — `preservedRiderRig.ts` 의 현행 코드를 그대로 옮긴다:
- `RIG.groups` 목록 + `groupForName()` 정규식 → `groupOf`
- `centerOfNamedMeshes(baked, "Mesh_48" | "Mesh_52")` → `pedalBind`
- `GUIDE_MESH` (`"Right continuous knee skin"` / `"Left continuous knee skin"`): 이름이 같을 때만 그 키 반환
- `isThighOnly`: `Mesh_153` / `Mesh_163`
- `isSock`: `Mesh_156` / `Mesh_166` 또는 `/sock/i`

**rider14 프로필** — 노드명 `<그룹>__<재질>` 규칙:
- `groupOf`: `name.split("__")[0]`. `static`·`bike` → `"static"`. 나머지는 위 그룹명과 정확히 같아야 하며, **모르는 접두사는 예외**(조용히 static 으로 보내지 않는다).
- `pedalBind`: `pedal${side}` 그룹 메시의 `mesh.userData.pedalBind`(길이 3 숫자 배열). 없거나 2개 이상이면 예외. bbox 계산 금지.
- `guideKeyOf`: `legR__Material_5` → `"Right continuous knee skin"`, `legL__Material_5` → `"Left continuous knee skin"`. 또한 `mesh.userData.guideMesh` 가 있으면 같은 값인지 단언(다르면 예외) — 이를 위해 시그니처에 `mesh` 가 필요하면 `guideKeyOf(name, side, mesh?)` 로 넓혀도 된다.
- `isThighOnly`: `/^leg[RL]__Rider_black_shorts$/`
- `isSock`: `/^leg[RL]__Rider_black_socks$/`

## 2. `preservedRiderRig.ts`

- 생성자: `constructor(source: Object3D, guides: PreservedGuideData, profile: RiderModelProfile)`.
- `RIG.groups`·`groupForName`·`centerOfNamedMeshes`·`GUIDE_MESH` 의 **사용처**를 프로필 호출로 바꾸고, 정의는 프로필 파일로 옮긴다(`RIG` 의 관절·bb·hub 좌표는 그대로 남긴다).
- `proceduralWeights` 의 `draw.name === "Mesh_153" ...` / 양말 판정 → `profile.isThighOnly` / `profile.isSock`. `guideWeights` 의 메시 판정 → `profile.guideKeyOf`.
- **Float32 bake**: traverse 안에서 `geometry.clone()` 직후, `applyMatrix4` **전에** `position`·`normal` 을 Float32 로 바꾼다. 내보내는 함수로 분리:
  ```ts
  export function bakeFloat32Attributes(geometry: BufferGeometry): void
  ```
  `getX/getY/getZ`(정규화 해제·interleaved 모두 처리)로 읽어 `new BufferAttribute(new Float32Array(count*3), 3)` 로 `setAttribute`. 이미 비정규화 Float32 면 그대로 둔다. `uv` 등 다른 속성은 건드리지 않는다.

## 3. `config.ts` — 후보 레지스트리

```ts
export type PreservedRiderModelId = "s5" | "rider14";
export const PRESERVED_RIDER_MODELS = {
  s5:      { candidateId: "20260921-041426-cd81398e", profile: "s5",      nickname: "s5" },
  rider14: { candidateId: "20261015-212136-df8de090", profile: "rider14", nickname: "rider14" },
} as const;
/** 제품이 쓰는 모델. P6 승격 때 "rider14" 로 바꾼다. 롤백 = 이 한 줄. */
export const PRESERVED_RIDER_ACTIVE_MODEL: PreservedRiderModelId = "s5";
export function resolvePreservedRiderModel(): PreservedRiderModelId
```
- `resolvePreservedRiderModel`: **DEV 빌드에서만** URL 쿼리 `riderModel=s5|rider14` 가 있으면 그것, 아니면 `PRESERVED_RIDER_ACTIVE_MODEL`. 운영 빌드(`import.meta.env.DEV === false`)에서는 쿼리를 무시한다. `window` 가 없으면 기본값.
- `PRESERVED_RIDER_CANDIDATE_ID` 는 `PRESERVED_RIDER_MODELS[PRESERVED_RIDER_ACTIVE_MODEL].candidateId` 로 유지(기존 이름 보존).
- `preservedRiderAssetUrl(fileName)` 은 `resolvePreservedRiderModel()` 의 candidateId 를 쓴다. 경로 문자열 `rider/preserved/candidates` 는 그대로 둔다(계약 시험).

## 4. `map/riderPreservedLayer.ts`

- `import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";` 후 `loader.setMeshoptDecoder(MeshoptDecoder)` (s5 에도 무해).
- `new PreservedRiderRig(gltf.scene, guides, getRiderModelProfile(PRESERVED_RIDER_MODELS[resolvePreservedRiderModel()].profile))`.
- 렌더 루프·`setVisualKind` 호출 문자열 등 계약 시험이 보는 부분은 바꾸지 않는다.
- 컬러 키트는 P2b 에서 한다. 지금 rider14 로 열면 동행색이 안 바뀌는 것이 정상이다(결과 파일에 명시).

## 5. 시험 (신규, `apps/web/scripts/rider-preserve/`)

기존 `rider-visual-kit.test.ts` 와 같은 방식(`node --experimental-strip-types --test`)으로 실행되게 만든다. GLB 는 Node 에서 `GLTFLoader.parse` + `setMeshoptDecoder(MeshoptDecoder)` 로 연다(기존 `verify-visual-kit-on-glb.mjs` 참고). rider14 GLB 의 팔레트 PNG 는 Node 에서 이미지 로드에 실패할 수 있다 — 텍스처가 `null` 이 되는 것은 이 시험에서 허용하되, 그 경고 출력 사실을 결과 파일에 적는다. 이미지 때문에 parse 자체가 실패하면 JSON 청크에서 `images/textures/samplers` 와 머티리얼의 텍스처 참조를 지운 사본으로 parse 하는 시험 전용 도우미를 쓴다.

`rider-model-profile.test.ts`:
1. rider14 GLB: 메시 14개, 그룹 분포 = `static 1, legR 3, legL 3, wheelRear 1, wheelFront 1, crank 1, pedalR 1, pedalL 1, footR 1, footL 1`.
2. rider14 `pedalBind` R = `[0.107228, 0.131265, 0.073889]`, L = `[-0.107228, 0.402735, -0.073889]` (각 ±1e-6).
3. rider14 guide 키 2개, thighOnly 2개, sock 2개.
4. rider14 프로필에 `unknown__X` → 예외. `pedalBind` extras 를 지운 장면 → 예외.
5. s5 GLB(`public/.../20260921-041426-cd81398e/rider.glb`): 메시별 그룹 판정이 **옮기기 전 코드와 같다** — 시험 안에 현행 `RIG.groups`/정규식을 복사해 두지 말고, `git show 734af62:apps/web/src/lib/riderPrototype/preservedRiderRig.ts` 에서 옮기기 전 그룹 결과를 한 번 뽑아 `scripts/rider-preserve/fixtures/s5-groups.json` 으로 저장하고 그것과 비교한다(210 메시 노드, 그룹별 개수 포함). s5 `pedalBind` 는 옮기기 전 값과 1e-9 이내.
6. 두 GLB 모두 `new PreservedRiderRig(scene, guides, profile)` 생성이 예외 없이 끝나고, `setPhase(0.25)` 후 다리 메시 position 이 모두 유한값.

`rider-float32-bake.test.ts`:
1. 정규화 Int16 position(`normalized: true`)을 가진 작은 지오메트리 + 스케일·이동 행렬 → `bakeFloat32Attributes` + `applyMatrix4` 결과가 기대 미터값과 1e-5 이내, `array instanceof Float32Array`.
2. rider14 GLB 를 bake 한 다리 메시 정점의 월드 좌표가 같은 GLB 를 Float32 변환 **없이** 계산한 값(`getX` 로 읽고 `matrixWorld` 를 수동 적용)과 1e-6 이내.
3. 변환 없이 `applyMatrix4` 하면 값이 깨지는 것(재현)을 한 줄로 단언해 둔다 — 이 단언이 실패하면 three 동작이 바뀐 것이므로 메시지에 그 뜻을 적는다.

## 6. 검증 명령 (`apps/web`)

- `npx tsc --noEmit -p tsconfig.app.json`
- `npx eslint src/lib/riderPrototype src/lib/map/riderPreservedLayer.ts scripts/rider-preserve`
- `node --test scripts/rider-preserve/preserved-layer-contract.test.mjs`
- `node --experimental-strip-types --test scripts/rider-preserve/rider-visual-kit.test.ts scripts/rider-preserve/rider-model-profile.test.ts scripts/rider-preserve/rider-float32-bake.test.ts`
- `npm run test:quick` (있는 그대로. 실패하면 P0 결과의 기준선과 같은 실패인지 대조)
- 브라우저 확인: **Supervisor 가 띄워 둔 dev 서버 `http://localhost:5040` 을 그대로 쓴다**(새로 띄우거나 끄지 말 것. `127.0.0.1:5040` 은 다른 프로세스라 쓰지 않는다). 주소 `scripts/rider-preserve/rider-perf-bench.html?animate=0&zoom=22` 와 `...&riderModel=rider14` 두 장 캡처 → `.out/rider14/p2a/`. rider14 쪽이 라이더를 그리고(`loadState=ready`), 콘솔 오류가 없는지. 드로우콜 측정값(1명당)도 함께 기록.

## 운영 규칙 (P0 감리 지적)

- 모든 명령은 포그라운드로 끝까지 기다린다. 백그라운드 프로세스를 남긴 채 종료 금지.
- Playwright 캡처 스크립트가 필요하면 `scripts/rider-preserve/.out/rider14/p2a/` 아래 임시 파일로 두고, 기존 `rider-perf-bench.run.mjs` 는 수정하지 않는다.

## 결과 파일 `03-result-p2a.md`

변경 파일과 줄 수(`git diff --stat`), 각 명령 exit code·요약, 시험 개수, 캡처 경로, 1명당 드로우콜(s5/rider14), 옮기기 전후 s5 그룹 비교 결과, 남은 문제.

## 금지

- 리그 수학 변경, `RIG` 관절 좌표·`FOOT_PITCH_DEG` 변경
- `PRESERVED_RIDER_ACTIVE_MODEL` 를 `"rider14"` 로 바꾸는 것
- `MapView.tsx`·`riderDomMarkers.ts`·`riderDetailLod.ts`·`riderVisualKit.ts` 수정 (키트는 P2b)
- 시험을 통과시키려고 기존 시험을 느슨하게 고치는 것
- commit · push · `npm install` · 본 작업트리 쓰기
