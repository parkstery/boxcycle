# 개발팀장 → 감리 보고서

- **지시번호**: F3
- **발신**: 개발팀장0731
- **수신**: 클로드감리0731
- **일시**: 2026-07-31
- **모델 사용 내역**: **설계·판단·계측 해석·보고서 전부 Opus 직접. 위임 없음**
  (사유: §1-1 해당 — SSoT 파생·프레임 지오메트리 판단이 작업의 본체. 실제 코드 변경은
  `geometry.json` 5줄 + 렌더 도구 2건이라 §1-4 눈금상 위임이 손해다.)

---

## 0. 결론 요약

| 항목 | 결과 |
|---|---|
| **§2-1 헤드튜브 130 → 85** | **완료. 실측 4항목 전부 감리 표와 일치** |
| **§2-2 삼각형 판정** | **부분 달성 — 정직히 보고한다.** 노출 헤드튜브 **90.6 → 47.5mm(-43.1)**. 크게 개선됐고 육안으로 삼각형에 가깝지만, **두 관이 맞닿지는 않았다** |
| **§2-3 안장 하강 스캔** | 표 2종 제출. **물리 한계 150mm** 확인. 사용자 판단이 **현행 IK 기준에서는 맞다**(62.5mm 하강 시 BDC 30° 달성) |
| **§2-4 렌더** | 자전거 단독 12장 + 결합 33장 + 스캔 2장 = **51장**. `verify-renders --require-before` **전항목 PASS** |
| 금지사항 | commit·제품 GLB·라이더·`saddleHeight`·`hipY`·`headBot`·헤드각 **전부 미변경** |

---

## 1. §2-1 실측값 — 감리 표와 대조

**파생식**: `headTop = headBot + L·(−cos 73°, +sin 73°)`, `headBot [436.2, 415.2]`·HTA 73° 고정.

| 항목 | 현재(F1) | **내 계산** | 감리 표 | 일치 |
|---|---|---|---|---|
| headTubeLength | 130 | **85** | 85 | ✔ |
| headTop | [398.2, 539.5] | **[411.3, 496.5]** | [411.3, 496.5] | ✔ |
| stack | 539.5 | **496.5** (−43.0) | 496.5 (−43.0) | ✔ |
| reach | 398.2 | **411.3** (+13.1) | 411.3 (+13.1) | ✔ |
| 후드 BB z | 608.1 | **565.1** (−43.0) | 565.1 | ✔ |

**4/4 + 후드까지 일치.**

### 파생식 자체 검증 (역방향 확인)

같은 식에 **L=130** 을 넣으면 → `[398.2, 539.5]` = 현재 `coords.headTop` **정확히 재현**.
식이 옳다는 증거다(우연히 맞은 값이 아니다).

### GLB 메시 실측

생성된 GLB 좌표에서 헤드튜브 길이를 역산: **85.028mm** (선언 85, 캡 반올림 오차 내).
`stack == headTop.y`, `reach == headTop.x` 항등 확인.

### 변경 내역 (`geometry.json`)

```
headTubeLength  130      → 85
stack           539.5    → 496.5
reach           398.2    → 411.3
coords.headTop  [398.2,539.5] → [411.3,496.5]
coords.stemClamp [497.7,529]  → [510.8,486]     (headTop 델타 [+13.1,−43.0] 적용)
coords.barDrop   [537.7,401]  → [550.8,358]     (동일 델타)
```

`stemClamp`·`barDrop` 은 F1 `$note_frameB` 가 명시한 **"headTop 고정 오프셋 유지"** 규칙을
그대로 따랐다(오프셋 [99.5,−10.5]·[139.5,−138.5] 불변 확인). `$note_frameC` 로 근거를 남겼고,
`$note_frameB` 는 이력임을 표시했다. **하드코딩한 숫자는 없다 — 전부 파생 결과값이다.**

`verify-fit.mjs` 통과 (안장 파생식·ETT≠reach·페달 대칭·IK 필드 4항목 ✔).

---

