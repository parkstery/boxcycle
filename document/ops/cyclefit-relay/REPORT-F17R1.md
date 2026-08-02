# 개발팀장 → 감리 보고서

- **지시번호**: F17-R1 (좌골 기준 안장 높이 확정 — 프레임은 최종 모델 그대로)
- **발신**: 개발팀장0801
- **수신**: 클로드감리0801
- **일시**: 2026-08-02
- **모델 사용 내역**: **전부 Opus 직접. 위임 없음** (SSoT 파생 방향 전환이라 설계 판단.
  코드 변경 2파일 약 60줄.)

---

## 0. 그림에서 보이는 것

### `SADDLE_SEAT.png` (최상단)

```
C:\20.HDev\boxcycle\apps\web\scripts\rider-cycle-fit\.out\candidates\20260802-F17R1-CENTROID\SADDLE_SEAT.png
```

| 질문 | 답 |
|---|---|
| **시트포스트가 보이는가** | **보인다.** junction 위로 노출된 포스트가 안장을 받치고 있다(66.9mm) |
| **엉덩이가 안장에 얹혀 보이는가** | **아니다.** 안장은 허벅지 **아래**에 있고 엉덩이(RED)는 안장보다 **위·뒤** 공중에 있다 |
| 높이는 맞는가 | 맞다 — 안장 상면 730.5 · 좌골 730.52, **차 −0.02mm** |

**높이는 완벽히 맞췄지만 앞뒤가 121.6mm 어긋나 "앉아 있는 그림"이 되지 않는다.**
§3 합격 기준("엉덩이가 안장에 얹혀 보인다")은 **미충족**이다.

---

## 1. §0 감리 정정 검산 — **맞다. 감리 정정이 옳다**

`generate-rider-prototype-glb.mjs` 코드가 직접 확인해준다:

```js
// F4-2 이후 **메시로는 그리지 않는다**(시트튜브가 junction 에서 끝나므로).
const seatTop = [...RIG_SEAT_TOP, 0];
void seatTop;                              // ← 메시 미사용
...
const _seatTubeJunctionLenM = (SEAT_TUBE_LENGTH_MM - SEAT_TUBE_SHORTENING) / 1000;
const _postRiseM = SADDLE_CONTACT[1] - seatTubeJunction[1];   // 시트포스트를 여기서 그린다
```

| 항목 | 감리 | **검산** |
|---|---|---|
| 시트튜브 실제 끝 (BB y) | 393.1 | **393.12** ✔ |
| 안장 (saddleHeight 479.8) | 460.0 | **460.04** ✔ |
| **노출 시트포스트** | 66.9 | **66.93** ✔ |
| 유물 `seatTop` (560×sin STA) | 536.9 | **536.94** ✔ |

**"물리적 불가능"은 없었다.** F12 §0-1 에서 그 결론을 처음 올린 것은 나이고,
**존재하지 않는 튜브(유물 `seatTop`)와 안장을 비교한 내 오류**다.
렌더 실측으로도 확인했다: junction 663.62(지면) · 안장 730.5 → **노출 66.88mm**.

---

## 2. §2-2 좌골 정의 — **centroid(730.52) 유지를 제안한다**

### 2-1. 두 안의 산술 결과

| 정의 | 좌골(지면) | `saddleHeight` | 안장 x | **좌골↔안장 앞뒤** | 노출 포스트 |
|---|---|---|---|---|---|
| **밴드 centroid** (채택) | **730.52** | **479.8** | −156.3 | **121.6mm** | **66.9mm** |
| 골반 메시 최하점 | 682.33 | 429.5 | −142.0 | **135.9mm** | 18.7mm |

### 2-2. 【핵심】 안장을 낮출수록 앞뒤 어긋남이 **악화된다** — 구조적 발견

```
saddleX = −(saddleHeight · cos 73.5°) − 20
```

`saddleHeight` 가 작아지면 `saddleX` 가 **0 쪽(앞)으로 이동**한다. 좌골은 x −277.87 로
뒤에 고정돼 있으므로 **안장을 낮출수록 멀어진다.**

```
centroid 안 : 안장 x −156.3  →  어긋남 121.6mm
mesh-low 안 : 안장 x −142.0  →  어긋남 135.9mm   (+14.3mm 악화)
```

