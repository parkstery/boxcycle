# 형상 보존 라이더 검증 하네스

완성 원본의 연속 관절 외피를 절단하지 않고, 모델러가 제공한 DQS 변형이 원본 자세를 얼마나 보존하는지 확인한다. 제품 GLB와 앱 코드는 수정하지 않는다.

## 정적 기준 자세 후보 생성

저장소 루트에서 실행한다.

```powershell
node apps/web/scripts/rider-preserve/capture-static-bind.mjs
```

산출물은 `apps/web/scripts/rider-preserve/.out/candidates/<candidateId>/`에 생성된다.

- `manifest.json`: 입력 전체 경로·크기·SHA-256, 후보 ID, 정점/엣지 계측
- `source-*.png`: 원본 정점과 identity 그룹 변환
- `bind-*.png`: 동일 카메라·조명에서 크랭크 0°, sway off, DQS 평가
- `preserved-viewer-*.html`: 해당 후보의 자립형 검토 뷰어
- `source-roadcyclist-s5.glb`: 후보에 고정된 원본 GLB 사본

브라우저는 SwiftShader WebGL을 명시한다. 이를 빼면 headless Chromium에서 `CONTEXT_LOST_WEBGL`이 발생해 흰 PNG가 만들어질 수 있다.

## 비교표와 수치 보고

```powershell
python apps/web/scripts/rider-preserve/make-static-bind-report.py `
  apps/web/scripts/rider-preserve/.out/candidates/<candidateId>
```

`comparison-overview-*.png`, `comparison-detail-*.png`, `static-bind-report.json`, 확대 차이 이미지 `diff-x8-*.png`를 만든다.

`maxLegVertexDeltaMm`은 관절·페달 목표 정렬로 인한 위치 변화다. 형상 변형은 `maxLegEdgeLengthDeltaMm`·`rmsLegEdgeLengthDeltaMm`·`maxLegEdgeStrainPercent`로 따로 판단한다.

## 승인 게이트

현재 단계는 `STATIC_BIND_FEASIBILITY`, 상태는 `UNAPPROVED`다. 비교 PNG를 실제로 표시하고 후보 ID에 대한 사용자 승인을 받은 뒤에만 8위상 페달 검증을 추가한다. 승인 전 제품 경로 `apps/web/public/rider/prototype/rider-lowpoly.glb`를 변경하지 않는다.
