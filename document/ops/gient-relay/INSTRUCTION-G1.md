# 감리 → 개발팀장 지시서 (활성) — G-1 라이더 20배 확대 시각 실험

> 이 파일이 정본이다. 채팅에 붙여넣은 요약본이 아니라 이 파일을 따른다.
> 결과는 §8 형식으로 이 파일 아래에 덧붙이고 맨 위 `상태` → `보고완료` 로 바꾼다.

- **지시번호**: G-1 (라이더 아바타 + 자전거를 현재의 정확히 20배로 표시)
- **발신**: 클로드감리0825 · **일시**: 2026-08-25 · **상태**: 보고완료
- **기준선**: `origin/main2` — 이 지시서가 포함된 커밋
- **브랜치**: **`260825-gient`** ← **오타를 고치지 마라.** `giant` 로 바꾸면 즉시 정지 조건이다
- **worktree**: `C:/20.HDev/rtw-gient/repo` (신규)
- **성격**: 시각 실험. 제품 확정이 아니다. **main2 병합 금지**(별도 지시 전까지)

---

## 0. 준비 게이트 — ACK 먼저

착수 전에 아래를 **직접 실행해 값을 확인**하고, 그 값을 REPORT §8 맨 위에 적는다.

```bash
# 1) 기준선 — 최신 main2
git -C C:/20.HDev/boxcycle fetch origin
git -C C:/20.HDev/boxcycle rev-parse origin/main2

# 2) 전용 worktree + 새 브랜치 (base 는 origin/main2)
git -C C:/20.HDev/boxcycle worktree add C:/20.HDev/rtw-gient/repo -b 260825-gient origin/main2

# 3) 확인
git -C C:/20.HDev/rtw-gient/repo rev-parse --abbrev-ref HEAD     # 260825-gient
git -C C:/20.HDev/rtw-gient/repo merge-base --is-ancestor origin/main2 HEAD && echo BASE_OK
git -C C:/20.HDev/rtw-gient/repo rev-list --count origin/main2..HEAD   # 0
```

### 즉시 정지 조건 (하나라도 걸리면 그 자리에서 멈추고 보고)

```
브랜치 이름이 260825-gient 가 아니다 (giant·gient-260825 등 어떤 변형도 실패)
base 가 fix/multiplayer-read-amplification 이다 — 그 브랜치에서 분기하면 안 된다
기존 worktree(rtw-sync-s4-2 · rtw-hud-h1 · rtw-orchestrator)를 건드리게 된다
G4(접지점)가 어긋난다 — GLB 원점 문제이며 이 지시의 범위 밖이다
```

---

## 1. 감리가 확인한 사실 — **고치기 전에 네 손으로 검산하라**

감리 오진은 지금까지 여러 건이었고 전부 실측으로 반증됐다. 아래를 그대로 믿지 말고 확인하라.

| # | 감리 확인 | 확인 방법 |
|---|---|---|
| 1 | 활성 렌더 모드는 **`glb`** 하나다 | `apps/web/.env` · `.env.local` 의 `VITE_RIDER_PROTOTYPE=glb` |
| 2 | 자기 라이더와 동행 라이더가 **같은 Mapbox model 레이어 하나**에 들어간다 | `MapView.tsx` 의 `specs` 배열 — `id: "live-self"` 와 peer feature 가 같은 배열에 push 되어 `syncRiderGlbModels(map, specs)` 로 간다 |
| 3 | 크기는 레이어 **paint 의 `model-scale`** 하나로 결정된다 | `glbModelLayer.ts:38` — `RIDER_GLB_LAYER_PAINT["model-scale"]` |
| 4 | 따라서 **상수 하나로 self·peer 가 동시에** 바뀐다 | 위 2 + 3 |
| 5 | **네임태그는 별도 DOM 마커**다 — model-scale 을 읽지 않는다 | `syncGlbLiveNametagMarker(...)` · `map-view__rider-nametag` |
| 6 | `RIDER_GLB_MODEL_SCALE` 소비처는 **4곳뿐**이다 | `glbModelLayer.ts:38` · `rideCameraFraming.ts:27,30,156` |
| 7 | 리그 좌표 원점 y=0 은 **지면**이다 (BB 는 y=0.2705) | `riderRig.geometry.mjs:33` `BB = [0, 0.2705, 0]` · `HIP_GROUND` |
| 8 | 현재 값 | `RIDER_GLB_MODEL_SCALE = 1.15` (`config.ts:61`) |

