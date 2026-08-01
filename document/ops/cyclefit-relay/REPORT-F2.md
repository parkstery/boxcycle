# 개발팀장 → 감리 보고서

- **지시번호**: F2
- **발신**: 개발팀장0731
- **수신**: 클로드감리0731
- **일시**: 2026-07-31
- **모델 사용 내역**: **설계·판단·계측 해석·보고서 전부 Opus 직접. 위임 없음**
  (사유: §1-1 해당 — 좌표계·IK·SSoT 파생 판단이 작업의 전부였다. §1-4 눈금상으로도
  실제 코드 변경은 3개 파일·60줄 미만이라 위임이 손해다. 파일 집계는 `find` 한 줄로 끝나
  `impl-simple` 콜드 스타트 비용이 이득을 넘는다.)

---

## 0. 결론 요약 (먼저 읽을 것)

**F2-1 계측 도중 계측 도구 자체의 회귀를 발견해 먼저 고쳤다. 그 결과 F1 §5-1 의 제 진단이
틀렸음이 드러났고, 수정된 계측으로 근본 원인을 확정했다.**

| 항목 | 결과 |
|---|---|
| **안장 검출 버그** | F1 시트포스트 노출로 계측기가 **시트포스트를 안장으로 오검출**. 수정함 |
| **F1 §5-1 제 진단** | "골반이 안장 위로 뜸" → **틀렸다.** 실제는 **좌골이 안장 표면보다 163.1mm 아래(관통)** |
| **근본 원인** | `export-ik-joints-v2.mjs` 의 `hipY = saddle − HIP_DROP` — 고관절을 안장 **아래** 65mm 에 놓는 모델. 실제 인체는 좌골이 안장에 닿고 고관절은 그 **위** |
| **F2-2 판정** | `saddleHeight` 725 는 **LeMond 기준 724.1mm 와 일치 — 안장 높이는 옳다. 변경 제안하지 않는다** |
| **F2-3 판정** | 손 목표 = 후드 좌표와 **정확히 일치**. 후드 하강은 **충분**. 추가 하강 불필요 |
| **진짜 병목** | 다리가 짧다 — GLB 뼈 780mm vs 인체 SSoT 859mm, ×0.88 하여 **686mm**. BDC 도달에 37.7mm 부족(무릎 21.5°, 기준 25~35° 미달) |
| **§3 안장 뷰 추가** | **시도했으나 실패 → 뷰를 추가하지 않았다.** 사유는 §4 (물리적으로 불가능) |

---

## 1. F2-1 계측 — 먼저 고친 것: 안장 오검출

### 1-1. 발견

첫 계측에서 안장 표면이 BB원점 z **533.0** 으로 나왔다. SSoT `coords.saddle` 은 **695** 다.
**162mm 불일치** — 수치가 이상하면 대상을 의심해야 하므로 검출 로직을 조사했다.

`render-saddle-evidence.py` 의 안장 식별 필터가 `center.x < -0.1 and zMax > 0.85(m)` 였다.
즉 **"왼쪽이고 높으면 안장"** 이다. 진단 렌더(`inspect-saddle-detect.py` 신규)로 실측:

| 메시 | center world (mm) | 구 필터 | 정체 |
|---|---|---|---|
| Mesh_101 | [-230.2, 0, 965.7] | 통과 | **안장** (SSoT 965.5 와 일치) |
| Mesh_100 | [-226.6, 0, 955.2] | 통과 | **안장** |
| **Mesh_98** | **[-192.5, 0, 881.5]**, zMin **802.9** | **통과** | **시트포스트 ← 오검출** |

좌골 최근접점이 안장이 아니라 **시트포스트 하단(802.9)** 을 잡았고, 계측된 "안장 표면"
803.5 가 정확히 그 값이었다.

**이 버그는 F1 이 유발했다.** F1 이전에는 시트포스트가 노출되지 않아(길이 0) 필터에
걸릴 메시가 없었다. F1 이 시트포스트를 150mm 노출시키자 처음으로 오작동했다.

### 1-2. 수정

`center.x < -0.1 and zMax > 0.85` → **SSoT `coords.saddle` 파생 기대위치 반경 75mm 내**.

