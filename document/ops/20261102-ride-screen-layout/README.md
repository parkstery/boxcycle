# 주행 화면 배치 개편

[계획](00-plan.md). Claude Code 직접 구현·검증.

## 1단계 — 순위·Trail 오른쪽 탭 공유 (11-02, 배포됨 9ea27a96·4237de18·c8e4da8a)

- 오른쪽 순위 목록 머리줄을 「순위 | Trail N」 탭으로. Trail 탭 = 순위와 같은 줄 띠, 최대 10줄+「외 N개」, 짧은 이름(`src/lib/trail/shortTrailPlace.ts`), 대기 중 합류 버튼, 주행 중 내 Trail 맨 위.
- 메뉴 패널 Trail 목록 → 「지금 달리는 Trail N개 ›」 줄(메뉴 닫고 오른쪽 Trail 탭 열기). 「이 Trail 공개」 전환은 메뉴에 그대로.
- 파일: `components/trail/trailGlance.ts`·`TrailGlanceList.tsx`(신규)·`TrailHubPanel.tsx/.css`·`leaderboard/LeaderboardGlance.tsx/.css`·`App.tsx`·`ui/EdgePanelHandle.css`·`scripts/ui-800x360/preview.tsx`·e2e `toolbar-trail-style`·`ui-redesign-batch1`·단위 `scripts/ride-hierarchy/trail-short-place.test.ts`·고정63.
- 검증: tsc -b 0·eslint 0·단위 3/3, toolbar-trail-style 20/20(Trail 탭 4크기×대기/주행, 대기·주행 모두 10줄 화면 안), 사보타주(10→5줄) 실패 확인 후 원복. 같이 돈 ride-interval·ride-ui-moments·ui-redesign-batch1 실패 6건은 HEAD 코드로도 동일(ride-ui-moments 순위판·좌우 탭 3, batch1 저장 경로 필터 크기 3).
- 측정: 주행 중·주행 전 모두 10줄 화면 안(800×360·699×273).
- **정정(Chief 지적)**: 처음 보고에서 「주행 전 5줄 = 오른쪽 아래 시작 버튼 자리 때문」이라 했으나 틀렸다(시작 버튼은 이미 왼쪽 RouteDock). 실측 원인 = `.lb-glance__panel` 기본 max-height 가 화면 높이에서 「시계 높이(--br-clock-above-scale+--br-clock-height, 앱 실제 1.9rem+2.2rem)+56px」를 고정으로 뺐다(0b9b5abf·7d2831d9, 10-29). 시계는 10-28 제거, 주행 버튼은 RouteDock 으로 이동 → 없는 요소의 자리. 패널 아래 오른쪽엔 목록 말고 아무 요소도 없었다. 10-28 「10명 동시 표시」 지시는 주행 중(`.map-hud--active-ride`)에만 이 예약을 걷어냈다. 표고 그래프(아래 가운데, 800 기준 x176~624·y224~344)는 목록(x569~)과 오른쪽 끝 55px가 겹치는 자리지만 높이 제한의 원인은 아니었다(목록이 이미 y251까지 내려와 있었음). 수정: 주행 전도 주행 중과 같은 규칙(같은 아래 여유 24px·18px 줄, 낮은 폰 13px 줄), 합류 버튼은 줄 안 16px(낮은 폰 12px).
- 반달 탭: 목록이 길어져 낮은 폰에서 오른쪽 반달 탭 누름 영역(44px)을 덮음 → 순위가 열린 동안 탭을 HUD 위(z 6), 카메라 메뉴가 펼쳐진 동안만 예전처럼 아래(z 4). 이 수정으로 HEAD 부터 실패하던 「양쪽 탭 열고닫기 800·667」「좌우 탭 클릭」 3건도 통과. 카메라 메뉴 가림 0칸 확인.
- 남은 기존 실패(HEAD 동일): 반달60%·지도 터치 4, 탭 핸들 터치 1, RouteDock 한 줄·간격·10명 4(⚙ 추가 뒤 갱신 안 된 간격 32px 검사에서 멈춤), ride-ui-moments HUD 한 행 2, ui-800x360 3, batch1 저장 경로 필터 3.
- 알려진 기존 결함: 699×273 주행 중 왼쪽 메뉴 반달 탭을 RouteDock 머리가 가림 → 시험은 키보드로 열고 3단계에서 정리.
- 캡처: `evidence/trail-800-riding.png`·`trail-800-idle.png`·`trail-699-riding.png`.

