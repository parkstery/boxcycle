# HANDOFF — 지금 상태 한 장

| 항목 | 값 |
|---|---|
| 담당 | **Codex — 2026-10-26 09:16 KST**([지시80](20261023-ui-redesign/80-task-entry-location-before-next-ride.md)·[결과81](20261023-ui-redesign/81-result-entry-location-before-next-ride.md): **LOCAL_VERIFIED**·기능 `4549356d`·로고 `f39f6ee2` 로컬 커밋 완료, 미푸시·미배포; Chief 로컬 화면 확인·푸시/배포 별도 지시 대기). 이전: Codex 09:14 KST — Supervisor PASS·localhost:5000 HMR. 이전: Codex 09:02 KST — eslint 후속만. 이전: Codex 02:48 KST — [지시78](20261023-ui-redesign/78-task-spinatlas-logo-replacement.md)·[결과79](20261023-ui-redesign/79-result-spinatlas-logo-replacement.md). 이전: Claude Code — 2026-10-25 08:36 KST 인수**(Codex → Claude Code, [첫 프롬프트71](20261023-ui-redesign/71-first-prompt-claude-20261025.md)). 대조 08:36: HEAD=origin/main2=`b9852157`(Codex 커밋 0건)·추적 수정 43(제품 src 17)·운영 번들 `index-BX-8_B6d.js`·`index-qxhH-5Vd.css`·보존 JSON `4CAFA2A2…179F` 일치. **09:09 Chief 가 실수로 Codex 에 묶음6 진행을 지시했다가 중지** — Codex 는 [지시72](20261023-ui-redesign/72-task-batch6.md)(중단)·`evidence/instruction72/`만 만들고 이 행을 고쳤음. Claude Code 09:12 확인: 제품·시험 파일 변경 0(Codex 시작 지문 332개 중 HANDOFF 만 달라짐, AppIntroScreen = HEAD) |
| 이전 담당 | Codex — 2026-10-24 21:33 ~ 10-25 08:24 KST(지시50~70) |
| 갱신 | 2026-10-26 09:16 KST — [결과81](20261023-ui-redesign/81-result-entry-location-before-next-ride.md) 문서 최종: 기능 커밋 `4549356d`(`fix(entry): sequence location before follow-up cards`)·로고 `f39f6ee2` 완료(`main2` 로컬, 미푸시·미배포). 다음 Chief `http://localhost:5000` 로컬 화면 확인·푸시/배포 별도 지시 대기. 다음 82.<br>이전: 2026-10-26 09:14 KST — 1차 `!entryLocationPrompt` FAIL→`entryLocation.phase==="ready"` 재작업 후 Supervisor **PASS**·**LOCAL_VERIFIED**. Codex 최종: 계약 5/5·eslint error0(App w7)·build0·tidy/dep/doc0·quick 통과1365·기능실패0; 병렬 entry-location-dom 60s timeout/cancel exit1→동일인자 단독 1/1 exit0. 브라우저 도구 불가(Work Local browser disabled); **localhost:5000** HMR Chief 확인. 미푸시·미배포. 다음 82.<br>이전: 2026-10-26 09:02 KST — eslint 후속·test:quick Codex 대기.<br>이전: 2026-10-26 02:55 KST — [결과79](20261023-ui-redesign/79-result-spinatlas-logo-replacement.md) Supervisor 독립 감리 **PASS**. 다음 80.<br>이전: 2026-10-26 02:48 KST — Codex Supervisor 인수·지시78 완료. 다음 80.<br>이전: 2026-10-25 23:25 KST — Claude Code. Chief 「커밋·푸시·배포 한 번에 / 실패한 시험 다시 써 / 로고는 별도」. **지시76 배포**: 커밋 `5dd4b7ad` 자동차 기본·`06efb2f0` RouteDock 깜빡임·`c7f73886` 시험·`bfc1dd67` 문서, 푸시 `ac633d84..bfc1dd67`(pre-push quick 1361), 호스팅 배포 운영 `index-T5HbAjbA.js` SHA256 로컬 일치. **[지시77](20261023-ui-redesign/77-task-result-stale-e2e-rewrite.md)**(시험만, 제품 변경 없음): guest-lifecycle 4/4 PASS(offline 결과 두 가지 인정, 새 계정 0·같은 uid 유지), ride-summary-compact 4 PASS·**1 FAIL = 제품 발견** — 다음 주행 카드 오른쪽 끝이 계정·맵 버튼보다 5.7px 안쪽(10-21 `ae646df9` 가 폰 가로 `.map-hud__tr` 만 4px 로 옮김). 카드를 맞출지 Chief 결정 대기, 시험 기대값은 그대로. 로고(favicon)는 Chief 가 별도 진행. 에뮬레이터 포트 닫힘, 5017·3000 유지. 다음 새 번호 78.<br>이전: 21:15 KST — Claude Code. **지시76 미커밋(작업 트리)**: ① 거리·방향 기본 수단 자동차(`mapPopupElements.ts` `DISTANCE_DEFAULT_PROFILE`, 사용자 선택·이어 달리기 승계는 유지, 고정15 갱신) ② RouteDock 주행 시작 한 프레임 깜빡임 해소(렌더 중 stage 비교, 새 시험 `route-dock-ride-start-frame` 고치기 전 FAIL→후 PASS) ③ 에뮬레이터 시험: ride-continuation 7/7·calorie+popup-title 4/4·ride-entry 등 7 PASS·account-deletion-ui-shots 2/2. **남은 FAIL**: ride-summary-compact 3건(09-18 독 배치·옛 위치 컨트롤·짧은 탭 팝업 — 10-23·10-24 배포 디자인으로 이미 낡은 시험, 다시 쓰기 필요), guest-lifecycle offline 1건(옛 종료 표시로 돌아온 기기가 offline 에서 같은 Guest 로 바로 재진입 — 새 계정 0·같은 uid 실측, 시험 기대 화면만 다름). 20:28 ui-800x360 실행이 커밋 캡처 5장(`riding-address-dock-collapse`)을 덮어 HEAD blob 으로 되씀. 커밋·배포 안 함(Chief 승인 대기).<br>이전: 19:50 KST — Claude Code. 푸시 `b9852157..54eaa5e7` main2(pre-push quick 1361) → 호스팅 배포·SHA256 일치. 에뮬레이터(Claude Code 가 띄운 것) 종료, `tmp/audit73`·`audit73-ev` 삭제(링크 1개 먼저 해제). 5017(Chief vite)·3000 유지. 남은 것: ① 거리·방향 기본 수단 자동차 고정 여부 Chief 결정 ② 에뮬레이터 실앱 시험 27건 미실행 ③ RouteDock 주행 시작 깜빡임(낮음). 다음 새 번호 76.<br>이전: 19:00 KST — Claude Code. Chief 「커밋 푸시 배포해」 → 커밋: `e19dc0e7` 묶음3 · `685fa61f` 묶음4 · `e52ee02a` 묶음5+지시74 · `abc31f5f` 지시75 게스트 로그아웃 제거 · `34d78830` 로고 심벌(Codex+Claude) · 다음 문서 커밋. 중간 커밋 4개 모두 tsc 0(`tmp/audit73` 복제본). 배포 전 test:quick 1361/1361·tidy/dep/doc/diff 0. **에뮬레이터 실앱 시험(ride-continuation 등 25건·guest 2건)은 미실행으로 배포** — Chief 지시. 커밋 제외: 15-json·archive PNG 3·inline-history PNG 5·`.out/`·`cdbox.bat`·`claude-headless.err`.<br>이전: 18:30 KST — Claude Code. Chief 실앱 확인용 에뮬레이터를 Claude Code 가 띄움(`firebase emulators:start --only functions,auth,firestore,database`, 백그라운드 — 확인 끝나면 끈다). Codex 18:00 로고 교체(`SpinatlasMark` 신설·MENU·인트로)는 **로그인 카드를 빠뜨려** Claude Code 가 `AuthGateCard` 보완(고정16). Codex 변경분(AppIntroScreen·MenuPanel·brand/)은 커밋 때 별도 커밋으로.<br>이전: 17:00 KST — Claude Code. Chief: 묶음5 **조건부 승인** → [지시74](20261023-ui-redesign/74-task-result-popup-bottom-row.md) 팝업 두 탭 맨 아래 줄 `🚗🚲👣 … ▶ 경로 삭제` 통일(고정15, 구현·자체감리 PASS, Chief 화면 확인 대기). [지시75](20261023-ui-redesign/75-task-result-guest-no-logout.md) 게스트 로그아웃 제거(결정 로그) — **이번 배포에 함께**. 에뮬레이터 재실행·커밋·푸시·배포 일괄 승인 대기. 다음 새 번호 76. 루트 `claude-headless.err`(0바이트, 10:07, 출처 불명) 커밋 제외.<br>이전: 10:20 KST — Claude Code. [감리73](20261023-ui-redesign/73-review-claude-batch3-5.md): 고정1~14 PASS, 묶음5 가 깨뜨린 옛 시험 9건 교정·PASS. **에뮬레이터 실앱 시험은 메모리 부족으로 중단(미완)** — 재실행 Chief 허락 대기. 묶음5 Chief 화면 확인·게스트 경고 문구 결정 대기. 지시72 묶음6 은 **중단·무효**. 다음 새 번호 74. 커밋·배포 금지(승인 전). HEAD 비교 복제본 `tmp/audit73`(감리 끝나면 삭제) |
| 브랜치 | `main2` |
| HEAD / 원격 | `main2` 로컬 HEAD 기능 `4549356d`·로고 `f39f6ee2`(미푸시·미배포). `origin/main2`는 그 이전(마지막 푸시 제품 `0b5b88ad` 등) |
| 마지막 배포 | **10-25 19:4x KST Hosting `54eaa5e7`**(묶음3·4·5+지시74·지시75·로고 심벌) 빌드 `index-ogmYxeK9.js`·`index-hQh_MX2m.css` — 운영 `https://boxcycle-dc2df.web.app` 의 두 자산 SHA256 이 로컬 빌드와 일치(Claude Code 대조). 함수·Rules 변경 없음. Claude Code 가 직접 `firebase deploy --only hosting` 실행(이번엔 막히지 않음). 에뮬레이터 실앱 시험은 미실행으로 배포(Chief 지시) |
| 첫 프롬프트 | [49-first-prompt-codex-20261024-night.md](20261023-ui-redesign/49-first-prompt-codex-20261024-night.md) |

