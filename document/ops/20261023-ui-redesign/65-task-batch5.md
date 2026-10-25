# 지시65 — 묶음5 경로 만들기 팝업

2026-10-25 KST · Chief 묶음4 승인 및 묶음5 진행 지시. 커밋·배포 금지.

## 담당·범위

Codex 직접 제품 화면: mapPopupElements.ts 및 경로팝업 전용 CSS. 기존 시안05의 흰300px판·파란 거리 숫자·거리±/프리셋·원형 닫기·간결한 행을 적용한다. 고정13 Start·+WP·End 및 Start·End 탭, 고정1 녹색 원형 재생 등은 시안보다 우선. 시안의 새 자동시작/회귀정책을 도입하지 않는다. 기존 이동수단·거리방향 선택·실제 주행 준비·토큰/오류·키보드/드래그/닫기 동작 보존.

Cursor CLI 소유: 새 apps/web/scripts/ui-redesign-batch5/fixture.html 및 fixture.ts(실제 buildPickPopup 사용), 새 e2e/ui-redesign-batch5.spec.ts, 조사·결과66. 제품 및 기존 preview/e2e 수정금지. 실제 callback 카운터·상태 변화를 fixture로 관측. 기존 fixture/시험 조사해 재사용 가능한 패턴으로 최소 작성. 테스트/서버 실행은 Codex만. 추후 독립감리 별도. 결과67.

## 금지

고정1~14 원문 아래. diff로 고정 동작·형태를 바꾸면 다른 시험 통과해도 FAIL. 기대값/잠금/게이트완화 금지. 미커밋 묶음1~4·기존증거·보존JSON·.out/cdbox 보존. restore/clean/stash/worktree/일괄되돌림·commit/push/deploy 금지. 기존3000/3001/5017/5040 종료금지. 운영Firebase 테스트쓰기 금지. 신규 도메인 정책/새 외부 API 금지.

