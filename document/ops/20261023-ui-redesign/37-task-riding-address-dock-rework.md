# 재지시 37 — 지시 35 재작업: 대기 화면 주소 카드 폭 원복

2026-10-24 · 발주 Claude Code · 구현 **Cursor CLI** · 결과는 `36-result-riding-address-dock.md` 끝에 「재작업 37」 절로 덧붙인다.

## 감리 판정 (결과 36) — FAIL 1건

주행·일시정지 중 주소 카드 표시, 미니맵 좌우 정렬, 잠금(✕·⇅ 없음), 겹침 없음은 **PASS**(Supervisor 실측: 800×360 카드 `[11,173,235,58]` = 미니맵 `[11,239,235,105]` 좌우 일치, 667×300 196=196).

**FAIL:** 지시 35 「대기 화면(미니맵 없음)의 주소 카드 모양·폭은 바꾸지 않는다」 위반.
- `MapBottomLeftStack.css` 새 규칙 `.map-bottom-left-stack > .route-dock-anchor { width: auto; max-width: min(250px, …) }` 가 `RouteDock.css` 의 `width: min(250px, calc(100vw - 16px))` 를 덮어, 대기 화면 카드가 **250px → 220px**(내용 폭)로 줄었다(프리뷰 `state=ready` 800×360·667×300 모두 220, HEAD·운영은 250).

## 할 일

1. 미니맵이 **펼쳐져 있지 않을 때**(대기 화면, 미니맵 접힘) 주소 카드 폭은 HEAD 와 같은 `min(250px, calc(100vw - 16px))` 고정. 위 `width: auto` 규칙과 미니맵 접힘용 `fit-content`/`max-content` 규칙을 이 기준으로 정리한다. 펼친 미니맵 정렬 규칙은 그대로.
2. `e2e/address-minimap-width.spec.ts` 의 미니맵 접힘 단언을 「주소 카드 폭 = 250px(±0.5)」로 바꾼다(지금의 `> mini+40`·`≠ expanded` 는 약하다).
3. `e2e/ui-800x360.spec.ts` 목록 11 describe 에 대기 화면 단언 하나 추가: `state=ready` 800×360·667×300 에서 펼친 주소 카드 폭 250px(±0.5).
4. 캡처 다시: `evidence/riding-address-dock/after-ready-{800x360,667x300}.png`, `after-riding-minimap-collapsed-800x360.png` 덮어쓰기. **증거 위치는 `C:\20.HDev\boxcycle\document\ops\20261023-ui-redesign\evidence\riding-address-dock\`** (지난번 `apps/web/evidence/` 에 잘못 저장해 Supervisor 가 옮겼다 — 그 폴더 만들지 말 것).

## 금지

지시 35 「금지」 전부 그대로(고정 목록 1~10, 묶음3 미커밋 변경 보존, git restore/checkout/stash/worktree/커밋 금지, 3000·5000·5040 유지, 운영 Firebase 쓰기 금지). 펼친 미니맵 정렬·주행 중 표시·잠금은 건드리지 않는다.

## 검증 (실행 폴더 `C:\20.HDev\boxcycle\apps\web`)

1. `npx tsc -b --noEmit`, 변경 파일 eslint 오류 0
2. 프리뷰 5020 은 이미 떠 있을 수 있다(PID 확인 후 재사용, 없으면 `$env:RTW_DEV_PORT='5020'; npm run dev:localhost -- --mode harness --strictPort`) → `npx playwright test ui-800x360 address-minimap-width ui-redesign-batch1.spec.ts ui-redesign-batch2.spec.ts ui-redesign-batch3.spec.ts ui-redesign-batch3-conquest.spec.ts --workers=1 --retries=0` → 로그 `evidence/riding-address-dock/ui-rework.log`
3. 루트 `node scripts/check-code-tidy.mjs`, `git diff --check`
4. **끝나면 5020 서버를 실제로 끄고**(netstat 로 LISTENING 없는지 확인) 결과에 적는다. 지난번 「종료」 보고와 달리 5020 이 떠 있었다.