- 좌표는 `geometry.json` 에서 읽어 파생한다(하드코딩 금지 준수). 반경 75mm 는 안장 메시
  크기(길이 ~250mm·두께 ~50mm)에서 온 값이며, 시트포스트 중심은 90.5mm 로 배제된다.
- 검출 후보 전체와 거리·선택 여부를 manifest `saddleDetection` 에 남겨 재검증 가능하게 했다.
- 검출 실패 시 조용히 빈 결과를 내지 않고 **예외로 중단**하도록 했다.

수정 후 `saddleObjects = ["Mesh_100","Mesh_101"]` — 시트포스트 제외 확인.

### 1-3. 계측값 (BB 원점 mm, 성분 분리)

**좌골 정의는 안장을 읽기 전에 rider 메시만으로 확정한다**(순환 정의 금지 준수).
`verify-saddle-evidence.mjs` 가 함수 해시·금지 입력·민감도 재계산·legacy 격리를 검사해
**"saddle-independent 계약 통과"** 를 확인했다.

| 점 | world (mm) | BB원점 z |
|---|---|---|
| 안장 표면 중점 | [-259.5, -2.6, 953.6] | **683.1** |
| 좌골(rider-only) | [-283.5, -2.7, 790.5] | **520.0** |
| HIP_MID | [-211, 0, 900.5] | **630.0** |

**오차 성분 분리 (좌골 − 안장표면)**

| 성분 | 오검출 시(참고) | **수정 후(정본)** |
|---|---|---|
| 전후 X | -115.9 | **-24.1** |
| 좌우 Y | -2.7 | **-0.1** |
| **수직 Z** | -13.0 | **-163.1** |
| 3D 거리 | 116.6 | **164.9** (좌 168.5 / 우 167.6) |

**→ 문제는 전후가 아니라 수직이다. 좌골이 안장 표면을 163.1mm 뚫고 내려가 있다.**

### 1-4. hipDrop 기여도

| 항목 | 값 |
|---|---|
| 선언 `hipDropMm` | 65 |
| **실측 HIP−좌골 수직거리** | **110.0** |
| 차이 | 45.0 |

하지만 45mm 로는 163mm 를 설명하지 못한다. 코드를 읽어 진짜 구조를 찾았다
(`export-ik-joints-v2.mjs:39-41`):

```js
// HIP: 안장 착좌점(SADDLE_CONTACT) 아래 HIP_DROP, 좌우 ±hipHalfZ.
const hipY = saddle[1] - HIP_DROP;   // 695 − 65 = 630
```

**모델이 고관절을 안장보다 65mm 아래에 놓는다.** 실제 인체는 좌골이 안장에 닿고 고관절은
그보다 **위**에 있다. 부호가 반대다. 그래서:

- HIP 은 지시대로 630 에 정확히 놓였다(배치 자체는 버그 아님)
- 그 HIP 아래로 실제 메시 좌골이 110mm 더 내려가 **520** 이 된다
- 안장 표면은 683.1 → **163.1mm 관통**

**정합 조건**: 좌골이 안장에 얹히려면 `HIP z = 683.1 + 110.0 = 793.1` → 현재보다 **163.1mm 상승**.
(검산: 필요 상승량 163.13 = 총 수직오차 163.13 ✓)

---

## 2. F2-2 판정 — `saddleHeight` 변경을 **제안하지 않는다**

지시는 "안장을 낮아진 탑튜브만큼 내려라" 였으나, 계측 결과 **안장 높이는 옳고 병목은 다른
곳**이다. 근거를 든다.

### 2-1. 안장 높이는 인체공학 기준과 일치

| 기준 | 값 |
|---|---|
| 인체 SSoT 인심 | 82cm |
| **LeMond 공식** (inseam × 0.883) | **724.1mm** |
| 일반 허용범위 (×0.87~0.89) | 713~730mm |
| **현재 `saddleHeight`** | **725** (인심 대비 0.884) |

**±1mm 로 일치한다. 낮출 근거가 없다.**

### 2-2. 낮춰도 해결되지 않는다

