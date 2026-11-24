import type { Map as MapboxMap } from "mapbox-gl";

// Standard 는 import 된 스타일이라 공개 API 로 레이어를 바꿀 수 없다 — disable3dCutoff 와 같은 경로를 쓴다.
type Layer = { id: string; type: string; getPaintProperty(name: string): unknown };
type Fragment = {
  _layers?: Record<string, Layer>;
  fragments?: Array<{ style?: Fragment }>;
  setPaintProperty(id: string, name: string, value: unknown): void;
};
type InternalMap = MapboxMap & { style?: Fragment; _update?: (styleDirty: boolean) => void };

const shadowProperty: Record<string, string> = {
  building: "building-cast-shadows",
  "fill-extrusion": "fill-extrusion-cast-shadows",
  model: "model-cast-shadows",
};
/** 레이어별 원래 값 — 스타일이 새로 로드되면 레이어 객체도 새것이라 저절로 비워진다. */
const originals = new WeakMap<Layer, unknown>();

/** 3D 객체가 드리우는 그림자. 끄기 전 값을 기억했다가 켤 때 되돌린다. 벽면 명암은 바뀌지 않는다. */
export function setStandardShadows(map: MapboxMap, enabled: boolean): void {
  const internal = map as InternalMap;
  let changed = false;
  const visit = (style: Fragment) => {
    for (const layer of Object.values(style._layers ?? {})) {
      const property = shadowProperty[layer.type];
      if (!property) continue;
      if (enabled) {
        if (!originals.has(layer)) continue;
        style.setPaintProperty(layer.id, property, originals.get(layer));
        originals.delete(layer);
      } else {
        if (originals.has(layer)) continue;
        originals.set(layer, layer.getPaintProperty(property));
        style.setPaintProperty(layer.id, property, false);
      }
      changed = true;
    }
    for (const fragment of style.fragments ?? []) if (fragment.style) visit(fragment.style);
  };
  if (internal.style) visit(internal.style);
  if (changed) internal._update?.(true);
}