## 먼저 읽을 것

1. [Chief 지정 디자인 고정 1~14](../reference/product/261024-RTW-Chief-지정-디자인-고정.md) — 시안·규칙·수퍼바이저 판단보다 우선. 오늘 11~14가 더해지고 바뀌었다(아래).
2. [묶음 README](20261023-ui-redesign/README.md), 오늘 결과 [44](20261023-ui-redesign/44-result-dock-buttons-proposal-a.md)·[45](20261023-ui-redesign/45-result-dock-swap-front.md)·[46](20261023-ui-redesign/46-result-dock-head-row.md)·[47](20261023-ui-redesign/47-result-dock-badges-start-end.md)·[48](20261023-ui-redesign/48-result-edge-tab.md).
3. [플레이북](../reference/operations/261023-RTW-수퍼바이저-교대-플레이북.md).

## 오늘(10-24 오후) 끝난 것 — 모두 배포됨

| 지시 | 내용 | 고정 목록 |
|---|---|---|
| 35·37 | 주행 중 출발·도착 주소창 복구(미니맵과 같은 폭, ✕·⇅ 없음) | 11 |
| 39·41 | 주행 시작 때 주소창 **접힘**(32px 흰 › 버튼), 펼치면 미니맵 폭 | 11 · 일하는 법 5 「숨기지 말고 접는다」 |
| 42 | 지도 짧게 탭할 때 `reading 'x'` 오류(운영에도 있었음) | — |
| 44 | 주소 카드 ⇅·센서·✕·‹› 를 디자인 규칙대로(선 아이콘, 흰 알약 센서) | 12 |
| 45 | ⇅ 를 목록 앞쪽(기호 열 위, S·E 사이) | 12 |
| 46 | 대기 카드: 센서·접기 맨 위 한 줄, ✕ 오른쪽 끝, **폭 = 주행 중(29.4vw)**, 주행 중 경유 들여쓰기 | 11·12 |
| 47 | 이름표 제거 → 지도 핀과 같은 기호 **S·1·2·3·E**, 지점 팝업 **Start · +WP · End**, 탭 Start·End | 13 |
| 48 | 측면 메뉴(왼쪽 MENU·오른쪽 맵 뷰) **흰 반투명 반원 탭**(14×48, 누르는 영역 28×64, 위 84px), 왼쪽 아래 묶음 16px 띄움 | 14 · 결정 로그 |