BDC 무릎 30°(기준 25~35° 중앙) 달성에 필요한 값을 스캔했다. 셀 = 실제 고관절~발목 거리 − 필요 거리(양수 = 다리 부족):

| saddleHeight \ scale | 0.88 | 0.95 | 1.00 | 1.05 | 1.10 |
|---|---|---|---|---|---|
| 725 | 223.6 | 172.4 | 136.0 | 99.6 | 63.3 |
| 650 | 150.6 | 99.6 | 63.4 | 27.2 | -9.0 |
| 600 | 102.1 | 51.3 | 15.2 | -20.9 | -56.8 |
| 550 | 53.8 | 3.3 | -32.7 | -68.6 | -104.4 |
| 500 | 5.8 | -44.5 | -80.3 | -116.0 | -151.6 |

**현행 scale 0.88 에서 정합하려면 `saddleHeight` ≈ 490~500mm** 가 필요하다. 이는 LeMond 기준
724 의 **68%** 로, 인체공학적으로 불가능한 안장 높이다(무릎을 심하게 접고 타는 자세).

**즉 안장을 내려 맞추는 것은 증상 치료이며, SSoT 를 인체 기준에서 이탈시킨다.**
F2 금지사항 "geometry.json 을 메시에 맞추는 역방향 수정 금지" 의 정신에도 어긋난다고 본다.

### 2-3. 진짜 병목 — 다리 길이

| 층 | thigh | shank | 합 |
|---|---|---|---|
| 인체 SSoT (`riderAnthropometry.json`) | 429 | 430 | **859mm** |
| GLB 뼈 실측 (scale 1.0) | 430 | 350 | **780mm** |
| **현재 적용 (×0.88)** | **378.4** | **308** | **686.4mm** |

- GLB 뼈가 인체 SSoT 보다 **79mm 짧다**(shank 가 특히 350 vs 430 = -80mm)
- 여기에 scale 0.88 이 곱해져 **686mm** 까지 줄어든다
- **현재 자세조차 이미 BDC 도달 불가**: 필요 거리 724.1 vs 다리 686.4 → **37.7mm 부족**
- 이것이 게이트 실패 사유 `BDC knee flexion 21.497° is outside 25–35°` 의 정체다

**안장 정합(HIP +163mm)을 하면 부족분이 200.4mm 로 커진다.**

### 2-4. 제안 (적용 안 함 — 승인 대기)

`saddleHeight` 는 **그대로 두고**, 다음 순서를 제안한다:

1. **`hipY` 파생식 수정** — `saddle − HIP_DROP` → `안장표면 + 좌골오프셋(메시 실측)`.
   이것이 F2-1 이 밝힌 구조적 오류이며, 안장·다리와 무관하게 그 자체로 틀렸다.
2. 그 뒤 **다리 길이**를 다룬다(= 사용자 원지시 4단계). scale 인상 또는 shank 연장.
   **감리 지시 없이 손대지 않았다**(§4 금지사항 준수).

> **이견 표명**: 지시 §2 배경의 2단계 "안장·핸들을 낮아진 탑튜브만큼 내린다" 는, 계측 결과
> 안장에는 해당하지 않는다고 판단한다. 탑튜브 하강은 `seatTubeJunction` 을 내렸을 뿐
> `seatTop`(안장 클램프)·`saddleHeight` 는 F1 이 의도적으로 불변으로 뒀고, 안장 높이는
> 원래부터 인체 기준과 맞았다. **감리가 달리 판단하면 지시대로 수행하겠다.**

---

## 3. F2-3 판정 — 후드 하강은 **충분하다**

| 항목 | 값 |
|---|---|
| `riderRig` 실제 후드 | HOOD_L [534.3, 878.6, 189.0] (BB z **608.1**) |
| joints 손 목표 `handL` | [534.28, 878.59, 189] |
| **일치 여부** | **소수점까지 동일** |
| `measures.static` 손L/손R | **0 / 0** |

**손 목표가 후드 좌표 그 자체다.** F1 으로 `headTop` 이 539.5 로 내려가며 후드도 641.6 → 608.1
로 함께 내려갔고, joints 는 그 신좌표로 생성돼 있다. **추가 하강(스페이서·스템 각도) 불필요.**

