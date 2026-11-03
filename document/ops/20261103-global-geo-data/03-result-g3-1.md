# G3-1 결과 — 순위를 누적 점수로 전환

작성 2026-11-03 · 구현 impl-standard(Claude) · 지시서 [02-task-g3-leaderboard-scores.md](02-task-g3-leaderboard-scores.md)
커밋·푸시·배포·운영 쓰기 없음. `apps/web` 변경 없음. `LeaderboardResponse` 계약 변경 없음.

## 바꾼 파일

새 파일 (`functions/src/`)
- `leaderboardScoresCore.ts` — 순수 계산: 기간 키(W/M/Y/all, ISO 주, 시간대 기본 Asia/Seoul), 문서 id, 「한 주행 → 증분 목록」(`planRideScoreWrites`), 증분 적용(`applyScoreIncrement`·`applyUseIncrement`)
- `leaderboardScoresStore.ts` — 쓰기 `applyRideScoresInTransaction`(원장 멱등 한 트랜잭션)·`markLeaderboardScoresMember`, 읽기 `loadLeaderboardLayoutFromScores`(상위 N·count·around·gap)
- `leaderboardScoresOnRideWritten.ts` — 트리거(`rides/{rideId}` onDocumentWritten, tier 처음 생길 때·completed만), `rideScoreInputFromData`
- `cliBackfillLeaderboardScores.ts` — 채우기 CLI(기본 dry-run, `--apply`만 쓰기)
- `leaderboardFakeFirestore.ts` — 시험용 가짜 Firestore(where/orderBy/startAfter/limit/count/트랜잭션 해석)
- `leaderboardScoresCore.test.ts`(23건)·`leaderboardScoresParity.test.ts`(6건)

수정
- `leaderboard.ts` — `getBoardSnapshot` 호출을 `loadLeaderboardLayoutFromScores`로 교체(응답 조립 `renderLeaderboard`·닉네임·live는 그대로)
- `leaderboardCore.ts` — `LEADERBOARD_SENSOR_ONLY`·`AROUND_SPAN`·`kstDateKey`·`tenthsOf`·`kmOfTenths`·`isLeaderboardTierEligible`에 `export`만 추가(로직 변경 없음). 옛 `getBoardSnapshot`·캐시·TTL 상수는 남김(동등성 시험의 기준 경로)
- `guestLifecycleHttp.ts` — `guestLinkHttp`: `action=complete` 성공(200) 뒤 `markLeaderboardScoresMember`(실패는 경고 로그만, 연결 응답은 막지 않음)
- `accountDeletionCore.ts` — 정책에 `leaderboardScores`·`leaderboardUses`·`leaderboardUseMarks`·`leaderboardScoreApplied` = delete
- `purgeGuestUsersCore.ts` — `deleteGuestUidFirestoreData`가 위 4개 컬렉션(uid / ownerUid / riderUid·ownerUid 표식 / 원장 uid)을 지움 → 탈퇴·게스트 정리 공통
- `index.ts` — `leaderboardScoresOnRideWritten` export
- `functions/package.json` — test 목록에 두 시험 등록, `admin:backfill-leaderboard-scores` 추가
- `firestore.indexes.json` — `leaderboardScores` 복합 색인 2개(T1·All): `board, periodKey, scopeType, scopeCode, member ↑, tenths{T1|All} ↓, rounded{T1|All} ↓, uid ↑`
- Rules는 손대지 않음(새 컬렉션 match 없음 = 클라이언트 접근 거부)

## 지시서 밖에서 내린 설계 결정 (편차)

