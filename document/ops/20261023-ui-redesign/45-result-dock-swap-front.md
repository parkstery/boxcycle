# 지시·결과 45 — 주소 카드 ⇅ 버튼을 목록 앞쪽으로

2026-10-24 Chief 지시(스케치 `C:\Users\kdrea\Downloads\주소 익스체인지.png`) · **구현 Claude Code(Supervisor 직접)** · 상태 LOCAL_VERIFIED

> Chief: 「주소 exchange 버튼 위치를 앞쪽으로 변경하자.」 스케치: ⇅ 가 출발·도착 점 열 위, 두 점 사이(목록 세로 가운데). 경유지가 있으면 경유 줄을 들여 써서 ⇅ 와 겹치지 않게.

## 바꾼 것

| 파일 | 내용 |
|---|---|
| `apps/web/src/components/route-dock/RouteDock.tsx` | `ol` 과 ⇅ 를 `.route-dock__stops-wrap`(relative)로 묶고 ⇅ 를 그 안으로. 줄에 `route-dock__row--{kind}` 클래스. 아이콘 12px. 오른쪽 칸은 접기 ‹ 자리만(빈 칸) |
| `apps/web/src/components/route-dock/RouteDock.css` | ⇅: `position: absolute; left: -10px; top: 50%` — 점 열 중심(x=4px) 위·목록 세로 가운데. 누르는 영역 28px, 보이는 회색 원 20px(`padding: 4px` + `background-clip: content-box`). 경유 줄 16px 들여쓰기(⇅ 있을 때만). 오른쪽 칸 32→24px(주소 글자 폭 8px 늘어남) |
| `apps/web/e2e/ui-800x360.spec.ts` | 잠금 시험 「Chief 고정12 — ⇅ 는 주소 목록 앞쪽…」: 경유 0·2개 × 800×360·667×300 에서 ⇅ 중심이 출발 점 열 ±1px, 목록 세로 가운데 ±1px, 보이는 원이 점·「출발/경유/도착」 글자와 겹치지 않음, 중심을 누르면 ⇅, 원 20px |
| `document/reference/product/261024-RTW-Chief-지정-디자인-고정.md` | 12번에 자리 추가 |

모양(회색 원 `#f2f3f5`·위아래 화살표 선 아이콘)은 고정 12번 그대로이고 크기만 점 사이에 맞춰 20px로 줄였다. 주행 중(잠금)에는 지금처럼 ⇅ 없음.

## 검증 (실행 폴더 `C:\20.HDev\boxcycle\apps\web`)

| 명령 | 결과 |
|---|---|
| `npx tsc -b --noEmit` | PASS |
| `npx eslint src/components/route-dock/RouteDock.tsx e2e/ui-800x360.spec.ts` | 오류 0 |
| 프리뷰 5020 → `npx playwright test ui-800x360 -g "고정12"` | 2/2 PASS |
| 프리뷰 5020 → `npx playwright test ui-800x360 address-minimap-width ui-redesign-batch1.spec.ts ui-redesign-batch2.spec.ts --workers=1 --retries=0` | 29/29 PASS (`evidence/dock-swap-front/ui.log`) |

## 캡처 `C:\20.HDev\boxcycle\document\ops\20261023-ui-redesign\evidence\dock-swap-front\`

`ready-800x360.png`, `ready-zoom.png`, `ready-waypoints2-800x360.png`, `ready-waypoints2-zoom.png`, `ready-long-667x300.png`, `ready-long-zoom.png`, `ready-waypoint1-long-800x360.png`, `ready-waypoint1-long-zoom.png`, `ui.log`
