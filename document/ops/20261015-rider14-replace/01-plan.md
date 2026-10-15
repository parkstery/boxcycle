# rider14 교체 계획 — 현재 라이더(s5)를 경량 모델 rider14로

| 항목 | 내용 |
|------|------|
| 문서 유형 | **작업 계획(ops)** — 라이더 3D 모델 교체의 범위·결정·단계·검증 게이트 |
| 최초 작성 | 2026-10-15 |
| **상태** | `완료(브랜치)` — G0~G6 통과, G7 배포 대기. 결정 — Chief 2026-10-15 결정: D1 meshopt · D2 1단계 LOD0만 · D3 별도 묶음 · D4 수용(신발 갑피 포함 명시 승인) · D5 표기안대로 |
| 역할 | Supervisor(계획·감리) = **Claude** · Developer = OpenCode Muse Spark → **Cursor Agent CLI**(2026-10-15 교대) · Chief = 결정·육안 승인 |
| 작업 위치 | worktree `C:\20.HDev\boxcycle-rider14`, 브랜치 `rider14-replace`(기준 `main2` `734af62`) |
| 독자 | `chief · AI` |
| 연결 문서 | [직전 교체 완료 보고(s5 탑재)](../../archive/260922-RTW-라이더-신구모델-교체-완료보고.md) · [형상보존 교체계획](../../archive/260920-RTW-라이더-형상보존-교체계획.md) · [ops 창구 규칙](../README.md) · [개발 워크플로](../../reference/operations/260719-개발-워크플로-브랜치-커밋-게이트.md) |

---

## 0. 한 장 요약

**rider14**는 현재 제품 라이더(s5, 후보 `20260921-041426-cd81398e`)와 **형상이 같은 모델을 다시 묶고 줄인** 경량 세트다. 원본은 s6(`roadcyclist_s6_wheelfix_merged.glb`)이고, LOD 3단으로 산출되어 있다.

| | 현재 제품 (s5) | rider14 LOD0 | rider14 LOD1 | rider14 LOD2 |
|---|---:|---:|---:|---:|
| 드로우콜(라이더 1명) | **213** | **14** | **14** | **1** |
| 삼각형 | 53,514 | 29,604 | 18,588 | 5,648 |
| 정점 | 54,091 | 21,757 | 15,527 | 6,644 |
| 전송 크기 | 1,752,892 B (무압축) | 245,120 B (meshopt) | 165,896 B (meshopt) | 63,424 B (meshopt) |
| 리그 | DQS 다리 + 강체 | 동일 (다리 정점 불변) | 동일 (다리 정점 불변) | 없음 (고정 자세) |

> s5 의 드로우콜은 **실제로 그려지는 primitive 수 213** 이다(메시 정의는 162개·primitive 165개지만 210개 노드가 메시를 공유해 그린다. 직전 보고서의 165·52,434 는 정의 기준 값). 앱은 **라이더 한 명마다 장면 전체를 다시 그리므로**(`riderPreservedLayer.ts` render 루프) 본인 + 페이서 2명이면 지금 프레임당 639 콜이고, rider14 LOD0 이면 42 콜이다.

교체는 **에셋 교체 + 리그의 이름 규칙 교체 + 컬러 키트 교체**다. 렌더 경로(Custom Layer + DQS)는 그대로 쓴다. 다리 정점, 관절 좌표, 페달 기준점, 가이드 가중치가 모두 s5 와 같음을 이미 실측했다(§2). 그래서 **IK·발목 각도표·가이드 매핑은 다시 만들 필요가 없다.**

단계는 넷으로 나눈다. **1단계(필수)는 LOD0 하나로 s5 를 그대로 대체**하는 것이고, LOD1·LOD2 도입(2단계)과 상체·자전거 흔들림(3단계)은 별도 Chief 결정으로 분리한다.

---

## 1. 출처와 산출물 (권위 파일)

rider14 작업 폴더: `C:\Users\kdrea\OneDrive\Documents\img\helmet_fix\revision\20260919-natural_joint_skin\20261015_01-s6-poly-drawcall-reduction`

