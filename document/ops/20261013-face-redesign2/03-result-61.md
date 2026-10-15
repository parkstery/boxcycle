# 결과61 — 펄스 수정 lint 마감

모델: Auto (Cursor agent router). session: 이 턴 프롬프트에 conversation id 없음. branch `face-redesign2`. HEAD `1cff02689248910621165838c7323cfd2b1936a3`. 커밋 없음. 지시61 파일은 수정하지 않음.

쓰기 범위: worktree `apps/web/src/components/route-dock/RouteDock.tsx`, `apps/web/src/hooks/useRoutePlanning.ts`만. 기존 dirty는 보존.

- `RouteDock.tsx`: `let pending = setupCue.pending` → `let pending: object | null;`. 초기값만 제거. 이후 분기의 `pending` 할당은 유지.
- `useRoutePlanning.ts` `generateRoute` deps: 기존 항목 유지, `setRouteGeometry`만 추가.
- `useRoutePlanning.ts` `clearRoutePins` deps: `[]` → `[setRouteGeometry]`.

명령: `git diff --check -- apps/web/src/components/route-dock/RouteDock.tsx apps/web/src/hooks/useRoutePlanning.ts` exit 0.

미검증: eslint no-useless-assignment·exhaustive-deps, tsc, selector/fixture, 브라우저·서버. Supervisor lint/selector/fixture 재검증으로 남김.