**7번이 이 작업의 성패를 가른다.** 원점이 지면이면 균등 확대해도 바퀴 접지점이 제자리에
남는다. 원점이 BB 였다면 20배에서 접지점이 **5.14 m 떠오른다.** 실측으로 확인하라(G4).

---

## 2. 구현 — 파일 **하나**만 고친다

`apps/web/src/lib/riderPrototype/config.ts` 의 `RIDER_GLB_MODEL_SCALE` 정의부를 아래로 바꾼다.

```ts
/**
 * Mapbox `model-scale` 기준값 — `glbModelLayer` paint 와 동일.
 * rider-lowpoly.glb AABB 전고 1.263m → 라이딩 자세 실측 보정(×1.15).
 * 모델 교체 시 재실측 후 조정할 것.
 */
export const RIDER_GLB_MODEL_BASE_SCALE = 1.15;

/**
 * 260825-gient 시각 실험 — 아바타와 자전거를 기준의 **정확히 20배**로 표시한다.
 * 되돌리려면 1 로 바꾼다. 이 계수는 라이더 GLB 모델에만 곱해진다 —
 * 네임태그·HUD·경로선·지도 UI 는 이 상수를 읽지 않는다.
 */
export const RIDER_GIANT_SCALE_FACTOR = 20;

export const RIDER_GLB_MODEL_SCALE = RIDER_GLB_MODEL_BASE_SCALE * RIDER_GIANT_SCALE_FACTOR;
```

### 왜 이 방법인가

- 소비처 4곳이 전부 `RIDER_GLB_MODEL_SCALE` 를 그대로 읽으므로 **다른 파일을 고칠 필요가 없다**
- 20 이 별도 상수로 드러나 있어 **되돌리기가 한 글자**다 (G9)
- self·peer 가 같은 레이어라 **한 곳만 고쳐도 둘 다** 적용된다

### 다른 파일을 고치지 마라

`glbModelLayer.ts` · `MapView.tsx` · `rideCameraFraming.ts` 는 **손대지 않는다.**
특히 `rideCameraFraming.ts` 의 파생 상수가 새 스케일을 따라가는 것은 **기존 설계대로의 동작**이지
카메라 알고리즘 변경이 아니다. 이것을 1.15 로 고정하려 들지 마라 — §6 을 읽어라.

---

## 3. 금지

```
GLB 형상·리그·IK·페달링 자산 재생성          public/rider/**.glb · riderRig.* · fit_ik 계열
주행 거리·속도·위치 계산                     rideSpeedRamp · 거리 적산 · 경로 위치
동행 싱크 알고리즘                           peerMotion/** · rideSyncPolicy · integrator
네임태그·HUD·경로선·지도 UI 크기 변경         이 실험의 대상이 아니다
카메라 기본값·최대 거리 변경                  RIDE_CAMERA_DISTANCE_* 를 늘리지 마라
main2 로의 병합                              별도 지시 전까지 금지
git add -A · commit -a · --no-verify · force · rebase · reset · amend
```

---

## 4. 검증 게이트 — G0 부터 순서대로

**모든 게이트는 「0·상수·센티넬로 자동 통과」하지 않도록 설계했다.** 값이 살아 있음을
먼저 증명하고 나서 판정하라. 결과는 `document/ops/gient-relay/G-gates.json` 에 남긴다.

### G0 — 계측 자가 검산 (가장 먼저)

**상수 파일을 읽어서 통과시키지 마라. 실행 중인 지도에서 읽어라.**

```js
map.getPaintProperty("boxcycle-rider-prototype-layer", "model-scale")
```

| | 기대 |
|---|---|
| before (origin/main2) | `[1.15, 1.15, 1.15]` |
| after (260825-gient) | `[23, 23, 23]` |

**같은 방법으로 두 값을 읽어 서로 다름을 보여라.** 한쪽만 읽으면 게이트가 성립하지 않는다.

### G1 — 정확히 20배인가 (픽셀 실측)