| 역할 | 파일 | 크기 | SHA-256 |
|---|---|---:|---|
| 원본 (읽기 전용) | `source\roadcyclist_s6_wheelfix_merged.glb` | 1,980,872 | `aeefb4d246b815a2391cbf80c0778bfb80cc8f66fa09f7385684bba8d2c8bc70` |
| **LOD0 (meshopt, 권장 탑재본)** | `out\rider_s6_LOD0_meshopt.glb` | 245,120 | `df8de090b068f1a8734482ae5698bd578140b387fd3eb1947fd9839d5e4fe54d` |
| LOD0 (무압축) | `out\rider_s6_LOD0.glb` | 930,724 | `fe7055562346c9aac6f11f0458185cbc0ea273b48ad2d99cb07bcc50d1a33b9e` |
| LOD0 (Draco) | `out\rider_s6_LOD0_draco.glb` | 125,972 | `24485e6ca3c09865e7c4b421c1c8312ee192a5869f5c30a6bed57a283ee5dc22` |
| LOD1 (meshopt) | `out\rider_s6_LOD1_meshopt.glb` | 165,896 | `7f2bdf8bdf841b59a3952465115b4cd944ea72818ed15dfab11522064581506e` |
| LOD2 (meshopt) | `out\rider_s6_LOD2_meshopt.glb` | 63,424 | `14c5956eb3a461e87c1e86df095be877e9e2645cbd3216ea55a0e8d3f5c10668` |
| 가이드 가중치 | `source\guide-weights.json` | 230,034 | `136895c8d9b8bd29e47b0a53ac10a0f8443e93240eb2578330da0581ee840dca` (**현재 제품과 바이트 동일**) |
| 제작 보고서 | `reports\결과보고서.md` | — | 단계별 결정·리그 검증·앱 수정 목록 |
| 빌드·검증 도구 | `tools\build.mjs`, `tools\compress.mjs`, `tools\rigcheck.mjs`, `tools\viewer.html` | — | 재현 가능 |

> **승격 규칙(직전 교체 보고 §10.3 승계)**: 승인 후 재export 금지, byte-for-byte 복사만 한다. rider14 는 새 입력이므로 **새 candidateId** 를 쓰고, s5 후보의 승인을 승계하지 않는다. 다만 아래 §2 의 동일성 증명을 근거로 **정적 바인드·8위상 하네스는 앱 수준 동등성 시험으로 대체**한다(§6 G3).

---

## 2. 사전 검증으로 확정된 사실 (2026-10-15 실측)

| # | 확인 내용 | 결과 | 근거 |
|---|---|---|---|
| F1 | s5(제품 `rider.glb`)와 s6 의 형상 동일성 | **동일.** 삼각형 53,514 = 53,514, 고유 정점(0.1 mm 격자) 27,342 = 27,342, 상호 누락 0 | `tools\s5s6.mjs` |
| F2 | 앱의 그룹 판정(s5 메시명 + `groupForName`)과 s6 `<그룹>__<재질>` 묶음의 대응 | **210/210 일치**, 불일치 0 (static 110, wheelRear 41, wheelFront 30, crank 7, foot 6+6, leg 3+3, pedal 2+2) | `tools\groupmap.mjs` |
| F3 | 가이드 가중치 매핑 | `legR__Material_5` ↔ Right 940/940, `legL__Material_5` ↔ Left 867/867 | `tools\analyze.mjs` |
| F4 | 앱 페달 기준 메시 대응 | `Mesh_48` = `pedalR__Material_3`, `Mesh_52` = `pedalL__Material_3` (bbox 중심 일치) | `tools\pedalmap.mjs` |
| F5 | 앱 리그 이식본으로 크랭크 0/90/180/270° 자세 비교 | LOD0·LOD1 무압축: 다리 정점별 차 **0**, 강체 그룹 **0**. meshopt: 최대 7.95 µm. 가이드 미매칭 0 | `tools\rigcheck.mjs`, `work\rig_*.json` |
| F6 | Draco 압축본 | 위치·가이드는 통과하지만 **다리 정점 순서가 바뀜**(기존 s5 Draco 도 동일). 순서 불변이 필요하면 meshopt | 결과보고서 §2 |
| F7 | meshopt 본의 위치·법선 속성 | **정규화 Int16/Int8**(`KHR_mesh_quantization`). 현재 앱의 `geometry.applyMatrix4()` + DQS `setXYZ()` 를 그대로 쓰면 값이 깨진다(재현: 1.6 → −0.40) → **Float32 변환 필수** | 결과보고서 §5-8 |
| F8 | s5 와 다르게 보이는 점 | ① 30° 스무딩으로 저지·반바지의 플랫 셰이딩 결이 매끈해짐 ② 전 머티리얼 doubleSided → s5 에서 컬링돼 구멍처럼 보이던 신발 갑피가 닫힘 ③ 헬멧·바테이프 등 1–2 mm 단순화 | `work\render_final\cmp_all.png`, `zoom_shoe.png` |
| F9 | 앱 의존성 | 앱은 Draco·meshopt 디코더를 **아직 쓰지 않음**. three `0.186.1`, mapbox-gl `3.23.1` | `apps\web\package.json` |
| F10 | 배포 캐시 | Firebase Hosting `**` = `no-cache`. 후보 ID 가 경로에 들어가므로 구·신 자산이 섞이지 않음 | `firebase.json` |