1. **`rounded{T1,All}` 필드 추가** (스키마에 없음). 기존 집계는 합을 한 번 반올림한 정수 meters로 정렬한다. 원본 합(`meters*`, 증분 정확 누적용)만으로 정렬하면 5000.4 vs 5000.3 같은 경우 동점 그룹 내 순서(uid asc)가 달라져 byte 동일이 깨진다. 정렬·표시는 `rounded*`, 색인도 이 필드를 쓴다. 동등성 시험이 소수 0.25 m 합산으로 이 경우를 포함한다.
2. **uses를 T1/All 갈래로 분리**: `leaderboardUses`는 `ridersT1, metersT1, ridersAll, metersAll`, 표식은 `t1, all` 플래그. 지시서의 단일 `riders, meters`로는 `sensorOnly` 전환 시 기존 규칙(센서 인정 주행만 uses 집계)을 지킬 수 없다.
3. **상위 쿼리 limit = TOP_N + 1**, rank는 count가 아니라 정렬 위치로 계산. 쿼리가 항상 1위부터 시작하므로 위치 기반 1,2,2,4가 정확하다. 한 줄 여유는 토큰상 게스트인 요청자를 빼거나 stale한 요청자 줄을 다시 끼울 때를 위한 것. 내 순위·around 줄 순위는 count 쿼리.
4. **요청자 줄은 토큰·내 문서(최신) 기준으로 재삽입**, 60초 메모된 상위 목록의 낡은 요청자 줄은 버린다. 문서는 비회원인데 토큰은 회원인 경우(링크 직후 등)도 기존과 같게 순위에 든다(해당 경우 줄별 count에 +1 보정). 모든 uid×(회원/게스트 토큰) 조합을 동등성 시험에 포함.
5. **트리거는 retry 미설정**(이웃 트리거와 동일). 실패 시 놓친 점수는 백필 CLI(원장 멱등)로 복구한다.
6. **원장 컬렉션에도 `uid` 저장**하고 탈퇴 시 삭제(개인 식별자를 남기지 않기 위해). 인정 대상이 아닌 주행(tier 없음 등)은 원장을 만들지 않는다.
7. 인정 대상이 아닌 판(값 0)은 점수 문서를 만들지 않는다.

## 검증

| 명령 | 결과 |
|---|---|
| `cd C:\20.HDev\boxcycle\functions; npm test` | tests 234 / pass 234 / fail 0 (suites 34). 이 중 신규 29건(core 23 + parity 6) |
| `npx eslint src` (functions) | exit 0, 오류 0 |
| `node scripts/check-firebase-accessors.mjs --check` (루트) | PASS (위반 0, 두 규칙) |
| `firestore.indexes.json` | JSON 파싱 확인 |

동등성 시험 범위: 무작위 합성 3묶음(46 회원+6 게스트+주행 없는 2, 경계 시각·t0/t1/미처리/알수없는 tier·null endedAt·개척판 uses 포함) + 20위 경계 동점 구성 1묶음 × 판 2 × 기간 3 × sensorOnly 2 × 모든 요청자 × 회원/게스트 토큰. 응답 전체 `deepEqual`. 점수 경로는 주행을 섞은 순서로 트랜잭션에 한 건씩 넣어 만든다. 동등성 시험이 처음 돌았을 때 uses km에서 불일치가 나와(기존은 합을 반올림한 뒤 0.1km 변환) 새 경로를 고쳤다.

## 사보타주 결과

임시로 `leaderboardScoresStore.ts`를 고쳐 `leaderboardScoresParity.test.js`를 돌린 뒤 원본(백업 diff identical)으로 복구했다.
- 동점 처리 제거(`rank = i + 1` 상당): 6건 중 4건 FAIL(seed 1·2·3 + 경계 구성), 2 pass
- member 필터(`.where("member","==",true)`) 제거: 6건 중 4건 FAIL, 2 pass
- 복구 후: 6건 전부 PASS, 전체 `npm test` 234/234

## 남은 위험