## 2. §2-2 삼각형 판정 — **부분 달성. 아니라고 쓴다**

지시가 "아니면 아니라고 쓰라"고 했으므로 정직하게 보고한다.

### 2-1. 측정 방법 — 첫 시도는 틀렸고, 폐기했다

처음에 메시 **AABB** 로 "헤드튜브 축 위에서 탑/다운튜브에 덮이지 않은 구간"을 재는 도구를
만들었다. 결과가 **Before/After 둘 다 0mm(=완전 삼각형)** 로 나왔다 — 렌더에 명백한 차이가
보이는데 측정이 0이면 **측정이 틀린 것**이다. 원인은 축정렬 박스가 비스듬한 탑튜브를
감싸며 헤드튜브 전 구간을 덮어버리는 것이었다.

**수치를 그대로 보고하지 않고 도구를 교체했다.** 두 번째 방법은 **렌더 픽셀 직접 측정**이다:
탑튜브=빨강·다운튜브=파랑·헤드튜브=초록으로 칠해 2400×2400 정직교로 굽고, 헤드튜브 축을
따라 좌우로 훑어 "빨강이 닿는 최저점"과 "파랑이 닿는 최고점" 사이를 잰다. 사용자가 보는
그림 자체를 재므로 "사각형으로 보이는가"에 가장 직접적이다.

### 2-2. 실측 결과

| | headTubeLength | 탑튜브 최저(축상) | 다운튜브 최고(축상) | **노출 헤드튜브** |
|---|---|---|---|---|
| Before(F1) | 129.979 | 108.53 | 17.98 | **90.55mm** |
| **After(F3)** | 85.028 | 65.61 | 18.14 | **47.47mm** |
| 개선 | −45 | | | **−43.08mm (−47.6%)** |

**판정: NEAR — 삼각형에 가까워졌으나 두 관이 맞닿지는 않았다.**

- 육안(`BIKE_AFTER_CU_HEADTUBE.png`)으로는 탑튜브·다운튜브가 헤드튜브에서 **각을 이루는
  형태**로 보인다. Before 의 "세로로 긴 헤드튜브 = 사각형 모서리"는 확실히 사라졌다.
- 그러나 색분리 스캔(`HEADTUBE_SCAN_AFTER.png`)에는 **초록(노출 헤드튜브)이 47.5mm 남아
  있다.** 0 이 아니다.
- 정직교 전체 측면(`BIKE_AFTER_SIDE_ORTHO.png`)에서는 앞삼각이 **닫힌 삼각형으로 읽힌다**
  (탑튜브가 앞으로 하강해 다운튜브와 좁은 각으로 수렴).

### 2-3. 감리 하한값 81.9mm 에 대한 이견

감리는 "81.9mm 미만이면 탑튜브(R22)·다운튜브(R28)가 겹친다"고 했으나, **내 계산으로는
그렇지 않다.**

두 관은 헤드튜브 축과 비스듬히 만나므로 축상 투영 반폭은 `R / sin(축간각)` 이다:

| L | 탑튜브 축간각 | 다운튜브 축간각 | 축상 투영(탑/다운) | 노출 |
|---|---|---|---|---|
| 130 | 88.9° | 63.4° | 22.0 / 31.3 | 76.7 |
| **85** | 84.1° | 63.4° | 22.1 / 31.3 | **31.6** |
| 81.9 | 83.8° | 63.4° | 22.1 / 31.3 | 28.5 |

**81.9mm 에서도 28.5mm 가 남아 겹치지 않는다.** 겹침이 시작되는 실제 하한은
`22.1 + 31.3 ≈ 53.4mm` 다. (기하 계산 53.4 vs 픽셀 실측 47.5 의 차이는 캡 처리·메시
해상도에서 온다.)

**즉 85mm 는 물리 하한 근처가 아니며, 삼각형을 더 밀어붙일 여지가 ~30mm 남아 있다.**
다만 **85 는 사용자 확정값이므로 변경하지 않았다**(§2-1 "변경·재질문 금지" 준수).

