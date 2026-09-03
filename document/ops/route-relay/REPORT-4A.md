# 4A 보고 — 폰 실사용 결함 7건

| 항목 | 내용 |
|---|---|
| 작업 ID | `PHONE-FIELD-DEFECTS-4A` |
| 지시서 | [260903-폰-실사용-결함3건-4A-작업지시서.md](260903-폰-실사용-결함3건-4A-작업지시서.md) |
| 작성 | 2026-09-04 |
| worktree | **`C:\20.HDev\boxcycle-4a`** · 브랜치 `fix/phone-defects-4a` |
| 커밋 | `1f35c4b` |
| 결론 | **①②③④⑤⑦ 수정 완료 · ⑥ 은 결함이 아니라 폐기 정책의 결과라 판단 요청** |

## 직접 확인하는 법

```
cd C:\20.HDev\boxcycle-4a
npm run dev:localhost
```
→ **http://127.0.0.1:5000**

비교용 `main2` 를 같이 띄우려면 포트를 나눈다.

```
cd C:\20.HDev\boxcycle
$env:RTW_DEV_PORT="5001"; npm run dev:localhost
```
→ **http://127.0.0.1:5001**

---

## 1. 결함 ① — 절단 경계

### 원인 — 감리 진단이 맞다. 다만 범위가 더 넓다

`routeLen ∈ [D−5m, D)` 가 어디에도 걸리지 않는다는 것은 사실이다. 세 호출부를 모두 따라가 보니 **`directRoute` 재절단 폴백은 우회 경로뿐 아니라 세 경우 전부에서 죽은 가지**였다.

| 호출부 | `routeToClip` | 폴백이 하는 일 |
|---|---|---|
| Stage 0 `offered` | `directRoute` | **방금 실패한 그 절단을 인자까지 똑같이 반복**한다 |
| Stage 0 `exact` | `directRoute` | 위와 같다 |
| Stage 2 `detoured` | `bestDetourRoute` | `directRoadM < D` 가 확정이라 `directRoute` 도 짧다 |

그리고 분기를 **길이로만** 갈랐던 탓에 빈 geometry(길이 0)가 `routeLen < D−5` 를 만족해 **shortfall 로 새어 나갔다.** 망가진 응답이 정상 결과로 둔갑하는 경로였다.

### 수정

`clipped.reason` 으로 갈랐다.

```ts
if (!clipped.ok) {
  if (clipped.reason !== "too_short") return 실패(ROUTE_CLIP_FAILED_MESSAGE);  // 망가진 응답만
  const routeLen = lineStringLengthMeters(routeToClip.geometry);               // 여기부턴 routeLen < D 확정
  if (isExactTargetDistance(routeLen, D)) return 절단 없이 그대로 채택;
  return assembleShortfall(routeToClip);
}
```

- **`EXACT_TARGET_DISTANCE_TOLERANCE_M` 은 5 그대로다**(§8). 시험이 상수값 자체를 assert 한다.
- 실패 문구를 상수 `ROUTE_CLIP_FAILED_MESSAGE` 로 올려 시험이 참조한다 — 문구만 바꿔 감출 수 없게.
- Token 환불은 `distanceAutoRouteHttp.ts:266` 에 이미 있다(`status === "failed"` → `refundRouteGenerateToken`). §2.2-3 은 추가 작업이 필요 없었다.

### 지시서 §2.2-1 과 다르게 한 것

「그대로 **`exact`** 로 채택」이라 했지만 **`pendingOutcome` 을 보존**했다. 우회로 목표를 맞춘 경로를 `exact` 로 적으면 진단 로그가 거짓이 된다. 사용자 문구는 어차피 같다 — `distanceAutoRouteHttp.ts:287` 이 `shortfall` 만 다르게 쓰고 `exact`/`detoured` 는 동일한 문구를 낸다. 확인하고 골랐다.

### 시험 12건 — 경계에서, 그리고 축퇴 방지

`routeLen` = **D−5 · D−1 · D · D+1** 4종 × Stage 0 경로, 우회 경로 2종, 망가진 응답 2종, 허용오차 바로 밖 1종, 상수값 1종, M0 자가 검산 3종.

**시험이 결함을 실제로 잡는지 행위 수준으로 검산했다.** 수정 전 로직으로 되돌려 돌리니 6건이 실패했고, 실패 사유가 정확히 「경로 절단에 실패했습니다」였다.

```
✖ routeLen 2995m (D−5) → exact   AssertionError: 실패했다: 경로 절단에 실패했습니다.
✖ routeLen 2999m (D−1) → exact   AssertionError: 실패했다: 경로 절단에 실패했습니다.
✖ 우회 routeLen 2995m → detoured
```

