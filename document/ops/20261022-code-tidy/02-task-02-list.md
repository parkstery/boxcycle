# 지시02 대상 목록 (자동 생성 — 손으로 고치지 말 것)

경로는 `apps/web/` 기준. **DELETE** = 선언 통째 삭제, **UNEXPORT** = `export` 키워드만 제거.

## src/lib/peerMotion/repo/rtdbTrailMotion.ts

- UNEXPORT `RTDB_TRAIL_MOTION_SEGMENT`

## src/lib/trail/repo/firestoreTrailLivePublicationRides.ts

- DELETE `TRAIL_LIVE_PUBLICATION_RIDE_WRITE_INTERVAL_MS`
- DELETE `fetchTrailIdsWithActiveLiveRides`

## src/lib/peerMotion/integrator.ts

- UNEXPORT `capSpeedMps`

## src/lib/sensor/bleCscCadence.ts

- UNEXPORT `FLAG_WHEEL_REV`
- UNEXPORT `FLAG_CRANK_REV`
- UNEXPORT `RPM_EMA_ALPHA`
- UNEXPORT `MIN_EVENT_DT_SEC`
- UNEXPORT `MAX_EVENT_DT_SEC`

## src/lib/sensor/cadenceRideInput.ts

- UNEXPORT `CADENCE_DEADZONE_RPM`
- UNEXPORT `CADENCE_TO_KMH`

## src/lib/account/accountDeletion.ts

- UNEXPORT `AccountDeletionError`

## src/lib/identity/authRestore.ts

- UNEXPORT `AUTH_EXPIRED_CODES`
- UNEXPORT `classifyAuthVerificationFailure`
- UNEXPORT `AuthVerifyKind` (type)
- UNEXPORT `AuthExposurePhase` (type)

## src/lib/identity/uidLocalCache.ts

- UNEXPORT `uidLocalCacheKeys`

## src/lib/identity/guestActivity.ts

- UNEXPORT `runGuestActivityTick`

## src/lib/identity/nickname.ts

- UNEXPORT `NICKNAME_REGEX`

## src/lib/identity/riderName.ts

- UNEXPORT `GUEST_NAME_PREFIX`
- UNEXPORT `UNNAMED_RIDER_PREFIX`
- UNEXPORT `riderShortCode`

## src/lib/storage/appSessionKeys.ts

- UNEXPORT `APP_USE_ENDED_KEY`
- UNEXPORT `GUEST_ENTRY_ACCEPTED_SESSION_KEY`
- UNEXPORT `START_SCREEN_NOTICE_SESSION_KEY`

## src/lib/identity/guestAccountReset.ts

- UNEXPORT `GuestResetResult` (type)

## src/lib/sensor/bleAutoReconnect.ts

- UNEXPORT `BLE_RECONNECT_BASE_MS`

## src/lib/sensor/cadenceSensorUi.ts

- UNEXPORT `cadenceSensorStatusLine`

## src/lib/activity/activityWorldTraceStyle.ts

- UNEXPORT `ACTIVITY_TRACE_LIVE_OPACITY`
- UNEXPORT `ACTIVITY_TRACE_COMPLETED_OPACITY`

## src/lib/peerMotion/commonDisplayClock.ts

- DELETE `getCommonDisplayDebugState`

## src/lib/peerMotion/selfDisplayBuffer.ts

- DELETE `selfDisplaySampleCount`
- DELETE `peekSelfDisplayNewest`

## src/lib/sensor/crankRpm.ts

- UNEXPORT `CRANK_RPM_MIN`
- UNEXPORT `SENSOR_PEDALING_RPM_THRESHOLD`

## src/lib/peerMotion/peerSyncChainLog.ts

- UNEXPORT `peerSyncChainLogMs`

## src/lib/peerMotion/motionWireQuantize.ts

- DELETE `MOTION_WIRE_SPEED_QUANTUM_MPS`

## src/lib/activity/repo/firestoreRouteActivity.ts

- UNEXPORT `isRouteActivityCacheFresh`

## src/lib/activity/activityWorldPollSignals.ts

- DELETE `resetActivityWorldPollSignals`

## src/lib/trail/trailDisplayNumberCache.ts

- DELETE `forgetTrailDisplayNumber`
- DELETE `clearTrailDisplayNumberCache`

## src/lib/trail/trailAccessPolicy.ts

- DELETE `isPublicTrail`

## src/lib/account/routeTokenSpendBridge.ts

- DELETE `getActiveRouteTokenUserId`
- DELETE `getEffectiveRouteTokenBalance`
- DELETE `__testRouteTokenSpendSession`
- DELETE `__testResetRouteTokenSpendSession`

## src/lib/firebase/functionsEmulatorUrl.ts

- UNEXPORT `resolveFunctionsHttpUrl`
- DELETE `functionsHttpOrigin`

## src/lib/account/repo/firestoreRouteTokenEconomy.ts

- UNEXPORT `normalizeGenerateCostBase`

## src/lib/storage/clientPersistencePolicy.ts

- UNEXPORT `PERSISTENCE_REQUIRES_AUTH_MSG`

## src/lib/peerMotion/repo/serverClockOffset.ts

- UNEXPORT `SERVER_CLOCK_DISCONTINUITY_MS`
- DELETE `getServerClockDebugState`

## src/lib/peerMotion/peerSyncDistanceSamplers.ts

- DELETE `peekSampleRouteLens`

## src/lib/peerMotion/routePublishFlight.ts

- DELETE `peekRouteSlotDiscardCount`
- DELETE `peekRouteEpochDiscardCount`
- DELETE `peekRoutePublishEpoch`
- DELETE `peekRouteDeferredCleanupCounts`

## src/lib/activity/activityWorldPollPolicy.ts

- DELETE `countCourseActivityLiveInBatch`

## src/lib/account/userTier.ts

- UNEXPORT `isRegisteredTier`

## src/lib/peerMotion/syncFromPresence.ts

- UNEXPORT `PeerNametagMember` (type)

## src/lib/peerMotion/spectatorRideExtrap.ts

- UNEXPORT `anchorDistOnRoute`
- UNEXPORT `spectatorSpeedMps`
- UNEXPORT `spectatorElapsedLocalMs`
- UNEXPORT `extrapSpectatorDistM`

## src/lib/peerMotion/types.ts

- DELETE `PeerMotionStepContext` (type)

## src/lib/peerMotion/PeerMotionRegistry.ts

- UNEXPORT `PeerStepDiag` (type)

## src/lib/peerMotion/trailLiveRidePort.ts

- UNEXPORT `TrailLiveRidePublishInput` (type)

