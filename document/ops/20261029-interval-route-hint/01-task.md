# 경로 거리 부족 안내 — 구현 지시

2026-10-29 Chief 지시(원문은 [README](README.md)). Supervisor Claude Code 작성. 실행자 기본은 Cursor CLI이고, 막히면 impl-standard로 대체한다. 왼쪽 메뉴 묶음 감리 PASS 후 착수한다. 결과는 `02-result-<실행자>.md`에 바뀐 파일, 명령, 통과·실패·미실행과 그 이유를 기록한다.

## 확인된 부품

| 용도 | 위치 |
|---|---|
| 짧음 판정 | `isRouteShorterThanInterval(remainingMeters, speedKmh, intervalSec)` — `apps/web/src/lib/route/distanceAutoRouteEta.ts` |
| 주행 시작 경고 | `App.tsx`의 `isRouteShorterThanInterval` 호출부(`estimateKmh = resolveUserAverageKmh(...) ?? DISTANCE_AUTO_ROUTE_FALLBACK_KMH`, `remainingMeters`, `acceptedWarningKey`) → `IntervalRouteConfirm` |
| 경고 창 모양 | `components/ride/IntervalRouteConfirm.tsx`·`.css`(고정 48 흰색 콤팩트 창) |
| 인터벌 총 시간·켜기·설정 적용 | `getRideIntervalTotalSec`, `useRideInterval().onEnabled` / `.onConfig` |
| 이어 달리기 시작 오프셋 | `resumeOffsetMetersFrom` — 주행 시작 경고와 같은 남은 거리 계산 |

## 동작

1. **순수 함수**: `apps/web/src/lib/route/intervalRouteDistance.ts`는 간편 인터벌 01이 이미 만들었다(`INTERVAL_ROUTE_BASIS_KMH`, `resolveIntervalBasisKmh`). 여기에 아래 함수를 더한다.
   - `INTERVAL_ROUTE_BASIS_KMH = 25`, `resolveIntervalBasisKmh()`: 지금은 25를 돌려준다. **모든 인터벌 계산의 기준 속도는 이 함수 하나에서만 나온다.** 향후 개인 평균으로 바꿀 자리다([계획](../20261029-quick-interval-ride/00-plan.md))
   - `intervalMinRouteKm(intervalSec)`: 0.1 km 단위 올림
   - `resolveIntervalRouteShortfall({ remainingMeters, intervalSec })` → `{ short: boolean, minKm: number, routeKm: number }`

   판정은 `remainingMeters < minKm × 1000`이다. 올림한 최소 거리와 판정이 어긋나지 않게, **화면에 보이는 숫자를 기준으로 판정한다**. 경로를 6.3 km로 맞췄는데 「짧다」가 나오면 안 된다.
2. **경우 1 — 인터벌을 먼저 켠 상태에서 경로가 정해짐**: 인터벌이 켜져 있고 대기 상태일 때, 경로가 새로 정해지거나 바뀌어서(출발/도착 경로, 거리/방향 자동 경로, 저장·퍼블릭·입문 경로 불러오기) 짧으면 안내창을 띄운다.
   - 제목: 「경로가 짧아요」
   - 본문: 「인터벌 운동(15:00)을 마치려면 경로가 최소 6.3 km 필요해요. 지금 경로는 4.2 km예요. 경로를 더 길게 잡아 주세요.」
3. **경우 2 — 경로가 있는 상태에서 인터벌을 켜거나 설정을 적용함**: 경로가 있고 대기 상태일 때, 인터벌을 켜거나(`onEnabled(true)`) 켜진 상태에서 설정을 적용해(`onConfig`) 짧으면 안내창을 띄운다.
   - 제목: 「경로가 짧아요」
   - 본문: 「이 인터벌 설정(15:00)에는 6.3 km 이상의 경로를 권해요. 지금 경로는 4.2 km예요.」
   - 인터벌 설정 창이 닫힌 뒤에 띄운다. 창 위에 겹치지 않는다
4. **공통**:
   - 「시속 25 km 기준」 한 줄을 기존 경고창의 기준 줄 자리에 둔다
   - 버튼은 「확인」 하나다. 닫기(스크림·Esc)와 포커스 처리는 기존 `useDialogFocus`·`useEscapeKeyClose`를 쓴다
   - 시간은 `formatRideIntervalClock`으로 표시한다
   - 같은 (경로 키 + 인터벌 설정 키) 조합에서는 한 번만 띄운다. 키 만드는 방식은 기존 `acceptedWarningKey`를 참고한다
   - 대기 상태(`idle`)에서만 띄운다. 간편 인터벌 경로(그 묶음의 간편 모드 표시가 켜진 경로)에는 띄우지 않는다. 간편 모드가 아직 구현되지 않았으면 이 조건은 그 묶음에서 연결한다
