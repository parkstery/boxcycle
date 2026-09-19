# Modelling 라이더 교체 — 단계 0 (외형 보존 경량화 후보)

| 항목 | 내용 |
|---|---|
| 문서 유형 | **record** — 단계 0 실행·검증 기록 |
| 최초 작성 | 2026-09-13 |
| 상태 | **검토됨** — 도구 실행 및 이미지 확인 완료. 사용자 단계 0 승인은 미수신 |
| 연결 문서 | [교체 실행 계획](../260910-Modelling-라이더-교체-실행계획.md) · [최신 인계 조건](../260912-Modelling-최신라이더-인계조건.md) · [9월 11일 기준선](260911-Modelling-라이더-교체-단계0-기준선.md) · [하네스](../../apps/web/scripts/rider-cycle-fit/HARNESS.md) |

## 1. 인수 대상과 해시 대조

제작 작업 **라이더 가슴과 어깨 형태 수정** (`01a095e1-020e-7023-911f-7a4fa6c7059a`)의 외형 보존 우선 경량화 릴리스다. 폴더는 `C:/Users/kdrea/OneDrive/Documents/img/helmet_fix/revision/appearance_preserved_lod/`.

| 파일 | 전달값 SHA-256 | 실측 | 판정 |
|---|---|---|---|
| `roadcyclist_appearance_preserved.blend` | `17397cca…2796` | `17397cca…2796` | **일치** |
| `roadcyclist_appearance_preserved.glb` | `a02d531b…7120` | `a02d531b…7120` | **일치** |

제작 측 `handoff_manifest.json`의 바이트 수(1,132,609 / 2,158,348)와 export 설정(`use_selection=True`, `export_format='GLB'`, `export_animations=False`, Blender 5.2.0 LTS)도 함께 사본에 보존했다.

## 2. 도구 확장

기존 `register-modelling-baseline.mjs`는 9월 11일 릴리스의 파일명·source task·blend 경로가 코드에 고정되어 있어 새 릴리스에 쓸 수 없었다. [인계 조건 §5-2](../260912-Modelling-최신라이더-인계조건.md)에 따라 **모든 입력을 명시 인자로 받도록 확장**했다(`--release` / `--rider-glb` / `--rider-blend` / `--source-task` / `--evidence` / `--legacy` / `--blender`). 폴더 자동 탐색은 넣지 않았다 — 작업 중 파일이나 구형 릴리스가 섞이는 경로를 애초에 만들지 않기 위함이다. 필수 인자 누락과 존재하지 않는 증거 파일은 즉시 실패한다.

`inspect-modelling-baseline.py`가 열던 blend 경로도 하드코딩을 제거하고 manifest의 `selectedRiderBlend`를 따르게 했다. manifest는 `schemaVersion: 2`로 올리고 `selectedRiderBlend`·`releaseDirectory`를 추가했다.

## 3. 실행 결과

- candidateId: `20260913-162030-d32f2fc2`
- 상태: `READY_FOR_STAGE_0_REVIEW`; manifest의 `approval`은 `null`.
- 시작 revision: `0b0cde5`.
- Blender: 5.2.0 LTS, Cycles CPU, 16 samples, 900×760, 직교 카메라 2.2 m — 9월 11일 기준선과 동일 설정이라 그림을 그대로 비교할 수 있다.
- 릴리스 원본·제작 증거 24종·현재 제품·앱 rig/geometry/카메라 코드·하네스·기존 fit 출처를 합쳐 **48개 파일**을 사본으로 보존. 렌더 종료 후 **원본과 사본 해시 재검증 PASS**.
- Blender 조사·렌더 프로세스 exit 0. PNG 4장 해시·해상도 검증 PASS, 이미지 4장 직접 확인.
- 제품 GLB·앱 런타임 코드 변경 없음. 피팅·모델 export·승격 없음.

## 4. 새로 확정한 사항