| # | 날짜 | 화면·요소 | 고정된 모습 | 근거 | 잠금 시험 |
|---|---|---|---|---|---|
| 1 | 2026-10-24 | 주행 시작 버튼(우하단) | **녹색 원형 재생 아이콘, 글자 없음** (커밋 `5671a014` 의 `ride-media-button--play`) | Chief 10-24, [지시 21](../../ops/20261023-ui-redesign/21-task-chief-revert-controls.md) | `e2e/ui-800x360.spec.ts` 「Chief 고정」 |
| 2 | 2026-10-24 | 일시정지 상태 조작 | **글자 없는 아이콘 버튼** — 재개(녹색 재생)·종료(정지)·옵션(⋯). 「주행 끝내기」「다시 달리기」 글자 버튼 금지 | 〃 | 〃 |
| 3 | 2026-10-24 | 지도 스타일(야외/위성)·줌 +/− | **주행 중·일시정지에도 계속 보임** | 〃 | 〃 |
| 4 | 2026-10-24 | 순위 칩(지도 위) | **글자 없는 원형 버튼, 안에 그래프 아이콘.** 순위 숫자는 칩을 눌러 여는 순위판과 접근성 이름에만 | 〃 | 〃 |
| 5 | 2026-10-24 | 경로 목록(입문·퍼블릭·내 경로) 행 | **경로당 한 줄** `[이동수단 아이콘] 이름 … 상태 거리 km`. 이동수단은 글자 대신 경로 찾기 팝업과 같은 아이콘(`lib/route/routeProfileIcons.ts`). 최대한 많은 행 | Chief 10-24, [지시 17](../../ops/20261023-ui-redesign/17-task-route-list-one-line.md)·[19](../../ops/20261023-ui-redesign/19-task-saved-routes-compact.md) | `e2e/ui-redesign-batch1.spec.ts` 한 줄·행 수 단언 |
| 6 | 2026-10-23 | 경로 목록 판 | **흰 불투명 박스 + 어두운 글자** (지도 위 투명 목록 시안 07 대체) | Chief 10-23, [지시 15](../../ops/20261023-ui-redesign/15-task-route-list-surface.md) | `e2e/ui-redesign-batch1.spec.ts` 배경 `rgb(255, 255, 255)` |
| 7 | 2026-10-23 | 지도 위 주행 정보(계기판·순위 목록·코칭) | **바탕 없는 윤곽선 글자** — 지도 면적을 줄이지 않는다 | Chief 10-23, [디자인 규칙](../../ops/20261023-leaderboard/design-system/README.md) 「상태별 원칙」 | — |
| 8 | 2026-10-23 | 거리 단위 | **소문자 km** (KM·Km 금지) | Chief 10-23 | — |
| 9 | 2026-10-23 | 지도 스타일 종류 | 야외·위성 둘만. Spinatlas Dark 없음. 맵 뷰 판에는 스타일·시점·줌 조작 없음(지도 위 버튼이 맡는다) | Chief 10-23, [맵 뷰 다이어트](../../ops/20261023-mapview-diet/00-task.md) | — |
| 10 | 2026-10-24 | 계정 패널 주행 기록 | **현재 인라인 스타일 유지.** 「마지막 주행」을 누르면 계정 패널 안에서 목록 펼침·접기. 전용 기록 판으로 대체하지 않는다 | Chief 10-24 비교 후 결정, [지시26](../../ops/20261023-ui-redesign/26-task-inline-history-finalize.md) | `e2e/ui-800x360.spec.ts` 인라인 기록 |
| 11 | 2026-10-24 | 주행·일시정지 중 출발·도착 주소창 | **숨기지 않고 접는다.** 주행을 시작하면 주소 카드가 **접힌 상태**(› 펼치기 버튼만 보임)가 되고, 누르면 미니맵 바로 위에 펼친 미니맵과 좌우 끝이 같은 흰 카드로 펼쳐진다. 주행 중엔 ✕·⇅ 없음(잠금). 대기 화면 카드는 펼침·**폭 = 주행 중 펼친 카드(미니맵)와 같은 29.4vw**(10-24 Chief, 종전 250px 대체). 경유 줄은 대기·주행 모두 들여 씀 | Chief 10-22(미니맵 폭 맞춤)·10-24 「주행 중 주소창이 안 보인다」「숨기는 게 아니라 접는다로 해야 한다」, [지시35](../../ops/20261023-ui-redesign/35-task-riding-address-dock.md)·[지시39](../../ops/20261023-ui-redesign/39-task-riding-address-dock-collapse.md) | `e2e/ui-800x360.spec.ts` 「Chief 고정 — 목록 11」, `e2e/address-minimap-width.spec.ts`, `e2e/route-dock-riding-content.spec.ts` |
| 12 | 2026-10-24 | 주소 카드 안 버튼(⇅·센서·✕·‹›) | **시안 04 그대로(제안 A).** ⇅ = 회색 원(`#f2f3f5`) 안 위·아래 화살표 선 아이콘, **자리는 주소 목록 앞쪽 — 점 열 위·목록 세로 가운데(출발·도착 점 사이), 보이는 원 20px, 경유 줄은 들여 씀**(10-24 Chief 스케치, [결과45](../../ops/20261023-ui-redesign/45-result-dock-swap-front.md)). 센서 = 흰 알약 30px·1px `#c9d6ee` 테두리·7px 점·12px 굵은 글자(연결 시 초록 점, 안내는 accent 파랑 깜빡임). ✕ ‹ › = 선 1.7 아이콘, 글자 기호 금지. **대기 화면: 센서(왼쪽)·접기(오른쪽)가 카드 맨 위 한 줄, 접으면 그 한 줄만 남음. 주소 ✕ 는 오른쪽 끝**(10-24 Chief, [결과46](../../ops/20261023-ui-redesign/46-result-dock-head-row.md)) | Chief 10-24 「디자인 컨셉과 동떨어진 스타일」→ 시안 비교 후 「제안 A 대로」, [결과44](../../ops/20261023-ui-redesign/44-result-dock-buttons-proposal-a.md) | `e2e/ui-800x360.spec.ts` 「Chief 고정12」 |
| 13 | 2026-10-24 | 경로 지점 이름·기호(주소 카드·지점 팝업) | **영어로 통일, 지도 핀과 같은 기호.** 주소 카드 줄 = 기호 + 주소(「출발·경유·도착」 이름표 없음). 기호 = 16px 원 S(초록 `#16a34a`) · 1 2 3(주황) · E(빨강 `#dc2626`), 지도 핀과 같은 색·글자. ⇅ 는 기호 열 위·S·E 사이(보이는 원 14px), 줄 30px. 지점 팝업 버튼 「Start · +WP · End」, 탭 「Start·End」(화면 읽기 이름은 한국어) | Chief 10-24 「출발·도착 대신 Start·End, 영어로 통일」「기호들을 통일되게」→ 시안 비교 후 「A」, [결과47](../../ops/20261023-ui-redesign/47-result-dock-badges-start-end.md) | `e2e/ui-800x360.spec.ts` 「Chief 고정12 — ⇅ …기호…」, `e2e/route-media-controls.spec.ts` |
| 14 | 2026-10-24 | 측면 메뉴 진입(왼쪽 MENU·오른쪽 맵 뷰) | **좌우 가장자리 흰 반투명 반원 탭.** 보이는 반원 14×48px(`rgba(255,255,255,0.78)`·짙은 › ‹), 누르는 영역 28×64px, 계기판 바로 아래(위에서 84px). 누르면 열림, 탭이나 가장자리에서 끌면 손가락 따라 열림, 판이 열리면 그 탭은 숨김. 왼쪽 아래 카드 묶음은 탭 자리만큼 16px 띄움 | Chief 10-24 「메뉴가 보이지 않으니 불편」→ 반원 탭 시안 → 「흰 반투명」, [결과48](../../ops/20261023-ui-redesign/48-result-edge-tab.md) | `e2e/ui-800x360.spec.ts` 「Chief 고정14」 |

## 검증

800×360·667×300·844×390, location/distance/출발없음/경유최대/토큰부족/탐색오류/주행준비조건. Start+WP End와 탭 이름·1개 이동수단 행·선택·거리±/숫자/프리셋·검색 상태·토큰·원형 시작 및 disabled·닫기/키보드. 실제 DOM 레이아웃 및 콜백 검증. 기존 popup/media/distance 시험·고정 화면 회귀·단위/타입/lint/selector/tidy/dep/doc/diff. evidence/instruction65 전용으로 캡처하여 before/after/시안을 비교 HTML로 만들고 Chief에게 직접 연다. 시작해시 대조 및 시험서버 종료 후 HANDOFF/PROGRESS/README/결과67 갱신.
