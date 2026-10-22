# 결과01 — 관리자 지표 서버 함수

2026-10-23 · result · Claude impl-standard · 지시 [02-task-01](02-task-01.md) · 계약 [01-plan.md](01-plan.md)

## 바꾼 파일 (functions/ 만)

| 파일 | 구분 | 내용 |
|---|---|---|
| `functions/src/rideMetricsCore.ts` | 신규 | 순수 집계 `aggregateRideMetrics`, 응답 조립 `buildAdminDashboardPayload`, 적재(읽기 전용) `loadAuthAccounts`·`loadRideRows`·`loadExcludedUids`·`countPendingPublicRouteRequests` |
| `functions/src/adminDashboard.ts` | 신규 | `getAdminDashboard` (`onRequest`, region `REGION`·`cors: true`·`invoker: "public"`, 60초·512MiB). GET 만(그 외 405) |
| `functions/src/rideMetricsCore.test.ts` | 신규 | 순수 집계 시험 12건 |
| `functions/src/cliRideMetrics.ts` | 수정 | 계산 부분을 코어 호출로 교체. 옵션 `--exclude-internal` 추가 |
| `functions/src/index.ts` | 수정 | `export { getAdminDashboard } from "./adminDashboard.js";` 1줄 |
| `functions/package.json` | 수정 | `test` 스크립트 목록에 `lib/rideMetricsCore.test.js` 추가 |

`apps/web`·`firestore.rules`·기존 함수 동작은 건드리지 않았다. 배포·운영 쓰기·git 변경 없음.

## 관리자 확인

`adminPromoteSavedRoute` 와 같은 방식: `Authorization: Bearer <idToken>` → `verifyIdToken` → `isRouteReviewerUid`(`config/routeReviewers.uids`). 토큰 없음/무효 401, 관리자 아님 403, 그 외 예외 500. 응답 헤더 `Cache-Control: no-store`.

## 제외 방식

- 제외 uid = `config/routeReviewers.uids` ∪ `config/adminDashboard.excludeUids` (`loadExcludedUids`, 문서가 없으면 빈 목록, 문자열이 아닌 항목은 무시).
- 순수 집계에서: 제외 uid 는 계정 목록에서 빼고(`excludedAccounts` 로 셈 — Auth 에 존재하는 제외 계정 수), 그 uid 의 주행도 metrics·recent(가입·주행·거리) 모두에서 뺀다. Auth 에서 이미 지워진 제외 uid 의 주행도 되살아나지 않는다.
- 가입 시각 = Auth `metadata.creationTime`. 오늘 = 기준 시각의 KST 날짜, 최근 7일 = 오늘 포함 7개 KST 날짜. 처리 안 된 신청 수 = `publicRouteRequests` `status == "pending"` 의 `count()` 집계.
- 폐기 기준은 기존 `isDiscardableRideRecord`(100m 이하 또는 5초 이하, NaN 포함) 를 집계 함수 안에서 적용한다. 그래서 적재는 원시 행(`distanceMeters`·`elapsedSec` 포함)만 넘긴다.

## 접근 기록 (감리 추가 지시)

요청마다 `logger.info("admin_dashboard_access", { uid, allowed, reason? })` 한 줄 (`firebase-functions/logger`).

| 상황 | uid | allowed | reason |
|---|---|---|---|
| Bearer 헤더 없음 | `null` | false | `no_token` |
| 토큰 검증 실패 | `null` | false | `invalid_token` |
| 관리자 아님 | 토큰의 uid | false | `not_admin` |
| 통과 | 토큰의 uid | true | (없음) |

토큰 원문·이메일·응답 내용은 남기지 않는다. Firestore 기록 문서는 쓰지 않는다(로그만). 메서드가 GET 이 아닌 요청(405)은 인증 전에 끊기므로 기록하지 않는다 — 이상 접근 추적 대상이 인증 시도라서 그대로 뒀다.

## CLI 출력 동일성 (코드 경로 확인, 운영 실행 안 함)

- 표(`지표/전체/Guest/Provider` 6행)와 JSON payload 키(`measuredAt`·`policy`·`sampleNote`·`scannedRides`·`discardedRides`·`validRides`·`authAccounts`·`all`·`guest`·`provider`)와 코호트 요약 필드(`avgNewRoadKmPerRide`·`totalNewRoadKm` 포함)는 원본 그대로.
- 집계 로직(`summarize`·`pct`·`dayKeyKst`·`toMillis`)은 본문을 그대로 옮겼다. 카운터 의미도 같다: scanned = 읽은 문서 수, discarded = userId 있는 폐기 행, valid = 시각까지 읽힌 유효 행. 제외 목록은 `--exclude-internal` 일 때만 적용(기본 빈 집합).
- 한 가지 차이: `validRides` 는 제외 적용 전 유효 행 수(전역 카운터)이고, 제외된 계정의 행은 `all.validRides` 에서만 빠진다. 기본 실행에서는 둘이 같다.

## 시험 (순수 집계, 12건)

- KST 날짜 키: 15:00 UTC 직전/정각 경계
- 비율 계산(첫 주행 완료율 75, 72h 33.3, 다른 날 66.7, 새 도로 비율 0.4, 거리 합) · 코호트 분리(Auth 에 없는 uid → guest)
- 분모 0 → null (계정 없음 / 계정만 있고 주행 없음: 완료율 0, 나머지 null / 계정 0 코호트 null)
- 제외 uid 가 metrics·recent 에서 빠짐, `excludedAccounts`, Auth 에서 지워진 제외 uid 의 주행 비복원
- 폐기 기준 미만 주행(거리 100 이하·시간 5 이하·NaN) 빠짐, 101m/6초는 유효, 시각 불명 주행은 유효로 안 셈
- 최근 현황: 15:00 UTC 전후로 오늘/어제 분리, 최근 7일 창 경계(6일 전 00:00 KST 포함 / 1ms 전 제외), 가입 시각 없음 처리
- 응답 모양: 계약의 최상위 키·metrics 키만 담고 `avgNewRoadKmPerRide` 등 내부 필드는 싣지 않음, `rule` 값

핸들러(인증·로그)는 단위 시험이 없다 — Auth·Firestore 에 의존해 기존 `adminPromoteSavedRoute` 도 시험이 없는 영역이라 맞춰 뒀다.

## 계약과 다른 점

- 없음. 단, 계약에 적히지 않은 부분의 해석: `excludedAccounts` = Auth 에 존재하는 제외 계정 수. 응답 `metrics` 는 계약의 8개 필드만 담는다(CLI 전용 필드는 코어에만 있음).

## 검사 (`functions/`)

- `npm run build` 통과
- `npm test` 144건 중 144 통과 (기존 132 + 신규 12)
- `npm run lint` 오류 없음