다만 `handErr 30.4mm` 가 남아 있다 — 이는 후드 위치 문제가 아니라 **팔이 그 목표에 30.4mm
못 미친다**는 뜻이다(다리 부족과 같은 성격). 팔 길이는 §4 금지사항이므로 손대지 않았다.

---

## 4. §3 안장 접점 뷰 — **추가하지 않았다** (실패 보고)

감리가 뷰 추가를 승인했고 시도했으나, **두 번 실패한 뒤 물리적으로 불가능함을 확인**했다.

| 시도 | 카메라 | 결과 |
|---|---|---|
| 1 | 하방 시선 `dir [-0.25,∓1,-0.42]`, dist **0.55** | 카메라가 엉덩이 메시 내부로 들어가 클리핑. 안장 0픽셀 |
| 2 | 같은 방향, dist **1.05** | 엉덩이 밖으로 나왔으나 여전히 안장 0픽셀 |

**원인**: 각도·거리 문제가 아니다. 좌골이 안장보다 163mm 아래라 **안장이 엉덩이 메시 내부에
파묻혀 있다.** 물체가 다른 물체 안에 있으면 바깥 어느 방향에서도 보이지 않는다.
`CU_SADDLE`(위 사선)이 안 보이는 것도 같은 이유다.

**해결책은 이미 존재한다 — 반투명 표식 렌더.** `render-saddle-evidence.py` 의
`SADDLE_{LEFT,RIGHT,REAR}_{NORMAL,MARKED}` 6장이 라이더를 반투명으로 만들고
좌골(적)·안장 표면(녹)·HIP(황)·오차 벡터(청록)를 얹는다. `SADDLE_LEFT_MARKED.png` 를 열면
163mm 수직 오차가 청록 벡터로 그대로 보인다 — **이것이 판정 가능한 유일한 뷰다.**

**따라서 필수 뷰 목록은 33장 그대로 두고**(장수 변경 없음 → 검증기 갱신 불필요), 대신
`required-views.mjs` 에 **"안장 접점은 카메라 뷰로 판정 불가, 반투명 표식 경로를 쓰라"** 는
경고 주석과 실측 근거를 남겼다. 다음 사람이 같은 시도를 반복하지 않게 하기 위함이다.

> 감리가 그래도 뷰 추가를 원하면 지시 바란다. 다만 위 근거상 **불투명 렌더로는 판정이
> 불가능**하다는 것이 제 판단이다.

---

## 5. 변경 파일 (diff 요약)

| 파일 | 변경 | 성격 |
|---|---|---|
| `apps/web/scripts/rider-cycle-fit/render-saddle-evidence.py` | ① 안장 검출을 SSoT 파생 기대위치 기준으로 교체(시트포스트 오검출 수정) ② 검출 후보·근거를 manifest 에 기록 ③ 검출 실패 시 예외 ④ cycle GLB 오버라이드 인자 | **버그 수정** |
| `apps/web/scripts/rider-cycle-fit/required-views.mjs` | 안장 접점 판정 불가 사유·대안 경로 주석 추가 (**뷰 목록 자체는 불변 33장**) | 문서화 |
| `blender/rider-cycle-fit/inspect-saddle-detect.py` (신규) | 안장 검출 진단 — 필터가 무엇을 고르는지 실측 | 진단 도구 |

- `geometry.json` **미변경** (`saddleHeight` 725 그대로)
- `export-ik-joints-v2.mjs` **미변경** (§2-4 는 제안일 뿐 적용 안 함)
- 라이더 신체 치수·정강이·팔 **미변경**
- `git commit` **없음**, 제품 GLB **미변경**

---

## 6. 검증기 결과

```
verify-renders.mjs 20260731-F2-AFTER --before 20260731-F1R-AFTER --require-before
  → 전 10항목 ✔ PASS (Before/After inputHash·scale·lean·profile·해상도·세트 일치)

verify-saddle-evidence.mjs 20260731-F2-AFTER
  → ✔ saddle-independent 함수 해시·금지 입력·민감도 재계산·legacy 격리 계약 통과
  → ✔ 증거 완비; gate=FAIL_UNAPPROVED (승인 아님)
```