역으로 좌골 x(−277.87)에 안장을 맞추려면
`−(h·cos73.5°) − 20 = −277.87` → **h = 907.9** 이 되어 안장 높이가 지면 **1140.9mm**,
좌골(730.5)보다 410mm 위가 된다. **불가능하다.**

⟹ **`seatTubeAngle` 73.5° · `saddleSetback` 20 이 고정인 한, 높이와 앞뒤를 동시에
맞출 수 없다.** 이것이 "엉덩이가 안장에 안 앉아 보이는" 진짜 원인이며,
좌골 정의를 바꿔서 해결되지 않는다.

**따라서 centroid(730.52)를 유지한다** — 어긋남이 더 작고, 노출 포스트도 66.9mm 로
자연스러우며, F12~F14 렌더와 연속성이 있다.

> **미완**: 지시 §4-2 가 요구한 `SADDLE_MESHLOW.png` 를 굽지 못했다(§6-1).
> 위 결론은 산술로 확정적이나 **그림 비교는 하지 못했다.**

---

## 3. §2-3 파생 방향 뒤집기 — **완료. 이번 작업의 본체**

`apps/web/src/lib/riderPrototype/riderRig.geometry.mjs`

### 3-1. 전후

```
예전:  geometry.json.saddle → SADDLE_CONTACT → PELVIS_ROOT(+15,+60) → HIP
       (사람이 자전거에 맞춰진다)

지금:  HIP_GROUND (−211.28, 836.88)          ← 1차 입력. 라이더 자세가 정한다
         ↓ HIP_TO_ISCHIAL_M 0.10636 (메시 실측)
       ISCHIAL_Y_M 0.73052                    ← 좌골 = 안장 상면 높이
         ↓ seatTubeAngle 73.5 · setback 20 (불변)
       SADDLE_HEIGHT_DERIVED_MM 479.78        ← 시트포스트 길이(파생)
       SADDLE_CONTACT (−156.26, 730.52)
```

### 3-2. 검산 — **값이 하나도 바뀌지 않는다**

| 항목 | 새 파생 | 기존 저장값 | |
|---|---|---|---|
| `PELVIS_ROOT` | **(−211.28, 836.88)** | (−141.3, 790.5) | **F14 hip 과 일치로 교정됨** |
| `SADDLE_HEIGHT_DERIVED_MM` | **479.78** | `saddleHeight` 479.8 | ✔ |
| `SADDLE_CONTACT` | **(−156.26, 730.52)** | `coords.saddle` (−156.3, 730.5) | ✔ |
| `verify-fit` 안장 파생식 | — | — | **✔ 통과** |

**`geometry.json` 은 한 글자도 바꾸지 않았다**(diff 0). 파생 방향만 뒤집었는데
같은 값이 나온다 = 무결하게 전환됐다.

### 3-3. 부수 효과 — **F16 §5-2 충돌이 해소됐다**

F16 에서 "앱 IK 의 hip 이 안장 파생이라 F14 와 70.0/46.4mm 어긋난다"고 올렸던 문제가
이 전환으로 **사라졌다**. `riderGlbPedalPose.pose.mjs` 는 `riderRig` 를 import 하므로
앱 IK 도 이제 F14 hip 에서 다리를 푼다. F16 §9-1 의 결정 대기 항목(A/B/C)은
**A 를 실행한 셈**이 됐다.

---

## 4. §2-4 `coords.seatTop` 유물 처리 — **주석 명시 + 대체 상수 신설**

**제거하지 않고 주석으로 명시**했다. 근거:

1. `seatTubeLength` 560 의 기준점으로 SSoT 대조에 쓰인다(생성기 주석이 그렇게 적고 있다)
2. `geometry.json` 은 §5 에서 수정 금지이고, `coords.seatTop` 삭제는 `saddleHeight` ·
   `coords.saddle` 외의 변경이 되어 §6 증명 요건과 충돌한다
3. 제거보다 **"쓰지 말 것"을 코드에 박는 편이 재발 방지에 직접적**이다

`riderRig.geometry.mjs` 변경:

```js
/** ⚠ **유물 — 판정에 쓰지 마라.** … F12~F16 이 이 유물과 안장을 비교해
 *  "76.9mm 아래라 물리적으로 불가능"이라고 다섯 단계에 걸쳐 오판했다. … */
export const SEAT_TOP = coordM("seatTop");

/** 시트튜브가 **실제로 끝나는** 지점(BB y, mm) */
export const SEAT_TUBE_JUNCTION_Y_MM = (SEAT_TUBE_LENGTH_MM - 150) * Math.sin(sta);
/** 노출 시트포스트 길이(mm). **음수면** 진짜 물리적 불가능이다. */
export const SEATPOST_EXPOSED_MM = ISCHIAL_Y_M*1000 - BB_HEIGHT_MM - SEAT_TUBE_JUNCTION_Y_MM;
```

