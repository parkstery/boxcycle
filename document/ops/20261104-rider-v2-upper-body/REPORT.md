# RIDER15-P0-BASELINE 보고서

- 상태: `P2_SPIKE_PASS`
- 작성일: 2026-11-04 KST
- 실행 폴더: `C:\20.HDev\boxcycle`
- 작업 지시: `INSTRUCTION.md`

## 0. 화면에서 보이는 결과

이번 단계는 렌더·런타임 변경 전 기준선 고정 단계다. 새 rider15 동작은 아직 구현하지 않았다.

## 1. 실행 결과

| 확인 | 결과 |
|---|---|
| `node scripts/handoff-check.mjs` | 실행됨; 기존 HANDOFF가 최신 변경보다 오래되어 WARN |
| 브랜치 | `main2` |
| HEAD | `b92b23f5` |
| 원격 대비 | 앞 0 / 뒤 0 |
| 기존 변경 | 36개 변경 및 6개 미추적 항목 존재; 보존 대상 |
| rider-v2 문서 | 기존 README는 `AWAITING_CHIEF`; 이번 사용자 지시로 착수 승인됨 |
| 제품 코드·제품 GLB | 이번 단계에서 변경 없음 |

## 2. 입력 자산 기준선

| 자산 | SHA256 |
|---|---|
| `roadcyclist_natural_joint_skin.blend` | `24c1f788f7527cffc33d03d26f03120c7bbe92b9ec70d45f280b60597634a40c` |
| `roadcyclist_natural_joint_skin.glb` | `408e784a02177c57d1ad1c6172175a7ff3cfc97cc1713fdff752d25b562bc573` |

원본 경로:

`C:\Users\kdrea\OneDrive\Documents\img\helmet_fix\revision\20260919-natural_joint_skin\`

후보 출력 경로:

`C:\20.HDev\boxcycle\apps\web\public\rider\preserved\candidates\<candidateId>\`

## 3. 확인된 작업 구조

- 기존 앱에는 `rider-preserve` 검증 하네스가 존재한다.
- 팔 IK 재사용 후보는 `apps/web/src/lib/rider/riderGlbPedalPose.pose.mjs`다.
- 상체·보존 라이더 경로는 `apps/web/src/lib/riderPrototype/preservedRiderRig.ts`, `riderGpuSkin.ts`, `riderPreservedLayer.ts`를 우선 확인해야 한다.
- 기존 저장소 인계 문서는 Mapbox 경로의 스키닝 한계를 기록하고 있으므로, 상체 표준 스킨을 제품에 넣기 전에 실제 렌더 경로를 별도 기술검증해야 한다.

## 4. P1 렌더 경로 감사 결과

### 확인된 사실

1. `riderPreservedLayer.ts`는 Mapbox `CustomLayerInterface` 안에서 Three.js `WebGLRenderer`와 `GLTFLoader`를 사용한다. 따라서 표준 glTF 스킨 후보를 Three.js 장면에 격리해 그릴 수 있는 기술적 위치는 존재한다.
2. 현재 로딩은 `gltf.scene`을 `PreservedRiderRig`에 전달하고, `PreservedRiderRig`가 일반 `Mesh`를 복제해 rider14 다리 메시를 자체 DQ 경로로 구동한다.
3. `PreservedRiderRig`의 GPU 스킨은 현재 `profile.id === "rider14"`일 때만 허용된다. 상체 표준 스킨을 자동으로 처리하지 않는다.
4. `riderGpuSkin.ts`는 기존 다리용 4본 DQ GLSL과 CPU 대조 하네스다. rider15 상체의 표준 `JOINTS_0`/`WEIGHTS_0` 경로와는 별도 검증이 필요하다.
5. 팔 IK와 `handErr` 계산은 `riderGlbPedalPose.pose.mjs`에 재사용 후보로 존재하지만, 현재 모델 프로필과 노드 계약에 연결된 상태는 아니다.
6. 현재 LOD2는 `PreservedRiderStatic`으로 별도 정적 GLB를 로드한다. rider15 LOD1/LOD2는 별도 후보 자산과 전환 계약이 필요하다.

### 판정

`P1 PASS WITH ARCHITECTURE GATE`.

표준 스킨을 구현할 수 있는 Three.js 렌더 위치는 확인됐지만, 현행 rider14 전용 리그에 rider15를 직접 얹는 것은 금지한다. 다음은 별도 후보 GLB와 격리된 `SkinnedMesh` 기술검증이어야 한다.

## 5. 다음 작업 제안

`RIDER15-P2-SKINNEDMESH-SPIKE`를 만든다.

- 입력: 표준 `skins:1`, `JOINTS_0`, `WEIGHTS_0`를 가진 최소 상체 테스트 GLB
- 출력: 제품 경로 밖의 `.out/rider15-spike/` 렌더 결과와 구조 보고서
- 검증: 본 회전, 상체 변형, `COLOR_0`/팔레트 머티리얼, Mapbox 커스텀 레이어 합성, GPU 성능
- 금지: 제품 GLB 교체, rider14 회귀 경로 변경

## 6. 미실행

- 실제 rider15 GLB 제작
- Blender 스킨 export
- 제스처·지면 접지 코드
- 브라우저 렌더 캡처
- 성능 수치 확정

## 7. P2 표준 SkinnedMesh 스파이크 결과

추가 파일: `apps/web/scripts/rider-preserve/rider-standard-skin-spike.test.ts`

실행 명령:

```powershell
cd C:\20.HDev\boxcycle\apps\web
node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/rider-preserve/rider-standard-skin-spike.test.ts
```

결과: **2 tests, 2 pass, 0 fail**.

확인한 내용:

- 하나의 `SkinnedMesh`에서 어깨·팔꿈치에 해당하는 두 본이 서로 다른 정점을 변형한다.
- 본 회전 후 변형 정점 위치가 rest 위치와 달라진다.
- 본 회전 시 geometry의 원본 position 버퍼는 변경되지 않는다.
- 현재 Three.js/TypeScript 테스트 환경에서 표준 스킨의 최소 동작은 성립한다.

한계:

- 실제 rider15 GLB를 아직 만들지 않았다.
- Mapbox 실화면 합성, 팔 IK, 팔레트 재칠, `COLOR_0`, 성능은 아직 미검증이다.
- 따라서 rider15 제품 통합 또는 rider14 활성 모델 교체는 아직 금지한다.

## 8. 다음 작업

`RIDER15-P3-GLB-STRUCTURE-AUDIT`: 실제 후보 GLB가 생성되면 `skins:1`, 본 이름/계층, `JOINTS_0`, `WEIGHTS_0`, 재질 수, 삼각형 수, extras와 byte/hash를 읽기 전용으로 감사한다. 후보 GLB가 없으면 먼저 모델러 입력·export 계약을 확정한다.

P3 감사기 `apps/web/scripts/rider-preserve/audit-rider-glb-structure.mjs`를 추가했다. 실제 rider15 후보가 없으므로 현재 rider14 제품 후보를 기준 동작 확인에 사용한다. rider14에서 `skins:0`이 출력되는 것은 예상된 baseline이며 rider15 승격 판정이 아니다.

현재 rider14 baseline 감사 결과:

| 항목 | 결과 |
|---|---:|
| 파일 크기 | 245,120 B |
| SHA256 | `df8de090b068f1a8734482ae5698bd578140b387fd3eb1947fd9839d5e4fe54d` |
| 노드/메시 | 14 / 14 |
| 삼각형 | 29,604 |
| 재질 | 1 |
| skins / animations | 0 / 0 |
| `JOINTS_0` / `WEIGHTS_0` | 없음 / 없음 |

판정: **P3 도구 PASS, rider15 후보 미착수**. 현재 제품 후보를 rider15로 교체하지 않는다.