**게이트 FAIL 은 예상된 결과다** — 계측 단계이며 아직 아무것도 고치지 않았다. 사유 2건:
1. `BDC knee flexion 21.497° is outside 25–35°` → §2-3 다리 부족
2. `rider-only ischial sensitivity max shift 33.243mm exceeds 20.0mm` → 아래 §7-1

---

## 7. 실패·미완·막힌 항목 (숨기지 않음)

### 7-1. [미해결] 좌골 민감도 33.2mm > 허용 20mm

`rider_only_ischial` 의 weight threshold(0.15/0.25/0.40) × 하부 percentile(15/20/25) 조합에서
좌골점이 최대 33.2mm 이동한다. 허용 20mm 초과 → 게이트가 PASS 를 금지한다.

좌골 정의를 느슨하게 바꾸면 통과시킬 수 있으나, **그것이 바로 "수치를 조정해 통과시키기"**
이므로 하지 않았다. 다만 현재 163mm 오차 앞에서 33mm 민감도는 결론을 바꾸지 않는다
(163 − 33 = 130mm 여도 여전히 심각한 관통). **정합 작업 후 재평가할 항목으로 남긴다.**

### 7-2. [F1 §5-1 정정] 제 이전 진단이 틀렸다

F1 보고 §5-1 에서 "골반이 안장보다 뒤·위로 떠 있다" 고 썼다. **틀렸다.** 실제는 반대로
**좌골이 안장 아래 163mm 로 파묻혀** 있다. 원인은 렌더 육안만으로 판정했고 수치 계측을
하지 않은 것이다. 다만 그때도 "F1 이 만든 결함이 아니다"라는 결론 자체는 유효하다
(Before/After 라이더 실측 동일 — 이번에도 재확인).

### 7-3. [범위 밖] 안장 메시 상면과 SSoT 기준점의 11.9mm 차이

안장 표면 실측 683.1 vs SSoT `coords.saddle` y 695 = **-11.9mm**. 안장 메시 두께/형상에서
오는 값으로 보이나 확정하지 않았다. 163mm 앞에서 부차적이라 파고들지 않았다.

---

## 8. 생성 이미지 절대경로 전체 목록 (83장, 선별 없음)

### 8-1. F2 후보 `20260731-F2-AFTER` (44장) — **판정용, 여기부터 볼 것**

**⭐ 안장 접점 판정은 아래 6장(반투명 표식)으로만 가능하다:**
```
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-AFTER/SADDLE_LEFT_MARKED.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-AFTER/SADDLE_RIGHT_MARKED.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-AFTER/SADDLE_REAR_MARKED.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-AFTER/SADDLE_LEFT_NORMAL.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-AFTER/SADDLE_RIGHT_NORMAL.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-AFTER/SADDLE_REAR_NORMAL.png
```
종합판·비교:
```
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-AFTER/contact-sheet-saddle-evidence.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-AFTER/contact-sheet-static.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-AFTER/contact-sheet-pedal.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-AFTER/contact-sheet-rider-only.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-AFTER/before-after.png
```
전신·정적(사용자 지시: 확대만 보내지 않음):
```
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-AFTER/STATIC_SIDE_L.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-AFTER/STATIC_SIDE_R.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-AFTER/STATIC_FRONT.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-AFTER/STATIC_REAR.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-AFTER/STATIC_TOP.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-AFTER/STATIC_Q_FRONT.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-AFTER/STATIC_Q_REAR.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-AFTER/STATIC_CU_SADDLE.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-AFTER/STATIC_CU_HAND_L.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-AFTER/STATIC_CU_HAND_R.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-AFTER/STATIC_CU_FOOT_L.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-AFTER/STATIC_CU_FOOT_R.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-AFTER/STATIC_CU_KNEE_FRONT.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-AFTER/RIDER_ONLY_SIDE_L.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-AFTER/RIDER_ONLY_FRONT.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-AFTER/RIDER_ONLY_REAR.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-AFTER/RIDER_ONLY_Q_FRONT.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-AFTER/PHASE_0_FULL.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-AFTER/PHASE_0_FOOT_L.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-AFTER/PHASE_0_FOOT_R.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-AFTER/PHASE_0_CRANKSYNC.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-AFTER/PHASE_90_FULL.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-AFTER/PHASE_90_FOOT_L.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-AFTER/PHASE_90_FOOT_R.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-AFTER/PHASE_90_CRANKSYNC.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-AFTER/PHASE_180_FULL.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-AFTER/PHASE_180_FOOT_L.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-AFTER/PHASE_180_FOOT_R.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-AFTER/PHASE_180_CRANKSYNC.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-AFTER/PHASE_270_FULL.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-AFTER/PHASE_270_FOOT_L.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-AFTER/PHASE_270_FOOT_R.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-AFTER/PHASE_270_CRANKSYNC.png
```

