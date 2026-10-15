# 결과59 — 모든 경로 설정 직후 주행 시작 2회 펄스

모델: Auto (Cursor agent router). session: 이 턴 프롬프트에 conversation id 없음. branch `face-redesign2`. HEAD `80fb6a6eefbf5408371bef4827b8224e15b8f68e`. 커밋 없음.

쓰기 소유: `apps/web/src/hooks/useRoutePlanning.ts`, `apps/web/src/App.tsx`, `apps/web/src/components/route-dock/RouteDock.tsx`.

- `useRoutePlanning`은 geometry와 완료 token을 한 state에 둔다. `setRouteGeometry`는 `useCallback`으로 `Dispatch<SetStateAction<LineStringGeometry|null>>`를 유지하고 함수형 업데이트도 받는다. updater는 다음 상태만 반환한다. nonnull 설정마다 새 object token(같은 geometry 참조 재선택 포함), null이면 token null. 렌더마다 token을 만들지 않는다. return의 `routeGeometry`·`setRouteGeometry`는 유지하고 `routeSetupToken`을 추가했다.
- `App`은 `routeSetupToken`을 구조분해해 RouteDock에 넘긴다. 기존 `routeGeometry ?? null` 전달은 제거했다.
- RouteDock은 pending/consumed를 렌더 중 상태 비교로 구분한다. effect 없음. ready-to-start && !routeLoading 이전에 token을 소비하지 않고, 그 조건에서 보류 token을 1회 시작하고 펼친다. 초기 마운트의 nonnull 준비 경로도 1회. `canStartRide`가 false여도 안내를 유지한다. 같은 token의 재렌더·센서 변경·접기/펼치기·주행 종료 후 ready 복귀는 다시 시작하지 않는다. 새 token은 같은 경로도 다시 시작한다. null은 보류와 안내를 지운다. riding/paused는 안내를 끈다. animationend, reduced-motion, 900ms 2회, CSS는 그대로다.

명령: `git diff --check -- apps/web/src/hooks/useRoutePlanning.ts apps/web/src/App.tsx apps/web/src/components/route-dock/RouteDock.tsx` exit 0.

미검증: StrictMode fixture의 초기경로·준비지연·로딩·같은참조재로드 token·센서재렌더·접기·삭제·주행중·정상종료·reduced-motion, 4 viewport, shared setter와 catalog/saved/generated/Trail 로드 연결, tsc/eslint/ride-verify selector. 실제 인증·실주행. Supervisor 재검증으로 남김.
