import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { LngLat, LineStringGeometry } from "../lib/geo";
import {
  getDistanceMeters,
  lineStringLengthMeters,
  type LineStringGeometry as RouteLineStringGeometry,
} from "../lib/geo";
import type { RouteElevationProfileState } from "../hooks/useRouteElevationProfile";
import type { FollowMode } from "./RideRoutePanel";
import type { CoverageOverlayMode } from "../lib/coverageOverlayMode";
import { MAX_ROUTE_WAYPOINTS } from "../lib/routeWaypoints";
import type { RouteProfile } from "../services/mapboxDirections";
import { fetchMapboxReverseGeocodePlaceName } from "../services/mapboxReverseGeocode";
import { ensureRiderPedalStripKeyframes } from "../lib/riderPedalStripKeyframes";
import {
  RIDER_PEDAL_CELL_PX,
  RIDER_PEDAL_FRAME_COUNT,
  RIDER_PEDAL_SPRITE_REVISION,
} from "../lib/riderPedalSpriteMeta";
import { estimateCrankRpmFromSpeedKmh, resolvePedalCrankRpm } from "../lib/riderPedalMotion";
import {
  mergePeerTargets,
  stepPeerDriveAndBuildGeoJson,
  type PeerDriveSimState,
} from "../lib/peerRidersDrive";
import { applyCoverageOverlayMode } from "../services/coverageOverlaySync";
import type { LobbySpectatorDot } from "../hooks/useLobbyLiveCourseRideSpectatorOverlay";
import "./MapView.css";

/** 로비 관전: 다른 사용자 코스 진행률 기반(geometry 는 로컬 로드, Firestore 는 진행률만). */
const LOBBY_SPEC_ROUTES_SRC = "boxcycle-lobby-spectator-routes";
const LOBBY_SPEC_ROUTES_GLOW_LAYER = "boxcycle-lobby-spectator-routes-glow";
const LOBBY_SPEC_ROUTES_LAYER = "boxcycle-lobby-spectator-routes-line";
const LOBBY_SPEC_DOTS_SRC = "boxcycle-lobby-spectator-dots";
const LOBBY_SPEC_DOTS_GLOW_LAYER = "boxcycle-lobby-spectator-dots-glow";
const LOBBY_SPEC_DOTS_LAYER = "boxcycle-lobby-spectator-dots-circle";

function syncLobbySpectatorLayers(
  map: mapboxgl.Map,
  dots: readonly LobbySpectatorDot[],
  routes: readonly LineStringGeometry[],
): void {
  if (!map.isStyleLoaded()) return;

  const routeFeatures = routes.map((geometry, i) => ({
    type: "Feature" as const,
    id: `lobby-r-${i}`,
    properties: { i },
    geometry,
  }));
  const routeFc = { type: "FeatureCollection" as const, features: routeFeatures };

  const dotFeatures = dots.map((d) => ({
    type: "Feature" as const,
    id: `lobby-d-${d.id}`,
    properties: { id: d.id },
    geometry: { type: "Point" as const, coordinates: d.lngLat },
  }));
  const dotFc = { type: "FeatureCollection" as const, features: dotFeatures };

  const beforeRoute = map.getLayer("route") ? "route" : undefined;

  try {
    if (!map.getSource(LOBBY_SPEC_ROUTES_SRC)) {
      map.addSource(LOBBY_SPEC_ROUTES_SRC, { type: "geojson", data: routeFc });
      map.addLayer(
        {
          id: LOBBY_SPEC_ROUTES_GLOW_LAYER,
          type: "line",
          source: LOBBY_SPEC_ROUTES_SRC,
          paint: {
            "line-color": "#ffffff",
            "line-width": ["interpolate", ["linear"], ["zoom"], 8, 5, 12, 8, 16, 12],
            "line-blur": ["interpolate", ["linear"], ["zoom"], 8, 2.2, 14, 4.5],
            "line-opacity": ["interpolate", ["linear"], ["zoom"], 8, 0.5, 14, 0.72],
          },
          layout: { "line-join": "round", "line-cap": "round" },
        },
        beforeRoute,
      );
      map.addLayer(
        {
          id: LOBBY_SPEC_ROUTES_LAYER,
          type: "line",
          source: LOBBY_SPEC_ROUTES_SRC,
          paint: {
            "line-color": "#dc2626",
            "line-width": ["interpolate", ["linear"], ["zoom"], 8, 1.8, 12, 3, 16, 4.2],
            "line-opacity": 0.95,
          },
          layout: { "line-join": "round", "line-cap": "round" },
        },
        beforeRoute,
      );
    } else {
      (map.getSource(LOBBY_SPEC_ROUTES_SRC) as mapboxgl.GeoJSONSource).setData(routeFc);
      if (!map.getLayer(LOBBY_SPEC_ROUTES_GLOW_LAYER) && map.getLayer(LOBBY_SPEC_ROUTES_LAYER)) {
        map.addLayer(
          {
            id: LOBBY_SPEC_ROUTES_GLOW_LAYER,
            type: "line",
            source: LOBBY_SPEC_ROUTES_SRC,
            paint: {
              "line-color": "#ffffff",
              "line-width": ["interpolate", ["linear"], ["zoom"], 8, 5, 12, 8, 16, 12],
              "line-blur": ["interpolate", ["linear"], ["zoom"], 8, 2.2, 14, 4.5],
              "line-opacity": ["interpolate", ["linear"], ["zoom"], 8, 0.5, 14, 0.72],
            },
            layout: { "line-join": "round", "line-cap": "round" },
          },
          LOBBY_SPEC_ROUTES_LAYER,
        );
      }
    }

    if (!map.getSource(LOBBY_SPEC_DOTS_SRC)) {
      map.addSource(LOBBY_SPEC_DOTS_SRC, { type: "geojson", data: dotFc });
      map.addLayer(
        {
          id: LOBBY_SPEC_DOTS_GLOW_LAYER,
          type: "circle",
          source: LOBBY_SPEC_DOTS_SRC,
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 7, 14, 12],
            "circle-color": "#ffffff",
            "circle-opacity": ["interpolate", ["linear"], ["zoom"], 9, 0.55, 14, 0.7],
            "circle-blur": 0.55,
          },
        },
        beforeRoute,
      );
      map.addLayer(
        {
          id: LOBBY_SPEC_DOTS_LAYER,
          type: "circle",
          source: LOBBY_SPEC_DOTS_SRC,
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 3.6, 14, 7],
            "circle-color": "#dc2626",
            "circle-stroke-width": 1.8,
            "circle-stroke-color": "#ffffff",
            "circle-opacity": 0.96,
            "circle-blur": 0.05,
          },
        },
        beforeRoute,
      );
    } else {
      (map.getSource(LOBBY_SPEC_DOTS_SRC) as mapboxgl.GeoJSONSource).setData(dotFc);
      if (!map.getLayer(LOBBY_SPEC_DOTS_GLOW_LAYER) && map.getLayer(LOBBY_SPEC_DOTS_LAYER)) {
        map.addLayer(
          {
            id: LOBBY_SPEC_DOTS_GLOW_LAYER,
            type: "circle",
            source: LOBBY_SPEC_DOTS_SRC,
            paint: {
              "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 7, 14, 12],
              "circle-color": "#ffffff",
              "circle-opacity": ["interpolate", ["linear"], ["zoom"], 9, 0.55, 14, 0.7],
              "circle-blur": 0.55,
            },
          },
          LOBBY_SPEC_DOTS_LAYER,
        );
      }
    }
  } catch (e) {
    console.warn("[MapView] lobby spectator layers", e);
  }
}

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

