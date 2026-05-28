import { useEffect, useMemo, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { FeatureCollection, Point } from "geojson";
import type { MapViewportBounds } from "../../lib/activityWorldLod";
import type { LngLat } from "../../lib/geo";
import {
  fetchPublicPublicationPresencesDetailed,
  PUBLICATION_PRESENCE_POLL_MS,
} from "../../lib/firestorePublicationPresence";
import { getMapDebugPhase } from "../../lib/mapDebugPhase";

const DEBUG_SRC_ID = "debug-world-light-src";
const DEBUG_LAYER_ID = "debug-world-light-circle";
const STYLE_RELOAD_DEBOUNCE_MS = 300;

const PHASE_A_LNGLAT: LngLat = [127.035, 37.505];
const PHASE_B_FALLBACK_LNGLAT: LngLat = [8.04, 46.63];

type DebugWorldLightMapProps = {
  accessToken?: string;
  mapStyle: string;
  mapZoom: number;
  onMapZoom?: (zoom: number) => void;
  onMapViewport?: (viewport: MapViewportBounds, spanKm: number) => void;
};

type DebugSyncMeta = {
  firestoreRowCount: number;
  usedFallback: boolean;
  fetchError: string | null;
};

type PhaseBDotResult = DebugSyncMeta & { lngLat: LngLat | null };

function singlePointFc(lngLat: LngLat | null): FeatureCollection<Point> {
  if (!lngLat) return { type: "FeatureCollection", features: [] };
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        id: "debug-world-light-dot",
        properties: { courseId: "debug-world-light-dot" },
        geometry: { type: "Point", coordinates: lngLat },
      },
    ],
  };
}

function viewportFromBounds(bounds: mapboxgl.LngLatBounds): MapViewportBounds {
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  return { west: sw.lng, south: sw.lat, east: ne.lng, north: ne.lat };
}

function approxSpanKm(v: MapViewportBounds): number {
  const latKm = Math.abs(v.north - v.south) * 111;
  const centerLatRad = (((v.north + v.south) / 2) * Math.PI) / 180;
  const lngKm = Math.abs(v.east - v.west) * 111 * Math.cos(centerLatRad);
  return Math.max(latKm, lngKm);
}

function resolveBeforeId(map: mapboxgl.Map): string | undefined {
  const candidates = [
    "road-label",
    "road-number-shield",
    "settlement-label",
    "waterway-label",
    "poi-label",
  ];
  for (const id of candidates) {
    if (map.getLayer(id)) return id;
  }
  return undefined;
}

