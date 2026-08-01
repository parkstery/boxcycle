# 개발팀장 → 감리 보고서

- **지시번호**: F1 / F1-R
- **발신**: 개발팀장0731
- **수신**: 클로드감리0731
- **일시**: 2026-07-31
- **결론**: **F1-1/2/3 사양 충족. 실측 7항목 전부 감리 표와 일치. 렌더 82장 생성, verify-renders 전항목 PASS.**
  단, **범위 밖 기존 결함 1건(라이더 골반이 안장에 안 앉음)을 렌더에서 발견 — 아래 §5 참조.**

---

## 1. R-1 diff 인수 검토 결과

인수 대상 2개 파일의 diff를 F1-1/2/3 사양과 대조했다. **이견 없음. 수정 없이 인수.**

| 사양 | 구현 | 판정 |
|---|---|---|
| F1-1 하드코딩 제거 | `riderRig.geometry.mjs`가 `coordM()`으로 `HEAD_TOP`/`HEAD_BOT` export, 제너레이터가 `RIG_*` import. 리터럴 `[0.388, 0.8435, 0]` 등 3개 삭제됨 | ✔ |
| F1-2 시트튜브 접합점 분리 | `SEATPOST_EXPOSED = 150` 상수, `seatTubeJunction`을 `(560−150)=410mm`·73.5° 축 방향으로 파생. 탑튜브 시작점 `seatTop`→`seatTubeJunction` | ✔ |
| F1-2 시트튜브 실린더 유지 | `tube(bb, seatTop, R_SEAT, ...)` 그대로 — **실측으로 불변 확인**(§3) | ✔ |
| F1-3 시트스테이 이동 | 좌우 2개 모두 시작점 `seatTop`→`seatTubeJunction` | ✔ |

**검토 시 확인한 것 (남의 코드를 그대로 두지 않기 위해)**

- `SEAT_TUBE_ANGLE_DEG`/`SEAT_TUBE_LENGTH_MM`이 `geometry.json`의 `seatTubeAngle`/`seatTubeLength`에서 직접 파생됨 — 새 리터럴 하드코딩 없음. 방향은 SSoT → 메시 유지.
- `SEATPOST_EXPOSED = 150`은 감리 확정값이므로 상수로 두되 파생식(`560 − 150`)에만 쓰이도록 되어 있음. 변경·재질문 없이 그대로 사용.
- `geometry.json`은 **읽기만 했고 수정하지 않았다**(역방향 수정 금지 준수).

### 내가 추가로 변경한 파일 (인수 diff 외)

| 파일 | 변경 | 근거 |
|---|---|---|
| `apps/web/scripts/rider-cycle-fit/render-all.py` | 8번째 인자 `CYCLE_PATH` 추가 — fit_ik.py 소스의 `CYCLE = WF + r"\cycle-only.glb"`를 치환 | 결합 렌더에 **후보 cycle GLB**를 쓰려면 필요. 기존 `JOINTS_PATH` 치환과 동일 패턴. OneDrive 정본 `fit_ik.py`는 **건드리지 않음** |
| `blender/rider-cycle-fit/render-frame-compare.py` (신규) | 자전거 단독 Before/After 동일 카메라 렌더 + 접합부 확대 | R-2 (2)(4)(5) 수행. Before/After 카메라를 AABB 자동맞춤이 아닌 **고정 상수**로 둠 — 자동맞춤은 두 렌더의 카메라를 달라지게 해 비교를 무효화함 |
| `blender/rider-cycle-fit/measure-frame-tubes.py` (신규) | GLB 메시 AABB에서 튜브 접합 좌표를 BB원점 mm로 실측 | 확대 렌더의 육안 의심(§4)을 수치로 가르기 위함 |
| `blender/rider-cycle-fit/make-bike-before-after.py` (신규) | 자전거 단독 Before/After 4행 합성 | R-2 (4) |

---

## 2. R-3 실측 로그 (BB 원점, mm)

`riderRig.geometry.mjs` export를 직접 계산한 값이다.

| 항목 | 내 실측 | 감리 표 | 일치 |
|---|---|---|---|
| headTop | `[398.200, 539.500]` | [398.2, 539.5] | ✔ |
| headBot | `[436.200, 415.200]` | [436.2, 415.2] | ✔ |
| **함의 headTubeLength** | **129.979** | 129.979 | ✔ (판정기준 130.0±0.1 충족) |
| seatTop (불변) | `[-159.000, 536.900]` | [-159, 536.9] | ✔ |
| seatTubeJunction | `[-116.446, 393.116]` | [-116.446, 393.116] | ✔ |
| **시트포스트 노출 길이** | **149.949** | 149.949 | ✔ |
| **탑튜브 접합점 하강** | **536.9 → 393.116 = −143.784** | −143.8 | ✔ |

