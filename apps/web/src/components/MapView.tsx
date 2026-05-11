import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { LngLat, LineStringGeometry } from "../lib/geo";
import { getDistanceMeters, type LineStringGeometry as RouteLineStringGeometry } from "../lib/geo";
import type { FollowMode } from "./RideRoutePanel";
import { ensureRiderPedalStripKeyframes } from "../lib/riderPedalStripKeyframes";
import { RIDER_PEDAL_SPRITE_REVISION } from "../lib/riderPedalSpriteMeta";
import "./MapView.css";

/** 레거시 `app.js` 와 동일한 서울 근처 기본 시야 */
const DEFAULT_CENTER: [number, number] = [127.035, 37.505];
const DEFAULT_ZOOM = 12;
const CAMERA_POSITION_TAU_SEC = 0.1;
const CAMERA_BEARING_TAU_PRIMARY_SEC = 0.2;
const CAMERA_BEARING_TAU_SECONDARY_SEC = 0.45;
const CAMERA_BEARING_MAX_DPS_PRIMARY = 280;
const CAMERA_BEARING_MAX_DPS_SECONDARY = 170;
const CAMERA_MAX_DT_MS = 50;
const CAMERA_BEARING_WINDOW_METERS = 60;
const CAMERA_BEARING_WINDOW_SAMPLES = 60;
const ELEVATION_SAMPLE_COUNT = 72;

/**
 * 출발/도착/동행 핀: 3D 피치에서도 지면에 눕지 않고 화면에 세움.
 * `map` 정렬은 지형·건물 뒤로 깔려 동행 마커가 안 보이는 경우가 있어 `viewport`로 통일.
 */
const PIN_MARKER_VIEWPORT_ALIGNMENT = {
  pitchAlignment: "viewport" as const,
  rotationAlignment: "viewport" as const,
};

/** 내 라이더 스프라이트(동일 빌보드 정렬) */
const LIVE_RIDER_MARKER_ALIGNMENT = PIN_MARKER_VIEWPORT_ALIGNMENT;

/** 같은 코스를 주행 중인 다른 사용자(내 마커와 구분) */
export type MapPeerMarker = { id: string; lngLat: LngLat; label?: string | null };

/** 가상 주행 세션과 연동해 페달 루프 주기·재생 여부를 맞춘다 */
export type LiveRiderMotion = {
  sessionStatus: "running" | "paused";
  speedKmh: number;
};

export type MapViewProps = {
  accessToken: string | undefined;
  routeGeometry: LineStringGeometry | null;
  startLngLat: LngLat | null;
  endLngLat: LngLat | null;
  liveLngLat: LngLat | null;
  /** 내 위치 마커 페달 애니메이션(주행/일시정지·가상 속도). 없으면 스프라이트만 정지 표시 */
  liveRiderMotion?: LiveRiderMotion | null;
  /** 입문 코스 동행 등: 다른 라이더 위치 */
  peerMarkers?: MapPeerMarker[];
  mapStyle: string;
  mapZoom: number;
  followMode: FollowMode;
  enable3D: boolean;
  onMapZoom: (zoom: number) => void;
  onSelectPoint: (type: "start" | "end", lngLat: LngLat) => void;
};

