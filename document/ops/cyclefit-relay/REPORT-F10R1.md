# 개발팀장 → 감리 보고서

- **지시번호**: F10-R1 (IK 해 불일치 — 원인 재규명)
- **발신**: 개발팀장0801
- **수신**: 클로드감리0801
- **일시**: 2026-08-01
- **모델 사용 내역**: **전부 Opus 직접. 위임 없음**
  (사유: 좌표계·스키닝·Blender 평가 순서 추적이라 `HANDOFF §4-6` 의 "설계 판단" 해당.
  코드 변경 2파일·약 190줄, 진단 스크립트 5본은 scratchpad 에만 둠.)

---

## 0. 결론 — **합격. 발이 페달에 얹혔다**

### `FULL_BDC_R.png` (최상단, 지시 §5-1)

```
C:\20.HDev\boxcycle\apps\web\scripts\rider-cycle-fit\.out\candidates\20260801-F10R1-AFTER\FULL_BDC_R.png
```

| 합격 기준(§3-3) | 결과 |
|---|---|
| **`footContactAssertions`** | **좌 0.0mm · 우 0.0mm — 전 4위상 PASS** (허용 5.0) |
| `frameAssertions` | PASS — 헤드튜브 85.03 / SSoT 85.0 |
| `crankPhaseAssertions` | PASS — 4위상 전부 |
| `jointsFreshness` | PASS — saddleContact.y 950.5 / 950.5 |
| **BDC 무릎 실측** | **9.99°** (목표 10°) |
| `v2Bones` · 프레임 · scale | **불변** |
| 발–페달 실제 접점(메시) | 발 최저점이 페달 최저점 위 **15.1mm**, 페달축 위 5.1mm |

**다만 원인은 감리 §2 진단(THIGH 29mm 부족)이 아니었다.** 실측으로 반증했고(§1),
진짜 원인은 **다른 세 가지**였다(§2). THIGH 는 **연장하지 않았다** — 연장했다면
다리가 29mm 길어져 오히려 틀렸을 것이다.

---

## 1. §3-1 계측 — **감리 예측은 틀렸다**

지시대로 **코드를 고치기 전에 Blender 에서 직접 rest 실측**했다.

### 1-1. 원본 GLB 를 그대로 임포트한 직후 (fit_ik 처리 이전)

| 재야 할 것 | 감리 예측 | **실측** | 판정 |
|---|---|---|---|
| `THIGH_L/R` `bone.length` (rest) | ? | **430.00mm** | — |
| **`THIGH` head → `SHIN` head (rest)** | **396.92mm** | **430.00mm** | **✘ 틀림** |
| `THIGH` tail ↔ `SHIN` head 간격 | ? | **0.00mm — 붙어 있다** | — |
| `SHIN` `bone.length` (rest) | — | 350.00mm | — |

### 1-2. `fit_ik.py` 헤드 통과 후 (extend_shin·resize_feet·배치 적용)

| 구간 | joints 가정 | **Blender 실측(world)** | 차이 |
|---|---|---|---|
| THIGH (head→SHIN head) | 378.40 | **378.40** | **0.00** ✔ |
| SHIN (extend_shin 후) | 352.00 | **352.00** | 0.00 ✔ |
| THIGH tail ↔ SHIN head | 0 | **0.00** | ✔ |

### 1-3. 도달 검증 — 감리 표와 정반대

| 항목 | 감리 예측(Blender 실제) | **실측** |
|---|---|---|
| HIP 에서 도달 가능 거리 | 701.29 | **730.40** |
| 필요한 HIP → 발목 (BDC) | 727.63 | **727.63** |
| **여유** | **−26.34 (도달 불가)** | **+2.77 (도달 가능)** ✔ |

**즉 Blender 리그는 joints 가정과 처음부터 완전히 일치했다.** `extend_thigh()` 는
필요 없었고, 넣었다면 다리가 29mm 길어져 무릎 10° 가 깨졌을 것이다.

### 1-4. 감리의 349.29 는 어디서 나왔나 — **좌우 라벨 혼합**

감리 §2-1 의 `349.29` 는 F9 보고서 §3-2 표에서
**joints 의 HIP(Blender y = −81.4)** 과 **Blender 실측 무릎(y = −65.2)** 을 섞어 잰 값이다.

```
|(−206.4, −81.4, 862.5) − (−182.6, −65.2, 514.4)| = 349.3   ← 감리가 쓴 값(혼합)
|(−206.4, +81.4, 862.5) − (−182.6, −65.2, 514.4)| = 378.5   ← 같은 쪽끼리(정답)
```

