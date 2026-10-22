# 결과01 — 서버 `getLeaderboard`

2026-10-23 · result · 담당 Claude impl-standard · 지시 [02-task-01](02-task-01.md) · 계약 [01-plan](01-plan.md)

배포·운영 데이터 쓰기·규칙 변경·git 명령 없음. `functions/` 만 건드렸다(`firestore.indexes.json` 변경 없음).

## 파일

| 파일 | 내용 |
|---|---|
| `functions/src/leaderboardCore.ts` | 순수 집계(`periodStartMs` · `computeBoardSnapshot` · `layoutLeaderboard` · `renderLeaderboard` · `buildLeaderboardResponse`), 캐시 문서 변환, 읽기 전용 적재, `getBoardSnapshot`(캐시 → 계산 → 저장) |
| `functions/src/leaderboard.ts` | `getLeaderboard` onRequest (GET · REGION · cors · invoker public · `Cache-Control: no-store`). `adminDashboard.ts` 의 `parseBearerToken` 재사용 |
| `functions/src/leaderboardCore.test.ts` | 24개 시험 |
| `functions/src/index.ts` | `export { getLeaderboard }` 한 줄 추가 |
| `functions/package.json` | `test` 에 `lib/leaderboardCore.test.js` 등록 |

## 집계 규칙 (구현 결정)

- 기간: 주 = 월 00:00 KST, 월 = 1일 00:00 KST, all = 하한 없음. 포함 조건 `endedAt >= 시작`.
- t1(`conquestResult.tier == "t1"`)만. distance = `distanceMeters` 합, pioneer = `conquestResult.newMeters` 합.
- 회원 = Auth `providerData` 가 비어 있지 않고 익명 전용이 아님(admin 지표의 guest 판정과 동일). Auth 에 없는 uid 는 회원 아님. **요청자 본인만 토큰의 `sign_in_provider` 로 판정**(방금 회원 등록한 경우 캐시보다 정확).
- 순위는 **표시 값(0.1 km) 기준** 동점 → 1,2,2,4. 5.04 km 와 4.96 km 는 둘 다 5.0 으로 보이므로 같은 순위. 정렬은 값 → 원값 → uid.
- 값이 0 인 계정은 순위에서 뺀다(예: 이번 달 새 도로 0 km → `unranked`). 지시의 「unranked = t1 주행 없음」을 「양의 값 없음」으로 약간 넓힌 것.
- `around` = 내 위 2명 + **내 줄(`isMe: true`)** + 아래 2명 중 top 과 겹치는 줄을 뺀 것(클라이언트 지시의 「top → ⋯ → around, 내 줄 강조」에 맞춤). 내가 top 안이면 아래쪽 이웃 중 top 밖인 줄만 남을 수 있음 — 「⋯」를 넣을지는 클라이언트가 `around[0].rank` 와 `top` 마지막 rank+1 의 연속 여부로 판단.
- `gapToNextKm` = 내 동점 그룹 바로 앞(더 큰 값) 사람과의 차. 1위·unranked·guest 는 null.
- guest: `status:"guest"`, `rank:null`, `valueKm` = 본인 t1 값, `projectedRank` = 회원이었다면 등수(값이 0 이면 null), `uses:null`, `around:[]`.
- ranked/unranked: `projectedRank:null`. pioneer 보드의 회원은 `uses:{riders,km}` (없으면 0/0), distance 보드·게스트는 `null`.
- `uses` 는 **t1 주행만** 센다(순위와 같은 센서 규칙 — 체험 속도 계정으로 부풀리는 것 방지). 내 주행 제외, 퍼블릭 소유자 = `routePublications.applicantUid`(비었거나 문서 없음이면 제외).
- 닉네임이 없으면 「라이더」. 나 자신의 줄은 `liveTrailId: null`(자기 Trail 에 합류 버튼이 뜰 이유가 없음).
- `periodStartKst`: week/month 는 `YYYY-MM-DD`, **all 은 `null`**(계약 예시에 없던 경우). 참고: 계획서 예시 `2026-10-20` 은 화요일 — 이 주(2026-10-23 금요일 기준)의 월요일은 `2026-10-19` 이고 코드는 그렇게 계산한다.
- `generatedAt` = 스냅샷을 계산한 시각(캐시를 쓰면 그 시각).

## 질의·인덱스

