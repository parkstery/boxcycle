# 감리 → 개발팀장 지시서 (활성) — **U-1 카메라 구도 복구 최우선** + 틱 렌더 계측

> U-3 은 `INSTRUCTION-U3.md`, U-4 초안은 `INSTRUCTION-U4-초안.md` 로 보존한다.
> U-1R 은 계속 보류(`INSTRUCTION-U1R-보류.md`).
> 결과는 §6 형식으로 이 파일 아래에 덧붙이고 `상태` → `보고완료`.

- **지시번호**: U-5 (① U-1 구도 복구 — 최우선 · ② 틱 렌더 계측)
- **발신**: 클로드감리0814 · **일시**: 2026-08-14 · **상태**: 보고완료
- **브랜치**: `fix/map-render-tick` 계속 (기준 HEAD `01221a5`)

---

## 0. 감리 착오 — U-1 을 브랜치에서 뺀 것은 내 판단 착오다

사용자 화면이 **머리 잘리던 예전 구도로 되돌아갔다.** 원인은 폐기가 아니라 브랜치 구성이다.

```
fix/map-render-tick 은 64c3e5c 에서 갈라졌다 — 감리가 그렇게 지시했다
그래서 U-1 커밋 293b54d 가 미포함이고, rideCameraFraming.ts 가 워킹트리에 없다
```

**U-1 을 BLOCK 한 이유는 계측(bbox 높이 0)이지 구도가 나빠서가 아니었다.**
그런데 「BLOCK 된 변경이 섞이면 채택이 얽힌다」는 이유로 코드까지 통째로 뺐다.
**판정과 코드 보존을 분리했어야 했다. 감리 잘못이다.**

코드는 `293b54d` 에 그대로 있다. **되살린다.**

---

## 1. 최우선 — U-1 카메라 구도를 이 브랜치로 복구하라

### 1-1. 무엇을 되살리나

`293b54d` 의 10 파일이다. 그중 **8 개는 이 브랜치가 건드린 적이 없어 그대로 들어온다.**

```
그대로 들어옴   geo.ts · mapGlobeView.ts · rideCameraFraming.ts(신규)
                peerMotion/PeerMotionRegistry.ts · peerMotion/peerSyncDebug.ts
                riderPrototype/config.ts · glbModelLayer.ts · riderRig.ts
충돌 예상       MapView.tsx · rideCameraFollow.ts
```

```
git cherry-pick 293b54d      (또는 동등한 방법)
```

### 1-2. 충돌 해소 원칙 — **둘 다 살려라**

```
MapView.tsx · rideCameraFollow.ts 에서
   U-1 쪽    computeRideFollowFraming 호출 · 안전영역 기반 zoom · 허리(PELVIS) look-at
   U-2/U-3   경로 A 억제(beginFollowCameraJump) · mapTickProbe · cameraFollowTrace
             red dot 레이어 순서 수정(3521155)
→ **어느 쪽도 버리지 마라.** 하나라도 빠지면 이번 작업이 무의미하다
```

### 1-3. 복구 확인 — 눈으로 볼 수 있게

```
가  rideCameraFraming.ts 가 존재하고 computeRideFollowFraming 을
    MapView 의 스냅과 rideCameraFollow 의 틱이 **둘 다** 부른다 (grep 결과를 보고서에)
나  거리 1 m · 좌측 팔로우 스크린샷 1 장  → U5-shots/restored-1m.png
    복구 전(현재 HEAD) 스크린샷도 1 장 → U5-shots/before-1m.png
    **두 장을 나란히 보고서에 경로로 적어라. 사용자가 눈으로 판정한다**
다  U-2 이득 유지: 경로 A emit 0
라  red dot: 활동 레이어가 route 위 (레이어 인덱스)
```

⚠ **이번에 구도 수치를 새로 튜닝하지 마라.** `293b54d` 그대로 복구가 목적이다.
머리 맞춤은 보류 중인 U-1R 에서 한다. 지금 손대면 무엇이 원래 값인지 알 수 없게 된다.

⚠ `RIDE_CAMERA_DISTANCE_MIN_M` 은 1 그대로. GLB·리깅·피팅 무수정.

### 1-4. 커밋

```
커밋 1  U-1 구도 복구 (cherry-pick 결과)
        메시지에 「293b54d 복구 — 감리 착오로 브랜치에서 빠졌던 것」을 남겨라
커밋 2  §1-3 증거 (U5-shots/ · 문서)
경로 지정. git add -A · --no-verify 금지
```

**§1 을 끝내고 나서 §2 로 가라. §1 이 막히면 거기서 멈추고 보고하라.**

---

## 2. 화면 틱 — Mapbox 가 **실제로 그린** 카메라를 재라

