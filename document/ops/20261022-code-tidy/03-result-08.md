# 결과08 — P3 반복 통합: 라이더·카메라·Lab 패널

2026-10-22 · 담당 Claude impl-standard · 지시 [02-task-08.md](02-task-08.md) · 규칙 [02-task-p3-rules.md](02-task-p3-rules.md)

4쌍 모두 합쳤다. 합치지 않은 쌍은 없다. 동작·export 이름·시그니처는 그대로다.

## 쌍별 결과

### 1. RideCameraLabPanel ↔ RiderLightLabPanel (TSX + CSS)

공통부 위치: `src/components/labPanel/` (새 폴더, 두 Lab 패널만 import).

- `LabPanelShell.tsx`(106줄) — `LabPanelShell`(루트·헤더·접기 버튼·접힘 상태·지도 전파 차단), `LabSliders`(슬라이더 행 목록), `LabCodeCopy`(코드 블록 + 「값 복사」 버튼)
- `useLabCopy.ts`(28줄) — 클립보드 복사 + 1.5초 「복사됨」 훅. `copied` 상태는 패널 안쪽 컴포넌트가 들고 있어, 접었다 펴도 예전처럼 유지된다.
- `LabPanelShell.css`(152줄) — 공통 스타일. 선택자를 `.cam-lab, .light-lab` 로 묶었다. 클래스 이름은 그대로라 e2e(`.light-lab`, `.light-lab__row` 등)와 `run-real-gpu.mjs` 셀렉터가 깨지지 않는다.
- 패널별 CSS에는 위치·폭·행 열 너비(및 cam 전용 meta/hint)만 남겼다. 접힘 상태의 `width:auto` 와 순서 의존이 생기지 않게 폭은 `:not(.…--collapsed)` 로 펼친 상태에만 준다.

줄 수(전 → 후):

| 파일 | 전 | 후 |
|---|---|---|
| RideCameraLabPanel.tsx | 210 | 142 |
| RiderLightLabPanel.tsx | 152 | 88 |
| RideCameraLabPanel.css | 151 | 29 |
| RiderLightLabPanel.css | 143 | 20 |
| labPanel/ (새 3파일) | 0 | 286 |
| 합계 | 656 | 565 (-91) |

Lab 청크 분리는 유지된다(아래 빌드 결과). 공통 틀은 두 Lab 패널과 `DevLabPanels` 의 동적 import 경로로만 닿고, 운영 코드가 정적으로 import 하지 않는다.

### 2. preservedRiderRig ↔ preservedRiderStatic (dispose)

`preservedRiderRig.ts` 에 `disposeRiderObject(object, visualKit)` 를 export 로 추가했다(키트 → 지오메트리 → 머티리얼 → 텍스처, 순서 그대로). 리그 `dispose()` 와 `PreservedRiderStatic.dispose()` 가 이것을 부른다. Static 은 이미 `bakeFloat32Attributes` 를 리그에서 import 하고 있어 새 의존이 생기지 않았다.
Rig 754 → 738, Static 74 → 47 (두 쪽 합 -43, 공통 함수 포함).

### 3. preservedRiderRig ↔ riderGpuSkin (CPU 스키닝 정점 루프)

`riderGpuSkin.ts` 에 `skinVertexDQInto(rest, normal, weights, index, dq, out)` 를 추가해 DQ 블렌딩 본체를 한 곳에 뒀다. 기존 `skinVertexDQ` 는 그것을 감싸는 얇은 래퍼로, 이름·인자·반환 형태가 같다. 리그 `updateSkin` 의 CPU 정점 루프(약 35줄)는 이 함수를 부른다. 연산 순서·상수(`1e-6`, `|| 1`)는 줄 단위로 그대로 옮겼다. 정점마다 객체를 할당하지 않도록 모듈 스코프 `Float64Array(6)` 임시 버퍼를 쓴다(정밀도는 전과 같은 double).
Rig 는 위 2번과 합쳐 754 → 738, riderGpuSkin 142 → 164. 스키닝 수치는 `test:quick` 의 CPU/GPU 대조 시험이 모두 통과해 확인했다.

### 4. cameraFollowTrace ↔ cameraRenderPhase

`finite`, `shortestAngleDelta` 는 줄 단위로 같았다. 새 `src/lib/camera/cameraProbeMath.ts`(17줄)로 뽑았다. `dep-layers.json` camera 배정 목록에 추가했다(엣지 변경 없음). 디버그 도구·window 훅은 새로 만들지 않아 `dev-tools.json` 은 건드리지 않았다.
cameraFollowTrace 172 → 162, cameraRenderPhase 210 → 200 (합 -20 + 새 파일 17).

## 합치지 않은 쌍

없음.

## 바뀐 파일

- 수정: `src/components/rideCameraLab/RideCameraLabPanel.{tsx,css}`, `src/components/riderLightLab/RiderLightLabPanel.{tsx,css}`, `src/lib/riderPrototype/{preservedRiderRig,preservedRiderStatic,riderGpuSkin}.ts`, `src/lib/camera/{cameraFollowTrace,cameraRenderPhase}.ts`, `dep-layers.json`(파일 배정 한 줄 추가)
- 신규: `src/components/labPanel/{LabPanelShell.tsx,LabPanelShell.css,useLabCopy.ts}`, `src/lib/camera/cameraProbeMath.ts`

## 검사 결과 (apps/web)

- `npx tsc -b --noEmit` — 출력 없음(통과)
- `npx eslint` (고친 파일·폴더 전부) — 출력 없음(통과)
- `node ../../scripts/check-dep-direction.mjs --check` — 방향 위반 0건, 순환 0쌍, baseline 이내 통과
- `npm run test:quick` (마지막 수정 뒤 재실행) — 합계 통과 1341 · 실패 0
  - 첫 실행에서 `scripts/conquest/recent-road-display-dom.test.mjs` 하나가 30초 타임아웃으로 실패했다(다른 구현자들이 같은 트리에서 동시에 일하던 부하 중). 같은 시험을 단독 실행하면 통과했고, 전체 재실행도 모두 통과했다. 내 파일과 무관한 브라우저 시험이다.
- `npm run build` (루트) — 성공. Lab 청크 목록:
  - `RideCameraLabPanel-CgtNacIt.js` 2.07 kB (+ `RideCameraLabPanel-CBxK_QRD.css`)
  - `RiderLightLabPanel-DDKr3TRC.js` 2.60 kB (+ `RiderLightLabPanel-B7cLeTli.css`)
  - `useLabCopy-DQjIIcmj.js` 1.70 kB (+ `useLabCopy-D8Uvon_0.css`) — 공통 틀·훅이 모인 Lab 전용 공유 청크
  - `PerfLabPanel-C7U0mYbA.js` 10.04 kB
  - 기본 청크 `index-BVDZSNWr.js` 3,738.29 kB 와 `index-DjC7n-aQ.css` 에는 `cam-lab`·`light-lab`·`조절판 펼치기` 문자열이 0건이다(공통 틀은 `useLabCopy` 청크에만 있음).

Playwright 는 실행하지 않았다. e2e `camera-qc-lightlab.spec.ts` 의 셀렉터는 클래스 이름 유지로 호환된다고 정적으로만 확인했다.