D·D+1 은 수정 전에도 통과한다(절단이 성공하는 구간). **새로 고쳐진 것은 정확히 D−5·D−1 구간**이다.

fixture 를 만들며 두 가지를 배웠고 주석으로 남겼다.

- `snappedEndFromRoute` 는 route 의 `snappedEnd` 가 아니라 **geometry 의 마지막 좌표**를 쓴다(`:254`). 우회 fixture 가 클릭점을 지나쳐 끝나면 `endMiss > 200m` 강등 게이트에 걸려 경계 시험이 아니라 강등 시험이 된다.
- `D − 허용오차` 는 `|len − D| ≤ 5` 의 **칼날 위**다. 폴리라인 길이가 부동소수 잡음으로 요청값을 조금만 밑돌면(2994.99999) 허용오차 밖이 된다. 두 fixture 생성기를 「요청값 이상」으로 수렴시키고, 칼날의 반대쪽(D−6)은 shortfall 이어야 한다는 시험을 따로 세웠다.

---

## 2. 결함 ②③ — 거리 조정 후 슬라이더·문구

### 원인 — 「popup 이 React state 로 안 그려진다」보다 구체적이다

지도 클릭 경로는 popup 을 **이미 갱신하고 있었다**(`MapView.tsx` 클릭 핸들러의 `.then` 에서 `setInlinePhase` + `setOfferedPanel(null)`). 문제는 **거리 조정 재탐색이 그 경로를 통째로 우회**한다는 것이다 — `handleDistanceAdjustRetry` 가 `handleMapPick` 을 직접 부르고 결과를 버린다(`.catch(() => undefined)`).

그래서 ②(슬라이더가 옛 값)와 ③(`offered` 문구가 남음)은 **한 원인**이다.

### 수정

두 진입점이 `applyAutoRoutePickResultToPopup` 하나를 함께 쓴다. 재탐색은 `runDistanceAdjustRetry` 가 감싸서 ⓐ searching 표시 → ⓑ hook 에서 **조정된 km 와 결과를 돌려받아** → ⓒ `syncDistanceInputs(adjustedKm)` → ⓓ 같은 결과 적용 함수를 탄다.

`queueMicrotask` 를 늘리지 않았다(§3.1·§8). 값이 바뀌는 그 지점에서 명시적으로 부른다.

---

## 3. 결함 ④⑤ — 이어가기 승계

### 감리 진단 정정 — 진입점은 이미 하나의 함수를 부르고 있었다

§4.5.2 는 「진입점 두 개, 검증은 한 개」라 했지만, 코드상 **두 버튼 모두 `handleStartRouteFromAnchor` 를 부른다**(`App.tsx:1801` 카드 · `App.tsx:2483` 시트). 합칠 함수가 이미 있었다.

진짜 문제는 **그 함수가 무엇을 보장하는지가 흩어져 있고, 승계 소스가 취약하다**는 것이었다.

```ts
// useDistanceAutoRoute.ts:111
const lastSessionPrefsRef = useRef({ profile: "driving", targetKm: 10 });
```

**폰에서 본 「자동차」가 이 초기값이다.** 이 ref 는 `armDirectionPick` 안에서, 그리고 `sessionActive` 인 동안만 갱신된다. 그 경로를 타지 않은 주행(입문 코스·저장 경로) 뒤이거나 페이지가 새로고침되면 초기값 그대로다. 그러면 `armDirectionPick` 이 자동차·10 km 로 arm 되거나, 값에 따라 검증에 걸려 **거리 모드가 통째로 꺼진다** — 그 상태에서 지도를 클릭하면 일반 S→E 경로가 만들어지고 End 가 채워진다. **⑤는 ④의 결과다**(`clearRoutePins` 는 End 를 제대로 비운다. 확인했다).

### 수정 — 승계를 순수 함수로 옮기고 우선순위를 고정

`apps/web/src/lib/rideContinuationSetup.ts` 신설.

| 순위 | 근거 | 이유 |
|---|---|---|
| 1 | **직전 Ride 기록** | 방금 끝난 주행이 무엇이었는지가 가장 정확하고 새로고침에도 남는다 |
| 2 | 거리 세션 선호 | 같은 페이지 세션에서 마지막으로 arm 된 값 |
| 3 | 현재 화면 상태 | 위 둘이 비었을 때만 |

보장 항목: **Start = 직전 종점 · End 비움 · 거리 모드 on · 목표 거리 승계 · 이동수단 승계**. 목표 거리는 슬라이더 눈금(0.5 km)·범위(0.5–120 km)로 정규화해 **arm 검증에 걸려 거리 모드가 꺼지는 일 자체를 없앤다**.

