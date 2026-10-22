# 결과09 — P5 안 쓰는 CSS 선택자 삭제

2026-10-22 · 담당 **opencode MiniMax M3.1 Flash** · 지시 [02-task-09.md](02-task-09.md) · 목록 [02-task-09-list.md](02-task-09-list.md)

대상: 목록(146개 클래스)에 든 CSS 파일 15개. 실행 폴더 `C:\20.HDev\boxcycle`.

목록에 있는 클래스를 **포함하는 선택자**만 지웠다. 목록에 없는 클래스·속성값·주석·줄 순서는 건드리지 않았다.

## 요약

| 항목 | 값 |
|---|---|
| 대상 파일 | 15개 (목록 클래스 146개) |
| **규칙 통째 삭제** | **194개** |
| **부분 삭제(선택자만)** | **2개 규칙 / 선택자 4개** |
| **제거한 선택자 합계** | **201개** |
| **같이 지운 주석** | **18개** |
| **같이 지운 빈 `@media`** | **2개** |
| 소스 줄 수 | 8,162 → 6,817 (**−1,345줄, −16.5%**) |
| 소스 바이트 | 204,738 → 176,961 (−27,777 B, −13.6%) |
| 번들 CSS(`dist/assets/index-*.css`) | `index-DjC7n-aQ.css` 230,534 B → `index-DIyGZOfs.css` 211,774 B (**−18,760 B, −8.1%**) |
| 빌드 | `npm run build --prefix ../..` → **exit 0** |

## 파일별

| 파일 | 목록 클래스 | 규칙 통째 삭제 | 부분 삭제 | 제거 선택자 | 규칙 수 전→후 | 줄 수 전→후 | Δ줄 | 바이트 전→후 |
|---|---|---|---|---|---|---|---|---|
| `src/App.css` | 24 | 28 | 0 | 30 | 56 → 28 | 377 → 200 | −177 | 6,767 → 3,799 |
| `src/boxcycle-theme.css` | 11 | 13 | 2 | 17 | 34 → 21 | 293 → 213 | −80 | 9,360 → 7,522 |
| `src/components/map/MapView.css` | 12 | 16 | 0 | 16 | 223 → 207 | 1,829 → 1,683 | −146 | 50,871 → 47,306 |
| `src/components/map/MapViewSheet.css` | 4 | 6 | 0 | 6 | 73 → 67 | 502 → 456 | −46 | 10,710 → 9,821 |
| `src/components/maphud/MapHud.css` | 22 | 36 | 0 | 36 | 200 → 164 | 1,712 → 1,446 | −266 | 47,576 → 41,398 |
| `src/components/MenuPlaceSearch.css` | 1 | 1 | 0 | 1 | 17 → 16 | 127 → 117 | −10 | 2,575 → 2,376 |
| `src/components/PublicRouteRequestModal.css` | 2 | 2 | 0 | 2 | 29 → 27 | 217 → 204 | −13 | 3,677 → 3,469 |
| `src/components/ride/RideRoutePanel.css` | 53 | 71 | 0 | 72 | 117 → 46 | 833 → 378 | −455 | 16,715 → 8,341 |
| `src/components/ride/RideSettingsSheet.css` | 1 | 1 | 0 | 1 | 45 → 44 | 325 → 320 | −5 | 7,193 → 7,119 |
| `src/components/ride/RideSummarySheet.css` | 1 | 1 | 0 | 1 | 71 → 70 | 631 → 624 | −7 | 15,339 → 15,231 |
| `src/components/ride/SavedRoutesPanel.css` | 2 | 2 | 0 | 2 | 65 → 63 | 545 → 532 | −13 | 13,741 → 13,467 |
| `src/components/sensor/CadenceSensorSheet.css` | 2 | 3 | 0 | 3 | 28 → 25 | 241 → 225 | −16 | 5,742 → 5,514 |
| `src/components/trail/TrailheadPresence.css` | 3 | 4 | 0 | 4 | 15 → 11 | 87 → 67 | −20 | 1,599 → 1,279 |
| `src/components/trail/TrailHubPanel.css` | 2 | 4 | 0 | 4 | 32 → 28 | 242 → 208 | −34 | 5,245 → 4,454 |
| `src/tokens.css` | 6 | 6 | 0 | 6 | 8 → 2 | 201 → 144 | −57 | 7,628 → 5,865 |
| **합계** | **146** | **194** | **2** | **201** | — | 8,162 → 6,817 | **−1,345** | 204,738 → 176,961 |