- rides: `where status=="completed"` + (`endedAt >= 하한`) + `orderBy endedAt asc` + `select(userId, endedAt, distanceMeters, conquestResult, publicationId)`, 1000건씩 `startAfter` 페이지. **기존 인덱스 `rides(status ASC, endedAt ASC)` 로 충족 — 새 인덱스 없음.** all 도 같은 질의(하한만 없음).
- live: `collectionGroup("livePublicationRides").where("lastSeenAt", ">=", now-30s)` → `firestore.indexes.json` 의 `fieldOverrides`(livePublicationRides.lastSeenAt, COLLECTION_GROUP ASC/DESC)가 **이미 있다.** 새 인덱스 없음. uid = 문서 id, trailId = 부모의 부모 id.
- 회원 판정: `getAuth().getUsers()` 100명씩, 기간 안 t1 주행이 있는 uid 에 대해서만(전체 listUsers 안 함).
- 퍼블릭 소유자(pioneer 만): `getAll(routePublications/{id}, fieldMask applicantUid)` 300개씩.
- 닉네임: top ∪ around(최대 15명)만 `getAll(users/{uid}, fieldMask nickname)`.

## 캐시

- `leaderboardCache/{board}_{period}` (6개 문서). 필드: `v:1, board, period, periodStartKst, generatedAtMs, entries:[{u,m,g}], uses:{uid:{r,m}}`. 게스트 값도 `g:0` 으로 들어 있다(예상 순위 계산용).
- 요청 시: 문서를 읽어 `generatedAtMs` 가 5분 미만이고 **기간 시작 날짜가 지금 기준과 같으면** 재사용, 아니면 rides 를 다시 읽어 계산하고 `set`. 주·달이 바뀌는 순간에는 5분 안이어도 버린다.
- 캐시 읽기·쓰기 실패는 경고 로그만 남기고 요청은 계속(계산해서 응답). 동시에 낡은 요청이 여럿 오면 각자 계산한다(단순함 우선, 쓰기는 같은 값).
- 닉네임·live 는 캐시하지 않고 요청마다 읽는다(닉네임 15건 + live 범위 질의).
- 한계: 캐시 문서 1 MiB 제한 → 순위 대상 계정이 대략 1만 5천을 넘으면 `entries` 분할이 필요(현재 규모에서는 해당 없음).
- **규칙**: `firestore.rules` 에 `leaderboardCache` match 가 없고 `/{document=**}` 같은 전체 허용도 없다 → 클라이언트 접근은 기본 거부. 규칙 변경 없음(확인만). Admin SDK 는 규칙을 우회하므로 서버는 읽고 쓴다.

## 시험·검사 (functions 에서)

- `npm run build` 통과 · `npm run lint` 통과 · `npm test` 169 통과 / 0 실패 (신규 24개 포함).
- 시험이 보는 것: t0·tier 없음 제외, 게스트 제외·projectedRank(값 없으면 null), 토큰 회원이 캐시의 게스트 표시를 이김, 동점 1,2,2,4, 표시 값 동점, gapToNextKm, KST 주 경계(일요일 23:59 vs 월요일 00:00, 직전 1ms 포함)·월 경계, around(내 줄 포함·top 겹침 제거·목록 끝), pioneer uses(내 주행·t0·남의 퍼블릭 제외, distance 에서는 null), live 표시(내 줄은 null), 응답 JSON 에 uid 문자열·`"uid"` 키 없음, 캐시 왕복·5분·주 바뀜·board/period 불일치.
- **시험하지 못한 것**: 적재 함수(Firestore·Auth 호출)와 HTTP 핸들러는 에뮬레이터/운영 없이 단위 시험이 없다. 배포 전 에뮬레이터 또는 배포 후 실호출 확인이 필요하다(특히 `select()` + `startAfter` 페이지, collection group `lastSeenAt` 범위 질의).

## 계획과 달라진 점·후속 판단 거리

1. `periodStartKst` all → `null` (위).
2. 0 값 계정 제외 → 개척 보드에서 새 도로 0 km 인 사람은 `unranked`.
3. `around` 에 내 줄 포함.
4. 내부 계정(`config/routeReviewers`·`config/adminDashboard.excludeUids`) 제외는 계획에 없어서 넣지 않았다 — 운영자 시험 계정이 순위에 오를 수 있다. 필요하면 `loadExcludedUids` 를 스냅샷 단계에 붙이면 된다.
5. 토큰은 `verifyIdToken(token)`(폐기 확인 없음, adminDashboard 와 동일). 접근 로그 없음.