**감리 표와 7/7 일치. 불일치 없음.**

파생 참고값:
- 시트튜브 실제 길이(BB→seatTop): **559.949** (`seatTubeLength` 560과 일치)
- 탑튜브 실제 길이(junction→headTop): **535.060**

### GLB 메시 실측 (Blender AABB, BB원점 mm) — 코드값이 메시에 실제로 반영됐는지

| 튜브 | BEFORE | AFTER | 변화 |
|---|---|---|---|
| 시트튜브 `Mesh_58` | min[-182.012, -6.815] max[23.012, **543.715**] | **완전 동일** | **0 (불변 확인)** |
| 탑튜브 `Mesh_61` | min[-160.449, **514.948**] max[389.449, **594.952**] | min[-122.465, **371.955**] max[404.219, **560.661**] | 후단 −142.99 / 상단 −34.29 |
| 시트스테이 `Mesh_70/76` | max[-148.286, **542.305**] | max[-107.266, **400.844**] | −141.46, 좌우 ±28 대칭 유지 |

- 시트튜브 max y **543.715** = seatTop 536.9 + 반경캡 ≈ 6.8 → **BB→seatTop 유지 확증**(F1-2 준수, 안장 높이 725 불변).
- 탑튜브 후단 371.955 = junction 393.116 − 반경 22 → **junction 접합 확증**.
- 시트스테이 상단 400.844 = junction 393.116 + 반경 12 → **탑튜브와 동일 junction 확증**(F1-3 앞·뒷삼각 꼭짓점 일치).

---

## 3. 검증기 결과

```
node scripts/rider-cycle-fit/verify-fit.mjs                       → exit 0, 위반 0 (경고 2건은 기존 렌더 확인 항목)
node scripts/rider-cycle-fit/verify-renders.mjs 20260731-F1R-AFTER \
     --before 20260731-F1R-BEFORE --require-before                → 전 10항목 ✔ PASS
```

verify-renders 통과 항목: 필수 33장 존재 · 위상 0/90/180/270 완비 · candidateId 일치 · 종합판 3장 · 파일크기 · 해상도 · 뷰 중복 없음 · manifest 해시 일치 · 생성시각 일관 · **Before/After 조건 일치(inputHash·scale·lean·profile·해상도·세트)**.

> **첫 시행은 검증기가 3건 반려했다**(candidateId 폴더명 불일치 / contact-sheet 누락 / Before·After inputHash를 내가 임의로 다르게 줌). 수치를 조정해 통과시키지 않고 **규약에 맞춰 재렌더**했다. 반려된 첫 시행은 삭제하지 않고 `20260731-F1R-frameB/_rejected/` 에 보존했다(감리 대조용).

---

## 4. 렌더 육안 판정

### 자전거 단독 (F1 목적 달성 여부)

`bike-before-after.png` 4행(좌 BEFORE / 우 AFTER, 동일 카메라):
- **탑튜브 하강·슬로핑화** 확인 — BEFORE는 수평에 가깝고 안장 바로 아래, AFTER는 앞으로 기운 슬로핑.
- **시트포스트 노출** 확인 — BEFORE 노출 0(안장이 프레임에 붙음), AFTER 검은 시트포스트 구간이 드러남.
- **접합부 확대(4행)** — BEFORE는 탑튜브·시트스테이가 시트튜브 최상단에 직결, AFTER는 시트튜브 중간 junction에서 탑튜브·시트스테이가 만나고 그 위로 시트포스트가 이어짐. **F1-2/F1-3 의도대로.**

> **확대 렌더 최초 육안에서 "시트튜브가 junction 위로 잘린 것 아닌가", "시트스테이가 탑튜브보다 아래 붙은 것 아닌가" 두 의심이 있었다.** 둘 다 §2 메시 실측으로 **착시로 판명**했다 — 시트튜브는 543.715까지 그대로 있고(시트포스트가 겹쳐 그려져 주황 끝이 junction 근처로 보임), 시트스테이는 ±28mm 옆으로 벌어져 있어 원근상 아래로 보일 뿐 축 좌표는 탑튜브와 같은 393.1이다.

### 라이더 결합

- 프레임 삼각 구조·크랭크-발 위상·손-후드 접점은 Before/After 동일하게 유지.
- **탑튜브-허벅지 관계 개선**: BEFORE는 탑튜브가 허벅지 높이로 지나가 간섭이 심했고, AFTER는 탑튜브가 내려가 허벅지 아래를 지난다.

