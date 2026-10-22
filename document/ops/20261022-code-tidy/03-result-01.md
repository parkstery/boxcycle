# 결과01 — P1 죽은 코드: riderPrototype·rider·camera·geo·conquest·coach

2026-10-22 · 담당 opencode(GLM-5.3-Flash) · 지시 [02-task-01.md](02-task-01.md) · 목록 [02-task-01-list.md](02-task-01-list.md)

## 처리 요약

| 구분 | 목록 건수 | 실행 |
|---|---:|---:|
| DELETE | 14 | **15** (※ 재분류 1건, 아래 참조) |
| UNEXPORT | 41 | **40** (※ 재분류 1건) |

- 추가 항목: `riderRig.ts`의 `SADDLE`·`PELVIS` export const 2줄 삭제 — 완료. `PELVIS_ROOT`는 그대로 뒀다.
- 추가 항목: `apps/web/src/lib/riderPrototype/riderBody.mjs` 파일 삭제 — 완료. `riderAnthropometry.json`은 건드리지 않았다.
- 배럴(`index.ts`) 재수출 수정: 해당 없음(대상 lib 경로에는 `index.ts`가 없다 — `lib/peerMotion/index.ts`만 존재, 무관).

### 재분류 1건

- `src/lib/geo/geo.ts` `buildVertexCumulativeMeters` — 목록은 UNEXPORT였고 `export`만 떼는 단계까지는 실행됐으나, 이 작업으로 같은 파일 안 참조(삭제된 `distanceMetersToVertexIndexAtOrBefore`의 JSDoc 인용 뿐)가 모두 사라져 `tsc`가 `TS6133 declared but its value is never read`를 냈다. 규칙의 "위 작업 때문에 같은 파일 안에서 새로 안 쓰이게 된 것은 지운다(tsc·lint 가 알려 준다)"에 따라 **선언·JSDoc 통째 삭제(DELETE로 전환)** 했다.

### 파일별 내역

| 파일 | 처리 |
|---|---|
| `riderPrototype/riderRig.geometry.mjs` | UNEXPORT 7 (`SEAT_TUBE_JUNCTION_Y_MM`·`HOOD_HALF_Z`·`HIP_GROUND`·`HIP_TO_ISCHIAL_M`·`ISCHIAL_Y_M`·`SADDLE_HEIGHT_DERIVED_MM`·`TORSO_ANGLE_DEG`) / DELETE 2 (`SEATPOST_EXPOSED_MM`·`RIDER_RIG`) |
| `riderPrototype/riderRig.ts` (추가 항목) | `SADDLE`·`PELVIS` export const 2줄 삭제 |
| `riderPrototype/riderBody.mjs` (추가 항목) | 파일 삭제 |
| `rider/riderGlbPedalPose.pose.mjs` | DELETE 1 (`_poles`, JSDoc 포함) / UNEXPORT 1 (`sampleRiderMetrics`) |
| `geo/geo.ts` | DELETE 5 (`parseLngLat`·`densifyLineStringByIntervalM`·`distanceMetersToVertexIndexAtOrBefore`·`driveHeadingAtDistanceMeters`·`pathPointAheadAlongLineString`) + 재분류 DELETE 1 (`buildVertexCumulativeMeters`) |
| `conquest/conquestTiles.ts` | DELETE 1 (`CONQUEST_CELL_APPROX_METERS`, JSDoc 포함) |
| `camera/rideCameraFraming.ts` | UNEXPORT 3 (`RIDE_FIT_PADDING_MAX_VIEWPORT_RATIO`·`rideRiderAnchorBiasMAtZoom`·`projectLngLatAltitude`) |
| `geo/entryLocation.ts` | UNEXPORT 1 (`isUsableLngLat`) |
| `rider/riderTurn.ts` | UNEXPORT 5 (`RIDER_LEAN_MAX_DEG`·`RIDER_LEAN_TAU_S`·`wrapHeadingDeg`·`approachHeadingDeg`·`physicalLeanDeg`) |
| `camera/camera1Mode.ts` | UNEXPORT 1 (`isCamera1Mode`) / DELETE 1 (`Camera1LegacyMode` type) |
| `riderPrototype/iso2dMarker.ts` | UNEXPORT 1 (`resolveIso2dSprite`) |
| `riderPrototype/riderSway.ts` | UNEXPORT 4 (`RIDER_SWAY_REF_KMH`·`RIDER_SWAY_MIN_FACTOR`·`RIDER_SWAY_MAX_FACTOR`·`RIDER_SWAY_SPEED_TAU_S`) |
| `camera/quickCameraProductTune.ts` | UNEXPORT 1 (`QUICK_CAMERA_PRODUCT_TUNE`) |
| `riderPrototype/config.ts` | DELETE 1 (`PRESERVED_RIDER_CANDIDATE_ID`) / UNEXPORT 1 (`RIDER_GIANT_SCALE_FACTOR`) |
| `camera/cameraRenderPhase.ts` | UNEXPORT 7 (`startCameraRenderPhaseProbe`·`stopCameraRenderPhaseProbe`·`snapshotCameraRenderPhaseProbe`·`noteCameraRenderFromMap`·`CameraWriteSample`·`CameraRenderSample`·`CameraRenderPhaseSnapshot`) |
| `rider/riderGlbPedalPose.ts` | UNEXPORT 1 (`GlbNodeRotationDeg` type) |
| `riderPrototype/glbModelLayer.ts` | UNEXPORT 1 (`syncRiderGlbPedalFeatureState`) |
| `camera/cameraFollowTrace.ts` | UNEXPORT 5 (`startCameraFollowTrace`·`stopCameraFollowTrace`·`snapshotCameraFollowTrace`·`CameraTraceFrame`·`CameraTraceSnapshot`) / DELETE 1 (`assertCameraTraceP0`) |
| `conquest/repo/firestoreConquest.ts` | DELETE 1 (`loadConquestCellIds`) |
| `riderPrototype/riderLightLab.ts` | UNEXPORT 1 (`sanitizeRiderLightLabState`) |
| `coach/coachTypes.ts` | DELETE 1 (`CachedCoachingByDistance` type) |

