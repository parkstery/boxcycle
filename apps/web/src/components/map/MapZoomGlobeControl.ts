import type { IControl, Map as MapboxMap } from "mapbox-gl";
import { applyMapGlobeView } from "../../lib/mapGlobeView";

function makeCtrlButton(
  className: string,
  title: string,
  ariaLabel: string,
  onClick: () => void,
): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = className;
  btn.title = title;
  btn.setAttribute("aria-label", ariaLabel);
  const icon = document.createElement("span");
  icon.className = "mapboxgl-ctrl-icon";
  icon.setAttribute("aria-hidden", "true");
  btn.appendChild(icon);
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    onClick();
  });
  return btn;
}

/** Mapbox `NavigationControl` 줌 버튼 + 지구 전체 보기(동일 `mapboxgl-ctrl-group`). */
export class MapZoomGlobeControl implements IControl {
  private _container?: HTMLDivElement;

  onAdd(map: MapboxMap): HTMLElement {
    const group = document.createElement("div");
    group.className = "mapboxgl-ctrl mapboxgl-ctrl-group";

    const zoomIn = makeCtrlButton(
      "mapboxgl-ctrl-zoom-in",
      "확대",
      "줌 한 단계 확대",
      () => map.zoomIn({ duration: 300 }),
    );
    const zoomOut = makeCtrlButton(
      "mapboxgl-ctrl-zoom-out",
      "축소",
      "줌 한 단계 축소",
      () => map.zoomOut({ duration: 300 }),
    );
    const globe = makeCtrlButton(
      "mapboxgl-ctrl-globe-view",
      "지구 전체 보기",
      "지구 전체 보기",
      () => applyMapGlobeView(map),
    );

    group.appendChild(zoomIn);
    group.appendChild(zoomOut);
    group.appendChild(globe);
    this._container = group;
    return group;
  }

  onRemove(): void {
    this._container?.remove();
    this._container = undefined;
  }
}