### 8-2. 계측 후보 `20260731-F2-MEASURE` (39장) — 검출 수정 전후 대조용

```
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-MEASURE/SADDLE_LEFT_MARKED.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-MEASURE/SADDLE_LEFT_NORMAL.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-MEASURE/SADDLE_RIGHT_MARKED.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-MEASURE/SADDLE_RIGHT_NORMAL.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-MEASURE/SADDLE_REAR_MARKED.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-MEASURE/SADDLE_REAR_NORMAL.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-MEASURE/STATIC_SIDE_L.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-MEASURE/STATIC_SIDE_R.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-MEASURE/STATIC_FRONT.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-MEASURE/STATIC_REAR.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-MEASURE/STATIC_TOP.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-MEASURE/STATIC_Q_FRONT.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-MEASURE/STATIC_Q_REAR.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-MEASURE/STATIC_CU_SADDLE.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-MEASURE/STATIC_CU_HAND_L.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-MEASURE/STATIC_CU_HAND_R.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-MEASURE/STATIC_CU_FOOT_L.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-MEASURE/STATIC_CU_FOOT_R.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-MEASURE/STATIC_CU_KNEE_FRONT.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-MEASURE/RIDER_ONLY_SIDE_L.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-MEASURE/RIDER_ONLY_FRONT.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-MEASURE/RIDER_ONLY_REAR.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-MEASURE/RIDER_ONLY_Q_FRONT.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-MEASURE/PHASE_0_FULL.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-MEASURE/PHASE_0_FOOT_L.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-MEASURE/PHASE_0_FOOT_R.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-MEASURE/PHASE_0_CRANKSYNC.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-MEASURE/PHASE_90_FULL.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-MEASURE/PHASE_90_FOOT_L.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-MEASURE/PHASE_90_FOOT_R.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-MEASURE/PHASE_90_CRANKSYNC.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-MEASURE/PHASE_180_FULL.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-MEASURE/PHASE_180_FOOT_L.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-MEASURE/PHASE_180_FOOT_R.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-MEASURE/PHASE_180_CRANKSYNC.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-MEASURE/PHASE_270_FULL.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-MEASURE/PHASE_270_FOOT_L.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-MEASURE/PHASE_270_FOOT_R.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-MEASURE/PHASE_270_CRANKSYNC.png
```

### 8-3. 데이터 파일

```
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-AFTER/render-manifest.json      ← saddleContactEvidence 전체
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-MEASURE/render-manifest.json
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F2-MEASURE/saddle-detect.json      ← 안장 오검출 진단 근거
```

---

## 9. 감리 판단 요청

1. **§2-4 `hipY` 파생식 수정** — `saddle − HIP_DROP` → `안장표면 + 좌골오프셋`. 구조적 오류이며
   안장·다리와 독립적으로 틀렸다. 수정 지시를 요청한다.
2. **§2 이견** — `saddleHeight` 725 는 인체 기준과 일치하므로 낮추지 않는 것이 옳다고 판단했다.
   감리가 달리 판단하면 지시대로 수행하겠다.
3. **§4 안장 뷰** — 불투명 렌더로는 판정 불가라고 판단해 뷰를 추가하지 않았다. 재지시 가능.
4. **§7-1 좌골 민감도 33.2mm** — 정합 후 재평가할지, 지금 좌골 정의를 다듬을지 판단 바람.
