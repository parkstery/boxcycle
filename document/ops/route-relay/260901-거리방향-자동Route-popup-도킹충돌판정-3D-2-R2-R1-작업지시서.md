# 거리·방향 자동 Route — popup 도킹 충돌 판정 3D-2-R2-R1 작업지시서

| 항목 | 내용 |
|---|---|
| 문서 유형 | **실행 — 커밋 후 시험 실패 보완** |
| 최초 작성 | 2026-09-01 |
| 상태 | **즉시 보완 필요** |
| 작업 ID | `DISTANCE-AUTO-ROUTE-POPUP-DOCK-3D-2-R2-R1` |
| worktree | `C:\20.HDev\boxcycle-distance-auto-route-ui-circle` |
| 브랜치 | `feat/distance-auto-route-ui-unification` |
| 실패 commit | `4c2fe1fddb5dbfce2550b408b055d7187d1ee568` (`fix(route): dock route controls outside the map focus`) |

## 1. 검토 판정

`4c2fe1f`은 popup 도킹·drag·오른쪽 padding 및 `2.75rem` wrapper 제거를 구현했지만 필수 계약 시험을 통과하지 못했다.

```text
npm -w boxcycle-web run test:distance-auto-route
tests 45 / pass 44 / fail 1
FAIL: 3D-2-R2 — dock 위치 계산·clamp·예약 영역
```

web build와 Functions build는 통과했다. 실패 원인은 테스트 완화가 아니라 위치 선택 로직에 있다.

## 2. 원인

### 2.1 예약 HUD 충돌이 soft score임

`scoreRoutePickDockCandidate()`는 예약 UI와의 겹침 면적에 가중치 4, Start/click/Route focus 겹침에 가중치 6을 더한다. 이 때문에 예약 UI를 침범하는 후보가 focus를 덜 가린다는 이유로 선택될 수 있다.

예약 HUD와 겹치지 않는 후보가 하나라도 있으면 그 후보군 밖의 위치는 선택하면 안 된다.

### 2.2 `.map-hud`는 예약 사각형이 아님

`ROUTE_PICK_DOCK_HUD_SELECTORS`의 `.map-hud`는 CSS `position:absolute; inset:0`인 화면 전체 overlay다. 실제 버튼·카드가 아니라 전체 viewport의 bounding rect를 반환하므로 모든 도킹 후보가 HUD와 겹친 것으로 평가된다.

## 3. 수정 계약

1. `.map-hud` 전체 컨테이너를 예약 selector에서 제거한다.
2. 현재 표시되는 실제 HUD slot만 수집한다: `.map-hud__tl`, `.map-hud__tc`, `.map-hud__tr`, `.map-hud__tr-under`, `.map-hud__rs`, `.map-hud__bc`, `.map-hud__br`, `.map-hud__mc`와 필요한 실제 카드/버튼.
3. `offsetParent`, `getClientRects`, 실제 width/height로 숨겨진 slot을 제외한다.
4. RouteDock·Mapbox navigation·축척 등 기존 실제 예약 영역은 유지한다.
5. 위치 선택은 lexicographic하게 한다.

```text
1차: reserved overlap area = 0인 후보만 남김
2차: 그 후보들 안에서 Start/click/Route focus overlap 최소
3차: 동일하면 좌우 edge 우선 및 안정적인 순서
```

6. collision-free 후보가 하나도 없을 때만 reserved overlap 최소 후보를 사용하고 viewport 안으로 clamp한다.
7. 사용자 drag 위치는 기존처럼 보존하되 resize 후 화면 밖으로 나가면 clamp한다.
8. 시험을 삭제·skip하거나 단순히 기대값을 현재 오동작에 맞추지 않는다.

## 4. 필수 시험

- 기존 400×300 fixture에서 충돌 없는 후보가 존재하면 예약 rect와 overlap 0
- focus 회피 점수가 더 좋아도 예약 HUD와 겹치는 후보는 선택 금지
- 모든 후보가 예약 rect와 겹치는 초소형 viewport에서는 overlap 최소 후보 선택
- `.map-hud` 전체 viewport rect 미수집
- visible HUD slot만 수집, hidden slot 제외
- drag·resize clamp·Route A→B·Token 회귀

```powershell
cd C:\20.HDev\boxcycle-distance-auto-route-ui-circle
npm -w boxcycle-web run test:distance-auto-route
npm -w boxcycle-web run test:route-token
npm --prefix functions run build
npm -w boxcycle-web run build
git diff --check
git show --check HEAD
```

## 5. Git·Keep

- 원격에도 존재하는 `4c2fe1f`를 amend·reset·rebase하거나 force-push하지 않는다.
- 수정 완료 후 **커밋 전에 Cursor Review 상태에서 멈춘다.** 변경 파일과 전체 시험 결과를 제출해 사용자가 Keep을 선택할 수 있게 한다.
- Keep 후 같은 브랜치에 별도 후속 로컬 커밋을 남긴다.
- 이미 발생한 원격 반영을 확대하지 말고 후속 commit은 push하지 않는다.
- 이 수정에 정확 거리 3E나 클릭 의도 3F를 섞지 않는다.

권장 commit 제목:

```text
fix(route): avoid HUD collisions when docking route controls
```
