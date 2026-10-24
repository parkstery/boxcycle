# 지시·결과 44 — 주소 카드 ⇅·센서·✕·‹ 버튼을 디자인 규칙대로(제안 A)

2026-10-24 Chief 지시 · **구현 Claude Code(Supervisor 직접)** · 상태 LOCAL_VERIFIED

> Chief 원문: 「exchange 버튼과 센서 버튼이 클로드 너와 내가 계획한 디자인 컨셉과 동떨어진 스타일이다. 다시 바로잡아보자. 디자인 계획해서 아티팩트로 내게 먼저 보여줘.」 → 시안(지금 / 제안 A / 대안 B) 비교 후 「제안 A 대로 갑시다. … 또 비슷한 상황이 생길 수 있으니 이건 네가 직접 해.」
>
> 시안: https://claude.ai/artifact/A7XfbAnkZJurSDzkj886Kg (비공개, Chief 계정)

## 원인

기준: [시안 04](mockups/04-Main.png), [디자인 규칙](../20261023-leaderboard/design-system/README.md) 「아이콘」「하지 말 것 2」.

- ⇅ 아이콘을 CSS `linear-gradient` 막대 3개로 흉내 냈다 → 「ıl」 로 읽힘.
- 센서 칩은 예전 「화면 하단 가운데 고정 44px 원」(`.hud-cadence--dock`) 을 카드 안으로 끌어와 덧칠만 했다 → 연한 파란 테두리 + 속 빈 큰 원(LED 0.7rem + 그림자 고리), 혼자 다른 모양.
- ✕ ‹ › 는 글자 기호(굵기·크기 제각각), ✕ hover 빨강(규칙: 빨강 금지, hover 는 `@media (hover: hover)` 안).

## 바꾼 것

| 파일 | 내용 |
|---|---|
| `apps/web/src/components/route-dock/RouteDock.tsx` | `DockIcon`(선 1.7·둥근 끝·`currentColor` 인라인 SVG). ✕ 11px, ⇅ 16px(위·아래 화살표), 접기 ‹ 12px, 펼치기 › 16px |
| `apps/web/src/components/route-dock/RouteDock.css` | 막대 아이콘·글자 크기 규칙 삭제. ✕ hover 빨강 → `@media (hover: hover)` 안 `#121417`. 센서(`.route-dock__footer .hud-cadence--dock` 로 범위 한정): 흰 알약 30px·1px `#c9d6ee`·글자 12px 700 `#2a2e37`·점 7px(미연결 1.5px 고리, 연결 `#1e9a55` 번짐 없음). 열림·hover 는 accent 테두리. 안내 깜빡임(2026-09-18 Chief) 유지하되 accent `#2457d6`·`#eef3fc` 로, 동작 줄이기 설정이면 정지 |
| `apps/web/e2e/ui-800x360.spec.ts` | 잠금 시험 「Chief 고정12」: ⇅ SVG·회색 바탕, ✕ ‹ 글자 없음·SVG, 센서 높이 30·흰 바탕·1px `rgb(201, 214, 238)`·12px 700·점 7px (800×360·667×300) |
| `document/reference/product/261024-RTW-Chief-지정-디자인-고정.md` | 12번 추가 |

바꾸지 않은 것: 카드 폭 250px·줄 높이·버튼 자리, 고정 11번(주행 중 접힘·✕⇅ 없음), 센서 칩 상태 논리(`cadenceSensorUi.ts`), HUD 우상단·`RideControlBar` 의 센서 칩(선택자를 주소 카드 안으로 한정). CSS 는 선택자 우선순위로 이기게 해 로드 순서와 무관(`CadenceHudChip.css` 의 `.hud-cadence--dock:hover`·`--open` 보다 한 단계 구체적).

## 검증 (실행 폴더 `C:\20.HDev\boxcycle\apps\web`)

| 명령 | 결과 |
|---|---|
| `npx tsc -b --noEmit` | PASS |
| `npx eslint src/components/route-dock/RouteDock.tsx e2e/ui-800x360.spec.ts` | 오류 0 |
| 프리뷰 5020 → `npx playwright test ui-800x360 address-minimap-width ui-redesign-batch1.spec.ts ui-redesign-batch2.spec.ts --workers=1 --retries=0` | 27/27 PASS (`evidence/dock-buttons-a/ui.log`), 이후 고정12 추가분 1/1 PASS |
| `npm run test:quick` | 1360 통과 · 0 실패 |
| `node scripts/ride-verify/verify-selectors.mjs` | 19단계 유효 |
| 루트 `node scripts/check-code-tidy.mjs` · `check-dep-direction.mjs --check` · `git diff --check` | PASS |
| 실측(프리뷰, 800×360·667×300) | 센서 59×30, 흰 바탕, 1px `rgb(201,214,238)`, 12px 700, 점 7×7 · ⇅ 32px 원 `rgb(242,243,245)` 안 SVG 16px · ✕ 22px · ‹ 28px · 접힘 › 32px 흰 버튼 · 페이지 오류 0 |

5020 은 끝나고 종료(LISTENING 없음 확인). 실앱 에뮬레이터 시험은 이번 변경이 대기 화면 모양만이라 돌리지 않았다(주행 중 동작은 바뀌지 않음).

## 캡처 `C:\20.HDev\boxcycle\document\ops\20261023-ui-redesign\evidence\dock-buttons-a\`

`ready-800x360.png`, `ready-zoom.png`, `ready-small-667x300.png`, `ready-small-zoom.png`, `ready-sensor-attention-zoom.png`(안내 상태, 동작 줄이기로 고정), `riding-collapsed-800x360.png`, `riding-collapsed-zoom.png`, `riding-expanded-800x360.png`, `riding-expanded-zoom.png`, `ui.log`
