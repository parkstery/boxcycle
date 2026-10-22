# 결과02 — P1 죽은 코드(지시02 목록 처리)

2026-10-22 · task · 담당 **opencode MiniMax M3.1 Flash** · 감리 Claude
대상 목록: [02-task-02-list.md](02-task-02-list.md) · 규칙: [02-task-rules.md](02-task-rules.md)

## 1. 요약

| 항목 | 값 |
|---|---|
| 목록 항목 | **67건** (DELETE 23 · UNEXPORT 44) · 39개 파일 |
| 처리 완료 | **67건 전부** |
| DELETE 실행 | **24건** (목록 23 + `cadenceSensorStatusLine` 1건 UNEXPORT→DELETE 전환) |
| UNEXPORT 실행 | **43건** (목록 44 − `cadenceSensorStatusLine` 1건) |
| 건너뜀 | **0건** |
| 고친 파일 | **39개** (`apps/web/src/lib/…`) |
| diff | 39 files changed, **43 insertions(+), 195 deletions(-)** |

동작 변경 없음 — 선언의 `export` 제거와 죽은 선언 삭제만 했다. 로직·값·이름은 건드리지 않았다.

## 2. 고친 파일 목록 (39)

```
apps/web/src/lib/peerMotion/repo/rtdbTrailMotion.ts          UNEXPORT 1
apps/web/src/lib/trail/repo/firestoreTrailLivePublicationRides.ts  DELETE 2
apps/web/src/lib/peerMotion/integrator.ts                   UNEXPORT 1
apps/web/src/lib/sensor/bleCscCadence.ts                    UNEXPORT 5
apps/web/src/lib/sensor/cadenceRideInput.ts                 UNEXPORT 2
apps/web/src/lib/account/accountDeletion.ts                 UNEXPORT 1
apps/web/src/lib/identity/authRestore.ts                    UNEXPORT 4
apps/web/src/lib/identity/uidLocalCache.ts                  UNEXPORT 1
apps/web/src/lib/identity/guestActivity.ts                  UNEXPORT 1
apps/web/src/lib/identity/nickname.ts                       UNEXPORT 1
apps/web/src/lib/identity/riderName.ts                      UNEXPORT 3
apps/web/src/lib/storage/appSessionKeys.ts                  UNEXPORT 3
apps/web/src/lib/identity/guestAccountReset.ts              UNEXPORT 1
apps/web/src/lib/sensor/bleAutoReconnect.ts                 UNEXPORT 1
apps/web/src/lib/sensor/cadenceSensorUi.ts                  UNEXPORT→DELETE 1  ※A
apps/web/src/lib/activity/activityWorldTraceStyle.ts        UNEXPORT 2
apps/web/src/lib/peerMotion/commonDisplayClock.ts           DELETE 1
apps/web/src/lib/peerMotion/selfDisplayBuffer.ts            DELETE 2
apps/web/src/lib/sensor/crankRpm.ts                         UNEXPORT 2
apps/web/src/lib/peerMotion/peerSyncChainLog.ts             UNEXPORT 1
apps/web/src/lib/peerMotion/motionWireQuantize.ts           DELETE 1
apps/web/src/lib/activity/repo/firestoreRouteActivity.ts     UNEXPORT 1
apps/web/src/lib/activity/activityWorldPollSignals.ts       DELETE 1
apps/web/src/lib/trail/trailDisplayNumberCache.ts           DELETE 2
apps/web/src/lib/trail/trailAccessPolicy.ts                 DELETE 1
apps/web/src/lib/account/routeTokenSpendBridge.ts           DELETE 4
apps/web/src/lib/firebase/functionsEmulatorUrl.ts           UNEXPORT 1 · DELETE 1
apps/web/src/lib/account/repo/firestoreRouteTokenEconomy.ts UNEXPORT 1
apps/web/src/lib/storage/clientPersistencePolicy.ts         UNEXPORT 1
apps/web/src/lib/peerMotion/repo/serverClockOffset.ts       UNEXPORT 1 · DELETE 1
apps/web/src/lib/peerMotion/peerSyncDistanceSamplers.ts     DELETE 1  ※B
apps/web/src/lib/peerMotion/routePublishFlight.ts           DELETE 4
apps/web/src/lib/activity/activityWorldPollPolicy.ts        DELETE 1
apps/web/src/lib/account/userTier.ts                        UNEXPORT 1
apps/web/src/lib/peerMotion/syncFromPresence.ts             UNEXPORT 1 (type)
apps/web/src/lib/peerMotion/spectatorRideExtrap.ts          UNEXPORT 4
apps/web/src/lib/peerMotion/types.ts                        DELETE 1 (type)
apps/web/src/lib/peerMotion/PeerMotionRegistry.ts           UNEXPORT 1 (type)
apps/web/src/lib/peerMotion/trailLiveRidePort.ts            UNEXPORT 1 (type)
```

