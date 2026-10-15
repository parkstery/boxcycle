# 검수59·61 — 모든 경로 설정 후 시작 안내

Supervisor Codex 2026-10-15, APPROVED / Chief 확인 대기. Cursor 구현59, lint 재지시61 후 실제 diff 및 독립검증 완료.

useRoutePlanning의 기존 setRouteGeometry 계약(값/함수형 setter/안정참조)을 보존하며 geometry와완료 token을원자적으로저장. 동일 geometry 재설정도 새 token, 삭제는null. App→RouteDock 전달. catalog 입문·퍼블릭(usePublicationCatalogHub), 내 경로(useSavedRoutesWorkspace), 생성/Trail로드(App) 모두 기존 공통 setter를사용함을 소스로확인. 각 실제 Firebase fetch의e2e검증은미실시.

RouteDock은 초기non-null 및 ready이전 token을 보류하여 ready/로딩완료때1회소비. 같은token의센서/문구/접기/주행후ready복귀는반복안함. 새설정시펼침. CSS900ms2회/색고정/halo/reduced-motion/disabled위치안내유지. 다음주행카드불변.

- `node document/ops/20261013-face-redesign2/hook-59-qa.cjs` exit0, 실제훅StrictMode5항목:geometry동일성/setter안정성/동일참조재로드/비관련rerender/함수형setter/null삭제.
- `node document/ops/20261013-face-redesign2/pulse-59-qa.cjs` exit0. 실제RouteDock StrictMode 초기준비경로·ready지연·loading과stage분리완료 추가3검사 및 기존18항목,폰3종/PC4viewport 최고점겹침0/정상종료/콜백/reduced-motion PASS. 수정전초기로드검사FAIL재현,수정후PASS.
- `npx tsc -b --pretty false` exit0.
- `npx eslint src/hooks/useRoutePlanning.ts src/components/route-dock/RouteDock.tsx src/App.tsx` 최종exit0,오류0/기존hooks경고9. 초기no-useless-assignment1건은지시61로수정후재검증.
- `node scripts/ride-verify/verify-selectors.mjs` exit0,15단계유효. selector변경없음.
- `git diff --check` exit0.

실제인증/실기기/지도/주행진입e2e미검증. fixture는기존5013서버/실제component·hook,main진입차단으로실Firebase요청없음. 배포·merge·push없음.

코드 커밋: d51676c fix(ride): pulse start control after every route setup.