---

## 5. 실패·미완·발견 사항 (숨기지 않음)

### 5-1. [범위 밖·기존 결함] 라이더 골반이 안장에 앉아 있지 않음

`STATIC_Q_REAR` 등에서 **골반이 안장보다 뒤·위로 떠 있다.** 다만:

- **BEFORE 렌더에서도 완전히 동일하다** → **F1 변경이 만든 것도, 악화시킨 것도 아니다.**
- 근거(실측): Before/After의 `referencePoint HIP_MID [-211, 0, 900.5]` · `jointDistancesMm` · `rider AABB` · `measures.static`(발목/클릿/손 오차) **전부 바이트 수준으로 동일**. 라이더는 `ik-joints-v2.json`으로 배치되며 프레임 변경을 참조하지 않는다.
- AFTER에서 **더 눈에 띄게 된** 이유는 시트포스트가 노출되며 안장 주변이 드러났기 때문이다(결함 자체는 불변).
- 좌표 자체는 SSoT와 정합한다: joints `saddleContact [-226, 965.5]` = geometry `coords.saddle [-226, 695]`(+BB 270.5), 고관절은 그 위 `hipDrop 65mm` 지점.

**조치하지 않았다.** 지시 §4가 라이더 신체 치수를 "별건·보류"로 못박았고, 원인이 프레임이 아니라 라이더 배치(hipDrop/포즈) 쪽이므로 F1 범위를 넘는다. **감리 판단을 요청한다.**

### 5-2. [미완] 안장 접점 확대(`STATIC_CU_SADDLE`)로는 판정 불가

카메라가 `required-views.mjs`의 고정 앵커 `saddle [-0.226, 0, 0.9655]`를 겨냥하는데, 엉덩이 메시가 화면을 가려 안장 표면이 보이지 않는다. 접점 판정에는 쓸 수 없다. 안장 좌표는 이번 범위 밖이라 **카메라를 임의로 바꾸지 않았다**(정본 뷰 무단 변경 금지). 5-1을 다루게 되면 `run-saddle-gate.mjs` 경로로 별도 계측이 맞다고 본다.

### 5-3. 금지사항 준수 확인

- `git commit` **하지 않음** (`git status` 전부 미커밋 상태 유지)
- 제품 GLB `apps/web/public/rider/prototype/rider-lowpoly.glb` **미변경** (7/28자 파일 그대로, 작업트리에 없음). 모든 GLB 생성은 `RTW_GLB_OUT`로 후보 경로에 출력
- `saddleHeight`(725)·라이더 신체 치수·`geometry.json` **미변경**
- 새 숫자 리터럴 하드코딩 없음 / 실패 우회·수치 조정 없음

---

## 6. 생성 이미지 절대경로 전체 목록 (82장, 선별 없음)

### 6-1. 자전거 단독 + Before/After 합성 (9장) — **먼저 볼 것**

```
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-frameB/bike/bike-before-after.png   ← 종합 비교(4행)
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-frameB/bike/BIKE_AFTER_CU_SEATJUNCTION.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-frameB/bike/BIKE_AFTER_Q_FRONT.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-frameB/bike/BIKE_AFTER_SIDE.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-frameB/bike/BIKE_AFTER_SIDE_ORTHO.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-frameB/bike/BIKE_BEFORE_CU_SEATJUNCTION.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-frameB/bike/BIKE_BEFORE_Q_FRONT.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-frameB/bike/BIKE_BEFORE_SIDE.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-frameB/bike/BIKE_BEFORE_SIDE_ORTHO.png
```

### 6-2. 라이더 결합 AFTER (37장)

