# 감리 → 개발팀장 지시서 (활성) — 주행 중 화면 틱

> U-1R(카메라 계측 재작업)은 `INSTRUCTION-U1R-보류.md` 로 **보류 보존**했다. 이번 건을 먼저 한다.
> 결과는 §7 형식으로 이 파일 아래에 덧붙이고 `상태` → `보고완료`.

- **지시번호**: U-2 (주행 중 화면 전체가 주기적으로 튀는 현상)
- **발신**: 클로드감리0814 · **일시**: 2026-08-14 · **상태**: 보고완료
- **브랜치**: **`fix/map-render-tick`** — 기준 **`64c3e5c`** (원격 기준점)에서 새로 파라

⚠ **`fix/rider-camera-nametag-ui` 위에 얹지 마라.** U-1 카메라 변경은 BLOCK 상태다.
그 위에 얹으면 이 수정까지 함께 묶여 채택할 수 없게 된다. 네임태그 변경도 이번에 가져오지 마라.

---

## 0. 증상과 감리가 좁힌 원인

사용자 관찰: **떨리는 것은 라이더가 아니라 화면 자체**다. 주기적으로 툭툭 튄다.

### 0-1. 주행 중에만, 주기적으로 도는 경로가 두 개다

```
rAF 매 프레임 → tickRideCameraFollow → map.stop() + map.jumpTo()
                (rideCameraFollow.ts:291-297)
   jumpTo 는 즉시 이동이라 movestart·move·moveend·zoom·idle 을 **매 프레임** 낸다
        ↓
[경로 A] map.on("move" | "zoom", scheduleLodViewportReport)   MapView.tsx:1560-1561
   scheduleLodViewportReport 는 조건 미달이면 **자기 자신을 재예약**한다 (1533-1546)
   → 이벤트가 계속 오는 주행 중에는 쉬지 않고 돈다. 바닥 주기 = LOD_VIEWPORT_THROTTLE_MS = 100ms
        ↓  100ms 마다
   reportMapLodViewport()              React 상태 갱신 → 리렌더
   syncActivityWorldLayersOnMap(map)   소스 4종 재동기 + moveActivityWorldLayersToTop()

[경로 B] window.setInterval(run, 2500)                        MapView.tsx:2546
   같은 syncActivityWorldLayersOnMap 을 2.5 초마다
```

`syncActivityWorldLayersOnMap`(MapView.tsx:1271-1278)은 마지막에
**`moveActivityWorldLayersToTop(map)` — 레이어 순서를 다시 매긴다.**
`moveLayer` 는 스타일 재검증·리페인트를 부른다. 이걸 주행 내내 100ms 마다 반복하면
규칙적인 화면 끊김으로 보인다.

```
증상 주기가 ~0.1 초 잔틱     → 경로 A
몇 초에 한 번 큰 끊김        → 경로 B
둘 다일 수도 있다
```

### 0-2. 이건 U-1 회귀가 아니다

rAF `jumpTo` 도 move/zoom 핸들러도 U-1 이전부터 있었다. **1 m 밀착 구도에서 같은 크기의
끊김이 훨씬 크게 보일 뿐이다.** 「U-1 때문」이라고 쓰지 마라.

### 0-3. 덤 — 틱 원인은 아니지만 죽은 분기

`rideCameraFollow.ts` 의 `headingFromMove` 는 `prev` 와 **2 m** 이상 떨어져야 쓰이는데
`opts.prevLiveRef.current` 가 **매 프레임 갱신**된다. 30 km/h 면 프레임당 0.14 m 라
이 분기는 주행 중 절대 실행되지 않는다. 방향은 항상 경로에서 온다.
**이번에 고치지 마라. 관측 사실로 보고만 하라.**

---

## 1. 계측이 먼저다 — 추정으로 고치지 마라

U-1 에서 자[尺]가 고장 나 헛돌았다. 같은 실수를 반복하지 않는다.

### 1-0. 브랜치

```
git switch -c fix/map-render-tick   (기준 64c3e5c)
```

### 1-1. 무엇을 세는가 (DEV 게이트)

주행 30 초 동안 아래를 **호출 횟수와 시각**으로 남겨라.

```
① map 이벤트   move · zoom · moveend · zoomend · idle 각각 초당 몇 번
② 경로 A       scheduleLodViewportReport 진입 / 실제 emit(throttle 통과) 횟수
③ 경로 B       setInterval(2500) 실행 횟수
④ 동기 비용    syncActivityWorldLayersOnMap 1 회 소요 ms (performance.now 전후)
                그 안에서 moveActivityWorldLayersToTop 소요 ms 를 따로
⑤ 프레임       rAF 간격 분포 — p50 · p95 · **16.7ms 를 크게 넘긴 프레임의 시각**
```

### 1-2. **틱과 붙여서 증명하라** — 이게 핵심이다

숫자만 모으면 「무거운 게 있다」까지밖에 못 간다.

```
긴 프레임(⑤)의 시각과 ②·③ 의 실행 시각을 **같은 시계로** 나란히 놓아라
   → 긴 프레임이 경로 A·B 실행 직후에 몰려 있는가?
   상관이 안 보이면 **원인이 다른 데 있다는 뜻이다. 그때는 고치지 말고 보고하라**
```

