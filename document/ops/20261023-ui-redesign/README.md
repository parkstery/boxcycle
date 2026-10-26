# 전체 화면 디자인 변경 (2026-10-23~)

2026-10-26: [지시82](82-task-intro-mark-three-turns.md) → [결과82](82-result-intro-mark-three-turns.md). 인트로 Spinatlas 심벌 반대 방향 3회·3.3초 후 정지, reduced-motion 유지·잠금 시험 추가. [조사83](83-investigation-all-road-network-frame.md): 「전체 도로망」이 조밀한 연결 지역만 선택하는 현재 알고리즘·시험 계약을 원인으로 확정, 밀도 중심 반구 프레임 구현안 작성(제품 로직 미변경).

2026-10-26 09:16 KST: [지시80](80-task-entry-location-before-next-ride.md) → [결과81](81-result-entry-location-before-next-ride.md). **LOCAL_VERIFIED**·기능 커밋 `4549356d`·로고 `f39f6ee2`(`main2` 로컬, 미푸시·미배포). 다음 Chief 로컬 화면 확인·푸시/배포 별도 지시 대기. 다음 82.
2026-10-26 09:14 KST: [지시80](80-task-entry-location-before-next-ride.md) → [결과81](81-result-entry-location-before-next-ride.md). **LOCAL_VERIFIED**·Supervisor PASS(`entryLocation.phase==="ready"`만; 1차 `!entryLocationPrompt` FAIL). 계약 5/5·build·게이트 PASS; quick 1365·entry-location-dom 병렬 timeout→단독 1/1. localhost:5000 HMR. 다음 82.
2026-10-26 09:02 KST: [지시80](80-task-entry-location-before-next-ride.md) → [결과81](81-result-entry-location-before-next-ride.md). 위치 prompt 중 idle 후속 카드(`nextRide`·첫 주행) 단일 게이트·정적 회귀 5/5(Codex 재검증·tsc0). Cursor 후속: 시험 eslint `no-regex-spaces`만. 미커밋·미배포. 다음 82.

2026-10-26 02:48 KST: [지시78](78-task-spinatlas-logo-replacement.md) → [결과79](79-result-spinatlas-logo-replacement.md). Spinatlas 심벌·파비콘을 `public/spinatlas-mark.svg` 단일 정본으로 통일(Codex 인수·Cursor 구현). 미커밋·미배포. 다음 80.

2026-10-25 19:50 KST: **묶음3·4·5(+지시74)·지시75·로고 심벌 커밋·푸시·호스팅 배포 완료**(`e19dc0e7`…`54eaa5e7`, 운영 자산 SHA256 일치). 에뮬레이터 실앱 시험은 미실행으로 배포(Chief 지시). 아래 표의 「미커밋」 표시는 배포 전 기록이다.

2026-10-25 KST: Supervisor Claude Code 재인수. [감리73](73-review-claude-batch3-5.md)(묶음3~5 독립 감리, 고정1~14 PASS, 묶음5 가 깨뜨린 옛 시험 9건 교정). Chief 묶음5 승인 조건 → [지시74](74-task-result-popup-bottom-row.md) 팝업 두 탭 맨 아래 줄 통일(고정15). Chief 결정 → [지시75](75-task-result-guest-no-logout.md) 게스트 로그아웃 제거. 모두 Claude Code 직접. 지시72 묶음6 은 중단·무효. 다음 76.

2026-10-25: Chief 묶음4 승인·묶음5 진행. [지시65](65-task-batch5.md) → [결과67](67-result-batch5.md) 최종 감리 완료. 회귀100PASS/1SKIP·팝업36PASS·실앱2PASS·타입가드후1PASS·quick1360PASS·tsc PASS. [최종 비교](comparison-batch5-final.html). Codex 제품·감리·캡처 / Cursor 조사·fixture·시험66·독립diff감리68. 커밋·배포 금지 유지.

2026-10-25 07:02 KST: [지시63](63-task-executor-availability.md)·[실행자 확인64](64-result-executor-availability.md). OpenCode 무료 GLM 실제 한도초과, Cursor CLI 읽기 점검 정상. 제품 변경 없이 실행자 운용 기록. 다음65.