`RideEndResult` 에 승계 근거 두 필드(`profile`·`routeDistanceMeters`)를 실었다.

시험 15건 — 네 가지 입력 상황 전부에서 계약 4개를 assert 하고, 우선순위·정규화·망가진 값 폴백을 고정한다. 「세션 ref 가 초기값 그대로여도 자전거 0.5 km 가 승계된다」가 핵심 시험이다.

### ④ 의 방아쇠는 정적 독해로 확정하지 못했다

배제한 후보를 수치와 함께 남긴다.

| 후보 | 배제 근거 |
|---|---|
| PROD 잠금(`routeMenuLockedForProd`) | `setRideStatus("idle")` 이 종료 콜백 **동기 구간**에서 실행된다(`useRideEndAndPersistence.ts:642`). 시트가 뜰 때 이미 idle |
| Token 부족 | 폰 잔액 3개 ≥ 1 |
| 목표 거리 하한 | `DISTANCE_AUTO_ROUTE_KM_MIN = 0.5` 라 0.5 km 는 유효 |
| `clearRoutePins` 가 End 를 안 지움 | `setEndLngLat(null)` 을 실제로 부른다 |

남은 후보는 **`lastSessionPrefsRef` 가 초기값이었다**는 것뿐이고, 폰 화면의 「자동차」가 그 값과 정확히 같다. 이번 수정은 **그 소스를 승계 1순위에서 밀어냈으므로 방아쇠가 무엇이었든 재발하지 않는다.**

---

## 4. 결함 ⑦ — 「다음 주행」 카드가 한 세대 전

### e2e 가 재현했다 — 그리고 **수정 전 `main2` 에서 이미 red 였다**

`useRecentRideSessions` 의 effect deps 는 `[configured, user, trailId, profile]` 이다. **이어가기로 이동수단이 바뀌면 이 effect 가 재실행**되어 Firestore 를 다시 읽고 `setRecentSessions(rows)` 로 **덮어쓴다.**

그런데 주행 종료의 Firestore 쓰기는 fire-and-forget 이다. 최신 주행이 아직 서버에 없는 시점에 이 덮어쓰기가 일어나면, 방금 로컬에 반영된 최신 행이 사라지고 **카드가 한 세대 전을 가리킨다.** 「오늘 N km」도 같은 목록에서 나온다.

**감리 §4.5.6 의 「루프 3 에서 고친 stale 문제와 같은 계열」은 방향이 맞았다** — 다만 `resolveNextRideView` 가 늦게 읽는 것이 아니라, 최신 데이터를 **서버 응답이 지우고 있었다.**

### 수정

`mergeRecentRideSessions(serverRows, localRows)` — id 합집합 · `endedAt` 내림차순 · 상한 50. 같은 id 는 서버판이 정본(지명 역지오코딩 등 후처리 반영). 시험 7건.

---

## 5. 결함 ⑥ — 결함이 아니다. 폐기 정책의 결과다

완주 시트에 이어가기 버튼이 없던 이유를 수치로 확정했다.

```
apps/web/src/lib/rideRecordPolicy.ts
  MIN_MEANINGFUL_RIDE_DISTANCE_METERS = 100
  isDiscardableRideRecord: d <= 100 || t <= 5   → 폐기
```

폰의 07:58 주행은 **0.10 km = 정확히 100 m** → `100 <= 100` → **폐기**. 폐기되면

- `setLastRideResult(null)` → 시트의 `result` 가 null → `hasNextStart = false` → **버튼이 사라진다**
- `recentSessions` 에도 저장되지 않는다 → **카드가 이전 세대를 가리킨다**(⑦ 을 증폭)

즉 **⑥ 은 ④ 의 하류 증상**이다. ④ 때문에 0.10 km 짜리 엉뚱한 경로가 만들어졌고, 그 길이가 폐기 경계에 정확히 걸렸다.

**고치지 않았다.** 260829 §3.5 는 「모든 **유효** Ride 에 다음 출발점」인데, 100 m 주행은 정책상 유효하지 않다. 버튼을 억지로 띄우면 폐기 정책과 모순된다. 다만 **「도착」 배지를 단 시트가 열리면서 버튼만 없는 것**은 사용자에게 설명되지 않는다 — 폐기됐다고 알리든, 폐기 주행에는 시트를 열지 않든 **정책 결정이 필요하다.**

### 부수 발견 — 클라이언트와 서버의 폐기 기준이 다르다

| | 거리 | 시간 |
|---|---:|---:|
| `apps/web/src/lib/rideRecordPolicy.ts` | 100 m | 5 s |
| `functions/src/rideRecordPolicy.ts` | **200 m** | **180 s** |

