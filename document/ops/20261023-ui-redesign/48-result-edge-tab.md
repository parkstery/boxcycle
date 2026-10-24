# 지시·결과 48 — 측면 메뉴 흰 반투명 반원 탭

2026-10-24 Chief 지시 · **시안·구현·감리 Claude Code(Supervisor 직접)** · 상태 LOCAL_VERIFIED

> Chief: 「슬라이드 메뉴가 좌우 측면에서 안쪽으로 슬라이딩 터치를 할 때 나타나는데 이 메뉴가 보이지 않으니까 불편하다. … 반투명 반원의 형태를 고정해서 보여줄까?」 → Supervisor 권고(보이는 진입점 + 끌기 지름길) → 「반원 탭으로 가자. 시안 먼저」 → 시안 A(어두운)/B(흰) 중 **「흰 반투명」**.
>
> 시안: https://claude.ai/artifact/Gx3hf9Tbdm25EpiT4SQXZH (비공개). 10-21 결정 「흰색 에지 핸들 제거·비노출 가장자리 드래그」를 일부 바꾼다 → 결정 로그에 한 줄.

## 바꾼 것

| 파일 | 내용 |
|---|---|
| `apps/web/src/components/ui/EdgePanelHandle.tsx` | 기존 비노출 띠 표식 옆에 보이는 `<button class="edge-panel-tab">`(이름 「메뉴 열기」·「맵 뷰 열기」, `aria-controls`). 누르면 `onOpen`. 판이 열리면(`open`) 표식·탭 모두 사라짐 |
| `apps/web/src/components/ui/EdgePanelHandle.css` | 탭: 누르는 영역 28×64px, 보이는 반원 14×48px `rgba(255,255,255,0.78)`·그림자·짙은 › ‹, 위에서 84px, z-index 5(HUD 층, 메뉴 50·맵 뷰 54 아래). hover 는 `@media (hover: hover)` 안 |
| `apps/web/src/components/ui/edgePanelDocumentGesture.ts` | 탭 위에서 시작한 끌기도 받음 — 탭은 양보(yield) 대상에서 빼고, 탭이 띠(20px)보다 넓은 부분에서도 시작 허용. 움직이지 않고 떼면 버튼 click 이 열어 준다 |
| `apps/web/src/features/map-overlays/MapBottomLeftStack.css`, `apps/web/src/components/route-dock/RouteDock.css` | 왼쪽 아래 카드 묶음(주소 카드·미니맵) 왼쪽 여백 약 9~11px → **16px**. 경유 3개를 펼친 주행 화면에서는 주소 카드 위끝이 탭 높이(84~132px)까지 올라와(800×360 101px, 667×300 60px) 겹쳤다 — 탭이 카드 옆 틈에 들어가게 해 카드 높이와 무관하게 겹치지 않음 |
| `apps/web/src/components/ride/OfficialCourseListModal.css` | 경로 목록 모달 때 조작부 숨김 목록에 탭 추가 |
| `apps/web/e2e/ui-800x360.spec.ts` | 잠금 시험 「Chief 고정14」: 800×360·667×300·844×390 × 대기·주행(경유 3·펼침)·일시정지에서 좌우 탭 반원 14×48·누르는 영역 ≥28×64·흰 0.78·가장자리에 붙음·중심을 누르면 탭, 계기판·주소 카드·미니맵·오른쪽 조작부·주행바와 겹치지 않음. 누르면 열림, 탭에서 끌면 열림, 열리면 그 탭 사라짐 |
| `document/reference/product/261024-RTW-Chief-지정-디자인-고정.md` | 14번 추가 |
| `document/260707-RTW-결정-로그.md` | 한 줄 추가 |

기존 시험(「좌우 에지 띠는 20px·화면0에 붙고 안쪽 드래그로만 열린다」, 「짧은/반대 드래그 취소」, 「중앙 지도는 가리지 않는다」)은 그대로 통과 — 띠 가운데 높이(155px)에서는 지금처럼 끌어야만 열린다.

## 검증 (실행 폴더 `C:\20.HDev\boxcycle\apps\web`)

| 명령 | 결과 |
|---|---|
| `npx tsc -b --noEmit` | PASS |
| 변경 파일 `npx eslint` | 오류 0 |
| 프리뷰 5020 → `npx playwright test ui-800x360 -g "고정14\|에지\|드래그"` | 4/4 PASS |
| 프리뷰 5020 → `npx playwright test ui-800x360 address-minimap-width ui-redesign-batch1.spec.ts ui-redesign-batch2.spec.ts --workers=1 --retries=0` | 31/31 PASS (`evidence/edge-tab/ui.log`) |
| 에뮬레이터 실앱 5017 → `test ride-entry route-dock-riding-content ui-edge-live --workers=1 --retries=0` | ride-entry 7 + route-dock 1 = **8 PASS**, `ui-edge-live` **1 FAIL** (`evidence/edge-tab/live.log`, `live-edge.log`) |

**`ui-edge-live` 실패 — 오래된 시험(10-21)의 기대값, 이번 변경 전부터 실패 상태로 판단:** 실제 지도에서 왼쪽 가장자리 끌기로 메뉴 열기·입문 경로 고르기까지는 통과했고, 그 뒤 「대기 주소 카드 폭 ≤220px」(76줄)에서 실패(235px). 이 기대값은 오늘 이전에도 맞지 않았다(10-24 오전 운영·HEAD 대기 카드 250px). 같은 시험의 다음 단언 「주행바 높이 ≤36」(81줄)도 고정 목록 1번(녹색 원형 44px)과 어긋나고, 이어지는 흐름(주행 시작 직후 「경로 패널 접기」)은 고정 목록 11번(주행 시작 시 접힘)과 어긋난다. 고정 목록에 맞춰 이 시험을 다시 쓰는 일은 별도 작업으로 남긴다(이번에 고치지 않음).

## 캡처 `C:\20.HDev\boxcycle\document\ops\20261023-ui-redesign\evidence\edge-tab\`

`ready-800x360.png`, `left-tab-zoom.png`, `right-tab-zoom.png`, `riding-wp3-expanded-800x360.png`, `riding-wp3-expanded-667x300.png`, `paused-800x360.png`, `ui.log`, `live.log`, `live-edge.log`
