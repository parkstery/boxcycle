# 02-result-cursor — 경로 생성 창 아이콘·너비 축소

Cursor. 2026-10-29. [01-task](01-task.md) 승인 시안 구현. 커밋·푸시·배포 없음. 기존 dirty·기존 증거 보존. HANDOFF·고정목록·ops README는 지시대로 미수정.

## 변경

제품

- `apps/web/src/components/map/mapPopupElements.ts` — 모드 탭 텍스트를 SVG 아이콘으로 교체. 출발·도착은 경로 두 지점(Lucide `route` path, 기존 스트로크 1.75), 거리·방향은 자+화살표(`ruler`+`navigation-2`). aria `출발·도착`/`거리·방향`·title·키보드 탭 계약 유지. 주소는 긴 내용 title 유지.
- `apps/web/src/components/map/RoutePickPopup.css` — 창 300→228px, 모드 50×28, Start/+WP/End 46×28, 프리셋 1/3/5/10/20 각 30×28 gap4(남은 공간 강제 확장 없음), 경로 삭제 padding 7px·빨간 테두리·탭과 한 줄, 거리 행을 228 안에 재배치(± 28px, 숫자 20px 서식 `N.0` 유지), 하단 수단 28·gap6·녹색 원 32 줄바꿈 없음. 패딩 16/14 유지.
- `apps/web/src/components/map/MapView.css` · `MapView.tsx` — 도킹 패널·앵커 팝업 maxWidth 228px(레이아웃만).
- `apps/web/scripts/ui-redesign-batch5/fixture.ts` — 떠 있는 팝업 maxWidth 228px.

시험

- `apps/web/e2e/ui-redesign-batch5.spec.ts` — 아이콘 탭·4가로×도킹/앵커 실측 228·50/46/30·비겹침·overflow0, 긴 주소/120.0 입력.
- `apps/web/e2e/route-media-controls.spec.ts` — 핀 46px·창 228px 기대.

새 의존성·App.tsx·탐색·서버·Rules 없음.

## 실측 기하 (fixture, offsetWidth)

800×360·736×300·699×273·667×300, location(도킹)·distance(도킹)·no-start(지도 앵커) 모두:

| 항목 | 목표 | 실측 |
|---|---|---|
| `.map-view__pick` 폭 | 228 | 228±1 |
| 가로 overflow | 0 | scrollWidth−clientWidth ≤1 |
| 모드 탭 | 50×28 | 50×28 |
| Start/+WP/End | 46×28 | 46×28 |
| 프리셋 1/3/5/10/20 | 30×28 | 30×28 |
| 수단 3개 | 28×28 | 28×28 |
| 주행 원 | 32×32 | 32×32, 줄 오른쪽 끝 |
| 탭·경로 삭제 | 한 줄·겹침 없음 | PASS |
| 하단 수단+주행 | 한 줄 | PASS |

거리 입력행은 내용폭 198px 안에 목표 거리 · − · 숫자 · km · + 순서. `120` Enter → `120.0`. 긴 주소는 줄바꿈·title 유지·가로 overflow 없음.

## 검증

실행 폴더 `C:\20.HDev\boxcycle\apps\web`. 기존 5031 HTTP200 재사용.

증거 `C:\20.HDev\boxcycle\document\ops\20261029-route-popup-compact\evidence\cursor\` (기존 PNG 경로 미사용).

| 명령 | 결과 |
|---|---|
| `npx tsc -b --noEmit` | PASS exit0 |
| `npx eslint` 변경 TS 5파일 | 오류0 · MapView 기존 경고10 |
| `node scripts/ride-verify/verify-selectors.mjs` | 20/20 PASS |
| Playwright `ui-redesign-batch5` + `route-media-controls` + `distance-direction-attention` + `route-ride-controls` workers1 retries0 RTW_DEV_PORT=5031 | **51 PASS** |
| Playwright `map-route-runtime` `--grep 실제 MapView` | 2 PASS |
| `npx tsx --test scripts/distance-auto-route/distance-auto-route-contract.test.ts` | 56 PASS |
| `npm run build` | PASS exit0 (청크 크기 경고 기존) |
| 루트 `node scripts/check-dep-direction.mjs --check` | PASS |
| 루트 `node scripts/check-code-tidy.mjs` | PASS 기준선 이내 exports 186 |
| `git diff --check` | PASS |
| Playwright `ride-summary-compact` 「Start·End 탭으로 바꾸면…」 | FAIL `fetch failed` cause `ECONNREFUSED 127.0.0.1:8080` — 실앱 `/`+시드가 에뮬레이터를 요구. 이번 UI 변경과 무관한 환경. 탭 aria/동작은 batch5·route-ride-controls로 검증 |
| `npm run test:quick` · 전체 서버 시험 | **생략** (지시: UI 한정) |
| 실폰 / 실 Firebase 진입 / 실 탐색 요금 | **미실행** |

캡처 눈검수: `compact-location-699x273.png` · `compact-distance-699x273.png` — 아이콘 탭, 경로 삭제 빨간 테두리 한 줄, Start/+WP/End, 거리 5.0 km·칩 1 3 5 10 20, 하단 수단·녹색 원.

## 범위 밖·참고

- 거리 숫자 글자 26px→20px, ± 32→28, 칩 글자 14→12. 기능·`toFixed(1)`·파란 숫자는 유지. 228px 안에 넣기 위한 시안 기하.
- 수단 버튼이 기존 `flex:1`에 늘어나 첫 실측이 실패 → `flex: 0 0 28px`로 고정 후 재통과.
- 고정13/15/49는 Codex 소유라 이번 파일에서 수정하지 않음.

## 남은 일

Codex `03-review.md` 독립 감리. Chief 실폰 확인·배포는 별도 지시. 에뮬레이터 실앱 탭 회귀는 8080이 있을 때 `ride-summary-compact` 해당 1건.

## 확인 순서

```
cd C:\20.HDev\boxcycle\apps\web
# 기존 5031 재사용. 없으면:
npm run dev:localhost -- --port 5031
```

1. http://localhost:5031/ 새로고침
2. 지도를 길게 눌러 경로 생성 창
3. 모드가 아이콘인지, 창이 이전보다 좁은지, Start/+WP/End·거리 1/3/5/10/20·경로 삭제·하단 수단/녹색 원 동작
4. 거리·방향 탭에서 ±·숫자·프리셋, 키보드 화살표로 탭 전환

커밋·푸시·배포 없음. 5031 유지.