(규칙 수 = postcss `walkRules` 기준. `src/App.css` 의 규칙 2개와 `MapHud.css` 의 규칙 1개는 아래의 빈 `@media` 안에서 함께 지워졌다 — 위 표의 「규칙 통째 삭제」에 이미 포함.)

## 부분 삭제(쉼표로 묶인 선택자 목록) 2건

지시 2번 — 목록 클래스가 든 선택자만 빼고 남은 선택자·본문은 그대로 뒀다.

1. `src/boxcycle-theme.css` — 글래스 공통 그룹 (3개 선택자 제거)

   ```diff
    .hud-glass,
   -.hud-chip,
    .hud-brand,
    .hud-bc-trigger,
   -.hud-idle-hint,
    .hud-account,
    .hud-signin-pill,
    /* .hud-clock 은 2026-10-06 상자를 버리고 halo 글자만(MapHud.css) */
   -.hud-icon-btn,
   -.hud-metrics__chip {
   +.hud-icon-btn {
   ```

   그룹 안의 주석(`/* .hud-clock … */`)은 살아 있는 `.hud-icon-btn` 과 한 덩어리라 그대로 뒀다.

2. `src/boxcycle-theme.css` — 토스트/힌트 (1개 선택자 제거)

   ```diff
   -.hud-idle-hint,
   -.hud-world-hint {
   +.hud-world-hint {
   ```

목록 클래스가 **모든** 선택자에 들어 있던 묶음은 규칙 통째 삭제했다(아래 3건).

- `src/App.css` — `.fs-hint, .fs-ok, .fs-err { … }` (3개 모두 목록)
- `src/components/ride/RideRoutePanel.css` — `.ride-panel__public-courses-hint, .ride-panel__public-courses-error { … }` (2개 모두 목록)

## 지시 4번 — 목록 클래스가 어디에라도 든 선택자

`.live .dead` · `.dead:hover` · `.dead::before` · `.x.dead` 형태는 목록 클래스가 DOM 에 절대 안 나오므로 그 선택자 전체가 아무것에도 맞지 않는다. 그래서 함께 지웠다. 실제 히트:

| 파일 | 지운 선택자 |
|---|---|
| `App.css` | `.map-stage.map-stage--in-route` · `.ride-panel-host--mobile.is-open` · `.ride-panel-host--mobile .ride-panel` · `.route-main--mobile-map .map-stage--in-route` |
| `boxcycle-theme.css` | `.hud-action__btn--primary:hover` · `.hud-icon-btn--primary:hover` · `.hud-main-fab:hover` · `.hud-main-fab--pause:hover` |
| `MapView.css` | `.map-view__pick-meta-summary::-webkit-details-marker` · `.map-view__pick .map-view__pick-btn--route-enter:hover:not(:disabled)` · `.map-view__pick .map-view__pick-btn--route-back:hover:not(:disabled)` · `.map-view__auto-route-progress::after` |
| `MapHud.css` | `.hud-icon-btn--primary:hover` · `.hud-icon-btn--danger:hover` · `.hud-action__btn--primary:hover` · `.hud-action__btn--danger:hover` · `.hud-main-fab:hover` · `.hud-main-fab:disabled` · `.hud-main-fab--pause:hover` |
| `RideRoutePanel.css` | `.ride-panel__h:first-child` · `.ride-panel__point-item .ride-panel__point-label` · `.ride-panel__point-item .ride-panel__point-value` · `.ride-panel__route-action-row > .ride-panel__btn-primary` · `.ride-panel__mode--compact:disabled` · `.ride-panel__mode.is-active` · `.ride-panel__public-courses-list > li` · `.ride-panel__public-courses-item:hover:not(:disabled)` · `:focus-visible` · `.is-selected` · `:active:not(:disabled)` · `:disabled` · `.ride-panel__route-token strong` · `.ride-panel__ble-cadence-copy .ride-panel__help--tight` · `.ride-panel__media-toggles .ride-panel__kicker` · `.ride-panel__toggle input` · `.ride-panel .saved-routes__btn--accent:disabled` |
| `CadenceSensorSheet.css` | `.cadence-sheet__mode strong` |
| `TrailheadPresence.css` | `.trailhead-presence__err-hint code` |