/**
 * 출발/도착/동행 핀: 3D 피치에서도 지면에 눕지 않고 화면에 세움.
 * `map` 정렬은 지형·건물 뒤로 깔려 동행 마커가 안 보이는 경우가 있어 `viewport`로 통일.
 */
const PIN_MARKER_VIEWPORT_ALIGNMENT = {
  pitchAlignment: "viewport" as const,
  rotationAlignment: "viewport" as const,
};

function pickPeerSourceFrameIndices(totalFrames: number): number[] {
  if (totalFrames < 2) return [0, 0, 0, 0, 0, 0];
  return [0, 1, 2, 3, 4, 5].map((i) => Math.min(totalFrames - 1, Math.round((i * (totalFrames - 1)) / 5)));
}

const PEER_DOM_STRIP_INDICES = pickPeerSourceFrameIndices(RIDER_PEDAL_FRAME_COUNT);

type PeerDomGJFeature = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: LngLat };
  properties: { id: string; label: string; pframe: number; hdg: number };
};

function applyPeerDomSpriteFrame(sprite: HTMLDivElement | null, pframe: number): void {
  if (!sprite) return;
  const idx = ((Math.round(pframe) % 6) + 6) % 6;
  const stripIndex = PEER_DOM_STRIP_INDICES[idx] ?? 0;
  const cell = RIDER_PEDAL_CELL_PX;
  sprite.style.backgroundPosition = `-${stripIndex * cell}px 0`;
}

function createPeerRiderMarkerRoot(initialLabel: string): HTMLDivElement {
  ensureRiderPedalStripKeyframes();
  const root = document.createElement("div");
  root.className = "cycling-sim-marker-host map-view__peer-rider-host";
  const nametag = document.createElement("div");
  nametag.className = "map-view__rider-nametag map-view__rider-nametag--peer";
  nametag.setAttribute("aria-hidden", "true");
  nametag.textContent = initialLabel;
  const flip = document.createElement("div");
  flip.className = "cycling-sim-marker-flip";
  const stack = document.createElement("div");
  stack.className = "cycling-sim-marker-stack";
  const sprite = document.createElement("div");
  sprite.className = "cycling-sim-marker-pedal-sprite";
  const baseRaw = import.meta.env.BASE_URL ?? "/";
  const base = baseRaw.endsWith("/") ? baseRaw : `${baseRaw}/`;
  sprite.style.backgroundImage = `url("${base}rider/pedal-sprite.png?v=${RIDER_PEDAL_SPRITE_REVISION}")`;
  sprite.style.animationPlayState = "paused";
  stack.appendChild(sprite);
  flip.appendChild(stack);
  root.appendChild(nametag);
  root.appendChild(flip);
  return root;
}