export function MapView({
  accessToken,
  routeGeometry,
  startLngLat,
  endLngLat,
  liveLngLat,
  liveRiderMotion,
  peerMarkers,
  mapStyle,
  mapZoom,
  followMode,
  enable3D,
  onMapZoom,
  onSelectPoint,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const startMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const endMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const liveMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const liveMarkerPedalSpriteRef = useRef<HTMLDivElement | null>(null);
  const liveMarkerFlipRef = useRef<HTMLDivElement | null>(null);
  const prevLiveForBearingRef = useRef<LngLat | null>(null);
  const peerMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const routeGeometryRef = useRef<LineStringGeometry | null>(null);
  const liveLngLatRef = useRef<LngLat | null>(null);
  const enable3DRef = useRef(enable3D);
  const initialMapStyleRef = useRef(mapStyle);
  const currentStyleRef = useRef(mapStyle);
  const onSelectPointRef = useRef(onSelectPoint);
  const onMapZoomRef = useRef(onMapZoom);
  const prevLiveRef = useRef<LngLat | null>(null);
  const cameraSmoothRef = useRef<{
    center: LngLat | null;
    bearingPrimary: number | null;
    bearing: number | null;
    pitch: number | null;
    zoom: number | null;
    lastTs: number | null;
  }>({
    center: null,
    bearingPrimary: null,
    bearing: null,
    pitch: null,
    zoom: null,
    lastTs: null,
  });
  const [mapLoaded, setMapLoaded] = useState(false);
  const [elevation, setElevation] = useState<{
    routeSig: string;
    error: boolean;
    values: number[];
  }>({ routeSig: "", error: false, values: [] });
  const BUILDING_LAYER_ID = "boxcycle-3d-buildings";
  const TERRAIN_SOURCE_ID = "boxcycle-dem";

  useEffect(() => {
    routeGeometryRef.current = routeGeometry;
  }, [routeGeometry]);

  useEffect(() => {
    liveLngLatRef.current = liveLngLat;
  }, [liveLngLat]);

  useEffect(() => {
    enable3DRef.current = enable3D;
  }, [enable3D]);

  useEffect(() => {
    onSelectPointRef.current = onSelectPoint;
  }, [onSelectPoint]);

  useEffect(() => {
    onMapZoomRef.current = onMapZoom;
  }, [onMapZoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    resetCameraSmoothing(cameraSmoothRef.current, map);
  }, [followMode]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !accessToken?.trim()) {
      return;
    }

    mapboxgl.accessToken = accessToken.trim();
    const map = new mapboxgl.Map({
      container: el,
      style: initialMapStyleRef.current,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
    });
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(new mapboxgl.ScaleControl({ maxWidth: 120, unit: "metric" }), "bottom-right");
    mapRef.current = map;

    map.on("load", () => setMapLoaded(true));

    map.on("style.load", () => {
      const latestRoute = routeGeometryRef.current;
      if (latestRoute?.coordinates?.length) {
        const routeFeature = {
          type: "Feature" as const,
          properties: {} as Record<string, never>,
          geometry: latestRoute,
        };
        if (!map.getSource("route")) {
          map.addSource("route", { type: "geojson", data: routeFeature });
          map.addLayer({
            id: "route",
            type: "line",
            source: "route",
            paint: { "line-color": "#2563eb", "line-width": 4 },
          });
        }
      }
      apply3DState(map, enable3DRef.current, BUILDING_LAYER_ID, TERRAIN_SOURCE_ID);
    });

    map.on("click", (event) => {
      const picked: LngLat = [event.lngLat.lng, event.lngLat.lat];
      popupRef.current?.remove();
      const closePopup = () => {
        popupRef.current?.remove();
        popupRef.current = null;
      };
      popupRef.current = new mapboxgl.Popup({ closeOnClick: true })
        .setLngLat(picked)
        .setDOMContent(
          buildPickPopup(
            picked,
            (type, lngLat) => onSelectPointRef.current(type, lngLat),
            closePopup,
          ),
        )
        .addTo(map);
    });

    map.on("zoom", () => {
      onMapZoomRef.current(Number(map.getZoom().toFixed(1)));
    });

    const onResize = () => map.resize();
    window.addEventListener("resize", onResize);
    requestAnimationFrame(onResize);

    const peerMarkerMap = peerMarkersRef.current;

    return () => {
      window.removeEventListener("resize", onResize);
      startMarkerRef.current?.remove();
      endMarkerRef.current?.remove();
      liveMarkerRef.current?.remove();
      for (const m of peerMarkerMap.values()) m.remove();
      peerMarkerMap.clear();
      popupRef.current?.remove();
      startMarkerRef.current = null;
      endMarkerRef.current = null;
      liveMarkerRef.current = null;
      popupRef.current = null;
      map.remove();
      mapRef.current = null;
      setMapLoaded(false);
    };
  }, [accessToken]);

  /** 경로 레이어 */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    if (!routeGeometry?.coordinates?.length) {
      if (map.getLayer("route")) map.removeLayer("route");
      if (map.getSource("route")) map.removeSource("route");
      return;
    }

    const routeFeature = {
      type: "Feature" as const,
      properties: {} as Record<string, never>,
      geometry: routeGeometry,
    };

    if (map.getSource("route")) {
      (map.getSource("route") as mapboxgl.GeoJSONSource).setData(routeFeature);
    } else {
      map.addSource("route", { type: "geojson", data: routeFeature });
      map.addLayer({
        id: "route",
        type: "line",
        source: "route",
        paint: {
          "line-color": "#2563eb",
          "line-width": 4,
        },
      });
    }

    const bounds = new mapboxgl.LngLatBounds();
    routeGeometry.coordinates.forEach((p) => bounds.extend(p as [number, number]));
    map.fitBounds(bounds, { padding: 40, maxZoom: 16 });
  }, [routeGeometry, mapLoaded]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    if (currentStyleRef.current === mapStyle) return;
    currentStyleRef.current = mapStyle;
    map.setStyle(mapStyle);
  }, [mapStyle, mapLoaded]);

  /** 출발/도착 마커 */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    if (startLngLat) {
      if (!startMarkerRef.current) {
        startMarkerRef.current = new mapboxgl.Marker({
          color: "#16a34a",
          className: "map-view__pin-marker map-view__pin-marker--start",
          ...PIN_MARKER_VIEWPORT_ALIGNMENT,
        })
          .setLngLat(startLngLat)
          .addTo(map);
      } else {
        startMarkerRef.current.setLngLat(startLngLat);
      }
    } else {
      startMarkerRef.current?.remove();
      startMarkerRef.current = null;
    }

    if (endLngLat) {
      if (!endMarkerRef.current) {
        endMarkerRef.current = new mapboxgl.Marker({
          color: "#dc2626",
          className: "map-view__pin-marker map-view__pin-marker--end",
          ...PIN_MARKER_VIEWPORT_ALIGNMENT,
        })
          .setLngLat(endLngLat)
          .addTo(map);
      } else {
        endMarkerRef.current.setLngLat(endLngLat);
      }
    } else {
      endMarkerRef.current?.remove();
      endMarkerRef.current = null;
    }
  }, [startLngLat, endLngLat, mapLoaded]);

  /** 라이브 위치 마커 — 페달 스프라이트 라이더(보고서 6·7·8절) */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    if (liveLngLat) {
      if (!liveMarkerRef.current) {
        const { root, flip, sprite } = createLiveRiderMarkerRoot();
        liveMarkerFlipRef.current = flip;
        liveMarkerPedalSpriteRef.current = sprite;
        prevLiveForBearingRef.current = null;
        liveMarkerRef.current = new mapboxgl.Marker({
          element: root,
          className: "map-view__live-rider-marker",
          ...LIVE_RIDER_MARKER_ALIGNMENT,
        })
          .setLngLat(liveLngLat)
          .addTo(map);
      } else {
        liveMarkerRef.current.setLngLat(liveLngLat);
      }
    } else {
      liveMarkerRef.current?.remove();
      liveMarkerRef.current = null;
      liveMarkerFlipRef.current = null;
      liveMarkerPedalSpriteRef.current = null;
      prevLiveForBearingRef.current = null;
    }
  }, [liveLngLat, mapLoaded]);

  /** 진행 방향 플립 + 속도·세션에 따른 페달 루프 */
  useEffect(() => {
    if (!mapLoaded || !liveLngLat) return;
    const flip = liveMarkerFlipRef.current;
    const sprite = liveMarkerPedalSpriteRef.current;
    if (!flip || !sprite) return;

    const prev = prevLiveForBearingRef.current;
    let bearingDeg: number | null = null;
    if (prev && getDistanceMeters(prev, liveLngLat) >= 2) {
      bearingDeg = getBearing(prev, liveLngLat);
    }
    if (bearingDeg == null) {
      bearingDeg = getHeadingFromRouteAtPoint(routeGeometry, liveLngLat);
    }
    const b = bearingDeg ?? 0;
    flip.style.transform = b > 90 && b < 270 ? "scaleX(-1)" : "scaleX(1)";
    prevLiveForBearingRef.current = liveLngLat;

    const motion = liveRiderMotion;
    const speedNow = motion?.speedKmh ?? 0;
    const pedalingRunning =
      motion != null && motion.sessionStatus === "running" && speedNow > 0.35;
    const rpm = estimateCrankRpmFromSpeedKmh(speedNow);
    let pedalLoopSec = 60 / rpm;
    pedalLoopSec = Math.min(5.5, Math.max(0.22, pedalLoopSec));
    sprite.style.animationDuration = `${pedalLoopSec}s`;
    sprite.style.animationPlayState = pedalingRunning ? "running" : "paused";
  }, [liveLngLat, liveRiderMotion, routeGeometry, mapLoaded]);

  /** 다른 라이더(동행) 마커 — 보라색, 내 주행 마커(주황)와 구분 */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const peers = peerMarkers ?? [];
    const want = new Map(peers.map((p) => [p.id, p]));
    const byId = peerMarkersRef.current;
    for (const [id, marker] of byId) {
      if (!want.has(id)) {
        marker.remove();
        byId.delete(id);
      }
    }
    for (const p of peers) {
      let marker = byId.get(p.id);
      if (!marker) {
        marker = new mapboxgl.Marker({
          color: "#7c3aed",
          className: "map-view__peer-marker",
          ...PIN_MARKER_VIEWPORT_ALIGNMENT,
        })
          .setLngLat(p.lngLat)
          .addTo(map);
        byId.set(p.id, marker);
      } else {
        marker.setLngLat(p.lngLat);
      }
      const title = p.label?.trim() || "동행 라이더";
      marker.getElement().setAttribute("title", title);
    }
  }, [peerMarkers, mapLoaded]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    if (Math.abs(map.getZoom() - mapZoom) < 0.05) return;
    map.zoomTo(mapZoom, { duration: 0 });
  }, [mapZoom, mapLoaded]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    apply3DState(map, enable3D, BUILDING_LAYER_ID, TERRAIN_SOURCE_ID);
  }, [enable3D, mapLoaded]);

  const routeSig = getRouteSignature(routeGeometry);

  useEffect(() => {
    if (!routeGeometry || routeGeometry.coordinates.length < 2) return;
    let cancelled = false;
    const sampled = sampleRouteCoordinates(routeGeometry.coordinates, ELEVATION_SAMPLE_COUNT);
    void fetchElevations(sampled)
      .then((values) => {
        if (!cancelled) setElevation({ routeSig, error: false, values });
      })
      .catch(() => {
        if (!cancelled) setElevation({ routeSig, error: true, values: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [routeGeometry, routeSig]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !liveLngLat) return;

    if (followMode === "free") {
      prevLiveRef.current = liveLngLat;
      return;
    }

    const prev = prevLiveRef.current;
    const headingFromMove =
      prev && getDistanceMeters(prev, liveLngLat) >= 2 ? getBearing(prev, liveLngLat) : null;
    const headingFromRoute = getAverageHeadingAheadFromPoint(
      routeGeometry,
      liveLngLat,
      CAMERA_BEARING_WINDOW_METERS,
      CAMERA_BEARING_WINDOW_SAMPLES,
    );
    const baseHeading = headingFromMove ?? headingFromRoute ?? map.getBearing();
    const nextCamera = getCameraForFollowMode({
      mode: followMode,
      baseHeading,
      currentPitch: map.getPitch(),
      enable3D,
    });

    prevLiveRef.current = liveLngLat;
    const smooth = cameraSmoothRef.current;
    if (!smooth.center || smooth.bearing == null || smooth.bearingPrimary == null || smooth.pitch == null || smooth.zoom == null) {
      resetCameraSmoothing(smooth, map);
    }
    const nowTs = performance.now();
    const dtMs = smooth.lastTs == null ? 0 : nowTs - smooth.lastTs;
    smooth.lastTs = nowTs;
    const dtSec = clamp(dtMs, 0, CAMERA_MAX_DT_MS) / 1000;
    const alphaPos = dampAlpha(dtSec, CAMERA_POSITION_TAU_SEC);
    const alphaBearingPrimary = dampAlpha(dtSec, CAMERA_BEARING_TAU_PRIMARY_SEC);
    const alphaBearingSecondary = dampAlpha(dtSec, CAMERA_BEARING_TAU_SECONDARY_SEC);
    const maxStepPrimary = CAMERA_BEARING_MAX_DPS_PRIMARY * dtSec;
    const maxStepSecondary = CAMERA_BEARING_MAX_DPS_SECONDARY * dtSec;

    const curCenter = smooth.center ?? liveLngLat;
    const curPitch = smooth.pitch ?? map.getPitch();
    const curZoom = smooth.zoom ?? map.getZoom();
    const curBearingPrimary = smooth.bearingPrimary ?? map.getBearing();
    const curBearing = smooth.bearing ?? map.getBearing();

    const nextCenter: LngLat = [
      lerp(curCenter[0], liveLngLat[0], alphaPos),
      lerp(curCenter[1], liveLngLat[1], alphaPos),
    ];
    const nextPitch = lerp(curPitch, nextCamera.pitch, alphaPos);
    const nextZoom = lerp(curZoom, map.getZoom(), alphaPos);
    const nextBearingPrimary = lerpAngle(
      curBearingPrimary,
      nextCamera.bearing,
      alphaBearingPrimary,
      maxStepPrimary,
    );
    const nextBearing = lerpAngle(
      curBearing,
      nextBearingPrimary,
      alphaBearingSecondary,
      maxStepSecondary,
    );

    smooth.center = nextCenter;
    smooth.pitch = nextPitch;
    smooth.zoom = nextZoom;
    smooth.bearingPrimary = nextBearingPrimary;
    smooth.bearing = nextBearing;

    map.stop();
    map.jumpTo({
      center: nextCenter,
      bearing: nextBearing,
      pitch: nextPitch,
      zoom: nextZoom,
    });
  }, [liveLngLat, followMode, enable3D, mapLoaded, routeGeometry]);

  if (!accessToken?.trim()) {
    return (
      <div className="map-view map-view--placeholder">
        <p>
          Mapbox 토큰이 없습니다. <code>apps/web/.env</code> 에{" "}
          <code>VITE_MAPBOX_ACCESS_TOKEN</code> 를 설정하고 개발 서버를 다시 시작하세요.
        </p>
      </div>
    );
  }

  const progressRatio = getProgressRatioOnRoute(routeGeometry, liveLngLat);
  const elevationUi = buildElevationUi(elevation.values, progressRatio);
  const hasRoute = Boolean(routeGeometry && routeGeometry.coordinates.length > 1);
  const isLoadingElevation = hasRoute && elevation.routeSig !== routeSig && !elevation.error;
  const isElevationError = hasRoute && elevation.routeSig === routeSig && elevation.error;
  const isElevationReady =
    hasRoute && elevation.routeSig === routeSig && !elevation.error && elevation.values.length > 1;
  return (
    <div className="map-view-shell">
      <div ref={containerRef} className="map-view" role="presentation" />
      {isLoadingElevation ? (
        <div className="elevation-overlay">
          <div className="elevation-overlay__empty">고도 계산 중…</div>
        </div>
      ) : null}
      {isElevationError ? (
        <div className="elevation-overlay">
          <div className="elevation-overlay__empty">고도 데이터를 불러오지 못했습니다.</div>
        </div>
      ) : null}
      {isElevationReady ? (
        <div className="elevation-overlay">
          <div className="elevation-overlay__meta">
            <span>시점 {elevationUi.startMeters.toFixed(0)}m</span>
            <span>종점 {elevationUi.endMeters.toFixed(0)}m</span>
          </div>
          <svg
            className="elevation-overlay__svg"
            viewBox="0 0 420 100"
            preserveAspectRatio="none"
            role="img"
            aria-label="elevation profile"
          >
            <polyline
              points={elevationUi.polylinePoints}
              fill="none"
              stroke="#ef4444"
              strokeWidth="2.2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {elevationUi.marker ? (
              <circle
                cx={elevationUi.marker.x}
                cy={elevationUi.marker.y}
                r="4.2"
                fill="#38bdf8"
                stroke="#ffffff"
                strokeWidth="1.4"
              />
            ) : null}
          </svg>
        </div>
      ) : null}
    </div>
  );
}

