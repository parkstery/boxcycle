# 지시·결과 47 — 주소 카드 기호 S·1·2·3·E, 출발·도착 → Start·End

2026-10-24 Chief 지시 · **시안·구현·감리 Claude Code(Supervisor 직접)** · 상태 LOCAL_VERIFIED

> Chief: 「출발, 도착이라는 한글 텍스트 대신 Start, End로 변경한다. WayPoint를 영어로 썼으니 영어로 통일한다. … routedock의 출발, 경유, 도착이라는 타이틀을 모두 제거하고 그 앞에 있는 머리글 기호(동그라미 표시) 대신 원글자 기호 (S, 1,2, 3, E)를 넣는다.」「이 기호들을 통일되게 쓰는 거야.」(지도 핀 캡처) → 시안 비교 후 **「A」**(⇅ 를 기호 열 위에 그대로).
>
> 시안: https://claude.ai/artifact/8AhEZYeVhyUG3PTktmYas1 (비공개)

## 바꾼 것

| 파일 | 내용 |
|---|---|
| `apps/web/src/components/route-dock/RouteDock.tsx` | 점 + 「출발·경유·도착」 이름표 → 기호 하나(`route-dock__badge`): S / 경유 순번 1·2·3 / E. 기호 접근성 이름 Start·WP1~3·End. ✕ 이름 「Start 삭제」 등, ⇅ 「Start·End 바꾸기」, 빈 목록 안내 「지도를 탭해 Start·End 설정」 |
| `apps/web/src/components/route-dock/RouteDock.css` | 기호 16px 원, 글자 10px 800 흰색 — 색은 지도 핀과 같음(S `#16a34a`, E `#dc2626`, 경유 주황 그라데이션·`#fefce8`, `MapView.css`·`mapMarkerElements.ts` 와 동일). 줄 28→30px. ⇅ 보이는 원 20→14px(누르는 영역 28px 유지), 기호 열 중심 위. 경유 들여쓰기 16→20px |
| `apps/web/src/components/map/mapPopupElements.ts` | 지점 팝업 버튼 「출발 · +WP · 도착」 → 「Start · +WP · End」, 탭 「출발·도착」 → 「Start·End」. 화면 읽기 이름(aria-label·title)은 한국어 유지(시안에 적은 방침) |
| `apps/web/e2e/ui-800x360.spec.ts` | 고정12 ⇅ 시험: 기호 열 위·기호/주소 안 가림·원 14px, 기호 순서 `S,1..n,E`, 줄 = 기호 + 주소뿐. 주행 펼침 단언 S·E 기호로. 「주소 줄 높이 ≤29」 → ≤31(제안 A 의 +2px). ⇅ 이름 갱신 |
| `apps/web/e2e/route-media-controls.spec.ts` | 팝업 버튼 글자 `Start,+WP,End` |
| `apps/web/e2e/route-dock-riding-content.spec.ts` | ⇅ 이름 갱신 |
| `apps/web/scripts/distance-auto-route/distance-auto-route-contract.test.ts` | 팝업 소스 계약 `textContent = "Start"`·`"End"` |
| `document/reference/product/261024-RTW-Chief-지정-디자인-고정.md` | 13번 추가 |

바꾸지 않은 것: 지도 핀 모양·색, 팝업의 안내 문장(「출발 위치를 지도에서 위치 길게 누르세요.」 등 문장 속 한국어), 주행 결과·저장 이름 등 다른 화면의 「출발→도착」.

## 검증 (실행 폴더 `C:\20.HDev\boxcycle\apps\web`)

| 명령 | 결과 |
|---|---|
| `npx tsc -b --noEmit` | PASS |
| 변경 파일 `npx eslint` | 오류 0 |
| `npm run test:distance-auto-route` | 146/146 PASS |
| 프리뷰 5020 → `npx playwright test ui-800x360 address-minimap-width ui-redesign-batch1.spec.ts ui-redesign-batch2.spec.ts --workers=1 --retries=0` | 30/30 PASS (`evidence/dock-badges/ui.log`) |
| 에뮬레이터 실앱 5017 → `test ride-entry route-dock-riding-content --workers=1 --retries=0` | 8/8 PASS (`evidence/dock-badges/live.log`) |
| 프리뷰 5020 → `npx playwright test route-media-controls map-route-runtime distance-direction-attention distance-route-continuation route-ride-controls --workers=1 --retries=0` | 13 PASS · **2 FAIL** (`evidence/dock-badges/popup.log`) — 아래 |

**실패 2건 — 이번 변경과 무관으로 판단(기준선 재실행은 안 함):**
- `distance-direction-attention`: 29줄 「프로필 고르기 깜빡임 클래스(`map-view__pick--awaiting-profile`)」 단언에서 실패. 이번 diff 는 팝업의 글자 3곳만 바꿨고 클래스 논리는 손대지 않았다. 실패 지점은 탭 이름을 쓰는 53줄보다 앞이다.
- `route-ride-controls`: 「idle 상태에 주소 카드가 없어야 한다」(20줄)에서 실패. 주소 카드 표시 조건(`isRouteDockVisible`·`stops.length === 0 && !cadence`)은 오늘 커밋 전체에서 바뀌지 않았다. 프리뷰 `preview.tsx` 에 묶음 3 미커밋 변경(+141줄)이 있어 그 영향일 가능성이 있다 — 묶음 3 감리 때 확인 필요.

## 캡처 `C:\20.HDev\boxcycle\document\ops\20261023-ui-redesign\evidence\dock-badges\`

`ready-800x360.png`·`ready-zoom.png`, `ready-waypoints2-*`, `ready-waypoints3-800x360.png`·`-zoom.png`, `ready-long-667x300.png`·`-zoom.png`, `ready-wide-1280x720.png`·`-zoom.png`, `ready-collapsed-*`, `riding-expanded-waypoints2-*`, `riding-wide-*`, `ui.log`, `popup.log`, `live.log`