44~48 은 Chief 지시로 **Supervisor(Claude Code)가 직접 구현** — Chief: 「외부 agent 가 구현해 디자인과 동떨어졌다, 이건 네가 직접 해」. 디자인 맞춤 작업은 시안(아티팩트) → Chief 선택 → Supervisor 직접 구현이 기본.

## 남은 일 (우선순위)

지시50 재검증·실패3건 조사 완료, [감리51](20261023-ui-redesign/51-result-batch3-revalidation.md). 지시58 완료, [결과59](20261023-ui-redesign/59-result-batch4.md)·Cursor60~62. 실행자 확인63·결과64 완료. 묶음5 지시65·결과67·감리68~70 완료. 다음 새 번호71. 디자인 맞춤은 시안 → Chief 선택 → Supervisor 직접 구현을 기본으로 하고, 넓고 기계적인 작업만 실행자에게 맡긴다.

1. **묶음3(주행 결과·다음 주행) Chief 화면 승인(10-25)** — [최종감리34](20261023-ui-redesign/34-review-batch3-final.md) LOCAL_VERIFIED 후 CHIEF_APPROVED(10-25), 미커밋. 비교 페이지 `C:\20.HDev\boxcycle\document\ops\20261023-ui-redesign\comparison-batch3-final.html`(Supervisor 가 `Start-Process` 로 열어 줄 것). 미커밋 파일: `NextRideCard.*`, `RideSummarySheet.*`, `scripts/ui-800x360/preview.tsx`, `e2e/ride-continuation.spec.ts`, `e2e/rideEntryHelpers.ts`, `scripts/next-ride/resume-slot-ui-fixture-main.tsx`, `e2e/ui-redesign-batch3*.spec.ts`, 문서 29~34·`comparison-batch3*.html`·`evidence/batch3*`. **되돌리지도, 임의로 커밋·배포하지도 말 것.** 주의: 묶음3은 오늘 주소 카드 변경(44~48) 전에 만들어졌다 — 지시50 및58의 오늘 변경 위 묶음3 재검증 PASS. 승인 후에도 미커밋·미배포를 유지한다.
2. **기존 실패3건은 지시50에서 교정·통과.** ui-edge는 고정1·11·12 정확한 계약으로 갱신, 거리 강조는 10-22 적용 수단 지시 근거로 수정+수동 강조 별도 보존. idle 카드 시험은 기대값을 유지하고 RouteDock 빈 카드 회귀를 복구했다(묶음3 preview 원인 아님). 결과 숫자 line-height 교정·애니메이션 완료 후 측정도 포함. 새 변경 모두 미커밋·미배포.
   - **RC1 실패는 지시52에서 해결**: 위치 안내 완료·판 내부 닫기를 정확히 검사. 전체 첫4PASS/3FAIL의 RC2~4 낡은 UI 동작도 교정 후 전체7/7 PASS(6.7분·exit0), [감리53](20261023-ui-redesign/53-result-ride-continuation.md). 새 제품 변경 없음.
