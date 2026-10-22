# 지시04 대상 목록 (자동 생성 — 손으로 고치지 말 것)

경로는 `apps/web/` 기준. **DELETE** = 선언 통째 삭제, **UNEXPORT** = `export` 키워드만 제거.

## src/lib/map/mapGlobeView.ts

- UNEXPORT `MAP_GLOBE_FIT_MAX_ZOOM`
- DELETE `RIDE_FOLLOW_CAMERA_ZOOM`
- DELETE `applyMapGlobeView`

## src/lib/map/mapPickRouteDock.ts

- UNEXPORT `panelFocusOverlapArea`
- UNEXPORT `ROUTE_PICK_DOCK_HUD_SLOT_SELECTORS`
- DELETE `rectsOverlapAny`

## src/features/map-overlays/routeMinimapProjection.ts

- UNEXPORT `ROUTE_MINIMAP_MAX_COORDS`
- UNEXPORT `ROUTE_MINIMAP_MAX_ZOOM`
- UNEXPORT `mercatorXY`
- UNEXPORT `ROUTE_MINIMAP_STATIC_STYLE`
- DELETE `distancePointToPolylinePx`
- UNEXPORT `MinimapPoint` (type)

## src/lib/map/mapBootCenter.ts

- UNEXPORT `ENTRY_LOCATION_FLIGHT_MAX_MS`
- UNEXPORT `ENTRY_LOCATION_FLIGHT_MIN_MS`
- UNEXPORT `MapBootCenterSource` (type)

## src/lib/map/layerOrder.ts

- UNEXPORT `conquestRankOffset`

## src/lib/map/mapCut.ts

- DELETE `isMapCutActive`
- UNEXPORT `MAP_CUT_BUILDING_LAYER_ID`

## src/components/map/mapRoutePickGesture.ts

- UNEXPORT `MAP_ROUTE_PICK_SHORT_TAP_MAX_MS`

## src/lib/map/rideLabels.ts

- UNEXPORT `RIDE_LABELS_HIDE_ZOOM`
- UNEXPORT `RIDE_LABELS_SHOW_ZOOM`
- UNEXPORT `RIDE_LABELS_QUERY_KEY`
- UNEXPORT `RIDE_LABEL_MODE_QUERY_KEY`
- UNEXPORT `RIDE_LABEL_DIST_QUERY_KEY`
- UNEXPORT `RIDE_LABEL_MODE_DEFAULT`
- UNEXPORT `RIDE_LABEL_DIST_DEFAULT`
- UNEXPORT `RIDE_LABEL_DIST_MIN`
- UNEXPORT `RIDE_LABEL_DIST_MAX`
- UNEXPORT `isRideLabelsForceShown`
- DELETE `resetRideLabelsControllerForTests`

## src/lib/map/rtwMapConfig.ts

- UNEXPORT `RTW_POI_LAYER_KEYWORDS`
- UNEXPORT `RTW_BUILDING_LAYER_KEYWORDS`
- UNEXPORT `RTW_ROAD_PAINT`
- DELETE `RTW_TRACE_COLOR`
- UNEXPORT `RTW_TRACE_OWNED_COLOR`
- UNEXPORT `RTW_TRACE_LIVE_COLOR`
- UNEXPORT `MAP_STYLE_OUTDOORS`
- UNEXPORT `RIDER_MAP_MAX_DPR_QUERY_KEY`
- UNEXPORT `RIDER_MAP_MAX_DPR_MIN`
- UNEXPORT `RIDER_MAP_MAX_DPR_MAX`
- DELETE `readRiderMapAppliedPixelRatio`

## src/hooks/useRideUiStage.ts

- DELETE `isRideStageLocked`

## src/hooks/usePacerPreference.ts

- UNEXPORT `getPacerEnabledSnapshot`
- UNEXPORT `subscribePacerEnabled`
- UNEXPORT `writePacerEnabled`

## src/components/map/routeConquestLayers.ts

- UNEXPORT `CONQUEST_RECENT_NEW_COLOR`

## src/lib/map/disableMapboxTelemetry.ts