## 2단계 — 오른쪽 조작 레일 (11-02, 배포됨 d331d2d8)

- 카메라·지도 스타일·＋·－ 를 오른쪽 끝 세로 한 줄 64px 정사각 구름(간격 8px)으로. 화면 끝에서 26px 띄워 오른쪽 반달 탭의 보이는 손잡이(20.4px)를 남긴다. 반달 탭(44×76)은 HUD 아래라 겹치는 곳은 레일 버튼이 눌린다 — 1단계의 「열린 동안 탭 z 6」은 목록이 레일 왼쪽으로 옮겨 탭을 덮지 않으므로 걷어냈다.
- 계정: 대기 화면만 위 구석(고정43), 레일은 그 아래 8px. 주행·일시정지 중엔 숨김(레일이 위 8px부터).
- 낮은 폰(높이 312px 미만 = 736×300·699×273·667×300): 주행 중 4칸이 안 들어가 지도 스타일을 레일에서 빼고 ⚙ 주행 설정 창의 「지도 스타일」 칸, 일시정지 중엔(⚙ 자리가 INT) 일시정지 옵션 ⋯ 의 「지도 스타일」로 바꾼다. 둘 다 같은 CSS 조건에서만 보인다. 3단계에서 ⚙가 일시정지에도 들어오면 정리.
- 카메라 버튼: 위 줄 번호·아이콘, 아래 줄 거리. 메뉴는 레일 왼쪽 8px, 위 끝 맞춤.
- 순위·Trail 목록: 레일 왼쪽 10px(right 100px)·위 8px. 예전 두 줄 배치용 top(5rem·4rem) 제거.
- 1단계 결함 수정: 주행 중 점(●)이 있는 순위 줄이 13px 줄에서 5px 아래로 밀려 다음 줄과 겹쳤다(점 칸이 글자 줄 높이를 가짐) → 점 칸 line-height 0. 시험 추가.
- 정리: App 의 지도 조작 묶음(90줄)을 `src/app/useAppMapHudControls.ts` 로(App.tsx 3793→3702줄). MapHud.css·MapToolbar.css 의 옛 가로 줄·두 줄 grid 규칙 삭제, 새 규칙은 `components/maphud/MapRail.css`.
- 파일: `MapHud.tsx`·`MapRail.css`(신규)·`MapHud.css`·`MapToolbar.css`·`LeaderboardGlance.css`·`EdgePanelHandle.css`·`app/useAppMapHudControls.ts`(신규)·`App.tsx`·`ride/RideSettingsPanel.tsx`·`RideSettingsSheet.tsx/.css`·`RideControlBar.tsx/.css`·`scripts/ui-800x360/preview.tsx`·e2e `toolbar-trail-style`·`compact-controls`·`ui-800x360`·`ride-ui-moments`·고정64(20·30·43·56·59·61 배치 대체 표시)·63 문구.
- 검증: tsc -b 0·eslint 0 오류·정련 래칫 기준선 안·의존 방향 0·test:quick 1470/0. e2e 7종 105개 중 90 통과/15 실패 — 15건 모두 1단계 때부터의 기존 실패(왼쪽 반달 vs RouteDock 5, RouteDock 간격 4, ui-800x360 3, batch1 3). 「HUD 한 행·좌우 탭」 699·667 2건은 이번에 통과로 바뀜. route-dock-tools·sensor-dock 14개 중 13 통과, 1건은 HANDOFF 기록 기존 실패(종료 후 펼침). 사보타주: 레일 26→8px·낮은 폰 규칙 해제 → 레일 시험 12/12 실패, 점 칸 수정 제거 → 8/8 실패, 원복 후 통과.
- 실앱 확인 범위: 하네스(미리보기)로 화면·동작 확인. App 쪽 새 훅·설정 창 배선은 타입 검사로 확인.
- 캡처: `evidence/rail-ready-800.png`·`rail-riding-800.png`·`rail-ready-699.png`·`rail-riding-699.png`·`rail-camera-menu-800.png`·`rail-camera-menu-699.png`·`rail-gear-map-style-699.png`, 변경 전 `before-rail-riding-800.png`.

