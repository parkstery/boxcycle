# 00-facts.md — 리더보드 1단계 사실 조사 결과

2026-10-23 · task · 담당 **opencode Nemotron 3 Ultra** · 감리 Claude

---

## 1. 주행 기록(`rides` 컬렉션) 저장 필드 전부

**파일:** `apps/web/src/lib/ride/repo/firestoreRides.ts:35-79` (`RideDoc` 타입), `apps/web/src/lib/ride/rideEndPersistence.ts:71-102` (`PersistRideEndCoreInput`)

| 필드명 | 타입 | 설명 |
|--------|------|------|
| `userId` | `string` | 사용자 UID (필수) |
| `trailId` | `string \| null` | Trail ID (Trailhead 세션) |
| `roomId` | `string \| null` | **@deprecated** — 읽기 폴백만, 신규 쓰기 없음 |
| `profile` | `"cycling" \| "driving" \| "walking"` | 주행 프로필 |
| `startedAt` | `Timestamp \| null` | 시작 시각 (현재 `null` 고정, legacy) |
| `endedAt` | `Timestamp` | 종료 시각 (서버 타임스탬프) |
| `elapsedSec` | `number` | 경과 시간(초) |
| `distanceMeters` | `number` | 주행 거리(m) |
| `avgSpeedKmh` | `number` | 평균 속도(km/h) |
| `caloriesEstimate` | `number \| null` | 칼로리 추정치 |
| `caloriesMeta` | `CaloriesEstimateMeta \| null` | 칼로리 메타데이터 |
| `routeDistanceMeters` | `number` | 경로 전체 거리(m) |
| `routeDurationSec` | `number` | 경로 예상 소요 시간(초) |
| `source` | `"web"` | 소스 고정값 |
| `status` | `"completed"` | 상태 고정값 |
| `createdAt` | `unknown` | `serverTimestamp()` |
| `updatedAt` | `unknown` | `serverTimestamp()` |
| `routeId` | `string \| null` | 저장된 경로 ID (canonical) |
| `userRouteId` | `string \| null` | **@deprecated** — 읽기 폴백만 |
| `publicationId` | `string \| null` | 퍼블릭 경로 Publication ID |
| `routeEntry` | `RouteRideEntry \| null` | `"owner_library" \| "public_catalog"` |
| `routeName` | `string \| null` | 경로 이름 |
| `publicTitleSnap` | `string \| null` | 퍼블릭 제목 스냅샷 |
| `completionRatio` | `number` | 완주율 0~1 |
| `startPlaceLabel` | `string \| null` | 시작 지명 |
| `endPlaceLabel` | `string \| null` | 종료 지명 |
| `sessionStartLngLat` | `[number, number] \| null` | 세션 실제 시작 좌표 |
| `sessionEndLngLat` | `[number, number] \| null` | 세션 실제 종료 좌표 |
| `sessionStartRouteMeters` | `number` | 세션 시작 경로상 누적 거리(m) |
| `sessionEndRouteMeters` | `number` | 세션 종료 경로상 누적 거리(m) |
| `sessionStartProgressRatio` | `number` | 세션 시작 진행률 0~1 |
| `sessionEndProgressRatio` | `number` | 세션 종료 진행률 0~1 |
| `sessionStartPlaceLabel` | `string \| null` | 세션 시작 지명 |
| `sessionEndPlaceLabel` | `string \| null` | 세션 종료 지명 |
| `conquest` | `ConquestRidePayload \| null` | 정복 페이로드 (CF가 한도 적용 후 집계) |

### `ConquestRidePayload` 구조 (`apps/web/src/lib/conquest/conquestTiles.ts:58-70`)

```typescript
{
  v: number;                    // 페이로드 버전 (현재 2)
  z: number;                    // 줌 레벨 (CONQUEST_CELL_ZOOM = 20)
  cells: { id: string; m: number }[];  // 셀별 누적 이동 거리(m)
  path: number[];               // 평탄 배열 [lng0,lat0,lng1,lat1,...]
  pedalSec: number | null;      // 케이던스>0 누적 초, null = 센서 미연결(T0 no-sensor)
}
```

- **`conquestResult` 필드** (`conquestOnRideCreated.ts:463-471`): CF `conquestOnRideCreated`가 트리거되어 `rides/{rideId}` 문서에 백라이트로 기록
  - `newMeters`: 이번 주행으로 새로 개척한 도로 미터 수
  - `newCells`: 새로 개척한 셀 개수
  - `creditedMeters`: 인정된 거리(Trust Tier 예산 소진분)
  - `tier`: `"t0" | "t1"` (입력 방식 판정 결과)
  - `day`: KST 기준 일자 키
  - `newGeometry`: 신규 도로 지오메트리(평탄 배열 조각들)

---

## 2. 입력 방식(케이던스 센서 vs 수동) · Trust Tier 기록 여부

**기록됨.** `ConquestRidePayload.pedalSec` 필드에 **케이던스>0 누적 초**가 저장됨.

- `pedalSec === null` → **T0 (no-sensor)**: 손으로 고른 체험 속도 / 센서 미연결
- `pedalSec > 0` → **T1 (cadence)**: 케이던스 센서 연결됨