**결론**: 다리·발·크랭크·페달·바퀴의 형상과 그룹 귀속이 s5 와 같다. 따라서 `RIG` 관절 좌표(hip/knee/ankle), `FOOT_PITCH_DEG`, `guide-weights.json`, 크랭크 반경·위상은 **변경 없이 재사용**한다. 바뀌는 것은 **이름으로 찾는 규칙**뿐이다.

---

## 3. 범위

### 3.1 포함 (1단계 필수)

1. rider14 LOD0 를 `apps/web/public/rider/preserved/candidates/<새 id>/` 에 바이트 그대로 스테이징
2. `preservedRiderRig.ts` 의 이름 규칙을 **모델 프로필**로 분리(s5 프로필 유지 + rider14 프로필 추가)
3. meshopt 디코더 연결과 Float32 변환
4. 컬러 키트(self/peer/pacer)를 팔레트 텍스처 방식으로 이식
5. 계약 테스트·앱 검증기·문서 갱신, 성능 전후 실측, Chief 육안 승인 후 승격

### 3.2 별도 결정 (2·3단계)

- 2단계: LOD1(가까운 동행·페이서)·LOD2(점으로 보이는 줌) 도입 — **D2**
- 3단계: 상체 흔들림 셰이더 + 자전거 좌우 롤 — **D3**

### 3.3 제외

- 구형 `glb` 모드·`rider-lowpoly.glb`·`glbModelLayer.ts` (손대지 않음, 해시 고정 유지)
- `iso2d` 모드, 동행 동기화·네임태그 로직, 카메라 프레이밍, 라이더 스케일
- rider14 자체의 재제작(형상 수정이 필요하면 rider 작업 폴더에서 새 빌드 → 새 candidateId)

---

## 4. Chief 결정 사항

> **2026-10-15 Chief 결정: 아래 권장안 전부 수용. D4 신발 갑피 변경 명시 승인. Supervisor 를 Claude 로 지정, Developer 는 OpenCode Muse Spark.**

| # | 결정 | 선택지 | 권장 | 이유 |
|---|---|---|---|---|
| **D1** | 압축 형식 | ① meshopt ② Draco ③ 무압축 | **① meshopt** | 다리 정점 순서 보존(F6), 디코더가 three 번들 JS 라 추가 wasm 다운로드 없음, 245 KB. Draco 는 126 KB 지만 디코더 wasm(≈300 KB)을 따로 호스팅해야 하고 순서가 바뀜 |
| **D2** | LOD 도입 범위 | ① 1단계는 LOD0 만, LOD 는 다음 묶음 ② 처음부터 LOD0/1/2 | **①** | 1단계만으로 드로우콜 213→14. LOD 전환은 리그 인스턴스 추가·선택 규칙·기억장치 해제 등 별도 위험이 있어 분리하는 편이 회귀 원인 추적이 쉽다 |
| **D3** | 흔들림(상체·자전거) | ① 이번에 포함 ② 별도 묶음 ③ 미채택 | **②** | 교체와 독립 기능. 확정 기본값(어깨 0.5°, 자전거 0.4°, 상하 2 mm, 타이밍 −60°)은 rider 작업 보고서 §5-10 에 기록됨 |
| **D4** | 외형 변화 수용 | F8 의 ①②③ | 수용 권장 | 세 가지 모두 결함 해소·근거리 육안 동등 수준. 단 **신발 갑피가 닫히는 것**은 s5 와 눈에 띄게 다르므로 명시 승인 필요 |
| **D5** | 표기 | 모델 닉네임 `rider14`, 후보 ID 는 기존 규칙 `YYYYMMDD-HHmmss-<sha8>` | — | 닉네임은 `candidate.json` 과 `config.ts` 상수에 함께 기록해 문서·코드에서 같은 이름으로 찾게 한다 |

