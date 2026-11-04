# rider15 상체 스킨 — P1 렌더 경로 감사

- 작업 ID: `RIDER15-P1-RENDER-PATH-AUDIT`
- 상태: `READY`
- 목적: 표준 glTF 상체 스킨을 현재 렌더 경로에 격리된 후보로 연결할 수 있는지 확인
- 구현 범위: 읽기 전용 코드 감사와 기존 테스트 구조 확인
- 금지: 제품 GLB 교체, rider14 프로필 변경, 런타임 코드 수정, 커밋·푸시

## 확인 대상

- `apps/web/src/lib/map/riderPreservedLayer.ts`
- `apps/web/src/lib/riderPrototype/preservedRiderRig.ts`
- `apps/web/src/lib/riderPrototype/riderGpuSkin.ts`
- `apps/web/src/lib/riderPrototype/riderModelProfile.ts`
- `apps/web/src/lib/rider/riderGlbPedalPose.pose.mjs`
- `apps/web/scripts/rider-preserve/HARNESS.md`

## 합격 기준

- 현재 렌더러가 Three.js `SkinnedMesh`를 실행할 수 있는 위치를 특정한다.
- 현재 rider14 전용 경로와 rider15에 재사용 가능한 경로를 분리한다.
- 표준 스킨 후보의 최소 실험 파일·입력·검증 방법을 제안한다.
- 제품 경로를 건드리지 않는 P2 기술검증 작업으로 연결한다.

