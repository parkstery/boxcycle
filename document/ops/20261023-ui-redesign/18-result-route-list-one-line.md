# 지시 17 — 경로 목록 한 줄 행 + 이동수단 아이콘 — 결과

2026-10-23 · 구현 Cursor CLI · [지시](17-task-route-list-one-line.md) · 커밋·푸시 없음

## 요약

- 입문·퍼블릭·내 경로(map 목록) 행을 **한 줄**(아이콘 · 이름 말줄임 · 상태 · 거리 km)로 맞췄다. 이동수단은 글자 대신 **지도 경로 탐색 팝업과 동일한 Lucide stroke SVG**를 쓴다.
- 작성자·날짜·만료·심사 등은 화면에서 제거하고 `title`·`aria-describedby`·숨김 설명에 남겼다. 흰 판·어두운 글자(15번)는 유지했다.

## 변경 파일

| 파일 | 내용 |
|---|---|
| `apps/web/src/lib/route/routeProfileIcons.ts` | 신규 — 공용 path·`buildPickPopupProfileIconSvg`·`routeProfileLabelKo` |
| `apps/web/src/components/ride/RouteProfileIcon.tsx` | 신규 — 목록용 React 아이콘 |
| `apps/web/src/components/map/mapPopupElements.ts` | 팝업 아이콘을 공용 모듈로 위임 |
| `apps/web/src/components/ride/OfficialCourseListModal.tsx` | `PublicCoursePickRow` 한 줄·아이콘·상세 `title`/SR |
| `apps/web/src/components/ride/OfficialCourseListModal.css` | 행 높이·이름 15px·말줄임·아이콘·map 내 경로 main flex |
| `apps/web/src/components/ride/SavedRoutesPanel.tsx` | map 행 한 줄·공용 아이콘·상태(심사 중·이어달리기)·`title`/SR |
| `apps/web/dep-layers.json` | `route/routeProfileIcons.ts` route 도메인 등재 |
| `apps/web/e2e/ui-redesign-batch1.spec.ts` | 한 줄 행 단언·증거 캡처 이름(`ROUTE_LIST_ONE_LINE_EVIDENCE_DIR`) |

## 검증 (실행 폴더·명령은 지시와 동일)

| # | 명령 | 결과 |
|---|---|---|
| 1 | `C:\20.HDev\boxcycle\apps\web` → `npx tsc -b --noEmit` | PASS |
| 2 | 변경 파일 eslint | PASS 오류 0 |
| 3 | `npm run test:quick` | PASS 1354/1354 |
| 4 | `node scripts/ride-verify/verify-selectors.mjs` | PASS 19단계 |
| 5 | `$env:RTW_DEV_PORT='5020'; $env:ROUTE_LIST_ONE_LINE_EVIDENCE_DIR='C:\20.HDev\boxcycle\document\ops\20261023-ui-redesign\evidence\route-list-one-line'; npx playwright test ui-800x360 ui-redesign-batch1.spec.ts --workers=1 --retries=0` | **1차** 15 passed / **3 failed** — `assertOneLineRouteRow`가 `getByText('자전거')`로 SVG `title`·접근성 이름까지 잡음. **2차**(단언을 `innerText`+svg/sr 제거 후 검사로 수정) **18 passed / 0 failed** — 로그 `evidence/route-list-one-line/ui.log` |
| 6 | `C:\20.HDev\boxcycle` → `node scripts/check-code-tidy.mjs` | PASS |
| 6 | `node scripts/check-dep-direction.mjs --check` | PASS 위반 0 |
| 6 | `git diff --check` | PASS |

## 캡처 (지시 형식, `evidence/route-list-one-line/`)

- `preview-intro-667x300.png`, `preview-intro-800x360.png`, `preview-intro-844x390.png`
- `preview-public-667x300.png`, `preview-public-800x360.png`, `preview-public-844x390.png`
- `preview-saved-667x300.png`, `preview-saved-800x360.png`, `preview-saved-844x390.png`

같은 폴더에 Playwright가 메뉴·부가 시나리오용 `batch1-preview-*.png`도 함께 썼다(지시 필수 9장 외).

## 하지 못한 것

- 실앱 에뮬레이터 캡처 — 지시상 Supervisor 담당, 실행하지 않음.

## Chief 확인용 재실행

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
$env:RTW_DEV_PORT='5020'
$env:ROUTE_LIST_ONE_LINE_EVIDENCE_DIR='C:\20.HDev\boxcycle\document\ops\20261023-ui-redesign\evidence\route-list-one-line'
npx playwright test ui-800x360 ui-redesign-batch1.spec.ts --workers=1 --retries=0
```

프리뷰는 포트 5020 dev 서버(이미 떠 있으면 재사용) + `/scripts/ui-redesign-batch1/preview.html`.
