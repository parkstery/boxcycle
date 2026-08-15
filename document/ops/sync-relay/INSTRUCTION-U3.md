# 감리 → 개발팀장 지시서 (활성) — 화면 틱 (진짜 원인) + red dot 회귀

> U-2R 은 미실행 상태로 `INSTRUCTION-U2R-미실행.md` 에 보존했다. **§2 로 그대로 흡수했으니
> 그 파일을 따로 수행하지 마라.** U-1R 은 계속 보류(`INSTRUCTION-U1R-보류.md`).
> 결과는 §6 형식으로 이 파일 아래에 덧붙이고 `상태` → `보고완료`.

- **지시번호**: U-3 (카메라 출력을 재서 톡의 정체를 잡는다 + U-2R 회귀 수정)
- **발신**: 클로드감리0814 · **일시**: 2026-08-14 · **상태**: 보고완료
- **브랜치**: `fix/map-render-tick` 계속 (기준 HEAD `33b369c`)

---

## 0. 감리 정정 — 경로 A 는 원인이 아니었다

U-2 가 경로 A 를 **실측으로 완전히 제거**했다(emit 190→0 · moveToTop 886→0 · fracA→0).
그런데 **사용자 화면에서 톡톡거림이 그대로다.**

```
따라서  경로 A 는 이 증상의 원인이 아니다 — 감리 판단이 틀렸다
        (부하 자체는 실재했고 없앤 것은 옳다. 되돌리지 마라)
```

### 0-1. 이번에 코드로 **배제한** 것

```
위치 표본이 계단식이다        → 아니다
   useVirtualRideSession:110  virtualDistanceRef += speed × dt  를 rAF 마다 연속 적산
   sampleLiveLngLat 이 그 ref 를 직접 읽는다. 200ms React 스로틀은 우회돼 있다

방향(bearing)이 계단식이다     → 아니다
   getAverageHeadingAheadFromPoint 가 60m 앞을 60 샘플로 평균한다
   정점 하나가 창을 드나들어도 합의 1/60 만 바뀐다. 불연속이 생기지 않는다
```

### 0-2. 남은 유력 원인 — **rAF 두 개의 위상 어긋남**

```
앱 rAF       MapView 루프 → map.stop() + map.jumpTo()   매 프레임
Mapbox rAF   자체 렌더 루프 — 별개 콜백

두 콜백의 실행 순서는 보장되지 않는다.
  어떤 프레임은 Mapbox 가 우리 jumpTo **뒤에** 그리고
  어떤 프레임은 **앞에** 그린다
  → 화면에 나오는 카메라가 「최신 / 한 프레임 늦음」을 번갈아
  → 2 프레임 주기의 박자 = 톡톡톡톡
```

**1 m 확대에서만 크게 보이는 이유가 여기서 설명된다.**

```
5 km/h → 프레임당 0.023 m 전진
1 m 구도 해상도 ≈ 0.0025 m/px
→ 한 프레임 어긋남 = 약 9 px 점프
4 m·40 m 에서는 같은 어긋남이 1~2 px 라 안 보였다
```

매 프레임 `map.stop()` 도 의심 대상이다 — 진행 중 전환을 취소하며 렌더 스케줄을 흔든다.

### 0-3. 곁다리 관측 (톡의 원인 아님)

프레이밍이 요구하는 zoom 이 약 **25** 인데 `maxZoom` 이 **24**(MapView.tsx:1493)라 계속
클램프 상태다. 1 m 구도가 산식대로 나오지 않는다는 뜻이다. **이번에 고치지 말고 보고만 하라.**

---

## 1. 프레임 시간을 재지 마라 — **카메라가 쓴 값**을 재라

헤드리스가 12~15fps 라 프레임 시간으로는 아무것도 분해할 수 없다는 걸 U-2 에서 확인했다.
**톡이 있다면 카메라 파라미터 중 무언가가 반드시 진동한다.** 그것만 찍으면 된다.

### 1-1. 매 프레임 기록 (DEV 게이트)

`map.jumpTo` 직전에 그 프레임이 실제로 쓴 값을 남겨라.

```
t(performance.now) · center(lng,lat) · bearing · pitch · zoom
파생값  centerStepM   직전 프레임 center 와의 거리(m)
        bearingStepDeg · zoomStep
        riderStepM    sampleLiveLngLat 결과의 직전 대비 거리(m)
        centerStepPx  centerStepM / 그 프레임의 m-per-px  ← 화면에서 몇 px 움직였나
```