증거 → `document/ops/sync-relay/U2-tick-baseline.json`.
화면 녹화나 연속 스크린샷이 가능하면 함께 남겨라 (`U2-shots/`).

---

## 2. 그 다음에 고친다

**계측이 A 를 지목하면** — 주행 중 카메라가 스스로 낸 이벤트로 LOD·레이어 동기가 도는 것이
문제다. 방향만 정해 준다. 세부는 계측 결과에 맞춰라.

```
① 카메라가 자기가 낸 이벤트에 반응하지 않게 하라
   주행 팔로우 중 rAF jumpTo 가 만든 move/zoom 은 LOD 재보고의 트리거가 아니다
② 레이어 순서 재정렬은 **필요할 때만** 하라
   moveActivityWorldLayersToTop 을 주기적으로 부르지 말고,
   레이어 구성이 실제로 바뀐 뒤에만 부르는 조건을 세워라
③ 경로 B 의 2.5 초 인터벌도 같은 기준으로 줄여라
   (이 인터벌은 style.reload 후 dot 유실 복구용이다 — 목적 자체를 없애지는 마라)
```

**금지** — LOD·활동 레이어 기능 자체를 끄는 것. 주기만 늘려 증상을 흐리는 것.
`LOD_VIEWPORT_THROTTLE_MS` 를 키워서 「덜 보이게」 만드는 것은 수정이 아니다.

**계측이 A 도 B 도 지목하지 않으면 고치지 말고 §1 결과만 보고하라.**

---

## 3. 검증

| | 항목 | 기준 |
|---|---|---|
| T0 | 계측 유효성 | 이벤트·프레임 표본이 0 이 아니고 시각이 유한 — 센티넬 0 건 |
| T1 | 상관 | 수정 전: 긴 프레임이 A·B 실행 시각에 몰림을 표로 제시 |
| T2 | 수정 후 | 긴 프레임(>16.7ms) 발생률이 수정 전 대비 감소 — **수치로** |
| T3 | 기능 보존 | 활동 레이어(red dot·heat)가 여전히 보이고 style.reload 후에도 복구됨 |
| T4 | 카메라 무회귀 | 팔로우 추적이 그대로 — 라이더를 놓치지 않음 |

**T0 이 깨지면 T1~T4 는 판정에 쓰지 마라.** (U-1 의 0 높이 bbox 와 같은 사고를 막는다)

수정 전/후 각각 30 초 주행 · **3 런** 으로 중앙값과 최댓값을 함께 내라.

---

## 4. 커밋

```
제품 / 시험·증거 2 개로 나눠라. 경로 지정. git add -A · --no-verify 금지
이 브랜치 push 가능. main2 병합 · PR 생성 · stash 조작 금지
```

---

## 5. 금지

- **U-1 카메라 변경을 이 브랜치로 가져오기** · 네임태그 재작업 · U-1R 착수
- **Sync 2 단계(S4-2)** · S4-3 · 발행 경로(motion·route) · 보간·외삽 변경
- **GLB·리깅·피팅 변경** · `RIDE_CAMERA_DISTANCE_MIN_M` 변경
- **LOD·활동 레이어 기능 제거** · **주기만 늘려 증상 은폐** · 진단 계측 삭제
- 센티넬·축퇴값을 정상 관측치처럼 기록 · 기존 산출물 덮어쓰기
- `git add -A` · `--no-verify` · stash 조작 · `main2` 병합 · PR · Orchestrator 문서 접촉

---

## 6. 막히면

계측이 A·B 어느 쪽도 지목하지 않거나, 고쳤는데 T2 가 안 나오면
**임계값을 만지지 말고 멈추고 관측치를 그대로 보고하라.** 원인을 다시 좁히는 건 감리가 한다.

---

## 7. 보고

```
문서에 적는다
  - 첫머리 3~4 줄: 화면에서 무엇이 달라졌는지 평문으로
  - §1 계측 결과 (①~⑤) 와 T0 자가 검산
  - **긴 프레임 시각 vs 경로 A·B 실행 시각 상관표** — 이게 원인 증명이다
  - 무엇을 어떻게 고쳤는지 · 왜 그게 원인을 없애는지
  - T1~T4 수정 전/후 3 런 (중앙값 + 최댓값)
  - §0-3 죽은 분기 관측 (고치지는 않았음을 명시)
  - 이견·실패 전수 — 없으면 「없음」

최종 응답에만 적는다
  - 커밋 해시 · 브랜치명 · 최종 git status --short · git stash list (2 건)
```

---

## 8. 결과 (U-2)

주행 팔로우의 `jumpTo`가 매 프레임 내던 move/zoom으로 LOD·활동 레이어 재동기(경로 A, ~100 ms)가 돌던 것을 끊었다. 레이어 순서 재정렬(`moveLayer`)은 구성이 바뀔 때만 한다. 라이더 추적용 `jumpTo` 자체는 그대로다. 헤드리스 30 초 계측에서 16.7 ms 초과 **발생률**은 전후 모두 1.0 으로 남았다 — rAF가 카메라 `jumpTo`에 묶여 ~67–83 ms 간격이다.

