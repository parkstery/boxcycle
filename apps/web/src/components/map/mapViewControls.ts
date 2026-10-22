import mapboxgl from "mapbox-gl";

/**
 * 축척 막대는 Mapbox 가 계산한 폭을 그대로 쓴다(줌에 따라 늘고 준다). 래퍼는 배치용 클래스만 단다.
 * ScaleControl 루트에 width 를 강제하면 막대 길이가 고정돼 축척이 거짓이 된다.
 */
export function createFixedScaleBoxControl(): mapboxgl.IControl {
  const inner = new mapboxgl.ScaleControl({ maxWidth: 120, unit: "metric" });
  let wrap: HTMLDivElement | undefined;
  return {
    onAdd(map: mapboxgl.Map) {
      const scaleEl = inner.onAdd(map);
      scaleEl.classList.remove("mapboxgl-ctrl");
      wrap = document.createElement("div");
      wrap.className = "mapboxgl-ctrl map-ctrl-scale-box";
      wrap.appendChild(scaleEl);
      return wrap;
    },
    onRemove() {
      inner.onRemove();
      wrap?.remove();
      wrap = undefined;
    },
  };
}

export function isMapAttachedToContainer(map: mapboxgl.Map, container: HTMLElement | null): boolean {
  if (!container) return false;
  try {
    const el = map.getContainer();
    return el.parentNode === container;
  } catch {
    return false;
  }
}