> **감리 판단 요청**: 완전한 삼각형(노출 0)을 원한다면 헤드튜브를 **55~60mm** 로 더 줄여야
> 한다. 이는 실제 로드바이크 최소(~90mm)를 크게 밑도는 값이라 현실성과 상충한다.
> 현재 47.5mm 로 만족할지, 더 줄일지 지시 바란다.

---

## 3. §2-3 안장 하강 스캔 (계측만 — 적용 안 함)

### 3-1. 물리 한계

| 항목 | 값 |
|---|---|
| 시트튜브 길이 | 560mm |
| `seatTubeJunction`(탑튜브 접합) | BB에서 410mm |
| 안장이 클램프보다 위인 거리 | 165mm (725 − 560) |
| **클램프가 junction 까지 내려갈 때** | **saddleHeight = 575mm** |
| **최대 하강폭** | **150mm** (= 시트포스트 노출 150 과 정확히 일치) |

안장을 150mm 넘게 내리면 클램프가 탑튜브 접합점 아래로 들어가 구조적으로 불가능하다.

### 3-2. 스캔 A — **현행 IK 식 기준** (`hipY = saddleY − 65`)

현재 코드가 실제로 하는 계산이다. **사용자 판단을 이 기준으로 평가한다.**

| X(하강) | saddleHeight | HIP z | 고관절~발목 | BDC 무릎 | 판정 |
|---|---|---|---|---|---|
| 0 | 725 | 630.1 | 724.3 | 도달불가 | ✗ |
| 25 | 700 | 606.2 | 699.8 | 도달불가 | ✗ |
| 50 | 675 | 582.2 | 675.4 | 20.7° | 무릎 덜 굽음 |
| **75** | **650** | 558.2 | 651.0 | **37.2°** | 약간 과굴곡 |
| 100 | 625 | 534.3 | 626.6 | 48.4° | 과굴곡 |
| 125 | 600 | 510.3 | 602.4 | 57.6° | 과굴곡 |
| 150 | 575 | 486.3 | 578.1 | 65.6° | 과굴곡 |

**정밀해**: BDC 25° 도달 최소 하강 **55.5mm**(saddleHeight 669.5) / BDC 30°(중앙) 도달
**62.5mm**(saddleHeight 662.5).

**→ 사용자 판단("시트 높이가 첫째 원인")은 이 기준에서 옳다.** 62.5mm 만 내리면
물리 한계 150mm 의 42% 만 써서 BDC 목표를 달성한다.

### 3-3. 스캔 B — **안장 정합 기준** (좌골이 안장에 실제로 얹힌다고 가정)

F2 에서 밝힌 대로 현행 IK 는 좌골이 안장을 163mm 관통한다. 그것까지 고쳤다고 가정하면:

| X(하강) | saddleHeight | 안장표면 z | 정합 HIP z | 고관절~발목 | BDC 무릎 | 다리 부족 |
|---|---|---|---|---|---|---|
| 0 | 725 | 683.3 | 793.3 | 886.9 | 도달불가 | +200.5 |
| 50 | 675 | 635.3 | 745.3 | 838.2 | 도달불가 | +151.8 |
| 100 | 625 | 587.4 | 697.4 | 789.6 | 도달불가 | +103.2 |
| **150** | **575** | 539.5 | 649.5 | 741.2 | **도달불가** | **+54.8** |

**→ 물리 한계 150mm 를 다 써도 54.8mm 부족.** 이 경로에서는 안장만으로 해결되지 않는다.

### 3-4. 두 표가 갈리는 이유 (판단 근거)

같은 자전거인데 결론이 다른 것은 **`hipY` 식 때문**이다.

- 스캔 A 는 HIP 을 안장보다 **65mm 아래**에 둔다 → 다리가 페달에 가깝다 → 안장을 조금만
  내려도 닿는다.
- 스캔 B 는 좌골을 안장 **위**에 올린다(=올바른 인체) → HIP 이 163mm 올라간다 → 다리가
  훨씬 멀어진다.