function syncPeerDomMarkers(
  map: mapboxgl.Map,
  features: PeerDomGJFeature[],
  markersRef: { current: Map<string, mapboxgl.Marker> },
): void {
  const markers = markersRef.current;
  const next = new Set<string>();
  for (const f of features) {
    const id = f.properties.id;
    next.add(id);
    const lngLat = f.geometry.coordinates;
    const { label, pframe, hdg } = f.properties;
    let mk = markers.get(id);
    if (!mk) {
      const root = createPeerRiderMarkerRoot(label);
      mk = new mapboxgl.Marker({
        element: root,
        className: "map-view__peer-rider-marker",
        anchor: "bottom",
        ...PIN_MARKER_VIEWPORT_ALIGNMENT,
      })
        .setLngLat(lngLat)
        .addTo(map);
      markers.set(id, mk);
    } else {
      mk.setLngLat(lngLat);
    }
    const root = mk.getElement();
    const nametag = root.querySelector<HTMLDivElement>(".map-view__rider-nametag--peer");
    const flip = root.querySelector<HTMLDivElement>(".cycling-sim-marker-flip");
    const sprite = root.querySelector<HTMLDivElement>(".cycling-sim-marker-pedal-sprite");
    if (nametag) nametag.textContent = label;
    applyPeerDomSpriteFrame(sprite, pframe);
    if (flip) {
      flip.style.transform = hdg > 90 && hdg < 270 ? "scaleX(-1)" : "scaleX(1)";
    }
  }
  for (const id of [...markers.keys()]) {
    if (!next.has(id)) {
      markers.get(id)?.remove();
      markers.delete(id);
    }
  }
}

function subscribeReducedMotion(callback: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  const handler = () => callback();
  mq.addEventListener("change", handler);
  return () => mq.removeEventListener("change", handler);
}

