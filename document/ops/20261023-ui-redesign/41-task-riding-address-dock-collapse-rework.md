# 재지시 41 — 지시 39 재작업: 접힌 주소창이 「찾을 수 있는 › 버튼」이 아니다

2026-10-24 · 발주 Claude Code · 구현 **Cursor CLI** · 결과는 `40-result-riding-address-dock-collapse.md` 끝에 「재작업 41」 절로 덧붙인다.

## 감리 판정 (결과 40) — **FAIL**

지시 39 할 일 2(「접힌 모습이 찾을 수 있는 버튼이어야 한다 — 흰 바탕 › 펼치기, 터치 영역 28×28 이상」)를 하지 않았다. **CSS 변경 0줄.**

- 프리뷰 캡처 `evidence/riding-address-dock-collapse/riding-collapsed-800x360.png`·`-667x300.png`: 미니맵 위 왼쪽에 **약 8×5px 흰 점**만 있고 › 가 안 보인다.
- **Chief 실화면(localhost:5000, 실제 App)**: 미니맵 위에 **폭 250px 의 가는 흰 띠**만 보이고 주소도 › 도 안 보인다. Chief: 「주소창에 흰 띠만 보이고 주소가 안 보인다.」
- 원인(Supervisor 조사, `apps/web/src/components/route-dock/RouteDock.css`):
  - `.route-dock__caret` 이 `position: absolute; top: 4px; right: 4px` 이다. 접힘에서 `.route-dock__grid` 가 `display: none` 이라 카드에 흐름 안 내용이 없고, 카드는 패딩만 남은 몇 px 짜리가 된다. caret 은 그 카드 오른쪽 기준으로 왼쪽 바깥(화면 밖)으로 밀려난다.
  - 프리뷰와 실제 App 이 다르게 보이는 이유: 접힘 규칙 `.route-dock-anchor:not(.route-dock-anchor--open) { width: auto }`(RouteDock.css)와 `.map-bottom-left-stack > .route-dock-anchor { width: min(250px, …) }`(MapBottomLeftStack.css)의 **우선순위가 같아 CSS 로드 순서로 승부**가 난다. 실제 App 에서는 스택 규칙이 이겨 250px 빈 띠가 된다.
- 프리뷰 PASS 만으로는 이 차이를 못 잡는다. 이번에는 **로드 순서와 무관하게** 맞아야 한다.

## 할 일

1. **접힌 모습(대기·주행·일시정지 공통)** = 흰 원형 또는 둥근 사각 버튼 하나, 크기 **32×32px**(최소 28), 흰 바탕(`#fff`)·지금 카드와 같은 그림자, 안의 › 는 짙은 색(`#121417` 계열)·잘 보이는 크기(16px 안팎). 위치: 펼친 카드의 왼쪽 아래 모서리 자리 = 미니맵 바로 위 왼쪽(대기 화면에서는 지금 카드 왼쪽 아래 자리).
   - 접힘에서는 caret 을 흐름 안(`position: static` 등)으로 두고 카드가 그 버튼 크기로 줄어들게 한다. 펼침에서는 지금 모습(오른쪽 위 ‹) 그대로.
   - 폭 규칙은 **선택자 우선순위로** 이기게 한다(예: `.map-bottom-left-stack > .route-dock-anchor:not(.route-dock-anchor--open)`). 로드 순서에 기대지 말 것.
2. **시험 — 기하로 단언** (`e2e/ui-800x360.spec.ts` 「Chief 고정 — 목록 11」에 추가):
   - `state=riding`·`state=paused` 800×360·667×300 첫 화면(접힘): `.route-dock__card` 상자 폭·높이 각각 28~44px, caret 상자가 카드 안이고 **뷰포트 안**, caret 중심의 `document.elementFromPoint` 가 caret 자신(또는 그 자식), caret 배경 또는 카드 배경이 `rgb(255, 255, 255)`, caret 글자 색이 어두움(밝기 < 100). 접근성 이름 「경로 패널 펼치기」.
   - 대기 화면에서 ‹ 로 접었을 때도 같은 기하 단언.
   - **로드 순서 차이를 잡는 단언**: 시험 안에서 `MapBottomLeftStack.css` 를 RouteDock.css 보다 나중에 한 번 더 적용한 상태(예: 해당 규칙을 담은 `<style>` 을 문서 끝에 주입)에서도 위 기하가 같아야 한다. 또는 실제 App 의 CSS 순서를 재현하는 다른 방법을 쓰고 결과에 근거를 적는다.
3. 캡처 다시(**절대 경로** `C:\20.HDev\boxcycle\document\ops\20261023-ui-redesign\evidence\riding-address-dock-collapse\` 에만): `riding-collapsed-{667x300,800x360}.png`, `paused-collapsed-800x360.png`, `ready-collapsed-800x360.png`(대기에서 ‹ 로 접은 모습), `riding-expanded-800x360.png`. 접힌 버튼 확대 캡처 `riding-collapsed-zoom.png`(버튼 주변 120×120, scale device) 하나 더.

## 금지

지시 39 「금지」 전부 그대로(고정 목록 1~10, 묶음 3 미커밋 변경 보존, git restore/checkout/stash/worktree/커밋 금지, `tmp/deploy35` 손대지 말 것, 3000·5000·5040 유지, 운영 Firebase 쓰기 금지). 펼친 모습·미니맵 폭 맞춤·대기 250px·주행 중 잠금은 바꾸지 않는다.

## 검증 (실행 폴더 `C:\20.HDev\boxcycle\apps\web`)

1. `npx tsc -b --noEmit`, 변경 파일 eslint 오류 0
2. 프리뷰 5020 → `npx playwright test ui-800x360 address-minimap-width ui-redesign-batch1.spec.ts ui-redesign-batch2.spec.ts ui-redesign-batch3.spec.ts ui-redesign-batch3-conquest.spec.ts --workers=1 --retries=0` → 로그 `evidence/riding-address-dock-collapse/ui-rework.log`
3. 루트 `node scripts/check-code-tidy.mjs`, `git diff --check`
4. 끝나면 5020 을 실제로 끄고 `netstat` 확인.