function createLiveRiderMarkerRoot(): {
  root: HTMLDivElement;
  flip: HTMLDivElement;
  sprite: HTMLDivElement;
} {
  ensureRiderPedalStripKeyframes();
  const root = document.createElement("div");
  root.className = "cycling-sim-marker-host";
  const flip = document.createElement("div");
  flip.className = "cycling-sim-marker-flip";
  const stack = document.createElement("div");
  stack.className = "cycling-sim-marker-stack";
  const sprite = document.createElement("div");
  sprite.className = "cycling-sim-marker-pedal-sprite";
  const baseRaw = import.meta.env.BASE_URL ?? "/";
  const base = baseRaw.endsWith("/") ? baseRaw : `${baseRaw}/`;
  sprite.style.backgroundImage = `url("${base}rider/pedal-sprite.png?v=${RIDER_PEDAL_SPRITE_REVISION}")`;
  stack.appendChild(sprite);
  flip.appendChild(stack);
  root.appendChild(flip);
  root.setAttribute("aria-hidden", "true");
  root.title = "내 위치";
  return { root, flip, sprite };
}

/** 보고서 8.1 속도 기반 추정(센서 없음): km/h 상한 95 */
function estimateCrankRpmFromSpeedKmh(speedKmh: number): number {
  const speed = Math.min(95, Math.max(0, speedKmh));
  return Math.min(128, Math.max(16, 22 + speed * 2.85));
}

