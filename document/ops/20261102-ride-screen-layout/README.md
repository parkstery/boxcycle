# 주행 화면 배치 개편

[계획](00-plan.md). Claude Code 직접 구현·검증.

## 1단계 — 순위·Trail 오른쪽 탭 공유 (11-02, 미커밋)

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
