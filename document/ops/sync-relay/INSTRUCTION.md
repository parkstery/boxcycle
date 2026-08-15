# 감리 → 개발팀장 지시서 (활성) — **C안 채택: 진동 종결**

> U-9 는 `INSTRUCTION-U9.md` 로 보존. U-6·U-1R 은 계속 보류.
> 결과는 §6 형식으로 이 파일 아래에 덧붙이고 `상태` → `보고완료`.

- **지시번호**: U-10 (위치 지연 제거 + 중심 방향을 스무딩 방향에 맞춘다)
- **발신**: 클로드감리0815 · **일시**: 2026-08-15 · **상태**: 보고완료
- **브랜치**: `fix/map-render-tick` 계속 (기준 HEAD `00960cd`)

---

## 0. 원인 확정 — 사용자 실측으로 두 번 갈라 확인했다

```
poslag(true)  = 현행     직선·코너 **모두** 톡      ← 위치 지연이 dt 에 따라 변동
poslag(false) = 지연 0   직선 톡 없음 · **코너만 톡** ← 남은 원인이 하나 더 있다
```

**두 번째 원인이 코드 순서에 있다.** `rideCameraFollow.ts:229-247`

```
① baseHeading                                   원본 방향
② nextCamera = getCameraForFollowMode(...)      offsetBearing = 원본 방향 + 180
③ framing = computeRideFollowFraming({
       offsetBearing: nextCamera.offsetBearing   ← **원본** 을 써서 중심을 잡는다
   })
④ 그 뒤에 nextBearingPrimary → nextBearing 스무딩 → **지도에는 이 값이 적용**된다
```

```
직선   원본 방향 == 스무딩 방향 → 어긋날 것이 없다 → 톡 없음  ✔ 사용자 관측과 일치
코너   원본 방향이 즉시 꺾여 중심이 옆으로 훅 이동하는데
       화면 회전은 천천히 따라간다 → 그 차이만큼 라이더가 화면에서 튄다
```

**C안 = ③과 ④의 순서를 뒤집어, 중심도 스무딩된 방향으로 잡는다.**

---

## 1. 할 일

### 1-0. 보존

`INSTRUCTION-U9.md` 는 감리가 이미 복사해 뒀다. 문서 커밋에 담아라.

### 1-1. 계산 순서를 바꿔라

```
바꾼 뒤 순서
   ① baseHeading · nextCamera (지금과 같다)
   ② 스무딩 상태 초기화(resetCameraSmoothing) · dt · alpha 계산
   ③ **bearing 스무딩을 먼저** — nextBearingPrimary → nextBearing
   ④ 중심 방향을 스무딩 값에서 뽑는다
        offsetBearingSmoothed = normalizeCompass(nextBearing + 180)
        ← 지금 getCameraForFollowMode 가 모든 모드에서 offsetBearing = bearing + 180 을
          쓰고 있으므로 이 치환이 성립한다. **직접 확인하고 진행하라**
   ⑤ computeRideFollowFraming 에 ④ 값을 넘겨 center·zoom 을 얻는다
   ⑥ center lerp (지연은 §1-2 대로 0)
```

⚠ **주의점**

```
nextCamera.offsetBearing 이 null 인 경우(free 등 distanceM 0)는 지금 동작 그대로 두어라
curCenter 의 `?? cameraCenterTarget` 폴백이 순서 변경으로 깨지지 않게 하라
첫 프레임(smooth.bearing == null)에서 resetCameraSmoothing 이 먼저 돌아야 한다
```

**스무딩 상수는 하나도 바꾸지 마라.** `CAMERA_BEARING_TAU_*` · `CAMERA_BEARING_MAX_DPS_*` ·
`CAMERA_POSITION_TAU_SEC` 전부 그대로다. 이번 변경은 **어떤 값을 쓰느냐**이지 세기 조정이 아니다.