function buildPickPopup(
  lngLat: LngLat,
  onSelectPoint: (type: "start" | "end", lngLat: LngLat) => void,
  closePopup: () => void,
) {
  const wrap = document.createElement("div");
  wrap.style.minWidth = "180px";
  const text = document.createElement("div");
  text.textContent = `${lngLat[0].toFixed(6)},${lngLat[1].toFixed(6)}`;
  text.style.fontSize = "12px";
  text.style.marginBottom = "8px";

  const startBtn = document.createElement("button");
  startBtn.type = "button";
  startBtn.textContent = "출발지로 설정";
  startBtn.style.width = "100%";
  startBtn.style.marginBottom = "6px";
  startBtn.onclick = () => {
    onSelectPoint("start", lngLat);
    closePopup();
  };

  const endBtn = document.createElement("button");
  endBtn.type = "button";
  endBtn.textContent = "도착지로 설정";
  endBtn.style.width = "100%";
  endBtn.onclick = () => {
    onSelectPoint("end", lngLat);
    closePopup();
  };

  wrap.append(text, startBtn, endBtn);
  return wrap;
}

function getCameraForFollowMode(input: {
  mode: FollowMode;
  baseHeading: number;
  currentPitch: number;
  enable3D: boolean;
}) {
  const pitch3DRear = 70;
  const pitch3DFront = 60;
  const pitch3DSide = 85;
  const sidePitch = input.enable3D ? pitch3DSide : input.currentPitch;
  const frontPitch = input.enable3D ? pitch3DFront : input.currentPitch;
  const rearPitch = input.enable3D ? pitch3DRear : input.currentPitch;

  if (input.mode === "north") {
    return { bearing: 0, pitch: input.currentPitch };
  }
  if (input.mode === "rear30") {
    return { bearing: normalizeCompass(input.baseHeading), pitch: rearPitch };
  }
  if (input.mode === "front30") {
    return { bearing: normalizeCompass(input.baseHeading + 180), pitch: frontPitch };
  }
  if (input.mode === "rightFlat") {
    return { bearing: normalizeCompass(input.baseHeading + 90), pitch: sidePitch };
  }
  if (input.mode === "leftFlat") {
    return { bearing: normalizeCompass(input.baseHeading + 270), pitch: sidePitch };
  }
  return { bearing: normalizeCompass(input.baseHeading), pitch: input.currentPitch };
}

