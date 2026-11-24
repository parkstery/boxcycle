import type { Map as MapboxMap } from "mapbox-gl";

// Standard is an imported style. Mapbox GL JS 3.23.1 exposes no public API
// for changing an imported layer, so visit its style fragments as well.
type Layer = { id: string; type: string; getPaintProperty(name: string): unknown };
type Fragment = {
  _layers?: Record<string, Layer>;
  fragments?: Array<{ style?: Fragment }>;
  setPaintProperty(id: string, name: string, value: number): void;
};
type InternalMap = MapboxMap & { style?: Fragment; _update?: (styleDirty: boolean) => void };

const cutoffProperty: Record<string, string> = {
  building: "building-cutoff-fade-range",
  "fill-extrusion": "fill-extrusion-cutoff-fade-range",
  model: "model-cutoff-fade-range",
};

/** Disable SDK distance cutoff, including Standard buildings, landmarks and trees. */
export function disable3dCutoff(map: MapboxMap): void {
  const internal = map as InternalMap;
  let changed = false;
  const visit = (style: Fragment) => {
    for (const layer of Object.values(style._layers ?? {})) {
      const property = cutoffProperty[layer.type];
      if (!property || layer.getPaintProperty(property) === 0) continue;
      style.setPaintProperty(layer.id, property, 0);
      changed = true;
    }
    for (const fragment of style.fragments ?? []) if (fragment.style) visit(fragment.style);
  };
  if (internal.style) visit(internal.style);
  if (changed) internal._update?.(true);
}