---

## 5. 설계

### 5.1 자산 배치

```
apps/web/public/rider/preserved/candidates/<rider14-id>/
  rider.glb            ← out\rider_s6_LOD0_meshopt.glb 바이트 그대로
  guide-weights.json   ← 현재 제품 파일과 동일 바이트(136895c8…)
  candidate.json       ← schemaVersion 2 (아래)
  (2단계) rider-lod1.glb, rider-lod2.glb
```

- `<rider14-id>` = 스테이징 시각(KST) + `rider.glb` SHA-256 앞 8자. 예: `20261016-101500-df8de090`
- **s5 후보 폴더(`20260921-041426-cd81398e`)는 그대로 둔다** — 롤백 경로(§9)

`candidate.json` (schemaVersion 2, 기존 필드 유지 + 추가):

```json
{
  "schemaVersion": 2,
  "candidateId": "<rider14-id>",
  "nickname": "rider14",
  "modelProfile": "rider14",
  "stage": "APP_CUSTOM_LAYER_CANDIDATE",
  "status": "APP_CANDIDATE_UNDER_REVIEW",
  "sourceGlbSha256": "df8de090b068f1a8734482ae5698bd578140b387fd3eb1947fd9839d5e4fe54d",
  "stagedGlbSha256": "df8de090b068f1a8734482ae5698bd578140b387fd3eb1947fd9839d5e4fe54d",
  "upstreamSourceSha256": "aeefb4d246b815a2391cbf80c0778bfb80cc8f66fa09f7385684bba8d2c8bc70",
  "geometryEquivalentTo": "20260921-041426-cd81398e",
  "guideRuntimeSha256": "136895c8d9b8bd29e47b0a53ac10a0f8443e93240eb2578330da0581ee840dca",
  "compression": "EXT_meshopt_compression+KHR_mesh_quantization",
  "files": { "glb": "rider.glb", "guideWeights": "guide-weights.json" }
}
```

승격 시 `status` 를 `APP_APPROVED_PRODUCT_ACTIVE` 로 바꾸고 `appApprovedAtKst` 를 채운다. s5 의 `candidate.json` 은 변경하지 않는다(`status` 를 바꾸지 않고, 비활성 여부는 `config.ts` 가 결정).

### 5.2 `config.ts`

```ts
export const PRESERVED_RIDER_CANDIDATE_ID = "<rider14-id>";
export const PRESERVED_RIDER_MODEL_PROFILE: RiderModelProfileId = "rider14";
export const PRESERVED_RIDER_MODEL_NICKNAME = "rider14";
```

- 롤백은 위 두 상수를 s5 값(`"20260921-041426-cd81398e"`, `"s5"`)으로 되돌리는 것으로 끝나야 한다.
- 모드(`preserved`)와 fallback 은 변경하지 않는다.

### 5.3 모델 프로필 (`riderPrototype/riderModelProfile.ts`, 신규)

`preservedRiderRig.ts` 안에 흩어진 **이름 의존 지점**을 한곳으로 모은다. 리그의 수학(IK·DQS·발목표·관절 좌표)은 건드리지 않는다.

