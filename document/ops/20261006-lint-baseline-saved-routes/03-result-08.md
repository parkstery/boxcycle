# 결과 08 — `useSavedRoutesWorkspace` set-state-in-effect 오류 제거

- 담당: Developer(Cursor CLI)
- 지시: [02-task-08.md](02-task-08.md)
- 상태: DONE
- 커밋: 없음(지시 금지)
- 허용 파일만 수정: `apps/web/src/hooks/useSavedRoutesWorkspace.ts`

## 변경 요약

로그아웃(`user` → null) 시 `savedRoutes` 를 비우던 `useEffect`+`setSavedRoutes([])` 를 제거하고, `SavedRoutesPanel`/`RideRoutePanel` 과 같은 **이전 값 비교 렌더 중 갱신**으로 옮겼다.

```ts
// 로그아웃 시 목록 비움 — effect 대신 이전 user 비교(set-state-in-effect 회피).
const [prevUser, setPrevUser] = useState(user);
if (user !== prevUser) {
  setPrevUser(user);
  if (!user) setSavedRoutes([]);
}
```

의미 보존:

| 상황 | 동작 |
|---|---|
| 초기 `user === null` | `prevUser` 초기값도 null → 비교 false, 이미 `[]` |
| `user` → null | 렌더 중 `setSavedRoutes([])` |
| null → `user` / uid 전환 | 목록을 여기서 비우지 않음(기존 effect 와 동일). 로드 effect 가 채움 |

## 로드·백필 `cancelled` 경합

렌더 중 clear 는 passive effect cleanup(`cancelled = true`) **보다 먼저** 일어난다. 그 창에서 in-flight 로드가 `setSavedRoutes(rows)` 하면 목록이 다시 채워질 수 있다(구 effect 는 clear 가 cleanup **이후**라 최종 `[]` 쪽이 유리했음).

대응(같은 파일):

- `activeSavedRoutesUidRef` + `useLayoutEffect` 로 uid 가드를 layout 단계에 동기화(렌더 중 ref 쓰기 = `react-hooks/refs` 위반이라 layout 으로 둠).
- 로드·백필 apply 조건을 `stillActive() = !cancelled && activeSavedRoutesUidRef.current === uid` 로 강화.

로그아웃 직후 layout 에서 ref=`null` → in-flight apply 차단. 기존 `cancelled` cleanup 도 유지.

## Diff

파일 1개만. 핵심:

- `-` `useEffect(() => { if (user) return; setSavedRoutes([]); }, [user]);`
- `+` `prevUser` 렌더 비교 clear
- `+` `activeSavedRoutesUidRef` / `useLayoutEffect` / `stillActive()` 가드

`git diff --stat apps/web/src/hooks/useSavedRoutesWorkspace.ts` 기준 변경은 해당 훅 한 파일.

## 검증

| 명령 | 전 | 후 |
|---|---|---|
| `npx eslint src/hooks/useSavedRoutesWorkspace.ts` (`apps/web`) | **1 error** (`react-hooks/set-state-in-effect` L183) | **0 error / 0 warning** (exit 0) |
| `npx tsc -p tsconfig.json --noEmit` (`apps/web`) | — | **exit 0** |
| `node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/ride-continue/adhoc-save-as-user-route-contract.test.ts` | — | **5 passed** (이 훅을 직접 import 하지 않는 정책 계약; 지시 예시 경로) |
| 훅 전용 단위 테스트 | 없음 | 해당 없음 |
| 포트 8080 | 즉시 **FREE** (대기 0회) | — |
| `npm run test:e2e:menu-a` | — | **1 passed** (~17.6s), deadline exit=0, elapsedMs≈48641 |

## 범위 준수

- `MapHud.*` / `App.tsx` 등 지시 06 병행 파일 **미수정**
- stash/되돌리기 **없음**
- 커밋 **없음**
