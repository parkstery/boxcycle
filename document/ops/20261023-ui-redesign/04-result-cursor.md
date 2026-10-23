# Cursor 제품 UI — 묶음 1 (MENU + 경로 목록)

상태: **구현 완료(로컬 검증)** · 2026-10-23

## 변경 파일

| 파일 | 요약 |
|---|---|
| `apps/web/src/components/MenuPanel.tsx` · `.css` | 시안 06: 300px·우측 18px 흰 판, Spinatlas+닫기 헤더만. 지명/순위/설정 헤더 칩 제거 |
| `apps/web/src/components/ride/RideRoutePanel.tsx` · `.css` | 경로 6행(입문·퍼블릭·내 경로·지명·순위·주행 설정), 실제 `savedRoutes.length`·리더보드 glance 순위만 |
| `apps/web/src/components/ride/RouteListModalShell.tsx` | `appearance="map"` 기본 — 투명 740×324 껍데기, 출처 탭·검색·정렬·닫기 한 줄 |
| `apps/web/src/components/ride/OfficialCourseListModal.tsx` · `.css` | map 목록 44px 그리드·하단 안내, 출발 부제(제목에서 추출 가능할 때만) |
| `apps/web/src/components/ride/SavedRoutesModal.tsx` · `SavedRoutesPanel.tsx` | map 목록 행·투명 스타일, 관리 툴바·필터 유지 |
| `apps/web/src/components/trail/TrailHubPanel.tsx` · `.css` | 「지금 달리는 Trail」·합류 칩·거리(실데이터) |
| `apps/web/src/App.tsx` | 메뉴 행동 props → `RideRoutePanel`, 순위 보조 문구는 `leaderboardGlance.data` ranked 일 때만 |

**미수정(소유권):** `apps/web/scripts/ui-redesign-batch1/*`, `apps/web/e2e/ui-redesign-batch1.spec.ts`

## 시안 대비 차이

| 항목 | 시안 | 구현 |
|---|---|---|
| MENU 폭·모서리 | 300px, 우측 18px | 동일 |
| 경로 6행 | 아이콘·보조 문구 | 동일 구조; 퍼블릭 보조 문구는 공간상 한 줄 말줄임 |
| 내 경로 숫자 | 예시 7 | `savedRoutes.length` (0이면 숫자 숨김) |
| 순위 보조 | 예시 1위 | `leaderboardGlance`에서 `status==="ranked"`·`rank` 있을 때만 「이번 주 N위」 |
| 경로 목록 정렬 라벨 | 「가까운 순」 | 기존 `RouteSortSelect` 유지(최근순·거리순·이름순) — 지리 정렬 미구현 |
| 목록 출발 주소 | 상세 주소 | Publication 제목에서 destination 추출 가능할 때만 `출발 …` 부제 |
| 내 경로 목록 | 출발 주소 열 | `SavedRoute`에 출발 라벨 필드 없음 → 이름·완주/진행·거리만 |
| 내 경로 모달 | 정렬이 헤더 한 줄 | 필터·툴바는 본문 상단 유지(정렬은 기존 위치); 입문·퍼블릭은 헤더 정렬 |
| Trail 이름 | 예시 지명 | `regionLabel` 등 실제 Trail 메타 |

## 검증 (Cursor 실행)

작업 폴더: `C:\20.HDev\boxcycle\apps\web`

```powershell
cd C:\20.HDev\boxcycle\apps\web
npx tsc -b --noEmit
npx eslint src/components/MenuPanel.tsx src/components/ride/RideRoutePanel.tsx src/components/ride/RouteListModalShell.tsx src/components/ride/OfficialCourseListModal.tsx src/components/ride/SavedRoutesModal.tsx src/components/ride/SavedRoutesPanel.tsx src/components/trail/TrailHubPanel.tsx src/App.tsx
node scripts/ride-verify/verify-selectors.mjs
```

| 명령 | 결과 |
|---|---|
| `npx tsc -b --noEmit` (apps/web) | **PASS** |
| eslint (변경 TSX) | **PASS** (기존 App hook 경고만) |
| `verify-selectors.mjs` | **PASS** 19단계 |

미실행(Supervisor): `npm run test:quick`, e2e, GLM 하네스, ui-800x360.

## Chief 확인 (로컬 앱, 800×360)

1. dev 서버 기동 후 지도 화면에서 **Trail 메뉴** → 좌측 흰 MENU·6행·Trail 목록
2. **입문 경로** / **퍼블릭** / **내 경로** → 투명 경로 목록, ESC·닫기, 검색 `aria-label="경로 이름 검색"` 유지
3. **지명 검색**·**순위**·**주행 설정** → 기존 패널/시트로 이동

## 제안(범위 밖)

- `apps/web/scripts/ui-800x360/preview.tsx`의 `MenuPanel` 옛 props(`onOpenSettings` 등) — 프리뷰 스크립트 소유 정리 시 갱신 필요
