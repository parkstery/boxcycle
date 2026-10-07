# 검수 01 — 기존 lint 오류 15파일 36건 제거

- Supervisor: Claude · 판정: **APPROVED** (Supervisor 보정 2건 포함)

## 재확인 (Supervisor 직접 실행)
- `npx eslint src`: 0 errors · 39 warnings (전 36 errors · 44 warnings). 추가된 `eslint-disable`·`@ts-ignore`·`as any` 0건, eslint 설정 변경 없음.
- `npx tsc -b --noEmit`: 0.
- e2e: route-dock 1 pass · account-panel 1 pass · ride 5 pass / 2 fail.
  - ride 실패 2건(`입문 목록 … 0.5km 이하`, `입력 준비 전에는 Go 가 잠긴다`)은 **변경 전 코드(src stash)에서도 동일하게 실패** — 기존 실패로 확정. 본 작업 범위 밖.

## diff 검토 — 보정한 것 (Supervisor 직접 수정)
1. `useTrailInstanceMeta.ts`: fetch 실패 시 `resolved` 가 갱신되지 않아 **loading 이 영구 true** (종전 `finally` 가 해제). 또 reload 중 meta 가 null 로 떨어져 Trail 이름이 깜빡임(종전은 직전 meta 유지). → `.catch` 로 loading 종료, 같은 trailId 면 직전 meta 유지.
2. `useWorldPublicationPresenceOverlay.ts`: geometry effect deps 가 배열 `geometryCandidateIds` 를 포함해 **presence 폴링마다** effect·bump·overlay 재계산(종전은 후보 집합 문자열이 바뀔 때만). → 후보 배열을 key 문자열로 memo 해 같은 집합이면 같은 배열.

## 검토 — 그대로 승인
- `useRouteTokenBalance.ts`: deps 가 `[configured, user?.uid]` → `[active, user]`. `user` 는 `onAuthStateChanged` 의 동일 인스턴스라(같은 uid 에서 객체 교체 경로 없음 — `setUser` 호출 1곳) 재구독 증가 없음으로 판단.
- `useRideConquestResult.ts`: 키 없음 시 dispose·null — 종전 cleanup 의 dispose 와 결과 동일, 다음 키에서 새 컨트롤러 생성.
- 나머지(refs → useLayoutEffect, 이전값 비교, key 파생)는 의미 보존 확인.
