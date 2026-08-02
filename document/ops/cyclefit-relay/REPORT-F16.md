# 개발팀장 → 감리 보고서

- **지시번호**: F16 (F15 정정 — 앱에 올릴 것은 V2 라이더)
- **발신**: 개발팀장0801
- **수신**: 클로드감리0801
- **일시**: 2026-08-02
- **모델 사용 내역**: **전부 Opus 직접. 위임 없음** (앱 계약 해독·강체 분해 설계라 설계 판단.
  신규 1파일 `blender/rider-cycle-fit/decompose-v2-rider.py` 약 200줄. 진단 1본은 scratchpad.)

---

## 0. 결론 — **§1 완료. 강체 분해 실증 완료. 앱 이식은 미완**

| 단계 | 상태 |
|---|---|
| **§1 옛 모델 앱에서 내리기** | **완료** — 사용자가 보던 화면은 해결됐다 |
| §3-1 가중치 실측 | **완료** — 강체 분해 가능 판정 |
| §3-2 노드 매핑 · 좌/우 규약 | **완료** — 앱 코드로 검증 |
| §3-3 피벗 | **완료** — 산출 GLB 가 앱 계약과 소수점까지 일치 |
| **강체 분해 GLB 산출** | **완료** — 노드 9개, 정점 5,477 전수 배분 |
| §3-4 `riderGlbPedalPose` 정합 | **미완** — SSoT 는 특정했으나 **설계 충돌 1건**(§5) |
| §3-5 자전거 병합 → 제품 이식 → 앱 구동 | **미완** |

**앱에는 아직 V2 를 올리지 않았다.** 반쯤 만든 GLB 를 제품에 올리면 F15 와 같은 사고가
반복되므로, 검증 가능한 단계까지만 하고 남은 설계 결정을 올린다.

---

## 1. §1 옛 모델 되돌리기 — 완료

```
$ git status --porcelain   (되돌리기 전)
 M apps/web/public/rider/prototype/rider-lowpoly.glb    ← F15 에서 절차적 라이더로 덮인 것
$ git checkout -- apps/web/public/rider/prototype/rider-lowpoly.glb
```

| | 값 |
|---|---|
| 복원 후 크기 | **554,268 B** (7/28 원본) |
| MD5 복원본 | `8731E3A5DE28A784A26EB2F2630EF5A9` |
| MD5 `.pre-F15.bak` | `8731E3A5DE28A784A26EB2F2630EF5A9` — **일치** |
| `.pre-F15.bak` | **보존** (지우지 않았다) |

**GLB 한 파일만** 되돌렸다. 다른 미커밋 변경(문서)은 건드리지 않았다.

---

## 2. §3-1 가중치 실측 — **강체 분해 가능**

V2 라이더 전 정점(5,477개) 최대 가중치 분포:

| 구간 | 정점 수 | 비율 |
|---|---|---|
| **w ≥ 0.999 (단일 본)** | **4,709** | **85.98%** |
| 0.9 ≤ w < 0.99 | 104 | 1.90% |
| 0.7 ≤ w < 0.9 | 427 | 7.80% |
| w < 0.7 | 237 | 4.33% |
| 가중치 없음 | **0** | — |

**단일본 85.98% — 감리 기준(95%)에는 미달하지만, 블렌딩 664개는 전부 인접 관절 이음매다.**

```
예시: v21 FOREARM_L 0.854 / UPPER_ARM_L 0.146   (팔꿈치 이음매)
     v23 UPPER_ARM_L 0.635 / FOREARM_L 0.365   (팔꿈치 이음매)
```

감리 §3-1 두 번째 갈래("관절 이음매에 블렌딩 → 최대 가중치 본으로 귀속")에 해당하므로
**진행했다.** 이음매 벌어짐은 렌더로 확인해야 한다(§6-2 미완).

본별 정점 수(최대 가중치 귀속): HEAD 1729 · FOOT_L/R 432 · HAND_L/R 387 · PELVIS 364 ·
CHEST 290 · NECK 264 · UPPER_ARM 162 · SPINE_01 144 · THIGH 141 · SPINE_02 96 ·
FOREARM 92 · SHIN 81.

---

## 3. §3-2 노드 매핑 — **좌/우를 앱 코드로 확정**