/** source/layer를 이번 호출에서 새로 만든 경우에만 true */
function ensureDebugLayer(map: mapboxgl.Map): boolean {
  let rebound = false;
  if (!map.getSource(DEBUG_SRC_ID)) {
    map.addSource(DEBUG_SRC_ID, { type: "geojson", data: singlePointFc(null) });
    rebound = true;
  }
  if (!map.getLayer(DEBUG_LAYER_ID)) {
    const beforeId = resolveBeforeId(map);
    map.addLayer(
      {
        id: DEBUG_LAYER_ID,
        type: "circle",
        source: DEBUG_SRC_ID,
        paint: {
          "circle-radius": 12,
          "circle-color": "#ff0000",
          "circle-opacity": 1,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      },
      beforeId,
    );
    rebound = true;
  }
  try {
    map.moveLayer(DEBUG_LAYER_ID);
  } catch {
    /* noop */
  }
  return rebound;
}

async function resolvePhaseBDot(): Promise<PhaseBDotResult> {
  try {
    const { rows, activeQueryError, closedQueryError } =
      await fetchPublicPublicationPresencesDetailed();
    const fetchError = activeQueryError ?? closedQueryError ?? null;
    if (fetchError) {
      console.warn("[DebugWorldLight] fetch failed", fetchError);
    }
    const withPoint = rows.find((r) => r.representativePoint);
    const firestoreRowCount = rows.length;
    if (withPoint?.representativePoint) {
      return {
        lngLat: withPoint.representativePoint,
        firestoreRowCount,
        usedFallback: false,
        fetchError,
      };
    }
    if (firestoreRowCount === 0) {
      console.warn("[DebugWorldLight] rowCount 0 — using fallback");
    } else {
      console.warn("[DebugWorldLight] rowCount > 0 but representativePoint 없음", {
        rowCount: firestoreRowCount,
      });
    }
    return {
      lngLat: PHASE_B_FALLBACK_LNGLAT,
      firestoreRowCount,
      usedFallback: true,
      fetchError,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[DebugWorldLight] fetch failed", msg);
    return {
      lngLat: PHASE_B_FALLBACK_LNGLAT,
      firestoreRowCount: 0,
      usedFallback: true,
      fetchError: msg,
    };
  }
}

export function DebugWorldLightMap({
  accessToken,
  mapStyle,
  mapZoom,
  onMapZoom,
  onMapViewport,
}: DebugWorldLightMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const dotRef = useRef<LngLat | null>(null);
  const cameraKeyRef = useRef("");
  const styleReloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onMapZoomRef = useRef(onMapZoom);
  const onMapViewportRef = useRef(onMapViewport);
  onMapZoomRef.current = onMapZoom;
  onMapViewportRef.current = onMapViewport;

  const defaultCenter = useMemo<LngLat>(() => [8.04, 46.63], []);

  useEffect(() => {
    if (!containerRef.current) return;
    if (mapRef.current) return;
    if (accessToken) mapboxgl.accessToken = accessToken;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: mapStyle,
      center: defaultCenter,
      zoom: mapZoom,
      attributionControl: true,
    });
    mapRef.current = map;

    const reportViewport = () => {
      const bounds = map.getBounds();
      if (!bounds || !onMapViewportRef.current) return;
      const v = viewportFromBounds(bounds);
      onMapViewportRef.current(v, approxSpanKm(v));
    };
    map.on("zoomend", () => onMapZoomRef.current?.(Number(map.getZoom().toFixed(1))));
    map.on("moveend", reportViewport);

    const applyAfterStyleReload = () => {
      const rebound = ensureDebugLayer(map);
      if (rebound) {
        console.log("[DebugWorldLight] style-reload", { rebound: true });
      }
      const fc = singlePointFc(dotRef.current);
      (map.getSource(DEBUG_SRC_ID) as mapboxgl.GeoJSONSource | undefined)?.setData(fc);
    };

    const onStyleLoad = () => {
      if (styleReloadTimerRef.current != null) {
        window.clearTimeout(styleReloadTimerRef.current);
      }
      styleReloadTimerRef.current = window.setTimeout(() => {
        styleReloadTimerRef.current = null;
        applyAfterStyleReload();
      }, STYLE_RELOAD_DEBOUNCE_MS);
    };
    map.on("style.load", onStyleLoad);

    return () => {
      if (styleReloadTimerRef.current != null) {
        window.clearTimeout(styleReloadTimerRef.current);
      }
      map.off("style.load", onStyleLoad);
      map.remove();
      mapRef.current = null;
    };
  }, [accessToken, mapStyle, defaultCenter, mapZoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (Math.abs(map.getZoom() - mapZoom) > 0.05) {
      map.zoomTo(mapZoom, { duration: 0 });
    }
  }, [mapZoom]);

  useEffect(() => {
    let cancelled = false;
    let intervalId: number | null = null;
    const map = mapRef.current;
    if (!map) return;

    const syncWithLngLat = (
      phase: ReturnType<typeof getMapDebugPhase>,
      lngLat: LngLat | null,
      meta: DebugSyncMeta,
    ) => {
      const live = mapRef.current;
      if (!live || !live.isStyleLoaded()) return;
      dotRef.current = lngLat;
      ensureDebugLayer(live);
      const fc = singlePointFc(lngLat);
      (live.getSource(DEBUG_SRC_ID) as mapboxgl.GeoJSONSource | undefined)?.setData(fc);

      console.log("[DebugWorldLight] sync", {
        phase,
        sourceCount: fc.features.length,
        hasLayer: Boolean(live.getLayer(DEBUG_LAYER_ID)),
        firstLngLat: lngLat,
        firestoreRowCount: meta.firestoreRowCount,
        usedFallback: meta.usedFallback,
        fetchError: meta.fetchError,
      });

      live.once("idle", () => {
        let querySourceCount = 0;
        let queryRenderedCount = 0;
        try {
          querySourceCount = live.querySourceFeatures(DEBUG_SRC_ID).length;
        } catch {
          /* noop */
        }
        try {
          queryRenderedCount = live.queryRenderedFeatures({ layers: [DEBUG_LAYER_ID] }).length;
        } catch {
          /* noop */
        }
        console.log("[DebugWorldLight] idle-check", { querySourceCount, queryRenderedCount });
      });

      if (lngLat) {
        const key = `${lngLat[0].toFixed(5)}|${lngLat[1].toFixed(5)}`;
        if (key !== cameraKeyRef.current) {
          cameraKeyRef.current = key;
          try {
            live.panTo(lngLat as [number, number], { duration: 700, essential: true });
            console.log("[DebugWorldLight] camera", { mode: "panTo", lngLat });
          } catch {
            live.jumpTo({ center: lngLat as [number, number], zoom: Math.max(9, live.getZoom()) });
            console.log("[DebugWorldLight] camera", { mode: "jumpTo", lngLat });
          }
        }
      }
    };

    const tick = async () => {
      const phase = getMapDebugPhase();
      if (phase !== "A" && phase !== "B" && phase !== "C") return;

      if (phase === "A") {
        syncWithLngLat(phase, PHASE_A_LNGLAT, {
          firestoreRowCount: 0,
          usedFallback: false,
          fetchError: null,
        });
        return;
      }

      const result = await resolvePhaseBDot();
      if (cancelled) return;
      syncWithLngLat(phase, result.lngLat, result);
    };

    void tick();
    intervalId = window.setInterval(() => void tick(), PUBLICATION_PRESENCE_POLL_MS);
    return () => {
      cancelled = true;
      if (intervalId != null) window.clearInterval(intervalId);
    };
  }, []);

  return <div ref={containerRef} className="map-view" />;
}
