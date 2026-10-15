# rider14 상체·자전거 흔들림 (P9) — 계획

| 항목 | 내용 |
|------|------|
| 문서 유형 | **작업 계획(ops)** |
| 최초 작성 | 2026-10-16 |
| 상태 | `진행` — Chief 지시 2026-10-16 "P9 흔들림 묶음 시작해" |
| 역할 | Supervisor(계획·감리) = Claude · Developer = Cursor Agent CLI · Chief = 육안 승인 |
| 작업 위치 | worktree `C:\20.HDev\boxcycle-sway`, 브랜치 `feat/rider14-sway`(기준 `main2` `bd3b356`) |
| 선행 | [rider14 교체](../20261015-rider14-replace/README.md) — 운영 배포 완료 |
| 출처 | rider 작업 폴더 `C:\Users\kdrea\OneDrive\Documents\img\helmet_fix\revision\20260919-natural_joint_skin\20261015_01-s6-poly-drawcall-reduction` 의 `tools\viewer.html`(installSway·updateSway), `tools\lib\sway.mjs`, `reports\결과보고서.md` §5-10 |

---

## 0. 목표

페달링에 맞춰 **상체(어깨)가 좌우로 리드미컬하게 흔들리고, 자전거는 그 반대로 살짝 기울며, 상체가 회전당 두 번 오르내리는** 움직임을 제품 라이더(rider14)에 넣는다. 값은 Chief 가 뷰어에서 확정한 기본값을 그대로 쓴다.

| 항목 | 확정값 |
|---|---|
| 어깨 롤(화면 기준) | 0.5° |
| 자전거 롤(접지선 축, 어깨와 반대) | 0.4° |
| 상하(bob) | 2 mm, 회전당 2회 |
| 타이밍 | −60° (`wave = cos(a − crankPhase.R + 60°)`) |
| 무릎 반대 | 끔 (`sign = +1`) |

수식(뷰어 그대로): `bikeRoll = −sign·B·wave`, `bodyRoll = sign·A·wave`, 셰이더 롤 `uSwayRoll = bodyRoll − bikeRoll`, `uSwayBob = −C·(0.5 + 0.5·cos 2(a − crankPhase.R))`. 여기서 `a = phaseRev·2π`.

## 1. 사전 조사 (Supervisor, 2026-10-16)

| # | 사실 | 근거 |
|---|---|---|
| S1 | rider14 GLB 에는 이미 가중치 `_SWAY`(정규화 UNSIGNED_SHORT, `static__Palette` 10,792 정점)가 있다. GLTFLoader 에서 속성명 `_sway`. 자전거 부분은 0, 엉덩이 0 → 어깨 1, 머리 0.5, 손 0 | GLB JSON · `sway.mjs` |
| S2 | 다리·바퀴·크랭크·페달·발 메시는 `_sway` 가 없다 → WebGL 기본 속성값 0 → 영향 없음. 머티리얼은 전 메시 공용 `Rider palette` 1개 | GLB |
| S3 | 셰이더 주입은 `onBeforeCompile` 3곳(`common`·`beginnormal_vertex`·`begin_vertex`), 피벗 `[-0.20, 1.00, 0]`(모델 좌표, 진행축 x 롤) | `viewer.html` 208–224행 |
| S4 | 앱 `leanDeg` 는 **본인 라이더의 코너링 기울임**(진행 방향 변화율 × 0.22, ±10°, τ 0.35 s). 동행·페이서는 없음. 레이어가 모델 x축(진행축)·지면 원점 기준 `makeRotationX(lean)` 로 적용 → 뷰어의 자전거 롤과 **같은 축** → 자전거 흔들림은 `lean + bikeRoll` 로 더하면 된다 | `MapView.tsx` 2610–2628, `riderPreservedLayer.ts` render |
| S5 | 레이어는 리그 1개를 본인→동행→페이서 순으로 `setPhase → setVisualKind → render` 한다. 균일 변수는 `render` 시점에 올라가므로 **라이더마다 다른 흔들림 값**을 같은 방식(그리기 직전 설정)으로 줄 수 있다 | `riderPreservedLayer.ts` |
| S6 | 위상은 주행 중·속도 > 0.35 km/h 에서만 증가. 멈추면 위상이 고정 → 흔들림이 **기운 채 멈출 수 있다** | `MapView.tsx` 2601–2607 |
| S7 | 줌 < 19 에서는 자세 계산을 건너뛴다(`shouldAnimateRiderPose`) | `riderDetailLod.ts` |

## 2. 설계

### 2.1 순수 계산 `riderPrototype/riderSway.ts` (신규)

