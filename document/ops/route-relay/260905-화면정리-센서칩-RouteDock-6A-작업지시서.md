# 화면 정리 — 센서 칩을 RouteDock 으로 6A 작업지시서

| 항목 | 내용 |
|---|---|
| 문서 유형 | **실행 — UI 표면 정리 1단계** |
| 최초 작성 | 2026-09-05 |
| 상태 | **즉시 실행** |
| 작업 ID | `UI-DECLUTTER-SENSOR-6A` |
| base | `main2` (`dde2048`, 배포 반영됨) |
| 발견 | Chief — 「앱 화면에 버튼과 창이 너무 많아 혼잡스럽다」 |

## 1. 지시

> 센서 버튼을 route dock 안으로 넣어야겠다. (Chief)

## 2. 근거 — 워크플로가 맞는다

`Go`(주행 시작)는 `RouteDock.tsx:174` 에 있고, 센서는 **Go 를 누르기 전에 준비돼야 하는 것**이다. 지금은 준비물이 화면 양쪽 끝에 갈라져 있다.

```
지금   우상단 [CAD 칩] [계정]        ↔  하단좌 RouteDock [Go]
이후   RouteDock  [센서] … [Go]      — 준비물이 한 곳
```

`resolveRideInputReadiness`·`isRideInputReady` 가 이미 「입력 준비」를 판정하고 있으므로 개념도 맞는다.

## 3. 제약 — 주행 중에도 보여야 한다

`RouteDock.tsx:50`

```ts
const visible = stage === "setup" || stage === "ready-to-start" || stage === "riding" || stage === "paused";
```

**RouteDock 은 주행 중에도 보인다.** 이동해도 rpm·연결 상태가 사라지지 않는다. 다만 두 가지를 지켜야 한다.

1. **접힘 상태에서도 센서가 보여야 한다.** dock 본문은 `expanded` 로 접힌다(`:164 hidden={!expanded}`). 센서 칩을 **접히는 본문 안에 넣지 마라.** 헤더 행처럼 항상 보이는 자리에 둔다.
2. **주행 중 상태 변화가 즉시 보여야 한다.** 센서가 끊기면 주행이 멈추므로 그 신호가 가려지면 안 된다.

## 4. 수정

### 4.1 이동

- `CadenceHudChip` 을 `MapHud` 의 `map-hud__tr`(우상단 행)에서 **제거**하고 `RouteDock` 으로 옮긴다.
- 우상단에는 **계정 칩과 맵 버튼만** 남는다.
- 클릭 시 센서 시트(`CadenceSensorSheet`)가 열리는 동작은 **그대로 유지**한다.
- rpm 표시·연결 상태 색·`aria-label` 등 칩의 기존 계약을 바꾸지 않는다. **위치만 옮기는 작업이다.**

### 4.2 배치

`RouteDock` 헤더 행에 둔다. `Go` 와 같은 시선 안에 들어와야 한다 — 「센서 준비됨 → Go」가 한눈에 읽혀야 한다.

폰 가로에서 dock 폭이 좁으므로 **칩이 줄바꿈을 유발하거나 `Go` 를 밀어내면 안 된다.** 공간이 부족하면 rpm 숫자를 줄이는 쪽을 택하고 `Go` 를 건드리지 마라.

### 4.3 signed-out 처리

`MapHud.tsx:234` 주석에 「센서 상태는 계정 데이터에 종속되지 않는다 — signed-out 맵 모드에서도 남는다」고 돼 있다. RouteDock 이 그 상태에서 보이지 않는다면 **센서 칩이 사라진다.**

- signed-out·맵 전용 모드에서 RouteDock 의 표시 여부를 확인하고, 안 보이면 그 경우에만 우상단 폴백을 남길지 판단하라.
- **확인 결과와 판단 근거를 REPORT 에 적어라.** 추정하지 마라.

## 5. 시험