function normalizeCompass(deg: number) {
  let x = deg % 360;
  if (x < 0) x += 360;
  return x;
}

function getHeadingFromRouteAtPoint(
  geometry: RouteLineStringGeometry | null,
  point: LngLat,
): number | null {
  if (!geometry || geometry.coordinates.length < 2) return null;
  const coords = geometry.coordinates;

  let nearestIdx = -1;
  let nearestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < coords.length; i += 1) {
    const d = getDistanceMeters(coords[i], point);
    if (d < nearestDist) {
      nearestDist = d;
      nearestIdx = i;
    }
  }
  if (nearestIdx < 0) return null;
  if (nearestIdx === coords.length - 1) {
    return getBearing(coords[coords.length - 2], coords[coords.length - 1]);
  }
  return getBearing(coords[nearestIdx], coords[nearestIdx + 1]);
}

function getAverageHeadingAheadFromPoint(
  geometry: RouteLineStringGeometry | null,
  point: LngLat,
  windowMeters: number,
  samples: number,
): number | null {
  if (!geometry || geometry.coordinates.length < 2) return null;
  const currentDistance = getDistanceOnRouteByProjectedPoint(geometry.coordinates, point);
  if (currentDistance == null) return getHeadingFromRouteAtPoint(geometry, point);
  if (windowMeters <= 0 || samples <= 0) {
    return getHeadingByRouteDistance(geometry.coordinates, currentDistance);
  }

  let sumX = 0;
  let sumY = 0;
  for (let i = 1; i <= samples; i += 1) {
    const ahead = getHeadingByRouteDistance(
      geometry.coordinates,
      currentDistance + (windowMeters * i) / samples,
    );
    if (ahead == null) continue;
    const rad = (ahead * Math.PI) / 180;
    sumX += Math.cos(rad);
    sumY += Math.sin(rad);
  }
  if (sumX === 0 && sumY === 0) return null;
  let deg = (Math.atan2(sumY, sumX) * 180) / Math.PI;
  if (deg < 0) deg += 360;
  return deg;
}