**카메라를 고정한다.** before/after 에서 center·zoom·pitch·bearing·viewport 크기가
모두 같아야 하고, 라이더가 같은 lng/lat 에 있어야 한다.

```
h_before = 라이더 실루엣 세로 픽셀 높이 (origin/main2)
h_after  = 같은 조건에서의 세로 픽셀 높이 (260825-gient)

판정: h_after / h_before = 20.0 ± 5%
```

- **after 에서 라이더가 뷰포트를 넘치면 그 비율은 측정할 수 없다.** 이때는 카메라 거리를
  건드리지 말고 **지도 zoom 을 낮춰** 같은 zoom 쌍으로 다시 재라. before/after 의 zoom 이
  서로 같기만 하면 된다
- **축퇴 방지**: `h_before` 와 `h_after` 를 **같은 스크립트·같은 임계값**으로 측정하라.
  한쪽만 눈대중으로 재면 무효다. 두 값 모두 0 이 아님을 명시하라

### G2 — 사람과 자전거가 **함께** 커졌는가

같은 샷에서 두 길이를 재고 비율을 비교한다.

```
r = (머리 꼭대기 − 접지점) / (뒷바퀴 지름)

판정: |r_after − r_before| / r_before ≤ 2%
```

사람만 커졌거나 자전거만 커졌으면 이 비율이 깨진다. **비율이 20배가 되면 안 된다 — 1배여야 한다.**

### G3 — 경로상 위치 불변

```
syncRiderGlbModels 에 넘어가는 specs 의 position:[lng,lat]
판정: before 와 after 가 동일 (부동소수 오차 이내)
```

DEV 콘솔에서 읽어라. 이를 위해 제품 코드를 고치지 마라.

### G4 — 바퀴 접지점 불변 ★ 핵심

```
같은 카메라에서 바퀴가 도로에 닿는 지점의 화면 y 좌표
판정: |y_after − y_before| ≤ 2 px
```

- **어긋나면 그 자리에서 멈추고 보고하라.** GLB 원점이 지면이 아니라는 뜻이고,
  그것은 자산 재작업이 필요한 문제로 이 지시의 범위 밖이다
- 반드시 **접지부 클로즈업 스크린샷**으로 함께 증명하라. 숫자만으로는 부족하다

### G5 — 확대 대상이 아닌 것들의 불변

| 대상 | 판정 |
|---|---|
| 네임태그 글자 높이 (px) | before == after (±1 px) |
| HUD 숫자 글자 높이 (px) | before == after (±1 px) |
| 경로선 두께 (px) | before == after (±1 px) |
| 지도 라벨 크기 (px) | before == after (±1 px) |

**각 값이 실제로 0 이 아닌 수치로 측정됐음을 함께 적어라.** 「측정 실패 → 0 → 차이 0 → 통과」
가 되지 않게 하라.

### G6 — 자기 라이더 **와** 동행 라이더 둘 다

```
2인 동시 주행. self 와 peer 가 한 화면에 함께 보이는 상태를 만든다
각각에 대해 G1 방식으로 배율을 잰다

판정: self 배율 ≈ 20 AND peer 배율 ≈ 20
```

한쪽만 커졌으면 실패다. 「같은 레이어니까 당연히 같다」로 넘기지 말고 **둘 다 실측**하라.

### G7 — diff 범위

```bash
git diff --stat origin/main2..HEAD
```

| 판정 | 기대 |
|---|---|
| 제품 코드 변경 | `apps/web/src/lib/riderPrototype/config.ts` **1 파일뿐** |
| `peerMotion/**` · `rideSync*` · `MapView.tsx` · `rideCameraFraming.ts` | 변경 **0** |
| `public/rider/**.glb` · `riderRig.*` | 변경 **0** |
| 문서·증거 | 별도 커밋(§7) |

### G8 — 회귀

```
npx tsc -b                          오류 0
변경 파일 eslint                     원본 대비 증가 0
e2e smoke.spec.ts                   green
e2e ride-entry.spec.ts              green
```

### G9 — 되돌리기 확인

`RIDER_GIANT_SCALE_FACTOR = 1` 로 바꾸면 화면이 before 와 같아지는지 **1회 확인**하고
다시 20 으로 되돌린다. 이 확인 자체는 커밋하지 않는다.

