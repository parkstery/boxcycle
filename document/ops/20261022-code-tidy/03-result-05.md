# 03-result-05 — P3 반복 통합: 구독 허브·발행 비행·Trail 문서 파싱

2026-10-22 · 지시 [02-task-05.md](02-task-05.md) · 규칙 [02-task-p3-rules.md](02-task-p3-rules.md)

동작·export 이름·시험용 훅(`resetRtdbMotionSubscriptionHubForTests`, `resetTrailLivePublicationRidesSubscriptionHubForTests`, `debug…`, `debugInject…`) 불변. 시험·eslint·knip·baseline 파일은 건드리지 않았다. git 명령은 읽기 전용 외에 쓰지 않았다.

## 합친 쌍

### 1. 구독 허브 (rtdbMotionSubscriptionHub ↔ livePublicationRidesSubscriptionHub)

- 공통부: 새 파일 `apps/web/src/lib/trail/keyedSubscriptionHub.ts` (167줄) — `createTrailSubscriptionHub()` 팩토리. 슬롯·참조 카운트·리스너 집합·구독/해제·오류 팬아웃·계측 카운터·시험용 교체를 담당한다. 구독 함수, Trail ID 정리, 계측 호출(`noteUnderlyingDelivery`)은 만드는 쪽이 주입한다.
- 위치 근거: peerMotion 은 `trail` 은 import 할 수 있으나 `trail/repo` 는 못 한다(`mayImportRepoOf: []`). 그래서 `trail/repo` 가 아니라 `trail/` 에 두었고, 아무 저장소도 import 하지 않는다.
- `rtdbMotionSubscriptionHub.ts` 144 → 41, `livePublicationRidesSubscriptionHub.ts` 158 → 55. 합계 302 → 263 (공통 파일 포함, -39).
- 양쪽 export 함수는 팩토리 인스턴스에 위임하는 얇은 래퍼. 오류 주입 시 오류 객체를 만드는 방식(`new Error(message)` / `{code:"internal",…} as FirestoreError`)과 시점은 그대로.

### 2. 발행 비행 (motionPublishFlight ↔ routePublishFlight)

- 공통부: 새 파일 `apps/web/src/lib/peerMotion/publishFlightCore.ts` (153줄) — `createPublishFlightCore()` 팩토리. epoch 올리기·취소 집합·세션 키 맵·`isSessionLive`·`isEpochLive`·배수 대기(`awaitSettled`/`notifySettled`)·지연 정리(`requestCleanup`/`runDeferredCleanup`/`drainDeferredCleanups`)·`discardEpochJob` 로그. 파일마다 팩토리를 **따로** 호출하므로 motion/route 의 상태는 서로 섞이지 않는다.
- 각 파일에 남긴 것: 단일 슬롯, `inFlight`(motion) / `writing`(route) 판단, 쓰기 실행부(`runMotionJob`/`runRouteJob`), DEV 계기, `window.__rtw*` 기록, 개발용 지연·오류 주입. 「겹쳐 보낸 쓰기 뒤 삭제가 먼저 끝나면 노드가 되살아난다」 때문에 있는 `inFlight === 0 && !isEpochLive(job.epoch)` 분기와 주석, 그 순서(계기 갱신 → 지연 정리 → 다음 job)는 `runMotionJob` 의 `finally` 안에 그대로 있다. `requestMotionNodeCleanup` 의 「날아가는 쓰기 없을 때만 즉시 실행」도 `core.requestCleanup(req, inFlight === 0)` 로 같은 조건.
- motion 의 `lastDeleteDoneAt` 갱신은 `onDeferredCleanupDone` 훅으로 `run` 완료 직후·로그 전에 호출(원래 순서와 동일).
- `motionPublishFlight.ts` 352 → 280, `routePublishFlight.ts` 367 → 290, 공통 153. 합계 719 → 723 (+4). 줄 수는 늘었지만 복붙 블록 약 60줄은 한 곳으로 모였다.
- 파일 머리 주석의 「상대 파일은 수정하지 않는다」를 「공통부는 publishFlightCore」로 고쳤다(그 문구가 더는 사실이 아니라서).

### 3. Trail 문서 파싱 (firestoreOpenTrailListings ↔ firestoreTrailInstance)

