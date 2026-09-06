# 화면 정리 — 센서 칩 RouteDock 6A-R2 작업지시서

| 항목 | 내용 |
|---|---|
| 문서 유형 | **실행 — Chief 화면 판정 후 재작업** |
| 최초 작성 | 2026-09-06 |
| 상태 | **즉시 실행** |
| 작업 ID | `UI-DECLUTTER-SENSOR-6A-R2` |
| base | `fix/ui-declutter-6a` (`d3f7bb3` 위에 이어서) |
| 발견 | Chief 실화면 판정 (2026-09-06) |

## 1. Chief 지적 — 3건

> 1. 센서 버튼이 초기에는 계정 버튼 좌측에 보이다가 route dock 이 팝업되면 route dock 안으로 **이동**한다.
> 2. 이 배치로 route dock 의 **공간 낭비가 매우 크다.** 센서 버튼을 좌측이 아닌 **상단**에 배치하라.
> 3. route dock 은 경로 설정이 되어야 뜨는데 **평소에도 항상 화면에 보이도록** 하라. 그러면 상단 계정 옆 센서 칩은 **완전히 제거**된다.

세 지적은 하나의 설계로 수렴한다. **센서 칩의 집은 RouteDock 상단 바 하나뿐이고, RouteDock 은 평소에도 떠 있다.**

## 2. 원인 — 「좌측 세로 스트립」은 CSS 구조의 결과다

`RouteDock.css:21`

```css
.route-dock__shell {
  display: flex;
  flex-direction: row;      /* ← 가로 배치 */
  align-items: stretch;     /* ← 자식이 패널 높이만큼 늘어남 */
}
```

`shell` 이 가로 행이므로 `[caret] [sensor-rail] [panel]` 이 좌→우로 늘어서고, `align-items: stretch` 때문에 **센서 레일이 패널 전체 높이의 세로 칸을 통째로 차지**한다. 칩은 그 안에서 `align-self: center` 로 떠 있을 뿐이다. Chief 화면에서 CAD 칩 하나가 dock 가로폭의 1/4 이상을 먹는 이유가 이것이다.

**칩 크기를 줄여서 해결할 문제가 아니다. 축을 바꿔야 한다.**

## 3. 수정

### 3.1 레이아웃 — shell 을 세로로, 상단 바를 만든다

```
지금                          이후
┌──┬────┬─────────────┐      ┌──────────────────────┐
│  │    │ Go 저장 삭제 │      │ ● CAD            ⌃  │ ← 항상 보임
│ ⌃│CAD │ S 봉은사     │      ├──────────────────────┤
│  │    │ E 논현로     │      │ Go   저장  삭제      │ ← 접힘 대상
└──┴────┴─────────────┘      │ S 봉은사 / E 논현로  │
                             └──────────────────────┘
```

- `shell` 을 `flex-direction: column` 으로 바꾼다.
- **상단 바**(새 요소)에 센서 칩과 접기 caret 을 넣는다. 이 바는 `hidden` 대상이 아니다 — 항상 보인다.
- 그 아래에 기존 `route-dock__panel`(`hidden={!expanded}`)을 그대로 둔다.
- 상단 바 높이는 **칩 높이 + 패딩**이면 된다. 패널 높이를 따라가지 않게 하라.
- 현재 좌측 세로 스트립(`route-dock__caret` 의 세로 배치, `route-dock__sensor-rail`)은 **제거**한다. §4 폰 가로 축소 규칙도 세로 축 기준으로 다시 정리하라.

### 3.2 항상 표시 — `idle` 을 추가한다

`routeDockVisibility.ts` 의 `isRouteDockStageVisible` 에 **`idle` 을 추가**한다.

```
gate · gate-nickname · idle · setup · ready-to-start · riding · paused · summary
                       ^^^^ 추가          기존 4개 유지
```

`gate`·`gate-nickname`·`summary` 는 **제외한다.** 근거 — 그 세 stage 에서는 **지금도 센서 칩이 숨겨져 있다**(`MapHud.tsx:235` `!isGate && !isSummary`). 제외해도 회귀가 아니라 현행 유지다. 인증 카드/결과 시트가 화면을 점유하는 단계에 경로 dock 을 띄우는 것은 Chief 의 「정리」 지시와 반대다.

**다르게 판단할 근거를 찾으면 수치·화면과 함께 보고하고 그대로 진행하지 마라.**

### 3.3 `idle` 기본 접힘

