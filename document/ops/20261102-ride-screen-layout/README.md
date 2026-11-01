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