## 3단계 — 왼쪽 아래 주행 버튼 줄 (11-02, 배포됨 ae1c0198)

- Chief 답(11-02): 배치 A안(버튼 줄 위·미니맵 아래), 주소 카드는 접기 유지(계획서의 「주행 중 숨김」 취소 — 고정 원칙5·고정11), 미니맵 버튼은 줄에 넣고 64px.
- 접힌 줄 = LED · 도구 | 주행 버튼 | 미니맵, 모두 64px(LED 원 32px), 묶음 안 8px·묶음 사이 34px. 일시정지 접힌 줄에 ⚙ 추가(INT·⚙), 펼친 카드는 폭이 모자라 종전대로 INT만. 2단계의 임시 「일시정지 옵션 → 지도 스타일」 제거 — 낮은 폰 일시정지도 ⚙ → 주행 설정 창.
- 미니맵: 펼침 상태를 App 으로 올려(`RouteMinimap` `expanded` prop) 줄 끝 버튼이 접고 편다. 접으면 미니맵이 빠지고 줄이 맨 아래로 내려간다. 미니맵 위 28px 버튼은 이 경우 그리지 않는다.
- 왼쪽 아래 묶음을 화면 끝에서 48px로(왼쪽 반달 탭 누름 44px+4px) → 「왼쪽 반달 vs 경로 카드」 기존 실패 5건(반달 60%·지도 터치 4, ui-800x360 고정14) 해소.
- 알려진 한계: 699×273에선 줄(y 107~171)이 표고 그래프(실앱, x 154~545·y 139~259) 왼쪽 위와 코칭 문구를 덮는다 — A안 선택 시 안내, 4단계 자동 숨김 전제. 펼친 흰 카드 안 버튼은 종전 크기.
- 숨어 있던 기존 문제: `ride-dock-layout` 「RouteDock 한 줄·간격·10명」은 10-30 ⚙ 추가 뒤 간격 32px 검사에서 멈춰 있었다. 그 자리를 64px 줄 계약으로 바꾸자 다음 검사 「펼친 카드에서 주행 전 ▶와 주행 중 ⏸가 같은 칸(고정46)」이 22~36px 어긋나 실패 — 펼친 카드는 이번에 건드리지 않았다(HEAD 동일 구조). 별도 확인 필요.
- 파일: `route-dock/RouteDock.tsx/.css`·`map-overlays/RouteMinimap.tsx`·`MapBottomLeftStack.css`·`App.tsx`·`ride/RideControlBar.tsx/.css`(임시 지도 스타일 제거)·`scripts/ui-800x360/preview.tsx`·e2e `ride-dock-layout`·`address-minimap-width`·`route-dock-tools`·`sensor-dock`·`toolbar-trail-style`·고정65(29·42·45·46·53 대체 표시).
- 검증: tsc -b 0·eslint 0 오류·정련 래칫 기준선 안·의존 방향 0·test:quick 1470/0·진입 셀렉터 21/21. e2e 15종 146개 중 123 통과/23 실패 — 23건 모두 HEAD 코드로도 같은 줄에서 실패(경로 카드 간격 4는 위 숨은 문제, 경로 생성 5, 결과 시트 등 4는 Firestore 에뮬레이터 미기동으로 판정 불가, ui-800x360 2, batch1 3, batch2 3, sensor-dock 종료 후 펼침 1, 탭 핸들 터치 1). 사보타주: 접힌 줄 32px 로 되돌리면 64px 줄 검사 4/4 실패, 원복 후 통과.
- 캡처: `evidence/row-riding-800.png`·`row-riding-699.png`·`row-paused-699.png`·`row-interval-699.png`·`row-minimap-folded-800.png`·`row-ready-800.png`, 변경 전 `before-row-riding-800.png`·`before-row-riding-699.png`.

## 4단계 — 주행 중 버튼 자동 숨김 (11-02, 배포됨 f511feed)