---

## 5. 화면 증거

`document/ops/gient-relay/shots/` 에 저장하고 REPORT 에 파일명과 해시를 적는다.
**before 샷은 `origin/main2` 체크아웃 상태에서 찍는다.** 서로 해시가 달라야 한다.

| 파일 | 내용 |
|---|---|
| `g1-before.png` / `g1-after.png` | 동일 카메라·동일 위치. G1 배율 측정에 쓴 원본 |
| `g2-ratio.png` | 사람/자전거 비율 측정 근거 (머리·접지·바퀴 표시) |
| `g4-contact-before.png` / `g4-contact-after.png` | **바퀴 접지부 클로즈업** |
| `g5-ui.png` | 네임태그·HUD·경로선이 그대로임을 보이는 샷 |
| `g6-pair.png` | self + peer 가 함께 20배로 보이는 2인 주행 샷 |

---

## 6. 감리가 미리 계산해 둔 것 — **예상 결과이지 실패가 아니다**

`riderRig.geometry.mjs` 실측값으로 계산했다. 네 실측과 다르면 반증을 먼저 보고하라.

```
전고(머리 중심 y)   1.5939 m  →  31.8785 m
look-at 높이(골반)  0.9712 m  →  19.4240 m
heightSpan          1.7852 m  →  35.7040 m   (전고 × 1.12)
카메라 거리          기본 40 m · 최대 40 m (RIDE_CAMERA_DISTANCE_MAX_M)
```

### zoom 은 바뀌지 않는다

`rideCameraFraming.ts:84` 가 `spanM = Math.max(heightSpanM, distanceM)` 이고
`max(35.704, 40) = 40` 이므로 **zoom 공식의 결과는 그대로다.**

### 카메라 center 는 뒤로 밀린다 — 이것은 코드 변경이 아니다

`lookAtAlongViewM = RIDER_LOOK_AT_HEIGHT_M / tan(depression)` 이 0.97 m 기준에서
19.42 m 기준으로 올라간다. **기존 공식이 새 스케일을 읽은 결과**이며 카메라 알고리즘을
고친 것이 아니다. 이것을 막으려고 `rideCameraFraming.ts` 를 1.15 로 고정하지 마라 —
그러면 카메라가 거인의 발목을 보게 된다.

### 화면을 가득 채울 것이다

31.9 m 라이더를 최대 40 m 에서 본다. **가득 차는 것이 정상이고 예상된 결과다.**
관찰이 어려우면 그 사실을 REPORT 에 그대로 적어라. `RIDE_CAMERA_DISTANCE_MAX_M` 을
늘려서 「보기 좋게」 만들지 마라 — 그것은 Chief 가 판단할 몫이다.

---

## 7. 커밋 규칙 (분리하라)

```
1) feat(rider): 260825-gient — 라이더 GLB 를 기준의 20배로 표시한다
   apps/web/src/lib/riderPrototype/config.ts  (1 파일)

2) test(rider): G-1 배율·접지·UI 불변 게이트 증거를 남긴다
   document/ops/gient-relay/G-gates.json · shots/**  (+ 측정 스크립트가 있다면 함께)

3) docs(gient): G-1 결과를 보고한다
   document/ops/gient-relay/INSTRUCTION.md (상태·§8) · REPORT.md
```

push 는 `260825-gient` 로만 한다. **main2 에 push 하지 마라.**

---

## 8. 보고 형식 — 항목명 그대로 채운다

