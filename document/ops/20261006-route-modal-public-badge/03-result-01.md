# 결과 01 — 내 경로 「Public」 배지 · 퍼블릭 등록자 ID 우측 끝

- 담당: Developer(Cursor CLI)
- 지시: `02-task-01.md`
- 상태: **DEVELOPMENT_DONE**
- 커밋: 없음(지시: 커밋·푸시 금지)

## 변경 파일
| 파일 | 내용 |
|---|---|
| `apps/web/src/components/ride/SavedRoutesPanel.tsx` | `publishedPublicSavedRouteIds?.has(route.id)` 일 때만 둘째 줄에 `Public` 배지 |
| `apps/web/src/components/ride/SavedRoutesPanel.css` | `saved-routes__meta` flex · `saved-routes__badge--public`(청록 테두리) · `margin-left:auto` |
| `apps/web/src/components/ride/OfficialCourseListModal.tsx` | sub 줄: 좌(메타+활동) / 우(등록자, 앞 ` · ` 제거) |
| `apps/web/src/components/ride/OfficialCourseListModal.css` | sub flex · 좌측 ellipsis · publisher `margin-left:auto; flex-shrink:0` |

범위 밖 파일은 수정하지 않았다. props 계약·Firestore·조회 로직 변경 없음.

## 구현 요약
1. **내 경로 Public 배지** — 판정은 `publishedPublicSavedRouteIds` 만. `publishedPublicRouteFingerprints`·`pendingPublicRouteIds` 미사용. 문구 `Public`, `title="퍼블릭으로 등록한 경로"`. 배지 없을 때 빈 자리 없음.
2. **퍼블릭·입문 등록자** — `oc-modal__item-sub` 를 flex 로 바꿔 등록자 ID 를 오른쪽 끝으로. 긴 제목/메타는 좌측 말줄임.

## 검증

### 1. `npx tsc --noEmit -p .` (`apps/web`)
- 결과: **에러 0** (exit 0)

### 2. eslint (변경 TSX)
명령: `npx eslint src/components/ride/SavedRoutesPanel.tsx src/components/ride/OfficialCourseListModal.tsx -f stylish`

| 시점 | errors | warnings |
|---|---|---|
| 후 | 0 | 1 |

- 경고 1건: `OfficialCourseListModal.tsx:99` `react-hooks/exhaustive-deps` (`props` vs `[props.onClose]`) — **이번 작업에서 건드리지 않은 기존 경고**. 증가 0.

### 3. `npm run test:e2e:menu-a` (`apps/web`)
- 결과: **1 passed** (약 18s, exit 0)

### 4. 촬영
- 임시 spec `e2e/zz-tmp-route-modal-public-badge.spec.ts` 로 시드·촬영 후 **삭제 완료**.
- 시드: Auth `accounts:query`(Bearer owner) → uid · Firestore REST `savedRoutes` + **`routePublications`**(카탈로그 SoT; `publishedPublicSavedRouteIds` ← `sourceSavedRouteId` ← `pub.routeId`) + `users` 닉네임.
- 저장 디렉터리: `apps/web/.out/route-modal-public-badge/`

| 그림 | file:/// 경로 |
|---|---|
| 내 경로 690×275 (Public 배지 행, 스크롤로 배지 노출) | `file:///C:/20.HDev/boxcycle/apps/web/.out/route-modal-public-badge/01-my-routes-public-badge-690x275.png` |
| 내 경로 1000×640 (Public 유/무 행 동시) | `file:///C:/20.HDev/boxcycle/apps/web/.out/route-modal-public-badge/02-my-routes-public-badge-1000x640.png` |
| 퍼블릭 690×275 (등록자 우측 · 긴 제목) | `file:///C:/20.HDev/boxcycle/apps/web/.out/route-modal-public-badge/03-public-publisher-right-690x275.png` |
| 퍼블릭 1000×640 | `file:///C:/20.HDev/boxcycle/apps/web/.out/route-modal-public-badge/04-public-publisher-right-1000x640.png` |

## 범위 밖·발견
- 지시문의 「`courses` + `sourceSavedRouteId`」는 현재 코드 기준 **`routePublications.routeId` → summary.`sourceSavedRouteId`** 로 연결된다(`firestoreCourses.ts` Phase 5, `usePublicationCatalogHub`). 시드는 `routePublications` 로 했다.
- 690×275 폰 가로에서는 필터·툴바 때문에 목록 가용 높이가 작아, 두 행 전체가 한 화면에 잘 안 들어간다. Public 배지 자체는 DOM·1000×640·스크롤 후 690 캡처로 확인.
- 선행 미커밋(RouteListModalShell·SavedRoutesModal 등)은 되돌리지 않고 그 위에서 작업했다.

## 다음
Supervisor 감리(`04-review-01.md`) · Chief 승인 후 커밋·푸시.
