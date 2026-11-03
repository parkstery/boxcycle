# G3-1 지시서 — 순위를 누적 점수로 전환 (전세계 범위, 응답 계약 유지)

작성 2026-11-03 Supervisor Claude Code · 실행 impl-standard · 상위 계획 [00-plan §4.3](00-plan.md) · 비용 근거 [cost-squeeze L6](../20261103-cost-squeeze/01-audit.md)

## 목적

`getLeaderboard`가 캐시 만료 때마다 기간 안 `rides`를 전부 훑는 구조(L6)를 없앤다. 주행이 끝날 때 사용자별 점수 문서에 더해 두고, 요청은 상위 N·내 순위만 읽는다. **응답 모양과 순위 규칙은 지금과 완전히 같아야 한다**(클라이언트 변경 없음). 지역 범위(대륙·국가·행정구역)는 G3-2(국가 입력 화면 이후)에서 붙인다. 이번에는 `scopeType: "world"`만 쓰되 필드는 지금 둔다.

## 지켜야 할 현재 규칙 (`functions/src/leaderboardCore.ts`)

- 판: `distance`(= `distanceMeters`), `pioneer`(= `conquestResult.newMeters`). 기간: `week`·`month`·`all`(KST 경계, `periodStartMs`).
- 인정: `isLeaderboardTierEligible(tier, LEADERBOARD_SENSOR_ONLY)`. 지금은 `LEADERBOARD_SENSOR_ONLY=false`(t0 포함)이고 출시 전에 true로 되돌린다. **두 값 모두 즉시 전환 가능해야 한다** → 점수를 `metersT1`(센서 인정만)·`metersAll`(전부) 두 갈래로 쌓는다.
- 순위는 **회원만**(요청자는 토큰, 나머지는 회원 표시). 0.1km(`tenthsOf`) 기준 동점은 같은 순위(1,2,2,4). 동점 정렬은 meters desc → uid asc. 상위 `LEADERBOARD_TOP_N`, 내 앞뒤 `AROUND_SPAN`, `gapToNextKm`, 게스트는 `projectedRank`, 개척판 회원은 `uses`(내 Publication을 남이 달린 사람 수·거리). 응답에 uid 없음.
- 「지금 주행 중」(`loadLiveTrailsMemo`)·닉네임 로딩은 그대로 둔다.

## 데이터

| 컬렉션 | 문서 id | 필드 |
|---|---|---|
| `leaderboardScores` | `{board}_{periodKey}_{scopeType}_{scopeCode}_{uid}` | `board, periodKey, scopeType("world"), scopeCode("-"), uid, member(bool), metersT1, metersAll, tenthsT1, tenthsAll(정수), updatedAt` |
| `leaderboardUses` | `{periodKey}_{ownerUid}` | `periodKey, ownerUid, riders, meters` — 개척판 uses |
| `leaderboardUseMarks` | `{periodKey}_{ownerUid}_{riderUid}` | 표식(처음 생길 때만 riders +1) |
| `leaderboardScoreApplied` | `{rideId}` | 한 주행을 두 번 더하지 않는 원장(트리거는 at-least-once) |

- `periodKey`: `W{ISO연}-{ISO주 2자리}`·`M{YYYY}-{MM}`·`Y{YYYY}`·`all`. 시간대는 `rides.timeZone`(아직 없음) → 없으면 `Asia/Seoul`(D11). 연(`Y`)도 지금 쌓는다(D14, 응답에는 아직 안 나감).
- `tenths*`는 트랜잭션에서 새 meters로 다시 계산해 저장한다(동점·순위 쿼리용).
- `member`: 쓰기 시점 Auth(익명 아님 = 회원). 게스트가 Google 연결하면(`guestLinkHttp` 성공 경로) 그 uid의 점수 문서 `member=true`로 갱신.

## 쓰기