증상은 그대로다. U-3 의 계측은 「`jumpTo` 에 넣는 값」만 찍어서 위상 가설을 볼 수 없었다
(감리 설계 착오). 트레이스 zoom 24.8372 인데 맵 `maxZoom` 은 24 라는 것이 그 증거다 —
그 값은 Mapbox 가 채택한 값이 아니었다.

### 2-1. 무엇을 재는가

```
쓰기   jumpTo 직전:  writeSeq++ · writeT · writeCenter · writeZoom · writeBearing
그리기 map.on("render", …) 안:
       renderT · map.getCenter() · map.getZoom() · map.getBearing()
       그 프레임이 반영한 writeSeq (가장 최근 일치)
파생   lagFrames = 최신 writeSeq − 렌더가 반영한 writeSeq
       renderCount : writeCount 비
```

### 2-2. 판정

```
①-a  lagFrames 가 0 과 1 을 **번갈아** → 위상 어긋남 확정
①-b  renderCount ≠ writeCount → 프레임 드롭·중복. 비율을 적어라
①-c  항상 0 이고 1:1 → **위상 문제 아님.** 고치지 말고 보고하라
      (다음 후보는 라이더 GLB 레이어의 렌더 경로다. 감리가 정한다)
```

`getZoom()` 이 24 로 잘리는지도 실측해 적어라 (요청은 24.837).

### 2-3. 조건을 사용자와 맞춰라

```
속도 5 km/h · 거리 1 m · 좌측 팔로우 · **실제 브라우저 창**
   U-3 트레이스는 약 20 km/h · 12 fps 였다 — 프레임당 이동이 26 배 어긋났다
헤드리스로만 가능하면 그 사실과 fps 를 명시하고, 그 결과로 ①을 부정하지 마라
headed 로 주행 화면에 바로 들어가는 방법을 **명령 한 줄**로 보고하라
```

### 2-4. 고치는 것은 ①이 확정된 뒤다

확정되면 카메라 갱신을 Mapbox 의 render 시점에 맞춰 위상을 묶고, 매 프레임 `map.stop()` 을 없애라.
**`jumpTo`→`easeTo` 전환 금지. 스무딩 상수(tau·max dps) 조정 금지.**

---

## 3. 검증

| | 항목 | 기준 |
|---|---|---|
| **가** | **U-1 복구** | `rideCameraFraming.ts` 존재 · 스냅/틱 양쪽 호출 · before/after 스크린샷 2 장 |
| 나 | 병합 무손실 | 경로 A emit 0 · red dot 이 route 위 (둘 다 실측) |
| 다 | 원본 유지 | 구도 수치를 새로 튜닝하지 않음 |
| Q0 | 틱 계측 유효성 | write·render 표본 각 ≥ 500 · 센티넬 0 · seq 단조 |
| Q2 | ① 판정 | lagFrames 분포 + render:write 비 |
| Q3 | 조건 | 5 km/h · 1 m · 실브라우저(불가하면 사유·fps 명시) |

**가가 미달이면 나머지는 의미가 없다. 가부터 끝내라.**

---

## 4. 금지

- **U-1 구도 수치 재튜닝** · U-1R 착수 · 네임태그 재작업
- **U-2 경로 A 수정 · U-3 red dot 수정 되돌리기** (충돌 해소에서 버리는 것 포함)
- **①이 확정되기 전 카메라 루프 수정** · `jumpTo`→`easeTo` · 스무딩 상수 조정
- **헤드리스 결과만으로 ①을 부정** · 주기 상향·상수 완화로 증상 흐리기
- `RIDE_CAMERA_DISTANCE_MIN_M` 변경 · `maxZoom` 변경(관측만) · GLB·리깅·피팅 변경
- Sync 2 단계(S4-2) · S4-3 · 발행 경로 · 보간·외삽 변경
- 센티넬·축퇴값을 정상 관측치처럼 기록 · 진단 계측 삭제 · 기존 산출물 덮어쓰기
- `git add -A` · `--no-verify` · stash 조작 · `main2` 병합 · PR · Orchestrator 문서 접촉

---

## 5. 막히면

cherry-pick 충돌이 두 파일 밖으로 번지거나, 둘 다 살릴 수 없는 지점이 나오면
**어느 한쪽을 버리지 말고 멈추고 그 지점을 그대로 보고하라.**

---

## 6. 보고

```
문서에 적는다
  - 첫머리 3~4 줄: 화면 구도가 어떻게 돌아왔는지 평문으로
  - §1 복구 방법 · 충돌 두 파일을 어떻게 둘 다 살렸는지
  - grep 근거 (computeRideFollowFraming 호출 지점 2 곳)
  - **U5-shots/before-1m.png · restored-1m.png 경로** (열리는 경로로)
  - 나·다 실측 (경로 A emit · 레이어 인덱스 · 수치 무변경 확인)
  - Q0·Q2·Q3 틱 계측 결과 — lagFrames 분포와 render:write 비
  - 실브라우저 주행 화면 명령 한 줄
  - 이견·실패 전수 — 없으면 「없음」

최종 응답에만 적는다
  - 커밋 해시 · 브랜치명 · 최종 git status --short · git stash list (2 건)
```