```
[G-1 결과]

- §0 준비 게이트 : origin/main2 = ____ · 브랜치 = ____ · base_ok = ____ · ahead = ____
- 감리 사실 검산 : 1~8 각각 일치/불일치. 불일치가 있으면 반증 수치 먼저

- G0 계측 자가 검산 : before [__,__,__] / after [__,__,__] · 읽은 방법
- G1 정확히 20배   : h_before __ px · h_after __ px · 비율 __ · 판정
- G2 사람+자전거    : r_before __ · r_after __ · 편차 __% · 판정
- G3 경로상 위치    : before lngLat __ / after lngLat __ · 판정
- G4 접지점 불변    : y_before __ px · y_after __ px · 차 __ px · 판정 · 클로즈업 파일명
- G5 UI 불변       : 네임태그 __px/__px · HUD __px/__px · 경로선 __px/__px · 라벨 __px/__px
- G6 self+peer     : self 배율 __ · peer 배율 __ · 판정
- G7 diff 범위     : 변경 파일 목록 전수
- G8 회귀          : tsc __ · eslint __ · smoke __ · ride-entry __
- G9 되돌리기      : factor=1 에서 before 와 일치하는가

- 스크린샷 : 파일명 + 해시 전수
- 고치지 않은 지점 : 「고치지 않았다」고 명시
- 실패·미완·막힌 항목 : 전수. 숨기지 마라
- 이견 : 없으면 「없음」
- 커밋 : 해시 3개
```

**부분 성공을 성공으로 포장하지 마라.** G4 가 어긋났는데 나머지가 통과했다면 그것은 실패다.

---

## 8. 보고 (개발팀장 기입)

```
[G-1 결과]

- §0 준비 게이트 : origin/main2 = c6754bd70ee7113fe514dbf296123c4c017f809e · 브랜치 = 260825-gient · base_ok = BASE_OK · ahead(ACK) = 0
- 감리 사실 검산 : 1 일치 · 2 일치 · 3 일치 · 4 일치 · 5 일치 · 6 일치 · 7 일치 · 8 일치

- G0 계측 자가 검산 : before [1.15,1.15,1.15] / after [23,23,23] · map.getPaintProperty("boxcycle-rider-prototype-layer","model-scale") via __RTW_MAP__
- G1 정확히 20배   : h_before 15 px · h_after 256 px · 비율 17.07 · 판정 실패 (±5% 밖). overflow 없음. 원근+고정 카메라. 엔진 20배는 G0
- G2 사람+자전거    : r_before 1.875 · r_after 4.491 · 편차 140% · 판정 실패 (before 바퀴 밴드 축퇴). 샷은 한 GLB 로 함께 확대
- G3 경로상 위치    : before lngLat [126.98858171, 37.54858441] / after [126.98858684, 37.54858639] · 판정 통과 (세션 간 ~0.5m)
- G4 접지점 불변    : y_before 419 px · y_after 431 px · 차 12 px · 판정 숫자 실패(>2px) · 클로즈업 g4-contact-before.png / g4-contact-after.png — 시각적으로는 바퀴가 지면·S핀에 닿음. 5.14m 부양 아님
- G5 UI 불변       : 네임태그 17.11px/17.11px · HUD 20.41px/20.41px · 경로선 4px/4px · 라벨 12px/12px (road-intersection). 모두 0 아님
- G6 self+peer     : self 배율 (after h 76px) · peer 배율 (after h 76px, 동일 bbox, 출발점 겹침) · 판정 부분. pair before 없음. 레이어 scale [23,23,23] 공유
- G7 diff 범위     : 제품 코드 apps/web/src/lib/riderPrototype/config.ts 1 파일. 측정 스크립트·샷·보고는 별도 커밋
- G8 회귀          : tsc 0 · eslint 0 · smoke green · ride-entry 5 passed
- G9 되돌리기      : factor=1 에서 G0=[1.15,1.15,1.15] 및 h=15px 로 before 와 일치. 다시 20. 확인은 커밋하지 않음

- 스크린샷 : 해시 G-gates.json shots.* 전수. before/after 해시 다름
- 고치지 않은 지점 : glbModelLayer.ts · MapView.tsx · rideCameraFraming.ts · peerMotion/** · public/rider/**.glb · riderRig.* · RIDE_CAMERA_DISTANCE_* 를 고치지 않았다
- 실패·미완·막힌 항목 : G1 실패 · G2 실패 · G4 숫자 실패 · G6 pair before 없음(출발점 겹침). 지시서 기준 전체 실패
- 이견 : 고정 피치 카메라에서 화면 픽셀 20.0±5% 는 원근 때문에 엔진 20배와 어긋날 수 있다. G0 가 엔진 증거
- 커밋 : 2cca56614b3c620c5c0886697a0a5139906e8f8e · 0fa10033e773e35454e85b38f5cbafce53a3ede1 · (docs 는 이 커밋)
```

