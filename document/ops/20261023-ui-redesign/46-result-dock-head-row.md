# 지시·결과 46 — 대기 화면 주소 카드: 센서·접기 맨 위 한 줄, ✕ 오른쪽 끝, 폭 = 주행 중, 주행 중 경유 들여쓰기

2026-10-24 Chief 지시(실화면 캡처 3장) · **구현·감리 Claude Code(Supervisor 직접)** · 상태 LOCAL_VERIFIED

> Chief: 「주행 전 routedock 창의 아래쪽에 센서버튼이 보인다. 이 센서버튼의 위치를 routedock 창의 상단 첫번째 행으로 변경한다. 접기버튼 역시 같은 행에 배치하고 주소 delete 버튼을 오른쪽 끝으로 이동하여 주소가 더 보이도록 한다. 주행 전 routedock의 가로길이가 너무 짧다. 주행 중 보이는 routedock 창 가로길이와 같은 길이로 한다.」「주행 중 주소창에 보이는 경유지 주소 역시 주행전의 경유지 주소 들여쓰기와 마찬가지로 들여쓰기가 되어야 한다.」

## 바꾼 것

| 파일 | 내용 |
|---|---|
| `apps/web/src/components/route-dock/RouteDock.tsx` | 센서 칩이 있으면 카드 맨 위 `.route-dock__head` 한 줄에 [센서 … 접기]. 아래쪽 `route-dock__footer`(카드 안·접힘 때 카드 밖) 제거. 오른쪽 빈 칸(`swap-spacer`) 제거 → ✕ 가 카드 오른쪽 끝 |
| `apps/web/src/components/route-dock/RouteDock.css` | head 줄(30px, 접기 중심을 ✕ 열에 맞춤). 접으면 head 줄만 남는 카드(패딩 4px). 센서 선택자 `.route-dock__head` 로 이동. 주소 칸 한 열. 센서 줄이 없을 때(주행 중)는 접기가 첫 줄 오른쪽 위에 겹치므로 첫 줄 오른쪽 24px 비움. 경유 줄 16px 들여쓰기를 ⇅ 유무와 무관하게(대기·주행 모두). 폭 `min(29.4vw, 100vw-16px)` |
| `apps/web/src/features/map-overlays/MapBottomLeftStack.css` | 스택 안 대기·미니맵 접힘 폭 250px → 29.4vw. 미니맵 펼침 때는 지금처럼 미니맵 실제 폭을 따름 |
| `apps/web/src/features/map-overlays/routeMinimapProjection.ts` | `MINIMAP_WIDTH_RATIO` 에 「CSS 29.4vw 와 같은 값」 주석 |
| `apps/web/e2e/ui-800x360.spec.ts` | 목록 11 「대기 카드 250px」 → 「대기 카드 폭 = 주행 중 펼친 카드 폭(±1px)」(800×360·667×300·1280×720). 대기에서 접은 모습 단언: 센서·› 한 줄(폭 ≤140). 새 잠금 시험: 센서·접기 같은 줄·주소 첫 줄 위, ✕ 오른쪽 끝(≤10px), 경유 들여쓰기 대기·주행 모두 ≥12px. 고정12 센서 선택자 갱신 |
| `apps/web/e2e/address-minimap-width.spec.ts` | 미니맵 접힘 때 주소 카드 250px → 29.4vw(±1px) |
| `document/reference/product/261024-RTW-Chief-지정-디자인-고정.md` | 11번 폭, 12번 배치 갱신 |

**바뀌는 잠금 기대값(Chief 지시 근거):** 목록 11 「대기 카드 폭 250px」 → 주행 중과 같은 폭. 「대기에서 접으면 28~44px 버튼」 → 센서 + › 한 줄(센서를 접기와 같은 줄에 두라는 지시의 결과). 주행·일시정지의 접힌 › 버튼(28~44px)은 그대로.

**알아 둘 점:** 폭이 화면 폭의 29.4%라서, 667×300 같은 작은 폰에서는 대기 카드가 250px → 196px 로 **좁아진다**(1280 폭이면 376px로 넓어짐). ✕ 를 끝으로 보내고 오른쪽 빈 칸을 없애 주소 글자 자리는 일부 되찾았다.

## 실측 (프리뷰, 대기 vs 주행 펼침 카드 폭)

800×360: 235 / 235 · 667×300: 196 / 196 · 1280×720: 376 / 376 · 대기 접힘: 100×38(센서 + ›)

## 검증 (실행 폴더 `C:\20.HDev\boxcycle\apps\web`)

| 명령 | 결과 |
|---|---|
| `npx tsc -b --noEmit` | PASS |
| 변경 파일 `npx eslint` | 오류 0 |
| 프리뷰 5020 → `npx playwright test ui-800x360 address-minimap-width -g "고정\|목록 11\|미니맵"` | 8/8 PASS |
| 프리뷰 5020 → `npx playwright test ui-800x360 address-minimap-width ui-redesign-batch1.spec.ts ui-redesign-batch2.spec.ts --workers=1 --retries=0` | 30/30 PASS (`evidence/dock-head-row/ui.log`) |
| 에뮬레이터 실앱 5017 → `run-with-functions-emulator.mjs` … `test ride-entry route-dock-riding-content --workers=1 --retries=0` | 8/8 PASS (`evidence/dock-head-row/live.log`) |

## 캡처 `C:\20.HDev\boxcycle\document\ops\20261023-ui-redesign\evidence\dock-head-row\`

`ready-waypoints2-800x360.png`·`-zoom.png`, `ready-long-667x300.png`·`-zoom.png`, `ready-wide-1280x720.png`·`-zoom.png`, `ready-collapsed-800x360.png`·`-zoom.png`, `riding-expanded-waypoints2-800x360.png`·`-zoom.png`, `riding-wide-1280x720.png`·`-zoom.png`, `ui.log`, `live.log`
