# rider14 LOD2 (P8 축소) — 계획

| 항목 | 내용 |
|------|------|
| 문서 유형 | **작업 계획(ops)** |
| 최초 작성 | 2026-10-16 |
| 상태 | `진행` — Chief 결정 2026-10-16: **LOD2 만**(LOD1 제외) |
| 역할 | Supervisor = Claude · Developer = Cursor Agent CLI · Chief = 육안 승인 |
| 작업 위치 | worktree `C:\20.HDev\boxcycle-lod`, 브랜치 `feat/rider14-lod2`(기준 `main2` `a0dd4e3`) |
| 선행 | [rider14 교체](../20261015-rider14-replace/README.md) · [흔들림](../20261016-rider14-sway/README.md) — 둘 다 운영 배포 |

## 0. 왜 LOD2 만인가 (Supervisor 분석, Chief 채택)

| | LOD0(운영) | LOD1 | LOD2 |
|---|---:|---:|---:|
| 드로우콜/명 | 14 | 14 | **1** |
| 삼각형 | 29,604 | 18,588 | 5,648 |
| 리그 | 있음 | 있음(다리 정점 LOD0 과 동일) | 없음(크랭크 0° 고정 자세) |
| 파일 | 245,120 B | 165,896 B | **63,424 B** |

- 근거리(줌 ≥ 19) 비용의 84% 는 다리 DQS 자세 계산(P5). LOD1 은 다리 정점이 같아 이 비용이 그대로 → 이득 ≈ 5%. **제외.**
- 원거리(줌 < 19)는 자세 계산을 이미 건너뛰고(`shouldAnimateRiderPose`) 흔들림도 꺼진다. 이 구간을 1콜 LOD2 로 그리면 라이더 1명당 14 → 1 콜.
- 근거리 비용의 근본 해결(GPU 스키닝)은 별도 과제로 남긴다.

## 1. 입력

| 파일 | SHA-256 | 크기 |
|---|---|---:|
| rider 작업 폴더 `out\rider_s6_LOD2_meshopt.glb` | `14c5956eb3a461e87c1e86df095be877e9e2645cbd3216ea55a0e8d3f5c10668` | 63,424 |

- 노드 1개 `rider__Palette`(translation·scale 있음 → 로드 후 `matrixWorld` 로 bake), 머티리얼 `Rider palette`(LOD0 과 같은 `palette.colorSlots`), `_SWAY` 포함(사용 안 함), 장면 extras `lod: "lod2"`.

## 2. 설계

### 2.1 자산

rider14 후보 폴더 `apps/web/public/rider/preserved/candidates/20261015-212136-df8de090/` 에 **`rider-lod2.glb`** 를 바이트 복사로 추가. `candidate.json` 에 `files.lod2 = "rider-lod2.glb"`, `lod2SourceSha256`, `lod2StagedSha256` 추가(다른 필드 불변). 스테이징 스크립트 `stage-rider14.mjs` 에 `--lod2-only` 같은 추가 모드를 두거나 별도 `stage-rider14-lod2.mjs` — 해시 검증·덮어쓰기 금지 규칙은 같게.

### 2.2 로드 순서

LOD0 리그 준비(`loadState = "ready"`) **뒤에** LOD2 를 백그라운드로 받는다(첫 표시 시간 영향 없음). LOD2 가 아직 없거나 실패하면 지금처럼 LOD0 으로 그린다(실패는 DEV 경고만). `PRESERVED_RIDER_MODELS` 항목에 `lod2?: string` 파일명 — s5 는 없음.

### 2.3 정적 메시 `PreservedRiderStatic` (신규, `riderPrototype/preservedRiderStatic.ts`)

- 장면을 리그와 같은 방식으로 bake(`bakeFloat32Attributes` → `applyMatrix4(matrixWorld)`), 메시 1개를 `Group` 에 담는다. `frustumCulled = false`.
- 컬러 키트: 같은 `RiderModelProfile.createVisualKit` 로 `setVisualKind(kind)`.
- `dispose()`: 지오메트리·머티리얼·텍스처·키트.

### 2.4 그리기 선택

레이어 render 루프에서 라이더마다:
- `useLod2 = lod2Ready && !animatePose` (= 줌 < 19). **본인·동행·페이서 모두** 같은 규칙(이 줌에서 라이더는 점 크기라 구분 의미 없음).
- `useLod2` 면 LOD2 그룹만 보이게, 리그 그룹은 숨김 → `setVisualKind` → 같은 모델 행렬(lean 포함, 흔들림은 envelope 0) → `render`.
- 아니면 지금 그대로.
- 계약 시험이 보는 문자열 유지.

### 2.5 전환

줌 19 경계에서 LOD0(현재 위상 자세) ↔ LOD2(크랭크 0° 자세) 로 바뀌며 다리가 순간 바뀐다. 지금도 줌 19 아래에서는 다리 자세가 멈추므로 같은 종류의 변화다. 육안(GW2)에서 확인하고, 거슬리면 경계에 0.3 줌 히스테리시스를 둔다(기본은 없음).

## 3. 단계와 게이트

| 단계 | 내용 | 게이트 |
|---|---|---|
| **L1 구현** | 2.1–2.4 + 시험 | tsc 0, 변경 파일 eslint 0, `test:rider-preserve` 전부 통과. 신규: LOD2 스테이징 해시, 정적 메시 bake(정점 수 6,644·삼각형 5,648, Float32), 키트 칸 색, `useLod2` 선택 규칙(순수 함수로 분리해 시험), 자원 해제 |
| **L2 육안·성능** | 줌 17·15 에서 LOD0/LOD2 나란히(DPR 크롭), 줌 19 경계 전후, 벤치 4줌 측정 | 줌 17·15 1명당 드로우콜 **1**, 줌 19·22 는 14 그대로·ms 변화 없음, 첫 표시 악화 없음 → **Chief 육안** |
| **L3 배포** | 미리보기 → Chief → 병합·푸시·운영 | Chief 지시 |

## 4. 롤백

`PRESERVED_RIDER_MODELS.rider14.lod2` 를 지우면(한 줄) LOD2 를 받지도 쓰지도 않는다.