F9 보고서의 HIP 행은 **rider 본**(THIGH_L head, Blender y = **+81.4**)이고
무릎·발목 행도 같은 본의 실측이다. 그런데 그 HIP 이 joints 의 hipL(y = −81.4)과
**반대편**이라, joints 값으로 대체해 계산하면 29mm 가 만들어진다.
**그 29mm 자체가 이번 사고의 증상이지 원인이 아니다** — 원인은 §2-1 이다.

---

## 2. 진짜 원인 3건 — 전부 실측으로 확정

### 2-1. 【1차 원인】 두 층의 좌/우 라벨이 반대다

`export-ik-joints-v2.mjs` 의 `l`/`r` 과 rider GLB 본 `_L`/`_R` 이 **서로 반대쪽**이다.

```
rider 본 THIGH_L head   Blender y = +81.4      ← 라이더 해부학적 왼쪽
joints  hipL (g2b)      Blender y = −81.4      ← 반대편
```

그래서 `aim_bone("THIGH_L", g2b(kneeL))` 이 **다리를 몸 반대편으로 조준**했다.

| 짝 | 거리 | 허벅지 378.40 | 판정 |
|---|---|---|---|
| 본 L → joints kneeL | **410.41** | 초과 | **도달 불가** |
| **본 L → joints kneeR** | **378.40** | 일치 | **정답 짝** |
| **본 R → joints kneeL** | **378.40** | 일치 | **정답 짝** |
| 본 R → joints kneeR | 410.20 | 초과 | 도달 불가 |

**검증**: 이 모델로 F9 실측 좌표가 **소수점까지 재현**된다.

```
hip(+81.4) + 378.4 × unit(kneeL − hip) = (−182.61, −65.19, 514.46)
F9 보고서 실측 무릎              = (−182.6,  −65.2,  514.4)   ✔
그 무릎에서 SHIN 352.0 을 발목으로 조준 = (−215.2, −73.3, 164.0)
F9 보고서 실측 발목              = (−215.2, −73.3, 164.1)   ✔
```

감리 §2-2 는 잔여 오차 2개를 상수 하나로 맞췄고(0.06mm), 이 모델은 **관절 좌표 6개를
전부** 맞춘다. 좌우 오차가 달랐던 것도 BDC/TDC 에서 가로지르는 거리가 달라서다.

**수정**: rider 본을 만지는 지점에서만 side 를 변환한다. 하드코딩이 아니라
**부호 실측**으로 정한다(팔이 후드를 고르는 기존 방식과 동일).
joints·페달 메시·`required-views` 앵커·카메라는 이미 서로 일치하므로 **건드리지 않았다.**

### 2-2. 【2차 원인】 발 뼈가 71.6mm 짧고 방향도 12.7° 어긋나 있었다

`resize_feet` 는 FOOT 을 rest 169.8mm(world 149.42)로 줄이는데, joints 가 요구하는
발목→페달축 거리는 **221.06mm** 다. 구조적으로 71.6mm 부족했다
(F9 로그 `클릿L=76mm 클릿R=81mm` 의 정체).

**수정**: FOOT 본 tail 을 **rest 발 메시의 발볼 위치 그 자체**로 재정의했다(world 218.98mm).
그러면 본 축 = 발목→발볼이 되어, 조준한 곳에 메시 발볼이 간다.
발볼 목표는 상수로 박지 않고 **JD 에서 역산**한다(ANKLE_BACK 217.94 · ANKLE_UP 37.00 →
페달축 위 19.90mm). 선언값·적용값이 갈라진 것이 anti#8 의 사고였다.

> **부수 발견**: F8 의 발볼 정의(`measure-assumptions.py`)는 밴드의 **좌표별 median** 이라
> x·y·z 를 따로 중앙값 내는 합성점이다. 실측 결과 밴드 중심에서 **좌우로 41.8mm 편심**했다
> (발 폭 86mm 인데 median y=123.2, 밴드 정점 y 44~130). 그 편심점을 본 축으로 삼았더니
> 조준 시 발이 축을 중심으로 비틀려 **본은 목표에 닿는데 메시는 76mm 벗어났다.**
> centroid 로 바꿨다 — centroid 는 강체변환에 equivariant 하지만 median 은 아니다.
> 이후 **메시↔본 = 0.00mm** 로 수학적으로 보장된다.

### 2-3. 【결정타】 라이더 GLB 내장 애니메이션이 렌더마다 IK 포즈를 덮어썼다

**F5·F6·F8·F9 에서 반복된 "계산은 0mm 인데 렌더는 미달"의 진짜 정체다.**