## 같이 지운 주석 18개

기준: **바로 위 주석이 설명하는 규칙이 하나도 남지 않으면** 함께 지웠다. 살아남은 규칙을 설명하는 주석은 남겼다.

| 파일 | 지운 주석(원문 시작) | 사유 |
|---|---|---|
| `boxcycle-theme.css` | 「지표 캡슐·셀 스타일은 MapHud.css 가 소유… Trail 배지 칩 폰트만…」 | `.hud-metrics__chip` 규칙만 설명 |
| `MapView.css` | 「260527 Phase A–C — Mapbox circle 실패 시 WORLD_LIGHT DOM 폴백」 | `.map-debug-world-light-marker` 규칙만 설명 |
| `MapView.css` | 「재지시35 — '거리 ›' 진입… 44px는 이 버튼만…」 | route-enter 규칙(+hover)만 설명 |
| `MapView.css` | 「재지시35 — 거리 화면 상단. '‹ 위치 선택' 복귀 + 제목 한 행…」 | 설명하던 4규칙(distance-head·route-back·route-back:hover·distance-title)이 전부 삭제됨 |
| `MapViewSheet.css` | 「주행 중 거리뷰 창 on/off — 기본 꺼짐」 | `.map-view-sheet__toggle` 계열 3규칙만 설명 |
| `MapHud.css` | 「주행 종료는 DOM 상 뒤지만 column-reverse 로…」 | `.map-hud__br-main` 규칙만 설명 |
| `MapHud.css` | 「일시정지 딤 레이어 — z-index 를 올리면…」 | `.map-hud__scrim` 규칙만 설명 |
| `MapHud.css` | 「Trail 배지 칩(캡슐 밖 컨텍스트 배지)」 | `.hud-metrics__chip` 규칙만 설명 |
| `MapHud.css` | 「---------- BR: 큰 메인 FAB ----------」 | 설명하던 6규칙이 전부 삭제됨 → 고아 배너 |
| `MapHud.css` | 「---------- 첫 진입 안내 토스트 ----------」 | `.hud-idle-hint` 규칙만 설명 |
| `MapHud.css` | 「Trail 번호 배지 — MENU 의 TRAIL 행과 중복이고…」 | `.hud-metrics__chip--trail` 규칙만 설명 |
| `RideRoutePanel.css` | 「카드 전체 탭 → 코스 불러오기」 | `.ride-panel__public-courses-item` 계열만 설명 |
| `TrailHubPanel.css` | 「현재 위치 라벨 — 아래 액션 버튼들의 머리글(대상) 역할」 | `.trail-hub__current-id--compact` 규칙만 설명 |
| `tokens.css` | 「Trace 라인 공통 스타일 (SVG path 용…)」 | `.rtw-trace-line` 규칙만 설명 |
| `tokens.css` | 「반투명 다크 패널 공통 (HUD, 사이드 메뉴, 바텀시트 전부 동일 톤)」 | `.rtw-panel` 규칙만 설명 |
| `tokens.css` | 「Primary 액션 버튼 (Go, 저장, START 등…)」 | `.rtw-btn-primary` 규칙만 설명 |
| `tokens.css` | 「Secondary 버튼 (중립 톤)」 | `.rtw-btn-secondary` 규칙만 설명 |
| `tokens.css` | 「Danger 버튼 (로그아웃, 삭제, 종료 등 위험/파괴적 액션 전용)」 | `.rtw-btn-danger` 규칙만 설명 |

## 같이 지운 빈 `@media` 2개

- `src/App.css` — `@media (max-width: 720px) { … }` (안의 `.route-main--mobile-map` · `.route-main--mobile-map .map-stage--in-route` 가 지워져 통째로 제거)
- `src/components/maphud/MapHud.css` — `@media (max-width: 480px) { .hud-aux__panel { … } }` (유일한 규칙이 지워져 통째로 제거)

