# 형상 보존 라이더 검증 하네스

완성 원본의 연속 관절 외피를 절단하지 않고, 모델러가 제공한 DQS 변형이 원본 자세를 얼마나 보존하는지 확인한다. 제품 GLB와 앱 코드는 수정하지 않는다.

## Blender Guide 가중치 추출

완성 BLEND는 저장하지 않고 `Guide_*` 정점 가중치와 glTF 축 좌표만 추출한다.

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' `
  -b 'C:\Users\kdrea\OneDrive\Documents\img\helmet_fix\revision\20260919-natural_joint_skin\roadcyclist_natural_joint_skin.blend' `
  -P blender/rider-cycle-fit/export-natural-skin-guides.py -- `
  apps/web/scripts/rider-preserve/.out/natural-skin-guides-full.json
```

## 정적 기준 자세 후보 생성

저장소 루트에서 실행한다.

```powershell
node apps/web/scripts/rider-preserve/capture-static-bind.mjs
```

산출물은 `apps/web/scripts/rider-preserve/.out/candidates/<candidateId>/`에 생성된다.

- `manifest.json`: 입력 전체 경로·크기·SHA-256, 후보 ID, 정점/엣지 계측
- `source-*.png`: 원본 정점과 identity 그룹 변환
- `bind-*.png`: 동일 카메라·조명에서 크랭크 0°, sway off, Blender Guide 가중치 기반 DQS 평가
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

현재 단계는 `STATIC_GUIDE_WEIGHTED_BIND`, 상태는 `UNAPPROVED`다. 비교 PNG를 실제로 표시하고 후보 ID에 대한 사용자 승인을 받은 뒤에만 8위상 페달 검증을 추가한다. 승인 전 제품 경로 `apps/web/public/rider/prototype/rider-lowpoly.glb`를 변경하지 않는다.

## 2026-09-20 재개 상태

- 현재 후보: `20260920-223739-45d50d84`, 정적 복원 검사 PASS / 사용자 승인 대기.
- 작업 루트: `C:/20.HDev/boxcycle/tmp/rider-shape-preserving`, 브랜치 `codex/rider-shape-preserving`.
- 중단 시 후보 `20260920-175705-bf545bfa`의 입력 8개 해시는 일치했다. 다만 근사 페달 좌표와 UI의 반올림 크랭크 반경 때문에 정적 상태에서도 페달이 원본 대비 우측 1.419mm, 좌측 7.554mm 이동했다.
- 새 후보는 s5의 명명된 페달 본체 `Mesh_48`/`Mesh_52` 전체 primitive의 중심을 등록한다. 기존 BB `(0, 0.267, 0)` 주위 XY 대칭을 검증하고 실제 반경 172.978781mm를 사용한다. 제품의 BB 270.5mm를 섞거나 원본 메시를 옮기지 않는다.
- Guide 가중치 GLB 대응: 우측 940 / 좌측 867 정점, 누락 0. 정적 다리 최대 정점 차이 0.000029802mm, 최대 엣지 길이 차이 0.000026629mm. IK 한계 초과 없음.
- 비교 이미지: 측면·정면·사선은 메타데이터 사각형 제외 픽셀 동일, 무릎 확대는 최대 채널 차이 1/255. 원본 자체의 오금 형상까지 보존하는 검사이며 기존 결함 개선을 뜻하지 않는다.
- 원본 GLB 사본·뷰어 내장 GLB 모두 SHA-256 `1108aa3e37615eef037984a0cdf80018b840a043c6e62f6750f828646b6b1ffb`. 원본과 같이 213 primitives / 53,514 triangles.
- 정적 감사: `.out/static-audit-20260920-223739-45d50d84.json`. 뷰어 SHA-256 `0ee0919a175200cd97430250afca762c55f13cc7cd45e3f06a8b47f97c20d2fd`.
- 제품은 기존 SHA-256 `a9d0d6716c09a1edcd02bb968a07d16e0cf1f625ced7c33b19a5ef499f5268b8` 유지. 앱 이식·커밋·배포하지 않았다.

정적 검사 재실행(후보 자체를 수정하지 않음):

```powershell
node apps/web/scripts/rider-preserve/audit-static-candidate.mjs apps/web/scripts/rider-preserve/.out/candidates/20260920-223739-45d50d84
```

다음 작업: 사용자가 이 후보에 대해 "다음 단계 진행"이라고 하면 후보 디렉터리에 `static-approval.json`을 기록한다. `candidateId`, `approved: true`, 사용자 원문, 승인 시각, 위 `viewerSha256`을 포함한다. 이전 후보의 승인을 복사하지 않는다. 다음 명령은 **그 승인 뒤에만** 실행한다.

```powershell
node apps/web/scripts/rider-preserve/capture-pedal-phases.mjs apps/web/scripts/rider-preserve/.out/candidates/20260920-223739-45d50d84
```

페달 검사기는 8위상과 360° 연결점, 실제 렌더 페달 중심/목표 오차 및 원본 크랭크 연결점에 대한 상대 이동을 기록하도록 보강했다. 이번 재개에서는 문법 검사만 했으며 새 후보의 페달 위상은 실행하지 않았다. 수치 PASS와 별도로 무릎·피부/양말 경계 확대 이미지, 신체/프레임 관통을 검토해야 한다. 연결점 오차는 원본 접점 관계 보존 지표이며 메시 관통 검사를 대체하지 않는다.

## 2026-09-21 현재 후보

- 후보 `20260920-223739-45d50d84`의 승인된 8위상 검사 결과는 FAIL이다. 발목 목표·좌우 180°·0/360° 폐곡선은 맞았지만 실제 페달 메시가 크랭크 목표에서 최대 53.967mm 이탈했고, `Mesh_153`의 106mm 힙 연결 엣지가 최대 66.387mm 줄었다. 제품 이식 금지.
- 실패 원인 감사: `.out/pedal-failure-audit-20260920-223739-45d50d84.json`. 가중치 전략 비교: `.out/weight-strategy-probe-20260920-223739-45d50d84.json`.
- 현재 수정 후보: `20260921-035654-9b67e166`, 정적 감사 PASS / 사용자 검토 대기.
- 페달은 발 행렬을 재사용하지 않고 실제 페달 중심이 BB 주위를 돌도록 평행이동한다. 플랫폼은 수평을 유지한다.
- `Mesh_153`/`Mesh_163`은 반바지 안쪽까지 이어지는 상부 허벅지 셸이다. 골반·허벅지 사이에 중간 정점 없이 106mm 엣지가 있어 혼합하면 붕괴하므로 허벅지 강체로 묶었다. 외부에 보이는 연속 무릎 피부는 Blender Guide DQS를 유지한다.
- 정적 다리 최대 정점 차이 0.000029802mm, 최대 엣지 길이 차이 0.000026629mm. 페달 정적 앵커 오차 우측 0, 좌측 0.000020504mm.
- 원본 GLB·복사본·뷰어 내장 GLB SHA-256은 `1108aa3e37615eef037984a0cdf80018b840a043c6e62f6750f828646b6b1ffb`. 제품 GLB는 변경하지 않았다.
- 검토기는 `preserved-viewer-20260921-035654-9b67e166.html`, SHA-256 `e00927d0b8a8d93986f0074528f9e1e845b502f0aa8b685c6f6962179b40a499`.
- 사용자 지시에 따라 기본 검증 명령은 별도 PNG를 캡처하지 않는다. 필요할 때만 `--screenshots`를 붙인다.

이 후보가 승인되기 전에는 자동 8위상 보고서를 생성하거나 제품·앱에 이식하지 않는다. 승인 후 실행:

```powershell
node apps/web/scripts/rider-preserve/capture-pedal-phases.mjs apps/web/scripts/rider-preserve/.out/candidates/20260921-035654-9b67e166
```

## 2026-09-21 접점 고정 후보

- 후보 `20260921-035654-9b67e166`은 사용자 정적 승인을 받았다. 이후 동기화 전 계측에서 원본의 가변 발목 오프셋이 신발의 페달 접점을 최대 약 40mm 이동시키는 것이 확인되어 제품 이식하지 않았다.
- 새 후보: `20260921-041426-cd81398e`, 정적 감사 PASS / 사용자 검토 대기.
- 신발의 원본 클릿 기준점을 각 페달 중심에 고정했다. 원본 IK 무릎 궤적을 15° 간격으로 역산한 주기적 발 피치 표를 사용하며, 1° 간격 전수 검사에서 IK clamp 없음, 최대 무릎 신전 154.611°, 최소 도달 여유 21.140mm, 클릿 앵커 최대 오차 `1.2e-13`mm였다.
- 크랭크 0°에서는 좌우 발 피치가 모두 0°이므로 정적 원본 자세를 그대로 복원한다. 정적 다리 최대 정점 차이 0.000029802mm, 최대 엣지 길이 차이 0.000026629mm이다.
- 기본 실행은 PNG를 만들지 않는다. `make-static-bind-report.py`도 PNG가 없으면 수치 보고서만 만든다.
- 검토기: `preserved-viewer-20260921-041426-cd81398e.html`, SHA-256 `b33f2ece1a8fbf2ad4c48ae219d435bdd0f34accca842b55535b060de6a07229`.
- 이전 후보의 승인을 복사하지 않는다. 이 후보 승인 뒤에만 동기화된 `setPhase()`를 사용하는 8위상 검사를 실행한다.
- 사용자 정적 승인: `2026-09-21T04:18:40+09:00`, 원문 `Ok, 다음 단계 진행`, 승인 파일 `static-approval.json`.
- 동기화된 8위상 기계 검사는 전 항목 PASS: IK clamp 없음, 클릿-페달 앵커 최대 오차 `1.15e-13`mm, 좌우 위상 180°, 페달-크랭크 연결 최대 오차 0.000020504mm, 최대 무릎 신전 154.005°, 0/360° 폐곡선 오차 `1.12e-13`mm.
- 형상 검토가 필요한 최대 엣지 변화는 225°의 `Left continuous knee skin`에서 9.860mm다. 정적 굴곡 자세에서 0.504mm로 접힌 인접 엣지가 신전 자세에서 10.364mm로 펴지는 위치다. 수치상 분리 여부를 확정하지 않고 3D 검증기에서 왼쪽 무릎과 신체-프레임 관통을 확인한다.
- 8위상 보고서: `pedal-8phase-report.json`. 상세 엣지 감사: `.out/pedal-failure-audit-20260921-041426-cd81398e.json`.