30 초 주행, **연속 프레임 전부**. 요약값만 내지 마라 — 진동은 시계열에서만 보인다.
→ `document/ops/sync-relay/U3-camera-trace.json`

### 1-2. 무엇을 보는가 — 판정 기준

```
① 위상 어긋남의 지문
   centerStepPx 가 「크게-작게-크게-작게」로 번갈아 뛰는가 (2 프레임 주기)
   riderStepM 은 매끄러운데 centerStepPx 만 튀면 → 카메라/렌더 위상 문제로 확정
② 계단
   riderStepM 자체가 0 → 큰 값 → 0 으로 뛰면 위치 표본 문제 (0-1 에서 배제했지만 확인)
③ 회전
   bearingStepDeg 가 프레임마다 부호를 바꾸며 흔들리는가
④ 줌
   zoom 이 24 에 붙어 있는가(클램프) · zoomStep 이 진동하는가
```

**①~④ 중 어느 것도 진동하지 않으면 원인이 카메라 밖에 있다. 그때는 고치지 말고 보고하라.**

---

## 2. 수정

### 2-1. 위상을 하나로 묶어라 (①이 지목될 때)

```
방향   카메라 갱신을 **Mapbox 의 render 이벤트**에 태워라
       앱 rAF 에서 jumpTo 하지 말고, Mapbox 가 프레임을 그리는 시점에 맞춰 갱신한다
       (map.on("render", …) 또는 그에 준하는 지점)
       라이더 위치 적산(useVirtualRideSession)은 건드리지 마라 — 그건 지금도 연속이다
그리고 매 프레임 map.stop() 을 없애라
       팔로우 중에는 취소할 전환 자체가 없다. 필요할 때만 불러라
```

⚠ **`jumpTo` 를 `easeTo` 로 바꾸지 마라.** 매 프레임 easing 은 더 나빠진다.
⚠ **카메라 스무딩 상수(tau·max dps)를 만져서 흐리지 마라.** 위상 문제는 스무딩으로 안 없어진다.

### 2-2. **U-2R 의 red dot 회귀** — 이번에 함께 고쳐라

`moveActivityWorldLayersToTop` 이 활동 레이어 8종의 **존재 시그니처**가 바뀔 때만
`moveLayer` 한다(`MapView.tsx:217-219`). 그런데 이 함수의 존재 이유는 주석 그대로
「route effect 가 dot 뒤에 addLayer 되는 회귀 방지」다.

```
코스를 불러오면
   MapView.tsx:1817  route 레이어를 위에 addLayer
   MapView.tsx:1830  곧바로 moveActivityWorldLayersToTop() 호출   ← 복구 의도
   route 추가는 활동 레이어의 존재 여부를 바꾸지 않는다 → 시그니처 동일 → early return
시그니처 초기화는 style.load(:1599) 한 곳뿐인데 코스 로드는 style.load 를 동반하지 않는다
→ 주행 중 코스 로드·전환 시 red dot·heat 가 route 선 아래로 깔린다
```

```
고쳐라  「위에 무엇이 얹혔는지」가 바뀌면 다시 올리도록 조건을 다시 정의하라
        예: 스타일 레이어 순서에서 활동 레이어들의 인덱스가 내려갔는지
        매 프레임 moveLayer 로 되돌리지는 마라 — U-2 가 없앤 부하다
그리고  lastActivityWorldLayerSig 가 모듈 전역이다. 맵 인스턴스에 매어라
```

---

## 3. 검증

| | 항목 | 기준 |
|---|---|---|
| P0 | 추적 유효성 | 프레임 표본 ≥ 500 · 센티넬 0 건 · 시각 단조 증가 |
| P1 | 원인 지목 | §1-2 ①~④ 중 무엇이 진동하는지 **시계열 발췌**로 제시 |
| P2 | 수정 후 | `centerStepPx` 의 2 프레임 진동이 사라짐 — 수정 전/후 같은 구간 비교 |
| R1 | red dot | 주행 중 코스 로드 후 활동 레이어가 route **위** — `map.getStyle().layers` 인덱스로 판정 |
| R2 | style.reload 복구 | 실제로 시험 (U-2 T3 가 빠뜨렸다) |
| R3 | U-2 이득 유지 | 경로 A emit 0 · moveToTop 호출 폭증 없음 |
| R4 | 추적 무회귀 | 팔로우가 라이더를 놓치지 않음 |