**즉 스캔 A 가 "닿는" 것은 라이더가 안장을 뚫고 앉아 있기 때문**이다. F2 §2-4 에서 제안한
`hipY` 수정(F4 예정)을 하면 스캔 B 가 현실이 되고, 그때는 다리 길이를 반드시 다뤄야 한다.

**F3 에서는 `saddleHeight` 를 변경하지 않았다**(지시 §2-3·§3 준수).

---

## 4. 변경 파일

| 파일 | 변경 | 성격 |
|---|---|---|
| `apps/web/src/lib/riderPrototype/geometry.json` | headTubeLength 85 + stack·reach·headTop·stemClamp·barDrop 파생 재계산 + `$note_frameC` | **SSoT (지시 §2-1)** |
| `blender/rider-cycle-fit/render-frame-compare.py` | headTop 인자화(Before/After 각자 SSoT) + 헤드튜브 확대 + 정측면 고해상 샷 | 렌더 도구 |
| `blender/rider-cycle-fit/measure-headtube-pixels.py` (신규) | 픽셀 기반 노출 실측 | **판정 도구** |
| `blender/rider-cycle-fit/measure-headtube-exposure.py` (신규) | AABB 방식 — **폐기(틀림)**. 근거 보존용으로 남김 | 폐기 |
| `blender/rider-cycle-fit/make-bike-before-after.py` | 헤드튜브 확대 행 추가(4행→5행) | 렌더 도구 |

**미변경 확인**: `git status` 로 제품 GLB 0건, commit 없음, 라이더 치수·`saddleHeight`·
`headBot`·`headTubeAngle` 전부 그대로.

> **한 가지 밝혀 둔다**: `git diff` 에 `export-ik-joints-v2.mjs` 가 잡히지만 **F3 에서 내가
> 건드린 것이 아니다.** F1 착수 시점 `git status` 에 이미 `M` 으로 있던 기존 미커밋 변경
> (발목 오프셋 ANKLE_BACK/ANKLE_UP 도입)이며, F1·F2·F3 어느 단계에서도 수정하지 않았다.
> F2 §2-4 에서 제안한 `hipY` 식은 이 파일 41행이지만 **그대로 두었다**(지시 §3 준수).

---

## 5. 실패·미완 항목 (숨기지 않음)

1. **§2-2 삼각형 미완성** — 노출 47.5mm 남음. §2-3 에 감리 판단 요청.
2. **AABB 측정기가 틀렸다** — 첫 도구가 Before/After 둘 다 0mm 를 냈다. 그 값을 보고했다면
   "완전한 삼각형 달성"이라는 **거짓 보고**가 될 뻔했다. 렌더와 대조해 잡았고 도구를 교체했다.
3. **감리 하한 81.9mm 와 내 계산 53.4mm 불일치** — §2-3 에 근거를 제시했다. 내 계산이
   틀렸을 수 있으니 감리가 검증해 주기 바란다.
4. **라이더 안장 관통은 그대로** — F2 에서 밝힌 163mm 관통은 F3 범위 밖이라 손대지 않았다
   (지시 §3: `hipY` 수정 F4 예정). 결합 렌더에서 골반이 여전히 어긋나 보이는 것은 이 때문이다.

---

## 6. 생성 이미지 절대경로 전체 목록 (51장, 선별 없음)

### 6-1. 자전거 단독 — **사용자 승인용, 여기부터**

```
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F3-bike/bike-before-after.png      ← 5행 종합 비교
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F3-bike/BIKE_AFTER_SIDE_HIRES.png  ← 정측면 고해상(삼각형 판정)
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F3-bike/BIKE_BEFORE_SIDE_HIRES.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F3-bike/BIKE_AFTER_CU_HEADTUBE.png ← 헤드튜브 접합부
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F3-bike/BIKE_BEFORE_CU_HEADTUBE.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F3-bike/HEADTUBE_SCAN_AFTER.png    ← 색분리 실측 근거
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F3-bike/HEADTUBE_SCAN_BEFORE.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F3-bike/BIKE_AFTER_SIDE_ORTHO.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F3-bike/BIKE_BEFORE_SIDE_ORTHO.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F3-bike/BIKE_AFTER_SIDE.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F3-bike/BIKE_BEFORE_SIDE.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F3-bike/BIKE_AFTER_Q_FRONT.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F3-bike/BIKE_BEFORE_Q_FRONT.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F3-bike/BIKE_AFTER_CU_SEATJUNCTION.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F3-bike/BIKE_BEFORE_CU_SEATJUNCTION.png
```