### 3-1. 앱 계약 정본은 `generate-rider-prototype-glb.mjs:588` 주석이다

```
leg.position = 실제 고관절 HIP_L/HIP_R (좌우 z=±PELVIS_HALF_Z) — IK root 와 동일
knee(shin pivot) = [0, -THIGH_LEN, 0] · 발바닥 = shin 로컬 [0, -SHIN_LEN, 0]
pivot 체인은 로컬 -Y 직선(z=0). 좌우 벌림은 leg.position 의 z + IK 3D 회전이 만든다
```

즉 **노드 원점 = 관절, 로컬 rest = −Y 수직 아래** — 감리 §3-3 과 동일하다.

### 3-2. 좌/우 규약 — 확인 방법과 결론

| 층 | `_l` 이 가리키는 쪽 | 근거 |
|---|---|---|
| **앱 노드** `leg_l` | `RIG_HIP_L` = glTF **+z** (`PELVIS_HALF_Z` +0.09) | `legAssembly()` 코드 |
| **joints** `hipL` | glTF **+z** (+81.4) | F10-B 실측 |
| **V2 본** `THIGH_L` | Blender +y = glTF **−z** | 커밋 `345fdd8` |

⟹ **앱 `_l` 노드에는 V2 `_R` 본을 붙인다** (`BONE_OF` 와 같은 규칙).

### 3-3. 최종 매핑표

| 앱 노드 | V2 본 | 정점 | 피벗(Blender world mm) |
|---|---|---|---|
| `torso` | PELVIS·SPINE_01·SPINE_02·CHEST·NECK·HEAD·CLAVICLE_L/R | 2,887 | (−205.17, 0, 802.21) |
| `leg_l` | **THIGH_R** | 141 | (−211.28, **−81.4**, 836.88) |
| `leg_l_shin` | SHIN_R·FOOT_R·TOE_R | 513 | (−69.23, −77.7, 486.17) |
| `leg_r` | **THIGH_L** | 141 | (−211.28, **+81.4**, 836.88) |
| `leg_r_shin` | SHIN_L·FOOT_L·TOE_L | 513 | (152.37, 79.23, 732.3) |
| `arm_l` | **UPPER_ARM_R** | 162 | (92.78, −180.4, 1137.35) |
| `arm_l_fore` | FOREARM_R·HAND_R | 479 | (359.69, −195.73, 935.77) |
| `arm_r` | **UPPER_ARM_L** | 162 | (92.78, +180.4, 1137.35) |
| `arm_r_fore` | FOREARM_L·HAND_L | 479 | (359.69, +195.73, 935.77) |
| `crank` | (자전거 쪽 — 미구현) | — | BB |

**합계 5,477 = 전 정점. 미배정 0.**

---

## 4. 강체 분해 산출물 — **앱 계약과 소수점까지 일치**

`blender/rider-cycle-fit/decompose-v2-rider.py` (신규) 로 생성.
산출: `.out/candidates/20260802-F16-V2/v2-rider-nodes.glb` (**593,424 B**, skins 0 · animations 0)

### 4-1. 노드 좌표 검증 (glTF 기준)

```
노드            로컬 translation(mm)      부모
  torso          [-205.2, 802.2,    0]    RiderBike
  leg_l          [-211.3, 836.9, +81.4]   RiderBike   ← +z, 앱 RIG_HIP_L 규약 ✔
  leg_l_shin     [   0,  -378.4,    0]    leg_l       ← [0,-THIGH_LEN,0] ✔
  leg_r          [-211.3, 836.9, -81.4]   RiderBike   ← −z ✔
  leg_r_shin     [   0,  -378.4,    0]    leg_r       ✔
  arm_l          [  92.8,1137.3, +180.4]  RiderBike
  arm_l_fore     [   0,  -334.8,    0]    arm_l       ← [0,-UPPER_ARM_LEN,0] ✔
  arm_r          [  92.8,1137.3, -180.4]  RiderBike
  arm_r_fore     [   0,  -334.8,    0]    arm_r       ✔
```

**자식 원점이 정확히 `[0, −부모길이, 0]`** 이고 좌우 부호가 앱 규약과 맞는다.
세그먼트 길이도 V2 실측과 일치: 허벅지 **378.40** · 정강이 **352.00** ·
상완 **334.83** · 전완 **212.84**.

