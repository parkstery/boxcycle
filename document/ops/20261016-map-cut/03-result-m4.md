# 결과 M4 — 새 기본 글자 모드 `names` + perflab 패널 위치

| 항목 | 내용 |
|---|---|
| 지시 | `document/ops/20261016-map-cut/02-task-m4.md` (Supervisor Claude, 2026-10-16) |
| 수행 | Developer (OpenCode Muse Spark), 작업 위치 `C:\20.HDev\boxcycle-names`, 브랜치 `feat/ride-label-names` (기준 `main2` `29b1300`) |
| 상태 | 완료 (commit·push·배포 없음, dev 서버·브라우저 종료, 백그라운드 잔류 없음) |

## 1. 구현

- `apps/web/src/lib/map/rideLabels.ts` (도메인 `map`, 기존 등록 유지 — 신규 lib 파일 없음):
  - 모드 `?labelmode=names|both|near|major|all|none` (`parseRideLabelMode`, 없음·잘못된 값 → **`names`**). 기존 5개 모드는 비교용으로 그대로 유지.
  - **`isDecorativeSymbolLayer` 신규** — 이름 레이어를 먼저 가려내어 `false`(유지)로 돌려보낸 뒤, M3 `MAJOR_MINOR_ID_PATTERNS`(방패·화살표·횡단보도·출입구·지번·블록번호·교차로·게이트·등고선·보행로·골프·여객선·transit 등)를 재사용. 소스 판정도 이름 우선(`place_label`·`natural_label`·`airport_label`·`poi_label` 유지, `road` 는 `road-label` 만 유지). **모르는 것(패턴·소스 모두 해당 없음)은 이름일 수 있으니 숨기지 않음** (M3 `isMajorKeptLabelLayer` 와 반대 — M3 는 모르면 숨김).
  - 이름 판정 id 패턴: `road-label`, `poi-label`, `settlement`, `country`, `state`, `continent`, `natural`, `waterway`, `water`, `airport`.
  - `names` 적용 = 장식층만 `visibility none`, 이름 레이어는 **filter·visibility 호출 0**(조임·거리 조건 없음). 복원·히스테리시스(≥19 적용·18.7 미만 복원·원래 값 복원)·`style.load` 재적용·상태 같으면 호출 0·앱 레이어 제외·`?labels=1`·`mode=all` 항상 표시는 그대로.
- `apps/web/src/components/perfLab/PerfLabPanel.css`: 패널을 상단 가운데(`top 0.35rem · left 50%`)에서 **화면 왼쪽 가장자리 세로 중앙**(`top 50% · left var(--hud-pad-left, 0.5rem) · translateY(-50%)`)으로 이동. 우상단 카메라·맵 버튼 줄과 겹치지 않음. 주석도 갱신.

## 2. 스타일 3종 `names` 숨김 목록 (헤드리스 실측, 줌 19.5)

스크립트 `apps/web/scripts/map/ride-label-names-headless.mjs`, 원시 `document/ops/20261016-map-cut/ride-label-names-headless.json`.
3종 모두 **숨김 == 분류 기대치와 정확히 일치**(unexpected 0 · missed 0), **filter 호출 0**, skipped 0, 복원 불일치 0.
M3 원시(`ride-label-mode-headless.json`) 대조: 3종 모두 **M3 `both`-hidden 집합과 정확히 동일** — 즉 장식층만 숨기고, 보이는 나머지는 M3 가 유지하던 이름층과 같다.

| 스타일 | 대상 | 숨김 | 숨김 목록 |
|---|---:|---:|---|
| outdoors(34) | 34 | 20 | `tunnel-oneway-arrow-blue/white`, `level-crossing`, `road-oneway-arrow-blue/white`, `crosswalks`, `gate-label`, `bridge-oneway-arrow-blue/white`, `contour-label`, `building-entrance`, `building-number-label`, `block-number-label`, `road-intersection`, `road-number-shield`, `road-exit-shield`, `path-pedestrian-label`, `golf-hole-label`, `ferry-aerialway-label`, `transit-label` |
| satellite(20) | 20 | 6 | `road-intersection`, `road-number-shield`, `road-exit-shield`, `path-pedestrian-label`, `ferry-aerialway-label`, `transit-label` |
| night(29) | 29 | 16 | `turning-feature-outline-navigation`, `level-crossing-navigation`, `turning-feature-navigation`, `traffic-level-crossing-navigation`, `traffic-tunnel/road/bridge-oneway-arrow-blue/white-navigation`(6), `incident-endpoints/startpoints-navigation`, `road-intersection`, `road-number-shield-navigation`, `road-exit-shield-navigation`, `ferry-aerialway-label` |

- 참고: 지시의 "night 기준 20개"는 축약 표기 — 실제 night 스타일(symbol 29)의 장식층은 navigation식 id 16개이며, outdoors 20개가 지시 목록과 단어 단위로 일치한다. 어느 스타일에서도 이름층 숨김 0.
- 보이는 나머지(outdoors 14 · satellite 14 · night 13)는 road-label*·poi·settlement·자연·수계·공항·행정 이름층 (M3 both-filtered 유지층과 동일 집합, 이번에는 filter 무호출).