| 이름 의존 지점 (현재 위치) | s5 프로필 (현행 그대로) | rider14 프로필 |
|---|---|---|
| 그룹 판정 `RIG.groups` + `groupForName()` (44–57, 149–156행) | `Mesh_*` 목록 + 정규식 | `name.split("__")[0]`. `bike` → 변환 없음(static 과 같은 취급), `static__Palette` 는 static+bike 병합 |
| 페달 기준점 `centerOfNamedMeshes("Mesh_48"/"Mesh_52")` (318–321행) | 메시 bbox 중심 | 노드 extras `userData.pedalBind` (R `[0.107228, 0.131265, 0.073889]`, L `[-0.107228, 0.402735, -0.073889]`). extras 가 없으면 즉시 예외 |
| 가이드 메시 `GUIDE_MESH` (66–69행) | `"Right/Left continuous knee skin"` | 메시 `legR__Material_5` / `legL__Material_5` → 가중치 키는 그대로 `"Right/Left continuous knee skin"` (노드 extras `guideMesh` 에도 있음) |
| 허벅지 전용 가중치 `Mesh_153`/`Mesh_163` (199행) | 그대로 | `legR__Rider_black_shorts` / `legL__Rider_black_shorts` |
| 양말 판정 (203행) | `Mesh_156`/`166` 또는 `/sock/i` | `/sock/i` (`leg*__Rider_black_socks`) |

인터페이스(제안):

```ts
export type RiderModelProfileId = "s5" | "rider14";
export interface RiderModelProfile {
  groupOf(name: string): string;                       // crank | pedalR | ... | legR | static
  pedalBind(draws: BakedDraw[], side: "R" | "L"): Vec3;
  guideKeyOf(name: string, side: "R" | "L"): string | null;   // guide-weights.json 의 키
  isThighOnly(name: string): boolean;
  isSock(name: string): boolean;
}
```

### 5.4 로더와 Float32 변환 (`map/riderPreservedLayer.ts`, `preservedRiderRig.ts`)

- `loader.setMeshoptDecoder(MeshoptDecoder)` — `three/examples/jsm/libs/meshopt_decoder.module.js` (번들 포함, 별도 fetch 없음). 번들 크기 증가분을 G6 에서 기록한다.
- `PreservedRiderRig` 생성자의 bake 단계에서 **`position`·`normal` 을 `Float32Array` 기반 `BufferAttribute` 로 바꾼 뒤** `applyMatrix4` 한다(F7). 정규화 정수 속성에 `applyMatrix4`·`setXYZ` 를 하지 않는다는 것을 단위 시험으로 고정한다.
- `TEXCOORD_0` 은 정규화 정수 그대로 둬도 된다(셰이더에서 자동 해제).
- rider14 GLB 에 들어 있는 `_SWAY` 속성(3단계용)은 1단계에서는 쓰지 않는다. 무해하지만 GPU 에 작은 버퍼로 올라간다(LOD0 10,792 정점 × 2 B).

### 5.5 컬러 키트 (`riderPrototype/riderVisualKit.ts`)

현재 방식(머티리얼 이름으로 찾아 `material.color` 를 바꿈)은 rider14 에서 **조용히 아무것도 하지 않게 된다**(머티리얼이 `Rider palette` 하나뿐). 동행이 본인과 같은 주황으로 보이는 회귀가 생기므로 반드시 바꾼다.

- 로드 시 팔레트 base color 텍스처를 3벌 만든다(self / peer / pacer). 각 벌에서 **0번 칸(x 0–7, y 0–7) = 헬멧, 1번 칸(x 8–15, y 0–7) = 저지**만 칠한다. 칸 좌표는 머티리얼 extras `userData.palette.colorSlots` 에서 읽는다(하드코딩 금지).
- 키트 RGB 는 **선형값**이므로 sRGB 로 변환해 8비트로 쓴다. 텍스처 `colorSpace = SRGBColorSpace`, `magFilter = minFilter = NearestFilter`, `generateMipmaps = false`.
- `setVisualKind(kind)` 는 머티리얼의 `map` 만 교체한다. 픽셀을 매 프레임 다시 쓰지 않는다(텍스처 재업로드 방지).
- s5 프로필은 현행 이름 방식을 유지한다.

### 5.6 (2단계) LOD

- 레이어가 LOD 별 리그를 갖는다. LOD0 리그 1개(본인), LOD1 리그 1개(동행·페이서 공용, 지금처럼 차례로 그림), LOD2 는 리그 없는 정적 메시 1개.
- 선택 규칙(초안): 본인 = 항상 LOD0. 동행·페이서 = 줌 ≥ `RIDER_POSE_ANIMATION_MIN_ZOOM`(19) 이면 LOD1, 미만이면 LOD2. 줌 19 미만에서는 이미 자세 계산을 건너뛰므로(`riderDetailLod.ts`), LOD2(고정 자세)와 의미가 맞는다.
- 비동기 로드 순서: LOD0 → (화면 표시) → LOD1·LOD2. 하위 LOD 가 아직 없으면 LOD0 로 그린다.
- `onRemove` 에서 세 리그·텍스처·지오메트리를 모두 해제(직전 보고 §11-5 의 누적 위험을 함께 시험).

