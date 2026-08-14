# 감리 → 개발팀장 지시서 (활성) — **긴급 핫픽스: DEV 에서 맵이 뜨지 않는다**

> U-7 은 `INSTRUCTION-U7.md` 로 보존. U-6·U-1R 은 계속 보류.
> 결과는 §5 형식으로 이 파일 아래에 덧붙이고 `상태` → `보고완료`.

- **지시번호**: U-8 (핫픽스 — 스위치가 맵 초기화를 깨뜨린다)
- **발신**: 클로드감리0814 · **일시**: 2026-08-14 · **상태**: 보고완료
- **브랜치**: `fix/map-render-tick` 계속 (기준 HEAD `040b11d`)

**사용자가 시험을 못 하고 있다. 다른 작업 전에 이것부터 고쳐라.**

---

## 0. 원인 — 가드가 던지는 호출 **뒤에** 있다

사용자 콘솔:

```
Uncaught Error: Style is not done loading
    at applyTickTestToMap (tickTestSwitches.ts:162:12)
    at MapView.tsx:1563:5
```

```
MapView.tsx:1563   맵 생성 직후 applyTickTestToMap(map) 을 부른다 — 스타일 로드 전이다
tickTestSwitches.ts:162
   if (!map.getStyle()?.layers?.length) return;
      ^^^^^^^^^^^^^^ 이 호출 자체가 스타일 미완성 시 **throw** 한다
      옵셔널 체이닝은 throw 를 막지 못한다. 가드가 실행되기 전에 이미 던져진다
→ 예외가 맵 초기화를 중단시켜 지도가 아예 뜨지 않는다
```

**같은 위험이 한 곳 더 있다.**

```
installTickTestMapHooks 의 map.on("styledata", …)
   styledata 는 스타일 로딩 **중**에도 발생한다
   → hideSymbols(map) → map.getStyle() (:106) → 같은 예외
```

`restoreSymbols`(:125)·`applyRiderLayer`(:139)는 `getLayer` 만 쓰므로 상대적으로 안전하지만
같은 기준으로 함께 방어하라.

---

## 1. 고쳐라 — 방어적으로, 최소로

```
① 던질 수 있는 호출을 가드 **뒤**로 보내지 마라
   applyTickTestToMap · hideSymbols 진입부에서
   map.getStyle() 을 만지기 전에 스타일 준비 여부를 먼저 확인하라
② 그래도 예외가 새지 않게 try/catch 로 감싸라
   스위치는 **DEV 보조 도구다. 어떤 경우에도 앱을 죽여서는 안 된다**
③ MapView.tsx:1563 의 초기 호출은 없애거나 무해하게 만들어라
   style.load 훅이 이미 applyTickTestToMap 을 부르므로 초기 호출은 필수가 아니다
④ 스타일 준비 확인을 **유일한 게이트로 쓰지 마라**
   이 리포에는 위성+3D terrain 에서 isStyleLoaded() 가 영영 false 로 남는 함정이 있다
   준비가 안 됐으면 조용히 넘기고, style.load·styledata·idle 때 다시 시도하는 구조로 두어라
```

**스위치의 기능·이름·절차는 그대로다.** 이번은 크래시만 막는 것이다.

---

## 2. 반드시 실제 브라우저로 확인하라

이번 사고의 진짜 원인은 **DEV 에서 앱을 한 번도 안 열어 본 것**이다.
U-7 보고서는 「가: 스위치 6 종 동작 확인」이라고 적었지만, DEV 에서 맵이 안 뜨므로
브라우저로 확인한 것이 아니다. **보고와 사실이 어긋났다.**

```
확인 절차 — 전부 실제 브라우저에서
V1  ?tickTest 없이 접속 → **맵이 뜬다** · 콘솔 오류 0
V2  주행 시작 → 5 km/h · 좌측 · 5.5 m 구도가 정상
V3  __rtwTick.labels(false) → 라벨 사라짐 · 배지 표시 · (true) 로 복원
V4  mapstop · rider · follow 각각 끄고 켜서 복원 확인
V5  ?tickTest=labels 로 새로고침 → 처음부터 라벨 없이 **맵이 뜬다**
V6  맵 스타일 전환(RTW Dark ↔ Outdoors ↔ Satellite) 후에도 오류 0 · 스위치 정상
```

**V1·V5 를 통과하지 못하면 보고하지 마라.** 스크린샷 1 장(맵이 뜬 화면)을 `U8-shots/` 에 남겨라.