- 공통부: 새 파일 `apps/web/src/lib/trail/repo/trailDocParse.ts` (54줄) — `timestampToMs`(두 파일에 똑같이 있던 것), `parseTrailCoreFields`(hostUid·displayNumber·publicationId·regionLabel·distanceKm), `parseTrailInstance`(trails 문서 → TrailInstance).
- `firestoreTrailInstance.ts`: 자체 `parseTrailInstance`·`timestampToMs`·`resolveTrailPublicationId` 제거, 공통 것을 import. 240 → 202.
- `firestoreOpenTrailListings.ts`: `loadTrailForListing` 은 `{...parseTrailInstance(snap.id, data), liveRiderCount: …}`, `listingToTrailInstance` 는 `{id, ...parseTrailCoreFields(data), visibility:"open", …}` 로 교체. `timestampToMs` 중복 제거. `resolveListingPublicationId` 는 `fetchOpenTrailListingPublicationId` 가 쓰므로 유지. 391 → 351.
- 합계 631 → 607 (-24). 두 파일 사이 import 방향(instance → listings)은 그대로라 순환 없음. 그래서 공통부를 listings 가 아니라 별도 파일에 뒀다.
- 객체 속성 삽입 순서가 달라질 수 있으나 값·키 집합은 같다(`liveRiderCount` 의 `undefined` 키도 유지).

## 합치지 않은 쌍

없음. 지시 3쌍 모두 합쳤다. 단 `firestoreOpenTrailListings` 의 `subscribeOpenTrailListings` 필터·정렬이나 `refreshOpenTrailListingFromTrailBody` 는 지시 범위의 겹침이 아니어서 손대지 않았다.

## dep-layers.json

- 추가: `"trail/keyedSubscriptionHub.ts"` (도메인 `trail`), `"trail/repo/trailDocParse.ts"` (도메인 `trail/repo`).
- `peerMotion/publishFlightCore.ts` 는 배정 목록에 따로 넣지 않았다 — `peerMotion` 도메인이 `"peerMotion/"` 접두 항목으로 폴더 전체를 가지므로 이미 포함된다(검사기 통과로 확인). 엣지는 건드리지 않았다.
- 같은 파일에 다른 agent 가 넣은 `conquest/conquestPathGeometry.ts` 줄 등은 내 변경이 아니다.

## 검사 결과 (apps/web)

- `npx tsc -b --noEmit` — 출력 없음(오류 0).
- `npx eslint <고친·새 9개 파일>` — 출력 없음(오류·경고 0).
- `node ../../scripts/check-dep-direction.mjs --check` — `=== 방향 위반 0건 ===` · `=== lib 순환 0쌍 ===` · `[check-dep-direction] baseline 이내 — 통과`
- `npm run test:quick` — `[test:quick] 합계 통과 1341 · 실패 0 · 56.7초 · 제외 3개 파일(에뮬레이터·하네스, --list 로 확인)` (peer 72, meters 58 포함 전부 통과)
- `npm run test:peer-spacing` — `PASS lateBundle … ok` · `elapsed=3195ms requiredFail=0` (중간에 `WebSocket server error: Port 24678 is already in use` 가 찍혔으나 기존 dev 서버 포트 충돌 경고이며 결과에는 영향 없음)
- `npm run test:rtdb-rules` — `ℹ tests 13 · pass 13 · fail 0`

## 변경 파일

- 새로 만듦: `apps/web/src/lib/trail/keyedSubscriptionHub.ts`, `apps/web/src/lib/peerMotion/publishFlightCore.ts`, `apps/web/src/lib/trail/repo/trailDocParse.ts`
- 고침: `apps/web/src/lib/peerMotion/repo/rtdbMotionSubscriptionHub.ts`, `apps/web/src/lib/trail/repo/livePublicationRidesSubscriptionHub.ts`, `apps/web/src/lib/peerMotion/motionPublishFlight.ts`, `apps/web/src/lib/peerMotion/routePublishFlight.ts`, `apps/web/src/lib/trail/repo/firestoreOpenTrailListings.ts`, `apps/web/src/lib/trail/repo/firestoreTrailInstance.ts`, `apps/web/dep-layers.json`(추가 2줄)
