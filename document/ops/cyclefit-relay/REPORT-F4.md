# 개발팀장 → 감리 보고서

- **지시번호**: F4
- **발신**: 개발팀장0731
- **수신**: 클로드감리0731
- **일시**: 2026-07-31
- **모델 사용 내역**: **전부 Opus 직접. 위임 없음**
  (사유: §1-1 해당 — F4-3 은 "시트포스트 축을 어떻게 잡을 것인가"라는 지오메트리 파생 판단이
  핵심이었다. 코드 변경도 파일 1개·40줄 미만이라 §1-4 눈금상 직접이 유리하다.)

---

## 0. 결론 요약

| 항목 | 결과 |
|---|---|
| **F4-1 회색 노출 제거** | **완료.** 스페이서 `COL.spacer` → `COL.frame`. 렌더에서 회색 띠 소멸 확인 |
| **F4-2 시트튜브 단축** | **완료.** 실측 **559.95 → 410.00mm** (−149.95). junction 에서 정확히 끝남 |
| **F4-3 시트포스트 평행** | **완료.** 실측 축각 **73.5°** = SSoT `seatTubeAngle` **73.5°**, 어긋남 **0.000°** |
| 노출 시트포스트 | **150 → 314.85mm** (지시 예상 "약 300mm"와 부합) |
| 렌더 | 자전거 13장 + 결합 37장 = **50장**. `verify-renders --require-before` **전항목 PASS** |
| 금지사항 | `geometry.json`·라이더·`hipY`·commit·제품 GLB **전부 미변경** |

---

## 1. F4-1 헤드튜브 상단 회색 노출 제거

### 변경