### 1-2. 위치 지연 0 을 기본으로

사용자가 A(지연 0)를 포함한 C 를 승인했다.

```
기본 동작   중심 lerp 계수 = 1 (지연 없음)
```

### 1-3. 스위치 정리 — **기본 상태에서 배지가 뜨면 안 된다**

지금 `poslag` 는 「true = 지연 추종(현행)」이다. 기본을 지연 0 으로 바꾸면서 이 스위치를
그대로 두면 **기본 상태에서 배지에 계속 `tick off: poslag` 가 뜬다. 그건 안 된다.**

```
요구   기본 상태(제품 동작)에서 배지에 아무것도 안 뜬다
       옛 동작(지연 추종 + 원본 방향 중심)으로 되돌리는 비교용 스위치는 **남긴다**
       이름·형태는 네가 정해라. 위 두 조건만 만족하면 된다
```

비교 스위치를 남기는 이유는, 이번 변경이 코너 감각을 해치지 않았는지 사용자가
바로 옛 동작과 견줘 볼 수 있어야 하기 때문이다.

---

## 2. 검증

### 2-1. 사용자 판정 절차 (보고서에 그대로)

```
0  주행 시작 — 5 km/h · 좌측 · 5.5 m
1  **직선 구간** — 톡이 없는가
2  **코너 구간** — 톡이 없는가            ← 이번 변경의 핵심
3  코너에서 지도가 옆으로 훅 밀리거나 어색하지 않은가 (감각 확인)
4  비교 스위치로 옛 동작 → 코너 톡이 돌아오는가 → 다시 기본으로
```

### 2-2. 개발팀장 확인

| | 항목 | 기준 |
|---|---|---|
| 가 | 순서 변경 | 중심 방향이 `nextBearing` 에서 파생 · 지도 적용 bearing 과 **같은 값** |
| 나 | 상수 불변 | bearing·position tau · max dps 전부 그대로 |
| 다 | 배지 | 기본 상태에서 배지 없음 · 비교 스위치는 동작 |
| 라 | 무회귀 | free 모드·distanceM 0 경로 정상 · 첫 프레임 초기화 정상 |
| 마 | 실브라우저 | 맵이 뜨고 콘솔 오류 0 · 스크린샷 해시 서로 다름 |

**직선/코너 스크린샷을 각각 남겨라** → `U10-shots/`.

⚠ 톡의 유무는 정지 화면으로 증명되지 않는다. **판정은 사용자 육안이다.**
개발팀장은 「맵이 뜨고 주행이 되고 오류가 없다」까지만 확인하고, 톡 유무를 단정하지 마라.

---

## 3. 금지

- **스무딩 상수 조정** (tau · max dps) — 이번은 값이 아니라 **어느 값을 쓰느냐**의 문제다
- 승인된 구도 변경(`rideCameraFraming.ts` 산식 · `maxZoom` · 거리 상수)
- **기본 상태에서 배지가 뜨게 두기** · 비교 스위치를 아예 없애기
- U-6 · U-1R 착수 · 네임태그 재작업 · U-2/U-3/U-8/U-9 수정 되돌리기
- Sync 2 단계(S4-2) · S4-3 · 발행 경로 · 보간·외삽 · GLB·리깅·피팅 변경
- 스크린샷 중복 저장 · 센티넬·축퇴값 기록 · 진단 계측 삭제
- `git add -A` · `--no-verify` · stash 조작 · `main2` 병합 · PR · Orchestrator 문서 접촉

---

## 4. 막히면

`offsetBearing = bearing + 180` 관계가 어느 모드에서 성립하지 않거나, 순서를 바꿨더니
첫 프레임·free 모드가 깨지면 **억지로 맞추지 말고 멈추고 그 지점을 보고하라.**

---

## 5. 커밋

```
제품 / 문서·증거 2 개로 나눠라. 경로 지정. 이 브랜치 push 가능
```

---