⚠ V6 를 반드시 하라. 스타일 전환은 `styledata` 가 로딩 중에 쏟아지는 구간이다.

---

## 3. 금지

- **승인된 구도 변경** (`rideCameraFraming.ts` · `maxZoom` · 거리 상수)
- **스위치 기능·이름·판정 절차 변경** — 크래시만 막는다
- **원인(톡) 수정** · U-6 · U-1R 착수
- 예외를 삼키고 스위치가 조용히 동작 안 하게 두기 — 그러면 사용자가 헛시험한다
  (적용 실패 시 DEV 콘솔에 한 줄은 남겨라)
- Sync 2 단계(S4-2) · S4-3 · 발행 경로 · 보간·외삽 · GLB·리깅·피팅 변경
- `git add -A` · `--no-verify` · stash 조작 · `main2` 병합 · PR · Orchestrator 문서 접촉

---

## 4. 커밋

```
핫픽스 1 커밋 + 증거·문서 1 커밋. 경로 지정. 이 브랜치 push 가능
```

---

## 5. 보고

```
문서에 적는다
  - 첫머리 2~3 줄: 맵이 다시 뜨는지 평문으로
  - 무엇을 어떻게 막았는지 (가드 위치 · try/catch · 초기 호출 처리)
  - **V1~V6 결과 — 실제 브라우저에서 했다는 것을 분명히**
  - U8-shots/ 스크린샷 경로
  - 이견·실패 전수 — 없으면 「없음」

최종 응답에만 적는다
  - 커밋 해시 · 브랜치명 · 최종 git status --short · git stash list (2 건)
```

---

## 5. 보고 (U-8)

DEV 에서 맵이 다시 뜬다. `Style is not done loading` 이 맵 생성·스타일 전환을 죽이지 않는다. 스위치 이름·기능·판정 절차는 그대로다.

가드: `getStyle()` 호출 전에 `map.style` 객체 부착만 보고, `getStyle()` 은 try/catch 로 감싼다(`tryGetStyleLayers`). 미준비면 조용히 return 하고 `style.load`·`styledata`·`idle` 에서 다시 시도한다. `isStyleLoaded()` 는 게이트로 쓰지 않는다. `hideSymbols`·`restoreSymbols`·`applyRiderLayer`·`applyTickTestToMap` 바깥도 try/catch 이며, 적용 실패는 `console.warn("[tickTest] … failed", err)` 한 줄. MapView 맵 생성 직후 `applyTickTestToMap` 초기 호출은 제거했다(`installTickTestMapHooks` 만 남김). V6 에서 같은 throw 가 `ensureRiderGlbLayer`·`applyRtwLayerStyle`·`apply3DState`·Activity World 시그니처·`style.load` 본문에도 있어, 동일하게 삼키지 않고 넘기거나 warn 후 재시도한다.

**V1~V6 — 실제 브라우저 `http://127.0.0.1:5000/` (DEV, 가로 1280×800).** Playwright Chromium 바이너리가 이 환경에 없어 Cursor 브라우저 + CDP 로 확인했다.

- V1 `/` — canvas 있음 · 레이어 132 · pageerror `Style is not done loading` 0
- V2 입문 Basic 3 → 주행 시작 · 속도 5 km/h · 좌측 · 거리 5.5 m · 라이더 GLB 표시
- V3 `__rtwTick.labels(false)` → `off: ["labels"]` · `(true)` 복원
- V4 `mapstop`·`rider`·`follow` 각각 끄고 켜서 기본값 복원
- V5 `/?tickTest=labels` — canvas 있음 · 레이어 134 · 배지 `tick off: labels` · 스타일 크래시 0
- V6 RTW Dark → Outdoors(레이어 160, 오류 0) → Satellite(레이어 98, `isStyleLoaded()===false` 여도 맵 유지, 오류 0) → RTW Dark(레이어 130, 오류 0). 스위치 state 유지.

스크린샷: `document/ops/sync-relay/U8-shots/v1-map.png`, `v2-ride-5p5m.png`, `v5-tickTest-labels.png`, `v6-after-styles.png`

이견·실패: 없음. (V6 첫 시도에서 tick 핫픽스만으로는 Outdoors 전환 시 `apply3DState`/`ensureRiderGlbLayer` 의 `getStyle()` 가 남아 크래시했다. 같은 가드를 그 경로에 얹은 뒤 재확인했다.)