- **색인 배포 전에는 getLeaderboard가 실패한다**(복합 색인 미생성 오류). 배포 순서: 색인 생성 완료 → 트리거 배포 → 백필 `--apply` → getLeaderboard 전환. 백필 전에는 점수 문서가 없어 순위가 비어 보인다. 현재 `leaderboard.ts`는 점수 경로만 쓴다(롤백 시 이전 배포로 되돌려야 함).
- 가짜 Firestore는 쿼리 의미를 흉내 낸 것이다. 실제 Firestore의 색인 요구(동일 필드 두 부등호 `tenths > 0` + `tenths > x`, 역방향 스캔, 커서)는 에뮬레이터/실 DB 첫 호출로 확인해야 한다.
- **탈퇴자의 개척 이용 합계**: 라이더 표식은 지우지만 소유자의 `riders`/`meters` 합계는 줄이지 않는다(기존 방식은 라이더 주행이 사라지면 자연히 빠졌다). 소유자 문서는 기간이 지나며 새 키로 넘어가고 `all`만 남는다.
- **member 표시는 쓰기 시점·링크 시점 값**: 기존 캐시와 달리 Auth 변경이 즉시 반영되지 않는다. 링크 핸들러의 갱신이 실패하면 다음 주행 때까지 타인 순위에 안 들 수 있다(본인 화면은 토큰 기준이라 정확).
- 합산 순서가 달라 부동소수 합이 기존 집계와 1 m 미만 차이날 수 있고, 반올림 경계(x.5)에서 0.1 km 값이 갈릴 수 있다(시험은 0.25 단위로 정확 일치 확인).
- 상위 목록은 인스턴스당 60초 메모라 타 사용자의 갱신이 최대 60초 늦다(요청자 본인 값은 항상 최신). 메모는 인스턴스별이라 콜드스타트마다 top 쿼리 1회.
- 트리거는 tier가 처음 생기는 업데이트에만 반응한다. `conquestOnRideCreated`가 조건 미달로 tier를 쓰지 않는 주행은 점수에 들지 않는다(기존 집계도 tier 없는 주행은 제외라 동일).
- `rides.timeZone`이 생기기 전까지 모든 기간 키는 Asia/Seoul. 읽는 쪽 `periodKeyForRequest`도 기본 시간대만 쓴다 — 지역 범위(G3-2) 때 요청자 시간대를 넘기도록 확장해야 한다.
- 운영 백필은 실행하지 않았다(Supervisor 승인 후 `npm run admin:backfill-leaderboard-scores` dry-run → `-- --apply`).

## 감리 (2026-11-03, Supervisor Claude Code 직접)

판정: **코드 PASS · 운영 색인 확인 전 배포 보류**

| 확인 | 결과 |
|---|---|
| functions `npm test` 재실행 | 234/234 (신규 29) |
| `npx eslint src` | 오류 0 |
| 동등성 시험이 기존 경로와 비교하는가 | `computeBoardSnapshot`+`buildLeaderboardResponse` ↔ `loadLeaderboardLayoutFromScores`+`renderLeaderboard`, 응답 deepEqual — 확인 |
| 사보타주 재현(Supervisor) | `member == true` → `member != null`: parity 4/6 FAIL → 복원 6/6, 파일 원본 동일(cmp) |
| 트리거 조건 | tier 첫 등장·completed·uid 있음·guestLifecycle tombstone 건너뜀 — 확인 |
| 삭제 등록 | 탈퇴(`accountDeletionCore` 정책표)·게스트 정리(`purgeGuestUsersCore` uid/ownerUid/riderUid) 4컬렉션 — 확인 |
| 운영 색인 검사(읽기 전용, 빈 컬렉션) | 색인 배포 전이라 쿼리 10모양 전부 FAILED_PRECONDITION(예상). **오름차순 「내 앞」 쿼리 2모양·count가 내림차순 색인 하나로 처리되는지는 색인 배포 후 같은 검사로 확정**(scratchpad `lb-index-probe.cjs`) |

배포 순서(Chief 승인 필요): ① `firestore:indexes` 배포 → 빌드 완료 후 색인 검사 재실행, 부족분 추가 ② 커밋·푸시 ③ `functions:leaderboardScoresOnRideWritten`만 배포(새 주행부터 쌓임, 순위 화면은 아직 옛 방식) ④ 채우기 dry-run → `--apply`(새 컬렉션만 씀, 기존 데이터 무변경) ⑤ 운영에서 옛 방식·새 방식 응답 읽기 전용 대조 ⑥ `getLeaderboard`·`guestLinkHttp`·삭제 함수 배포.

### 감리 추가 — 운영 색인 검사 결과 (2026-11-04)

색인 배포 후 읽기 전용 검사에서 쿼리가 요구하는 색인을 오류 링크(create_composite)로 풀어 대조했다.

| 쿼리 | 지시서·구현의 색인으로 처리? | 조치 |
|---|---|---|
| 상위 목록·「내 뒤」(desc, desc, asc) | 예 | — |
| 개수(count, `tenths > x`) | **아니오** — `tenths` 오름차순 단일 범위 색인 필요 | 추가 |
| 「내 앞」(asc, asc, desc) | **아니오** — 내림차순 색인을 거꾸로 쓰지 않는다 | 추가 |

T1·All 각각 2개, 총 4개를 `firestore.indexes.json`에 추가해 배포했다. 그대로 함수를 전환했다면 회원 요청마다 순위 조회가 FAILED_PRECONDITION으로 깨졌을 것이다(가짜 Firestore·에뮬레이터는 색인을 검사하지 않는다 — 보고서의 「남은 위험」이 실제였다).