`render-all.py` 에도 같은 계측을 넣어 **매 렌더에 `noutput 시트포스트` 를 찍는다**
(`seatTubeJunctionZMm` · `seatpostExposedMm` · `legacySeatTopZMm` + "판정에 쓰지 말 것" 주석).

---

## 5. 실측값 (centroid 안, `20260802-F17R1-CENTROID`)

```
[좌골]     중점 높이 730.52 · x −277.87  (L 731.14 / R 729.90)
[안장-좌골] 안장상면 730.5 / 좌골 730.52 → **높이차 −0.02mm**
            좌골 x −277.9 / 안장 x −156.3 → **앞뒤 어긋남 121.6mm(좌골이 뒤)**
[시트포스트] junction 663.62(지면) → 안장 730.5 = **노출 66.88mm**
            유물 legacySeatTop 807.44 ← 판정에 쓰지 말 것
[발접촉]   전 4위상 발목 좌 0.0 / 우 0.0mm  OK   메시↔본 0.0
[발중심]   페달축 49.1% · 수평 좌 2.5 / 우 3.4mm
[BDC 무릎] **25.93°**  (F14 유지)
[자세]     몸통각 44.66° · 골반경사 10° · 엉덩이 (−211.28, 0, 836.88)
assert 4종 (프레임·joints신선도·위상·발접촉) **전부 PASS** · 41장 생성 · 누락 0
```

---

## 6. 합격 기준 대조

| 항목 | 기준 | 결과 | |
|---|---|---|---|
| **엉덩이가 안장에 얹혀 보인다** | 렌더 판정 | **미충족** — 앞뒤 121.6mm 어긋남(§2-2) | ✘ |
| **시트포스트가 보인다** | 노출 포스트 존재 | **66.88mm 노출, 그림에 보인다** | ✔ |
| 안장 상면 − 좌골 | ±2mm | **−0.02mm** | ✔ |
| 파생 방향 | HIP → 좌골 → 안장 | **뒤집음. 역방향 없음** | ✔ |
| 프레임 불변 | `git diff` 증명 | **geometry.json diff 0** | ✔ |
| 발접촉 4위상 | 좌·우 0.0mm | **0.0 / 0.0mm** | ✔ |
| BDC 무릎 | 25.93° | **25.93°** | ✔ |
| assert 4종 | PASS | **전부 PASS** | ✔ |

**첫 항목 미충족이므로 이번 지시는 합격이 아니다.** 원인은 좌골 정의가 아니라
시트각·setback 고정에서 오는 **구조적 제약**이다(§2-2).

---

## 7. 실패·미완·막힌 항목

1. **`SADDLE_MESHLOW.png` 미생성**(§4-2) — 2안 그림 비교를 못 했다. 결론은 산술로
   확정적이지만 **지시가 요구한 그림 비교는 미이행**이다.
2. **`SADDLE_CENTROID.png` 파일명 미준수** — 같은 그림이 `SADDLE_SEAT.png` ·
   `SADDLE_GAP.png` 로 나갔다.
3. **엉덩이가 안장에 안 앉아 보인다**(§0·§6) — 해결하려면 `seatTubeAngle` 또는
   `saddleSetback` 을 풀어야 하는데 §5 가 금지했다. **결정이 필요하다**(§9).
4. **`geometry.json` 인코딩 손상 사고 1건 — 즉시 복원했다.** mesh-low 렌더를 위해
   PowerShell 로 JSON 을 재작성하다 한글이 전부 깨졌다. 백업에서 복원해 `git status`
   깨끗함·한글 정상을 확인했다. **JSON 은 앞으로 Edit 도구로만 고친다.**
5. `PELVIS_HALF_Z` 0.09 vs V2 실측 0.0814 불일치 — F16 미뤄둔 항목, 그대로.
6. 커밋·push 하지 않았다.

---

## 8. `git status` / diff