function getHeadingByRouteDistance(coords: LngLat[], routeDistanceMeters: number): number | null {
  if (coords.length < 2) return null;
  let idx = 0;
  let remain = Math.max(0, routeDistanceMeters);
  while (idx < coords.length - 1) {
    const seg = getDistanceMeters(coords[idx], coords[idx + 1]);
    if (seg <= 0) {
      idx += 1;
      continue;
    }
    if (remain <= seg) return getBearing(coords[idx], coords[idx + 1]);
    remain -= seg;
    idx += 1;
  }
  return getBearing(coords[coords.length - 2], coords[coords.length - 1]);
}

function getDistanceOnRouteByProjectedPoint(coords: LngLat[], point: LngLat): number | null {
  if (coords.length < 2) return null;
  let cumulative = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestRouteDistance = 0;

  for (let i = 0; i < coords.length - 1; i += 1) {
    const a = coords[i];
    const b = coords[i + 1];
    const segLen = getDistanceMeters(a, b);
    if (segLen <= 0) continue;

    const abx = b[0] - a[0];
    const aby = b[1] - a[1];
    const apx = point[0] - a[0];
    const apy = point[1] - a[1];
    const denom = abx * abx + aby * aby;
    const rawT = denom > 0 ? (apx * abx + apy * aby) / denom : 0;
    const t = Math.max(0, Math.min(1, rawT));
    const projected: LngLat = [a[0] + abx * t, a[1] + aby * t];
    const d = getDistanceMeters(projected, point);
    if (d < bestDistance) {
      bestDistance = d;
      bestRouteDistance = cumulative + segLen * t;
    }
    cumulative += segLen;
  }
  return bestRouteDistance;
}