- 시점: `rides/{rideId}`에 `conquestResult.tier`가 **처음 생길 때**(Conquest 트리거가 채운 뒤 — `onDocumentWritten`에서 before 없음/tier 없음 → after tier 있음). `status=="completed"`만.
- 한 트랜잭션: 원장 있으면 끝. 없으면 판2 × 기간4(W·M·Y·all) 점수 문서를 읽어 더하고(인정 갈래별), 개척판이면서 `publicationId`의 소유자가 본인 아님 → uses 표식·합계, 원장 생성.
- 순수 함수로 「이 주행이 어느 문서에 얼마를 더하나」를 만들고 시험한다(`leaderboardScoresCore.ts`).

## 읽기 (`getBoardSnapshot` 대체)

- 갈래 필드 f = sensorOnly ? `T1` : `All`.
- 상위: `where(board, periodKey, scopeType, scopeCode ==) .where(member == true) .where(tenths f > 0) .orderBy(tenths f desc, meters f desc) .limit(TOP_N + 여유)` → 동점 규칙으로 순위 매기기(동점이 상위 경계를 넘을 수 있으니 rank는 count로 확정).
- 내 순위: `count(member == true, tenths f > 내 tenths) + 1`. around: 내 위·아래 각 `AROUND_SPAN`(쿼리 2개).
- 게스트 `projectedRank`: 같은 count(회원 중 나보다 큰 수)+1.
- uses: `leaderboardUses/{periodKey}_{uid}` 한 건.
- 요청 공통부(상위 목록)만 인스턴스 메모 60초. 캐시 문서(`leaderboardCache`)는 이 경로에서 쓰지 않는다. 임시 TTL 30/60분 상수는 남겨도 되지만 새 경로에서는 쓰지 않는다.
- 색인: 위 쿼리용 복합 색인을 `firestore.indexes.json`에 추가(T1·All 각각).

## 함께 해야 하는 것

- Rules: 세 컬렉션 모두 클라이언트 접근 없음(match 없음 = 거부, 기존 `leaderboardCache`와 같음).
- **계정 삭제·게스트 정리**: `accountDeletionCore.ts` 컬렉션 목록과 삭제에 `leaderboardScores`(uid 필드)·`leaderboardUseMarks`(rider/owner)·`leaderboardUses`(owner) 추가. 빠뜨리면 탈퇴자가 순위에 남는다. 기존 시험 패턴(`guestLifecycleDelete.test.ts` 등)으로 시험.
- 채우기 CLI: `functions/src/cliBackfillLeaderboardScores.ts` + `package.json` `admin:backfill-leaderboard-scores`(기본 dry-run, `--apply`일 때만 쓰기, 원장으로 멱등). **운영에서 실행하지 않는다**(Supervisor가 승인 후 실행).
- `functions/package.json` test 목록에 새 시험 등록.

## 완료 조건

1. 단위 시험: ISO 주 경계(연말·연초, KST), 월·연 키, 한 주행의 증분 목록(판·기간·갈래·uses), 원장 멱등, 동점·회원·게스트·around·gap 규칙.
2. **동등성 시험**: 같은 합성 주행 묶음으로 「기존 `computeBoardSnapshot`+`layoutLeaderboard`」와 「새 점수 경로」의 응답이 같다(판2×기간3×요청자 회원/게스트/미순위). 점수 경로는 가짜 Firestore 또는 순수 함수로 재현.
3. 사보타주: 동점 처리나 member 필터를 일부러 빼면 동등성 시험이 FAIL하는 것을 확인하고 되돌린다.
4. `cd C:\20.HDev\boxcycle\functions; npm test` 전부 PASS, `npx eslint src` 오류 0, `node scripts/check-firebase-accessors.mjs --check`(루트) PASS.
5. 결과 보고: `03-result-g3-1.md`(바꾼 파일·시험 수·사보타주 결과·남은 위험).

## 금지

커밋·푸시·배포·운영 데이터 쓰기 금지. `git restore`·`checkout -- .`·`stash`·`clean`·worktree 금지(남의 미커밋 변경이 있다). `apps/web` 수정 금지. 응답 계약(`LeaderboardResponse`) 변경 금지.