```
 M apps/web/scripts/rider-cycle-fit/render-all.py         ← 시트포스트 계측 + SADDLE_SEAT 뷰
 M apps/web/src/lib/riderPrototype/riderRig.geometry.mjs  ← 파생 뒤집기 + seatTop 유물 주석
 M document/ops/cyclefit-relay/*.md
?? blender/rider-cycle-fit/decompose-v2-rider.py          ← F16 산출
?? apps/web/public/rider/prototype/rider-lowpoly.glb.pre-F15.bak

$ git diff --numstat apps/web/src/lib/riderPrototype/geometry.json
(출력 없음 — **diff 0**)
```

**`geometry.json` 은 `saddleHeight` 조차 바꾸지 않았다.** 파생을 뒤집었더니 기존 값이
그대로 정답이었기 때문이다.

---

## 9. 이견 · 다음 결정

### 9-1. §0 정정은 옳다. 다만 **원 오판의 출처는 나다**

F12 §0-1 에서 "안장이 시트튜브보다 76.9mm 아래라 실현 불가"를 처음 올린 것이 나다.
감리가 세 번 독립 확인했다지만, **먼저 유물 필드를 판정에 쓴 것은 내 잘못**이다.
`generate-rider-prototype-glb.mjs:304` 의 `void seatTop` 주석이 그때도 그 자리에 있었다.

### 9-2. 【결정 필요】 앞뒤 어긋남 121.6mm 를 어떻게 할 것인가

높이는 완전히 맞췄다. 남은 것은 앞뒤뿐이며 **좌골 정의로는 못 푼다**(§2-2).

| 안 | 내용 | 영향 |
|---|---|---|
| **A** | `saddleSetback` 20 → **~142** 로 키운다 | 안장만 뒤로. 프레임 튜브는 불변. **가장 국소적** |
| B | `seatTubeAngle` 73.5° → 완만하게 | 프레임 형상 변경 — 사용자 최종 승인 형태 훼손 |
| C | 라이더를 앞으로 옮긴다 | F12 자세 확정값 파기 — §5 금지 |
| D | 현 상태 수용(안장은 허벅지 아래) | 그림이 부자연스럽다 |

**A 를 권한다.** `saddleSetback` 은 프레임 튜브가 아니라 **안장 레일 조절 범위**이고,
실제 자전거에서도 안장 앞뒤는 그렇게 맞춘다. 다만 142mm 는 실물 레일 조절폭
(보통 ±25~35mm)을 크게 넘으므로, **시트포스트 오프셋(레이백)까지 포함한 값**으로
봐야 한다. 결정해 주시면 §2-3 파생식에 그대로 얹으면 된다.

---

## 10. 생성 이미지

후보: `C:\20.HDev\boxcycle\apps\web\scripts\rider-cycle-fit\.out\candidates\20260802-F17R1-CENTROID\`

```
SADDLE_SEAT.png        ← 최상단. 안장·좌골·시트포스트 + 수치 스탬프
SADDLE_GAP.png         같은 계측, 다른 프레이밍
FULL_BDC_R.png  FULL_BDC_R_SIDE_L.png  POSTURE_ANGLE.png  ARM_ELBOW.png
ARM_ALT_PROPORTIONAL.png  BDC_R_LOWPOINT.png  STATIC_CU_SADDLE.png
STATIC_{SIDE_L,SIDE_R,FRONT,REAR,TOP,Q_FRONT,Q_REAR}.png
STATIC_CU_{FOOT_L,FOOT_R,HAND_L,HAND_R,KNEE_FRONT}.png
RIDER_ONLY_{SIDE_L,FRONT,REAR,Q_FRONT}.png
PHASE_{0,90,180,270}_{FULL,FOOT_L,FOOT_R,CRANKSYNC}.png
```
총 41장 · 필수 33장 누락 0 · 로그 `01-render.log`

---

## 11. 지시 §5 준수 확인

| 금지 항목 | 준수 |
|---|---|
| 프레임 수정(`seatTubeLength` 560 등) | **하지 않음** — geometry.json diff 0 |
| 시트튜브 단축 | **하지 않음** (철회 지시 반영) |
| 엉덩이 위치·자세 변경 | **불변** — (−211.28, 836.88) · 44.66° · 경사 10° |
| `SCALE`·허벅지·정강이·`ANKLE_BACK`·`ANKLE_UP` | **전부 불변** |
| 앱 이식·손가락·팔 비율 | **손대지 않음** |
| assert 완화 / push / 제품 GLB | **전부 하지 않음** |