`@media (max-width: 640px)` · `@media (max-height: 560px)` 등 **살아 있는 규칙이 남은 블록은 그대로** 뒀다. `@supports`·`@container` 는 대상 파일에 없었다.

## 판단이 애매해 남긴 것과 이유

1. **`src/boxcycle-theme.css` 「8) BR — 메인 FAB (시작 / 일시정지)」 섹션 배너 — 남김.**
   이 배너가 설명하던 BR FAB 규칙들은 전부 지워졌지만, 같은 섹션에 `.hud-icon-btn:focus-visible` 이 살아 있어 배너가 완전히 고아가 되지 않는다. 또 이 파일은 `1) … 12)` 번호 섹션 구조라 배너를 지우면 번호가 깨진다. 지시 문구(「그 규칙 **만** 설명하면」)에도 어긋나지 않으므로 남겼다. 감리 판단이 다르면 여기만 손보면 된다.

2. **`src/boxcycle-theme.css` 「11) 토스트 / 힌트」 섹션 배너 — 남김.**
   같은 이유. `.hud-world-hint` 규칙이 살아 있어 배너가 설명할 대상이 남는다.

3. **`src/components/maphud/MapHud.css` 「---------- BR: 큰 메인 FAB ----------」 — 지웠다.**
   지시 문구는 「그 규칙 **만** 설명하면」이라 여러 규칙을 묶던 배너는 남길 수도 있지만, 이 배너가 설명하던 6개 규칙이 하나도 남지 않아 순수 고아가 된다. 두 배너가 연달아 고아로 남는 것보다 지우는 편이 맞다고 판단했다. **판단이 갈릴 수 있는 지점이라 감리 확인을 요청한다.**

4. **`src/components/maphud/MapHud.css` 「---------- 첫 진입 안내 토스트 ----------」 — 지웠다.**
   `.hud-idle-hint` 규칙 하나만 설명하던 배너라 지시 문구를 그대로 적용했다.

5. **`@keyframes map-view-auto-route-progress` (`MapView.css`) — 남김.**
   지시에서 `@keyframes` 는 건드리지 말라 명시했다. 다만 `.map-view__auto-route-progress` 규칙이 지워져 이 키프레임은 이제 참조되지 않는다(쓰지 않는 `@keyframes` 정리 후보로 남긴다).

6. **CSS 변수 — 전부 남김.**
   `:root` 의 `--rtw-*`, `.map-hud` 의 `--hud-main-fab-size`, `.ride-panel` 의 `--rp-*` 등 지시에서 명시적으로 손대지 말라 한 변수류는 규칙이 지워져도 그대로 뒀다. 지워진 규칙에서만 쓰이던 `--rtw-map-text-keyline` 류도 남았다.

7. **`src/App.css` 맨 끝의 주석 블록(「폰 가로 — 거리뷰 창이 화면 위로 넘쳐…」) — 남김.**
   원본에도 이 주석만 있고 뒤따르는 규칙이 없는 상태였다(정상 상태 아님). 범위 밖이라 손대지 않았다.

8. **`src/components/ride/RideRoutePanel.css` 의 `.ride-panel__official-*` 계열 — 남김.**
   목록에 없는 클래스라 그대로 뒀다. 같은 파일의 `.ride-panel__public-courses-*` 가 목록에 있어 삭제됐으므로, 이 둘은 화면상 별개 UI인지 **감리 확인이 필요할 수 있다**(목록 생성기의 오탐 여부).

## 금지 항목 준수

- 목록에 없는 클래스·파일은 **한 건도** 수정하지 않았다(CSS 15개 파일 외 0건).
- 속성값 변경·포맷 정리·줄 순서 변경 없음. 남은 선택자와 본문은 원문 그대로다(묶음 선택자에서 줄만 빠질 때는 줄바꿈까지 보존).
- `:root` 변수·`@keyframes`·`@font-face` 손대지 않음.
- TS/TSX·시험·설정 파일 수정 없음. **git commit·push·stash·checkout·restore·clean·worktree 도 쓰지 않았다.**(git 은 `status`·`diff` 조회만)
- 화면 시험은 감리 몫이라 실행하지 않았다.

