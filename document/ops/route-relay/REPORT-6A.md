# REPORT — 화면 정리 · 센서 칩을 RouteDock 으로 (`UI-DECLUTTER-SENSOR-6A`)

| 항목 | 내용 |
|---|---|
| 지시서 | [260905-화면정리-센서칩-RouteDock-6A-작업지시서.md](260905-화면정리-센서칩-RouteDock-6A-작업지시서.md) |
| 작성 | 2026-09-16 |
| base | `main2` (`b7fe0d1`) → 브랜치 `fix/ui-declutter-sensor-6a` |
| 결과 | **완료** — 지시서 §5 시험 1~4 전부 PASS. 단, §4.3 확인 결과 **우상단 폴백을 남겼다**(근거는 §3) |

---

## 1. 지시서가 쓰인 뒤 바뀐 것 — 배치 전제 갱신

지시서(09-05)는 09-14 RouteDock 변경 **이전**에 쓰였다. §4.2 는 「`RouteDock` **헤더 행**에 둔다」고 했지만, 현재 코드에서 헤더(`route-dock__head`, Go 가 있는 행)는 **접히는 본문 안**에 있다.

```
route-dock-anchor
└ route-dock__shell            ← 항상 보임
   ├ route-dock__caret         「경로」 탭
   └ route-dock__panel  hidden={!expanded}   ← 헤더(Go)·경유지 목록이 여기
```

§4.2(헤더 행)와 §3.1(접혀도 보여야 한다)을 **둘 다** 만족시키려면 헤더 행 자체를 접히는 본문 밖으로 끌어올려야 한다. 그렇게 했다:

```
route-dock-anchor
└ route-dock__shell                 ← 항상 보임
   ├ route-dock__caret              「경로」 탭
   └ route-dock__body
      ├ route-dock__top             ← 항상 보임: [● CAD][Go][저장][삭제]
      └ route-dock__panel  hidden={!expanded}   ← 경유지 목록·저장 폼
```

읽는 순서는 지시서가 요구한 그대로이고, 칩은 첫 행 안에 앉는다:

```
[ ‹ ][ ● CAD  Go        내 경로로 저장  삭제 ]
       └ 첫 행 ─────────────────────────────┘
      [ S 출발 주소                       ✕ ]
      [ E 도착 주소                       ✕ ]
```

접으면 `[경로 ›][● -- rpm]` 만 남는다 — 주행 중 자동 접힘 상태에서도 rpm·연결 상태가 그대로 보인다.

> **1차 시안 폐기(2026-09-16 Chief).** 처음에는 칩을 caret 과 패널 **사이의 세로 컬럼**으로 세웠다. 접힘 대응은 됐지만 칩 아래가 통째로 비면서 dock 폭만 243 → 310px 로 넓어졌다 — **정리하려다 지도를 더 가렸다.** 첫 행 안으로 넣어 되돌렸고, 이제 dock 크기는 칩 유무와 무관하다(§5).

---

## 2. §4.1 이동 결과 · 우상단 잔여 요소

| 슬롯 | 이전 | 이후 |
|---|---|---|
| 우상단 `map-hud__tr` | 센서 칩 · 계정 칩 · (로그인 칩) | **계정 칩 · (로그인 칩)** |
| 우상단 아래 `map-hud__tr-under` | 맵 버튼 | 맵 버튼 (불변) |
| RouteDock 첫 행 | (Go · 저장 · 삭제) | **센서 칩** · Go · 저장 · 삭제 |

칩 자체는 **위치만 옮겼다.** `cadenceChipView` 의 rpm 표기·LED 색·`aria-label`·클릭 시 `CadenceSensorSheet` 열기 전부 그대로다. 바뀐 것은 `placement="dock"` 이 붙는 치수뿐이다 — 같은 행의 `삭제` 버튼과 같은 높이(min-height 1.3rem)·같은 톤(`rgba(10,16,26,0.35)`)을 쓰는 작은 알약.

구조 변경 1건: 헤더 행(`route-dock__head`)을 `route-dock__panel` 밖 `route-dock__top` 으로 옮겼다. 이것이 「첫 행 좌측」과 「접어도 보인다」를 동시에 만족시키는 유일한 배치다. 헤더 내용의 표시 조건(`expanded && !ridingDiet`)은 종전과 같아 접힘·주행 중 동작은 변하지 않는다.

부수 정리 1건: `.hud-cadence*` CSS 73줄을 `MapHud.css` → **`CadenceHudChip.css`** 로 옮겼다. 칩이 두 자리에 살게 되었으므로 스타일이 MapHud 파일에 얹혀 있으면 소유가 불분명해진다.

