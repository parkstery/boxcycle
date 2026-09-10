# Modelling 결과물의 RTW 라이더 교체 실행 계획

| 항목 | 내용 |
|------|------|
| 문서 유형 | **execution** — 외부 제작 라이더의 앱 호환 변환·검증·교체 계획 |
| 최초 작성 | 2026-09-10 |
| 상태 | **초안** — 결과물·현행 코드·GLB 구조 조사 완료, 모델 교체 미실행 |
| 요청 | Modelling 프로젝트의 **블렌더 라이더 모델 수정** 결과물을 boxcycle 현재 라이더와 교체할 계획 수립 |
| 연결 문서 | [결합 스킬](../.agents/skills/rider-cycle-fit/SKILL.md) · [결합 하네스](../apps/web/scripts/rider-cycle-fit/HARNESS.md) · [Skill/Harness 구조](260722-Skill-Harness-아키텍처.md) |

이식 권고안은 **수정된 라이더 전체 외형을 앱의 명명 관절 노드 구조로 변환하고, 현재 자전거와 결합**하는 것이다. 헬멧만 바꾸는 작업이 아니다. 빨간 저지·검은 하의·수정된 머리 방향·어깨·헬멧을 포함한다. 자전거까지 교체한다는 요청은 없으므로 현행 자전거를 기본 입력으로 삼는다. 접점 정합에 필요한 안장·후드 조정은 후보에서 검증하며, 체형을 임의로 늘이거나 줄이지 않는다.

## 1. 교체할 입력과 확인한 차이

원본 작업 ID: `01a087cb-4923-7872-b8c0-74d5a7217959` (Modelling / **블렌더 라이더 모델 수정**).

원본 폴더: `C:/Users/kdrea/OneDrive/Documents/img/helmet_fix/revision/`

| 파일 | 역할 |
|---|---|
| `roadcyclist_reference_revised.blend` | 편집 원본. 라이더·자전거·헬멧·스튜디오 포함 |
| `roadcyclist_reference_revised.glb` | 교체 외형의 기준 입력. 라이더와 자전거 전체, 정적 자세 |
| `aero_vent_helmet.glb` | 헬멧 단독 참조. 이것만 이식하면 전체 라이더 교체가 완료되지 않음 |
| `rider_full.png`, `rider_profile.png`, `rider_front.png`, `rider_rear.png` | 원본 외형 대조 자료 |
| `validation.json`, `수정내역.md` | 제작 검증과 변경 내역. 앱 페달링 검증을 대신하지 않음 |

현재 제품: `apps/web/public/rider/prototype/rider-lowpoly.glb`.

두 GLB를 읽어 비교했다. 크기는 scene world 변환을 적용한 **실제 POSITION 정점**의 AABB이며, 현재 제품의 `groundShadow`는 제외했다. 아래는 저장된 정적 자세의 값으로, 앱 회전 오버라이드 적용 후 동작 범위는 실행 단계에서 별도로 잰다.

| 항목 | 현재 제품 GLB | Modelling 결과 GLB |
|---|---:|---:|
| 파일 크기 | 1,252,188 bytes | 2,102,080 bytes |
| scene 노드 | 225 | 207 |
| 고유 mesh 정의 | 179 | 159 |
| 재질 | 14 | 21 |
| 그림자 제외 노드별 삼각형 합계 | 23,814 | 89,521 |
| 크기: 진행축 × 높이 × 폭 | 1.6389 × 1.4556 × 0.4869 m | 1.6659 × 1.7003 × 0.5334 m |
| skin / animation clip | 0 / 0 | 0 / 0 |
| 앱 필수 회전 노드 | 14개 모두 존재 | 14개 모두 없음 |
| scene 구조 | `RiderBike` 아래 관절 계층 | 207개 노드가 scene 최상위에 배치 |

SHA-256 기준선:

- 현재 제품: `a9d0d6716c09a1edcd02bb968a07d16e0cf1f625ced7c33b19a5ef499f5268b8`
- Modelling GLB: `f5db25ff7b96068351993f799e4a7ebbc41350e9ce1aefd0eac3afb4a7c882e0`

실행 시작 시 해시를 다시 확인한다. 달라졌다면 위 조사 결과를 그대로 적용하지 않고 새 입력으로 등록한다. 원본 검증 자료는 Blender 재가져오기에서 89,520개 삼각형과 표면 비교 불일치 0개를 보고한다. 여기의 89,521개는 파일에 저장된 primitive/index 기준이며 집계 방식 차이를 구분한다.

## 2. 파일 복사만으로 교체할 수 없는 이유