## 검증

기계 검사(사전 목록을 목록 파일에서 그대로 읽어 다시 대조):

```
src/App.css: rules=28 …            (15개 파일 전부 postcss 파싱 성공)
VERIFY OK — 남은 목록 클래스/빈 at-rule 0건
```

- 목록에 든 클래스가 **남아 있는 선택자 0건**(postcss 로 전체 규칙을 다시 훑어 확인).
- 비어 버린 `@media`·`@supports`·`@container` **0건**.
- 15개 파일 전부 postcss 파싱 성공. 인코딩(UTF-8 무 BOM)·줄바꿈(CRLF)·마지막 개행 상태 모두 원본 그대로다. `App.css` 만 원본처럼 마지막 줄에 개행이 없다(원본도 동일).

빌드 (`apps/web` 에서):

```
npm run build --prefix ../..
```

```
dist/assets/index-DIyGZOfs.css                 211.77 kB ??gzip:    34.90 kB
dist/assets/index-LUsWKtny.js                3,737.12 kB ??gzip: 1,053.94 kB

??built in 2.07s
```

- **exit code 0** — 빌드 성공. (마지막 줄은 vite 의 청크 경고 3줄이고, 실제 빌드 완료 표시는 `✓ built in 2.07s`.)
- 청크 크기 경고(`> 500 kB`)는 **정리 전에도 있던 기존 경고**다. CSS 청크는 230,534 B → 211,774 B 로 **−18,760 B(−8.1%)**.

### 동시 작업 메모 (범위 밖)

작업 중 같은 트리에서 **다른 묶음(800×360 UI 묶음)** 이 `src/components/map/MapView.tsx` · `mapPopupElements.ts` · 신규 `mapMarkerElements.ts` 를 고치고 있었다. 첫 빌드가 `TS2304: Cannot find name 'useAssignRef'` 로 실패했으나, 원인은 그쪽이 `useAssignRef.ts` 를 쓰는 도중이라 `tsc` 가 파일을 읽는 타이밍이 어긋난 것이었다(동일 시각에 쓰인 파일 2개가 확인됨). 그쪽 쓰기가 끝난 뒤 재실행 → exit 0. **이 파일들은 내가 건드리지 않았다.** 감리 검증 시 같은 트리에서 다시 빌드하면 이 Racing 이 재현될 수 있으니 주의.

## 복사해 실행할 명령어

```
cd /d C:\20.HDev\boxcycle\apps\web
npm run build --prefix ../..
```

확인 순서:

1. 위 명령으로 빌드 성공(exit 0) 확인.
2. `cd /d C:\20.HDev\boxcycle` → `git diff -- apps/web/src` 로 CSS 15개 파일의 삭제만 확인(추가·수정은 없어야 한다).
3. `git diff --numstat -- "apps/web/src/*.css" "apps/web/src/components/**/*.css"` → 삽입은 `boxcycle-theme.css` 의 1줄(묶음 선택자에서 죽은 선택자 3줄 뺀 결과)뿐, 나머지는 전부 삭제.
4. 화면(3폭 캡처)은 감리 몫 — `npm run dev` 후 667·740·844 폭에서 주요 상태를 정리 전 캡처와 나란히 비교하면 된다.

## 바꾼 파일 (15개, 전부 CSS)

```
apps/web/src/App.css
apps/web/src/boxcycle-theme.css
apps/web/src/tokens.css
apps/web/src/components/MenuPlaceSearch.css
apps/web/src/components/PublicRouteRequestModal.css
apps/web/src/components/map/MapView.css
apps/web/src/components/map/MapViewSheet.css
apps/web/src/components/maphud/MapHud.css
apps/web/src/components/ride/RideRoutePanel.css
apps/web/src/components/ride/RideSettingsSheet.css
apps/web/src/components/ride/RideSummarySheet.css
apps/web/src/components/ride/SavedRoutesPanel.css
apps/web/src/components/sensor/CadenceSensorSheet.css
apps/web/src/components/trail/TrailHubPanel.css
apps/web/src/components/trail/TrailheadPresence.css
```