- UNEXPORT `ensureMapboxTelemetryDisabled`

## src/services/coverageOverlaySync.ts

- UNEXPORT `BOXCYCLE_ROUTE_LAYER_ID`
- UNEXPORT `restackCoverageBelowRouteLine`

## src/components/map/MapCameraAltitudeControl.ts

- UNEXPORT `formatCameraAltitudeLabel`

## src/components/ride/RideHistoryPanel.tsx

- UNEXPORT `RideHistoryPanelProps` (type)

## src/components/ui/usePanelHeaderCloseDrag.ts

- UNEXPORT `EDGE_DRAG_THRESHOLD_PX`
- UNEXPORT `EDGE_DRAG_MIN_INTENT_PX`
- UNEXPORT `EDGE_DRAG_VELOCITY_PX_MS`
- DELETE `pointerTravelPx`

## src/services/mapboxForwardGeocode.ts

- DELETE `fetchMapboxPlaceFeatureCenter`

## src/components/ui/edgePanelDocumentGesture.ts

- UNEXPORT `EDGE_GESTURE_BAND_PX`
- UNEXPORT `tryStartEdgeGesture`

## src/services/roadElevationCoach.ts

- UNEXPORT `ROAD_SMOOTH_WINDOW_M`
- UNEXPORT `ROAD_SMOOTH_WINDOW_MAX_M`
- UNEXPORT `ROAD_SLOPE_LOW_PASS_ALPHA`
- UNEXPORT `ROAD_SLOPE_DELTA_LIMIT_PER_50M`
- UNEXPORT `ROAD_SLOPE_DELTA_LIMIT_PER_M`
- UNEXPORT `ROAD_SHORT_WINDOW_HALF_M`
- UNEXPORT `BRIDGE_PATTERN_DISTANCE_M`
- UNEXPORT `BRIDGE_PATTERN_ENDPOINT_DIFF_M`
- UNEXPORT `BRIDGE_PATTERN_MID_DIP_M`
- UNEXPORT `BRIDGE_PATTERN_VARIATION_GUARD_RATIO`
- UNEXPORT `BRIDGE_PATTERN_ATTENUATION`
- UNEXPORT `LOCAL_BRIDGE_MIN_WIDTH_M`
- UNEXPORT `LOCAL_BRIDGE_MAX_WIDTH_M`
- UNEXPORT `LOCAL_BRIDGE_MAX_ENDPOINT_GRADE`

## src/services/routeElevationStore.ts

- UNEXPORT `isStorableElevationValues`

## src/services/osrmRoadCoverage.ts

- UNEXPORT `ROUTABLE_ROAD_TILESET_URL`
- UNEXPORT `ROUTABLE_ROAD_SOURCE_ID`

## src/features/map-overlays/worldPublicationMapDots.ts

- DELETE `buildBasicHubWorldPulseDots`
- UNEXPORT `buildLocalRidePublicationPulseDot`
- UNEXPORT `ensureWorldActivityMinimumDots`

## src/hooks/useActivityWorldAdaptivePoll.ts

- DELETE `triggerActivityWorldPollImmediate`

## src/services/aiCoach.ts

- UNEXPORT `getAdvancedCoaching`

## src/services/phraseManifest.ts

- UNEXPORT `FALLBACK_TIPS`
- UNEXPORT `TIP_TO_RESISTANCE_BAND`
- UNEXPORT `RESISTANCE_PHRASES`
- DELETE `getResistancePhrases`
- DELETE `getTipIndicesByTerrain`
- UNEXPORT `getAllPhrases`
- DELETE `textToPhraseKey`

## src/components/auth/SignUpNicknameCard.tsx

- UNEXPORT `SignUpCalorieInput` (type)

## src/hooks/useRideResumeSlot.ts

- UNEXPORT `UseRideResumeSlotStatus` (type)
- UNEXPORT `SlotOpResult` (type)

## src/components/maphud/MapHud.tsx

- UNEXPORT `AccountChipState` (type)
- UNEXPORT `MapHudRidePresence` (type)