**서버 Trust Tier 판정 코드:** `functions/src/conquestOnRideCreated.ts:191-196, 354-366`

```typescript
const pedalSecRaw = conquest.pedalSec;
const pedalSec = typeof pedalSecRaw === "number" && Number.isFinite(pedalSecRaw)
  ? Math.max(0, Math.min(Math.round(pedalSecRaw), Math.round(elapsedSec)))
  : null;
const tier: "t0" | "t1" = pedalSec == null ? "t0" : "t1";
```

- T0: 일일 50km 한도, 속도 상한 50 km/h (출시 전 15 km/h로 복원 예정)
- T1: 페달링 시간에 비례한 예산(2h 전액, 2~4h 절반, 이후 0), 속도 상한 30 km/h
- 결과 `tier`는 `rides/{rideId}.conquestResult.tier`에 기록됨

---

## 3. 퍼블릭 경로(`routePublications`) 개척자 정보 저장 여부

**저장됨.** `apps/web/src/lib/route/repo/firestoreRoutePublications.ts:21-40` (`RoutePublicationDoc`)

| 필드명 | 타입 | 설명 |
|--------|------|------|
| `applicantUid` | `string` | **개척자(등록자) UID** |
| `publisherDeleted` | `boolean?` | 탈퇴로 익명화됨 (`applicantUid === ""` + 이 플래그) |

**다른 사람이 그 퍼블릭을 달렸을 때 퍼블릭을 아는 방법:**
- `rides` 문서에 `publicationId` 필드(`firestoreRides.ts:181`)가 저장됨
- 주행 종료 시 `resolvePublishedRouteLink` / `resolvePublishedRouteLinkByPublicationId`(`routePublicationResolve.ts`)로 역조회
- `routeEntry` 필드(`firestoreRides.ts:182`)로 `"owner_library" \| "public_catalog"` 구분

---

## 4. `users` 문서 필드 (닉네임·tier·지역)

**파일:** `apps/web/src/lib/identity/repo/firestoreUser.ts`

| 필드명 | 타입 | 설명 |
|--------|------|------|
| `nickname` | `string` | 설정된 닉네임 (UI 표시용 주 값) |
| `nicknameKey` | `string` | 소문자 정규화 키 (`nicknames/{key}` 예약용) |
| `displayName` | `string` | Auth `displayName` 동기화용 (닉네임으로 덮어씀) |
| `tier` | `UserTier` | `"anonymous" \| "registered_free" \| "registered_paid" \| "admin"` |
| `tierUpdatedAt` | `Timestamp` | 티어 변경 시각 |
| `isAnonymous` | `boolean` | 익명 여부 |
| `nicknameChangedAt` | `Timestamp?` | 닉네임 변경 시각 (쿨다운 30일 기준) |
| `updatedAt` | `Timestamp` | 문서 갱신 시각 |

**지역(나라 등) 정보:** **저장되지 않음**. 현재 스키마에 `country`, `region` 등 지역 필드 없음.

**쓰는 곳:**
- `ensureAnonymousUserTier` (게스트 최초 진입) — `firestoreUser.ts:149-167`
- `claimNicknameTransaction` (닉네임 설정·가입) — `firestoreUser.ts:220-270`
- `changeNicknameTransaction` (닉네임 변경) — `firestoreUser.ts:277-332`
- `syncUserProfileToFirestore` (로그인 시 merge) — `firestoreUser.ts:334-354`

---

## 5. 「지금 달리는 중」 실시간 위치/Trail 참여 데이터

### Firestore (Trail 단위)

| 컬렉션/서브컬렉션 | 경로 | 용도 |
|------------------|------|------|
| `trails/{trailId}/members/{uid}` | `firestoreTrail.ts:34-40` | Trail 멤버 presence (displayName, memberType, lastSeenAt) |
| `trails/{trailId}/livePublicationRides/{uid}` | `firestoreTrailLivePublicationRides.ts:47-61` | Trail 내 라이브 주행 진행률 (`progressRatio`, `distMeters`, `speedMps`, `ridePhase`, `publicationId`, `lastSeenAt`) |

### RTDB (Trail 단위, 고빈도 motion)

| 경로 | 구조 | 용도 |
|------|------|------|
| `trails/{trailId}/motion/{uid}` | `rtdbTrailMotion.ts:56-76` | 5Hz motion 전송 (`publicationId`, `distM`, `speedMps`, `ridePhase`, `tSrv`) |

### Publication Session (퍼블릭 경로 단위)

| 컬렉션/서브컬렉션 | 경로 | 용도 |
|------------------|------|------|
| `publicationSessions/{publicationId}/members/{uid}` | `firestorePublicationSessionPresence.ts:24-30` | 동일 Publication 달리는 중인 멤버 (`displayName`, `memberType`, `lastSeenAtMs`, `liveLngLat`) |

### 남의 Trail 에 합류하는 앱 함수