3. 낮은 우선: RouteDock 주행 시작 순간 펼친 카드가 한 프레임 보였다 접힐 수 있음(effect 안 setState). 렌더 중 조정으로 바꾸면 사라짐.

## 묶음4 완료(지시58)

- Chief 다음 작업 계속 지시에 따라 Cursor CLI가 계획56·comparison-batch4-plan.html 작성, Codex 감리57 완료. 제품 수정 없음. 묶음3 최신 비교 및 묶음4 시안 페이지를 직접 연다. 10-25 Chief가 묶음3 화면 및 묶음4 진행 승인. 지시58 Codex 직접 구현·Cursor fixture/시험, 커밋·배포 없음.
- 시작 시 archive/ride-verify-evidence PNG3장 dirty가 추가로 관측됨. 이번 작업 이전 변경이므로 원인 추정·되돌림 없이 해시 기록 보존. 보호 JSON 일치.

- **묶음4 CHIEF_APPROVED(10-25) / 미커밋**: 센서2칸 판·설정4 switch/칼로리 요약·우상단 맵·프로필 체중강도 입력 전용. BLE/저장/탈퇴 정책 유지. Codex 제품·감리·캡처, Cursor fixture·시험·독립 diff감리62. [결과59](20261023-ui-redesign/59-result-batch4.md).
- 최종 비교 `C:\20.HDev\boxcycle\document\ops\20261023-ui-redesign\comparison-batch4-final.html` 07:00 KST Start-Process로 직접 열기 완료(exit0), Chief 승인(10-25). 화면64/64 및 강화한 최종21/21, 실제 진입8/8·동기화2/2, quick1360/1360·selector19·타입/lint(기존경고7)/tidy/dep/doc/diff PASS. 실패·취소 중간 로그 보존, 기대값·게이트 완화 없음.
- 지시58 시험5020/5021/5023·에뮬레이터 모두 종료. 기존5017(PID62896, 전날23:07 시작)은 손대지 않고 보존. 기존5000은 닫힌 것으로 관측(이 작업의 종료명령 없음). 기존3000/3001/5040 그대로. 보호JSON·기존dirty/묶음3/캡처 해시 일치. 미커밋·미배포. 묶음5/6 새 지시 전 진행하지 않음.

