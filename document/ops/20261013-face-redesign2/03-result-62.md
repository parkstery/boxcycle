# 결과62 — 얇은 단일 캐럿 적용

모델: Auto (Cursor agent router). session: 이 턴 프롬프트에 conversation id 없음. branch `face-redesign2`. HEAD `d51676c0b13b8064fa04b7cbabbe9250fb6a4401`. 커밋 없음. 지시62 파일은 수정하지 않음.

쓰기 범위: worktree `apps/web/src/components/map/mapPopupElements.ts`의 `PICK_CARET_SVG_ATTRS` / `PICK_CARET_DOWN_SVG` / `PICK_CARET_UP_SVG` 및 바로 관련 주석만. 기존 dirty는 보존.

- SVG attrs: `viewBox="0 0 20 14"`, `stroke="#2563EB"` 유지, `stroke-width="1.5"`, `width="20"` `height="14"`, round cap/join 유지.
- DOWN path 1개 `M4 4 10 10 16 4`. UP path 1개 `M4 10 10 4 16 10`.
- 설명 주석: 얇은 단일 캐럿, 12×6px가 20×14 svg 중앙.
- disclosure 주석: 전체폭 44px → 현재 행 16.8px.

명령: `git diff --check -- apps/web/src/components/map/mapPopupElements.ts` exit 0.

미검증: eslint, tsc, pick60 fixture, 브라우저·서버, 시각 before/after, 폰 3종+PC, keyboard. Supervisor 검증으로 남김. 실기기 미검증.
