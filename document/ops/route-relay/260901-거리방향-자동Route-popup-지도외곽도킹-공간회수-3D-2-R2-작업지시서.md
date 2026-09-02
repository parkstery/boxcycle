# 거리·방향 자동 Route — popup 지도 외곽 도킹·공간 회수 3D-2-R2 작업지시서

| 항목 | 내용 |
|---|---|
| 문서 유형 | **실행 — UI 미완료 보완** |
| 최초 작성 | 2026-09-01 |
| 상태 | **실행 대기** |
| 작업 ID | `DISTANCE-AUTO-ROUTE-POPUP-DOCK-3D-2-R2` |
| worktree | `C:\20.HDev\boxcycle-distance-auto-route-ui-circle` |
| 브랜치 | `feat/distance-auto-route-ui-unification` |
| 기준 commit | `ebdee9d93219e7fe6ac40eb2b5e8d050c4776873` (`fix(route): make route selection mode explicit`) |
| 선행 문서 | [3D-2-R1](260901-거리방향-자동Route-선택모드체크박스-컨트롤비율-3D-2-R1-작업지시서.md) |

## 1. 판정과 목적

`ebdee9d`에는 checkbox·고정 status slot 등 일부 요구가 반영됐지만 다음 항목은 미완료다.

1. 경로 탐색 popup이 여전히 지도 클릭 좌표에 결합된 Mapbox Popup이다.
2. `pickPickPopupAnchor()`는 클릭이 화면 가장자리 약 80px 안에 있을 때만 방향을 바꾸며, 나머지는 항상 `bottom`이라 지도 중앙과 목표 지점을 가린다.
3. `.map-view__pick`의 popup 전체 `padding-right: 1.85rem`이 남아 닫기 버튼 아래까지 오른쪽 빈 세로 컬럼이 생긴다.
4. `−`/`+`의 `.map-view__pick-distance-step-hit`이 각각 `2.75rem` 고정 폭을 차지해 slider 길이를 줄인다.

이번 작업은 경로 탐색창을 **지도 가장자리의 비어 있는 안전 영역에 자동 도킹**하고, popup 내부의 남은 오른쪽 공간을 실제 컨트롤에 돌려준다.

## 2. popup 위치 계약

### 2.1 두 단계 표면

- 아직 Start를 선택하지 않은 최초 지점 정보 popup은 선택 좌표를 가리키는 현행 point popup을 유지할 수 있다.
- Start가 선택되어 Route 설정 컨트롤이 활성화되는 순간부터 해당 경로 탐색창은 지리 좌표 anchor에서 분리된 screen-space overlay로 전환한다.
- Route 설정창은 지도 viewport 안쪽 가장자리의 안전 여백에 놓는다. 브라우저나 DevTools의 앱 바깥 영역에 렌더하지 않는다.
- 자동 Route의 방향 클릭·탐색 중·성공·실패·재탐색 동안 같은 panel DOM/state를 유지한다. 클릭한 방향 좌표로 다시 이동하지 않는다.

### 2.2 자동 도킹 위치 선택

초기 도킹 후보는 지도 viewport의 네 가장자리/모서리 안전 영역에서 계산한다.

- RTW/Trailhead, 상단 주행 HUD, Guest/CAD/지도 버튼, 우측 지도 조작, 하단 RouteDock, 축척 등 현재 보이는 HUD의 실제 bounding rect를 예약 영역으로 취급한다.
- Start marker와 목표 거리 원의 중심부, 현재 Route geometry의 핵심 화면 영역과 겹침이 가장 적은 후보를 선택한다.
- 동일 점수라면 가로형 화면에서는 좌우 가장자리 중 RouteDock·지도 조작과 충돌하지 않는 쪽을 우선한다.
- viewport 안쪽 최소 8px 안전 여백을 유지하고 popup이 화면 밖으로 잘리지 않게 clamp한다.
- popup open, Start 확정, viewport resize·orientation change 때 계산한다. Route A→B 방향 클릭마다 위치가 이리저리 점프하면 안 된다.
- 지도 카메라 pan/zoom마다 연속 재배치하지 않는다. 사용자가 Route를 보려는데 panel이 흔들리는 동작은 금지한다.

### 2.3 사용자가 가려진 곳을 선택할 수 있는 보완

- 자동 도킹 후에도 필요한 지도 지점이 panel 아래라면 주소/제목 상단 영역을 drag handle로 사용해 panel을 이동할 수 있게 한다.
- mouse와 touch pointer를 함께 지원하고, drag 중 지도 pan·click·자동 Route 요청이 발생하지 않게 한다.
- drag 종료 위치는 viewport 안으로 clamp하고 같은 Route 편집 세션에서 보존한다.
- 방향 클릭·성공·실패로 사용자 위치를 자동 초기화하지 않는다. popup을 완전히 닫고 새 Route 편집 세션을 시작할 때만 자동 도킹을 다시 계산한다.
- 별도 `이동` 버튼이나 별도 설정창은 추가하지 않는다.
- 닫기 버튼과 Start/WP/End 버튼을 drag handle로 취급하면 안 된다.

