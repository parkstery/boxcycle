# 지시01 대상 목록 (자동 생성 — 손으로 고치지 말 것)

경로는 `apps/web/` 기준. **DELETE** = 선언 통째 삭제, **UNEXPORT** = `export` 키워드만 제거.

## src/lib/riderPrototype/riderRig.geometry.mjs

- UNEXPORT `SEAT_TUBE_JUNCTION_Y_MM`
- UNEXPORT `HOOD_HALF_Z`
- UNEXPORT `HIP_GROUND`
- UNEXPORT `HIP_TO_ISCHIAL_M`
- UNEXPORT `ISCHIAL_Y_M`
- UNEXPORT `SADDLE_HEIGHT_DERIVED_MM`
- DELETE `SEATPOST_EXPOSED_MM`
- UNEXPORT `TORSO_ANGLE_DEG`
- DELETE `RIDER_RIG`

## src/lib/rider/riderGlbPedalPose.pose.mjs

- DELETE `_poles`
- UNEXPORT `sampleRiderMetrics`

## src/lib/geo/geo.ts

- DELETE `parseLngLat`
- UNEXPORT `buildVertexCumulativeMeters`
- DELETE `densifyLineStringByIntervalM`
- DELETE `distanceMetersToVertexIndexAtOrBefore`
- DELETE `driveHeadingAtDistanceMeters`
- DELETE `pathPointAheadAlongLineString`

## src/lib/conquest/conquestTiles.ts

- DELETE `CONQUEST_CELL_APPROX_METERS`

## src/lib/camera/rideCameraFraming.ts

- UNEXPORT `RIDE_FIT_PADDING_MAX_VIEWPORT_RATIO`
- UNEXPORT `rideRiderAnchorBiasMAtZoom`
- UNEXPORT `projectLngLatAltitude`

## src/lib/geo/entryLocation.ts

- UNEXPORT `isUsableLngLat`

## src/lib/rider/riderTurn.ts

- UNEXPORT `RIDER_LEAN_MAX_DEG`
- UNEXPORT `RIDER_LEAN_TAU_S`
- UNEXPORT `wrapHeadingDeg`
- UNEXPORT `approachHeadingDeg`
- UNEXPORT `physicalLeanDeg`

## src/lib/camera/camera1Mode.ts

- UNEXPORT `isCamera1Mode`
- DELETE `Camera1LegacyMode` (type)

## src/lib/riderPrototype/iso2dMarker.ts

- UNEXPORT `resolveIso2dSprite`

## src/lib/riderPrototype/riderSway.ts

- UNEXPORT `RIDER_SWAY_REF_KMH`
- UNEXPORT `RIDER_SWAY_MIN_FACTOR`
- UNEXPORT `RIDER_SWAY_MAX_FACTOR`
- UNEXPORT `RIDER_SWAY_SPEED_TAU_S`

## src/lib/camera/quickCameraProductTune.ts

- UNEXPORT `QUICK_CAMERA_PRODUCT_TUNE`

## src/lib/riderPrototype/config.ts

- DELETE `PRESERVED_RIDER_CANDIDATE_ID`
- UNEXPORT `RIDER_GIANT_SCALE_FACTOR`

## src/lib/camera/cameraRenderPhase.ts

- UNEXPORT `startCameraRenderPhaseProbe`
- UNEXPORT `stopCameraRenderPhaseProbe`
- UNEXPORT `snapshotCameraRenderPhaseProbe`
- UNEXPORT `noteCameraRenderFromMap`
- UNEXPORT `CameraWriteSample` (type)
- UNEXPORT `CameraRenderSample` (type)
- UNEXPORT `CameraRenderPhaseSnapshot` (type)

## src/lib/rider/riderGlbPedalPose.ts

- UNEXPORT `GlbNodeRotationDeg` (type)

## src/lib/riderPrototype/glbModelLayer.ts

- UNEXPORT `syncRiderGlbPedalFeatureState`

## src/lib/camera/cameraFollowTrace.ts

- UNEXPORT `startCameraFollowTrace`
- UNEXPORT `stopCameraFollowTrace`
- UNEXPORT `snapshotCameraFollowTrace`
- DELETE `assertCameraTraceP0`
- UNEXPORT `CameraTraceFrame` (type)
- UNEXPORT `CameraTraceSnapshot` (type)

## src/lib/conquest/repo/firestoreConquest.ts

- DELETE `loadConquestCellIds`

## src/lib/riderPrototype/riderLightLab.ts

- UNEXPORT `sanitizeRiderLightLabState`

## src/lib/coach/coachTypes.ts

- DELETE `CachedCoachingByDistance` (type)

