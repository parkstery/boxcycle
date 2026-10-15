# 지시 P2b — rider14 팔레트 컬러 키트 (self / peer / pacer)

| 항목 | 내용 |
|---|---|
| 발행 | 2026-10-15 · Supervisor (Claude) |
| 대상 | Developer — OpenCode Muse Spark |
| 선행 | P2a 감리 통과 |
| 계획 | [01-plan.md §5.5](01-plan.md) |
| 작업 위치 | **`C:\20.HDev\boxcycle-rider14`** (브랜치 `rider14-replace`) |
| 결과 파일 | `C:\20.HDev\boxcycle\document\ops\20261015-rider14-replace\03-result-p2b.md` |

## 0. P2a 보정 (먼저 처리 — [04-review-p2a.md](04-review-p2a.md))

1. `preservedRiderRig.ts`: `from "./riderVisualKit.ts"` → `from "./riderVisualKit"`. 새 import 에도 확장자를 붙이지 않는다.
2. `config.ts`: `resolvePreservedRiderModel` 의 `(import.meta as unknown as …).env?.DEV` → `import.meta.env.DEV`.
3. `rider-perf-bench.ts` 패널: 표시 candidate 를 `PRESERVED_RIDER_MODELS[resolvePreservedRiderModel()]` 의 `nickname · candidateId` 로. (벤치 페이지는 이 한 곳만 수정)
4. `apps/web/package.json` 에 스크립트 추가:
   `"test:rider-preserve": "node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/rider-preserve/*.test.ts && node --test scripts/rider-preserve/preserved-layer-contract.test.mjs"`
   (Windows 에서 글롭이 안 펼쳐지면 파일명을 나열한다.) 이후 모든 시험 실행은 이 스크립트로 한다.

## 배경 (실측)

- rider14 머티리얼은 `Rider palette` 하나. `baseColorTexture` = 128×16 PNG, 샘플러 NEAREST/NEAREST, CLAMP. 머티리얼 extras `palette.colorSlots` = `helmet {x:0,y:0,w:8,h:8}`, `jersey {x:8,y:0,w:8,h:8}` (GLTFLoader 에서는 `material.userData.palette`).
- 원본 팔레트의 helmet·jersey 칸 픽셀 = `(255,128,0,255)` = `RIDER_VISUAL_KIT_SELF`(선형 `1, 0.21586, 0`)의 sRGB 8비트.
- 현행 `applyRiderVisualKit` 은 머티리얼 **이름**으로 찾아 `material.color` 를 바꾼다 → rider14 에서는 아무것도 하지 않는다(동행·페이서가 주황으로 보이는 회귀).

## 만들 것

### 1. `riderVisualKit.ts` — 순수 함수 추가 (기존 export·동작 유지)

```ts
export type PaletteSlot = { x: number; y: number; w: number; h: number };
export type PaletteSlots = { helmet: PaletteSlot; jersey: PaletteSlot };
export function linearToSrgb8(c: number): number;            // 표준 sRGB 전달함수, 반올림, 0–255 클램프
export function readPaletteSlots(userData: unknown): PaletteSlots; // 형식이 틀리면 예외
export function paintPaletteKit(
  pixels: Uint8Array | Uint8ClampedArray, width: number, height: number,
  slots: PaletteSlots, kind: RiderVisualKind,
): Uint8Array;  // 입력은 복사만, 두 칸만 칠한 RGBA 새 배열 (알파 255)
```
- 키트 색은 기존 상수(`RIDER_VISUAL_KIT_SELF/PEER/PACER`)를 그대로 쓴다. 새 색 정의 금지.

### 2. `riderPaletteKit.ts` (신규, 브라우저 전용 부분)

```ts
export class RiderPaletteKit {
  static fromMaterial(material: MeshStandardMaterial): RiderPaletteKit; // map·userData.palette 없으면 예외
  apply(kind: RiderVisualKind): void;  // material.map 만 교체. 같은 kind 면 아무것도 안 함
  dispose(): void;                     // 직접 만든 텍스처만 dispose (원본 map 은 rig 가 정리)
}
```
- `self` 는 **원본 map 그대로**(픽셀 동일하므로 새로 만들지 않는다).
- `peer`·`pacer` 는 처음 요청될 때 한 번만 만든다: 원본 `map.image` 를 `OffscreenCanvas`(없으면 `document.createElement("canvas")`)에 그려 `getImageData` → `paintPaletteKit` → `DataTexture(rgba, w, h, RGBAFormat, UnsignedByteType)`.
- 새 텍스처 설정: `colorSpace = SRGBColorSpace`, `magFilter = minFilter = NearestFilter`, `generateMipmaps = false`, `flipY = false`(원본과 같게), `wrapS/wrapT` 원본 복사, `needsUpdate = true`.
- 매 프레임 픽셀을 다시 쓰거나 텍스처를 새로 만들지 않는다. `apply` 는 참조 교체뿐.