**P0 이 깨지면 나머지는 판정에 쓰지 마라.**

### 3-1. 사람 눈이 최종 판정자다

지금 톡이 사라졌는지 판정할 수 있는 건 사용자뿐이다.

```
실제 브라우저 창으로 주행 화면(거리 1 m·팔로우)에 바로 들어가는 방법을 **명령 한 줄**로 보고하라
가능하면 수정 전/후 화면 녹화를 U3-shots/ 에 남겨라
```

---

## 4. 커밋 · 금지

```
제품 / 시험·증거 2 개로 나눠라. 경로 지정. git add -A · --no-verify 금지
이 브랜치 push 가능. main2 병합 · PR 생성 · stash 조작 금지
```

- **U-2 의 경로 A 수정을 되돌리기** · U-1 카메라 변경 반입 · 네임태그 재작업 · U-1R 착수
- **`jumpTo` → `easeTo` 전환** · **카메라 스무딩 상수(tau·max dps) 조정으로 증상 흐리기**
- **`LOD_VIEWPORT_THROTTLE_MS` 등 주기 상향** · 활동 레이어 기능 제거 · 매 프레임 moveLayer 복귀
- **`RIDE_CAMERA_DISTANCE_MIN_M` 변경** · `maxZoom` 변경(0-3 은 이번 범위 아님)
- Sync 2 단계(S4-2) · S4-3 · 발행 경로 · 보간·외삽 · GLB·피팅 변경
- 센티넬·축퇴값을 정상 관측치처럼 기록 · 진단 계측 삭제 · 기존 산출물 덮어쓰기
- `git add -A` · `--no-verify` · stash 조작 · `main2` 병합 · PR · Orchestrator 문서 접촉

⚠ 워킹트리의 `INSTRUCTION-U1R-보류.md` · `INSTRUCTION-U2R-미실행.md` 는 **감리가 만든 파일**이다.
지우지 말고 문서 커밋에 함께 담아라.

---

## 5. 막히면

§1-2 의 어느 항목도 진동하지 않거나, 위상을 묶었는데 P2 가 안 나오면
**상수를 만지지 말고 멈추고 시계열을 그대로 보고하라.** 원인을 다시 좁히는 건 감리가 한다.

---

## 6. 보고

```
문서에 적는다
  - 첫머리 3~4 줄: 화면에서 무엇이 달라졌는지 평문으로
  - P0 자가 검산 (표본 수 · 센티넬 0)
  - **§1-2 판정 — 무엇이 진동했는지 시계열 발췌로** (이게 원인 증명이다)
  - 무엇을 어떻게 고쳤는지 · 왜 그게 위상 어긋남을 없애는지
  - P2 수정 전/후 centerStepPx 비교
  - R1 (레이어 인덱스 실측) · R2 · R3 · R4
  - **실제 브라우저로 주행 화면 띄우는 명령 한 줄**
  - §0-3 zoom 클램프 관측 (고치지 않았음을 명시)
  - 이견·실패 전수 — 없으면 「없음」

최종 응답에만 적는다
  - 커밋 해시 · 브랜치명 · 최종 git status --short · git stash list (2 건)
```

---

## 6. 보고 (U-3)

화면에서 달라진 것: **red dot·heat 가 코스 선(route) 위로 다시 올라온다.** 코스를 불러도 활동 레이어를 「위에 무엇이 얹혔는지」로 재배치한다. **점프투 입력값의 2프레임 톡 지문은 이 표본에서 나오지 않아, 앱 rAF `jumpTo` / `map.stop()` 루프는 바꾸지 않았다.** 헤드리스 주행 화면의 톡이 육안으로 줄었는지는 사용자가 1 m 팔로우로 판정한다. 수정 전/후 카메라 루프 녹화는 루프를 안 바꿨으므로 `U3-shots/baseline.png` 만 있다.

### P0

- 파일: `document/ops/sync-relay/U3-camera-trace.json` (`phase: baseline`)
- 표본 **519** · 센티넬 **0** · `t` 단조 · 기록 구간 **43.3 s** (30 s 후 500프레임까지 연장)
- 헤드리스 실측 ≈ 12 fps 라 30 s 만으로는 500에 못 미침 — 프레임 시간으로 톡을 분해하지 않았고, 같은 시계열을 더 받아 P0만 채웠다