## 3. perflab 패널 겹침 확인 (헤드리스 `getBoundingClientRect` 비교)

| 뷰포트 | 상태 | 패널 rect(x,y,w×h) | 카메라 버튼 | 겹침 |
|---|---|---|---|---|
| 1280×720 | 접힘 | 8,334 288×52 | 0개(idle — 주행 전용이라 미렌더, 아래 참조) | 0 |
| 1280×720 | 펼침 | 8,56 288×608 | 0개 | 0 |
| 699×273 | 접힘 | 7,111 243×51 | 0개 | 0 |
| 699×273 | 펼침 | 7,47 243×179 | 0개 | 0 |

- 비교 대상(겹침 0): `.hud-quick-camera__btn`·`.hud-ride-map-controls__style`·`__zoom`(야외·+·−)·`.hud-account`·`.hud-signin-pill`·`.map-hud__tr`·`.map-hud__tl`·`.map-hud__tr-under`.
- 카메라 1–6 버튼은 `rideStatus running/paused` 에만 렌더라 idle 헤드리스에 없음 — 기록한다. 구조적 보장: 패널 x범위(데스크톱 8–296·폰 7–250)는 왼쪽, 카메라 줄은 우상단(TR 행, 폰 가로 꺾임 시에도 `right:4rem` 우측 고정)이라 수평이 겹치지 않는다. 폰 펼침(위 47)은 TR 첫 줄(아래 ≈32) 아래에 있다.
- 기본 모드 표시 확인: 쿼리 없는 `?perflab=1&labels=1` 에서 `글자 모드 names (D 1.2) · 표시`.
- 정정 1건: 1차 실행이 census `page.evaluate` 에서 바깥 함수(`isAppLayer`) 참조로 실패(패널 겹침은 정상 측정) — 인라인 판정으로 고쳐 재실행했다. 브라우저는 지시대로 1개·순차 페이지만 썼고 दोनों 실행 모두 종료했다.

## 4. 시험

`apps/web/scripts/map/ride-labels-contract.test.ts` **32건 전부 통과** (M3 26건은 유지 — M2 11건 `mode:"none"` 명시 그대로, 파싱 기본값만 `both`→`names` 로 갱신 + 신규 6건):

- 파싱(알려진 6 모드 그대로, 잘못된 값·없음 → `names`), D 범위 불변.
- `isDecorativeSymbolLayer`: 장식 20종 → true, 이름 13종 → false, 모르는 것 → false(이름 소스 포함) / 보조 소스(`housenum_label`)·`road` 비-label → true.
- `names` 적용·복원(이름층 호출 0·filter 무호출·복원 후 원본 일치), 같은 상태 호출 0·`reapply` 동일 숨김, `names`→`both` 변경 시 복원 후 재적용.
- M3 기존 시험(`near`/`both`/`major`/`all`/`none` 적용·복원·조임·`setFilter` 실패·앱 제외·`reapply`) 전부 그대로 통과.

## 5. 검증 (PowerShell `apps/web`, dev 서버만 기동 후 종료 — 나머진 전부 포그라운드)

| 검사 | 결과 |
|---|---|
| `npx tsc -b` | 통과 |
| `npx eslint` 변경 코드 4 파일(`rideLabels.ts`·계약 시험·신규 헤드리스·mjs·`PerfLabPanel.tsx` — CSS 제외) | 에러 0 |
| 루트 `node scripts/check-dep-direction.mjs --check` | 요구 항목 "lib 파일 전원 도메인 지정" **PASS(미지정 0)**. 전체 M0 FAIL 은 기존 결함(`route-token-onboarding-grant.test.mjs` → `functions/lib` 미존재, M1·M2·M3 와 동일) |
| `npm run test:quick` | ride 757/0 · **map 123/0**(신규 6) · peer 72/0 · meters 58/0 · tools 34/0. route 3 실패는 전부 `functions/lib` 부재 — 지시 예상과 일치, 변경부와 무관 |
| `npm run test:rider-preserve` | 44 + 6 전부 통과 |
| `npm run build` | 성공 (chunk 크기 경고는 기존) |

헤드리스(dev 5070, 브라우저 1개·순차 페이지, 끝나면 dev 서버 종료 확인 — 5070 LISTEN 없음, TIME_WAIT 잔재만): §2 names census + §3 패널 겹침.

화면·fps 비교는 Supervisor 가 배포 후 실제 GPU 로.

작업 파일:

- 수정: `apps/web/src/lib/map/rideLabels.ts`, `apps/web/src/components/perfLab/PerfLabPanel.css`, `apps/web/scripts/map/ride-labels-contract.test.ts`
- 신규: `apps/web/scripts/map/ride-label-names-headless.mjs`, `document/ops/20261016-map-cut/ride-label-names-headless.json`, 본 결과