function resetCameraSmoothing(
  state: {
    center: LngLat | null;
    bearingPrimary: number | null;
    bearing: number | null;
    pitch: number | null;
    zoom: number | null;
    lastTs: number | null;
  },
  map: mapboxgl.Map,
) {
  const c = map.getCenter();
  state.center = [c.lng, c.lat];
  state.bearing = map.getBearing();
  state.bearingPrimary = map.getBearing();
  state.pitch = map.getPitch();
  state.zoom = map.getZoom();
  state.lastTs = null;
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function normalizeAngle(angle: number) {
  let n = angle % 360;
  if (n > 180) n -= 360;
  if (n < -180) n += 360;
  return n;
}

function shortestAngleDelta(from: number, to: number) {
  return normalizeAngle(to - from);
}

function lerpAngle(from: number, to: number, t: number, maxStep: number) {
  const delta = shortestAngleDelta(from, to);
  const stepped = clamp(delta * t, -maxStep, maxStep);
  return normalizeAngle(from + stepped);
}

function dampAlpha(dtSec: number, tauSec: number) {
  if (tauSec <= 0 || dtSec <= 0) return 0;
  return 1 - Math.exp(-dtSec / tauSec);
}

function getBearing(a: LngLat, b: LngLat): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function apply3DState(
  map: mapboxgl.Map,
  enabled: boolean,
  buildingLayerId: string,
  terrainSourceId: string,
) {
  if (!enabled) {
    map.setTerrain(null);
    if (map.getLayer(buildingLayerId)) map.removeLayer(buildingLayerId);
    map.easeTo({ pitch: 0, duration: 400 });
    return;
  }

  if (!map.getSource(terrainSourceId)) {
    map.addSource(terrainSourceId, {
      type: "raster-dem",
      url: "mapbox://mapbox.terrain-rgb",
      tileSize: 512,
      maxzoom: 14,
    });
  }
  map.setTerrain({ source: terrainSourceId, exaggeration: 1.3 });
  if (!map.getLayer(buildingLayerId)) {
    const layers = map.getStyle().layers ?? [];
    const symbolLayer = layers.find((layer) => layer.type === "symbol" && layer.layout?.["text-field"]);
    map.addLayer(
      {
        id: buildingLayerId,
        source: "composite",
        "source-layer": "building",
        filter: ["==", "extrude", "true"],
        type: "fill-extrusion",
        minzoom: 15,
        paint: {
          "fill-extrusion-color": "#cbd5e1",
          "fill-extrusion-height": ["get", "height"],
          "fill-extrusion-base": ["get", "min_height"],
          "fill-extrusion-opacity": 0.65,
        },
      },
      symbolLayer?.id,
    );
  }
  if (map.getPitch() < 35) {
    map.easeTo({ pitch: 60, bearing: map.getBearing(), duration: 450 });
  }
}

function sampleRouteCoordinates(coords: LngLat[], sampleCount: number): LngLat[] {
  if (coords.length <= sampleCount) return coords;
  const sampled: LngLat[] = [];
  for (let i = 0; i < sampleCount; i += 1) {
    const idx = Math.round((i / (sampleCount - 1)) * (coords.length - 1));
    sampled.push(coords[idx]);
  }
  return sampled;
}

function getRouteSignature(geometry: LineStringGeometry | null) {
  if (!geometry || geometry.coordinates.length < 2) return "";
  const first = geometry.coordinates[0];
  const last = geometry.coordinates[geometry.coordinates.length - 1];
  return `${geometry.coordinates.length}:${first[0].toFixed(5)},${first[1].toFixed(5)}:${last[0].toFixed(5)},${last[1].toFixed(5)}`;
}

async function fetchElevations(sampledCoords: LngLat[]): Promise<number[]> {
  const latitudes = sampledCoords.map((coord) => coord[1].toFixed(6)).join(",");
  const longitudes = sampledCoords.map((coord) => coord[0].toFixed(6)).join(",");
  const url = `https://api.open-meteo.com/v1/elevation?latitude=${latitudes}&longitude=${longitudes}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("elevation request failed");
  const data = (await response.json()) as { elevation?: number[] };
  if (!data.elevation || data.elevation.length < 2) throw new Error("empty elevation");
  return data.elevation;
}

function buildElevationUi(values: number[], progressRatio: number | null) {
  const width = 420;
  const height = 100;
  const pad = 8;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);
  const points = values.map((value, index) => {
    const x = pad + (index / (values.length - 1)) * (width - pad * 2);
    const y = height - pad - ((value - min) / range) * (height - pad * 2);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  let marker: { x: string; y: string } | null = null;
  if (progressRatio != null && Number.isFinite(progressRatio)) {
    const clamped = Math.max(0, Math.min(1, progressRatio));
    const markerIdx = clamped * (values.length - 1);
    const lowerIdx = Math.floor(markerIdx);
    const upperIdx = Math.min(values.length - 1, lowerIdx + 1);
    const t = markerIdx - lowerIdx;
    const xLower = pad + (lowerIdx / (values.length - 1)) * (width - pad * 2);
    const xUpper = pad + (upperIdx / (values.length - 1)) * (width - pad * 2);
    const yLower = height - pad - ((values[lowerIdx] - min) / range) * (height - pad * 2);
    const yUpper = height - pad - ((values[upperIdx] - min) / range) * (height - pad * 2);
    marker = {
      x: (xLower + (xUpper - xLower) * t).toFixed(2),
      y: (yLower + (yUpper - yLower) * t).toFixed(2),
    };
  }
  return {
    polylinePoints: points.join(" "),
    startMeters: values[0],
    endMeters: values[values.length - 1],
    marker,
  };
}

function getProgressRatioOnRoute(
  routeGeometry: LineStringGeometry | null,
  liveLngLat: LngLat | null,
): number | null {
  if (!routeGeometry || routeGeometry.coordinates.length < 2 || !liveLngLat) return null;
  const coords = routeGeometry.coordinates;
  let total = 0;
  let closestIdx = 0;
  let closestDist = Number.POSITIVE_INFINITY;
  const cumulative: number[] = [0];
  for (let i = 1; i < coords.length; i += 1) {
    total += getDistanceMeters(coords[i - 1], coords[i]);
    cumulative.push(total);
  }
  if (total <= 0) return null;
  for (let i = 0; i < coords.length; i += 1) {
    const d = getDistanceMeters(coords[i], liveLngLat);
    if (d < closestDist) {
      closestDist = d;
      closestIdx = i;
    }
  }
  return cumulative[closestIdx] / total;
}
