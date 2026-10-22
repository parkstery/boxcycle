# 지시03 대상 목록 (자동 생성 — 손으로 고치지 말 것)

경로는 `apps/web/` 기준. **DELETE** = 선언 통째 삭제, **UNEXPORT** = `export` 키워드만 제거.

## src/lib/ride/calorieProfileSync.ts

- UNEXPORT `sameCalorieProfile`
- UNEXPORT `isEmptyCalorieProfile`

## src/lib/ride/pacer/pacerMotion.ts

- UNEXPORT `PACER_MIN_TARGET_ABS_M`
- UNEXPORT `PACER_RETARGET_SEC`
- UNEXPORT `PACER_CROSS_PROB`
- UNEXPORT `PACER_GAIN_PER_SEC`
- UNEXPORT `PACER_BRAKE_MARGIN`
- UNEXPORT `PACER_REL_V_FLOOR_MPS`
- UNEXPORT `PACER_REL_V_SPEED_FACTOR`
- UNEXPORT `PACER_STOP_SELF_MPS`
- UNEXPORT `PACER_PHASE_HOLD_KMH`
- DELETE `PACER_HEADING_HALF_SPAN_M`
- UNEXPORT `PACER_LANE_M`
- UNEXPORT `PACER_INITIAL_GAP_M`
- UNEXPORT `PACER_ENTRY_GAP_M`
- UNEXPORT `pacerMaxRelVMps`
- UNEXPORT `pacerApproachSpeedMps`

## src/lib/route/fetchRouteElevations.ts

- UNEXPORT `sampleRouteCoordinatesByArcLength`
- DELETE `sampleRouteCoordinatesForElevation`

## src/lib/route/distanceAutoRouteEta.ts

- UNEXPORT `DISTANCE_AUTO_ROUTE_MIN_PLAUSIBLE_KMH`
- UNEXPORT `DISTANCE_AUTO_ROUTE_MAX_PLAUSIBLE_KMH`

## src/lib/ride/companionHudCount.ts

- UNEXPORT `stripCompanionLiveCountClause`

## src/lib/ride/nextRideTarget.ts

- UNEXPORT `sortValidRidesNewestFirst`

## src/lib/route/repo/firestoreSavedRoutes.ts

- UNEXPORT `SAVED_ROUTE_NAME_MIN`
- UNEXPORT `normalizeSavedRouteName`

## src/lib/ride/rideResumeSlotPolicy.ts

- DELETE `RIDE_RESUME_SLOT_VERSION`
- DELETE `RESUME_SLOT_BLOCKED_MSG`

## src/lib/ride/caloriesEstimate.ts

- UNEXPORT `CALORIES_METHOD_VERSION`

## src/lib/ride/rideStatsAggregate.ts

- UNEXPORT `filterValidRideSessions`
- UNEXPORT `getLocalDayRange`

## src/lib/ride/repo/calorieProfileLocal.ts

- UNEXPORT `readCalorieProfile`

## src/lib/ride/rideStory.ts

- UNEXPORT `RIDE_STORY_COMEBACK_DAYS`
- UNEXPORT `RIDE_STORY_TYPICAL_MIN_SAMPLES`
- UNEXPORT `RIDE_MILESTONE_LAST_KM_MIN_ROUTE_METERS`

## src/lib/ride/rideSessionPreview.ts

- UNEXPORT `SESSION_PREVIEW_PADDING`

## src/lib/ride/repo/firestorePublicationPresence.ts

- UNEXPORT `parseRepresentativePoint`
- UNEXPORT `resolvePublicationRepresentativePointClient`
- UNEXPORT `enrichPublicationPresencePoints`
- UNEXPORT `PublicationPresenceStatus` (type)

## src/lib/route/repo/firestoreCourses.ts

- DELETE `getBasicStartCourseStatic`
- DELETE `isGeometryBasicStartHub`
- UNEXPORT `ensureBasicSharedHubPresenceFlagsMerged`
- DELETE `ensureCoursePresenceFlagsMerged`
- UNEXPORT `CourseCategory` (type)
- UNEXPORT `CourseProfile` (type)

## src/lib/ride/repo/firestorePublicationSessionPresence.ts

- UNEXPORT `PUBLICATION_SESSIONS_COLLECTION`
- UNEXPORT `PUBLICATION_SESSION_MEMBERS_SUBCOLLECTION`
- DELETE `PUBLICATION_SESSION_LIVE_SHARE_INTERVAL_MS`
- DELETE `mergePublicationSessionMemberLiveLocation`

## src/lib/ride/repo/firestoreGlobalLivePresence.ts

- UNEXPORT `GLOBAL_LIVE_PRESENCE_COLLECTION`
- UNEXPORT `isGlobalLivePresenceFresh`

## src/lib/ride/rideDistanceFormat.ts

- UNEXPORT `RIDE_DISTANCE_KM_FRACTION_DIGITS`

## src/lib/route/repo/savedRoutesLocal.ts

- DELETE `saveRouteToLocal`
- UNEXPORT `purgeExpiredLocalRoutes`

## src/lib/ride/liveRideHudSignal.ts

- DELETE `publishHasOtherLiveRiders`
- DELETE `subscribeOtherLiveRiderCount`
- DELETE `getHasOtherLiveRiders`

## src/lib/route/repo/publicRouteRequests.ts

- UNEXPORT `ROUTE_REVIEWERS_DOC_PATH`
- UNEXPORT `validateExperienceTags`
- DELETE `loadPendingPublicRouteRequests`
- UNEXPORT `withdrawPublicRouteRequest`
- UNEXPORT `approvePublicRouteRequest`
- UNEXPORT `rejectPublicRouteRequest`
- UNEXPORT `PublicRouteRequestStatus` (type)

## src/lib/ride/repo/calorieProfileCloud.ts

- UNEXPORT `USER_PRIVATE_COLLECTION`

## src/lib/route/repo/firestoreRoutePublications.ts

- DELETE `findPublishedRoutePublicationByCourseId`
- UNEXPORT `RoutePublicationStatus` (type)
- UNEXPORT `RoutePublicationDoc` (type)

## src/lib/route/routeLimits.ts

- UNEXPORT `MAX_ROUTE_DISTANCE_METERS`

## src/lib/ride/rideSpeech.ts

- DELETE `getRideTtsEnabled`

## src/lib/route/readyRide.ts

- DELETE `formatReadyRideDistanceLabel`

## src/lib/ride/rideSpeedRamp.ts

- UNEXPORT `RIDE_SPEED_ACCEL_KMH_PER_SEC`
- UNEXPORT `RIDE_SPEED_DECEL_KMH_PER_SEC`

## src/lib/ride/rideDocFields.ts

- DELETE `resolveRideTrailId`
- DELETE `resolveRidePublicationId`

## src/lib/ride/repo/firestoreWorldPresence.ts

- UNEXPORT `WORLD_PRESENCE_DEFAULT_REGIONS`

## src/lib/ride/repo/firestoreRideResumeSlot.ts

- UNEXPORT `SlotTxOperation` (type)

## src/lib/ride/rideConquestResult.ts

- UNEXPORT `ConquestResultStatus` (type)