배럴(`apps/web/src/lib/peerMotion/index.ts`)은 대상 이름을 재수출하지 않아 손대지 않았다.

## 3. 목록과 실제 처리(감리 확인용)

- **UNEXPORT 43건** — 선언 앞의 `export` 키워드만 지웠다. 본문·이름·값은 그대로.
  예: `export const CRANK_RPM_MIN = 14;` → `const CRANK_RPM_MIN = 14;`
- **DELETE 24건** — 선언과 붙어 있는 JSDoc 를 통째로 지웠다.

### ※A `cadenceSensorStatusLine` (UNEXPORT → DELETE 로 전환, 1건)

- 목록은 UNEXPORT 였으나, 이 함수는 **같은 파일 안에서도 쓰이지 않는다**(정의부 1곳과 `cadenceSensorShortStatus` 의 JSDoc 언급 1곳뿐). 목록 자동분류는 JSDoc 언급을 「내부 사용」으로 센 것으로 보인다.
- UNEXPORT 만 하면 `export` 가 빠진 채 쓰이지 않는 private 함수가 되어 `noUnusedLocals`(tsconfig.app.json)와 `@typescript-eslint/no-unused-vars`(eslint.config.js)가 **같은 파일에서** 오류를 낸다.
- 규칙 「위 작업 때문에 **같은 파일 안에서** 새로 안 쓰이게 된 import·private 함수·상수는 지운다」에 따라 **선언 전체를 삭제**했다. 같은 파일 밖 참조가 없다는 것은 저장소 전체(`apps/`·`scripts/`·`e2e/`) 검색으로 확인했다.
- 남은 참조: `cadenceSensorShortStatus` 의 JSDoc 안에 「긴 안내(`cadenceSensorStatusLine`)는 줄이 길어져…」라는 **과거 설명**이 남아 있다. 주석 이름 수정은 목록 밖이라 건드리지 않았다(동작 영향 없음).

### ※B `peerSyncDistanceSamplers.ts` 의 파생 죽은 변수

- `peekSampleRouteLens` 삭제 → 같은 파일의 모듈 변수 `sampleRouteLens` 와 대입문 `sampleRouteLens = opts.sampleRouteLens ?? null;` 이 「쓰기만 하고 읽히지 않음」(TS6133)이 되어 함께 삭제했다.
- `registerPeerSyncDistanceSamplers` 의 **옵션 타입 필드 `sampleRouteLens?` 는 남겼다.** 호출부(`apps/web/src/hooks/useVirtualRideSession.ts` 283·296행)가 이 필드를 넘기고 있어 지우면 초과 속성 검사(TS2345)로 **다른 파일**이 깨진다. 규칙상 다른 파일은 고치지 않는다. 값이 읽히지 않게 된 것뿐 동작은 같다(원래도 `peekSampleRouteLens` 를 부르는 곳이 없어 이미 읽히지 않았다).

## 4. 건너뜀

**없음.** 67건 전부 처리했다.

- 외부 참조 때문에 되돌린 항목: 0건. 67개 이름 모두 `apps/`·`scripts/` 저장소 전체에서 **자기 파일 안에서만** 참조됨을 확인했다(배럴 `index.ts` 포함).
- 시험 파일(`*.test.*`·`e2e/`)·`dep-layers*.json`·`eslint.config.js`·`knip.config.mjs`·baseline 파일: **수정하지 않음**.
- git commit·push·stash·checkout·restore·clean·worktree: **사용하지 않음**(커밋은 감리 몫).
- 다른 지시(01·03·04)의 대상 파일: **수정하지 않음**(39개 파일 전부 내가 목록에서 고친 것만).
- 새 디버그 코드·주소 스위치·스크립트: **없음** → `apps/web/dev-tools.json` 등록 대상도 없음.

## 5. 검증 (apps/web 폴더)

### 5-1. 타입 검사

```
> cd C:\20.HDev\boxcycle\apps\web
> npx tsc -b --noEmit
(출력 없음)
TSC_EXIT=0
```

오류 0. (작업 시작 시점에는 동시 진행 중인 지시01 에서 `src/lib/geo/geo.ts(248,10): error TS6133: 'buildVertexCumulativeMeters' …` 가 떠 있었으나, 그 에이전트가 해당 항목을 정리하며 해소되었다. **내가 고친 파일과 무관**한 오류였다.)

### 5-2. lint (고친 39개 파일)

```
> cd C:\20.HDev\boxcycle\apps\web
> npx eslint src/lib/peerMotion/repo/rtdbTrailMotion.ts … (39개 파일)
(출력 없음 — 오류 0 · 경고 0)
ESLINT_EXIT=0
```