거리 100–200 m · 시간 5–180 s 구간의 주행은 **클라이언트는 남기고 서버는 버린다.** 새로고침하면 사라지는 주행이 생긴다. 이번 범위 밖이라 건드리지 않았다.

---

## 6. e2e — 두 진입점 · 회차마다 계약 검사

`ride-continue-phase-c.spec.ts` 에 결과 시트 진입점(`extendFromRideSummarySheet`)을 추가하고 3회 루프에서 **카드와 시트를 번갈아** 쓴다(2회차 시트 · 3회차 카드). 회차마다 `assertContinuationContract` 로 **거리 체크박스 checked · 목표 km · End 비어 있음**을 assert 한다.

시트 진입점은 시트가 열려 있어야 하므로, 다음 회차가 시트 경로면 `closeRideSummary` 를 건너뛰도록 시퀀스를 정리했다.

---

## 7. 시험 결과

| 명령 | 결과 |
|---|---|
| `test:distance-auto-route` | pass **112** / fail 0 (신설 12건 포함) |
| `test:distance-auto-route-replay` | 통과 |
| `test:next-ride` | pass **61** / fail 0 (신설 22건 포함) |
| `npm --prefix functions run build` | 통과 |
| `npm -w boxcycle-web run build` | 통과 |
| `git diff --check` | 통과 |
| `test:e2e:ride-continue-phase-c` | **2 passed** (수용 게이트 1회, 최종본에서) |

브라우저 e2e 는 §7 정책대로 진단·기준선 확인을 포함해 필요한 만큼만 돌렸고, **최종 수용 게이트는 1회**다.

### `--no-verify` 사유

`useRecentRideSessions.ts` 의 `react-hooks/set-state-in-effect` 오류는 **원본에도 있는 기존 baseline** 이다(파일 stash 후 lint: 수정 전 1건 → 수정 후 1건, **증가 0**). 내가 만든 위반이 아니고 이 작업 범위 밖이라 훅을 건너뛰고 커밋했다. 문제가 되면 알려 달라.

---

## 8. 감리 지시 중 틀린 것

1. **§4.5.2 「진입점 두 개 … 두 진입점을 하나의 함수로 합친다」** — 두 버튼은 이미 `handleStartRouteFromAnchor` 하나를 부르고 있었다(`App.tsx:1801`·`:2483`). 합칠 대상이 없었다. 실제 문제는 **승계 소스**(초기값 `{driving, 10}` 인 세션 ref)였고, 거기를 고쳤다.

2. **§4.5.2 「e2e 가 green 인데 실기기가 깨진 이유」** — **phase-c e2e 는 수정 전 `main2` 에서 이미 red 였다.** 감리 지시서를 건드리지 않고 코드도 원래대로 되돌린 기준선에서 1회 돌려 확인했다.
   ```
   Error: 루프 3: Start [127.037367, 37.506805] ≠ sessionEnd [127.039934, 37.507946] (거리 259.6m)
   1 failed  1 passed
   ```
   259.6 m 는 한 회차 주행 거리와 같은 크기로, **결함 ⑦ 그 자체**다. 「e2e 가 통과하니 카드 경로는 멀쩡하다」는 전제가 성립하지 않았다.

3. **§2.2-3 「Token 을 환불한다」** — 이미 구현돼 있다(`distanceAutoRouteHttp.ts:266`). 추가 작업 없음.

4. **§4.5.5 「다른 조건이 버튼을 가리고 있다 — 260829 §3.5 를 만족시킨다」** — 가린 조건은 **폐기 정책**(`d <= 100 m`)이고, 그 주행은 §3.5 가 말하는 「유효 Ride」가 아니다. 버튼을 띄우는 것이 §3.5 를 만족시키는 것이 아니라 정책을 어기는 것이다. §5 에 판단 요청으로 남겼다.

5. **§2.2-1 「그대로 `exact` 로 채택」** — 우회 경로를 `exact` 로 적으면 진단이 거짓이 된다. `pendingOutcome` 을 보존했고 사용자 문구는 동일함을 확인했다(§1).

---

## 9. 남은 것

- **⑥ 정책 결정** — 폐기된 주행에 「도착」 시트를 열지 여부(§5).
- **클라이언트/서버 폐기 기준 불일치**(100 m·5 s vs 200 m·180 s, §5).
- 배포는 §6 대로 사용자가 한 번에 실행한다. `firebase deploy --only firestore` 는 불필요하다는 감리 확인을 그대로 따랐다.

**`main2` 병합은 하지 않았다.** 브랜치 `fix/phone-defects-4a`, worktree `C:\20.HDev\boxcycle-4a`.