5. **주행 시작 경고 기준 통일**: 기존 주행 시작 경고(`IntervalRouteConfirm`)의 판정 속도를 `resolveIntervalBasisKmh()`(25)로 바꾸고 같은 순수 함수를 쓴다(Chief 확정). 문구와 창 모양은 그대로 둔다. 표시되는 「예상 속도 X km/h 기준」 값만 25가 된다. 간편 인터벌(별도 묶음)도 나중에 이 함수를 쓴다.
6. **구현 방식**:
   - 컴포넌트는 `IntervalRouteConfirm`에 안내 모드(버튼 하나)를 추가하거나, 같은 CSS를 쓰는 형제 컴포넌트로 만든다. 새 색·크기·위치를 만들지 않는다
   - 「경로가 바뀜」을 effect 안의 동기 setState로 감지하지 않는다(react-hooks set-state-in-effect). 경로를 적용하는 핸들러에서 부르거나, `useRideInterval`처럼 렌더 중에 키를 비교하는 방식을 쓴다
   - 경우 1과 경우 2 중 어느 문구를 쓸지는 「마지막에 바뀐 쪽」으로 정한다

## 소유권·금지

- 수정 가능: `App.tsx`, `IntervalRouteConfirm.tsx/.css`(또는 형제 컴포넌트), 새 순수 함수 모듈, `distanceAutoRouteEta.ts`(통일에 필요한 범위만), 관련 e2e·preview·entry-contract, 새 단위 시험.
- 금지: `functions/`·Rules·비용·동기화·저장 형식 변경, 인터벌 진행 로직(`rideInterval.ts`)·응원(고정 40) 변경, 게이트·래칫 완화, 기존 시험 삭제·완화, 기존 증거 덮어쓰기. git worktree/restore/clean/stash/브랜치 전환/커밋/푸시/배포 금지. 다른 작업의 미커밋 변경을 보존한다. HANDOFF·고정 목록·ops 최종 문서는 Supervisor 소유다.
- 디자인 고정: 48(흰색 콤팩트 확인창·INT 진입), 31/32(인터벌 안내·설정 창), 14/16/18/42(왼쪽 메뉴)를 바꾸지 않는다. 폰 가로 800×360 기준.
- 서버: 3000·5031·5041은 끄지 않는다. 시험은 별도 포트를 쓴다.

## 검증

실행 폴더: `C:\20.HDev\boxcycle\apps\web`

1. 단위 시험 `scripts/interval-route-hint/interval-route-distance.test.ts`. 확인할 것:
   - 15분 → 6.3 km, 30분 → 12.5 km, 10분 → 4.2 km(4.1666 올림)
   - 6.3 km 경로는 짧지 않고 6.29 km는 짧다
   - 0·음수·NaN 입력에서 `short: false`
   - 안내와 시작 경고가 모두 `resolveIntervalBasisKmh()`를 쓰는지(25를 직접 적은 곳이 없는지 grep 결과를 첨부)
   - 일부러 틀린 구현(반올림, 20 km/h)으로 바꾸면 시험이 실패하는지 확인하고 결과에 적는다

   실행: `node --experimental-strip-types --test scripts/interval-route-hint/interval-route-distance.test.ts`
2. e2e `e2e/interval-route-hint.spec.ts`(1 worker, 0 retry, 800×360, 경로 응답 스텁). 시나리오:
   - (a) 인터벌 15분을 켜고 4 km 경로를 설정 → 경우 1 안내, 「최소 6.3 km」 표시 → 확인 → 같은 조합에서는 다시 안 뜸
   - (b) 4 km 경로를 먼저 설정하고 인터벌 15분을 켬 → 설정 창이 닫힌 뒤 경우 2 안내, 「6.3 km 이상」 표시
   - (c) 7 km 경로 + 15분 → 안내 없음
   - (d) 주행 시작 경고가 25 km/h 기준으로 뜨고 「예상 속도 25.0 km/h 기준」이 표시됨
   각 화면을 새 evidence 폴더에 캡처하고 `git status`로 기존 증거가 덮이지 않았는지 확인한다.
3. 회귀: `interval-dock-confirm`, `ride-interval-settings`, `ride-interval`, `distance-route-continuation`, 왼쪽 메뉴 관련 spec. 새 안내창이 기존 흐름을 막아 실패하면 **검사를 완화하지 말고** spec에 안내창 닫기 단계를 명시적으로 추가한다. 무엇을 고쳤는지 결과에 적는다.
4. `npx tsc -b --noEmit`, 바뀐 파일 eslint, `node scripts/ride-verify/verify-selectors.mjs`, `npm run build`.
5. 같은 증상에 5분 동안 진전이 없으면 다른 경로로 바꾼다. 전체 e2e는 돌리지 않는다.

## 완료 조건

1~4가 PASS이고, (a)~(d) 캡처가 결과에 경로와 함께 있어야 한다. 실폰은 미실행으로 표시한다. Supervisor가 독립 검증한 뒤 Chief에게 보고하고, 고정 48에 「거리 부족 안내(25 km/h 기준) 추가·시작 경고 기준 25 km/h 통일」을 반영한다.
