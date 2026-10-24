# HANDOFF — 지금 상태 한 장

| 항목 | 값 |
|---|---|
| 담당 | **Codex 로 넘김(2026-10-24 21:0x KST, Claude Code → Codex).** Codex 는 인수하면 이 칸을 Codex·인수 시각으로 고친다 |
| 갱신 | 2026-10-24 21:0x KST — 지시35~48 커밋·푸시·**호스팅 배포 완료**(Chief 실행), 운영 번들 대조 PASS, `tmp/deploy35` 삭제 |
| 브랜치 | `main2` |
| HEAD / 원격 | 이 파일을 담은 커밋 = origin/main2 (제품 코드 마지막 커밋 `0b5b88ad`) |
| 마지막 배포 | **10-24 20:5x KST Hosting `0b5b88ad`** 빌드 `index-BX-8_B6d.js`·`index-qxhH-5Vd.css` — 운영 `https://boxcycle-dc2df.web.app` 의 두 자산 SHA256 이 로컬 빌드와 일치(Claude Code 대조). 함수·Rules 변경 없음. **묶음3 미커밋분은 배포에 들어가지 않았다** |
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

1. **묶음3(주행 결과·다음 주행) Chief 화면 확인 대기** — [최종감리34](20261023-ui-redesign/34-review-batch3-final.md) LOCAL_VERIFIED/AWAITING_CHIEF, 미커밋. 비교 페이지 `C:\20.HDev\boxcycle\document\ops\20261023-ui-redesign\comparison-batch3-final.html`(Supervisor 가 `Start-Process` 로 열어 줄 것). 미커밋 파일: `NextRideCard.*`, `RideSummarySheet.*`, `scripts/ui-800x360/preview.tsx`, `e2e/ride-continuation.spec.ts`, `e2e/rideEntryHelpers.ts`, `scripts/next-ride/resume-slot-ui-fixture-main.tsx`, `e2e/ui-redesign-batch3*.spec.ts`, 문서 29~34·`comparison-batch3*.html`·`evidence/batch3*`. **되돌리지도, 임의로 커밋·배포하지도 말 것.** 주의: 묶음3은 오늘 주소 카드 변경(44~48) 전에 만들어졌다 — Chief 확인 전에 오늘 변경 위에서 묶음3 화면 시험을 다시 돌려 충돌이 없는지 먼저 확인.
2. **실패 중인 시험 3건(오늘 변경과 무관으로 판단, 기준선 재실행은 안 함)**
   - `e2e/ui-edge-live.spec.ts`(에뮬레이터): 10-21 기대값(대기 카드 ≤220px, 주행바 ≤36px, 주행 시작 직후 「경로 패널 접기」)이 고정 목록 1·11·12와 어긋난다. 고정 목록에 맞게 다시 쓰기.
   - `e2e/distance-direction-attention.spec.ts` 29줄(프로필 고르기 깜빡임 클래스), `e2e/route-ride-controls.spec.ts` 20줄(idle 에 주소 카드 없어야 함) — 묶음3 의 `preview.tsx` 미커밋 변경 영향 의심. 묶음3 감리 때 함께 확인.
3. 낮은 우선: RouteDock 주행 시작 순간 펼친 카드가 한 프레임 보였다 접힐 수 있음(effect 안 setState). 렌더 중 조정으로 바꾸면 사라짐.

## 실행자·도구 상태

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

- 10-24 21시 열린 포트: **3000(PID 28472, Chief imgman — 절대 종료 금지)**, 5000(PID 58256, Chief 확인용 앱 — 운영 Firebase 연결, 시험 데이터 쓰기 금지), 5040(PID 10096). 이 Supervisor 가 띄운 5020·5017·에뮬레이터는 모두 종료.
- 실행 폴더 `C:\20.HDev\boxcycle\apps\web`. 화면 프리뷰: `$env:RTW_DEV_PORT='5020'; npm run dev:localhost -- --mode harness --strictPort` → `http://127.0.0.1:5020/scripts/ui-800x360/preview.html?state=ready|riding|paused&waypoints=0..3&long`.
- 화면 시험 묶음: `npx playwright test ui-800x360 address-minimap-width ui-redesign-batch1.spec.ts ui-redesign-batch2.spec.ts --workers=1 --retries=0`(10-24 21시 31/31).
- 실앱(에뮬레이터): `$env:RTW_DEV_PORT='5017'; node scripts/e2e/run-with-deadline.mjs --limit-sec 540 -- node scripts/e2e/run-with-functions-emulator.mjs 'node ../../node_modules/@playwright/test/cli.js test ride-entry route-dock-riding-content --workers=1 --retries=0'`(8/8). 5분 무진전이면 로그·프로세스·포트 확인 후 경로 전환.
- 게이트: `npx tsc -b --noEmit`, 변경 파일 eslint, `npm run test:quick`(1360), `node scripts/ride-verify/verify-selectors.mjs`(19), 루트 `node scripts/check-code-tidy.mjs`·`check-dep-direction.mjs --check`·`check-document-system.mjs`, `git diff --check`. Git Bash 에서 push 할 땐 `export PATH="/c/Program Files/nodejs:$PATH"`.