## 묶음5 완료 — 지시65

- [결과67](20261023-ui-redesign/67-result-batch5.md) LOCAL_VERIFIED / AWAITING_CHIEF_SCREEN. Chief 묶음4 승인 후 Codex 직접 팝업화면·경계 보정·타입교정·실제시험·캡처, Cursor 조사fixture시험66·독립감리68/69·타입증거감리70.
- 흰300px 판·거리26px·프리셋·원형닫기. 고정13 Start/+WP/End·StartEnd 및 녹색재생 유지. 실제 dock형제DOM scope 보정, 낮은화면 첫floating 팝업8px 경계 보정. 도메인 탐색·토큰·준비 정책 유지.
- 회귀100PASS/1기존조건SKIP, 경계보정후 팝업/실제지도36/36PASS, 실앱제목/경계2/2PASS, 타입가드후 실제지도1/1PASS, quick1360PASS. 타입exit0·eslint오류0(기존MapView경고9)·selector19·tidy/dep/doc/diff PASS. 중간실패기록보존·기대완화없음.
- 비교 `C:\20.HDev\boxcycle\document\ops\20261023-ui-redesign\comparison-batch5-final.html`을 Codex가 직접 연다. 이전사진은 동일DOM에서 신규CSS만 제외한 스타일재현임을 표시. 실제초기690×275 경계보정 캡처와실앱측정 포함.
- 기존고정목록·묶음1~4 dirty/증거/preview·보호JSON·cdbox 보존. .out9008개 전수해시대조 후 수정시각변경0. 이번시험5020/5023·에뮬레이터종료. 기존3000/3001/5040 유지,5017 현재PID48028(종전62896과다름) 관측·종료명령없음. 5000닫힘 유지. 커밋·푸시·배포없음. 묶음6은 Chief 새지시 때만. 다음71.