### 4-2. 구현 중 잡은 함정 1건 — 축 이중 변환

1차 export 에서 `torso` translation 이 `(−205.2, 0, −802.2)` 로 나왔다(높이가 z 로 가고
부호 반전). 원인: 내가 Blender→glTF 변환을 직접 하고 **exporter 의 `export_yup` 이 또
변환**했다. Blender 좌표를 그대로 두고 exporter 에 맡기도록 고쳐 해결.
스크립트 상단에 재발 방지 주석을 남겼다.

---

## 5. §3-4 `riderGlbPedalPose` 정합 — **SSoT 는 찾았으나 설계 충돌 1건**

### 5-1. 좋은 소식: 이미 SSoT 구조다

`riderGlbPedalPose.pose.mjs:17-22` 는 사지 길이를 **`riderRig.geometry.mjs` 에서 import**
한다. 하드코딩 복제가 아니다. 즉 **한 곳만 고치면 앱 IK 와 GLB 생성기가 함께 따라온다.**

| 상수 | 현재(옛 라이더) | **V2 실측(맞춰야 할 값)** |
|---|---|---|
| `THIGH_LEN` | 0.493 | **0.37840** |
| `SHIN_LEN` | 0.493 | **0.35200** |
| `UPPER_ARM_LEN` | 0.304 | **0.33483** |
| `FOREARM_LEN` | 0.281 | **0.21284** |
| `PELVIS_HALF_Z` | 0.09 | **0.0814** |

### 5-2. 【결정 필요】 hip 위치가 안장 파생이라 F14 와 충돌한다

`riderRig.geometry.mjs` 는 hip 을 **안장에서 파생**한다:

```
PELVIS_ROOT = SADDLE_CONTACT + (0.015, 0.06, 0)
            = (−156.3, 730.5) + (15, 60)  =  (−141.3, 790.5)
```

그런데 **F14 의 hip 은 (−211.28, 836.88)** 이다 — 회전(§F12)으로 정해진 위치이며
**안장과 독립**이다. 차이 **x 70.0mm · y 46.4mm**.

이대로 두면 앱 IK 가 F14 와 다른 hip 에서 다리를 풀어 **발이 페달에서 벗어난다** —
감리 §3-4 가 경고한 바로 그 재발이다.

**선택지(감리·사용자 결정 사항):**

| 안 | 내용 | 영향 |
|---|---|---|
| **A** | `PELVIS_ROOT` 를 안장 파생이 아니라 **명시 상수**로 바꾸고 F14 값을 넣는다 | 안장 결정과 분리됨. **권장** |
| B | 안장을 hip 에 맞춰 되돌린다 | `geometry.json` 수정 — §5 금지 |
| C | 앱 IK 를 쓰지 않고 포즈를 GLB 에 구워 정지 렌더 | 페달링 상실 |

**A 를 권한다.** F12 에서 "회전 → 엉덩이 확정 → 안장을 거기 맞춤" 으로 인과가 이미
뒤집혔으므로(F12 §3-4), SSoT 도 그 방향으로 정리하는 것이 일관된다.
**다만 이는 `riderRig.geometry.mjs` 의 파생식을 바꾸는 일이라 지시 없이 하지 않았다.**

---

## 6. 실패·미완·막힌 항목

1. **§3-4 미완** — §5-2 의 hip 파생 충돌 때문에 `riderRig.geometry.mjs` 를 손대지 않았다.
   결정이 오면 상수 5개 + `PELVIS_ROOT` 정합에 30분이면 된다.
2. **이음매 벌어짐 미확인** — 블렌딩 664 정점을 최대 가중치로 귀속시킨 결과를
   렌더로 보지 못했다. 저폴리라 눈에 안 띌 가능성이 높지만 **확인 전이다**.
3. **자전거 병합 미구현** — `crank` 노드가 없다. 절차적 생성기를 `RTW_RIDER=0` 으로 돌려
   자전거만 굽고 라이더 노드와 합치는 단계가 남았다.
