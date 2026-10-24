# 전체 화면 디자인 변경 (2026-10-23~)

chief 가 승인한 시안대로 앱 화면을 묶음 단위로 바꾼다. 묶음마다 시안 대 실제 캡처를 chief 에게 보이고 승인받은 뒤 다음 묶음으로 간다.

**2026-10-24 Chief 기준:** 현재 UI·UX의 낮은 품질을 개선한다. 화면 교체 자체를 목표로 삼지 않고 정보 위계·일관성·조작 흐름·스마트폰 가로 공간 밀도를 높인다. 주행 기록은 **현재 인라인 스타일 유지**로 확정([지시26](26-task-inline-history-finalize.md)). 첫 라이딩 카드 삭제와 함께 마감 검증 중. 묶음1·2는 이미 10-24 호스팅 배포됨(아래 10-23 표의 로컬 표시는 당시 기록).

- **시안 원본(리포):** [mockups/](mockups/) — `NN-이름.html`(브라우저로 열기)·`NN-이름.png`. 목록은 아래 표.
- **chief 열람용 캔버스(Claude 전용):** https://claude.ai/artifact/NWrpXU7boGovvs8EixVcdN — 리포 사본과 같은 내용. 시안을 고치면 리포 사본이 먼저다.
- **디자인 규칙:** [../20261023-leaderboard/design-system/README.md](../20261023-leaderboard/design-system/README.md) + `tokens.json`. 핵심:
  - 판 하나에 주인공 숫자 하나, 강조색은 파랑 `#2457d6` 하나.
  - 단위는 소문자 km.
  - 지도 위(계기판·순위·코칭)는 바탕 없는 윤곽선 글자, 판(메뉴·목록·결과·설정)은 흰 바탕.
  - 버튼은 4종(주·보조·글자·아이콘).
- **교대 규칙:** [수퍼바이저 교대 플레이북](../../reference/operations/261023-RTW-수퍼바이저-교대-플레이북.md).

- **다음 Supervisor:** [상세 인계](13-handoff-next-supervisor.md) · [첫 프롬프트](14-first-prompt-next-supervisor.md)

**최신 경로 목록 지시:** [15 가독성 보완](15-task-route-list-surface.md) → [결과·감리 16](16-result-route-list-surface.md), LOCAL_VERIFIED — 입문/퍼블릭/내 경로의 투명 시안은 흰 불투명 패널로 변경. 주행 순위 투명 유지. [최신 비교](comparison-route-list-surface.html).

**경로 목록 한 줄 행(10-24):** [지시 17](17-task-route-list-one-line.md) → [결과 18](18-result-route-list-one-line.md) → [재지시 19](19-task-saved-routes-compact.md) → [결과·감리 20](20-result-saved-routes-compact.md), LOCAL_VERIFIED. [비교](comparison-route-list-one-line.html).

## 시안별 상태 (2026-10-23 기준)

| # | 시안 | 상태 | 비고 |
|---|---|---|---|
| 01 | [순위 칩 + 순위판](mockups/01-LbMap.png) | ✅ 배포 | `5ab00ad6` |
| 02 | [주행 중 앞뒤 2명](mockups/02-LbRiding.png) | ✅ 배포 | 〃 |
| 03 | [주행 결과 순위 줄](mockups/03-LbSummary.png) | ◐ | 지금 결과 시트에 한 줄만. 결과 시트 전체는 10번과 함께 |
| 04 | [지도 대기 — 경로 도크](mockups/04-Main.png) | ◐ 로컬 검증 | 묶음 2, [감리](10-review-batch2.md) |
| 05 | [경로 만들기 팝업](mockups/05-RoutePick.png) | ⬜ | 묶음 5. 팝업이 `mapPopupElements.ts`의 DOM 생성 코드(React 밖) |
| 06 | [MENU](mockups/06-Menu.png) | ◐ 로컬 검증 | 묶음 1, [감리](05-review-batch1.md)·Chief 화면 확인 대기 |
| 07 | [경로 목록](mockups/07-RouteList.png) | ◐ 로컬 검증 | 묶음 1, [시안 비교](comparison-batch1.html)·미배포 |
| 08 | [주행 중](mockups/08-Riding.png) | ◐ 로컬 검증 | 묶음 2, [비교](comparison-batch2.html) |
| 09 | [일시정지](mockups/09-Paused.png) | ◐ 로컬 검증 | 묶음 2, [감리](10-review-batch2.md) |
| 10 | [주행 결과](mockups/10-Summary.png) | ⬜ | 묶음 3. 주인공 숫자 = 새 도로 |
| 11 | [다음 주행](mockups/11-NextRide.png) | ⬜ | 묶음 3 |
| 12 | [케이던스 센서](mockups/12-Sensor.png) | ⬜ | 묶음 4 |
| 13 | [주행 설정](mockups/13-Settings.png) | ⬜ | 묶음 4. 체중·강도는 프로필 수정으로 옮김 |
| 14 | [맵 뷰](mockups/14-MapView.png) | ◐ | 컨트롤 정리 배포됨(`649045b0`). 판 모양은 묶음 4 |
| 15 | [프로필 수정](mockups/15-Profile.png) | ⬜ | 묶음 4 |
| 16 | [앱 소개](mockups/16-Intro.png) | ⬜ | 묶음 6 |

시안 밖에서 이미 새 규칙으로 끝난 화면: 계정 패널, 리더보드 전체 보기, 위치 선택 창(모두 배포).

## 묶음 계획

| 묶음 | 화면 | 상태 |
|---|---|---|
| 1 | MENU + 경로 목록 | LOCAL_VERIFIED — [감리](05-review-batch1.md)·[비교](comparison-batch1.html), Chief 화면 확인 대기 |
| 2 | 지도 대기 · 주행 중 · 일시정지 (지도 위 조작부: 카메라 1~6 → 버튼 하나, 정지 버튼 색, 코칭 문구 한국어, 출발 전 0 대신 경로·고도) | LOCAL_VERIFIED — [감리](10-review-batch2.md)·[비교](comparison-batch2.html), Chief 화면 확인 대기 |
| 3 | 주행 결과(두 칸 판) + 다음 주행 | 대기 |
| 4 | 센서 · 주행 설정 · 맵 뷰 · 프로필 수정 | 대기 |
| 5 | 경로 만들기 팝업 | 대기 |
| 6 | 앱 소개 | 대기 |

각 묶음:
1. 수퍼바이저가 지시서 `NN-task-묶음N.md`를 쓴다(시안 경로, 규칙, 금지, 검증, 캡처 경로).
2. Cursor 가 구현한다.
3. 수퍼바이저가 [플레이북 §4](../../reference/operations/261023-RTW-수퍼바이저-교대-플레이북.md)대로 감리하고, 결과 파일에 「감리」 절을 붙인다.
4. chief 에게 시안·캡처를 나란히 보이고 승인받는다.
5. 커밋·푸시. 배포는 묶음 2개 정도를 모아 chief 승인 후 한다.

## chief 결정 대기

1. 해결: 「어디에서 첫 라이딩을 할까요?」 카드 삭제(Chief 10-24).
2. 해결: 주행 기록 panel 비교안 미채택, 기존 인라인 스타일 유지(Chief 10-24). 비교용 연결·플래그 제거, 기존 기록별 행동 보존.

시안 승인으로 정해진 것: 주행 결과의 주인공 숫자 = 「새 도로」, 체중·강도 입력은 프로필 수정에만.