## 실행자·도구 상태

- 지시50 최신 비교: `C:\20.HDev\boxcycle\document\ops\20261023-ui-redesign\comparison-batch3-instruction50.html`. 변경 후는 이번 캡처, 기존 비교·batch3 증거 보존. Chief에게 이 파일을 직접 연다. 기존 인라인 캡처5장이 잠금 시험 기본 출력으로 덮어써진 사고는 원본 SHA256 일치 blob으로 전부 복구 완료(결과51). 다음 실행은 `UI_REVALIDATION_EVIDENCE_DIR`·`ENTRY_CARD_HISTORY_EVIDENCE`를 새 증거 폴더로 지정한다.

- **10-25 07:02 KST 지시63 재확인: OpenCode v2.0.26 무료 GLM 실제 호출도 Free usage limit reached(exit1). 현재 무료 실행 불가.** [결과64](20261023-ui-redesign/64-result-executor-availability.md). Cursor CLI 실제 읽기 점검 응답 정상. Chief 토큰 절약 지시: 조사·기계 작업·fixture·시험은 Cursor 활용, OpenCode는 한도 회복 확인 시 활용. 유료 전환 없음.
- **OpenCode 무료 모델(GLM·DeepSeek·Nemotron) 모두 한도 소진(10-24).** Chief: 「cursor 를 활용해」. Grok Bot 은 데스크톱 채팅 앱(CLI 없음)이라 실행자로 못 쓴다.
- Cursor CLI: PowerShell 에서 **이 문자열 그대로** `agent -p --force --trust --workspace C:\20.HDev\boxcycle "<지시>"`(인자 순서 바꾸면 권한 검사에 걸림).
- 보고마다 **작업한 agent(구현·감리·캡처)를 명시**(Chief 10-24).
- **Chief 에게 링크를 주지 말 것** — 마크다운·`file:///`·평문 URL 모두 Chief 터미널(Windows Terminal)에서 안 열린다. 보여줄 것은 Supervisor 가 직접 연다: 로컬 파일은 `Start-Process "<전체 경로>"`, claude.ai 아티팩트는 Chief 가 그 창(디자인 캔버스)을 좋아한다 — Codex 가 열 수 없으면 경로·주소를 적고 열 방법을 Chief 와 정한다. 기록용 전체 경로(C:\ 부터)는 함께 적는다.
- 디자인 시안 캔버스(Chief 계정, 비공개): 전체 화면 시안 `https://claude.ai/artifact/NWrpXU7boGovvs8EixVcdN`, 주소 카드 버튼 `…/A7XfbAnkZJurSDzkj886Kg`, 반원 탭 `…/Gx3hf9Tbdm25EpiT4SQXZH`, 기호 S·E `…/8AhEZYeVhyUG3PTktmYas1`. 리포 사본은 `document/ops/20261023-ui-redesign/mockups/`.

## 배포 방법(묶음3 미커밋분을 빼고)

1. 루트에서 `git clone --no-checkout . tmp/deploy<N>` → 그 안에서 `git checkout --detach <커밋>` (`tmp/` 는 gitignore).
2. `apps/web/.env` 를 복제본 `apps/web/` 로 복사, 복제본 `apps/web` 에서 `npm install`(필요 시)·`npm run build`.
3. 배포는 자동 권한 검사가 Supervisor 실행을 막는다 → Chief 가 `cd C:\20.HDev\boxcycle\tmp\deploy<N>` → `npx firebase deploy --only hosting`.
4. 운영 `https://boxcycle-dc2df.web.app/` 의 `assets/index-*.js|css` 이름·SHA256 을 로컬 `dist` 와 대조 → 복제본 안에 링크(ReparsePoint)가 없는지 확인 후 삭제.