## 3. 내부 오른쪽 공간 회수

- `.map-view__pick` 전체에 적용된 `padding-right: 1.85rem`을 제거한다.
- 닫기 버튼과 충돌할 수 있는 주소·meta 상단 텍스트에만 필요한 오른쪽 여백을 둔다.
- Start/WP/End, Token, profile/`경로 삭제`, 거리 조작, 상태 행은 popup content 오른쪽 끝까지 사용한다.
- `.map-view__pick-distance-step-hit`의 `2.75rem` 고정 layout 폭을 제거하고 숫자 입력 높이의 정사각형 버튼 크기에 가까운 폭만 차지하게 한다.
- 투명 hit area가 필요하면 인접 checkbox·slider·숫자 입력을 덮지 않는 범위에서만 확장한다.
- grid gap을 최소화하고 checkbox·`−`·`+`·숫자 입력을 제외한 남은 폭을 전부 slider track에 배정한다.
- popup 외곽 폭을 키워 빈 공간 문제를 숨기지 않는다.
- `−`/`+` 글리프의 광학적 가로·세로 중앙 정렬을 다시 확인한다.

## 4. 기능 회귀 금지

1. unchecked 지도 클릭은 수동 End 선택이며 자동 POST·Token 차감 0회
2. checked 지도 클릭은 거리·방향 자동 요청 1회
3. popup close 후 checkbox 선호 유지·armed 해제
4. Route A 생성 후 같은 panel에서 Route B 재탐색
5. B 탐색 중 A 유지, 성공 후에만 교체
6. 요청마다 새 requestId, 성공마다 Token 1개, 실패 시 기존 Route·Token 유지
7. 고정 status slot으로 idle/부족/탐색/성공/실패 높이 동일
8. 수동 Start/WP/End 지정과 `경로 삭제` 유지

## 5. 이번 범위에서 하지 않는 것

- provider 후보 생성·거리 절단·방향 점수 알고리즘
- 목표 연장 정확 절단 3E 구현
- 새 popup·카드·재탐색 버튼 추가

정확 거리 작업 `DISTANCE-AUTO-ROUTE-EXACT-DISTANCE-3E`와 코드·커밋을 섞지 않는다.

## 6. 시험

최소 자동/DOM 계약:

1. Start 확정 전 point popup과 확정 후 docked Route panel의 상태 전환
2. docked panel이 지리 좌표 anchor 이동을 따르지 않음
3. 예약 HUD rect 및 viewport 밖과 겹치지 않는 후보 선택
4. resize·orientation change 시 viewport 내부 clamp
5. panel drag 시 지도 pan/click 및 자동 POST 0회
6. drag 위치가 Route 편집 세션 동안 유지
7. panel 닫기 후 armed 해제와 다음 세션 자동 도킹 재계산
8. 하단 행 computed content width에 popup 전체 닫기 버튼용 오른쪽 padding 없음
9. `−`/`+` wrapper layout 폭이 `2.75rem` 고정값이 아님
10. 변경 전보다 같은 popup 폭에서 slider track이 길어짐
11. checkbox·slider·버튼·숫자 입력 pointer 영역이 겹치지 않음
12. Route A→B·Token·requestId 회귀

필수 게이트:

```powershell
cd C:\20.HDev\boxcycle-distance-auto-route-ui-circle
npm -w boxcycle-web run test:distance-auto-route
npm -w boxcycle-web run test:route-token
npm --prefix functions run build
npm -w boxcycle-web run build
git diff --check
git show --check HEAD
```

화면 확인은 가로형 스마트폰 1개와 데스크톱 1개에서 panel 도킹·drag·지도 클릭 가능 여부만 최소 수행한다. 사용자 제출용 screenshot이나 해상도별 증거 파일을 만들지 않는다.

## 7. Git·Keep·완료 보고

- `ebdee9d`와 이전 커밋을 amend·reset·rebase하지 않는다.
- 구현을 마치면 Cursor Review 상태에서 멈추고 변경 파일과 시험 결과를 먼저 제출한다. 사용자에게 Keep 시점을 알릴 수 있어야 한다.
- Keep 후 같은 브랜치에 별도 후속 로컬 커밋을 남긴다.
- 정확 거리 3E와 한 커밋으로 섞지 않는다.
- 사용자 확인 전 push·PR·merge·deploy하지 않는다.

권장 commit 제목:

```text
fix(route): dock route controls outside the map focus
```

완료 보고에는 commit hash·parent, 변경 파일·줄 증감, 자동 도킹 후보/예약 영역, drag pointer 격리, slider 실제 track 폭 전후, 회귀 시험, worktree clean 여부를 포함한다. 또한 사용자 직접 확인용 worktree 절대경로, 정확한 CLI 명령, 실제 URL·포트, Functions/Firebase Emulator 필요 여부, 서버 재시작 여부, 일반/강력 새로고침 여부, 최소 재현 절차와 기대 결과를 적는다.