- `components/ride/RideControlsAutoHide.tsx/.css`(신규): 주행 중(일시정지 제외) 5초 무입력(pointerdown·keydown·wheel) → `body[data-ride-controls="hidden"]`. CSS 가 오른쪽 레일(오른쪽으로)·접힌 RouteDock 줄(아래로)을 0.3초에 사라지게 하고(visibility hidden), 순위 목록을 right 100→26px 로 옮긴다. 누르면 즉시 표시·5초 재시작(누른 동작은 막지 않음).
- 미룸: 카메라 메뉴·펼친 경로 카드·열린 창(닫힌 창은 aria-hidden·inert 라 제외)·일시정지 옵션, 키보드 포커스(focus-visible)가 버튼에 있을 때. 손가락으로 누른 뒤 남은 포커스는 치지 않는다.
- 첫 숨김 안내 「화면을 누르면 버튼이 나타나요」 3.5초, 한 번(localStorage `rtw-ride-controls-hint-seen`, 실패해도 동작).
- App·하네스 모두 `<RideControlsAutoHide active={stage === "riding"} />` 한 줄.
- 시험: `e2e/ride-controls-autohide.spec.ts`(신규, page.clock): 4초 보임·5초 숨김·누르면 표시·⏸ 동작·목록 26↔100·반달 손잡이 안 가림·일시정지/카메라 메뉴/펼친 카드 미룸·안내 한 번. 숨김 직후 0.3초 동안은 「보임」 검사가 통과하는 허점 → 숨김 표식으로 판정. 사보타주: 숨김 CSS 제거 → 3/3 실패, 미룸 판정 끔 → 해당 시험 실패, 원복 후 통과.
- 기존 시험 영향: `ride-interval` 「30초 경계」가 재개 뒤 7.2초 무입력 후 ⏹를 찾다 막힘 → 화면을 한 번 누르고 종료하도록 수정(의도된 동작).
- 위험(미실행): 실앱 대상 측정·실주행 시험(camera-*, peer-sync-*, firebase/public-trail 트래픽 등)이 주행 중 5초 넘게 기다린 뒤 레일·주행 버튼을 누르면 같은 이유로 막힌다 — 돌릴 때 화면을 한 번 누르는 단계가 필요. 에뮬레이터·실 API 필요라 이번에 실행 안 함.
- 검증: tsc -b 0·eslint 0 오류·정련 래칫 기준선 안(안 쓰는 export 1 제거)·의존 방향 0·test:quick 1470/0·진입 셀렉터 21/21. e2e 16종 149개 중 125 통과/24 실패 — 23건은 3단계와 같은 기존 실패, 1건(ride-interval 30초 경계)은 위 수정 후 13/13 두 번 연속 통과.
- 캡처: `evidence/autohide-shown-800.png`·`autohide-hidden-800.png`·`autohide-shown-699.png`·`autohide-hint-699.png`·`autohide-hidden-699.png`.

## 개편 A — 오른쪽 2열 4줄 묶음 (11-02, 93924456 · Chief 승인)