---

## 3. §4.3 signed-out 확인 결과 — **폴백을 남겼고, 이유는 signed-out 이 아니다**

지시서는 signed-out 맵 모드를 걱정했다. 실제로 확인해 보니 **문제는 그보다 크고, 다른 곳에 있다.**

### 확인한 것

`RouteDock` 의 표시 조건은 stage 함수이고(`isRouteDockVisible`), 칩의 종전 표시 조건은 stage 와 무관했다.

| stage | RouteDock | 종전 센서 칩 | 격차 |
|---|---|---|---|
| `gate` · `gate-nickname` | ✕ | ✕ | 없음 |
| **`idle`** | **✕** | **○** | **있음** |
| `setup` | ○ | ○ | 없음 |
| `ready-to-start` | ○ | ○ | 없음 |
| `riding` · `paused` | ○ | ○ | 없음 |
| `summary` | ✕ | ✕ | 없음 |

signed-out 여부는 무관했다 — `showCadenceChip` 는 `account` 를 보지 않는다(`MapHud.tsx` 주석대로). 진짜 격차는 **`idle`**, 즉 **경로가 없는 앱 첫 화면**이다.

### 왜 이것이 막는 문제인가

센서 상세 설정(`CadenceSensorSheet`)은 「**체험 속도로 준비**」의 **유일한 입구**이고, 그것이 `Go` 의 사전조건이다(SENSOR-2 §1.4). 칩을 dock 전용으로 두면 `idle` 화면에서 주행 입력을 준비할 방법이 사라진다. 실제로 저장소의 e2e 6건(`ride-entry`·`route-dock-riding-content`·`account-panel-tidy`·`ride-continuation` 등)이 전부 **게스트 진입 직후(=`idle`) 칩을 눌러** 입력을 준비한다.

### 판단

`idle`(및 게이트가 시각적으로 닫힌 `gate`)에서만 **우상단 폴백**을 남겼다. 자리 판정은 `src/lib/route/sensorChipSlot.ts` 한 곳이 소유한다.

```ts
if (!hasCadence || isGate || isSummary) return "none";
return isRouteDockVisible(stage) ? "route-dock" : "map-hud-tr";
```

배타적 단일 값이라 **두 곳에 동시에 뜰 수 없고**(뜨면 `getByRole` strict 위반으로 즉시 깨진다), 게이트·결과 시트가 아니면 **어디에도 없을 수 없다.**

> ⚠️ **남는 것 — Chief 판단 필요.** 「우상 3개 → 2개」는 dock 이 있는 네 stage 에서만 성립한다. `idle` 은 여전히 3개다. 그런데 `idle` 은 앱을 켜면 **처음 보는 화면**이라, 「버튼이 너무 많다」가 가장 강하게 느껴지는 자리이기도 하다.
> 이것을 마저 없애려면 좌하단 앵커에 **RouteDock·「다음 주행」 카드와 공유하는 상시 센서 자리**를 만들어야 하는데, 그 앵커는 `idle` 에서 `NextRideCard`/`FirstRideIntroCard` 가 이미 쓰고 있다. 지시서 §7·§8 이 「다른 표면을 이번에 건드리지 마라」고 했으므로 **선제적으로 손대지 않았다.**

---

## 4. §5.1 표시 불변식 — 8 조합

4 stage × 접힘/펼침. 실제 브라우저에서 접기·펼치기를 눌러 가며 `isVisible()` 로 측정했다.

| stage | 접힘 | 펼침 |
|---|---|---|
| `setup` | ✅ | ✅ |
| `ready-to-start` | ✅ | ✅ |
| `riding` | ✅ | ✅ |
| `paused` | ✅ | ✅ |

증거: `.out/sensor-chip-6a/measurements.json` 의 `foldGrid` · `setup-fold-grid.json`.

**순수 함수만으로는 이 불변식을 못 잡는다**(축퇴). 슬롯이 `"route-dock"` 이어도 칩이 `hidden` 패널 **안**에 있으면 접는 순간 사라지는데, 슬롯 함수는 그것을 볼 수 없다. 그래서 계약을 두 겹으로 깔았다:

1. `sensor-chip-slot-contract.test.ts` — 슬롯 판정(전 stage × 센서 유무 × 게이트/결과)
2. 같은 파일의 소스 구조 검사 — `<CadenceHudChip` 가 `route-dock__panel` **앞**에 있고, 칩 가드에 `expanded` 가 끼어들지 않았음

---

## 5. §5.4 폰 가로 실측 — Go 전후 비교