### §1 계측 · T0

시계는 모두 `performance.now`. 센티넬 0. T0 3런 전부 통과(표본 0 없음, 시각 유한).

수정 전 30 s 런1 대표값:

| | 값 |
|---|---|
| ① move/zoom/moveend/zoomend | 각 **12.2 /s** · idle 0 |
| ② 경로 A | enter 914 · emit **190** (~6.3/s, throttle 100 ms) |
| ③ 경로 B | run **348** — 2.5 s 인터벌이 아니라 `activityWorldRaw` 갱신마다 effect가 `run()` 한 것 |
| ④ sync / moveToTop | n=886 · p50 1.4 ms / 1.0 ms · max 5.4 / 4.7 ms |
| ⑤ rAF | samples 367 · p50 **83.3 ms** · p95 **100.1 ms** · >16.7 ms **367 (rate 1.0)** |

원본: `c:\20.HDev\boxcycle\document\ops\sync-relay\U2-tick-baseline.json`

### 상관표 (긴 프레임 t 직전 40 ms 안에 A emit / B run)

수정 전 — 긴 프레임이 경로 A 주기에 붙는다. rAF p50/p95 가 LOD throttle(100 ms)과 같다.

| 런 | 긴 프레임 | nearA | fracA | nearB | fracB |
|---|---|---|---|---|---|
| 1 | 367 | 179 | **0.49** | 1 | 0.003 |
| 2 | 382 | 162 | **0.42** | 0 | 0 |
| 3 | 395 | 185 | **0.47** | 0 | 0 |

런1 샘플(같은 시계):

| t | dt | nearA | nearB |
|---|---|---|---|
| 15063 | 116.6 | yes | no |
| 15146 | 83.4 | no | no |
| 15246 | 100 | yes | no |
| 15346 | 100 | yes | no |
| 15546 | 100.1 | yes | no |

**경로 A를 지목.** 경로 B(2.5 s)는 긴 프레임과 붙지 않음.

### 수정

1. 팔로우 `jumpTo` 구간(`beginFollowCameraJump`)에 생긴 move/zoom 은 `scheduleLodViewportReport` 가 무시한다. 카메라가 만든 이벤트로 LOD·`syncActivityWorldLayersOnMap` 이 안 돈다.
2. `moveActivityWorldLayersToTop` 은 레이어 존재 시그니처가 바뀔 때만 `moveLayer`. `style.load` 때 시그니처를 비워 복구 후 한 번은 다시 올린다.
3. 경로 B: 닷 레이어가 **없을 때만** 재동기. `style.load`·2.5 s 인터벌은 유지(유실 복구). effect 의존을 `hasDots` 로 좁힘(산출 후 코드 — 아래 after JSON 은 이 한 줄 전 측정).

`LOD_VIEWPORT_THROTTLE_MS` 는 100 그대로. 활동 레이어를 끄지 않음.

### T1~T4 수정 전/후 3런

긴 프레임 **발생률**(>16.7 ms / rAF 수) 중앙값·최댓값: 전 **1.0 / 1.0** · 후 **1.0 / 1.0**. T2 발생률 기준은 미달.

그 외 수치(런 중앙에 가까운 값):

| | 전 | 후 |
|---|---|---|
| 경로 A emit | 190–201 | **0** |
| moveToTop n | 841–886 | **0** |
| rAF p50 | 66.8–83.3 | **66.7** |
| rAF p95 | 100 | 83.4–100 |
| 상관 fracA | 0.42–0.49 | **0** |

- T3: 활동 레이어 동기·`style.load` 복구 경로는 남김. 이번 3런에 `style.reload` 를 따로 넣지는 않았다.
- T4: `followJumpTo` 후 396/30 s 로 팔로우 `jumpTo` 유지. 라이더 추적은 그대로.

후 원본: `c:\20.HDev\boxcycle\document\ops\sync-relay\U2-tick-after.json`

### §0-3 죽은 분기 (고치지 않음)

`headingFromMove` 는 prev 가 매 프레임 갱신되어 2 m 문턱을 거의 못 넘는다. 수정 전 3런 hit **0, 1, 0** / miss 368–396. maxStepM 보통 0.55–0.74 m, 런2만 한 번 2.31 m 로 hit 1. 방향은 경로 평균 헤딩. **분기 로직은 미수정.**

### 이견 · 실패

- **T2 발생률은 줄지 않았다.** 헤드리스에서 `jumpTo` 가 rAF를 ~10–15 Hz 로 묶는다. A를 꺼도 16.7 ms 초과는 거의 전 프레임. 임계값·throttle 은 올리지 않았다.
- 수정 후 경로 B run 이 여전히 394–441/30 s — after JSON 취득 시점에 interval effect 가 `activityWorldRaw` 참조마다 `run()` 했다. 이후 의존을 `hasDots` 로 바꿨고, 그 한 줄의 3런은 게이트(시작 다이얼로그 없음)로 재취득하지 못했다.
- U-1 카메라/네임태그 변경은 이 브랜치에 없음 (base `64c3e5c`).