## 건너뜀

없음.

## 범위 밖 발견 사항

- 같은 작업 트리에서 **다른 지시(02~04)의 수정 대상으로 보이는 파일**(identity·sensor·peerMotion·account·storage·trail 등)이 이미 변경돼 있다. 나는 지시01 대상 19개 TS 파일 + riderBody.mjs 삭제만 했고, 그 외 파일은 읽거나 수정하지 않았다.

## 검증

실행 폴더: `C:\20.HDev\boxcycle\apps\web`

`npx tsc -b --noEmit` — 오류 0 (출력 없음, exit code 0):

```
PS C:\20.HDev\boxcycle\apps\web> npx tsc -b --noEmit
(no output)
```

`npx eslint <고친 파일 19개>` — 오류 0·경고 0 (출력 없음, exit code 0):

```
PS C:\20.HDev\boxcycle\apps\web> npx eslint "src/lib/riderPrototype/riderRig.geometry.mjs" "src/lib/rider/riderGlbPedalPose.pose.mjs" "src/lib/geo/geo.ts" "src/lib/conquest/conquestTiles.ts" "src/lib/camera/rideCameraFraming.ts" "src/lib/geo/entryLocation.ts" "src/lib/rider/riderTurn.ts" "src/lib/camera/camera1Mode.ts" "src/lib/riderPrototype/iso2dMarker.ts" "src/lib/riderPrototype/riderSway.ts" "src/lib/camera/quickCameraProductTune.ts" "src/lib/riderPrototype/config.ts" "src/lib/camera/cameraRenderPhase.ts" "src/lib/rider/riderGlbPedalPose.ts" "src/lib/riderPrototype/glbModelLayer.ts" "src/lib/camera/cameraFollowTrace.ts" "src/lib/conquest/repo/firestoreConquest.ts" "src/lib/riderPrototype/riderLightLab.ts" "src/lib/coach/coachTypes.ts" "src/lib/riderPrototype/riderRig.ts"
(no output)
```

보조 확인: `git diff` 로 대상 19개 파일 전체 diff를 사람이 검수 — 지시 범위 밖 변경 없음. `riderBody.mjs` 삭제는 `git status`에서 `D apps/web/src/lib/riderPrototype/riderBody.mjs` 로 확인.

미실행·차선 검증: vite 번들 경고("value will always be undefined") 재확인용 번들 빌드는 완료 조건에 없어 미실행. `riderRig.ts`가 존재하지 않는 `rig.SADDLE`·`rig.PELVIS`를 읽던 2줄을 diff 검수로 직접 확인해 제거했으므로 해당 경고는 소원해진다.
