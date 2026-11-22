/** Real terrain height by default; only the isolated comparison can exaggerate it. */
export function resolveRideTerrainScale(preview: boolean, search: string): 1 | 1.3 {
  return preview && new URLSearchParams(search).get("terrainscale") === "1.3" ? 1.3 : 1;
}

export function rideTerrainScale(): 1 | 1.3 {
  return resolveRideTerrainScale(
    import.meta.env.VITE_TERRAIN_SCALE_PREVIEW === "1",
    typeof window === "undefined" ? "" : window.location.search,
  );
}