`idle` 에서 패널이 펼쳐진 채 뜨면 빈 `Go`·저장·삭제·「지도를 탭해 출발·도착 설정」이 상시 노출된다. **정리가 아니라 클러터 추가다.**

- `idle` 진입 시 dock 은 **접힌 상태**(상단 바만) 로 보인다.
- 핀이 찍혀 stop 이 생기면 **기존 자동 펼침 로직**(`RouteDock.tsx:80` `visible && stops.length > 0`)이 그대로 작동해야 한다.
- **저장 경로를 로드해 곧바로 `ready-to-start` 로 들어가는 경로**도 펼쳐지는지 확인하라. `stops.length` 가 변하지 않는 마운트 경로가 있으면 접힌 채로 나온다.

### 3.4 MapHud 우상단 센서 칩 — 완전 제거

Chief: 「완전히 route dock 안으로 이동」. **폴백을 남기지 마라.**

- `MapHud.tsx` 의 `CadenceHudChip` 렌더·import·`showCadenceChip` 을 제거한다.
- `resolveCadenceChipSurface`(이중 표면 헬퍼)를 **삭제**한다. 표면이 하나뿐이면 존재 이유가 없다.
- `MapHud` 의 `cadence` prop 이 다른 용도로 쓰이지 않으면 **prop 자체를 제거**하고 `App.tsx` 호출부도 정리하라. 남아 있으면 왜 남겼는지 보고하라.
- 우상단에는 **계정 칩과 맵 버튼만** 남는다.

## 4. 시험

1. **표면 단일성** — `MapHud` 렌더 결과에 센서 칩이 **어떤 stage 에서도 없음**을 assert. 「stage 에 따라 자리를 옮긴다」가 사라졌는지 확인하는 시험이다.
2. **표시 불변식** — `idle`·`setup`·`ready-to-start`·`riding`·`paused` 5 stage × 접힘/펼침 = **10 조합**에서 센서 칩이 보이는지 assert. 기존 `cadence-chip-visibility-contract.test.ts` 를 8→10 조합으로 확장한다.
3. **비표시** — `gate`·`gate-nickname`·`summary` 에서 dock 과 센서 칩이 **둘 다 없음**을 assert.
4. **접힘 기본값** — `idle` 진입 시 접힘, stop 추가 시 펼침, 저장 경로 로드 시 펼침(§3.3).
5. **레이아웃 실측** — 폰 가로에서 dock 의 **가로폭·높이를 수정 전후 px 로 비교**해 보고하라. §2 의 공간 낭비가 실제로 줄었는지가 이번 작업의 판정 기준이다.
6. `ride-verify` 의 `entry-contract.mjs` 는 6A 에서 이미 한 번 고쳤다. **`idle` 에서 dock 이 뜨게 되므로 진입 시퀀스 전제가 또 바뀐다.** 다시 확인하고 필요하면 고쳐라.

```
npm -w boxcycle-web run test:next-ride
npm -w boxcycle-web run test:distance-auto-route
npm --prefix functions run build
npm -w boxcycle-web run build
git diff --check
```

브라우저 e2e 는 수용 게이트 1회.

## 5. 금지·경계

- **칩의 기능을 바꾸지 마라.** rpm 표기·상태 색·시트 열기 동작은 그대로다. 이번에도 **배치 작업**이다.
- **폴백을 남기지 마라.** 「dock 이 없을 때만 우상단」 같은 조건부는 Chief 가 제거하라고 한 바로 그 동작이다.
- **`Go` 를 밀어내지 마라.**
- `d3f7bb3` 을 amend·reset 하지 마라. 그 위에 커밋을 쌓아라. `main2` 병합은 감리가 한다.
- §8(다른 표면 7덩어리)은 여전히 **범위 밖**이다. 6A 작업지시서 §8 그대로.

## 6. 보고

- §3.1 전후 구조 — DOM 계층과 CSS 축 변경
- §3.2 `idle` 추가 결과, `gate`/`summary` 제외 판단에 이견이 있으면 근거
- §3.3 세 경로(idle 진입·핀 추가·저장 경로 로드) 각각의 접힘/펼침 결과
- §3.4 제거 범위 — `cadence` prop 까지 지웠는지, 못 지웠으면 이유
- §4.5 **폰 가로 dock 가로폭·높이 수정 전후 px**
- 화면 증거 — `idle` 접힘 / `ready-to-start` 펼침 / `riding` 접힘, 그리고 **우상단**(칩이 없어야 함)
- **감리 지시 중 틀린 것이 있으면 수치와 함께 지적하라.**