```ts
export const RIDER_SWAY_DEFAULTS = { shoulderRollDeg: 0.5, bikeRollDeg: 0.4, bobMm: 2, lagDeg: -60, counter: false, pivot: [-0.20, 1.00, 0] } as const;
export type RiderSwayParams = typeof RIDER_SWAY_DEFAULTS;
export function computeRiderSway(phaseRev: number, crankPhaseR: number, envelope: number, p?: RiderSwayParams):
  { shaderRollRad: number; bobM: number; bikeRollRad: number };
```
- 뷰어 `updateSway` 와 같은 식. `envelope`(0–1)를 세 값에 곱한다.

### 2.2 흔들림 크기(envelope) — 멈춤 처리

레이어가 `spec.id` 별로 마지막 위상·시각을 기억한다. 최근 0.3 s 안에 위상이 바뀌었으면 목표 1, 아니면 0. 시상수 0.4 s 로 따라간다. 멈추면 0.4–1 s 에 걸쳐 똑바로 서고, 다시 밟으면 같은 속도로 살아난다. 줌 < 19(자세 생략)에서는 목표 0. 사라진 `spec.id` 의 상태는 정리한다(메모리 누적 방지).

### 2.3 셰이더 설치

- 프로필에 `supportsSway: boolean` — rider14 = true, s5 = false(롤백 시 흔들림 없음).
- `PreservedRiderRig` 가 rider14 일 때 공용 머티리얼에 `onBeforeCompile` 로 뷰어와 같은 3곳을 주입, `customProgramCacheKey = () => "rider-sway-v1"`. 균일 변수 객체는 리그가 소유하고 `setSway({ shaderRollRad, bobM })` 로 값만 바꾼다.
- 컬러 키트는 `material.map` 만 바꾸므로 셰이더와 충돌하지 않는다.

### 2.4 레이어 연결

그리기 루프에서 라이더마다: `setPhase` → `setVisualKind` → **`rig.setSway(...)`** → 모델 행렬의 lean 에 `bikeRollRad` 를 더함 → `render`. 계약 시험이 보는 기존 문자열은 유지한다.

### 2.5 개발용 비교 스위치

DEV 빌드에서만 `?sway=0` 이면 흔들림 끔(비교 캡처용). 운영 빌드에서 제거(문자열 검색 0건)를 확인한다.

## 3. 단계와 게이트

| 단계 | 내용 | 담당 | 게이트 |
|---|---|---|---|
| **W1 구현** | 2.1–2.5 + 시험 | Developer | **GW1**: tsc 0, 변경 파일 eslint 0, `test:rider-preserve` 전부 통과(기존 25+6 + 신규). 신규 시험: 계산식이 뷰어 수식과 일치(위상 8점), envelope 동작(정지·재개·줌), 흔들림 0 일 때 리그 출력이 지금과 바이트 동일(동등성 시험 재사용), s5 는 셰이더 미설치 |
| **W2 육안** | 벤치 페이지에서 `animate=1` 영상(또는 연속 캡처)·위상 4점 정지 캡처를 흔들림 끔/켬으로 나란히. 실제 앱 주행 화면 1장 | Developer 캡처 → **Chief 육안** | **GW2**: Chief 승인. 손이 핸들바에서 떨어지지 않음, 엉덩이가 안장에서 뜨지 않음, 자전거 반대 방향 롤 확인 |
| **W3 성능** | P5 와 같은 벤치로 흔들림 켬/끔 | Developer | **GW3**: 드로우콜 변화 없음(14), ms/rider 증가 ≤ 5% |
| **W4 배포** | 미리보기 채널 → Chief 폰 확인 → 병합·푸시·운영 배포 | Supervisor · Chief | **GW4**: Chief 지시 |

## 4. 위험

| # | 위험 | 대응 |
|---|---|---|
| R1 | 앱의 모델 행렬이 y 스케일 음수(미러) → 좌우 방향이 뷰어와 반대로 보일 수 있음 | W2 에서 "자전거가 어깨 반대로" 와 "타이밍"을 육안 확인. 반대면 `counter` 한 값으로 맞춘다(수식 변경 금지) |
| R2 | 공용 리그·공용 머티리얼에서 라이더별 값이 섞임 | 그리기 직전 설정. W2 에서 위상이 다른 3명이 각자 흔들리는지 확인 |
| R3 | 코너링 lean 과 합쳐져 과해짐 | 0.4° 는 lean 최대 10° 대비 작다. W2 앱 주행 컷에서 확인 |
| R4 | 셰이더 프로그램 재컴파일·캐시 키 충돌 | 고정 캐시 키, 머티리얼 1개 |
| R5 | 멈춤 상태에서 기울어 고정 | 2.2 envelope + 시험 |

## 5. 롤백

`riderModelProfile.ts` rider14 의 `supportsSway` 를 false 로(한 줄) — 셰이더·lean 가산이 모두 꺼진다. 또는 커밋 revert.