[generate-rider-prototype-glb.mjs:462](apps/web/scripts/generate-rider-prototype-glb.mjs#L462)

```diff
- const spacerMesh = tube(headTubeTop, spacerTop, 0.024, COL.spacer, {...});
+ const spacerMesh = tube(headTubeTop, spacerTop, 0.024, COL.frame, {...});
```

- `COL.spacer`(0x3d4148) **상수는 지우지 않았다** — 지시대로 회귀 위험을 피했다.
  현재 이 상수를 참조하는 곳은 없으나 정의는 남아 있다.
- `SPACER_STACK` 35mm·스페이서 길이·위치 **변경 없음**. 색만 바꿨다.
- 스템·핸들바(`COL.bar`, 검정) **그대로 두었다** — 사용자는 회색 띠만 지적했다.
- 헤드셋과 스템의 시각적 구분은 이제 색이 아니라 **굵기**(0.024 vs 0.020)가 맡는다.
  주석에 이 근거를 남겼다.

### 육안 판정

`BIKE_AFTER_CU_HEADTUBE.png` — **헤드튜브 상단의 회색 띠가 완전히 사라졌고** 프레임 색으로
이어진다. 검정 스템은 그대로 유지된다. Before(`BIKE_BEFORE_CU_HEADTUBE.png`)와 비교하면
차이가 명확하다.

---

## 2. F4-2 시트튜브를 junction 까지로 단축

### 변경

```diff
  // 시트튜브
- root.add(tube(bb, seatTop, R_SEAT, COL.frame, frameOpts));           // BB → seatTop(560)
+ root.add(tube(bb, seatTubeJunction, R_SEAT, COL.frame, frameOpts));  // BB → junction(410)
```

상수 의미 변경도 반영했다:

```diff
- const SEATPOST_EXPOSED = 150;    // "노출 시트포스트 길이"
+ const SEAT_TUBE_SHORTENING = 150; // "시트튜브 단축량"
```

지시 §F4-2 가 "상수의 의미가 바뀐다, 주석을 갱신하라"고 했으므로 **이름까지 바꿨다.**
값 150 은 그대로다(감리 확정값). 실제 노출 시트포스트는 이제 이 값보다 길다(314.85mm).

`seatTop` 변수는 메시로 그리지 않게 됐으나 **삭제하지 않았다** — `seatTubeLength` 560 의
기준점으로 SSoT 대조·디버깅에 쓰이므로 `void seatTop;` 로 의도를 명시하고 보존했다.

### 실측 (메시 정점 PCA, BB 원점 mm)

| | Before(F3) | **After(F4)** |
|---|---|---|
| 시트튜브 축각 | 73.504° | **73.5°** |
| 시트튜브 길이 | **559.95mm** | **410.00mm** |
| 시트튜브 하단→상단 | [0,0] → [-159, 536.9] | [0,0] → **[-116.45, 393.12]** |

**−149.95mm 단축.** 상단이 `seatTubeJunction` [-116.446, 393.116] 과 소수점 둘째 자리까지
일치한다 — 정확히 접합점에서 끝난다.

---

## 3. F4-3 시트포스트 각도 — **73.5° 달성, 어긋남 0.000°**

### 변경

```diff
- root.add(tube(seatTop, [saddlePos[0], saddlePos[1]-0.01, 0], 0.011, COL.bar, frameOpts));
+ root.add(tube(seatTubeJunction, seatPostTop, 0.011, COL.bar, frameOpts));
```

`seatPostTop` 을 **파생값으로 새로 계산**했다(하드코딩 없음):

```js
const _postRiseM = SADDLE_CONTACT[1] - seatTubeJunction[1];   // 안장 높이까지 수직 상승
const _postLenM  = _postRiseM / Math.sin(_seatTubeAngleRad);  // 73.5° 축 위 길이
const seatPostTop = [
  seatTubeJunction[0] - _postLenM * Math.cos(_seatTubeAngleRad),
  seatTubeJunction[1] + _postLenM * Math.sin(_seatTubeAngleRad), 0,
];
```

즉 **junction 에서 시트튜브 축(73.5°)을 그대로 연장**해, 안장과 같은 높이가 되는 지점까지
그린다. 안장 좌표(`SADDLE_CONTACT`)는 **건드리지 않았다.**

### 실측 — 지시 §4가 요구한 숫자

| 항목 | Before(F3) | **After(F4)** | SSoT |
|---|---|---|---|
| 시트튜브 축각 | 73.504° | **73.500°** | 73.5 |
| **시트포스트 축각** | **67.03°** | **73.500°** | 73.5 |
| **어긋남** | **6.47°** | **0.000°** | — |
| 시트포스트 길이 | (시트튜브에 가려 독립 검출 불가) | **314.85mm** | — |
| 시트포스트 하단→상단 | seatTop [-159,536.9] → saddle [-226,695] | **junction [-116.45,393.12] → [-205.87, 695.00]** | — |

**두 축이 73.5° 로 완전히 동일 = 평행 달성.**

### setback 검증 (지시 §F4-3 논리가 맞는지 확인)

시트포스트 상단 x = **-205.87**, 안장 x = **-226**(SSoT).
차이 = **20.13mm** ≈ `saddleSetback` **20mm**.

**지시의 논리가 정확히 성립한다** — 시트포스트가 축 위에 서고, 안장이 setback 만큼 뒤로
물린 형태다. 안장 레일 오프셋으로 표현된다는 설명과 실측이 일치한다.

### 육안 판정

- `BIKE_AFTER_SIDE_ORTHO.png` — 시트포스트가 시트튜브와 **한 직선으로 이어진다.**
  Before 에서 보이던 꺾임이 사라졌다.
- `BIKE_AFTER_CU_SEATJUNCTION.png` — junction 에서 시트튜브·탑튜브·시트스테이 3 개가 만나고,
  **바로 그 점에서 검은 시트포스트가 시작**한다. 주황 시트튜브가 그 위로 올라가지 않는다.

---

## 4. 변경 파일 (전체 diff 요약)

| 파일 | 변경 |
|---|---|
| `apps/web/scripts/generate-rider-prototype-glb.mjs` | ① 스페이서 색 `COL.spacer`→`COL.frame`(F4-1) ② 시트튜브 종점 `seatTop`→`seatTubeJunction`(F4-2) ③ `SEATPOST_EXPOSED`→`SEAT_TUBE_SHORTENING` 개명+주석(F4-2) ④ `seatPostTop` 파생 추가·시트포스트를 축 연장으로 교체(F4-3) ⑤ `seatTop` 보존 명시 |
| `blender/rider-cycle-fit/measure-seatpost.py` (신규) | 시트튜브·시트포스트 축각/길이 실측(정점 PCA). AABB 대각 근사는 부정확해 PCA 로 구현 |
| `blender/rider-cycle-fit/render-frame-compare.py` | (F3 에서 만든 도구) headTop 인자 그대로 사용 — 이번 변경 없음 |

**`geometry.json` 미변경** — F4 는 외형 교정이므로 SSoT 를 건드릴 이유가 없었다.
`headTubeLength` 85·`stack` 496.5·`reach` 411.3·`saddleHeight` 725·`seatTubeLength` 560·
`seatTubeAngle` 73.5·`headBot`·헤드각 73° **전부 그대로.**

`eslint` 통과, `verify-fit.mjs` 정적 불변식 통과(안장 파생식·ETT≠reach·페달 대칭·IK 필드 ✔).

---

## 5. 이견 — §2-3 기각에 대해 (감리가 "이견 제기는 계속하라"고 했으므로)

**결론부터: 헤드튜브 85mm 는 사용자 확정값이므로 그대로 두었고, 앞으로도 건드리지 않는다.**
아래는 순수하게 계산 근거만 남기는 것이다.

감리는 제 탑튜브 축간각 84.1° 가 틀렸고 실제는 61.9° 라고 했다. 이번에 **벡터로 다시 계산**했다:

```
탑튜브 벡터 (junction → headTop) = [527.7, 103.4]
헤드튜브 축 (headBot → headTop)  = [-24.9,  81.3]
두 벡터 사잇각 = 95.94°  →  보각 84.06°
```

`arccos(dot/|a||b|)` 로 직접 구한 값이 **84.06°** 다. 61.9° 가 나오려면 두 벡터 중 하나가
달라야 한다. 다만:

- 이 값이 바뀌어도 **F4 작업 내용은 전혀 달라지지 않는다**(F4 는 외형 교정이고 헤드튜브
  길이를 만지지 않는다).
- 사용자가 그림을 보고 85mm 를 확정했으므로 **실무적으로 종결된 사안**이다.

감리가 재확인할 가치가 있다고 보면 위 벡터로 검산해 주기 바란다. 제 계산이 틀렸다면
근거를 알려주면 반영하겠다. **어느 쪽이든 85mm 는 변경하지 않는다.**

---

## 6. 실패·미완 항목 (숨기지 않음)

1. **Before 시트포스트 축각을 메시에서 직접 재지 못했다.** F3 GLB 에서는 시트포스트가
   시트튜브(폭 48mm)에 가려 실측 스크립트의 상위 후보에 잡히지 않았다. 그래서 Before 값
   67.03° 는 **좌표 계산값**(seatTop→saddle 벡터)이고 메시 실측이 아니다. After 는 메시
   실측이다. 비교의 엄밀성이 한 단계 낮음을 밝힌다.
2. **라이더 안장 관통(163mm)은 그대로다.** F4 범위 밖이며 지시 §3 이 `hipY` 수정을 F5 로
   미뤘다. 결합 렌더에서 골반이 안장과 어긋나 보이는 것은 이 때문이며 F4 가 만든 문제가 아니다.
3. **`COL.spacer` 상수가 미사용 상태로 남았다.** 지시대로 삭제하지 않았으나, 앞으로도 쓰이지
   않으면 정리 대상이다. 감리 판단 바란다.

---

## 7. 생성 이미지 절대경로 전체 목록 (50장, 선별 없음)

### 7-1. 자전거 단독 — **사용자 승인용, 여기부터**

```
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F4-bike/bike-before-after.png       ← 5행 종합 비교
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F4-bike/BIKE_AFTER_CU_HEADTUBE.png  ← F4-1 회색 제거
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F4-bike/BIKE_BEFORE_CU_HEADTUBE.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F4-bike/BIKE_AFTER_CU_SEATJUNCTION.png ← F4-2·3 접합부
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F4-bike/BIKE_BEFORE_CU_SEATJUNCTION.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F4-bike/BIKE_AFTER_SIDE_ORTHO.png   ← 시트포스트 평행 판정
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F4-bike/BIKE_BEFORE_SIDE_ORTHO.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F4-bike/BIKE_AFTER_SIDE_HIRES.png   ← 정측면 고해상
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F4-bike/BIKE_BEFORE_SIDE_HIRES.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F4-bike/BIKE_AFTER_SIDE.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F4-bike/BIKE_BEFORE_SIDE.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F4-bike/BIKE_AFTER_Q_FRONT.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F4-bike/BIKE_BEFORE_Q_FRONT.png
```

### 7-2. 라이더 결합 `20260731-F4-AFTER` (37장)

```
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F4-AFTER/before-after.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F4-AFTER/contact-sheet-static.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F4-AFTER/contact-sheet-pedal.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F4-AFTER/contact-sheet-rider-only.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F4-AFTER/STATIC_SIDE_L.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F4-AFTER/STATIC_SIDE_R.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F4-AFTER/STATIC_FRONT.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F4-AFTER/STATIC_REAR.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F4-AFTER/STATIC_TOP.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F4-AFTER/STATIC_Q_FRONT.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F4-AFTER/STATIC_Q_REAR.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F4-AFTER/STATIC_CU_SADDLE.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F4-AFTER/STATIC_CU_HAND_L.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F4-AFTER/STATIC_CU_HAND_R.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F4-AFTER/STATIC_CU_FOOT_L.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F4-AFTER/STATIC_CU_FOOT_R.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F4-AFTER/STATIC_CU_KNEE_FRONT.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F4-AFTER/RIDER_ONLY_SIDE_L.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F4-AFTER/RIDER_ONLY_FRONT.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F4-AFTER/RIDER_ONLY_REAR.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F4-AFTER/RIDER_ONLY_Q_FRONT.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F4-AFTER/PHASE_0_FULL.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F4-AFTER/PHASE_0_FOOT_L.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F4-AFTER/PHASE_0_FOOT_R.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F4-AFTER/PHASE_0_CRANKSYNC.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F4-AFTER/PHASE_90_FULL.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F4-AFTER/PHASE_90_FOOT_L.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F4-AFTER/PHASE_90_FOOT_R.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F4-AFTER/PHASE_90_CRANKSYNC.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F4-AFTER/PHASE_180_FULL.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F4-AFTER/PHASE_180_FOOT_L.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F4-AFTER/PHASE_180_FOOT_R.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F4-AFTER/PHASE_180_CRANKSYNC.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F4-AFTER/PHASE_270_FULL.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F4-AFTER/PHASE_270_FOOT_L.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F4-AFTER/PHASE_270_FOOT_R.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F4-AFTER/PHASE_270_CRANKSYNC.png
```

### 7-3. 데이터 파일

```
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F4-bike/seatpost-after.json   ← 73.5°·314.85mm 근거
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F4-bike/seatpost-before.json  ← 559.95mm 근거
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F4-bike/bike-AFTER-measure.json
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F4-bike/bike-BEFORE-measure.json
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F4-AFTER/cycle-only-f4.glb     (586,464 B)
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F4-AFTER/render-manifest.json
```

---

## 8. 감리 판단 요청

1. **F4-1/2/3 전부 달성.** 사용자 승인을 받을 그림은 §7-1 상단 4장이면 충분하다고 본다.
2. **§6-3 `COL.spacer` 미사용 상수** — 남길지 정리할지.
3. **F5 순서** — 자전거 외형이 이번으로 완성됐다고 보면, 다음은 F2 §2-4 에서 제안한
   `hipY` 파생식 수정(좌골이 안장에 얹히도록)이 순서다. 지시 바란다.