[config.ts](../apps/web/src/lib/riderPrototype/config.ts)의 `riderPrototypeGlbUrl()`이 제품 파일을 가리키고, [glbModelLayer.ts](../apps/web/src/lib/riderPrototype/glbModelLayer.ts)가 같은 URL로 내 라이더와 동행 모델을 만든다. 로컬 `.env`/`.env.local`에서는 `VITE_RIDER_PROTOTYPE=glb`가 확인됐다. 배포 환경 값은 이번 조사에서 확인하지 않았다.

앱은 animation clip을 재생하지 않고, `nodeOverrideNames`와 feature-state 회전값으로 다음 노드를 움직인다.

```text
crank → pedal_l, pedal_r
leg_l → leg_l_shin → ankle_l
leg_r → leg_r_shin → ankle_r
arm_l → arm_l_fore
arm_r → arm_r_fore
torso
```

노드 이름뿐 아니라 **관절 원점·부모 계층·rest 방향·회전 합성**이 맞아야 한다. 사지는 로컬 −Y 기준이고, 앱 좌표는 m / +X 진행 / +Y 위 / +Z 라이더 왼쪽이다. Blender→glTF 축 변환을 두 번 적용하면 안 된다. 구형 소스의 L/R 본 이름을 새 모델의 좌우에 그대로 대입하지 않는다.

앱의 인체 길이와 접점은 [riderRig.geometry.mjs](../apps/web/src/lib/riderPrototype/riderRig.geometry.mjs)에 현행 V2 실측값으로 들어 있다. 새 모델에 이 값을 그대로 적용하면 손·발·어깨가 분리될 수 있다. 새 원본의 관절과 접점을 실측해 이 정의와 후보 GLB를 함께 맞춘다. 자전거 치수는 [geometry.json](../apps/web/src/lib/riderPrototype/geometry.json)을 기준으로 검산한다.

## 3. 실행 순서와 단계별 완료 조건

| 단계 | 작업 | 산출물·통과 조건 |
|---|---|---|
| **0. 입력 고정** | 기존 제품·rig·geometry·scale·빌드 기준을 원복 묶음으로 보존. 원본 blend/GLB/검증 자료와 변환 도구·Blender 버전을 해시로 고정 | 입력 manifest, 현행 기준 렌더, `candidateId`. 원본 보존 및 경로 추적 가능 |
| **A. 분류·앵커 등록** | 원본의 라이더/자전거 메시를 명시적 목록으로 분류. 골반·좌골·어깨·팔꿈치·손 grip·고관절·무릎·발목·밑창·클릿 및 자전거 접점 실측. 현행 제품에서 라이더를 제외한 자전거 후보 추출 | mesh→부위 매핑, 변환행렬, 앵커 manifest. 라이더·자전거 중복/누락 0. 이름 없는 `Mesh_*`는 눈으로 확인한 목록을 고정 |
| **B. 정적 결합** | 새 라이더의 비율과 외형을 보존하며 단위·배치를 정규화. 현행 자전거에 맞추고, 손·좌골 목표에 필요한 자전거 조정은 geometry에서 일관되게 파생. crank 고정, sway/bob 없음 | 측면·정면·상단·후방 및 손/안장/발 확대 Blender PNG. 원본 외형과 접점 모두 확인 |
| **C. 동작 호환 변환** | 라이더를 몸통·상하완·대퇴·정강이·발로 귀속시키고 피벗/부모/rest 축 구성. 머리·헬멧·스트랩은 몸통과 함께 이동. 기존 자전거 crank/pedal 구조 연결. 새 실측 rig로 동일 phase 구동 | 14노드 계약. 0/45/90/135/180/225/270/315° 렌더와 실제 GLB 노드 변환 검산. 팔다리 단절·관통·헬멧 분리 없음 |
| **D. 앱 후보 검증** | 후보 GLB의 재질·크기·지면·카메라 정합, 성능 비교, GLB 재가져오기 형상 검증. 후보 파일을 읽는 로컬 프리뷰 경로 제공 | 내 라이더·동행 렌더, 정지/재출발·페달 회전·방향·카메라 검증 증거. 최종 GLB 해시와 연동 코드 diff 확정 |
| **E. 교체·회귀** | 검토한 최종 GLB를 제품 경로로 byte-for-byte 복사. 대응 rig·scale·필요한 URL 버전을 같은 변경 단위로 반영 | 복사 전후 SHA 일치, build 및 주행 진입 회귀, 내 라이더·동행의 새 모델 표시 확인. 원복 가능 |

후보는 `apps/web/scripts/rider-cycle-fit/.out/candidates/<candidateId>/`에 만든다. ID는 스킬의 `YYYYMMDD-HHmmss-<shortInputHash>` KST 규칙을 따른다. 입력·변환 코드·export 설정이 바뀌면 새 ID를 사용한다. 최종 검토 후 다시 export하지 않는다.