뷰포트 **690 × 275**(루트 폰트 13.5px 확인). 같은 페이지에서 칩만 `display:none` 으로 껐다 켜 **동일 조건 전후**를 쟀다.

| 대상 | 칩 없음(before) | 칩 있음(after) | 차이 |
|---|---|---|---|
| **dock shell width** | 243.00 | 243.00 | **0** |
| **dock shell height** | 83.53 | 83.53 | **0** |
| **Go** width | 32.39 | 32.39 | **0** |
| **Go** height | 22.27 | 22.27 | **0** |
| 헤더 행 height | 22.27 | 22.27 | **0** (줄바꿈 없음) |
| Go x | 36.97 | 95.89 | +58.92 (칩 폭 + 행 간격) |
| 센서 칩 | — | **55.16 × 19.27** | 행 높이 22.27 이내 |

- **dock 은 칩 유무와 무관하게 243 × 83.53px** — 지시서 이전(`main2`) 치수와 동일하다. 칩을 넣느라 지도를 더 가리지 않는다.
- 칩 높이 19.27px < 행 높이 22.27px — **세로 컬럼을 만들지 않는다.**
- Go 는 좁아지지도 줄바꿈되지도 않았다. x 이동 +58.92px 은 칩 폭(55.16) + 행 간격(3.78)으로 전부 설명된다 — 다른 것이 밀고 들어오지 않았다.
- 지도 잠식은 **순감**이다: dock 면적은 그대로(20,299px²)이고 우상단에서 칩 약 2,000px² 이 빠졌다. 떠 있는 표면도 한 덩어리 줄었다.

증거: `.out/sensor-chip-6a/measurements.json`.

---

## 6. 화면 증거

`apps/web/.out/sensor-chip-6a/` (gitignore).

| 파일 | 내용 |
|---|---|
| `01-idle-fallback-tr.png` | `idle` — 우상단 `[● CAD][G 게스트][맵]` 폴백 |
| `02-ready-to-start-expanded.png` | 주행 전 펼침 — 첫 행 `[● CAD][Go]`, 우상단에 칩 없음 |
| `03-riding-collapsed.png` | **주행 중 접힘** — `[경로 ›][● -- rpm]`, rpm 유지 |
| `04-paused.png` | 일시정지 |
| `05-setup.png` | 핀만 있는 상태 |
| `06-shell-closeup.png` | dock 클로즈업 — 칩이 첫 행 안에 앉은 것 확인 |

---

## 7. 시험·회귀

| 명령 | 결과 |
|---|---|
| `npx tsc -b` | exit 0 |
| `npx eslint <변경 파일 8건>` | **error 0** (warning 5 — 전부 `App.tsx` 기존 baseline, 내 변경분 아님) |
| `npm run test:next-ride` | 222건 fail 0 (신설 계약 7건 포함, 기준선 215 → 222) |
| `npm run test:distance-auto-route` | 141건 fail 0 |
| `npm run test:ride-camera-framing` | 70건 fail 0 |
| `npm run test:sensor-cadence` | 46건 fail 0 |
| `node scripts/ride-verify/verify-selectors.mjs` | 11단계 전부 유효(신설 `cadence-chip-slot` 포함) |
| `npm --prefix functions run build` | exit 0 |
| `npm -w boxcycle-web run build` | exit 0 |
| `git diff --check` | clean |
| **`npm run test:e2e:sensor-chip`** (신설) | **2 passed** |
| `npm run test:e2e:route-dock` | 1 passed |
| `npm run test:e2e:ride` | 6 passed |
| `npm run test:e2e:account-panel` | 1 passed |

기존 e2e 는 전부 `getByRole('button',{name:/케이던스 센서/})` 를 쓴다 — **자리에 의존하지 않는 셀렉터**라 이동해도 그대로 통과했다. `ride-verify` 계약은 설명과 앵커만 갱신했고(칩 설명 + 슬롯 판정 단계 신설), 셀렉터 문자열은 바꾸지 않았다.

---

## 8. 감리 지시 중 정정할 것

### 8.1 §4.2 「헤더 행에 둔다」 — 현재 코드에서 §3.1 과 충돌

§1 에 적은 대로다. 헤더는 `hidden={!expanded}` 패널 안이라 **그 상태 그대로** 칩을 넣으면 주행 중 접는 순간 센서가 사라진다(§3.1 위반). **헤더 행 자체를 패널 밖으로 hoist** 해 두 요구를 모두 만족시켰다.

### 8.2 §4.3 「signed-out 에서 RouteDock 이 안 보이면」 — 전제가 빗나갔다

