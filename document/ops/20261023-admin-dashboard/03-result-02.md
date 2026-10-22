# 결과02 — 관리자 화면(웹)

2026-10-23 · result · 지시 [02-task-02](02-task-02.md) · 계약 [01-plan](01-plan.md) · 범위 `apps/web/` 만

## 바뀐 파일

| 파일 | 내용 |
|---|---|
| `apps/web/src/services/adminDashboardApi.ts` (신규) | `fetchAdminDashboard(user)` — ID 토큰 Bearer 로 `functionsHttpUrl("getAdminDashboard")` GET. 응답 타입(`AdminDashboardResponse` 등)과 모양 검사. 401·403·기타 상태·네트워크·JSON 오류 모두 한국어 `Error` |
| `apps/web/src/components/admin/AdminDashboardSheet.tsx` (신규) | 관리자 지표 시트. 열 때 한 번 불러옴, 로딩·오류 표시, 새로고침 버튼 |
| `apps/web/src/components/admin/AdminDashboardSheet.css` (신규) | 시트 스타일. hover 는 `@media (hover: hover)` 안에만 |
| `apps/web/src/app/useAppSheetNavigation.ts` | `adminDashboardSheetOpen`·`setAdminDashboardSheetOpen`·`openAdminDashboardPanel` 추가. 기존 `open*Panel` 6개가 관리자 시트도 함께 닫도록 한 줄씩 추가(상호 배타 유지) |
| `apps/web/src/components/UserInfoSheet.tsx` | `onOpenAdmin?` prop, 머리말 줄에 「관리」 버튼(기존 `user-info-sheet__edit` 클래스 재사용) |
| `apps/web/src/App.tsx` | `AdminDashboardSheet` 렌더, `UserInfoSheet` 에 `onOpenAdmin={user ? openAdminDashboardPanel : undefined}` 연결 |

새 lib 파일 없음 → `dep-layers.json` 변경 없음. 시험·설정·baseline 수정 없음.

## 진입 게이트

- `UserInfoSheet` 가 **열릴 때 한 번** 기존 `isRouteReviewer(user)`(`lib/route/repo/publicRouteRequests`)를 부른다. `onOpenAdmin` 이 없거나 user 가 없으면 부르지 않는다(Firestore 읽기 낭비 방지).
- 결과는 uid 로 저장(`adminUid`)하고 `adminUid === props.user.uid` 일 때만 「관리」 렌더 → 계정이 바뀌면 이전 계정의 true 가 남지 않는다. 확인 실패는 `isRouteReviewer` 가 false 를 돌려주므로 버튼 없음.
- 이 게이트는 **노출만** 결정한다. 숫자는 서버(`getAdminDashboard`)가 토큰·목록을 다시 확인해야 내준다(403 이면 시트에 「관리자 권한이 없습니다.」).
- 누르면 `openAdminDashboardPanel` — 사용자 정보 시트를 닫고 관리자 시트를 연다(기존 시트 상호 배타 방식 그대로).

## 레이아웃 결정

- 시트 틀은 `RideSettingsSheet` 와 같다: 고정 scrim(z-56) + 패널, `useDialogFocus` · `useEscapeKeyClose`, 44px 원형 닫기, scrim 탭으로 닫기. 패널은 가운데 정렬, 폭 `min(44rem, 100vw-1rem)` 이라 800px 에서 594px(내용 기준).
- 800×360: 왼쪽 「사용자 지표」 표(행 6 × 열 전체·게스트·Google), 오른쪽 「최근 (KST)」 표 + 「점검」 칸 — **두 칸 그리드라 세로 스크롤 없이 한 화면**(패널 높이 262px, scrollHeight=clientHeight=260). 폭 520px 이하·세로 폰은 한 칸으로 접히고 넘치면 패널 안에서만 세로 스크롤(`max-height: 100dvh - 1rem; overflow: auto`).
- 밀도: 표 글자 12px(헤더·소제목 11px), 셀 패딩 2px 4px. D1 에 따라 단위는 행/열 제목에 한 번(`(%)`, `(km)`), 셀은 숫자만. `null` → 「—」.
- 새 도로 비율은 서버가 0~1 비율(`newRoadClaimRatio`)이라 화면에서 ×100 하여 % 로 표시(다른 세 비율은 계약상 이미 `Pct`).
- 점검: 0 이면 회색 상자, 0 이 아니면 붉은 상자 + `role="alert"`.
- 하단 한 줄: 「내부 계정 N개 제외 · 주행 인정 기준 Xm·Y초 · 갱신 HH:MM(KST)」 왼쪽, 「새로고침」 오른쪽(44px 높이 — 터치 최소 규칙). 로딩 중 새로고침 비활성.
- 열 때마다 내부 패널 컴포넌트를 새로 마운트해 이전 숫자가 비치지 않게 했다. user 가 null 이면 「로그인이 필요합니다.」.

## 검사 결과

| 검사 | 결과 |
|---|---|
| `npx tsc -b --noEmit` (apps/web) | 통과(출력 없음) |
| `npx eslint` 신규 3파일(`adminDashboardApi.ts`·`AdminDashboardSheet.tsx`·`useAppSheetNavigation.ts`) | 0 경고·0 오류 |
| `npx eslint` `UserInfoSheet.tsx`·`App.tsx` | 기존 baseline 과 동일(HEAD 대비 UserInfoSheet 2→2, App 7→7), 신규 없음 |
| `npm run test:quick` | 1347 통과·0 실패(두 번째 실행). 첫 실행은 `entry-location-dom.test.mjs` 가 `document/ops/20261017-entry-location/evidence/15-entry-flight-metrics.json` 을 여는 중 일시 오류(errno -4094) 1건 — 재실행에서 통과. 이 파일은 작업 시작 전부터 수정 상태였고 내 변경과 무관 |
| 루트 `node scripts/check-code-tidy.mjs --check` | 기준선 이내(exports 185·types 44 …, 1200줄 초과 목록은 기존 4개 그대로) |

## 화면 캡처

`C:\20.HDev\boxcycle\.out\admin-dashboard-800.png` (800×360). 임시 e2e spec·임시 진입 html/tsx 로 실제 `AdminDashboardSheet` 를 가짜 응답(`page.route`)으로 렌더해 촬영했고, 임시 파일(`apps/web/admin-shot.html`·`src/admin-shot-tmp.tsx`·`e2e/zz-admin-shot.spec.ts`)은 모두 삭제했다(`RTW_DEV_PORT=5013`). 가짜 응답에는 점검 3건(경고색)·`null` 셀 2개가 들어 있다.

## 계약과 다른 점·참고

- 계약과 다른 점 없음. 서버 응답 모양 검사는 최상위 키 존재만 확인(필드 타입까지 검증하지 않음).
- 실제 서버(`getAdminDashboard`)와 붙여 본 시험은 하지 않았다(서버 동시 작성 중) — 배포 후 관리자 계정으로 「사용자 정보 → 관리」 확인 필요.