### P1 — §1-2 판정 (발췌는 JSON `verdict.excerpt`, 구간 t≈25878–26920)

```
centerStepPx   99.0, 97.8, 95.3, 102.5, 116.1, 112.2, 109.3, 96.4, 102.4, 99.6, …
riderStepM     0.328, 0.397, 0.378, 0.469, 0.567, 0.439, 0.433, 0.317, 0.462, 0.394, …
bearingStepDeg 모두 +1e-4 근처, 부호 반전 없음 (signFlipBrgFrac = 0)
zoom           전 구간 24.83724–24.83727 에 붙음 (zoomAt24Frac = 1), zoomStep ≈ −5e-8
```

| §1-2 | 결과 |
|---|---|
| ① 위상 | **미확정.** even/odd `centerStepPx` 비 **1.006**, `pxNearZero(<5px)=0`. rider 도 dt 불규칙으로 altFrac 가 더 높다(0.68 vs 0.55). 「크게-작게 2프레임 + rider 매끄러움」 지문 아님 |
| ② 계단 | **아님.** riderStepM 이 0↔큰값 이 아니라 프레임 dt에 비례하는 0.3–0.6 m |
| ③ 회전 | **아님.** bearing 부호 진동 0 |
| ④ 줌 | 클램프에 붙음. zoomStep 진동으로 볼 만한 진폭 없음 |

이 계측은 **`jumpTo`에 넣은 값**이다. Mapbox 가 그 값을 그리기 전/후에 페인트하는 위상은 JSON에 남지 않는다. 입력값이 안 흔들리면 §5 대로 **카메라 루프는 고치지 않는다.**

### 수정

- **안 함:** Mapbox `render`/`_render` 에 `jumpTo` 이전, 매 프레임 `map.stop()` 제거, easeTo, tau·max dps. 이유: ① 미확정 (§5).
- **함 (U-2R):** `activityWorldLayerSignature` = 존재 비트 + 최상위 활동 레이어 **위 id 목록**. `lastActivityWorldLayerSigByMap` WeakMap. `style.load` 에서 해당 맵 엔트리 delete. `moveLayer` 는 시그니처가 바뀔 때만.

### P2

해당 없음 — 카메라 출력을 바꾸지 않아 전/후 `centerStepPx` 비교 대상이 없다.

### R1 · R2 · R3 · R4

- **R1** 코스 로드 후 주행 중: route **130**, heat **133**, pulse **134** → pulse가 route 위
- **R2** `map.setStyle(map.getStyle())` 후 대기: route **130**, heat **133**, pulse **134** (동일, pulseAboveRoute true)
- **R3** 경로 A emit **0**, 추적 구간 `moveToTopMs.length` **0** (시그니처 안정). followJumpTo 635
- **R4** 팔로우 유지: `centerStepPx` 중앙값 ≈ 110 (라이더 이동을 매 프레임 따라감, 0 붕괴 없음)

### 실제 브라우저 한 줄

`npm run dev:localhost -w boxcycle-web` 후 `http://127.0.0.1:5000/?rideCam=1` 을 연다. 시작 → 입문 마지막 코스 → 주행 시작. 거리 1 m·좌측 팔로우가 기본으로 걸린다.

### §0-3 zoom 클램프 (고치지 않음)

프레이밍이 넣는 zoom은 계속 **24.837…** 에 붙어 있다 (`maxZoom: 24` 는 그대로). 1 m 구도가 산식 zoom 25에 못 미친다는 관측만. 이번 범위에서 `maxZoom` 을 올리지 않았다.

### 이견·실패

- P0을 채우려고 기록만 43 s로 늘렸다. 30 s 연속은 포함되어 있다.
- 육안 톡의 최종 판정은 사용자. 헤드리스는 12 fps라 화면 60 fps 위상 문제를 이 JSON이 반증한다고 단정하지 않는다 — 다만 **지시된 판정 기준(jumpTo 입력 진동)으로는 ①이 안 나온다.**
- `INSTRUCTION-U2R-미실행.md` 는 수행하지 않고 문서 커밋에만 담았다.
- 없음 외: 카메라 위상 수정·after JSON·after 샷 없음 (고치지 않음).

