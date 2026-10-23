# 묶음 1 — 감리 재작업 결과 (Cursor)

상태: **구현 완료(로컬 게이트)** · 2026-10-23

지시: [06-task-batch1-rework.md](06-task-batch1-rework.md)

## 1. 입문·퍼블릭 exact 접근성 이름

- `RideRoutePanel` 입문·퍼블릭 행 버튼에 `aria-label="입문"` / `aria-label="퍼블릭"` 추가.
- 시각 라벨은 「입문 경로」「퍼블릭 경로」·보조 문구 유지 → `ui-800x360.spec.ts:261` 등 `getByRole('button',{name:'입문',exact:true})` 계약 복구.

## 2. map 모달 `titleId` / `#oc-modal-title`

- `RouteListModalShell` map 헤더에 `id={titleId}` 를 가진 `h2.oc-modal__title--slot` 추가(시각 숨김, sheet 모드와 동일 패턴).
- 입문·퍼블릭: `titleId="oc-modal-title"` 유지. 내 경로: `saved-routes-modal-title` 유지.

## 3. 레거시 CSS specificity · map 치수

- `OfficialCourseListModal.css` 입문/퍼블릭 전용 규칙을 `.oc-modal:not(.oc-modal--map)[aria-label=…]` 로 한정 → map 모드에 460/560px·헤더 compact·검색 `margin-right` 미적용.
- `SavedRoutesPanel.css` 내 경로 흰 시트 규칙도 `:not(.oc-modal--map)` 로 한정.
- `.oc-modal--map` 에 시안 07 패딩 `12px 16px 10px 20px`, 740×324 유지.
- `.oc-modal__search--map` 에 `-webkit-text-fill-color` 흰색(placeholder 포함) — 공용 `.oc-modal__search` 검정 fill 덮어쓰기 제거.

## 4. 시안 서체·MENU 헤더·보조문구·hover

- MENU·경로 6행·Trail·map 목록: `Gothic A1` / 거리·숫자: `Saira Condensed` (컴포넌트 CSS에 직접 지정).
- `MenuPanel` 폰 가로 `max-height: 560px` 에서 헤더 `padding-top: 4px` → **10px**(시안 06과 맞춤).
- 퍼블릭 보조 문구 `.menu-route-nav__aside--wrap` 38% 말줄임 제거, 줄바꿈 허용.
- 주요 `:hover` 를 `@media (hover: hover)` 로 제한(메뉴 닫기·모달 항목·map 행 등).

## 5. 목록 2열 메타(출발 오표시 제거)

- `publicationStartSubtitle`(`출발 ${목적지}`) 삭제.
- `publicationRowSubline`: 등록자 닉네임 · `formatPublicationListMeta` 기반(오른쪽 km 열과 중복 km 제거) · 목적지는 「출발」 접두 없이.
- `PublicCoursePickRow` 에서 `display:none` 레거시 메타 제거, 2열은 항상 `listSubline` 텍스트.

## 6. 내 경로 map 목록

- map 행 `min-height: 44px`, `height: auto`, 이름·subline 줄바꿈.
- 필터·정렬·툴바·쿼터·선택 동작 TSX 변경 없음. map 레이아웃 flex로 목록 영역 `min-height: 0` 유지.

## 7. `ui-800x360/preview.tsx`

- `MenuPanel` 에서 제거된 `onOpenSettings`/`onOpenPlaceSearch` 를 `RideRoutePanel` 로 이전.
- `onOpenLeaderboard`·`leaderboardMenuAside` 예시 wiring 추가(순위 행 프리뷰).

## 변경 파일

| 파일 | 요약 |
|---|---|
| `apps/web/src/components/ride/RideRoutePanel.tsx` | aria-label 입문·퍼블릭 |
| `apps/web/src/components/ride/RideRoutePanel.css` | Gothic A1/Saira, 퍼블릭 보조 줄바꿈 |
| `apps/web/src/components/ride/RouteListModalShell.tsx` | map 모드 hidden `h2#titleId` |
| `apps/web/src/components/ride/OfficialCourseListModal.tsx` · `.css` | subline·`:not(.oc-modal--map)`·map 패딩·서체 |
| `apps/web/src/components/ride/SavedRoutesPanel.css` | 내 경로 시트 규칙 map 제외 |
| `apps/web/src/components/MenuPanel.css` | 서체·헤더 패딩·hover |
| `apps/web/src/components/trail/TrailHubPanel.css` | 서체 |
| `apps/web/scripts/ui-800x360/preview.tsx` | RideRoutePanel callbacks |

**미수정(소유권):** GLM 하네스·Supervisor e2e·`05-review-batch1.md` 등 동일 디렉터리 타 실행자 파일.

## 검증 (Cursor 실행)

작업 폴더: `C:\20.HDev\boxcycle\apps\web`

```powershell
cd C:\20.HDev\boxcycle\apps\web
npx tsc -b --noEmit
npx eslint src/components/MenuPanel.tsx src/components/ride/RideRoutePanel.tsx src/components/ride/RouteListModalShell.tsx src/components/ride/OfficialCourseListModal.tsx src/components/ride/SavedRoutesModal.tsx src/components/ride/SavedRoutesPanel.tsx src/components/trail/TrailHubPanel.tsx src/App.tsx scripts/ui-800x360/preview.tsx
node scripts/ride-verify/verify-selectors.mjs
```

| 명령 | 결과 |
|---|---|
| `npx tsc -b --noEmit` | **PASS** |
| eslint (위 TSX) | **PASS** (기존 `App.tsx` hook 경고 7건만) |
| `verify-selectors.mjs` | **PASS** 19단계 |

**미실행(Supervisor):** `ui-800x360` Playwright, `ui-redesign-batch1-live`, `npm run test:quick`, 캡처·치수 evidence, functions test.

## Supervisor 재검 포인트

- map 입문 모달 실측 폭 740px·내부 padding 12/16/10/20 (중간 증거 `evidence/intermediate-routes.png` 대비).
- `ui-800x360` :259 메뉴→입문→퍼블릭→내 경로 전환.
- 667×300 내 경로: 관리 툴바 + 목록 1행 이상 노출.
- git 조작·커밋·푸시·배포 없음(지시 준수).