### 5.7 (3단계) 흔들림

rider 작업 보고서 §5-10 의 확정값을 그대로 옮긴다. 셰이더(`onBeforeCompile`)와 루트 그룹 회전 하나로 구현되며 GLB 변경은 필요 없다(이미 `_SWAY` 포함). 별도 묶음에서 진행한다.

---

## 6. 단계별 작업과 게이트

역할은 [ops 창구 규칙](../README.md)을 따르되 이 묶음은 **Supervisor = Claude**(지시서·독립 검수), **Developer = OpenCode Muse Spark**(구현), **Chief** 가 육안 승인(Chief 지정 2026-10-15).

| 단계 | 내용 | 담당 | 완료 조건 (게이트) |
|---|---|---|---|
| **P0 기준선** | 현행 s5 로 고정 카메라 캡처(5 m·60 m·200 m·전체), 본인+페이서 2명 상태에서 `window.__rtwRiderCost.read()`, `renderer.info.render.calls`·`triangles`, 라이더 자산 전송 바이트, 첫 라이더 표시 시각을 기록. 현 자산 해시 재확인 | Developer | **G0**: 수치표 + 캡처가 `03-result-p0.md` 에 있음. s5 자산 해시 3종 일치 |
| **P1 스테이징** | `apps/web/scripts/rider-preserve/stage-rider14.mjs`(신규): rider 작업 폴더 `out\rider_s6_LOD0_meshopt.glb`·`source\guide-weights.json` 을 해시 검증 후 복사, `candidate.json` 작성. 재export·후처리 금지 | Developer | **G1**: 복사본 SHA = §1 표의 값. `guide-weights.json` SHA = `136895c8…`. 원본 폴더 SHA(`aeefb4d2…`) 불변 |
| **P2 코드** | 모델 프로필(§5.3), meshopt 디코더·Float32 변환(§5.4), 컬러 키트(§5.5). `config.ts` 는 **아직 s5 를 가리킨 채로** 두고 프로필 전환은 시험에서만 | Developer | **G2**: `npx tsc --noEmit`, `npm run lint`, 기존 시험 전부 통과. 신규 단위 시험(§7) 통과 |
| **P3 동등성** | 저장소 안에 앱 리그 동등성 시험 추가: 같은 `PreservedRiderRig` 코드로 s5 와 rider14 를 8위상(0,45,…,315°)에서 자세 → 그룹별 비교 | Developer → Supervisor 독립 재실행 | **G3**(2026-10-15 정정): 다리 6메시 같은 인덱스 정점 최대차 ≤ 1e-5 m, 법선 최대 ≤ 1.5°·중앙값 ≤ 0.5°(meshopt Int8 법선 양자화), 강체 7그룹 **변환 행렬** 원소 최대차 ≤ 1e-5(rider14 강체는 단순화 형상이라 정점 비교 불가), 가이드 미매칭 0, 페달 기준점 차 ≤ 1e-5 m, 좌우 위상 180° |
| **P4 앱 검증** | `preserved-app-validator` 를 rider14 로 열어 실제 지도·지형 위에서 확인. 컬러 키트 3종 픽셀 샘플(헬멧·저지 칸 색 = 키트 sRGB ±1), 조명 조절판(`?lightlab=1`)에서 s5 와 나란히 비교 | Developer 캡처 → **Chief 육안** | **G4**: Chief 승인(D4 포함). 캡처 경로가 결과 파일에 있음 |
| **P5 성능** | P0 와 같은 조건으로 재측정 | Developer → Supervisor | **G5**: 드로우콜/라이더 ≤ 14, `msPerRider` P0 대비 감소, 자산 전송 ≤ 0.5 MB, 첫 표시 시각 악화 없음. **스마트폰 실기기 1회 이상**(최종 사용 기기 원칙) |
| **P6 승격** | `config.ts` 를 rider14 로 전환, `candidate.json` status 갱신, 계약 테스트 갱신, 빌드 | Developer → Supervisor | **G6**: `npm run build` 통과, 번들 증가분 기록, `node --test apps/web/scripts/rider-preserve/preserved-layer-contract.test.mjs` 통과, 로컬 앱에서 본인·페이서 2명 주행 1회 |
| **P7 마감** | 결정 로그 한 줄, 상태보드 기호, 완료 보고서(`document/archive/reports/`), 커밋 → 워크플로에 따른 병합. 배포는 Chief 지시 | Supervisor · Chief | **G7**: Chief 최종 승인 후 배포. 배포 뒤 실서비스에서 rider14 경로 200 확인 |
| (P8) | 2단계 LOD1·LOD2 — 별도 묶음 | — | D2 |
| (P9) | 3단계 흔들림 — 별도 묶음 | — | D3 |