### 5-3. 단위 시험 (감리 검증용 추가 확인)

```
> cd C:\20.HDev\boxcycle\apps\web
> npm run test:quick
> node scripts/test-quick.mjs
✓ ride   주행·계정·센서    통과  843  실패   0  (83개 파일, 36.1초)
✓ route  경로·토큰       통과  176  실패   0  (16개 파일, 2.1초)
✓ map    지도·화면 읽기    통과  151  실패   0  (16개 파일, 1.8초)
✓ peer   동행 동기화      통과   72  실패   0  (7개 파일, 10.0초)
✓ meters 트래픽 계측      통과   58  실패   0  (5개 파일, 1.0초)
✓ tools  시험 도구 자체    통과   41  실패   0  (7개 파일, 10.2초)

[test:quick] 합계 통과 1341 · 실패 0 · 61.2초 · 제외 3개 파일(에뮬레이터·하네스, --list 로 확인)
EXIT=0
```

#### 5-3-1. 중간 관측: 동시 작업 때문에 잠깐 4건 실패했다가 회복됨 (참고)

한 차례 실행에서 `합계 통과 1242 · 실패 4` 로 떴다. 원인은 **내가 고친 파일이 아니고**, 동시 진행 중인 **지시04** 에이전트의 `src/lib/map/mapGlobeView.ts` 편집이 **저장 직후(import 수정 전)** 순간에 잡힌 것 때문이었다.

```
src/lib/map/mapGlobeView.ts:89
const RIDER_BASE_DISPLAY_HEIGHT_M = RIDER_HEAD_C_Y_M * RIDER_GLB_MODEL_BASE_SCALE;
                                                       ^
ReferenceError: RIDER_GLB_MODEL_BASE_SCALE is not defined
```

- 실패 4건: `scripts/conquest/recent-road-display-dom.test.mjs` · `scripts/identity/entry-location-dom.test.mjs` (브라우저 런타임 크래시로 타임아웃) · `scripts/ride-camera-framing/camera1-mode-contract.test.ts` · `scripts/ride-camera-framing/ride-camera-framing-contract.test.ts`.
- `src/lib/map/mapGlobeView.ts` 는 **지시04 목록 파일**(`02-task-04-list.md` 5행)에 있는 파일이다. 그 에이전트가 import 를 고친 뒤에는 `tsc`·`test:quick` 모두 다시 통과했다(위 5-1·5-3 최종 기록).
- **내 39개 파일과 무관**함은 실패 파일·원인 파일이 모두 내 목록 밖이고, 실패가 사라진 시점이 다른 에이전트 편집 종료 시점과 일치하는 것으로 확인된다.

### 5-4. 목록 반영 확인 (자기 점검 스크립트)

67개 이름에 대해 (DELETE) 선언이 남아 있는지 · (UNEXPORT) `export` 가 남아 있는지를 목록 파일 기준으로 재검사:

```
OK: all 67 items applied, no leftover export / no leftover declaration
```

## 6. 변경 요약 (diffstat)

```
39 files changed, 43 insertions(+), 195 deletions(-)
```

내용은 `export` 키워드 제거(`+1/-1` 형태)와 죽은 선언 블록 삭제뿐이다. 로직·값·문자열·이름 변경은 없다.

## 7. 감리 확인 요청

1. `git diff` 로 39개 파일을 눈으로 확인해 주십시오(특히 §3 ※A·※B 두 건).
2. ※A(`cadenceSensorStatusLine` DELETE 전환)는 목록 분류가 UNEXPORT 였던 것과 실제 처리가 다르므로 **승인 여부**를 확인해 주십시오. 되돌리려면 같은 파일에 `export function cadenceSensorStatusLine(…)` 를 되돌리면 되지만, 그러면 그 파일의 `tsc`/`eslint` 가 다시 오류를 냅니다(tsconfig `noUnusedLocals` + eslint `no-unused-vars`). 되돌리려면 「목록에 없는 이름 수정」 금지에 해당하므로 감리 판단이 필요합니다.
3. ※B 의 `registerPeerSyncDistanceSamplers` 옵션 `sampleRouteLens?` 필드 잔존은 **다른 지시에서 `useVirtualRideSession.ts` 를 함께 손보는 경우** 지울 수 있습니다(그 지시가 그 파일을 소유하면 그쪽에서 정리).
4. `PeerMotionStepContext`(types.ts)·`countCourseActivityLiveInBatch`(activityWorldPollPolicy.ts) 삭제는 각각 「같은 것 두 이름」/폐기 별칭 후보에도 걸린다. 감리 몫(README 「감리 몫」)과 겹치므로 **여기서는 목록에 적힌 것만** 지웠다.