실행 시 [rider-cycle-fit 스킬](../.agents/skills/rider-cycle-fit/SKILL.md)의 **“단계별 승인: 각 단계(0/A/B/C/D/E) 그림 승인 후 다음”**, **“사용자 승인 전 페달 애니메이션으로 넘어가지 않는다”**를 적용한다. 그림·수치·후보 파일을 먼저 준비한 뒤 해당 단계 승인을 받는다. 이번 요청은 계획 수립이므로 지금 후보 승인이나 교체 승인을 요청할 단계가 아니다.

### 변환 방법의 우선순위

1. 새 GLB는 skin이 없고 부품이 분리되어 있으므로 **기존 메시를 관절별로 묶고 피벗을 구성**하는 방법부터 검증한다. 단순 rename으로 끝내지 않는다.
2. 무릎·팔꿈치처럼 여러 관절에 걸친 메시가 있으면 필요한 부분만 분할하고 단면/이음새를 처리한다. 헬멧·의복을 절차 생성기로 다시 만들지 않는다.
3. 정적 메시만으로 안정적인 관절 구분이 안 되면 `.blend` 내부의 그룹/원형 데이터 유무를 확인한다. 없으면 후보에서 편집용 rig/그룹을 복구하고 앱용 강체 노드로 export한다. 해당 비용은 아직 미확정이다.
4. 주행 렌더러 전체를 교체하거나 스키닝 엔진을 새로 도입하는 작업은 이 계획의 기본 경로에 포함하지 않는다. 기존 경로로 외형 품질을 유지할 수 없다는 증거가 나올 때 별도 설계를 검토한다.

## 4. 재사용할 코드와 먼저 보완할 검증

| 대상 | 사용할 부분 / 필요한 변경 |
|---|---|
| `scripts/rider-cycle-fit/register-inputs.mjs` | 해시·manifest 틀 재사용. 구형 OneDrive 기본 경로를 쓰지 않고 새 입력을 명시. 새 변환기·부위 매핑·앵커·export 설정도 해시 대상에 추가 |
| `blender/rider-cycle-fit/decompose-v2-rider.py` | 관절 피벗·축·계층 구성 참고. 기존 V2 armature/vertex group과 `render-all.py`에 묶여 있어 새 정적 GLB에 그대로 실행할 수 없음 |
| `scripts/rider-cycle-fit/merge-rider-into-cycle.mjs` | 호환 노드가 만들어진 **후** 자전거와 병합. 현재 `torso/leg_l/leg_r/arm_l/arm_r`가 없는 새 원본에는 바로 사용 불가 |
| `scripts/rider-cycle-fit/verify-node-rotation.mjs` | Mapbox 방식 회전 합성 검산 재사용 |
| `scripts/rider-cycle-fit/verify-rider-pose-gate.mjs` | 도달·pivot·밑창·관통 검사 재사용. 기존 정점 수·메시·각도 가정을 새 입력 기준선으로 분리 |
| `scripts/rider-cycle-fit/joint-continuity.mjs` | 관절의 끊김·잘록함 검사 재사용. 새 후보 부위 분류와 카메라에 연결 |
| `scripts/rider-preview/verify-rider-glb.mjs` | 현재 필수 노드 6개, 옛 높이/길이 범위, TS 파일의 옛 상수 파싱에 의존. **14노드 + 실제 rig 모듈 + 후보 측정값** 기준으로 보완 후 사용 |
| `scripts/rider-cycle-fit/HARNESS.md` | 문서의 구형 본 길이·미구현 표기와 현재 실행 코드가 어긋난 부분을 실제 재사용 범위에 맞춰 갱신 |

`config.ts`의 전고 주석 1.263 m는 현재 제품 실측 1.4556 m와 다르다. 현재 scale 1.15와 카메라 기준을 옛 주석으로 다시 계산하지 않는다. [rideCameraFraming.ts](../apps/web/src/lib/rideCameraFraming.ts)는 `HEAD_C`, `PELVIS_ROOT`, 어깨 폭, model scale을 사용하므로 새 후보의 머리·헬멧 상단과 골반에 맞춰 검증한다. 모델 키 차이만큼 무조건 축소하지 않고, 휠 크기·신체 비율·목표 표시 크기를 함께 본다. 자이언트 배율 변경은 이 교체 작업에 포함하지 않는다.

## 5. 합격 기준과 실제 시험