---

## 6. 보고 (U-5)

U-1 구도를 이 브랜치에 되돌렸다. 스냅과 틱이 다시 `computeRideFollowFraming`(안전영역 zoom · 허리 PELVIS look-at)을 쓴다. 복구 전 1 m 좌측은 라이더가 크게 잡히고 머리가 잘린다. 복구 후는 같은 거리·속도에서 look-at이 허리로 옮겨 프레이밍이 달라진다. **두 장 비교는 사용자 육안.** 카메라 rAF/`map.stop()` 루프는 바꾸지 않았다 — lagFrames 가 항상 0 이고 render:write 가 1:1 이라 ①-c.

### §1 복구

`git cherry-pick 293b54d`. 충돌은 `MapView.tsx` · `rideCameraFollow.ts` **두 파일뿐**, 둘 다 임포트 hunk. 본문은 git가 자동 병합했다.

- U-1: `computeRideFollowFraming` · `RIDE_HUD_SAFE_PADDING` · `publishRiderScreenDiag` · `offsetLngLatByBearingMeters` 를 `geo.ts` 로 이동 후 re-export
- U-2/U-3: `beginFollowCameraJump` / `mapTickProbe` / `cameraFollowTrace` / `lastActivityWorldLayerSigByMap`(위에 얹힌 id) / `?rideCam=` 거리 오버라이드(`MIN`/`MAX` 임포트 유지)

구도 상수(`RIDE_HUD_SAFE_PADDING`, `RIDER_HEIGHT_SPAN_MARGIN`, look-at 산식)는 293b54d 그대로. `RIDE_CAMERA_DISTANCE_MIN_M = 1`.

### grep

```
apps/web/src/components/map/rideCameraFollow.ts:236  computeRideFollowFraming({   // 틱
apps/web/src/components/map/MapView.tsx:2509        computeRideFollowFraming({   // 스냅
apps/web/src/lib/rideCameraFraming.ts               존재
```

### 스크린샷 (사용자 판정)

- 복구 전: `document/ops/sync-relay/U5-shots/before-1m.png`
- 복구 후: `document/ops/sync-relay/U5-shots/restored-1m.png`

조건 공통: 5 km/h · 거리 1 m · 좌측 팔로우 · Playwright 1280×900.

### 나 · 다

- 경로 A emit **0** (before-1m.json · restored-1m.json)
- red dot: route **130** · heat **133** · pulse **134** (pulse가 route 위) — 복구 전/후 동일
- 수치 재튜닝 없음

### Q0 · Q2 · Q3

파일 `document/ops/sync-relay/U5-render-phase.json`. Playwright **headed**, 5 km/h · 1 m · 좌측, 30.1 s.

- Q0: write **677** · render **677** · 센티넬 **0** · seq 단조
- Q2: `lagFrames` 분포 **{0: 677}** · alt01Frac **0** · always0 **true** · render:write **1**
- ①-a 아님. **①-c → 위상 문제로 확정하지 않음. 카메라 루프 미수정.**
- `map.getZoom()` **항상 24**. writeZoom **≈ 25.058** (프레이밍 요구). maxZoom 24 클램프 실측. 고치지 않음.
- 일치 판정은 center·bearing만 사용(줌을 넣으면 클램프 때문에 전부 불일치).

Q3: headed 창은 떴으나 표본 ≈ **22.5 fps**(677/30s). 실사용자 60 fps와 다를 수 있다. 이 표본만으로 60 fps 위상을 단정하지 않는다. **지시 기준(항상 0 · 1:1)으로는 고치지 않는다.**

### 실브라우저 한 줄

`npm run dev:localhost -w boxcycle-web` 후 `http://127.0.0.1:5000/?rideCam=1` → 시작 → 입문 마지막 코스 → 주행 시작. 맵 뷰에서 거리 1 m·좌측, 경로 패널 속도 5 km/h.

headed 계측만: `npm run test:e2e:u5q -w boxcycle-web`

### 이견·실패

- 복구 후 샷에서 GLB 전신이 before만큼 크게 안 보일 수 있다(PELVIS look-at). 수치는 안 만졌다. 판정은 두 PNG.
- render 훅은 채택값 계측만. jumpTo 시점·`map.stop()` 은 그대로.
- `INSTRUCTION-U3.md` 는 보존 파일로 문서 커밋에 담는다.
- 없음 외 위 항목.

