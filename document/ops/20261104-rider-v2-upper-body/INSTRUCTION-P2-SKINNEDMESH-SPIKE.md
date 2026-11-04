# rider15 상체 스킨 — P2 표준 SkinnedMesh 스파이크

- 작업 ID: `RIDER15-P2-SKINNEDMESH-SPIKE`
- 상태: `DONE`
- 범위: 제품 경로 밖의 최소 Three.js fixture 검증
- 제품 GLB: 변경 없음

## 실행 명령

```powershell
cd C:\20.HDev\boxcycle\apps\web
node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/rider-preserve/rider-standard-skin-spike.test.ts
```

## 합격 기준

- 하나의 `SkinnedMesh`에서 두 개 이상의 본이 서로 다른 정점을 변형
- 본 회전 후 변형 결과가 rest 결과와 다름
- 본 회전이 원본 geometry position 버퍼를 직접 수정하지 않음

## 제한

이 스파이크는 실제 rider15 GLB, Mapbox 실화면, 팔 IK, 팔레트, 성능을 검증하지 않는다. 다음 단계에서 후보 GLB 또는 최소 export fixture가 필요하다.