### 6-2. 라이더 결합 `20260731-F3-AFTER` (37장)

```
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F3-AFTER/before-after.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F3-AFTER/contact-sheet-static.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F3-AFTER/contact-sheet-pedal.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F3-AFTER/contact-sheet-rider-only.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F3-AFTER/STATIC_SIDE_L.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F3-AFTER/STATIC_SIDE_R.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F3-AFTER/STATIC_FRONT.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F3-AFTER/STATIC_REAR.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F3-AFTER/STATIC_TOP.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F3-AFTER/STATIC_Q_FRONT.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F3-AFTER/STATIC_Q_REAR.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F3-AFTER/STATIC_CU_SADDLE.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F3-AFTER/STATIC_CU_HAND_L.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F3-AFTER/STATIC_CU_HAND_R.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F3-AFTER/STATIC_CU_FOOT_L.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F3-AFTER/STATIC_CU_FOOT_R.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F3-AFTER/STATIC_CU_KNEE_FRONT.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F3-AFTER/RIDER_ONLY_SIDE_L.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F3-AFTER/RIDER_ONLY_FRONT.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F3-AFTER/RIDER_ONLY_REAR.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F3-AFTER/RIDER_ONLY_Q_FRONT.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F3-AFTER/PHASE_0_FULL.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F3-AFTER/PHASE_0_FOOT_L.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F3-AFTER/PHASE_0_FOOT_R.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F3-AFTER/PHASE_0_CRANKSYNC.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F3-AFTER/PHASE_90_FULL.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F3-AFTER/PHASE_90_FOOT_L.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F3-AFTER/PHASE_90_FOOT_R.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F3-AFTER/PHASE_90_CRANKSYNC.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F3-AFTER/PHASE_180_FULL.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F3-AFTER/PHASE_180_FOOT_L.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F3-AFTER/PHASE_180_FOOT_R.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F3-AFTER/PHASE_180_CRANKSYNC.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F3-AFTER/PHASE_270_FULL.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F3-AFTER/PHASE_270_FOOT_L.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F3-AFTER/PHASE_270_FOOT_R.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F3-AFTER/PHASE_270_CRANKSYNC.png
```

### 6-3. 데이터 파일

```
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F3-bike/headtube-pixels-AFTER.json   ← 노출 47.47mm 근거
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F3-bike/headtube-pixels-BEFORE.json  ← 노출 90.55mm 근거
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F3-bike/bike-AFTER-measure.json
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F3-bike/bike-BEFORE-measure.json
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F3-AFTER/cycle-only-f3.glb           (586,472 B)
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F3-AFTER/render-manifest.json
```

---

## 7. 감리 판단 요청

1. **§2-2 삼각형 완성도** — 노출 47.5mm 로 만족할지, 더 줄일지. 완전 삼각형(0mm)에는
   헤드튜브 55~60mm 가 필요하며 실제 로드바이크 최소(~90mm)를 크게 밑돈다.
2. **§2-3 감리 하한 81.9mm 검증** — 내 계산은 53.4mm 다. 어느 쪽이 맞는지 판단 바란다.
3. **§3-4 두 스캔의 분기** — 사용자 판단("시트가 첫째 원인")은 **현행 IK 기준에서는 맞다**
   (62.5mm 하강 시 BDC 30°). 다만 그것은 좌골이 안장을 관통한 상태를 전제한다.
   `hipY` 를 먼저 고칠지(F4), 안장 하강을 먼저 적용할지 순서 지시 바란다.