**리깅은 여전히 없다.** 최신 blend에도 armature 0개, action 0개다. vertex group은 `Rider anatomical torso shoulders and pelvis` 메시 하나에만 `Shoulder blend`·`Upper garment blending`(×2) 3개가 있을 뿐이다. GLB 쪽에는 vertex group이 남지 않는다. 따라서 **본 가중치 기반 분해기를 재사용할 수 없고, A 단계에서 명시적 메시→부위 매핑을 만들어야 한다**는 9월 11일 결론이 최신 릴리스에도 그대로 적용된다.

메시 구성은 214개, 재질 24종, collection 3개(`RIDER - riding pose` 70개, `BICYCLE - complete road bike` 130개, `HELMET - vented shell / liner / retention` 14개). blend에는 메시 외에 EMPTY 56·LIGHT 3·CAMERA 1이 더 있으나 GLB에는 메시 214개만 들어온다.

실제 정점 AABB(진행축 × 폭 × 높이, Blender 좌표):

| 입력 | 진행축 | 폭 | 높이 |
|---|---:|---:|---:|
| 현재 제품 | 1.6389 m | 0.4869 m | 1.4556 m |
| 새 후보 | 1.6663 m | 0.5432 m | 1.6303 m |

blend와 GLB의 AABB가 소수점 이하까지 동일해 **export 과정의 형상 변형이 없다**. 9월 11일 원본의 높이 1.7003 m보다 낮아졌는데, 이는 경량화가 아니라 그 사이 제작된 머리·헬멧 수정의 결과다.

**정점 수는 62,197개로 현재 제품 18,764개의 3.3배다.** 제작 측 보고는 삼각형 기준 50,782개(원본 대비 41.5% 감량)다. 경량화를 거친 뒤에도 제품 대비 부담이 크다는 뜻이며, 목표 기기 성능 검증은 D 단계 과제로 남는다. 이 수치는 앱 프레임 측정 결과가 아니다.

제작 측이 보고한 최대 표면 편차 0.894 mm, 접촉 쌍 464개 보존, 비매니폴드 0개는 **전달받은 검증 기록**이며 boxcycle에서 재현한 값이 아니다.

## 5. 이미지 해석

두 입력 모두 저장된 변환 그대로다. 같은 카메라·배율·조명을 적용했지만 **같은 페달 위상으로 맞추지 않았다**. 현행 제품은 앱이 관절 회전을 적용하기 전 rest 자세여서 팔다리가 내려가고 이음매가 어긋나 보인다. 이를 현행 앱 주행 화면의 모습이나 새 후보의 회귀로 해석하지 않는다. 단계 0 자료이며 정적 피팅 승인 자료는 B 단계에서 만든다.

후보 폴더는 로컬 산출물이며 gitignore 대상이다. `snapshots/`는 승인·교체·원복이 끝날 때까지 보존한다.

- [manifest](../../apps/web/scripts/rider-cycle-fit/.out/candidates/20260913-162030-d32f2fc2/manifest.json)
- [Blender 노드·그룹·좌표 조사](../../apps/web/scripts/rider-cycle-fit/.out/candidates/20260913-162030-d32f2fc2/inventory.json)
- [현재 제품 측면](../../apps/web/scripts/rider-cycle-fit/.out/candidates/20260913-162030-d32f2fc2/current-side.png) · [현재 제품 사선](../../apps/web/scripts/rider-cycle-fit/.out/candidates/20260913-162030-d32f2fc2/current-threequarter.png)
- [새 후보 측면](../../apps/web/scripts/rider-cycle-fit/.out/candidates/20260913-162030-d32f2fc2/modelling-side.png) · [새 후보 사선](../../apps/web/scripts/rider-cycle-fit/.out/candidates/20260913-162030-d32f2fc2/modelling-threequarter.png)

## 6. 남은 것

사용자 단계 0 승인 대기다. 승인 후 A(부위/앵커 매핑) → B(정적 결합) → C(페달 8위상) → D(앱 후보) → E(교체) 순서로 진행한다. 승인은 candidateId `20260913-162030-d32f2fc2`와 단계에 기록한다. 이전 후보 `20260911-184054-afc08cbf`의 검토 결과는 이 후보로 승계하지 않는다.