function getReducedMotionSnapshot(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getReducedMotionServerSnapshot(): boolean {
  return false;
}

/** 내 라이더 스프라이트(동일 빌보드 정렬) */
const LIVE_RIDER_MARKER_ALIGNMENT = PIN_MARKER_VIEWPORT_ALIGNMENT;

/** 같은 코스를 주행 중인 다른 사용자 — `MapView` 에서는 Mapbox `Marker`(DOM)로 표시 */
export type MapPeerMarker = { id: string; lngLat: LngLat; label?: string | null };

/** 가상 주행 세션과 연동해 페달 루프 주기·재생 여부를 맞춘다 */
export type LiveRiderMotion = {
  sessionStatus: "running" | "paused";
  speedKmh: number;
  /** BLE 크랭크 RPM 등 — 유효·임계 이상이면 속도 추정보다 우선 */
  crankRpmFromSensor?: number | null;
};

export type MapViewProps = {
  accessToken: string | undefined;
  /** 부모 `useRouteElevationProfile` 과 동일(도로형 보정 포함) — 차트·코칭과 통일 */
  routeElevationProfile: RouteElevationProfileState;
  routeGeometry: LineStringGeometry | null;
  startLngLat: LngLat | null;
  endLngLat: LngLat | null;
  /** 출발·도착 사이 경유(순서대로 최대 3) */
  routeWaypoints: LngLat[];
  liveLngLat: LngLat | null;
  /** 내 위치 마커 페달 애니메이션(주행/일시정지·가상 속도). 없으면 스프라이트만 정지 표시 */
  liveRiderMotion?: LiveRiderMotion | null;
  /** 주행 중 내 머리 위 표시(닉네임·guest1 등). 없으면 태그 숨김 */
  liveRiderNametag?: string | null;
  /** 입문 코스 동행 등: 다른 라이더 위치 */
  peerMarkers?: MapPeerMarker[];
  mapStyle: string;
  mapZoom: number;
  followMode: FollowMode;
  enable3D: boolean;
  onMapZoom: (zoom: number) => void;
  /** `waypoint`일 때만 `waypointSlot`(0=WP1 … 2=WP3) 전달 */
  onSelectPoint: (
    type: "start" | "end" | "waypoint",
    lngLat: LngLat,
    waypointSlot?: 0 | 1 | 2,
  ) => void;
  /** Directions 프로필. 지도 팝업에서 호출 시 부모가 프로필 반영 후 즉시 경로 계산까지 수행할 수 있음. */
  routeProfile: RouteProfile;
  onRouteProfile: (p: RouteProfile) => void;
  /** OSRM(Mapbox Streets)·Mapillary 촬영 시퀀스 커버리지 */
  coverageOverlayMode: CoverageOverlayMode;
  /** Mapillary 타일·거리뷰용 클라이언트 토큰(없으면 Mapillary 모드 비활성) */
  mapillaryClientToken?: string | null;
  /** 메뉴 지명 검색 등 — `requestId`가 바뀔 때마다 한 번 카메라 이동 (`bbox` 있으면 도시 단위 fitBounds) */
  externalCameraJump?: {
    lngLat: LngLat;
    zoom?: number;
    requestId: number;
    bbox?: [number, number, number, number] | null;
  } | null;
  /** 로비: 같은 방에서 코스 주행 중인 다른 사용자(원 + 노선 LOD 는 부모에서 처리) */
  lobbySpectatorDots?: LobbySpectatorDot[] | null;
  lobbySpectatorRoutes?: LineStringGeometry[] | null;
};

export function MapView({
  accessToken,
  routeElevationProfile,
  routeGeometry,
  startLngLat,
  endLngLat,
  routeWaypoints,
  liveLngLat,
  liveRiderMotion,
  liveRiderNametag,
  peerMarkers,
  mapStyle,
  mapZoom,
  followMode,
  enable3D,
  onMapZoom,
  onSelectPoint,
  routeProfile,
  onRouteProfile,
  coverageOverlayMode,
  mapillaryClientToken,
  externalCameraJump = null,
  lobbySpectatorDots = null,
  lobbySpectatorRoutes = null,
}: MapViewProps) {
  const lobbySpectatorDataRef = useRef<{ dots: LobbySpectatorDot[]; routes: LineStringGeometry[] }>({
    dots: [],
    routes: [],
  });
  lobbySpectatorDataRef.current = {
    dots: lobbySpectatorDots ?? [],
    routes: lobbySpectatorRoutes ?? [],
  };

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const startMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const endMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const waypointMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const liveMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const liveMarkerPedalSpriteRef = useRef<HTMLDivElement | null>(null);
  const liveMarkerFlipRef = useRef<HTMLDivElement | null>(null);
  const liveMarkerNametagRef = useRef<HTMLDivElement | null>(null);
  const prevLiveForBearingRef = useRef<LngLat | null>(null);
  /** 스타일 리로드 시 동행 GeoJSON 재적용용 */
  const latestPeerMarkersRef = useRef<MapPeerMarker[]>([]);
  latestPeerMarkersRef.current = peerMarkers ?? [];
  const peerDriveSimRef = useRef(new Map<string, PeerDriveSimState>());
  const peerRidersRafRef = useRef<number | null>(null);
  const peerDomMarkersRef = useRef(new Map<string, mapboxgl.Marker>());
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const routeGeometryRef = useRef<LineStringGeometry | null>(null);
  const liveLngLatRef = useRef<LngLat | null>(null);
  const enable3DRef = useRef(enable3D);
  const initialMapStyleRef = useRef(mapStyle);
  const currentStyleRef = useRef(mapStyle);
  const onSelectPointRef = useRef(onSelectPoint);
  const routeWaypointsRef = useRef(routeWaypoints);
  const startLngLatRef = useRef(startLngLat);
  const endLngLatRef = useRef(endLngLat);
  const routeProfileRef = useRef(routeProfile);
  const onRouteProfileRef = useRef(onRouteProfile);
  const onMapZoomRef = useRef(onMapZoom);
  const prevLiveRef = useRef<LngLat | null>(null);
  /** 지명 검색 flyTo 직후 `liveLngLat` 추적 jumpTo 가 카메라를 되돌리는 것을 막는다 */
  const suppressCameraFollowUntilRef = useRef(0);
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
  const prefersReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  );
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
    routeWaypointsRef.current = routeWaypoints;
  }, [routeWaypoints]);

  useEffect(() => {
    startLngLatRef.current = startLngLat;
  }, [startLngLat]);

  useEffect(() => {
    endLngLatRef.current = endLngLat;
  }, [endLngLat]);

  useEffect(() => {
    routeProfileRef.current = routeProfile;
  }, [routeProfile]);

  useEffect(() => {
    onRouteProfileRef.current = onRouteProfile;
  }, [onRouteProfile]);

  const coverageOverlayModeRef = useRef(coverageOverlayMode);
  const mapillaryClientTokenRef = useRef(mapillaryClientToken);
  coverageOverlayModeRef.current = coverageOverlayMode;
  mapillaryClientTokenRef.current = mapillaryClientToken;

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
    peerDriveSimRef.current.clear();
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
      try {
        applyCoverageOverlayMode(
          map,
          coverageOverlayModeRef.current,
          mapillaryClientTokenRef.current ?? undefined,
        );
      } catch (e) {
        console.warn("[MapView] coverage overlay", e);
      }
      /** 스타일 리로드 시 기존 동행 DOM 마커 제거 후 시뮬 타깃만 재병합(동행은 GeoJSON이 아닌 Marker 로 표시) */
      for (const m of peerDomMarkersRef.current.values()) {
        try {
          m.remove();
        } catch {
          /* noop */
        }
      }
      peerDomMarkersRef.current.clear();
      mergePeerTargets(peerDriveSimRef.current, latestPeerMarkersRef.current, performance.now());
      try {
        syncLobbySpectatorLayers(
          map,
          lobbySpectatorDataRef.current.dots,
          lobbySpectatorDataRef.current.routes,
        );
      } catch {
        /* noop */
      }
    });

    map.on("click", (event) => {
      const picked: LngLat = [event.lngLat.lng, event.lngLat.lat];
      popupRef.current?.remove();
      const ac = new AbortController();
      const closePopup = () => {
        ac.abort();
        popupRef.current?.remove();
        popupRef.current = null;
      };
      const popup = new mapboxgl.Popup({
        closeOnClick: true,
        className: "map-view__pick-popup",
        maxWidth: "400px",
      })
        .setLngLat(picked)
        .setDOMContent(
          buildPickPopup({
            lngLat: picked,
            getWaypointCount: () => routeWaypointsRef.current.length,
            accessToken: accessToken.trim(),
            signal: ac.signal,
            onSelectPoint: (type, lngLat, slot) => onSelectPointRef.current(type, lngLat, slot),
            routeProfile: routeProfileRef.current,
            onRouteProfile: (p) => onRouteProfileRef.current(p),
            initialHasStart: Boolean(startLngLatRef.current),
            initialHasEnd: Boolean(endLngLatRef.current),
            closePopup,
          }),
        )
        .addTo(map);
      popup.on("close", () => {
        ac.abort();
        if (popupRef.current === popup) popupRef.current = null;
      });
      popupRef.current = popup;
    });

    map.on("zoom", () => {
      onMapZoomRef.current(Number(map.getZoom().toFixed(1)));
    });

    const onResize = () => map.resize();
    window.addEventListener("resize", onResize);
    requestAnimationFrame(onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      startMarkerRef.current?.remove();
      endMarkerRef.current?.remove();
      for (const wm of waypointMarkersRef.current) wm.remove();
      waypointMarkersRef.current = [];
      liveMarkerRef.current?.remove();
      popupRef.current?.remove();
      startMarkerRef.current = null;
      endMarkerRef.current = null;
      waypointMarkersRef.current = [];
      liveMarkerRef.current = null;
      liveMarkerFlipRef.current = null;
      liveMarkerPedalSpriteRef.current = null;
      liveMarkerNametagRef.current = null;
      popupRef.current = null;
      if (peerRidersRafRef.current != null) {
        cancelAnimationFrame(peerRidersRafRef.current);
        peerRidersRafRef.current = null;
      }
      for (const m of peerDomMarkersRef.current.values()) {
        try {
          m.remove();
        } catch {
          /* noop */
        }
      }
      peerDomMarkersRef.current.clear();
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
      if (map.isStyleLoaded()) {
        try {
          applyCoverageOverlayMode(map, coverageOverlayMode, mapillaryClientToken ?? undefined);
        } catch {
          /* noop */
        }
      }
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

    if (map.isStyleLoaded()) {
      try {
        applyCoverageOverlayMode(map, coverageOverlayMode, mapillaryClientToken ?? undefined);
      } catch {
        /* noop */
      }
    }
  }, [routeGeometry, mapLoaded]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !map.isStyleLoaded()) return;
    try {
      applyCoverageOverlayMode(map, coverageOverlayMode, mapillaryClientToken ?? undefined);
    } catch {
      /* noop */
    }
  }, [mapLoaded, coverageOverlayMode, mapillaryClientToken]);

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

  /** 경과지 마커(순번 1…3) */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const markers = waypointMarkersRef.current;
    while (markers.length > routeWaypoints.length) {
      markers.pop()?.remove();
    }
    while (markers.length < routeWaypoints.length) {
      const idx = markers.length;
      const order = idx + 1;
      const el = createWaypointMarkerEl(order);
      const m = new mapboxgl.Marker({
        element: el,
        className: "map-view__pin-marker map-view__waypoint-marker-host",
        ...PIN_MARKER_VIEWPORT_ALIGNMENT,
      })
        .setLngLat(routeWaypoints[idx]!)
        .addTo(map);
      markers.push(m);
    }
    for (let i = 0; i < routeWaypoints.length; i++) {
      markers[i]?.setLngLat(routeWaypoints[i]!);
    }
  }, [routeWaypoints, mapLoaded]);

  /** 라이브 위치 마커 — 페달 스프라이트 라이더(보고서 6·7·8절) */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    if (liveLngLat) {
      if (!liveMarkerRef.current) {
        const { root, nametag, flip, sprite } = createLiveRiderMarkerRoot();
        liveMarkerFlipRef.current = flip;
        liveMarkerPedalSpriteRef.current = sprite;
        liveMarkerNametagRef.current = nametag;
        prevLiveForBearingRef.current = null;
        liveMarkerRef.current = new mapboxgl.Marker({
          element: root,
          className: "map-view__live-rider-marker",
          anchor: "bottom",
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
      liveMarkerNametagRef.current = null;
      prevLiveForBearingRef.current = null;
    }

    const tagEl = liveMarkerNametagRef.current;
    if (tagEl) {
      const t = liveRiderNametag?.trim();
      tagEl.textContent = t ?? "";
      tagEl.style.display = t ? "flex" : "none";
    }
    const host = liveMarkerRef.current?.getElement();
    if (host) {
      host.title = liveRiderNametag?.trim() || "내 위치";
    }
  }, [liveLngLat, liveRiderNametag, mapLoaded]);

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
  }, [liveLngLat, liveRiderMotion, routeGeometry, mapLoaded, prefersReducedMotion]);

  /** 다른 라이더(동행): Firestore 스냅샷이 바뀌면 즉시 타깃만 병합(rAF 가 lerp·스프라이트 갱신) */
  useEffect(() => {
    mergePeerTargets(peerDriveSimRef.current, peerMarkers ?? [], performance.now());
  }, [peerMarkers]);

  /** 동행 위치·페달 프레임: rAF 로 부드럽게 보간 */
  useEffect(() => {
    if (!mapLoaded) return;
    let lastTs = performance.now();
    const tick = (now: number) => {
      const map = mapRef.current;
      if (!map?.isStyleLoaded()) {
        peerRidersRafRef.current = requestAnimationFrame(tick);
        return;
      }
      const dt = Math.min(0.1, (now - lastTs) / 1000);
      lastTs = now;
      mergePeerTargets(peerDriveSimRef.current, latestPeerMarkersRef.current, now);
      const fc = stepPeerDriveAndBuildGeoJson(peerDriveSimRef.current, dt, getBearing);
      syncPeerDomMarkers(map, fc.features as PeerDomGJFeature[], peerDomMarkersRef);
      peerRidersRafRef.current = requestAnimationFrame(tick);
    };
    peerRidersRafRef.current = requestAnimationFrame(tick);
    return () => {
      if (peerRidersRafRef.current != null) {
        cancelAnimationFrame(peerRidersRafRef.current);
      }
      peerRidersRafRef.current = null;
    };
  }, [mapLoaded]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    if (performance.now() < suppressCameraFollowUntilRef.current) return;
    if (Math.abs(map.getZoom() - mapZoom) < 0.05) return;
    map.zoomTo(mapZoom, { duration: 0 });
  }, [mapZoom, mapLoaded]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !map.isStyleLoaded()) return;
    syncLobbySpectatorLayers(map, lobbySpectatorDots ?? [], lobbySpectatorRoutes ?? []);
  }, [mapLoaded, lobbySpectatorDots, lobbySpectatorRoutes]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !externalCameraJump) return;
    const { lngLat, zoom: zoomHint, bbox } = externalCameraJump;
    map.stop();

    const syncZoomFromMap = () => {
      onMapZoomRef.current(Number(map.getZoom().toFixed(1)));
    };

    const useBbox =
      bbox != null &&
      bbox.length === 4 &&
      Number.isFinite(bbox[0]) &&
      Number.isFinite(bbox[1]) &&
      Number.isFinite(bbox[2]) &&
      Number.isFinite(bbox[3]) &&
      bbox[2] > bbox[0] &&
      bbox[3] > bbox[1];

    suppressCameraFollowUntilRef.current = performance.now() + (prefersReducedMotion ? 120 : 1700);

    if (useBbox) {
      const onEnd = () => {
        map.off("moveend", onEnd);
        syncZoomFromMap();
      };
      map.once("moveend", onEnd);
      map.fitBounds(
        [
          [bbox[0], bbox[1]],
          [bbox[2], bbox[3]],
        ],
        {
          padding: { top: 52, bottom: 120, left: 44, right: 44 },
          maxZoom: 16,
          duration: prefersReducedMotion ? 0 : 1100,
          essential: true,
        },
      );
      return () => {
        map.off("moveend", onEnd);
      };
    }

    const cur = map.getCenter();
    const from: LngLat = [cur.lng, cur.lat];
    const dM = getDistanceMeters(from, lngLat);
    let chosenZoom = zoomHint ?? 12;
    if (zoomHint == null) {
      if (dM > 1_200_000) chosenZoom = 5;
      else if (dM > 400_000) chosenZoom = 6;
      else if (dM > 120_000) chosenZoom = 9;
      else if (dM > 35_000) chosenZoom = 11;
      else if (dM > 8_000) chosenZoom = 13;
      else if (dM > 2_500) chosenZoom = 14;
      else chosenZoom = Math.max(map.getZoom(), 15);
    }
    const onEndFly = () => {
      map.off("moveend", onEndFly);
      syncZoomFromMap();
    };
    map.once("moveend", onEndFly);
    map.flyTo({
      center: lngLat,
      zoom: chosenZoom,
      duration: prefersReducedMotion ? 0 : 1100,
      essential: true,
    });
    return () => {
      map.off("moveend", onEndFly);
    };
  }, [externalCameraJump, mapLoaded, prefersReducedMotion]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    apply3DState(map, enable3D, BUILDING_LAYER_ID, TERRAIN_SOURCE_ID);
  }, [enable3D, mapLoaded]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    if (performance.now() < suppressCameraFollowUntilRef.current) return;
    if (!liveLngLat) return;

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
  const hasRoute = Boolean(routeGeometry && routeGeometry.coordinates.length > 1);
  /** 부모 `routeElevationProfile` — 예전 로컬 state 이름(`elevation`)과 혼동 방지용 별칭 */
  const elevation = routeElevationProfile;
  const isLoadingElevation = hasRoute && elevation.loading;
  const isElevationError = hasRoute && elevation.error !== null;
  const isElevationReady =
    hasRoute && !elevation.loading && elevation.error === null && elevation.values.length > 1;
  const routeLenMForChart =
    routeGeometry && routeGeometry.coordinates.length > 1 ? lineStringLengthMeters(routeGeometry) : 0;
  const elevationUi = isElevationReady
    ? buildElevationUi(elevation.values, progressRatio, routeLenMForChart)
    : null;
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
      {elevationUi ? (
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
  nametag: HTMLDivElement;
  flip: HTMLDivElement;
  sprite: HTMLDivElement;
} {
  ensureRiderPedalStripKeyframes();
  const root = document.createElement("div");
  root.className = "cycling-sim-marker-host map-view__live-rider-host";
  const nametag = document.createElement("div");
  nametag.className = "map-view__rider-nametag map-view__rider-nametag--live";
  nametag.setAttribute("aria-hidden", "true");
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
  root.appendChild(nametag);
  root.appendChild(flip);
  root.title = "내 위치";
  return { root, nametag, flip, sprite };
}

function createWaypointMarkerEl(order: number): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "map-view__waypoint-marker";
  el.textContent = String(order);
  el.title = `경과지 ${order}`;
  return el;
}

