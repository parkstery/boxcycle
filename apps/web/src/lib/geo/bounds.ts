/**
 * 경계 상자(bbox) 계산 — 순수 기하. leaf.
 *
 * 2026-09-26 (Phase 6-D3): `route/repo/firestoreCourses` 안에 있던 것을 **그대로** 옮겨 왔다.
 * 두 함수는 Firestore 를 전혀 모르는데 저장소 파일에 살고 있었고, 그 때문에
 * `activity` 가 남의 도메인 **저장소**를 import 하고 있었다(위반 1건).
 * Phase 5 에서 `haversineMeters` 가 그랬던 것과 같은 모양이다 — 어떤 모듈이 필요로 해서
 * 그 옆에 놓였고, 그래서 아래 층이 위 층을 올려다보게 됐다.
 */
import type { LineStringGeometry, LngLat } from "./geo";

/** 구조적 bbox. `CourseDoc["bounds"]` 와 같은 모양이라 그대로 주고받을 수 있다. */
export type LngLatBounds = {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
};

export function boundsCenterLngLat(bounds: LngLatBounds): LngLat {
  return [(bounds.minLng + bounds.maxLng) / 2, (bounds.minLat + bounds.maxLat) / 2];
}

export function boundsFromLineStringGeometry(geometry: LineStringGeometry): LngLatBounds | null {
  const coords = geometry.coordinates;
  if (coords.length < 1) return null;
  let minLng = coords[0]![0];
  let maxLng = minLng;
  let minLat = coords[0]![1];
  let maxLat = minLat;
  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return { minLng, minLat, maxLng, maxLat };
}