### 3. 연결

- `RiderModelProfile` 에 `createVisualKit(root: Object3D): { apply(kind): void; dispose(): void }` 를 추가한다.
  - s5: 현행 `applyRiderVisualKit(root, kind)` 를 감싼 것(dispose 는 빈 함수).
  - rider14: `userData.palette` 를 가진 머티리얼을 정확히 1개 찾아 `RiderPaletteKit.fromMaterial`. 0개·2개 이상이면 예외.
- `PreservedRiderRig`: 생성자 끝에서 `this.visualKit = profile.createVisualKit(this.object)`. `setVisualKind(kind)` → `this.visualKit.apply(kind)`. `dispose()` 에서 `visualKit.dispose()` 와 **모든 머티리얼의 텍스처(map, metalnessMap, roughnessMap 등) dispose** 를 추가한다(지금은 머티리얼만 dispose 해서 텍스처가 남는다).
- 레이어의 `rig.setVisualKind(spec.kind ?? "self")` 문자열은 그대로 둔다.

## 시험 (신규 `scripts/rider-preserve/rider-palette-kit.test.ts`)

1. `linearToSrgb8`: 0→0, 1→255, 0.2158605009317398→128, 0.0031308 경계 양쪽.
2. `paintPaletteKit`: 128×16 임의 패턴 입력 → helmet·jersey 칸 64픽셀씩만 바뀌고 나머지 1,920픽셀 바이트 동일. 입력 배열 불변.
3. self/peer/pacer 각 칸 색 = 해당 키트 선형값의 `linearToSrgb8` (채널별 정확히 일치).
4. rider14 GLB JSON 에서 읽은 `palette.colorSlots` → `readPaletteSlots` 통과. 형식 틀린 입력 3종 → 예외.
5. rider14 GLB 에 내장된 `palette_basecolor` PNG 를 Node `zlib` 로 직접 해독(128×16 RGBA, 필터 0–4 처리하는 작은 도우미)해서 helmet·jersey 칸이 `paintPaletteKit(…, "self")` 결과와 **바이트 동일**함을 확인 — 즉 self 에서 원본 map 을 그대로 써도 된다는 근거.
6. 기존 `rider-visual-kit.test.ts` 는 수정 없이 통과.

## 브라우저 확인

Supervisor 가 띄워 둔 dev 서버 `http://localhost:5040` 을 그대로 써서(새로 띄우거나 끄지 않음) `rider-perf-bench.html?animate=0&zoom=22&riderModel=rider14` 와 같은 조건 `riderModel=s5` 캡처 → `.out/rider14/p2b/`. 패널에 세 라이더 헬멧·저지 화면 픽셀 샘플(각 라이더 헬멧·저지 위 1점, 좌표 기록)을 추가해도 된다. 세 라이더가 주황/청록/슬레이트로 구분되는지 결과 파일에 적는다. `?riderModel=s5` 쪽 색이 P0 캡처와 같은지도 적는다.

## 검증 명령

`npx tsc --noEmit -p tsconfig.app.json`, `npx eslint src/lib/riderPrototype src/lib/map/riderPreservedLayer.ts scripts/rider-preserve`, `npm run test:rider-preserve`. 모두 exit code 기록. 모든 명령 포그라운드, 백그라운드 잔류 금지. 캡처용 임시 스크립트는 `.out/rider14/p2b/` 아래.

## 결과 파일 `03-result-p2b.md`

변경 파일·줄 수, 명령 exit code, 시험 개수, 캡처 경로와 관찰, 남은 문제.

## 금지

- 키트 색 상수 변경, 팔레트 칸 좌표 하드코딩(시험 기대값 제외)
- 셰이더 수정(`onBeforeCompile`) — 3단계(흔들림) 몫
- `PRESERVED_RIDER_ACTIVE_MODEL` 변경, commit · push · `npm install` · 본 작업트리 쓰기
