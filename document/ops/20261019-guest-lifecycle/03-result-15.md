# 구현15 결과 — routeAutoRouteCache 개인 삭제

- 날짜: 2026-10-19. 수행: Cursor. 모델: Auto.
- GLM 소유 파일(guestLifecycleHttp·guestLifecycleAdmin·tierQuota·onboarding·index)과 Supervisor scripts는 수정하지 않았다. `listProfileUids`도 수정하지 않았다. 운영 Firebase·인증·`.out/private-guest-lifecycle`·evidence는 읽지 않았다. 커밋·푸시·배포 없음. 에뮬레이터는 기동하지 않았다.

## 1. 수정

`routeAutoRouteCache`는 문서 id가 uid가 아니고 `userId`로 귀속된다. 개인 삭제 목록에 없어서 고아로 남고, 삭제 뒤 진행 중 경로 계산이 캐시를 다시 쓸 수 있었다.

- `ACCOUNT_DELETION_POLICY.routeAutoRouteCache`는 `delete`다. 공용 컬렉션 분류는 그대로다.
- `purgeGuestUsersCore`의 개수와 삭제가 `where(userId == uid)`로 그 컬렉션을 포함한다. `GuestDataCounts.routeAutoRouteCache`를 같은 방식으로 센다. 다른 uid 문서와 `routePublications`·`trails` 문서는 지우지 않는다.
- `writeCache`는 `writeRouteAutoRouteCache`로 옮겨, transaction 안에서 `assertGuestLifecycleWritableInTx`를 먼저 읽고 그 다음 `set`한다. tombstone이면 `GuestLifecycleBlockedError`가 그대로 나가고 캐시 문서는 생기지 않는다. marker가 없으면 기존처럼 기록한다.

## 2. 실행

| 명령 | 종료 | 판정 |
|---|---|---|
| `cd C:\20.HDev\boxcycle\functions` 후 `npm test` | 0 | PASS 127. `tsc`가 앞에 있어 build와 같다. 이번 시험 4개 포함 |
| `cd C:\20.HDev\boxcycle\functions` 후 `npm run lint` | 0 | 출력 경고 없음 |

이번 4개:

- 정책 `routeAutoRouteCache`는 `delete`
- 본인 캐시만 삭제, 타인 캐시와 퍼블릭 경로는 삭제 목록에 없음
- `deleted` marker 뒤 재기록 거절, 캐시 문서 없음
- marker가 없으면 캐시 기록

## 3. 바꾼 파일

- `functions/src/accountDeletionCore.ts`
- `functions/src/accountDeletionCore.test.ts`
- `functions/src/purgeGuestUsersCore.ts`
- `functions/src/distanceAutoRouteHttp.ts`
- `functions/src/routeAutoRouteCacheDeletion.test.ts`
- `functions/package.json`의 `test` 스크립트에 위 시험만 추가
- 이 결과 파일

## 4. 한계

- `cliPurgeGuestUsers.ts`의 한 줄 표에는 `routeAutoRouteCache` 칸이 없다. 그 파일은 이번 소유 밖이다. JSON으로 쓰는 `GuestDataCounts`에는 개수가 들어간다.
- `listProfileUids`의 cache `userId` 후보는 지시대로 넣지 않았다. Supervisor가 GLM에 지시할 항목이다.
- 에뮬레이터로 실제 Firestore 삭제를 돌리지는 않았다.

## 5. Chief 확인

```
cd C:\20.HDev\boxcycle\functions
npm test
npm run lint
```
