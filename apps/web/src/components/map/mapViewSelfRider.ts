import mapboxgl from "mapbox-gl";
import { estimateCrankRpmFromSpeedKmh, resolvePedalCrankRpm } from "../../lib/sensor/crankRpm";
import type { LngLat, LineStringGeometry } from "../../lib/geo/geo";
import { resolveRiderBearingDeg } from "../../lib/geo/geo";
import {
  SELF_LOCATION_MARKER_CLASS,
  createSelfLocationMarkerRoot,
} from "../../lib/map/mapSelfLocationMarker";
import { getRiderPrototypeMode, isRiderPrototype3dMode } from "../../lib/riderPrototype/config";
import { applyIso2dRiderBearing } from "../../lib/riderPrototype/iso2dMarker";
import { PIN_MARKER_VIEWPORT_ALIGNMENT } from "./riderDomMarkers";
import type { LiveRiderMotion } from "./mapViewTypes";

const RIDER_PROTOTYPE_MODE = getRiderPrototypeMode();
const RIDER_PROTOTYPE_IS_3D = isRiderPrototype3dMode(RIDER_PROTOTYPE_MODE);

export function mountSelfLocationMarker(
  map: mapboxgl.Map,
  lngLat: LngLat,
): { marker: mapboxgl.Marker; bearingEl: HTMLDivElement } {
  const { root, bearingEl } = createSelfLocationMarkerRoot();
  const marker = new mapboxgl.Marker({
    element: root,
    className: SELF_LOCATION_MARKER_CLASS,
    anchor: "center",
    ...PIN_MARKER_VIEWPORT_ALIGNMENT,
  })
    .setLngLat(lngLat)
    .addTo(map);
  return { marker, bearingEl };
}

/** rAF tick — 본인 라이더 마커 방향·페달 (동행과 동일 프레임) */
export function syncLiveSelfRiderVisual(
  pos: LngLat,
  motion: LiveRiderMotion | null | undefined,
  routeGeometry: LineStringGeometry | null,
  prevLiveForBearingRef: { current: LngLat | null },
  flipRef: { current: HTMLDivElement | null },
  imgRef: { current: HTMLImageElement | null },
  spriteRef: { current: HTMLDivElement | null },
  prefersReducedMotion: boolean,
): void {
  const prev = prevLiveForBearingRef.current;
  const b = resolveRiderBearingDeg(routeGeometry, pos, prev);
  prevLiveForBearingRef.current = pos;

  if (RIDER_PROTOTYPE_MODE === "iso2d") {
    const flip = flipRef.current;
    const img = imgRef.current;
    if (flip && img) applyIso2dRiderBearing(flip, img, "self", b);
    return;
  }
  if (RIDER_PROTOTYPE_IS_3D) return;

  const flip = flipRef.current;
  const sprite = spriteRef.current;
  if (!flip || !sprite) return;

  flip.style.transform = b > 90 && b < 270 ? "scaleX(-1)" : "scaleX(1)";

  const speedNow = motion?.speedKmh ?? 0;
  const pedalingRunning = motion != null && motion.sessionStatus === "running" && speedNow > 0.35;
  const rpm = motion
    ? resolvePedalCrankRpm({
        speedKmh: motion.speedKmh,
        crankRpmFromSensor: motion.crankRpmFromSensor,
      })
    : estimateCrankRpmFromSpeedKmh(0);
  let pedalLoopSec = 60 / rpm;
  pedalLoopSec = Math.min(5.5, Math.max(0.22, pedalLoopSec));
  sprite.style.animationDuration = `${pedalLoopSec}s`;
  const allowPedalAnim = !prefersReducedMotion && pedalingRunning;
  sprite.style.animationPlayState = allowPedalAnim ? "running" : "paused";
}