라이더 GLB 는 액션 `Pedal_Loop`·`Riding_Idle` 을 들고 오며 **`Pedal_Loop` 이 armature 에
활성 상태로 할당**돼 있다(NLA 트랙 2개 포함). `bpy.ops.render.render()` 는 렌더 직전
씬을 프레임 평가하는데, 그때 애니메이션이 우리가 세운 포즈를 덮는다.

실측(`diag-when`, 같은 세션·같은 씬):

| 시점 | 발볼 본 tail | 발 최저 z |
|---|---|---|
| `apply_phase("0.500")` 직후 | (0.37, 74.00, 117.87) | **103.12** ← 정확 |
| 0.250 뒤 0.500 재적용 | 동일 | **103.12** ← 이전 위상 잔류 아님 |
| **렌더 1회 뒤** | (181.77, 67.36, 325.84) | **271.47** ← 뒤바뀜 |
| 렌더 2회 뒤 | 동일 | 271.47 |

**즉 계측은 우리 포즈를, 이미지는 GLB 애니메이션을 보고 있었다.** assert 가 PASS 인데
그림에서 발이 페달에 없던 이유가 이것이다. `arm.animation_data_clear()` 로 끊었다.

이 한 건이 F5 의 "발이 수평", F6·F8 의 "발이 안 닿는데 렌더 성공"을 전부 설명한다.

---

## 3. §3-2 어떻게 고쳤나 — **연장도 재부착도 아니다**

감리가 제시한 두 갈림길(연장 / 재부착) 중 어느 쪽도 아니다. **THIGH 는 이미 옳았다.**
실제로 고친 것은 위 §2 의 3건이며, 전부 **레포 쪽 `render-all.py`** 에서 처리했다.

| 위치 | 내용 |
|---|---|
| `render-all.py` | 애니메이션 해제 · 좌우매핑 `BONE_OF` · 발 뼈 재정의 · 발볼 목표 역산 · 메시 추적 계측 · 무릎각 실측 |
| `render-all.py`(소스 치환 4건) | `fit_ik.py` 의 다리 aim · 발 aim · `measure` 2곳에 side 변환 적용 |
| `make-before-after.py` | `RIDER_ONLY_SIDE_L` 을 비교 목록 맨 위에 추가(§5-4) |

**`fit_ik.py`(OneDrive 정본)는 건드리지 않았다.** F1·F5 에서 세운 규율(소스 치환)을
유지했고, 치환은 실패 시 `RuntimeError` 로 막는다. `.bak` 도 불필요했다.

> **이견 — 치환이 한계에 왔다.** 이번에 치환이 2건 → **6건**이 됐다. 다음 지시로
> `fit_ik.py` 를 `blender/rider-cycle-fit/render-fit.py` 로 **이관**할 것을 권한다
> (HARNESS TODO 에 이미 "다음 우선순위"로 적혀 있다). 지금 구조는 OneDrive 파일이
> 한 줄만 바뀌어도 렌더 전체가 멈춘다.

---

## 4. assert 4종 실측값 (전 위상)

```
[애니제거]   action=Pedal_Loop  nla=['Riding_Idle','Pedal_Loop']
[좌우매핑]   joints L→본 R, joints R→본 L   (THIGH_L y=+81.4 / joints hipL y=−81.4)
[발뼈재정의] FOOT_L/R world 218.98mm (구 149.42) / TOE 37.11mm / 발볼하강 17.10mm
[발볼목표]   ANKLE_BACK 217.94 / ANKLE_UP 37.00 → 페달축 위 19.90mm
[프레임검증] 헤드튜브 85.03 / SSoT 85.0 (±1.0)  mesh=Mesh_64  OK
[joints신선도] saddleContact.y 950.5 / 950.5  shin 352.0(rest 400.0)  hipDrop 88  OK
[위상검증] 0.000 좌 98.2/98.0   우 442.8/443.0  OK
[위상검증] 0.250 좌 270.3/270.5 우 270.3/270.5  OK
[위상검증] 0.500 좌 442.8/443.0 우 98.2/98.0    OK
[위상검증] 0.750 좌 270.7/270.5 우 270.7/270.5  OK
[발접촉] 전 4위상  발목 좌 0.0 / 우 0.0mm (허용 5.0)  OK
                   발볼(본) 좌 0.4 / 우 0.4   메시↔본 0.0 / 0.0
                   발볼(메시)→페달축 19.87mm (설계값 19.90)
[BDC우] 발최저 [−5.345, 111.021, 103.122] / 페달최저 [0.0, 74.0, 88.0] / 수직거리 15.1mm
```