2026-10-25: Chief 묶음3 화면 승인·묶음4 진행 승인. [지시58](58-task-batch4.md) → [결과59](59-result-batch4.md) LOCAL_VERIFIED / Chief 화면 확인 대기. Codex 제품·감리·캡처 / Cursor fixture·시험·독립 diff 감리62. 화면64+최종21, 실앱8·동기화2, quick1360 PASS. [최종 비교](comparison-batch4-final.html). 기존 고정 및 묶음3 보존, 커밋·배포 금지.

2026-10-24 23:15 KST: [지시55](55-task-batch4-preparation.md) → [Cursor 준비계획56](56-plan-batch4.md) → [감리57](57-review-batch4-preparation.md). [묶음4 시안 검토](comparison-batch4-plan.html) 준비 완료, 제품 구현 없음. 묶음3 화면 확인 대기 유지. 다음 구현 지시58.

2026-10-24 밤: [지시52](52-task-ride-continuation.md) → [결과·감리53](53-result-ride-continuation.md) 완료. Codex 직접 RC1 위치 안내·내부 닫기 및 RC2~4 옛 UI 동작 교정 후 전체 연속 주행7/7 PASS(6.7분·exit0). 제품 UI·묶음3 미커밋 보존, 커밋·배포 없음. [Cursor 독립감리54](54-review-cursor-continuation.md) PASS.

2026-10-24 21:33 KST: **Codex Supervisor 인수 완료**. [인수 대조 결과](supervisor-intake-20261024-night.md). 묶음3은 미커밋·Chief 확인 대기 유지, 오늘 변경 위 재시험은 다음 작업. 다음 지시서 번호 50.

2026-10-24 밤: [지시50](50-task-batch3-revalidation.md) → [결과·감리51](51-result-batch3-revalidation.md). Codex 직접 재검증·교정·캡처. 최신 [비교 화면](comparison-batch3-instruction50.html). 묶음3 미커밋 유지·Chief 화면 확인 대기, 커밋·푸시·배포 없음. 아래 화면·묶음 표의 배포 상태를 현재 사실로 정리했다. 다음 지시 번호52.

chief 가 승인한 시안대로 앱 화면을 묶음 단위로 바꾼다. 묶음마다 시안 대 실제 캡처를 chief 에게 보이고 승인받은 뒤 다음 묶음으로 간다.

**2026-10-24 Chief 기준:** 현재 UI·UX의 낮은 품질을 개선한다. 화면 교체 자체를 목표로 삼지 않고 정보 위계·일관성·조작 흐름·스마트폰 가로 공간 밀도를 높인다. 주행 기록은 **현재 인라인 스타일 유지**로 확정([지시26](26-task-inline-history-finalize.md)). 첫 라이딩 카드 삭제는 배포 완료. 묶음3 주행 결과·다음 주행은 [최종감리34](34-review-batch3-final.md) LOCAL_VERIFIED 후 10-25 Chief 화면 승인을 받았다. 미커밋·미배포다. 묶음1·2는 이미 10-24 호스팅 배포됨(아래 10-23 표의 로컬 표시는 당시 기록).

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

## 시안별 상태 (2026-10-25 갱신)