- `upsertTrailPresence(user, trailId)` — `firestoreTrail.ts:78-82`
- `mergeTrailLivePublicationRideSnapshot(user, trailId, input)` — `firestoreTrailLivePublicationRides.ts:123-153`
- `mergeTrailMotionSnapshot(user, trailId, input)` — `rtdbTrailMotion.ts:173-245` (RTDB motion)
- `upsertPublicationSessionMember(user, publicationId)` — `firestorePublicationSessionPresence.ts:59-73`

---

## 6. `firestore.indexes.json` 에 `rides` 관련 인덱스

**파일:** `firestore.indexes.json:3-27`

| # | 컬렉션 | 필드 (순서) | 쿼리 용도 |
|---|--------|-------------|-----------|
| 1 | `rides` | `userId ASC`, `endedAt DESC` | 사용자별 주행 내림차순 (통계·기간 집계, `loadRideSessionsForStatsFromFirestore`) |
| 2 | `rides` | `status ASC`, `endedAt ASC` | 상태별 종료 시각 오름차순 (관리·정리용) |
| 3 | `rides` | `publicationId ASC`, `status ASC`, `endedAt DESC` | 퍼블릭 경로별 완주 주행 내림차순 (리더보드·활동 집계용) |

---

## 7. 예약 실행 Cloud Function 작성 본보기 (`routeActivityScheduledReconcile`)

**파일:** `functions/src/routeActivityScheduledReconcile.ts:27-107`

```typescript
export const routeActivityScheduledReconcile = onSchedule(
  {
    schedule: "every 24 hours",      // cron 표현식
    region: REGION,                   // "asia-northeast3" (region.ts)
    timeZone: "Asia/Seoul",           // KST 기준
  },
  async () => {
    const db = getFirestore();
    // ... 집계 로직 ...
    await batch.commit();
  },
);
```

**핵심 패턴:**
- `firebase-functions/v2/scheduler`의 `onSchedule` 사용
- `schedule` 필드에 cron 표현식 (`"every 24 hours"`, `"0 3 * * *"` 등)
- `region`, `timeZone` 명시 (KST 기준 일일 집계 시 필수)
- `getFirestore()`로 Admin SDK 인스턴스 획득
- `batch`로 묶어 한 번에 커밋
- `console.info`로 실행 로그 남김

**관련 상수:** `functions/src/routeActivityConstants.ts` (`ROUTE_ACTIVITY_COLLECTION`), `functions/src/routeActivityAggregateCore.ts` (`WORLD_ACTIVITY_COLLECTION`)

---

## 8. 게스트 → Google 연결 시 UID 유지 여부

**유지됨.** `apps/web/src/hooks/useAppAuth.ts:428-456`

```typescript
if (current.isAnonymous) {
  const outcome = await runGuestGoogleLink({
    beginLease: () => postGuestLink(current, "begin"),
    openLinkPopup: () => linkWithPopup(current, provider).then(() => undefined),
    completeLease: async (token) => { await postGuestLink(current, "complete", token); },
    // ...
  });
  // 연결 성공 시 같은 User 객체(current)가 제자리에서 Google 계정으로 전환됨
  // uid 변경 없음 → Firestore 문서(users/{uid}, rides 등) 모두 그대로 연결됨
}
```

**플로우 요약:**
1. 익명 사용자(`current.isAnonymous === true`)가 Google 연결 팝업 열기
2. `linkWithPopup`으로 **동일 Auth UID에 Google 자격 증명 연결** (Firebase Auth `linkWithPopup` 표준 동작)
3. 서버 `postGuestLink("complete")`로 게스트 라이프사이클 정리 (tombstone 방지)
4. 연결 후 `onAuthStateChanged`가 **다시 울리지 않음** → `authLinkRev` 카운터로 강제 리프레시(`useAppAuth.ts:72, 456`)
5. UID 동일 → 기존 `users/{uid}`, `rides` 문서 모두 그대로 이어짐

---

## 요약: 리더보드 1단계 설계에 필요한 데이터 가용성

| 필요 데이터 | 가용성 | 비고 |
|------------|--------|------|
| 사용자별 총 주행 거리 | ✅ `rides`에서 `userId` + `distanceMeters` 집계 가능 (인덱스 1번) |
| 사용자별 개척 거리(`newMeters`) | ✅ `rides.conquestResult.newMeters`에 기록됨 (CF 백라이트) |
| 퍼블릭 경로별 주행자 수/랭킹 | ✅ `rides` 인덱스 3번(`publicationId` + `status` + `endedAt DESC`) |
| 개척자 닉네임 표시 | ✅ `routePublications.applicantUid` → `users/{uid}.nickname` 조인 |
| Trust Tier별 구분 랭킹 | ✅ `rides.conquestResult.tier` (`"t0" \| "t1"`) 기록됨 |
| 「지금 달리는 중」 실시간 | ✅ `trails/{trailId}/livePublicationRides` + RTDB `motion` + `publicationSessions` |
| 주간/일일 집계 스케줄러 | ✅ `routeActivityScheduledReconcile` 패턴 참조 |
| 게스트 데이터 연속성 | ✅ UID 유지되며 연결 후 동일 문서 접근 가능 |