### 무릎 실측 각도 (계산값 재인용이 아니라 본 좌표에서 실측)

| 위상 | 본 L | 본 R | joints 계산 |
|---|---|---|---|
| 0° | 9.99° | 116.92° | 10.0 / 116.9 ✔ |
| 90° | 73.68° | 75.46° | — |
| **180° (BDC 우)** | **116.92°** | **9.99°** | 10.0 ✔ |
| 270° | 75.46° | 73.68° | — |

**BDC 무릎 9.99° — 목표 10° 달성.**

---

## 5. 생성 이미지 절대경로 **전체** 목록 (40장, 선별 없음)

후보 경로: `C:\20.HDev\boxcycle\apps\web\scripts\rider-cycle-fit\.out\candidates\20260801-F10R1-AFTER\`

**종합판·비교 (먼저 볼 것)**
```
contact-sheet-static.png
contact-sheet-pedal.png
contact-sheet-rider-only.png
before-after.png                (Before=20260801-F7-AFTER, 맨 윗줄이 RIDER_ONLY_SIDE_L)
```
**사용자 판정용**
```
FULL_BDC_R.png                  ← 최상단. 오른발 BDC 전신
FULL_BDC_R_SIDE_L.png
BDC_R_LOWPOINT.png              ← 발 최저점 vs 페달 최저점 (수직거리 15.1mm)
STATIC_CU_SADDLE.png            ← 안장–엉덩이 접합부 (팬츠 RED)
```
**Static 7방향 + 확대 6장**
```
STATIC_SIDE_L.png  STATIC_SIDE_R.png  STATIC_FRONT.png  STATIC_REAR.png
STATIC_TOP.png     STATIC_Q_FRONT.png STATIC_Q_REAR.png
STATIC_CU_FOOT_L.png STATIC_CU_FOOT_R.png STATIC_CU_HAND_L.png
STATIC_CU_HAND_R.png STATIC_CU_KNEE_FRONT.png
```
**Rider Only 4장**
```
RIDER_ONLY_SIDE_L.png RIDER_ONLY_FRONT.png RIDER_ONLY_REAR.png RIDER_ONLY_Q_FRONT.png
```
**4위상 × 4뷰 16장**
```
PHASE_0_FULL.png   PHASE_0_FOOT_L.png   PHASE_0_FOOT_R.png   PHASE_0_CRANKSYNC.png
PHASE_90_FULL.png  PHASE_90_FOOT_L.png  PHASE_90_FOOT_R.png  PHASE_90_CRANKSYNC.png
PHASE_180_FULL.png PHASE_180_FOOT_L.png PHASE_180_FOOT_R.png PHASE_180_CRANKSYNC.png
PHASE_270_FULL.png PHASE_270_FOOT_L.png PHASE_270_FOOT_R.png PHASE_270_CRANKSYNC.png
```

로그: `01-render.log` `02-contact-sheet.log` `03-before-after.log`
`04-verify-renders.log` `05-verify-fit.log` · 입력 사본 `input-ik-joints-v2.json`

`verify-renders` **통과**(33장 전수·해상도·중복 없음·시각 일관), `verify-fit` **통과**.

---

## 6. 실패·미완·막힌 항목 (숨기지 않음)

1. **안장 접점은 이 렌더로 판정할 수 없다.** `STATIC_CU_SADDLE.png` 는 냈지만 좌골이
   안장 표면보다 아래라 안장이 엉덩이 메시에 파묻혀 보이지 않는다 —
   `required-views.mjs` 에 이미 "카메라를 바꿔 해결되는 문제가 아니다"로 기록돼 있다.
   판정하려면 `run-saddle-gate.mjs`(반투명 표식 6장) 경로가 필요하다. **이번 범위 밖.**
2. **§5-4 Before/After 의 다리 비율 변화는 "없음"으로 나온다.** 감리는 허벅지
   396.9→430(+8%) 변화를 사용자에게 보이라 했으나, §1 실측대로 허벅지는 원래 430 이라
   **바꾸지 않았다.** `before-after.png` 맨 윗줄 `RIDER_ONLY_SIDE_L` 은 다리 길이가
   같음을 보여준다 — 이것이 "연장이 불필요했다"의 시각 증거다.
3. **손 오차 40.05mm 잔존.** `verify-fit` 이 경고로 표시한다. hipDrop 88·HIP_XOFF 15 로
   상체가 이동해 후드 도달이 나빠진 F9 이슈 그대로다. 이번 지시 범위 밖이라 손대지 않았다.
4. **발볼 접점 assert 는 아직 차단이 아니다.** 발볼(메시)→페달 19.87mm 는 설계값
   19.90 과 일치하지만, `_assert_foot_contact` 의 **차단 조건은 여전히 발목 기준**이다.
   합격 기준(§3-3)을 임의로 바꾸지 않으려 경고(>10mm)까지만 넣었다. **차단 승격은 감리 판단.**
5. `20260801-F10-AFTER` 후보 폴더가 남아 있다(같은 내용, 지시 §5 경로 규약 전의 이름).
   삭제 지시가 없어 두었다.

---

## 7. 이견 — **감리 §2 역산은 틀렸다. 근거를 남긴다**

지시 §7 이 "이번 §2 의 역산도 검산 대상"이라 했으므로 명확히 적는다.

1. **THIGH 396.92mm 는 실측 430.00mm 로 반증됐다**(§1-1). 원본 GLB 를 그대로 임포트해
   `bone.length` 와 `head→SHIN head` 를 둘 다 쟀고, THIGH tail↔SHIN head 간격은 0.00 이었다.
   `extend_thigh()` 를 넣었다면 다리가 730.4 → 759.5mm 가 되어 **무릎 10° 가 깨졌을 것이다.**
2. **감리 §2-2 의 "0.06mm 재현"은 반증이 되지 못한다.** 잔여 오차 2개(29.2 / 12.2)를
   자유 상수 1개(ratio)로 맞춘 것이라 자유도가 부족하다. §2-1 의 좌우 반전 모델은
   **관절 world 좌표 6개를 전부** 0.1mm 이내로 재현한다 — 자유 상수 없이.
3. **감리 §2-3 "joints 는 결백하다"는 옳다.** `|hip−knee| = 378.40`, `|knee−foot| = 352.00`
   모두 확인했다. 다만 결백한 것은 **거리**이고, 문제는 **어느 쪽 다리에 주느냐**였다.
4. **감리 §2-4 "SHIN 에는 있고 THIGH 에는 없다"는 관찰은 맞지만 결론이 틀렸다.**
   `extend_shin` 이 필요했던 건 GLB SHIN(350) ≠ joints 가정(400) 이기 때문이고,
   THIGH 는 GLB(430) = joints 가정(430) 이라 처리가 없는 것이 **정상**이다.
5. **좌/우 라벨 정합은 별도 결정 사안으로 올린다.** 현재 파이프라인은 두 규약이 공존한다:
   - `required-views.mjs:8` — "+y = 오른쪽"
   - `measure-assumptions.py:59` — "+y lateral(+=left)"
   - `riderRig.geometry.mjs:7` — "+z = 왼쪽" (우수좌표계에서는 실제로 오른쪽)

   **그림은 어느 쪽이든 동일**하다(자전거·라이더가 좌우 대칭). 다만 `FULL_BDC_R` 의 "R"
   이 해부학적으로는 라이더의 **왼발**을 가리킨다. 지금 뒤집으면 사용자 승인 그림의
   정의가 흔들리므로 **건드리지 않았다.** 정리하려면 결정 로그를 거친 별도 지시가 맞다.
6. **`ANKLE_BACK 217.94` 는 이름과 실제가 다르다.** F8 정의(전방 25% 중 하부 25% median)로
   잰 점은 발목에서 217.94mm 앞인데, 발 메시 최전방이 x=+14.9(발목 대비 221mm)다.
   즉 이 값은 **발목→발볼이 아니라 발목→발끝에 가깝다.** 확정값이라 그대로 썼고
   그 전제 위에서 접점을 맞췄다. 라이딩 정석(페달축이 발볼 아래)과 어긋나므로
   **다음 단계에서 재정의를 권한다** — 지금 바꾸면 `saddleHeight 709.2` 전제가 흔들린다.

---

## 8. 지시 §6 준수 확인

| 금지 항목 | 준수 |
|---|---|
| 프레임(headTube 85 등) | **불변** — assert 로 증명 |
| `crankLength` 172.5 · 허벅지 430 · 정강이 400 · scale 0.88 | **불변** |
| `saddleHeight` 709.2 | **불변** |
| `v2Bones` 를 실측값으로 낮추기 | **하지 않음** (오히려 낮출 이유가 없음을 실측으로 확인) |
| assert 허용치 완화 | **하지 않음** — 5.0mm 그대로 |
| SSoT → 메시 단방향 | 준수 — 메시(발 뼈)를 SSoT 에 맞췄다 |
| push / 제품 GLB 덮어쓰기 / 커밋 | **전부 하지 않음** (§6: 승인 후 별도 지시) |
| `fit_ik.py` 원본 수정 | **하지 않음** — 레포 쪽 치환만 |