```
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-AFTER/before-after.png   ← 결합 Before/After(8행)
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-AFTER/contact-sheet-static.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-AFTER/contact-sheet-pedal.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-AFTER/contact-sheet-rider-only.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-AFTER/STATIC_SIDE_L.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-AFTER/STATIC_SIDE_R.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-AFTER/STATIC_FRONT.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-AFTER/STATIC_REAR.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-AFTER/STATIC_TOP.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-AFTER/STATIC_Q_FRONT.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-AFTER/STATIC_Q_REAR.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-AFTER/STATIC_CU_SADDLE.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-AFTER/STATIC_CU_HAND_L.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-AFTER/STATIC_CU_HAND_R.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-AFTER/STATIC_CU_FOOT_L.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-AFTER/STATIC_CU_FOOT_R.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-AFTER/STATIC_CU_KNEE_FRONT.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-AFTER/RIDER_ONLY_SIDE_L.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-AFTER/RIDER_ONLY_FRONT.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-AFTER/RIDER_ONLY_REAR.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-AFTER/RIDER_ONLY_Q_FRONT.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-AFTER/PHASE_0_FULL.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-AFTER/PHASE_0_FOOT_L.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-AFTER/PHASE_0_FOOT_R.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-AFTER/PHASE_0_CRANKSYNC.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-AFTER/PHASE_90_FULL.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-AFTER/PHASE_90_FOOT_L.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-AFTER/PHASE_90_FOOT_R.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-AFTER/PHASE_90_CRANKSYNC.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-AFTER/PHASE_180_FULL.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-AFTER/PHASE_180_FOOT_L.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-AFTER/PHASE_180_FOOT_R.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-AFTER/PHASE_180_CRANKSYNC.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-AFTER/PHASE_270_FULL.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-AFTER/PHASE_270_FOOT_L.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-AFTER/PHASE_270_FOOT_R.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-AFTER/PHASE_270_CRANKSYNC.png
```

### 6-3. 라이더 결합 BEFORE (36장) — 동일 카메라 대조군

```
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-BEFORE/contact-sheet-static.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-BEFORE/contact-sheet-pedal.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-BEFORE/contact-sheet-rider-only.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-BEFORE/STATIC_SIDE_L.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-BEFORE/STATIC_SIDE_R.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-BEFORE/STATIC_FRONT.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-BEFORE/STATIC_REAR.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-BEFORE/STATIC_TOP.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-BEFORE/STATIC_Q_FRONT.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-BEFORE/STATIC_Q_REAR.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-BEFORE/STATIC_CU_SADDLE.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-BEFORE/STATIC_CU_HAND_L.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-BEFORE/STATIC_CU_HAND_R.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-BEFORE/STATIC_CU_FOOT_L.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-BEFORE/STATIC_CU_FOOT_R.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-BEFORE/STATIC_CU_KNEE_FRONT.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-BEFORE/RIDER_ONLY_SIDE_L.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-BEFORE/RIDER_ONLY_FRONT.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-BEFORE/RIDER_ONLY_REAR.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-BEFORE/RIDER_ONLY_Q_FRONT.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-BEFORE/PHASE_0_FULL.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-BEFORE/PHASE_0_FOOT_L.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-BEFORE/PHASE_0_FOOT_R.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-BEFORE/PHASE_0_CRANKSYNC.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-BEFORE/PHASE_90_FULL.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-BEFORE/PHASE_90_FOOT_L.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-BEFORE/PHASE_90_FOOT_R.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-BEFORE/PHASE_90_CRANKSYNC.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-BEFORE/PHASE_180_FULL.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-BEFORE/PHASE_180_FOOT_L.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-BEFORE/PHASE_180_FOOT_R.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-BEFORE/PHASE_180_CRANKSYNC.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-BEFORE/PHASE_270_FULL.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-BEFORE/PHASE_270_FOOT_L.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-BEFORE/PHASE_270_FOOT_R.png
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-BEFORE/PHASE_270_CRANKSYNC.png
```

### 6-4. 반려된 첫 시행 (73장, 보존) — 참고용

`C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-frameB/_rejected/fit-before/` 및 `_rejected/fit-after/`
(내용은 6-2·6-3과 동일 뷰지만 verify-renders 반려본. 감리가 대조를 원할 때만 열면 된다.)

### 6-5. GLB·실측 데이터 파일

```
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-frameB/cycle-only-after.glb    (586,500 B — 신프레임)
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-frameB/cycle-only-before.glb   (586,400 B — 구프레임, MD5가 OneDrive 현행 cycle-only.glb와 동일 78e61ce7…)
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-frameB/tubes-after.json
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-frameB/tubes-before.json
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-frameB/bike/bike-AFTER-measure.json
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-frameB/bike/bike-BEFORE-measure.json
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-AFTER/render-manifest.json
C:/20.HDev/boxcycle/apps/web/scripts/rider-cycle-fit/.out/candidates/20260731-F1R-BEFORE/render-manifest.json
```

---

## 7. 감리 판단 요청 사항

1. **§5-1 라이더 골반–안장 불일치** — F1 범위 밖이며 기존부터 존재(Before 실측 동일). 별도 지시로 다룰지 판단 바람.
2. **§5-2 `STATIC_CU_SADDLE` 카메라** — 현재 정본 뷰로는 안장 접점 판정 불가. 뷰 정본(`required-views.mjs`) 수정이 필요하면 지시 바람(무단 변경하지 않았음).