- 출발: Chief 폰 사용 뒤 「왼쪽·오른쪽으로 나뉜 버튼이 불편」 → 시안 [right-group.html](right-group.html) v1~v4 → Chief 답(나중 쪽을 펼치면 먼저 쪽 접기·계정은 주행 중에도 보이고 순위 목록 아래·경로 목록도 메뉴로·미니맵 버튼은 RouteDock 손잡이 크기) 뒤 「구현 진행해」. 단계: **A 오른쪽 묶음**(이번) → B 센서 LED·RPM 계기판 칸 → C 미니맵 토글 복귀·인터벌 접기·하나만 펼치기.
- 오른쪽 아래 2열 4줄(`MapHud.tsx` `.map-hud__rail`, `MapRail.css` grid-area 로 칸 고정): 1-1 카메라 · 1-2 지도 스타일 / 2-1 ＋ · 2-2 － / 3-1 INT · 3-2 순위 / 4-1 ⏹ · 4-2 ⏸·▶. 없는 기능의 칸은 비움(주행 전 카메라·⏹, 주행 중 INT). 흰 원(구름 마스크 끔). 크기 `--rail-size` = min(64px, (화면 높이 − 위 46 − 아래 8 − 간격×3) ÷ 4) → 800×360 64, 300 높이 58, 699×273 약 51. 오른쪽·아래 끝 8px, z 3(순위 목록 z 2 위).
- 주행 버튼: `RideControlBar` 를 RouteDock 에서 빼 `MapHud` `controlGroup.transport` 로(감싼 상자는 display: contents, 버튼이 바로 칸). 이어 달리기 선택·일시정지 옵션(⋯)은 맨 아래 줄 왼쪽 작은 알약.
- 순위: 오른쪽 반달 탭(`EdgePanelHandle edge="right"`) 삭제, 3-2 순위 버튼(`aria-expanded`·`aria-controls="lb-glance-panel"`, 이름 「순위 열기/닫기」). 목록은 오른쪽 가장자리 8px·위 8px 고정. 주행 중 순위 버튼으로 열면 2초 뒤 묶음 숨김(`components/ride/rideControlsHide.ts` `requestRideControlsHide` → `RideControlsAutoHide` 가 듣고, 화면을 누르면 취소).
- 자동 숨김: 오른쪽 묶음만(왼쪽 아래 LED·미니맵 줄은 그대로). 목록 이동 규칙 삭제.
- 계정: 주행·일시정지에도 표시(오른쪽 위 구석). 목록(z 2)이 그 위에 그려지고, 목록 빈 곳(누름 통과)으로는 보이고 눌린다.
- ⚙ 주행 설정·지도 핀(경로 목록, 주행 전만): `MenuPanel` 머리줄 아이콘(지명 검색 옆). 경로 목록을 닫으면 메뉴로 돌아온다.
- RouteDock: 머리줄 INT·핀·⚙·주행 버튼 제거 → 접힌 줄 = LED·미니맵(64px, 8px). 2단계의 낮은 폰 「주행 설정 → 지도 스타일」 칸 삭제(`RideSettingsPanel/Sheet` 를 d331d2d8 이전으로). 카메라 메뉴는 묶음 아래 끝에서 위로 펼침(699×273에서도 1000m 줄까지 보임). 「다음 주행」 카드는 묶음 왼쪽.
- 파일: `MapHud.tsx`·`MapRail.css`·`RouteDock.tsx/.css`·`RideControlBar.tsx/.css`·`RideControlsAutoHide.tsx/.css`·`rideControlsHide.ts`(신규)·`MenuPanel.tsx/.css`·`LeaderboardGlance.css`·`RideSettingsPanel.tsx`·`RideSettingsSheet.tsx/.css`·`App.tsx`(3698줄)·하네스 `ui-800x360/preview.tsx`·`ui-redesign-batch1/preview.tsx`·`ride-verify/entry-contract.mjs`·단위 `sensor-chip-slot-contract.test.ts`·e2e 45종(경로 목록·⚙ 누름을 「메뉴 열기 → 메뉴 머리줄」로, 옛 레일·반달·도구줄 계약을 새 칸 계약으로)·고정67(20·43·63·64·65·66 대체 표시).
- 검증: tsc -b 0·eslint 0 오류·정련 래칫 기준선 안·의존 방향 통과·test:quick 1470/0·진입 셀렉터 21/21. 하네스 e2e 21종: 새·고친 시험 모두 통과, 남은 실패 15건은 HEAD 파일로 되돌려 같은 시험을 돌려도 똑같이 실패(기존: route-ride-controls 경로 생성 5·batch1 필터 비율 3·map-menu-consolidation 44px 3·ui-800x360 168/554·sensor-dock 141·compact 터치 1). 사보타주: 순위 2초→4초면 2초 시험 실패(처음엔 통과 — 가짜 시계가 기다리는 동안 흘러서, 시계를 멈추도록 고침), ＋/－ 칸 바꾸면 칸 시험 실패, 원복 후 통과.
- 미실행: 실앱 대상 live 스펙(camera-*·pacer-solo·ride-entry 등 30여 종, 「경로 목록」·「주행 설정」 누름만 메뉴 경유로 바꿈).
- 캡처: `evidence/group-{ready,riding,paused}-{800x360,699x273}.png`·`group-rank-open-*.png`·`group-rank-hidden-*.png`·`group-camera-*.png`·`group-menu-head-800x360.png`.

