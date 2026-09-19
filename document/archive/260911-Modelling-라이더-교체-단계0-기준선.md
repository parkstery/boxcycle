# Modelling 라이더 교체 — 단계 0 기준선

| 항목 | 내용 |
|---|---|
| 문서 유형 | **record** — 단계 0 실행·검증 기록 |
| 최초 작성 | 2026-09-11 |
| 상태 | **검토됨** — 도구 실행 및 이미지 확인 완료. 사용자 단계 0 승인은 미수신 |
| 연결 문서 | [교체 실행 계획](../260910-Modelling-라이더-교체-실행계획.md) · [하네스](../../apps/web/scripts/rider-cycle-fit/HARNESS.md) |

## 실행 결과

- candidateId: `20260911-184054-afc08cbf`
- 상태: `READY_FOR_STAGE_0_REVIEW`; manifest의 `approval`은 `null`.
- 시작 revision: `326c22f` (전체 SHA는 manifest).
- Blender: 5.2.0 LTS, Cycles CPU, 16 samples, 900×760, 직교 카메라 2.2 m.
- 원본·현재 제품·관련 코드·제작 증거·기존 fit 출처 34개 파일을 사본으로 보존. 렌더 종료 후 **원본과 사본 해시 재검증 PASS**.
- Blender 입력 검사와 렌더 프로세스 exit 0. PNG 4개 해시·해상도 검증 PASS, 이미지 4개 직접 확인.
- 제품 GLB·앱 런타임 코드 변경 없음. 피팅·모델 export·승격 없음.

## 새로 확정한 사항

`roadcyclist_reference_revised.blend`에는 207개 메시가 있고 **armature, vertex group, action이 모두 없다**. GLB만 리깅을 누락한 상태가 아니다. 다음 단계는 분리 메시를 신체 부위에 귀속시키고 관절 위치를 측정하는 작업이다.

실제 정점 AABB(진행축×높이×폭): 현재 제품 `1.638900×1.455619×0.486868 m`, 새 원본 `1.665925×1.700334×0.533363 m`. 원본 blend와 GLB의 치수도 동일한 수준으로 확인됐다.

현재 자전거는 제품 GLB에 포함된 상태로 고정했다. 기존 OneDrive `cycle-only.glb`는 재현 이력용으로만 보존했다. **현재 제품에서 자전거를 추출하는 작업은 A 단계**이며 아직 수행하지 않았다.

## 이미지 해석

두 입력 모두 저장된 변환 그대로다. 같은 카메라·배율·조명을 적용했지만 **같은 페달 위상으로 맞추지 않았다**. 현행 제품은 앱이 관절 회전을 적용하기 전 rest 자세여서 팔다리가 내려가고 이음매가 어긋나 보인다. 이를 현행 앱의 주행 화면이나 새 교체 후보의 회귀로 해석하지 않는다. 현재 파일/새 파일 식별을 위한 단계 0 자료이며 정적 피팅 승인 자료는 B 단계에서 만든다.

후보 폴더는 로컬 산출물이며 gitignore 대상이다. `snapshots/`는 구현과 승인·교체·원복이 끝날 때까지 보존한다.

- [manifest](../../apps/web/scripts/rider-cycle-fit/.out/candidates/20260911-184054-afc08cbf/manifest.json)
- [Blender 노드·그룹·좌표 조사](../../apps/web/scripts/rider-cycle-fit/.out/candidates/20260911-184054-afc08cbf/inventory.json)
- [현재 제품 측면](../../apps/web/scripts/rider-cycle-fit/.out/candidates/20260911-184054-afc08cbf/current-side.png) · [현재 제품 사선](../../apps/web/scripts/rider-cycle-fit/.out/candidates/20260911-184054-afc08cbf/current-threequarter.png)
- [새 원본 측면](../../apps/web/scripts/rider-cycle-fit/.out/candidates/20260911-184054-afc08cbf/modelling-side.png) · [새 원본 사선](../../apps/web/scripts/rider-cycle-fit/.out/candidates/20260911-184054-afc08cbf/modelling-threequarter.png)

## 교체 전 앱 자세 검사

명령: `node apps/web/scripts/rider-cycle-fit/verify-rider-pose-gate.mjs`

exit 0, **13/13 PASS**. 회전 왕복 오차 `1.20e-15`, GLB/rig 앵커 차이 `0.000 mm`, 밑창–페달 오차 `0.0 mm`, 발바닥 기울기 `0.00°`. 게이트 13의 기존 허용 항목(절단뚜껑 293px·팔 스텁 211px)은 기존 기준에 따라 통과한 것이며 모든 관통이 0이라는 뜻은 아니다. 실주행 e2e·성능 시험은 아직 실행하지 않았다.

## 다음 작업

단계 0 승인 후 A 단계: 원본 메시를 라이더/자전거·각 신체 부위로 분류하고 접점/관절 피벗을 manifest에 등록한다. 단계 B/C나 제품 경로 쓰기는 아직 진행하지 않는다. 단계 경계는 [rider-cycle-fit 스킬](../../.agents/skills/rider-cycle-fit/SKILL.md)의 “각 단계(0/A/B/C/D/E) 그림 승인 후 다음” 규칙을 따른다.