| # | 시안 | 상태 | 비고 |
|---|---|---|---|
| 01 | [순위 칩 + 순위판](mockups/01-LbMap.png) | ✅ 배포 | `5ab00ad6` |
| 02 | [주행 중 앞뒤 2명](mockups/02-LbRiding.png) | ✅ 배포 | 〃 |
| 03 | [주행 결과 순위 줄](mockups/03-LbSummary.png) | ✅ Chief 승인·미커밋 | 묶음3 주행 결과와 함께 |
| 04 | [지도 대기 — 경로 도크](mockups/04-Main.png) | ✅ 배포 | 묶음2·주소 카드 후속35~48. 지시50 빈 idle 카드 회귀 교정은 미커밋 |
| 05 | [경로 만들기 팝업](mockups/05-RoutePick.png) | ◐ 로컬 검증·화면 확인 대기 | 묶음 5. 팝업이 `mapPopupElements.ts`의 DOM 생성 코드(React 밖) |
| 06 | [MENU](mockups/06-Menu.png) | ✅ 배포 | 묶음1·고정14 흰 반원 탭 포함 |
| 07 | [경로 목록](mockups/07-RouteList.png) | ✅ 배포 | 묶음1·고정5/6 한 줄·흰 목록 |
| 08 | [주행 중](mockups/08-Riding.png) | ✅ 배포 | 묶음2·고정1~4·11~14 포함 |
| 09 | [일시정지](mockups/09-Paused.png) | ✅ 배포 | 묶음2·글자 없는 아이콘 조작 유지 |
| 10 | [주행 결과](mockups/10-Summary.png) | ✅ Chief 승인·미커밋 | 묶음 3. [최종감리34](34-review-batch3-final.md)·[비교](comparison-batch3-final.html) |
| 11 | [다음 주행](mockups/11-NextRide.png) | ✅ Chief 승인·미커밋 | 묶음 3. RC13 실제 연속 주행 PASS |
| 12 | [케이던스 센서](mockups/12-Sensor.png) | ✅ Chief 승인·미커밋 | 묶음 4 |
| 13 | [주행 설정](mockups/13-Settings.png) | ✅ Chief 승인·미커밋 | 묶음 4. 체중·강도는 프로필 수정으로 옮김 |
| 14 | [맵 뷰](mockups/14-MapView.png) | ✅ Chief 승인·미커밋 | 컨트롤 정리 배포됨(`649045b0`). 판 모양은 묶음 4 |
| 15 | [프로필 수정](mockups/15-Profile.png) | ✅ Chief 승인·미커밋 | 묶음 4 |
| 16 | [앱 소개](mockups/16-Intro.png) | ⬜ | 묶음 6 |

시안 밖에서 이미 새 규칙으로 끝난 화면: 계정 패널, 리더보드 전체 보기, 위치 선택 창(모두 배포).

## 묶음 계획

| 묶음 | 화면 | 상태 |
|---|---|---|
| 1 | MENU + 경로 목록 | DEPLOYED — Chief 지정 흰 목록·한 줄 행 포함 |
| 2 | 지도 대기 · 주행 중 · 일시정지 (지도 위 조작부: 카메라 1~6 → 버튼 하나, 정지 버튼 색, 코칭 문구 한국어, 출발 전 0 대신 경로·고도) | DEPLOYED — 고정1~4·11~14 우선, 지시50 빈 idle 카드 회귀 교정은 미커밋 |
| 3 | 주행 결과(두 칸 판) + 다음 주행 | CHIEF_APPROVED / 미커밋 — [최종감리34](34-review-batch3-final.md)·[비교](comparison-batch3-final.html), Chief 화면 승인(10-25) |
| 4 | 센서 · 주행 설정 · 맵 뷰 · 프로필 수정 | CHIEF_APPROVED / 미커밋 — [결과59](59-result-batch4.md), Codex 직접 화면·감리·캡처 / Cursor fixture·시험 |
| 5 | 경로 만들기 팝업 | CHIEF_APPROVED(조건: [지시74](74-task-result-popup-bottom-row.md) 맨 아래 줄 통일 — 구현·자체감리 PASS, Chief 화면 확인 대기) / 미커밋 — [결과67](67-result-batch5.md)·[감리73](73-review-claude-batch3-5.md) |
| 6 | 앱 소개 | 대기 |

각 묶음:
1. 수퍼바이저가 지시서 `NN-task-묶음N.md`를 쓴다(시안 경로, 규칙, 금지, 검증, 캡처 경로).
2. Supervisor가 화면을 직접 구현한다. Cursor는 기계적 작업·fixture·시험을 맡는다(10-24 Chief 지시).
3. 수퍼바이저가 [플레이북 §4](../../reference/operations/261023-RTW-수퍼바이저-교대-플레이북.md)대로 감리하고, 결과 파일에 「감리」 절을 붙인다.
4. chief 에게 시안·캡처를 나란히 보이고 승인받는다.
5. 커밋·푸시·배포는 Chief 별도 지시가 있어야 한다. 현재는 모두 금지다.

## chief 결정 대기

1. 해결: 「어디에서 첫 라이딩을 할까요?」 카드 삭제(Chief 10-24).
2. 해결: 주행 기록 panel 비교안 미채택, 기존 인라인 스타일 유지(Chief 10-24). 비교용 연결·플래그 제거, 기존 기록별 행동 보존.

시안 승인으로 정해진 것: 주행 결과의 주인공 숫자 = 「새 도로」, 체중·강도 입력은 프로필 수정에만.