- **외형:** 수정된 헬멧 통풍구·저지·하의·머리 각도를 원본과 동일 카메라/조명으로 비교. 기존 제품과도 같은 조건의 Before/After 제공. 원본 대비와 제품 대비는 서로 다른 비교임을 표시한다.
- **구조:** 14개 회전 노드 모두 존재하며 고유함. 사지 pivot이 rig와 일치하고 rest·부모 변환이 명시됨. 사용하지 않는 원본 자전거/스튜디오가 후보에 중복 포함되지 않음.
- **동작:** 8위상에서 좌우 crank 180° 차이, 발과 crank 위상 일치, 밑창 수평 오차 ≤2°, 밑창–페달 상면 오차 ±3 mm. 손–후드와 좌골–안장 오차는 실제 표면/앵커에서 측정하고 B 단계에서 허용치를 확정한다. IK 목표값만 비교해 오차 0으로 보고하지 않는다.
- **관절:** 정면 무릎 방향, BDC 과신전, TDC 복부/프레임 관통, 팔꿈치·무릎·발목 실루엣 단절을 검사한다. 기존 품질 게이트의 허용치를 느슨하게 만들어 통과시키지 않는다.
- **표시:** 지면 접촉, 동서남북 진행 방향, 정지/재출발, 근접·기본 거리, 좌/우/후방 카메라, 데스크톱·폰 세로/가로에서 확인. 머리·헬멧·발 잘림과 HUD 겹침을 확인한다.
- **성능:** 동일 기기/해상도/경로에서 기존/후보의 1·5·10개 라이더를 비교한다. 파일 요청·첫 표시 시간·프레임시간 p50/p95·메모리를 기록한다. 초기 제안 게이트는 p95 프레임시간 악화 10% 이내이며, 실행 기준선 측정 때 확정한다. 삼각형 약 3.8배는 위험 신호이고 GPU 부하 3.8배를 의미하지는 않는다. 실패 시 보이지 않는 면·중복 재질·과밀 헬멧 메시부터 후보에서 최적화하고 외형 재검토한다.
- **코드/주행:** 보완된 GLB 검사와 pose/rotation 게이트, `npm --workspace apps/web run test:ride-camera-framing`, `npm --workspace apps/web run build`, `npm --workspace apps/web run test:e2e:ride`를 실행한다. 진입 시험은 [ride-verify](../.agents/skills/ride-verify/SKILL.md)를 적용하며, 진입 green만으로 GLB가 보이고 페달링한다고 판정하지 않는다. 실제 model URL 로드·내 라이더와 동행 표시 증거를 추가한다.

기존 제품에 대해서도 먼저 같은 검사를 실행해 현재 실패와 교체로 생긴 실패를 구분한다. 브라우저 검증이 5분간 진전이 없으면 서버·포트·로그 확인 후 headless/단일 worker/기존 서버 재사용으로 전환한다.

## 6. 교체와 원복 단위

교체는 **GLB + rig 치수/피벗 + 필요한 자전거 geometry + scale/카메라 기준 + 검증 fixture**를 묶어 한 변경 단위로 진행한다. 원본 결과물을 그대로 제품 경로에 덮는 것이 아니라, 외형을 보존해 변환하고 검토한 최종 후보를 복사한다.

동일 URL의 브라우저 캐시가 남는지 확인하고 필요하면 `riderPrototypeGlbUrl()`에 후보 콘텐츠 해시 기반 버전을 붙인다. 빌드 결과의 GLB 해시·실제 요청 URL을 확인한다. 배포는 로컬 교체 검증 이후 별도 실행 단계로 다룬다.

문제가 생기면 보관한 이전 **GLB와 대응 코드 묶음**을 함께 복원하고 해시 및 로드 URL을 확인한다. 새 rig에 이전 GLB만 끼우는 원복은 금지한다. 다른 작업의 변경을 되돌리는 저장소 전체 reset은 사용하지 않는다.

완료 조건은 새 외형·접점·페달링·내 라이더/동행 표시·성능 게이트 통과와 원복 묶음 보존이다. 이후 기능 상태가 실제로 바뀌었을 때 상태보드와 결정 로그를 갱신한다. 이번 계획 작성에서는 제품 GLB·앱 코드·기능 상태를 변경하지 않았다.

## 7. 착수 시 남은 확인 사항

원본 GLB의 구조·해시·정점 크기와 제작 작업의 최종 결과는 확인했다. `.blend` 내부의 부위 그룹/rig 재사용 가능성, 실제 정적 접점 오차, 8위상 변형 품질, 목표 기기의 성능은 아직 검증하지 않았다. 따라서 **0/A 단계의 첫 산출물은 입력 manifest와 부위/관절 매핑**이며, 이 결과로 변환 난이도와 후속 일정을 확정한다.
