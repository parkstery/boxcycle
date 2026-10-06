# 결과 12 — 우하단: 시계 ↓ · 다음 주행 카드 ↑ · 고도/축척 박스 고정

- 담당: Developer(Cursor CLI) · 지시: `02-task-12.md`
- 판정: **DEVELOPMENT_DONE** · 커밋·푸시 없음
- worktree / `git restore` / `git clean` / stash / `.env*`: **미사용·미수정**
- 병행 금지 파일(`App.tsx`·`MapHud.tsx`·`camera1Mode.ts`): **미수정**

## 택한 해법

1. **공유 토큰** (`.app-shell--map-first` in `MapView.css`): `--br-clock-above-scale` · `--br-clock-height` · `--br-card-above-clock` · 고도/축척 박스 고정 폭·높이.
2. **시계** (`MapHud.css`): `bottom = pad + --br-clock-above-scale`(기본 `0.55rem`, `min-height≥501px` 이면 `0.15rem`) — 고도/축척 행에 4~6px 간격.
3. **다음 주행 카드** (`NextRideCard.css`): `bottom = pad + clock-above + clock-height + 8px` — 시계 위. 짧은 뷰포트에서 `logo-clearance`로 내리던 동작 제거(06-4 거터 `padding-right`는 유지).
4. **고도/축척 박스** (`MapView.css`): 고도 74×16px 고정 + `tabular-nums`. 축척 바깥 박스 120×16px 고정(`width !important`로 Mapbox inline 폭 덮음). CSS-only라 막대 길이는 박스와 동일 폭(라벨 숫자는 줌에 따라 갱신).
5. **폰 가로**: `max-height:300px` 에서 `.map-view { min-height: 0 }` — 기존 `min-height:320` 이 275 뷰포트에서 고도/축척을 화면 아래로 밀던 문제 해제.
6. **e2e**: 「카드 아래 끝 = RouteDock 아래 끝」→ **카드 아래 끝 < 시계 위 끝 − 8**(Chief 우선).

## 변경 파일

| 파일 | 내용 |
|---|---|
| `apps/web/src/components/map/MapView.css` | `--br-*` · 고도/축척 박스 고정 · short min-height 해제 · tall clock offset |
| `apps/web/src/components/maphud/MapHud.css` | `.hud-clock` bottom/height 토큰 |
| `apps/web/src/components/ride/NextRideCard.css` | 카드 bottom = 시계 위 8px · short clearance 제거 · 거터 유지 |
| `apps/web/e2e/ride-summary-compact.spec.ts` | 카드↔시계 단언 교체(겹침·reachable 유지) |
| ops `shots-12/` · `03-result-12.md` | 계측·촬영·본 결과 |

## e2e 단언 교체 (명시)

| 전 | 후 | 이유 |
|---|---|---|
| `card.bottom ≈ dock.bottom` | `card.bottom < clock.top − 8` | 종전 정렬이 카드를 시계 대역에 올려 겹침. Chief(2026-10-06): 카드를 시계 위로 |

다른 단언(우상단 TR 정렬·ctrl reachable·dock 부동)은 그대로.

## 검증

| 명령 | exit | 결과 |
|---|---|---|
| `cd apps/web && npx tsc -b --noEmit` | 0 | **0** |
| 「다음 주행 카드 자리」(`ride-summary-compact.spec.ts:459`) | 0 | **1 passed** (~40s) · 기존 에뮬레이터 attach · `RTW_DEV_PORT=5012` |
| `menu-declutter-a` (= `test:e2e:menu-a` 본문) | 0 | **1 passed** (~16s) |
| 임시 계측 `_tmp-bottom-right-stack-12` | 0 | **1 passed**. 실행 후 **삭제** |

참고: 병행 에이전트(지시11·resume-finish)가 8080을 점유해 `emulators:exec` 단독 기동이 반복 실패함. 이미 LISTEN 중인 에뮬레이터에 env attach 로 검증. 1회 menu-a 는 auth 일시 불가로 timeout(본 CSS 무관) — 재실행 PASS.

## 계측 (출처: `shots-12/12-stack-metrics.json`)

### 대기 + 다음 주행 카드

| 뷰포트 | card∩clock | card∩ctrl | card→clock gap | clock→고도/축척 |
|---|---|---|---|---|
| 690×275 | **0** | **0** | **8.02** | **4.45** |
| 740×360 | **0** | **0** | **8.02** | **5.16** |
| 1000×640 | **0** | **0** | **8.00** | **4.00** |

### 주행 중 줌 3단 · 박스 폭

| 뷰포트 | altitude Δw | scale Δw |
|---|---|---|
| 690×275 | **0** | **0** |
| 1000×640 | **0** | **0** |

## 촬영

디렉터리: `document/ops/20261006-bottom-right-stack/shots-12/`

| 그림 | file:/// |
|---|---|
| 690 idle + 다음 주행 | file:///C:/20.HDev/boxcycle/document/ops/20261006-bottom-right-stack/shots-12/690x275-idle-next-ride.png |
| 740 idle + 다음 주행 | file:///C:/20.HDev/boxcycle/document/ops/20261006-bottom-right-stack/shots-12/740x360-idle-next-ride.png |
| 1000 idle + 다음 주행 | file:///C:/20.HDev/boxcycle/document/ops/20261006-bottom-right-stack/shots-12/1000x640-idle-next-ride.png |
| 690 주행 줌 | file:///C:/20.HDev/boxcycle/document/ops/20261006-bottom-right-stack/shots-12/690x275-riding-zoom.png |
| 1000 주행 줌 | file:///C:/20.HDev/boxcycle/document/ops/20261006-bottom-right-stack/shots-12/1000x640-riding-zoom.png |
| 계측 JSON | file:///C:/20.HDev/boxcycle/document/ops/20261006-bottom-right-stack/shots-12/12-stack-metrics.json |

## 한계

- 축척: CSS-only로 바깥 박스=막대 요소라 `width:120px !important` 시 막대도 고정. 라벨(「300 m」등)은 줌에 따라 갱신. 박스 안 가변 막대는 TS wrapper 필요(허용 외).
- 06-4 Mapbox ctrl 오른쪽 가장자리·카드 거터 유지.

## Git

커밋·푸시 **하지 않음**. 허용 파일 + ops 결과·`shots-12/` 만 본 작업 산출.