---

## 7. 시험 계획

### 7.1 갱신하는 시험

`apps/web/scripts/rider-preserve/preserved-layer-contract.test.mjs`

| 시험 | 변경 |
|---|---|
| `approved candidate assets are staged byte-for-byte` | 하드코딩된 `candidateId` 를 `config.ts` 에서 읽거나 rider14 ID 로 교체. `pedalReportSha256` 단언은 schemaVersion 1 전용으로 분기(rider14 는 8위상 하네스 대신 G3 동등성 시험을 근거로 함) |
| `preserved mode stays isolated from the product GLB` | 변경 없음 (`rider-lowpoly.glb` 해시 고정 유지) |
| `custom layer renders every rider ...` | `rig.setVisualKind(spec.kind ?? "self")` 문자열이 유지되는지 확인. LOD 도입 시 함께 수정 |
| 기타 | 변수명 리팩터링만으로 깨지는 정규식 시험이므로, P2 에서 문자열을 바꾸면 **같은 커밋에서** 시험을 고친다 |

### 7.2 신규 시험

| 시험 | 단언 |
|---|---|
| 모델 프로필 단위 시험 | rider14 노드 14개가 모두 기대 그룹으로 분류. `pedalBind` = F4 값(±1e-6). 가이드 대상 메시 2개, 허벅지 전용 2개, 양말 2개 |
| Float32 변환 시험 | 정규화 Int16 위치를 가진 지오메트리를 bake 한 뒤 위치가 원래 미터값과 1e-5 m 이내. bake 후 `position.array instanceof Float32Array` |
| 리그 동등성 시험(G3) | s5 / rider14 8위상 비교. 실행 시간이 길면 `node --test` 별도 파일로 두고 CI 기본 집합에서는 제외 여부를 Supervisor 가 판정 |
| 컬러 키트 시험 | 팔레트 텍스처 3벌의 0·1번 칸 픽셀 = 키트 선형값의 sRGB 8비트. 나머지 칸 불변 |
| 자원 해제 시험 | 레이어 `onRemove` 후 리그·텍스처 dispose 호출 확인(직전 보고 §11-5) |

---

## 8. 위험과 대응

