# 03 감리 — 간편 인터벌 주행 01

2026-10-29 Claude Code(Opus 5.5) Supervisor. 구현은 impl-standard(Claude 하위 agent)가 했다. Cursor CLI 호출이 분류기에 막혀 대체했는데, 원인은 감리자가 허용 규칙 밖의 명령 형식을 쓴 것이었다. 대상은 [02 결과](02-result-impl-standard.md)(최초 + 재작업 1).

## 판정: PASS

## 1차 감리 → 재작업 1

| 항목 | 1차 | 처리 |
|---|---|---|
| `.ts` 확장자 import(src 안에서 유일) | 관례 위반 | 감리자 수정. 저장소 로더 `scripts/s42/register-vite-env.mjs`가 확장자 없이 푼다 |
| 새 시험 폴더가 test-quick 묶음 목록에 없음 | 누락 | 감리자 수정(`GROUPS.route`에 `quick-interval` 추가) |
| dep-layers 미지정 2파일 | check-dep-direction M0 FAIL | 감리자 등록(route/intervalRouteDistance, ride/quickIntervalRoute). 분류 추가일 뿐 규칙 완화 아님 |
| code-tidy | App.tsx 3831 > 3807, knip exports 189 > 186 | 재작업: 이어 달리기와 공통인 `beginRouteFromAnchor`로 복사를 없앰. 연결 코드는 훅으로 옮김. App.tsx 3790, exports 186 |
| 실앱 검증 없음(하네스 빈 지도 캡처뿐) | Chief에게 보여줄 수 없음 | 재작업: `e2e/quick-interval-live.spec.ts`(실제 App·Mapbox·에뮬레이터, getDistanceAutoRoute만 스텁) |
| 실패 안내가 두 줄 | 800×360에서 접힘 | 재작업: 한 줄, top 44px(667×300에서 우상단과 겹치던 것 해소) |

## 감리자 직접 재검증 (`C:\20.HDev\boxcycle\apps\web`)

| 명령 | 결과 |
|---|---|
| `npx tsc -b --noEmit` | PASS |
| eslint(바뀐·새 TS 15개) | 오류 0, 경고 17(App 7·MapView 10, 기존) |
| `npm run test:quick` | 1467 통과 / 0 실패 |
| `node scripts/ride-verify/verify-selectors.mjs` | 21단계 유효 |
| `npm run build` | PASS |
| 루트 `node scripts/check-code-tidy.mjs` | 기준선 이내(exports 186, App.tsx 3790) |
| 루트 `node scripts/check-dep-direction.mjs --check` | 통과 |
| Playwright: quick-interval-ride + distance-route-continuation·interval-dock-confirm·ride-interval-settings·left-menu-supervisor·ride-interval(포트 5046) | 38 passed |
| 실앱 quick-interval-live(에뮬레이터) | 1차 3회 연속 1/2 FAIL → 재작업 2 후 감리자 실행 2/2 PASS |
| `npm run test:e2e:ride`(실주행 진입, 에뮬레이터) | 7/7 PASS |

## 실앱 시험 FAIL 조사 — 「주행 종료 뒤 화면이 계속 다시 그려지나?」

- 실패 지점: 주행 종료 → 결과 시트 닫기 → 「메뉴 열기」 클릭이 계속 detached 재시도로 15초 초과. 구현자는 결과 시트 닫기를 DOM click 폴링으로 우회해 두었다. 우회로가 결함을 가릴 수 있으므로 계측했다.
- 계측 방법: MutationObserver로 6초 동안 결과 시트 닫기 버튼과 왼쪽 반달이 DOM에서 제거된 횟수를 셌다. 임시 e2e로 실행하고 실행 후 삭제했다.

| 경우 | 결과 시트 뜬 직후 6초 | 다음 6초 | 닫은 뒤 6초 |
|---|---|---|---|
| 일반 주행(입문 코스), **현재 코드** | 반달 1·닫기 1·시트 3 | — | 0 |
| 일반 주행(입문 코스), **HEAD(f2b54b4b)** | 반달 1·닫기 1·시트 3(동일) | — | 0 |
| 간편 인터벌 경로 주행, 현재 코드 | 반달 1·닫기 1·시트 2 | 0 | 0 |

- 1차 결론(재마운트 횟수만 셈)은 버튼이 아예 없는 경우를 「안정」으로 잘못 읽었다. 계측을 고쳐 실제 클릭으로 다시 확인했다.
- 일반 주행 → 결과 시트 → 메뉴 열기: 현재 코드와 HEAD 모두 메뉴가 열린다(동일).
- 간편 경로 주행: 결과 시트가 adhoc 형태(「내 경로로 저장 / 저장 안 함」)라 `.ride-summary__close` 가 없다. 시험이 `.ride-summary__close` 개수 0을 「닫힘」으로 오인해, 시트가 열린 채(반달 숨김) 「메뉴 열기」를 눌렀다. **시험 결함**이다.
- 재작업 2: 사용자 방식인 「저장 안 함」으로 닫도록 고쳤다. 「저장 안 함」 뒤에도 Ride 기록과 다음 출발점은 남는다(제품 주석과 일치). 구현자의 「기록 안 남음」 보고는 정정했다.
- 별도 기존 결함 후보(간편 인터벌과 무관, HEAD 동일): 일반 주행 결과 시트에서 `dismissRideSummaryIfAny` 의 「닫기」 클릭이 10초 안에 성공하지 못한다. 실손가락 확인과 원인 조사가 필요하다. 앞서 의심한 `loadIntroCourse` 문제는 test:e2e:ride 7/7 통과로 해소됐다(계측 시험 쪽 순서 문제였음).

## 화면 (실제 앱, 로컬 에뮬레이터, 경로 탐색 응답만 스텁 — 경로선이 직선인 것은 스텁 때문이다)

`evidence/live/`: b1 메뉴 행 · b2 출발지 안내 · b3 경로 적용(INT 켜짐, 주행 미시작) · a1 지난 주행 끝에서 클릭 없이 경로 · c1 실패 안내 한 줄(800×360·667×300).

## 범위·보존

- 커밋된 증거 `20261029-left-menu/evidence/interval-custom-699x273.png`를 회귀 시험이 덮어써서 `git checkout --`로 원복했다.
- 미실행: 실폰, 운영 Firebase, 실제 Mapbox Directions 경로(도로를 따라가는 선).
- 새 상단 안내 띠(QuickIntervalStatus)는 새 화면 요소다. Chief 확인 후 고정 목록에 올린다.