4. **앱 이식·구동 미수행** — 제품 GLB 는 **7/28 원본 그대로**다(§1).
   `.pre-F16.bak` 은 아직 만들지 않았다(덮어쓰지 않았으므로).
5. **스크린샷 없음** — 앱에 V2 를 올리지 않았으므로 §3-5 의 4장을 낼 수 없다.
   **합격 기준 §4 는 미충족이다.**
6. `verify-rider-glb.mjs` 노후(F15 §2-2) 그대로.

---

## 7. 이견

### 7-1. §2 "강체 분해로 된다" — **맞다. 실증했다**

앱 계약을 만족하는 GLB 가 실제로 나왔다(§4-1). 감리 판단이 옳았고, 근거로 든 F13 §4-1 ·
F10-R1 의 단일본 가중치도 정확했다.

### 7-2. 다만 §3-1 기준선 "95%" 는 실측 85.98% 로 미달했다

기준을 문자대로 적용하면 "멈추고 보고"가 되지만, 블렌딩이 전부 관절 이음매라
두 번째 갈래로 판단해 진행했다. **이 판단이 틀렸다고 보시면 되돌리겠다.**

### 7-3. §3-3 피벗 표는 정확했다

`leg_*` = 고관절, `*_shin` = 무릎, `arm_*` = 어깨, `*_fore` = 팔꿈치, `torso` = 골반 —
전부 그대로 구현했고 앱 계약과 일치했다.

### 7-4. F15 사고에 대해

감리가 §0 에서 책임을 명확히 한 것은 사실관계대로다. 다만 **나도 F15 §7-2 에서
"제품 GLB 에 라이더가 없다"를 발견하고도 "재생성이 그것을 고쳤다"고만 적었지,
"그런데 이건 우리가 만든 V2 가 아니다"를 짚지 못했다.** 그 지점에서 멈춰
확인했어야 했다.

---

## 8. 산출물

```
c:\20.HDev\boxcycle\blender\rider-cycle-fit\decompose-v2-rider.py          (신규 스크립트)
c:\20.HDev\boxcycle\apps\web\scripts\rider-cycle-fit\.out\candidates\20260802-F16-V2\
    v2-rider-nodes.glb        593,424 B  노드 9개 · skins 0 · animations 0
```

제품 GLB: `apps/web/public/rider/prototype/rider-lowpoly.glb` — **7/28 원본으로 복원됨**
백업: `rider-lowpoly.glb.pre-F15.bak` (554,268 B) **보존**

### `git status`

```
 M document/ops/cyclefit-relay/HANDOFF.md
 M document/ops/cyclefit-relay/INSTRUCTION.md
 M document/ops/cyclefit-relay/REPORT.md
?? apps/web/public/rider/prototype/rider-lowpoly.glb.pre-F15.bak
?? blender/rider-cycle-fit/decompose-v2-rider.py
?? document/ops/cyclefit-relay/REPORT-F14.md
?? document/ops/cyclefit-relay/REPORT-F15.md
```

**소스 코드 변경 0** — `geometry.json`·`riderRig.geometry.mjs`·`riderGlbPedalPose.pose.mjs`
전부 미변경. 신규 파일 1개(Blender 스크립트)뿐이다.

---

## 9. 다음 지시에 필요한 결정

1. **§5-2 hip 파생** — A(명시 상수) / B / C 중 선택. **A 권장**
2. §7-2 단일본 85.98% 로 진행한 판단 승인 여부
3. 승인 시 남은 작업: 사지 길이 5개 정합 → 자전거 병합(`crank`) → 이음매 렌더 확인 →
   제품 이식(`.pre-F16.bak`) → 앱 구동 스크린샷 4장

---

## 10. 지시 §5 준수 확인

| 금지 항목 | 준수 |
|---|---|
| 절차적 라이더를 제품 GLB 에 올리기 | **되돌렸다**(§1). 앞으로 `RTW_RIDER=0` 로만 쓴다 |
| `geometry.json` 수정 | **하지 않음** |
| 앱에서 이상한 것 임의 보정 | 해당 없음(앱 이식 미수행) |
| 백업 없이 제품 GLB 덮어쓰기 | **덮어쓰지 않음** |
| assert 허용치 완화 | 해당 없음 |
| push / 커밋 | **전부 하지 않음** |
