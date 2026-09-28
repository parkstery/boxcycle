/**
 * 지도 위 **핀 마커들의 생명주기** — 출발·도착 · 장소 검색 결과 · 이어 달리기 재개점 ·
 * 경유지(순번 1…3).
 *
 * 왜 MapView 에서 나왔나 (2026-09-28, 구조 정비 A-5b) — 넷 다 같은 모양이다:
 * 「값이 있으면 마커를 만들거나 옮기고, 없으면 지운다」. 지도 이벤트도 구독도 없고
 * `mapLoaded` 와 자기 입력만 본다. **동작·클래스명·의존성 배열은 바꾸지 않았다.**
 *
 * ⚠️ 마커 참조는 이 훅이 갖는다. 지도를 통째로 내릴 때(`MapView` 의 초기화 effect 정리)
 * 는 `clearOnMapTeardown()` 을 부른다 — 종전에 그 자리에서 하던 일과 **같은 범위**다:
 * 출발·도착·장소 검색·경유지만 지우고 **재개점은 건드리지 않는다**(자기 effect 가 지운다).
 * 범위를 넓히면 그건 이동이 아니라 동작 변경이다.
 */
import { useCallback, useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import type { MutableRefObject } from "react";
import type { LngLat } from "../../lib/geo/geo";
import { createRouteEndpointPinEl, createWaypointMarkerEl } from "./mapPopupElements";
import { PIN_MARKER_VIEWPORT_ALIGNMENT } from "./riderDomMarkers";

export type MapPinMarkersInput = {
  mapRef: MutableRefObject<mapboxgl.Map | null>;
  mapLoaded: boolean;
  startLngLat: LngLat | null;
  endLngLat: LngLat | null;
  placeSearchMarkerLngLat: LngLat | null;
  resumeAnchor: { lngLat: LngLat; label: string } | null;
  routeWaypoints: LngLat[];
};

export function useMapPinMarkers({
  mapRef,
  mapLoaded,
  startLngLat,
  endLngLat,
  placeSearchMarkerLngLat,
  resumeAnchor,
  routeWaypoints,
}: MapPinMarkersInput): { clearOnMapTeardown: () => void } {
  const startMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const endMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const placeSearchMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const resumeMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const waypointMarkersRef = useRef<mapboxgl.Marker[]>([]);

  /** 출발/도착 마커 */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    if (startLngLat) {
      if (!startMarkerRef.current) {
        startMarkerRef.current = new mapboxgl.Marker({
          element: createRouteEndpointPinEl("start"),
          anchor: "bottom",
          className: "map-view__pin-marker map-view__pin-marker--start map-view__route-pin-marker",
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
          element: createRouteEndpointPinEl("end"),
          anchor: "bottom",
          className: "map-view__pin-marker map-view__pin-marker--end map-view__route-pin-marker",
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
  }, [mapRef, startLngLat, endLngLat, mapLoaded]);

  /** 메뉴 장소 검색 결과 위치 */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    if (placeSearchMarkerLngLat) {
      if (!placeSearchMarkerRef.current) {
        placeSearchMarkerRef.current = new mapboxgl.Marker({
          color: "#0ea5e9",
          className: "map-view__pin-marker map-view__pin-marker--place-search",
          ...PIN_MARKER_VIEWPORT_ALIGNMENT,
        })
          .setLngLat(placeSearchMarkerLngLat)
          .addTo(map);
      } else {
        placeSearchMarkerRef.current.setLngLat(placeSearchMarkerLngLat);
      }
    } else {
      placeSearchMarkerRef.current?.remove();
      placeSearchMarkerRef.current = null;
    }
  }, [mapRef, placeSearchMarkerLngLat, mapLoaded]);

  /** 이어 달리기 재개점 마커 — 「N% · 여기서 계속」(§3.4) */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    if (resumeAnchor) {
      if (!resumeMarkerRef.current) {
        const el = document.createElement("div");
        el.className = "map-view__resume-marker";
        el.textContent = resumeAnchor.label;
        el.title = resumeAnchor.label;
        resumeMarkerRef.current = new mapboxgl.Marker({
          element: el,
          className: "map-view__pin-marker map-view__resume-marker-host",
          ...PIN_MARKER_VIEWPORT_ALIGNMENT,
        })
          .setLngLat(resumeAnchor.lngLat)
          .addTo(map);
      } else {
        const el = resumeMarkerRef.current.getElement().querySelector<HTMLDivElement>(
          ".map-view__resume-marker",
        );
        const host = resumeMarkerRef.current.getElement();
        const target = el ?? (host.classList.contains("map-view__resume-marker") ? host : null);
        if (target) {
          target.textContent = resumeAnchor.label;
          target.title = resumeAnchor.label;
        }
        resumeMarkerRef.current.setLngLat(resumeAnchor.lngLat);
      }
    } else {
      resumeMarkerRef.current?.remove();
      resumeMarkerRef.current = null;
    }
  }, [mapRef, resumeAnchor, mapLoaded]);

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
  }, [mapRef, routeWaypoints, mapLoaded]);

  /**
   * 지도를 통째로 내릴 때만 부른다. 종전 `MapView` 초기화 effect 의 정리 구간이
   * 하던 것과 **같은 범위·같은 순서**다.
   */
  const clearOnMapTeardown = useCallback(() => {
    startMarkerRef.current?.remove();
    endMarkerRef.current?.remove();
    placeSearchMarkerRef.current?.remove();
    for (const wm of waypointMarkersRef.current) wm.remove();
    waypointMarkersRef.current = [];
    startMarkerRef.current = null;
    endMarkerRef.current = null;
    placeSearchMarkerRef.current = null;
    waypointMarkersRef.current = [];
  }, []);

  return { clearOnMapTeardown };
}