| # | 위험 | 영향 | 대응 |
|---|---|---|---|
| R1 | meshopt 정규화 정수 속성에 `applyMatrix4`/`setXYZ` | 라이더가 찌그러지거나 사라짐 | §5.4 Float32 변환 + 단위 시험. G3 에서 수치로 확인 |
| R2 | 컬러 키트가 이름 방식 그대로 남음 | 동행·페이서가 본인과 같은 주황 | §5.5 + 컬러 키트 시험 + G4 픽셀 샘플 |
| R3 | 팔레트 텍스처 색공간·필터 오설정 | 색이 바래거나 칸 경계가 섞임 | sRGB·NEAREST·밉맵 없음 고정. GLTFLoader 기본값을 그대로 쓰되 교체 텍스처에 같은 설정을 복사 |
| R4 | 페달 기준점을 bbox 로 계산 | 페달이 크랭크에서 수 mm 벗어남(직전 교체 §8-3 과 같은 종류) | extras `pedalBind` 만 사용, 없으면 예외 |
| R5 | doubleSided 통일로 뒷면이 보임 | 일부 부품이 두꺼워 보이거나 신발이 닫혀 보임 | D4 에서 명시 승인. G4 캡처에 신발 근접 뷰 포함 |
| R6 | 조명 조절판 기본값이 s5 기준 | 색이 약간 달라 보임 | G4 에서 나란히 비교. 조명값 변경은 이번 범위 밖(필요하면 별도 지시) |
| R7 | 계약 시험이 문자열 정규식 | 리팩터링만으로 실패 | §7.1. 시험을 느슨하게 바꾸지 않고 새 코드에 맞게 고친다 |
| R8 | 하네스가 근사값을 씀 | 모든 게이트가 거짓 통과(직전 교체의 최대 교훈) | G3 은 **앱 코드 자체**로 두 모델을 자세 잡는다. 근사 좌표·반올림 크랭크 길이 금지 |
| R9 | 번들 증가 | 첫 로드 지연 | meshopt 디코더 크기를 G6 에서 기록. 자산 절감(−1.5 MB)과 함께 판단 |
| R10 | 로컬 `.env` 만 바꾸고 승격했다고 판단 | 배포본이 s5 그대로 | `config.ts` 상수가 단일 진실. G7 에서 배포본 경로 확인 |
| R11 | 다른 진행 중 작업과 섞임 | 커밋 오염 | 현재 작업트리에 무관한 변경(MapView 부트 센터 등)이 있음. **전용 브랜치 또는 worktree** 에서 진행하고 해당 파일만 스테이징 |

---

## 9. 롤백

1. `config.ts` 의 `PRESERVED_RIDER_CANDIDATE_ID`·`PRESERVED_RIDER_MODEL_PROFILE` 을 s5 값으로 되돌린다(한 커밋 revert 로 가능해야 함).
2. s5 후보 폴더와 s5 프로필 코드는 **rider14 승격 후에도 최소 한 배포 주기 동안 삭제하지 않는다.** 삭제는 Chief 승인 후 별도 커밋으로 한다.
3. 직전 교체의 원복 규칙을 따른다: **GLB 만 바꾸고 코드를 남기는 원복 금지** — 자산과 프로필을 함께 되돌린다.

---

## 10. 예상 변경 파일

| 파일 | 변경 |
|---|---|
| `apps/web/public/rider/preserved/candidates/<rider14-id>/*` | 신규 3파일 |
| `apps/web/src/lib/riderPrototype/config.ts` | 후보 ID·프로필·닉네임 상수 |
| `apps/web/src/lib/riderPrototype/riderModelProfile.ts` | 신규 |
| `apps/web/src/lib/riderPrototype/preservedRiderRig.ts` | 이름 의존 지점을 프로필 호출로 교체, Float32 변환 |
| `apps/web/src/lib/riderPrototype/riderVisualKit.ts` | 팔레트 텍스처 키트 |
| `apps/web/src/lib/map/riderPreservedLayer.ts` | meshopt 디코더, 키트 텍스처 준비·해제 |
| `apps/web/scripts/rider-preserve/stage-rider14.mjs` | 신규 |
| `apps/web/scripts/rider-preserve/preserved-layer-contract.test.mjs` | §7.1 |
| `apps/web/scripts/rider-preserve/*.test.mjs` | §7.2 신규 시험 |
| `apps/web/scripts/rider-preserve/preserved-app-validator.*` | 후보 표시·프로필 |
| `document/260707-RTW-결정-로그.md`, 상태보드, `archive/reports/` 완료 보고서 | P7 |

`MapView.tsx`·`riderDomMarkers.ts`·`riderDetailLod.ts` 는 1단계에서 변경하지 않는다.

---

## 11. 미해결·확인 필요

1. `riderVisualKit` 의 페이서 키트가 헬멧·저지 외 다른 부위를 바꾸는지 — 현재 코드상 두 칸뿐이지만 P2 착수 시 재확인.
2. 동행 인원 상한(페이서 2 + 실동행 N)에서 LOD0 만으로 프레임 예산이 충분한지 — P5 결과로 2단계(D2) 시급성 판단.
3. 직전 보고 §11-3(`riderRig.geometry.mjs` 의 `SADDLE`/`PELVIS` export 누락 경고)는 이번 범위 밖이나 빌드 로그에서 계속 보일 수 있음.
4. rider14 의 형상 수정이 필요해지면 rider 작업 폴더에서 다시 빌드하고 **새 candidateId** 로 P1 부터 반복한다.