## 6. 보고

```
문서에 적는다
  - 첫머리 2~3 줄: 무엇이 달라졌는지 평문으로
  - 순서를 어떻게 바꿨는지 · 중심 방향이 지도 bearing 과 같은 값임을 보이는 근거
  - offsetBearing = bearing + 180 관계를 어디서 확인했는지
  - 스위치 구성 (기본 배지 없음 · 비교 스위치 사용법)
  - §2-1 사용자 절차
  - 가~마 확인 결과 · 스크린샷 해시가 서로 다름을 확인했다는 한 줄
  - 이견·실패 전수 — 없으면 「없음」

최종 응답에만 적는다
  - 커밋 해시 · 브랜치명 · 최종 git status --short · git stash list (2 건)
```

---

## 6. 보고 (U-10)

기본 주행 카메라는 위치 지연 없이, 중심도 스무딩된 지도 방향과 같은 값을 쓴다. 옛 동작(지연 추종 + 원본 방향 중심)은 `aligncam(false)` 로만 되돌린다. 톡 유무는 정지 화면으로 단정하지 않는다.

순서: `nextCamera` → `resetCameraSmoothing`(첫 프레임) → dt·alpha → **bearing 스무딩(`nextBearingPrimary`→`nextBearing`)** → `offsetForFraming = normalizeCompass(nextBearing + 180)` (offset 이 null 이면 그대로 null) → `computeRideFollowFraming` → 중심 lerp 계수 1. `applyFollowCameraJumpTo` 의 bearing 은 그 `nextBearing` 과 동일하다. `rideCameraFraming` 의 `viewBearing = offsetBearing + 180` 이므로 화면 시선도 `nextBearing` 이다.

`getCameraForFollowMode`: rear30·front30·rightFlat·leftFlat 전부 `offsetBearing = normalizeCompass(bearing + 180)`. north 와 기본 분기는 `offsetBearing: null`, `distanceM: 0` — 이 경로는 치환하지 않고 기존처럼 라이더 중심에 둔다. free 는 함수 진입 즉시 return.

상수 불변: `CAMERA_POSITION_TAU_SEC=0.1`, `CAMERA_BEARING_TAU_PRIMARY_SEC=0.2`, `CAMERA_BEARING_TAU_SECONDARY_SEC=0.45`, `CAMERA_BEARING_MAX_DPS_PRIMARY=280`, `CAMERA_BEARING_MAX_DPS_SECONDARY=170`.

스위치: `poslag` 제거. `aligncam` 기본 true(C안) → 배지 없음. `__rtwTick.aligncam(false)` → 배지 `tick off: aligncam` = 옛 동작. `aligncam(true)` 또는 `reset()` 으로 복귀.

**사용자 절차** (5 km/h · 좌측 · 5.5 m)

0. 주행 시작.
1. 직선 — 톡이 없는가.
2. 코너 — 톡이 없는가.
3. 코너에서 지도가 옆으로 훅 밀리거나 어색하지 않은가.
4. `window.__rtwTick.aligncam(false)` → 옛 동작, 코너 톡이 돌아오는가. 다시 `aligncam(true)`.

가 중심 방향 = `nextBearing + 180` = jumpTo bearing 과 쌍. 나 상수 불변. 다 기본 배지 없음 · 비교 스위치 동작. 라 free 조기 return · distanceM 0/null offset 유지 · reset 을 framing 앞으로. 마 실제 브라우저 canvas·레이어 132, 주행 중 오류 0.

스크린샷 SHA-256 서로 다름: `u10-map` 29BDF94E… · `u10-straight` 03DA2811… · `u10-corner` 05C8E26C… (`document/ops/sync-relay/U10-shots/`). 코너 샷은 bearing 이 ~90° 변한 뒤이며 경로가 끝나 결과 패널이 겹쳤다. 톡 판정은 사용자 육안.

이견·실패: 없음.