function isWaypointSlotEnabled(currentCount: number, slot: 0 | 1 | 2): boolean {
  if (slot < currentCount) return true;
  if (slot === currentCount && currentCount < MAX_ROUTE_WAYPOINTS) return true;
  return false;
}

function waypointSlotTitle(slot: 0 | 1 | 2, count: number): string {
  if (isWaypointSlotEnabled(count, slot)) {
    return slot < count
      ? `경유 ${slot + 1}번(WP${slot + 1}) 위치를 이 지점으로 바꿉니다`
      : `경유 ${slot + 1}번(WP${slot + 1})로 이 지점을 추가합니다`;
  }
  if (slot > count) {
    return `WP${slot + 1}을 쓰려면 먼저 WP${count + 1}까지 순서대로 설정하세요`;
  }
  return "경유지를 더 추가할 수 없습니다";
}

async function fetchPointElevationMeters(lngLat: LngLat, signal: AbortSignal): Promise<number | null> {
  const [lng, lat] = lngLat;
  const url = `https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`;
  const response = await fetch(url, { signal });
  if (!response.ok) return null;
  const data = (await response.json()) as { elevation?: number[] };
  const v = data.elevation?.[0];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function buildPickPopup(deps: {
  lngLat: LngLat;
  getWaypointCount: () => number;
  accessToken: string;
  signal: AbortSignal;
  onSelectPoint: (
    type: "start" | "end" | "waypoint",
    lngLat: LngLat,
    waypointSlot?: 0 | 1 | 2,
  ) => void;
  routeProfile: RouteProfile;
  onRouteProfile: (p: RouteProfile) => void;
  initialHasStart: boolean;
  initialHasEnd: boolean;
  closePopup: () => void;
}): HTMLDivElement {
  const {
    lngLat,
    getWaypointCount,
    accessToken,
    signal,
    onSelectPoint,
    routeProfile,
    onRouteProfile,
    initialHasStart,
    initialHasEnd,
    closePopup,
  } = deps;
  const [lng, lat] = lngLat;

  const wrap = document.createElement("div");
  wrap.className = "map-view__pick";

  /** 팝업이 열린 뒤 출발/도착 클릭으로 갱신되는 끝점 보유 상태(리렌더 전에도 동작). */
  const pins = { start: initialHasStart, end: initialHasEnd };

  const addressEl = document.createElement("div");
  addressEl.className = "map-view__pick-address";
  addressEl.textContent = "주소를 불러오는 중…";

  const metaEl = document.createElement("div");
  metaEl.className = "map-view__pick-meta";
  metaEl.textContent = `${lat.toFixed(4)}, ${lng.toFixed(4)} · 고도 …`;

  const rowMain = document.createElement("div");
  rowMain.className = "map-view__pick-actions map-view__pick-actions--main";

  const startBtn = document.createElement("button");
  startBtn.type = "button";
  startBtn.className = "map-view__pick-btn map-view__pick-btn--start";
  startBtn.textContent = "출발 (A)";
  startBtn.title = "이 위치를 출발지(A)로 설정";
  startBtn.setAttribute("aria-label", "출발지로 설정");
  startBtn.onclick = () => {
    onSelectPoint("start", lngLat);
    pins.start = true;
    if (!pins.end) closePopup();
    else syncProfileUi();
  };

  const endBtn = document.createElement("button");
  endBtn.type = "button";
  endBtn.className = "map-view__pick-btn map-view__pick-btn--end";
  endBtn.textContent = "도착 (B)";
  endBtn.title = "이 위치를 도착지(B)로 설정";
  endBtn.setAttribute("aria-label", "도착지로 설정");
  endBtn.onclick = () => {
    onSelectPoint("end", lngLat);
    pins.end = true;
    if (!pins.start) closePopup();
    else syncProfileUi();
  };

  rowMain.append(startBtn, endBtn);

  const rowWp = document.createElement("div");
  rowWp.className = "map-view__pick-actions map-view__pick-actions--wps";

  const wpSlots: (0 | 1 | 2)[] = [0, 1, 2];
  const initialCount = getWaypointCount();
  for (const slot of wpSlots) {
    const wpBtn = document.createElement("button");
    wpBtn.type = "button";
    wpBtn.className = "map-view__pick-btn map-view__pick-btn--wp";
    wpBtn.textContent = `WP${slot + 1}`;
    const enabled = isWaypointSlotEnabled(initialCount, slot);
    wpBtn.disabled = !enabled;
    wpBtn.title = waypointSlotTitle(slot, initialCount);
    wpBtn.setAttribute("aria-label", `경유지 ${slot + 1}번(WP${slot + 1})`);
    wpBtn.onclick = () => {
      const count = getWaypointCount();
      if (!isWaypointSlotEnabled(count, slot)) return;
      onSelectPoint("waypoint", lngLat, slot);
      closePopup();
    };
    rowWp.appendChild(wpBtn);
  }

  const profileSection = document.createElement("div");
  profileSection.className = "map-view__pick-profile-section";

  const profileHint = document.createElement("p");
  profileHint.className = "map-view__pick-profile-hint";
  profileHint.textContent = "이동 수단을 고르면 즉시 경로를 계산하고 팝업이 닫힙니다.";

  const rowProfile = document.createElement("div");
  rowProfile.className = "map-view__pick-actions map-view__pick-actions--profile";
  rowProfile.setAttribute("role", "group");
  rowProfile.setAttribute("aria-label", "주행 방법");

  const profileSpecs: { profile: RouteProfile; label: string }[] = [
    { profile: "driving", label: "자동차" },
    { profile: "cycling", label: "자전거" },
    { profile: "walking", label: "보행" },
  ];

  const profileButtons: HTMLButtonElement[] = [];
  for (const { profile, label } of profileSpecs) {
    const pb = document.createElement("button");
    pb.type = "button";
    pb.className = "map-view__pick-btn map-view__pick-btn--profile";
    if (profile === routeProfile) pb.classList.add("is-active");
    pb.textContent = label;
    pb.title = `${label}로 경로를 계산합니다`;
    pb.setAttribute("aria-label", `${label} 주행`);
    pb.onclick = () => {
      if (!pins.start || !pins.end) return;
      onRouteProfile(profile);
      closePopup();
    };
    profileButtons.push(pb);
    rowProfile.appendChild(pb);
  }

  function syncProfileUi() {
    const ready = pins.start && pins.end;
    profileSection.hidden = !ready;
    wrap.classList.toggle("map-view__pick--awaiting-profile", ready);
    if (!ready) return;
    profileSpecs.forEach((spec, i) => {
      const pb = profileButtons[i];
      if (!pb) return;
      pb.title = `${spec.label}로 경로를 계산합니다`;
    });
  }

  profileSection.append(profileHint, rowProfile);
  syncProfileUi();

  wrap.append(addressEl, metaEl, rowMain, rowWp, profileSection);

  const token = accessToken.trim();
  if (token.length > 0) {
    void (async () => {
      try {
        const [place, elevM] = await Promise.all([
          fetchMapboxReverseGeocodePlaceName(lngLat, token, signal),
          fetchPointElevationMeters(lngLat, signal),
        ]);
        if (signal.aborted) return;
        addressEl.textContent = place ?? "주소를 찾을 수 없습니다";
        const elevLabel =
          elevM != null && Number.isFinite(elevM) ? `${Math.round(elevM)}m` : "—";
        metaEl.textContent = `${lat.toFixed(4)}, ${lng.toFixed(4)} · 고도 ${elevLabel}`;
      } catch {
        if (signal.aborted) return;
        addressEl.textContent = "주소를 불러오지 못했습니다";
        metaEl.textContent = `${lat.toFixed(4)}, ${lng.toFixed(4)} · 고도 —`;
      }
    })();
  } else {
    addressEl.textContent = "지도 토큰이 없어 주소를 표시할 수 없습니다";
    void (async () => {
      try {
        const elevM = await fetchPointElevationMeters(lngLat, signal);
        if (signal.aborted) return;
        const elevLabel =
          elevM != null && Number.isFinite(elevM) ? `${Math.round(elevM)}m` : "—";
        metaEl.textContent = `${lat.toFixed(4)}, ${lng.toFixed(4)} · 고도 ${elevLabel}`;
      } catch {
        if (signal.aborted) return;
        metaEl.textContent = `${lat.toFixed(4)}, ${lng.toFixed(4)} · 고도 —`;
      }
    })();
  }

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

/** 짧은 코스에서 세로 “자동 맞춤”만으로 고도 잡음이 과대 표시되는 것을 줄이기 위한 상한(m). */
const ELEV_CHART_SHORT_ROUTE_MAX_M = 10_000;
/** 전장 대비 세로 최소 표시 고도폭: 전장의 약 1.1%를 한 번에 쓰는 구간으로 본다(도심 완만 구간 완화). */
const ELEV_CHART_VERT_FLOOR_PER_ROUTE_M = 0.011;
/** 최소 표시 고도폭 하한(m): 아주 짧은 구간에서도 극단 과장 방지 */
const ELEV_CHART_VERT_FLOOR_MIN_M = 12;

/**
 * 고도 차트 세로 스케일.
 * - 10km 초과: 데이터 최소~최대를 세로에 맞춤(기존과 동일).
 * - 10km 이하: `max(데이터폭, 거리기반 바닥폭)`으로 세로 범위를 넓혀, 작은 편차가 그래프 높이를 덜 잡아먹게 함(중심 정렬).
 */
function buildElevationUi(
  values: number[],
  progressRatio: number | null,
  routeLengthMeters: number,
) {
  const width = 420;
  const height = 100;
  const pad = 8;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const dataSpan = Math.max(max - min, 1);
  const mid = (min + max) / 2;
  let dispMin = min;
  let range = dataSpan;
  if (
    routeLengthMeters > 0 &&
    routeLengthMeters <= ELEV_CHART_SHORT_ROUTE_MAX_M &&
    Number.isFinite(routeLengthMeters)
  ) {
    const floorSpan = Math.max(
      ELEV_CHART_VERT_FLOOR_MIN_M,
      routeLengthMeters * ELEV_CHART_VERT_FLOOR_PER_ROUTE_M,
    );
    range = Math.max(dataSpan, floorSpan);
    dispMin = mid - range / 2;
  }
  const points = values.map((value, index) => {
    const x = pad + (index / (values.length - 1)) * (width - pad * 2);
    const y = height - pad - ((value - dispMin) / range) * (height - pad * 2);
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
    const yLower = height - pad - ((values[lowerIdx] - dispMin) / range) * (height - pad * 2);
    const yUpper = height - pad - ((values[upperIdx] - dispMin) / range) * (height - pad * 2);
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