1. **표시 불변식** — `setup`·`ready-to-start`·`riding`·`paused` 네 stage 와 dock **접힘/펼침** 두 상태, 총 8 조합에서 센서 칩이 보이는지 순수 함수 또는 렌더 시험으로 assert.
2. **우상단 제거** — `map-hud__tr` 에 센서 칩이 없음을 assert. 계정 칩·맵 버튼은 남아 있음.
3. **동작 보존** — 클릭 시 센서 시트가 열리는 경로가 유지되는지.
4. **레이아웃** — 폰 가로 폭에서 `Go` 가 밀려나거나 줄바꿈이 생기지 않는지. 실측 px 로 보고.
5. 빠른 회귀만.

```
npm -w boxcycle-web run test:next-ride
npm -w boxcycle-web run test:distance-auto-route
npm -w boxcycle-web run test:ride-camera-framing
npm --prefix functions run build
npm -w boxcycle-web run build
git diff --check
```

브라우저 e2e 는 수용 게이트 1회. `ride-verify` Skill 의 진입 시퀀스가 센서 칩 셀렉터에 의존하면 **함께 고쳐라**(위치가 바뀌었으므로 정상적인 수정이다).

## 6. 실행 준비

```text
git -C C:\20.HDev\boxcycle worktree add C:\20.HDev\boxcycle-6a -b fix/ui-declutter-6a main2
copy C:\20.HDev\boxcycle\apps\web\.env       C:\20.HDev\boxcycle-6a\apps\web\
copy C:\20.HDev\boxcycle\apps\web\.env.local C:\20.HDev\boxcycle-6a\apps\web\
cd C:\20.HDev\boxcycle-6a
npm install
npm --prefix functions install
```

`.env` 복사와 `npm --prefix functions install` 을 빠뜨리면 각각 「Firebase 설정 필요」와 `Cannot find module` 로 막힌다.

## 7. 금지·경계

- **칩의 기능을 바꾸지 마라.** 위치 이동이다. rpm 표기·상태 색·시트 열기 동작을 그대로 옮긴다.
- **`Go` 를 밀어내지 마라.** 공간 부족은 칩 쪽에서 해결한다.
- **접히는 본문 안에 넣지 마라.** 주행 중 접어도 보여야 한다.
- 다른 표면(지명 버튼·지도 컨트롤·접속 패널 등)을 **이번에 건드리지 마라.** 별도 판단 대기 중이다(§8).
- 기존 commit 을 amend·reset·rebase 하지 마라. `main2` 병합은 감리가 한다.

## 8. 범위 밖 — Chief 판단 대기

Chief 의 「버튼과 창이 너무 많다」는 이 한 건으로 끝나지 않는다. 감리가 화면에서 센 표면은 **8 덩어리**다.

| 위치 | 표면 |
|---|---|
| 좌상 | RTW 버튼 · 지명 버튼 · 접속 Trailhead 패널 |
| 상중 | HUD 지표 행 |
| 우상 | 센서 칩 · 계정 칩 · 맵 버튼 |
| 우측 | 지도 컨트롤 4개 |
| 좌중 | 핀 팝업 |
| 하좌 | RouteDock |
| 하중 | 주행 결과 시트 |
| 하우 | 정지 · 일시정지 |

**이번 작업은 「우상 3개 → 2개」 하나뿐이다.** 나머지는 Chief 가 우선순위를 정한 뒤 별도 지시한다. **선제적으로 손대지 마라.**

## 9. 보고

- §4.1 이동 결과 · 우상단 잔여 요소
- §4.3 signed-out 확인 결과와 판단 근거
- §5.1 8 조합 표시 불변식 결과
- §5.4 폰 가로 폭 실측 — `Go` 위치 전후 비교
- 화면 증거(주행 전·주행 중·접힘 상태)
- **감리 지시 중 틀린 것이 있으면 수치와 함께 지적하라.**