## 보존할 작업 트리

- `document/ops/20261017-entry-location/evidence/15-entry-flight-metrics.json`: 기존 dirty. SHA256 `4CAFA2A22CEAC8547D7EDB44D22A09082D0710EBDD71B6BDC34D59D57378179F`(10-24 21시 확인). 커밋·변경하지 않는다.
- `.out/`·`cdbox.bat`: 비추적, 손대지 않는다. restore/clean/stash/worktree·일괄 되돌리기 금지.
- 묶음3 미커밋분(위 「남은 일 1」), `document/ops/20261023-ui-redesign/README.md`·`evidence/inline-history/*.png` 의 미커밋 변경도 묶음3 쪽 — 보존.

## 서버·환경

- **10-25 08:40 KST 현재 열린 포트: 3000(PID28472, Chief imgman — 종료 금지)뿐.** 5040 은 Windows CDPSvc(앱 아님). 5000·5017·3001 닫힘. 5017 은 Chief 가 띄운 것이었고 Chief 허락으로 종료.

- 10-24 21시 열린 포트: **3000(PID 28472, Chief imgman — 절대 종료 금지)**, 5000(PID 58256, Chief 확인용 앱 — 운영 Firebase 연결, 시험 데이터 쓰기 금지), 5040(PID 10096). 이 Supervisor 가 띄운 5020·5017·에뮬레이터는 모두 종료.
- 10-24 21:33 Codex 대조: 위 세 포트/PID 유지. **3001(PID 42236)이 추가로 열림** — 명령행 `C:\20.HDev\imgman\node_modules\...\vite.js --port=3000 --host=0.0.0.0`, 다른 프로젝트 imgman이므로 종료하지 않음. 5017·5020 및 앱 에뮬레이터 포트는 열려 있지 않음.
- 지시50 종료: 이번 프리뷰5020 종료·실앱5017/에뮬레이터 정상 종료. 보존 JSON 해시 일치, 기존 dirty 캡처5장 정확한 시작 해시 일치. 구현·감리·캡처 Codex 직접, 커밋·푸시·배포 없음.
- 실행 폴더 `C:\20.HDev\boxcycle\apps\web`. 화면 프리뷰: `$env:RTW_DEV_PORT='5020'; npm run dev:localhost -- --mode harness --strictPort` → `http://127.0.0.1:5020/scripts/ui-800x360/preview.html?state=ready|riding|paused&waypoints=0..3&long`.
- 화면 시험 묶음: `npx playwright test ui-800x360 address-minimap-width ui-redesign-batch1.spec.ts ui-redesign-batch2.spec.ts --workers=1 --retries=0`(10-24 21시 31/31).
- 실앱(에뮬레이터): `$env:RTW_DEV_PORT='5017'; node scripts/e2e/run-with-deadline.mjs --limit-sec 540 -- node scripts/e2e/run-with-functions-emulator.mjs 'node ../../node_modules/@playwright/test/cli.js test ride-entry route-dock-riding-content --workers=1 --retries=0'`(8/8). 5분 무진전이면 로그·프로세스·포트 확인 후 경로 전환.
- 게이트: `npx tsc -b --noEmit`, 변경 파일 eslint, `npm run test:quick`(1360), `node scripts/ride-verify/verify-selectors.mjs`(19), 루트 `node scripts/check-code-tidy.mjs`·`check-dep-direction.mjs --check`·`check-document-system.mjs`, `git diff --check`. Git Bash 에서 push 할 땐 `export PATH="/c/Program Files/nodejs:$PATH"`.

최종 열람: 2026-10-25 08:24 KST Codex가 comparison-batch5-final.html을 Start-Process로 직접 열기 완료(exit0). 기록용 전체 경로 C:\20.HDev\boxcycle\document\ops\20261023-ui-redesign\comparison-batch5-final.html.
