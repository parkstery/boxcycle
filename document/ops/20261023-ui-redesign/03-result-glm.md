# GLM 검증 하네스 — 중단·인수 기록

2026-10-23. `opencode/glm-5.3-flash-free` 세션 `ses_e9759678cffeJnwuk1Ujd0Hb2o`.

GLM이 실제 제품 컴포넌트를 import하는 `apps/web/scripts/ui-redesign-batch1/preview.html`·`preview.tsx`를 생성한 뒤 공통 무료 사용 한도로 종료됐다. CSS·Playwright spec·최종 결과 보고는 미완료였다.

Codex 인수: 빠진 배경용 preview.css 추가(제품 CSS 복제 없음), 잘못된 신규 course 식별자 정리, 불필요한 window 전역 메타 제거, Trailhead 정본 상수 사용, 콜백 관찰·서체 로드 보완. `apps/web/e2e/ui-redesign-batch1.spec.ts` 작성: 667×300·800×360·844×390 메뉴/출처/검색/정렬/이름변경/삭제/ESC, 긴 이름·빈값·로딩, 합류/설정/입문 선택/이어달리기.

실제 App은 별도 `ui-redesign-batch1-live.spec.ts`로 에뮬레이터 안에서만 실행한다. 메모리 fixture 예시 데이터와 실제 App 데이터를 혼동하지 않는다. 최종 실행 결과는 [Supervisor 감리](05-review-batch1.md).