칩 표시는 `account` 와 무관하다. 실제 격차는 **`idle`**(경로 없음)이고, 이건 signed-out 보다 훨씬 자주 보이는 화면이다. §3 참조.

### 8.3 §7 「Go 를 밀어내지 마라」 — 이동은 불가피, 변형은 0

칩을 Go **왼쪽**에 두라는 §4.2 와, Go 를 밀지 말라는 §7 은 문자 그대로는 양립할 수 없다(왼쪽에 무언가를 넣으면 Go 의 x 는 반드시 커진다). §7 의 취지를 「**칩 때문에 Go 가 좁아지거나 줄바꿈되면 안 된다**」로 읽고, 그 쪽을 수치로 못 박았다 — Go 폭 0, 높이 0, 헤더 행 높이 0, **dock 폭·높이도 0**(§5).

### 8.4 §6 별도 worktree — 쓰지 않았다

메인 워크트리에 브랜치를 끊어 작업했다. Chief 의 라이더 교체·지도 릴레이 작업분(수정 4 + 미추적 10)은 **손대지 않았다**. `npm install` 도 돌리지 않았다(인수인계 §6 의 `three` 0.134 → 0.175 함정).

---

## 9. 자백 — 계측이 스스로를 속인 사고 1건

레이아웃 전후 비교용으로 넣은 임시 CSS 를 되돌릴 때 **내용 문자열로 `<style>` 태그를 골라 지웠다.** Vite dev 가 주입한 `CadenceHudChip.css` 도 같은 문자열(`hud-cadence--dock`)을 담고 있어서 **칩 스타일이 통째로 날아갔고**, 그 뒤 찍힌 스크린샷 전부에 스타일 없는 브라우저 기본 버튼(밝은 회색·검은 글자)이 찍혔다.

그런데 **위치·크기 assert 는 전부 통과했다** — 스타일이 사라져도 `align-items: stretch` 를 가진 부모 덕에 치수가 그럴듯했기 때문이다. 그림을 보지 않았으면 그대로 넘어갔다.

조치 두 가지:

1. `addStyleTag` 가 돌려준 **그 노드만** 지우도록 고쳤다.
2. 계측 자가 검산을 게이트로 세웠다 — 칩의 **computed `background`·`color`** 를 직접 단언한다. 칩 CSS 가 빠지면 이제 시험이 먼저 깨진다.

같은 줄기로 「dock 이 커지지 않는다」도 게이트가 됐다 — `shell.width/height` 가 칩 유무와 **정확히 같아야** 통과한다. 1차 시안(세로 컬럼)은 여기서 폭 +53px 로 깨진다.

---

## 10. 변경 파일

| 파일 | 변경 |
|---|---|
| `src/lib/route/sensorChipSlot.ts` | **신설** — 칩 자리 단일 판정 |
| `src/lib/route/routeDockUiPolicy.ts` | `isRouteDockVisible(stage)` 추출(표시 조건 단일 진실) |
| `src/components/maphud/CadenceHudChip.tsx` | `placement` prop · `CadenceChipBinding` 타입 공개 · 자체 CSS import |
| `src/components/maphud/CadenceHudChip.css` | **신설** — MapHud.css 에서 이관 + `--dock` 변형 |
| `src/components/maphud/MapHud.css` | `.hud-cadence*` 73줄 제거(이관) |
| `src/components/maphud/MapHud.tsx` | 우상단은 슬롯이 `"map-hud-tr"` 일 때만 |
| `src/components/route-dock/RouteDock.tsx` | `cadence` prop · 헤더 행을 접히는 본문 밖 `route-dock__top` 으로 hoist, 칩은 그 행 좌측 |
| `src/components/route-dock/RouteDock.css` | `__body`·`__top` 신설, 여백 재배분. anchor `max-width` 는 **불변**(dock 크기 유지) |
| `src/App.tsx` | `cadence={cadenceHud}` 결선 1줄 |
| `scripts/ride-hierarchy/sensor-chip-slot-contract.test.ts` | **신설** — 슬롯 + 소스 구조 계약 7건 |
| `scripts/ride-verify/entry-contract.mjs` | 칩 설명 갱신 + `cadence-chip-slot` 단계 신설 |
| `e2e/sensor-chip-route-dock-6a.spec.ts` | **신설** — 8조합·우상단 제거·시트 열림·실측 |
| `package.json` | `test:next-ride` 에 계약 추가 · `test:e2e:sensor-chip` 신설 |

`main2` 병합은 지시서 §7 대로 **감리/Chief 판단 대기**.
